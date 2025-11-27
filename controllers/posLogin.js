const jwt = require('jsonwebtoken')
const posLoginRouter = require('express').Router()
const Employee = require('../models/employee')
const Customer = require('../models/customer')
const posAuthService = require('../services/posAuthService')

/**
 * Helper: Generate JWT token for POS session
 */
const generatePOSToken = (employeeId, userCode, roleId) => {
  return jwt.sign(
    {
      id: employeeId,
      userCode: userCode,
      role: roleId,
      isPOS: true // Flag to identify POS sessions
    },
    process.env.JWT_SECRET,
    { expiresIn: '12h' } // 12 hours for POS sessions
  )
}

/**
 * @route   POST /api/pos-login
 * @desc    Login to POS system with employee code and PIN
 * @access  Public
 */
posLoginRouter.post('/', async (request, response) => {
  const { employeeCode, pin } = request.body

  // Validation
  if (!employeeCode || !pin) {
    return response.status(400).json({
      success: false,
      error: {
        message: 'Employee code and PIN are required',
        code: 'MISSING_CREDENTIALS'
      }
    })
  }

  try {
    // Find user account by userCode first
    const userAccount = await Employee.findOne({})
      .populate({
        path: 'userAccount',
        match: { userCode: employeeCode.toUpperCase() },
        select: 'userCode email role isActive',
        populate: {
          path: 'role',
          select: 'roleName permissions'
        }
      })
      .lean()

    // Better approach: Find by userCode directly
    const UserAccount = require('../models/userAccount')
    const foundUserAccount = await UserAccount.findOne({
      userCode: employeeCode.toUpperCase()
    }).populate('role', 'roleName permissions')

    if (!foundUserAccount) {
      return response.status(401).json({
        success: false,
        error: {
          message: 'Invalid employee code or PIN',
          code: 'INVALID_CREDENTIALS'
        }
      })
    }

    // Find employee by userAccount
    const employee = await Employee.findOne({ userAccount: foundUserAccount._id })
      .populate({
        path: 'userAccount',
        select: 'userCode email role isActive',
        populate: {
          path: 'role',
          select: 'roleName permissions'
        }
      })

    // Check if employee exists
    if (!employee) {
      return response.status(401).json({
        success: false,
        error: {
          message: 'Invalid employee code or PIN',
          code: 'INVALID_CREDENTIALS'
        }
      })
    }

    // Check if user account is active
    if (!employee.userAccount.isActive) {
      return response.status(403).json({
        success: false,
        error: {
          message: 'Your account is inactive. Please contact administrator.',
          code: 'ACCOUNT_INACTIVE'
        }
      })
    }

    // Verify PIN using posAuthService
    try {
      const verifyResult = await posAuthService.verifyPIN(employee._id, pin)

      // Generate POS token
      const token = generatePOSToken(
        employee._id,
        employee.userAccount.userCode,
        employee.userAccount.role._id
      )

      // Return successful login
      return response.status(200).json({
        success: true,
        data: {
          token,
          employee: {
            id: employee._id,
            fullName: employee.fullName,
            userCode: employee.userAccount.userCode,
            email: employee.userAccount.email,
            phone: employee.phone || '',
            role: employee.userAccount.role.roleName,
            permissions: employee.userAccount.role.permissions,
            lastLogin: verifyResult.lastLogin
          }
        },
        message: 'Login successful'
      })
    } catch (pinError) {
      // Handle PIN verification errors
      const status = pinError.statusCode || 401
      return response.status(status).json({
        success: false,
        error: {
          message: pinError.message,
          code: pinError.code,
          attemptsRemaining: pinError.attemptsRemaining,
          minutesLeft: pinError.minutesLeft
        }
      })
    }
  } catch (error) {
    console.error('POS Login error:', error)
    return response.status(500).json({
      success: false,
      error: {
        message: 'An error occurred during login',
        code: 'SERVER_ERROR',
        details: error.message
      }
    })
  }
})

/**
 * @route   POST /api/pos-login/logout
 * @desc    Logout from POS system
 * @access  Private (POS)
 */
