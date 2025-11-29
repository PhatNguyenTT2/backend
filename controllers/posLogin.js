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
 * Helper function: Create order with FEFO logic
 * Used by both /order and /order-with-payment endpoints
 */
async function createPOSOrder(orderData, employeeId, session = null) {
  const Order = require('../models/order')
  const OrderDetail = require('../models/orderDetail')
  const Product = require('../models/product')
  const ProductBatch = require('../models/productBatch')
  const { allocateQuantityFEFO } = require('../utils/batchHelpers')

  const { customer, items, deliveryType = 'pickup', shippingFee = 0, status = 'draft', paymentStatus = 'pending' } = orderData

  // POS orders should always start as draft
  const orderStatus = 'draft'
  const orderPaymentStatus = 'pending'

  // Validate items
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new Error('Order must have at least one item')
  }

  // Handle customer (virtual-guest or real customer)
  let customerId = customer
  let customerDoc = null

  if (!customer || customer === 'virtual-guest') {
    customerDoc = await Customer.findOne({
      email: 'virtual.guest@pos.system',
      customerType: 'guest'
    })

    if (!customerDoc) {
      customerDoc = new Customer({
        fullName: 'Virtual Guest',
        email: 'virtual.guest@pos.system',
        phone: '0000000000',
        gender: 'other',
        customerType: 'guest',
        totalSpent: 0,
        isActive: true
      })
      if (session) {
        await customerDoc.save({ session })
      } else {
        await customerDoc.save()
      }
      console.log('✅ Created virtual guest customer:', customerDoc.customerCode)
    }

    customerId = customerDoc._id
  } else {
    customerDoc = await Customer.findById(customer)
    if (!customerDoc) {
      throw new Error('Customer not found')
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
      throw new Error('Each item must have valid product and quantity')
    }

    const product = await Product.findById(item.product).populate('category')
    if (!product) {
      throw new Error(`Product not found: ${item.product}`)
    }

    console.log(`\n🔍 Processing: ${product.name} (${product.productCode})`)
    console.log(`   Quantity: ${item.quantity}`)
    console.log(`   Has manual batch: ${!!item.batch}`)
    console.log(`   Unit price: ${item.unitPrice}`)

    // Check if batch is manually provided (for POS fresh products)
    if (item.batch) {
      console.log(`🌿 Fresh product: Using manually selected batch`)

      const batch = await ProductBatch.findById(item.batch)
      if (!batch) {
        throw new Error(`Batch not found: ${item.batch}`)
      }

      console.log(`   Selected batch: ${batch.batchCode}`)

      const DetailInventory = require('../models/detailInventory')
      const detailInventory = await DetailInventory.findOne({ batchId: item.batch })

      if (!detailInventory) {
        throw new Error(`Inventory not found for batch: ${batch.batchCode}`)
      }

      console.log(`   Available on shelf: ${detailInventory.quantityOnShelf}`)

      if (detailInventory.quantityOnShelf < item.quantity) {
        throw new Error(`Insufficient stock in batch ${batch.batchCode}: available=${detailInventory.quantityOnShelf}, requested=${item.quantity}`)
      }

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
        throw new Error(error.message || `Insufficient stock for: ${product.name}`)
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

  // Create order (always draft for POS)
  const order = new Order({
    customer: customerId,
    createdBy: employeeId,
    orderDate: new Date(),
    deliveryType: deliveryType,
    status: orderStatus,
    paymentStatus: orderPaymentStatus,
    shippingFee: shippingFee,
    discountPercentage: autoDiscountPercentage,
    total: calculatedTotal
  })

  if (session) {
    await order.save({ session })
  } else {
    await order.save()
  }

  // Create order details
  for (const item of processedItems) {
    const orderDetail = new OrderDetail({
      order: order._id,
      product: item.product,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      batch: item.batch
    })
    if (session) {
      await orderDetail.save({ session })
    } else {
      await orderDetail.save()
    }
  }

  // ⭐ SOLUTION 1A: Store original status explicitly for middleware
  // This ensures middleware can access it even in transaction context
  order._originalStatus = 'draft' // Explicitly set to 'draft' since we just created it

  // Populate and return
  await order.populate([
    { path: 'customer', select: 'customerCode fullName phone customerType' },
    { path: 'createdBy', select: 'fullName' },
    {
      path: 'details',
      populate: [
        {
          path: 'product',
          select: 'productCode name image unitPrice',
          populate: { path: 'category', select: 'name' }
        },
        { path: 'batch', select: 'batchCode expiryDate unitPrice discountPercentage' }
      ]
    }
  ])

  console.log(`✅ Order created: ${order.orderNumber} (status: ${order.status})\n`)

  return order
}

/**
 * @route   POST /api/pos-login/order
 * @desc    Create new draft order from POS (no admin auth required)
 *          Uses same FEFO logic as /api/orders endpoint
 * @access  Private (POS)
 */
posLoginRouter.post('/order', async (request, response) => {
  const mongoose = require('mongoose')
  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    const authorization = request.get('authorization')

    if (!authorization || !authorization.toLowerCase().startsWith('bearer ')) {
      await session.abortTransaction()
      return response.status(401).json({
        success: false,
        error: {
          message: 'Token missing or invalid',
          code: 'MISSING_TOKEN'
        }
      })
    }

    const token = authorization.substring(7)
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET)

    if (!decodedToken.isPOS) {
      await session.abortTransaction()
      return response.status(403).json({
        success: false,
        error: {
          message: 'Invalid POS token',
          code: 'INVALID_TOKEN_TYPE'
        }
      })
    }

    const employeeId = decodedToken.id
    const employee = await Employee.findById(employeeId)
    if (!employee) {
      await session.abortTransaction()
      return response.status(404).json({
        success: false,
        error: {
          message: 'Employee not found',
          code: 'EMPLOYEE_NOT_FOUND'
        }
      })
    }

    const orderData = {
      ...request.body,
      createdBy: employeeId
    }

    console.log('📝 POS Order Request:', {
      customer: orderData.customer,
      items: orderData.items?.length,
      createdBy: employeeId
    })

    // ✅ Use shared helper function
    const order = await createPOSOrder(orderData, employeeId, session)

    await session.commitTransaction()

    console.log(`✅ Order created: ${order.orderNumber}`)

    return response.status(201).json({
      success: true,
      data: { order },
      message: `Order created successfully with FEFO batch allocation`
    })

  } catch (error) {
    await session.abortTransaction()
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
  } finally {
    session.endSession()
  }
})