posLoginRouter.post('/logout', async (request, response) => {
  try {
    const authorization = request.get('authorization')

    if (!authorization || !authorization.toLowerCase().startsWith('bearer ')) {
      return response.status(401).json({
        success: false,
        error: {
          message: 'Token missing or invalid',
          code: 'MISSING_TOKEN'
        }
      })
    }

    const token = authorization.substring(7)

    // Verify token
    try {
      const decodedToken = jwt.verify(token, process.env.JWT_SECRET)

      // Check if it's a POS token
      if (!decodedToken.isPOS) {
        return response.status(403).json({
          success: false,
          error: {
            message: 'Invalid POS token',
            code: 'INVALID_TOKEN_TYPE'
          }
        })
      }

      // Successfully logged out
      return response.status(200).json({
        success: true,
        message: 'Logged out successfully'
      })
    } catch (tokenError) {
      // Token is invalid or expired - still return success (logout is idempotent)
      return response.status(200).json({
        success: true,
        message: 'Logged out successfully'
      })
    }
  } catch (error) {
    console.error('POS Logout error:', error)
    // Return success even on error (logout should always succeed)
    return response.status(200).json({
      success: true,
      message: 'Logged out successfully'
    })
  }
})

/**
 * @route   GET /api/pos-login/verify
 * @desc    Verify POS session and get current employee info
 * @access  Private (POS)
 */
posLoginRouter.get('/verify', async (request, response) => {
  try {
    const authorization = request.get('authorization')

    if (!authorization || !authorization.toLowerCase().startsWith('bearer ')) {
      return response.status(401).json({
        success: false,
        error: {
          message: 'Token missing or invalid',
          code: 'MISSING_TOKEN'
        }
      })
    }

    const token = authorization.substring(7)

    // Verify token
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET)

    // Check if it's a POS token
    if (!decodedToken.isPOS) {
      return response.status(403).json({
        success: false,
        error: {
          message: 'Invalid POS token',
          code: 'INVALID_TOKEN_TYPE'
        }
      })
    }

    // Get employee with user account
    const employee = await Employee.findById(decodedToken.id)
      .populate({
        path: 'userAccount',
        select: 'userCode email role isActive',
        populate: {
          path: 'role',
          select: 'roleName permissions'
        }
      })

    if (!employee) {
      return response.status(404).json({
        success: false,
        error: {
          message: 'Employee not found',
          code: 'EMPLOYEE_NOT_FOUND'
        }
      })
    }

    // Check if user account is still active
    if (!employee.userAccount || !employee.userAccount.isActive) {
      return response.status(403).json({
        success: false,
        error: {
          message: 'Account is inactive',
          code: 'ACCOUNT_INACTIVE'
        }
      })
    }

    // Check POS auth status
    const posAuthStatus = await posAuthService.getPOSAuthStatus(employee._id)

    if (!posAuthStatus.hasAuth || !posAuthStatus.canAccessPOS) {
      return response.status(403).json({
        success: false,
        error: {
          message: 'POS access has been revoked',
          code: 'ACCESS_REVOKED'
        }
      })
    }

    // Check if account is locked
    if (posAuthStatus.isPinLocked) {
      return response.status(423).json({
        success: false,
        error: {
          message: 'Account is temporarily locked',
          code: 'ACCOUNT_LOCKED',
          minutesLeft: posAuthStatus.minutesUntilUnlock
        }
      })
    }

    // Return employee info
    return response.status(200).json({
      success: true,
      data: {
        employee: {
          id: employee._id,
          fullName: employee.fullName,
          userCode: employee.userAccount.userCode,
          email: employee.userAccount.email,
          phone: employee.phone || '',
          role: employee.userAccount.role.roleName,
          permissions: employee.userAccount.role.permissions,
          lastLogin: posAuthStatus.posLastLogin
        }
      }
    })
  } catch (error) {
    console.error('POS Verify error:', error)

    if (error.name === 'JsonWebTokenError') {
      return response.status(401).json({
        success: false,
        error: {
          message: 'Invalid token',
          code: 'INVALID_TOKEN'
        }
      })
    }

    if (error.name === 'TokenExpiredError') {
      return response.status(401).json({
        success: false,
        error: {
          message: 'Token has expired',
          code: 'TOKEN_EXPIRED'
        }
      })
    }

    return response.status(500).json({
      success: false,
      error: {
        message: 'Failed to verify session',
        code: 'SERVER_ERROR',
        details: error.message
      }
    })
  }
})

/**
 * @route   POST /api/pos-login/customer
 * @desc    Create new customer from POS (no admin auth required)
 * @access  Private (POS)
 */
posLoginRouter.post('/customer', async (request, response) => {
  try {
    const authorization = request.get('authorization')

    if (!authorization || !authorization.toLowerCase().startsWith('bearer ')) {
      return response.status(401).json({
        success: false,
        error: {
          message: 'Token missing or invalid',
          code: 'MISSING_TOKEN'
        }
      })
    }

    const token = authorization.substring(7)

    // Verify POS token
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET)

    if (!decodedToken.isPOS) {
      return response.status(403).json({
        success: false,
        error: {
          message: 'Invalid POS token',
          code: 'INVALID_TOKEN_TYPE'
        }
      })
    }

    // Get request body
    const { fullName, email, phone, address, dateOfBirth, gender, customerType } = request.body

    // Validation: Full name is required
    if (!fullName || fullName.trim().length === 0) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Full name is required',
          code: 'MISSING_FULLNAME'
        }
      })
    }

    // Validation: Phone is required
    if (!phone || phone.trim().length === 0) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Phone number is required',
          code: 'MISSING_PHONE'
        }
      })
    }

    // Validation: Gender is required
    if (!gender || !['male', 'female', 'other'].includes(gender.toLowerCase())) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Valid gender is required (male/female/other)',
          code: 'INVALID_GENDER'
        }
      })
    }

    // Check if email already exists (if provided)
    if (email && email.trim().length > 0) {
      const existingCustomerByEmail = await Customer.findOne({
        email: email.trim().toLowerCase()
      })

      if (existingCustomerByEmail) {
        return response.status(409).json({
          success: false,
          error: {
            message: 'This email is already registered',
            code: 'DUPLICATE_EMAIL'
          }
        })
      }
    }

    // Generate customer code
    const lastCustomer = await Customer.findOne()
      .sort({ createdAt: -1 })
      .select('customerCode')
      .lean()

    let newCustomerCode = 'CUST0000000001'
    if (lastCustomer && lastCustomer.customerCode) {
      const lastCodeNum = parseInt(lastCustomer.customerCode.replace('CUST', ''))
      newCustomerCode = 'CUST' + String(lastCodeNum + 1).padStart(10, '0')
    }

    // Create customer
    const newCustomer = new Customer({
      customerCode: newCustomerCode,
      fullName: fullName.trim(),
      email: email ? email.trim().toLowerCase() : undefined,
      phone: phone.trim().replace(/[\s\-()]/g, ''),
      address: address ? address.trim() : undefined,
      dateOfBirth: dateOfBirth || undefined,
      gender: gender.toLowerCase(),
      customerType: customerType ? customerType.toLowerCase() : 'retail',
      totalSpent: 0,
      isActive: true
    })

    await newCustomer.save()

    // Return created customer
    return response.status(201).json({
      success: true,
      data: {
        customer: {
          id: newCustomer._id,
          customerCode: newCustomer.customerCode,
          fullName: newCustomer.fullName,
          email: newCustomer.email,
          phone: newCustomer.phone,
          address: newCustomer.address,
          dateOfBirth: newCustomer.dateOfBirth,
          gender: newCustomer.gender,
          customerType: newCustomer.customerType,
          totalSpent: newCustomer.totalSpent,
          isActive: newCustomer.isActive,
          createdAt: newCustomer.createdAt
        }
      },
      message: 'Customer created successfully'
    })
  } catch (error) {
    console.error('POS Create Customer error:', error)

    if (error.name === 'JsonWebTokenError') {
      return response.status(401).json({
        success: false,
        error: {
          message: 'Invalid token',
          code: 'INVALID_TOKEN'
        }
      })
    }

    if (error.name === 'TokenExpiredError') {
      return response.status(401).json({
        success: false,
        error: {
          message: 'Token has expired',
          code: 'TOKEN_EXPIRED'
        }
      })
    }

    if (error.name === 'ValidationError') {
      return response.status(400).json({
        success: false,
        error: {
          message: error.message,
          code: 'VALIDATION_ERROR'
        }
      })
    }

    return response.status(500).json({
      success: false,
      error: {
        message: 'Failed to create customer',
        code: 'SERVER_ERROR',
        details: error.message
      }
    })
  }
})

/**
 * @route   POST /api/pos-login/order
 * @desc    Create new draft order from POS (no admin auth required)
 *          Uses same FEFO logic as /api/orders endpoint
 * @access  Private (POS)
 */