/**
 * @route   POST /api/pos-login/order-with-payment
 * @desc    Create order and payment in single atomic transaction (POS only)
 * @access  Private (POS)
 * @body    {
 *            customer: ObjectId | 'virtual-guest',
 *            items: [{ product, batch?, quantity, unitPrice }],
 *            deliveryType: 'pickup',
 *            paymentMethod: 'cash' | 'card' | 'bank_transfer',
 *            notes?: string
 *          }
 */
posLoginRouter.post('/order-with-payment', async (request, response) => {
  const mongoose = require('mongoose')
  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    const authorization = request.get('authorization')
    if (!authorization || !authorization.toLowerCase().startsWith('bearer ')) {
      await session.abortTransaction()
      return response.status(401).json({
        success: false,
        error: { message: 'Token missing or invalid', code: 'MISSING_TOKEN' }
      })
    }

    const token = authorization.substring(7)
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET)

    if (!decodedToken.isPOS) {
      await session.abortTransaction()
      return response.status(403).json({
        success: false,
        error: { message: 'Invalid POS token', code: 'INVALID_TOKEN_TYPE' }
      })
    }

    const employeeId = decodedToken.id
    const employee = await Employee.findById(employeeId)
    if (!employee) {
      await session.abortTransaction()
      return response.status(404).json({
        success: false,
        error: { message: 'Employee not found', code: 'EMPLOYEE_NOT_FOUND' }
      })
    }

    const { customer, items, deliveryType = 'pickup', paymentMethod, notes } = request.body

    // Validate payment method
    if (!paymentMethod || !['cash', 'card', 'bank_transfer'].includes(paymentMethod)) {
      await session.abortTransaction()
      return response.status(400).json({
        success: false,
        error: {
          message: 'Valid payment method is required (cash/card/bank_transfer)',
          code: 'INVALID_PAYMENT_METHOD'
        }
      })
    }

    console.log('\n========== POS ORDER + PAYMENT REQUEST ==========')
    console.log('📝 Request Details:', {
      customer: customer === 'virtual-guest' ? 'virtual-guest' : customer,
      itemCount: items?.length,
      paymentMethod,
      deliveryType,
      createdBy: employeeId
    })
    console.log('Items:', items?.map(i => ({
      product: i.product,
      quantity: i.quantity,
      batch: i.batch || 'auto-FEFO'
    })))
    console.log('================================================\n')

    // ====== STEP 1: Create Order using shared helper ======
    console.log('📦 STEP 1: Creating order (draft)...')
    const orderData = {
      customer,
      items,
      deliveryType,
      shippingFee: 0,
      status: 'draft', // ✅ POS order starts as draft (will be delivered after payment)
      paymentStatus: 'pending' // Will be updated after payment
    }

    const order = await createPOSOrder(orderData, employeeId, session)
    console.log(`✅ Order created: ${order.orderNumber} (status: ${order.status})\n`)

    // ====== STEP 2: Create Payment (status: 'completed') ======
    console.log('💳 STEP 2: Creating payment...')
    const Payment = require('../models/payment')

    const payment = new Payment({
      referenceType: 'Order',
      referenceId: order._id,
      amount: order.total,
      paymentMethod: paymentMethod,
      paymentDate: new Date(),
      status: 'completed', // ✅ POS payment is completed immediately
      createdBy: employeeId,
      notes: notes || `POS Payment - ${order.orderNumber}`
    })

    await payment.save({ session })
    console.log(`✅ Payment created: ${payment.paymentNumber} (${paymentMethod})\n`)

    // ====== STEP 3: Update Order to delivered (POS direct sale) ======
    console.log('🔄 STEP 3: Updating order status to delivered...')

    // ⭐ SOLUTION 1B: Re-fetch order as CLEAN document (no population)
    // This ensures Mongoose can properly track status changes
    const Order = require('../models/order')
    const orderToUpdate = await Order.findById(order._id).session(session)

    if (!orderToUpdate) {
      throw new Error('Order not found after creation')
    }

    // ⭐ SOLUTION 1C: Set _originalStatus BEFORE changing status
    // This is CRITICAL for middleware to detect status change
    orderToUpdate._originalStatus = 'draft' // Must be 'draft' since we just created it
    orderToUpdate.status = 'delivered' // POS: draft → delivered (direct sale)
    orderToUpdate.paymentStatus = 'paid'

    // ⭐ SOLUTION 1D: Force Mongoose to track status change
    orderToUpdate.markModified('status')

    // ⭐ SOLUTION 1E: Add debug logging
    console.log('\n========== ORDER STATUS UPDATE ==========')
    console.log(`Order ID: ${orderToUpdate._id}`)
    console.log(`Order Number: ${orderToUpdate.orderNumber}`)
    console.log(`_originalStatus: ${orderToUpdate._originalStatus}`)
    console.log(`New status: ${orderToUpdate.status}`)
    console.log(`Payment status: ${orderToUpdate.paymentStatus}`)
    console.log(`isModified('status'): ${orderToUpdate.isModified('status')}`)
    console.log(`isNew: ${orderToUpdate.isNew}`)
    console.log('=========================================\n')

    console.log('💾 Saving order (this will trigger pre-save middleware)...')
    await orderToUpdate.save({ session })
    console.log('✅ Order saved successfully\n')

    // Commit transaction
    console.log('✅ Committing transaction...')
    await session.commitTransaction()
    console.log('✅ Transaction committed successfully\n')

    // Populate orderToUpdate with full details for response
    await orderToUpdate.populate([
      { path: 'customer', select: 'customerCode fullName phone customerType' },
      { path: 'createdBy', select: 'fullName' },
      {
        path: 'details',
        populate: [
          {
            path: 'product',
            select: 'productCode name image unitPrice',
            populate: { path: 'category', select: 'name' }
          },
          { path: 'batch', select: 'batchCode expiryDate unitPrice discountPercentage' }
        ]
      }
    ])

    // Populate payment
    await payment.populate('createdBy', 'fullName')

    console.log('\n========== POS ORDER + PAYMENT COMPLETED ==========')
    console.log(`✅ Order: ${orderToUpdate.orderNumber}`)
    console.log(`   Status: ${orderToUpdate.status}`)
    console.log(`   Payment Status: ${orderToUpdate.paymentStatus}`)
    console.log(`   Total: ${orderToUpdate.total}`)
    console.log(`✅ Payment: ${payment.paymentNumber}`)
    console.log(`   Method: ${payment.paymentMethod}`)
    console.log(`   Amount: ${payment.amount}`)
    console.log(`   Status: ${payment.status}`)
    console.log('===================================================\n')

    return response.status(201).json({
      success: true,
      data: {
        order: orderToUpdate, // ✅ Return updated order, not the old one
        payment: payment
      },
      message: 'Order and payment created successfully'
    })

  } catch (error) {
    await session.abortTransaction()
    console.error('\n========== POS ORDER+PAYMENT ERROR ==========')
    console.error('❌ Error:', error.message)
    console.error('❌ Stack:', error.stack)
    console.error('=============================================\n')

    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return response.status(401).json({
        success: false,
        error: { message: 'Invalid or expired token', code: 'INVALID_TOKEN' }
      })
    }

    return response.status(500).json({
      success: false,
      error: {
        message: 'Failed to create order and payment',
        code: 'SERVER_ERROR',
        details: error.message
      }
    })
  } finally {
    session.endSession()
  }
})/**
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

    // Fetch orders WITHOUT populate details (will fetch separately like Admin)
    const Order = require('../models/order')
    const orders = await Order.find({
      status: status,
      createdBy: employeeId // Only show orders created by this employee
    })
      .populate('customer', 'customerCode fullName phone customerType')
      .populate('createdBy', 'fullName')
      .sort({ orderDate: -1 }) // Newest first
      .limit(50) // Limit to 50 recent orders
      .lean() // Convert to plain JS objects for better performance

    console.log(`✅ Found ${orders.length} order(s)`)

    // Fetch order details separately for each order (like Admin InvoiceModal)
    const OrderDetail = require('../models/orderDetail')

    // Helper to parse Decimal128 to number
    const parseDecimal = (value) => {
      if (!value) return 0
      if (typeof value === 'object' && value.$numberDecimal) {
        return parseFloat(value.$numberDecimal)
      }
      if (typeof value === 'object' && value.toString) {
        return parseFloat(value.toString())
      }
      return parseFloat(value) || 0
    }

    const ordersWithDetails = await Promise.all(
      orders.map(async (order) => {
        const details = await OrderDetail.find({ order: order._id })
          .populate('product', 'productCode name image unitPrice discountPercentage')
          .populate('batch', 'batchCode expiryDate unitPrice discountPercentage')
          .lean()

        // Parse Decimal128 fields to numbers
        return {
          ...order,
          total: parseDecimal(order.total),
          shippingFee: parseDecimal(order.shippingFee),
          discountPercentage: order.discountPercentage || 0,
          details // Add details array to order
        }
      })
    )

    console.log(`✅ Loaded details for ${ordersWithDetails.length} order(s)`)

    return response.status(200).json({
      success: true,
      data: {
        orders: ordersWithDetails,
        count: ordersWithDetails.length
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