posLoginRouter.post('/order', async (request, response) => {
  try {
    const authorization = request.get('authorization')

    if (!authorization || !authorization.toLowerCase().startsWith('bearer ')) {
      return response.status(401).json({
        success: false,
        error: {
          message: 'Token missing or invalid',
          code: 'MISSING_TOKEN'
        }
      })
    }

    const token = authorization.substring(7)

    // Verify POS token
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET)

    if (!decodedToken.isPOS) {
      return response.status(403).json({
        success: false,
        error: {
          message: 'Invalid POS token',
          code: 'INVALID_TOKEN_TYPE'
        }
      })
    }

    // Get employee ID from token
    const employeeId = decodedToken.id

    // Verify employee exists
    const employee = await Employee.findById(employeeId)
    if (!employee) {
      return response.status(404).json({
        success: false,
        error: {
          message: 'Employee not found',
          code: 'EMPLOYEE_NOT_FOUND'
        }
      })
    }

    // Get request body and add createdBy from token
    const orderData = {
      ...request.body,
      createdBy: employeeId
    }

    console.log('📝 POS Order Request:', {
      customer: orderData.customer,
      items: orderData.items?.length,
      createdBy: employeeId
    })

    // Use the Order model's create logic (same as /api/orders endpoint)
    const ordersRouter = require('./orders')

    // Create a mock request with order data
    const mockReq = {
      body: orderData
    }

    // Create a response handler
    let orderResult = null
    let orderError = null

    const mockRes = {
      status: function (code) {
        this.statusCode = code
        return this
      },
      json: function (data) {
        if (this.statusCode >= 400) {
          orderError = data
        } else {
          orderResult = data
        }
        return this
      },
      statusCode: 200
    }

    // Import and use order creation logic
    const Order = require('../models/order')
    const OrderDetail = require('../models/orderDetail')
    const Product = require('../models/product')
    const ProductBatch = require('../models/productBatch')
    const { allocateQuantityFEFO } = require('../utils/batchHelpers')
    const mongoose = require('mongoose')

    const { customer, items, deliveryType = 'pickup', shippingFee = 0, status = 'draft', paymentStatus = 'pending' } = orderData

    // Validate items
    if (!items || !Array.isArray(items) || items.length === 0) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Order must have at least one item',
          code: 'MISSING_ITEMS'
        }
      })
    }

    // Handle customer (virtual-guest or real customer)
    let customerId = customer
    let customerDoc = null

    if (!customer || customer === 'virtual-guest') {
      // Find or create virtual guest customer
      // Use email to identify virtual guest (customerCode is auto-generated)
      customerDoc = await Customer.findOne({
        email: 'virtual.guest@pos.system',
        customerType: 'guest'
      })

      if (!customerDoc) {
        customerDoc = new Customer({
          // Don't set customerCode - let pre-save hook auto-generate it
          fullName: 'Virtual Guest',
          email: 'virtual.guest@pos.system',
          phone: '0000000000',
          gender: 'other',
          customerType: 'guest',
          totalSpent: 0,
          isActive: true
        })
        await customerDoc.save()
        console.log('✅ Created virtual guest customer:', customerDoc.customerCode)
      }

      customerId = customerDoc._id
    } else {
      customerDoc = await Customer.findById(customer)
      if (!customerDoc) {
        return response.status(404).json({
          success: false,
          error: {
            message: 'Customer not found',
            code: 'CUSTOMER_NOT_FOUND'
          }
        })
      }
    }

    // Auto-calculate discount percentage
    const discountPercentageMap = {
      'guest': 0,
      'retail': 10,
      'wholesale': 15,
      'vip': 20
    }
    const autoDiscountPercentage = discountPercentageMap[customerDoc.customerType?.toLowerCase()] || 0

    // Validate items and process with FEFO or manual batch selection
    const processedItems = []
    for (const item of items) {
      if (!item.product || !item.quantity || item.quantity <= 0) {
        return response.status(400).json({
          success: false,
          error: {
            message: 'Each item must have valid product and quantity',
            code: 'INVALID_ITEM'
          }
        })
      }

      const product = await Product.findById(item.product).populate('category')
      if (!product) {
        return response.status(404).json({
          success: false,
          error: {
            message: `Product not found: ${item.product}`,
            code: 'PRODUCT_NOT_FOUND'
          }
        })
      }

      console.log(`\n🔍 Processing: ${product.name} (${product.productCode})`)
      console.log(`   Quantity: ${item.quantity}`)
      console.log(`   Has manual batch: ${!!item.batch}`)
      console.log(`   Unit price: ${item.unitPrice}`)

      // Check if batch is manually provided (for POS fresh products)
      if (item.batch) {
        console.log(`🌿 Fresh product: Using manually selected batch`)

        // Validate batch exists
        const batch = await ProductBatch.findById(item.batch)
        if (!batch) {
          return response.status(404).json({
            success: false,
            error: {
              message: `Batch not found: ${item.batch}`,
              code: 'BATCH_NOT_FOUND'
            }
          })
        }

        console.log(`   Selected batch: ${batch.batchCode}`)

        // Get DetailInventory for this batch
        const DetailInventory = require('../models/detailInventory')
        const detailInventory = await DetailInventory.findOne({ batchId: item.batch })

        if (!detailInventory) {
          return response.status(404).json({
            success: false,
            error: {
              message: `Inventory not found for batch: ${batch.batchCode}`,
              code: 'BATCH_INVENTORY_NOT_FOUND'
            }
          })
        }

        console.log(`   Available on shelf: ${detailInventory.quantityOnShelf}`)

        if (detailInventory.quantityOnShelf < item.quantity) {
          return response.status(400).json({
            success: false,
            error: {
              message: `Insufficient stock in selected batch: ${batch.batchCode}`,
              code: 'INSUFFICIENT_BATCH_STOCK',
              details: {
                batchCode: batch.batchCode,
                available: detailInventory.quantityOnShelf,
                requested: item.quantity
              }
            }
          })
        }

        // Use manually selected batch with its specific price
        const batchPrice = item.unitPrice || batch.unitPrice || product.unitPrice

        processedItems.push({
          product: item.product,
          batch: item.batch,
          quantity: item.quantity,
          unitPrice: batchPrice
        })

        console.log(`✅ Manual batch: ${batch.batchCode} (${item.quantity} units) at ${batchPrice}/unit`)
      } else {
        // Auto-allocate batches using FEFO (for regular products)
        console.log(`📦 Regular product: Using FEFO auto-allocation`)

        let batchAllocations
        try {
          batchAllocations = await allocateQuantityFEFO(item.product, item.quantity)
          console.log(`   FEFO allocated ${batchAllocations.length} batch(es)`)
        } catch (error) {
          console.error(`❌ FEFO allocation failed:`, error.message)
          return response.status(400).json({
            success: false,
            error: {
              message: error.message || `Insufficient stock for: ${product.name}`,
              code: 'INSUFFICIENT_SHELF_STOCK',
              details: {
                product: product.name,
                requestedQuantity: item.quantity
              }
            }
          })
        }

        console.log(`   Batches:`, batchAllocations.map(a =>
          `${a.batchCode} (${a.quantity})`
        ).join(', '))

        // Create order detail for each batch allocation
        for (const allocation of batchAllocations) {
          const allocationPrice = item.unitPrice || allocation.unitPrice || product.unitPrice

          processedItems.push({
            product: item.product,
            batch: allocation.batchId,
            quantity: allocation.quantity,
            unitPrice: allocationPrice
          })

          console.log(`✅ FEFO batch: ${allocation.batchCode} (${allocation.quantity} units) at ${allocationPrice}/unit`)
        }
      }
    }

    // Calculate totals
    const subtotal = processedItems.reduce((sum, item) => {
      return sum + (item.quantity * parseFloat(item.unitPrice || 0))
    }, 0)

    const discountAmount = subtotal * (autoDiscountPercentage / 100)
    const calculatedTotal = subtotal - discountAmount + (shippingFee || 0)

    console.log(`💰 Total: Subtotal=${subtotal}, Discount=${discountAmount} (${autoDiscountPercentage}%), Total=${calculatedTotal}`)

    // Start transaction
    const session = await mongoose.startSession()
    session.startTransaction()

    try {
      // Create order
      const order = new Order({
        customer: customerId,
        createdBy: employeeId,
        orderDate: new Date(),
        deliveryType: deliveryType,
        status: status,
        paymentStatus: paymentStatus,
        shippingFee: shippingFee,
        discountPercentage: autoDiscountPercentage,
        total: calculatedTotal
      })

      await order.save({ session })

      // Create order details with FEFO-selected batches
      for (const item of processedItems) {
        const orderDetail = new OrderDetail({
          order: order._id,
          product: item.product,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          batch: item.batch
        })
        await orderDetail.save({ session })
      }

      await session.commitTransaction()

      // Populate and return
      await order.populate([
        { path: 'customer', select: 'customerCode fullName phone customerType' },
        { path: 'createdBy', select: 'fullName' },
        {
          path: 'details',
          populate: [
            { path: 'product', select: 'productCode name' },
            { path: 'batch', select: 'batchCode expiryDate' }
          ]
        }
      ])

      console.log(`✅ Order created: ${order.orderNumber}`)

      return response.status(201).json({
        success: true,
        data: { order },
        message: `Order created successfully with FEFO batch allocation`
      })
    } catch (error) {
      await session.abortTransaction()
      throw error
    } finally {
      session.endSession()
    }
  } catch (error) {
    console.error('❌ POS Create Order error:', error)

    if (error.name === 'JsonWebTokenError') {
      return response.status(401).json({
        success: false,
        error: {
          message: 'Invalid token',
          code: 'INVALID_TOKEN'
        }
      })
    }

    if (error.name === 'TokenExpiredError') {
      return response.status(401).json({
        success: false,
        error: {
          message: 'Token has expired',
          code: 'TOKEN_EXPIRED'
        }
      })
    }

    if (error.name === 'ValidationError') {
      return response.status(400).json({
        success: false,
        error: {
          message: error.message,
          code: 'VALIDATION_ERROR'
        }
      })
    }

    return response.status(500).json({
      success: false,
      error: {
        message: 'Failed to create order',
        code: 'SERVER_ERROR',
        details: error.message
      }
    })
  }
})

/**
 * @route   GET /api/pos-login/orders
 * @desc    Get orders (draft/held orders) for POS
 * @access  Private (POS)
 * @query   ?status=draft - filter by status
 */
posLoginRouter.get('/orders', async (request, response) => {
  try {
    const authorization = request.get('authorization')

    if (!authorization || !authorization.toLowerCase().startsWith('bearer ')) {
      return response.status(401).json({
        success: false,
        error: {
          message: 'Token missing or invalid',
          code: 'MISSING_TOKEN'
        }
      })
    }

    const token = authorization.substring(7)

    // Verify POS token
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET)

    if (!decodedToken.isPOS) {
      return response.status(403).json({
        success: false,
        error: {
          message: 'Invalid POS token',
          code: 'INVALID_TOKEN_TYPE'
        }
      })
    }

    // Get employee ID from token
    const employeeId = decodedToken.id

    // Verify employee exists
    const employee = await Employee.findById(employeeId)
    if (!employee) {
      return response.status(404).json({
        success: false,
        error: {
          message: 'Employee not found',
          code: 'EMPLOYEE_NOT_FOUND'
        }
      })
    }

    // Get query parameters
    const { status = 'draft' } = request.query

    console.log(`📋 Fetching orders - Status: ${status}, Employee: ${employee.fullName}`)

    // Fetch orders
    const Order = require('../models/order')
    const orders = await Order.find({
      status: status,
      createdBy: employeeId // Only show orders created by this employee
    })
      .populate('customer', 'customerCode fullName phone customerType')
      .populate('createdBy', 'fullName')
      .populate({
        path: 'details',
        populate: [
          { path: 'product', select: 'productCode name image unitPrice' },
          { path: 'batch', select: 'batchCode expiryDate' }
        ]
      })
      .sort({ orderDate: -1 }) // Newest first
      .limit(50) // Limit to 50 recent orders

    console.log(`✅ Found ${orders.length} order(s)`)

    return response.status(200).json({
      success: true,
      data: {
        orders,
        count: orders.length
      }
    })
  } catch (error) {
    console.error('❌ POS Get Orders error:', error)

    if (error.name === 'JsonWebTokenError') {
      return response.status(401).json({
        success: false,
        error: {
          message: 'Invalid token',
          code: 'INVALID_TOKEN'
        }
      })
    }

    if (error.name === 'TokenExpiredError') {
      return response.status(401).json({
        success: false,
        error: {
          message: 'Token has expired',
          code: 'TOKEN_EXPIRED'
        }
      })
    }

    return response.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch orders',
        code: 'SERVER_ERROR',
        details: error.message
      }
    })
  }
})

module.exports = posLoginRouter
