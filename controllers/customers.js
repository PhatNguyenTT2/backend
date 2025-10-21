const customersRouter = require('express').Router()
const Customer = require('../models/customer')
const Order = require('../models/order')
const { userExtractor, isAdmin } = require('../utils/auth')

// GET /api/customers - Get all customers with filtering, sorting, and pagination
customersRouter.get('/', async (request, response) => {
  try {
    const {
      page = 1,
      limit = 10,
      sort = '-createdAt',
      customerType,
      isActive,
      search
    } = request.query

    // Build filter object
    const filter = {}

    if (customerType) {
      filter.customerType = customerType
    }

    if (isActive !== undefined) {
      filter.isActive = isActive === 'true'
    }

    // Search by name, email, phone, or customer code
    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { customerCode: { $regex: search, $options: 'i' } }
      ]
    }

    const pageNum = parseInt(page)
    const perPage = parseInt(limit)
    const skip = (pageNum - 1) * perPage

    const customers = await Customer
      .find(filter)
      .sort(sort)
      .limit(perPage)
      .skip(skip)

    const total = await Customer.countDocuments(filter)
    const totalPages = Math.ceil(total / perPage)

    response.json({
      success: true,
      data: {
        customers,
        pagination: {
          current_page: pageNum,
          per_page: perPage,
          total,
          total_pages: totalPages,
          has_next: pageNum < totalPages,
          has_prev: pageNum > 1
        }
      }
    })
  } catch (error) {
    response.status(500).json({ error: error.message })
  }
})

// GET /api/customers/stats - Get customer statistics
customersRouter.get('/stats', async (request, response) => {
  try {
    const totalCustomers = await Customer.countDocuments()
    const activeCustomers = await Customer.countDocuments({ isActive: true })
    const vipCustomers = await Customer.countDocuments({ customerType: 'vip' })
    const wholesaleCustomers = await Customer.countDocuments({ customerType: 'wholesale' })
    const retailCustomers = await Customer.countDocuments({ customerType: 'retail' })

    // Top customers by total spent
    const topCustomers = await Customer
      .find()
      .sort('-totalSpent')
      .limit(10)
      .select('customerCode fullName totalSpent totalPurchases')

    response.json({
      totalCustomers,
      activeCustomers,
      vipCustomers,
      wholesaleCustomers,
      retailCustomers,
      topCustomers
    })
  } catch (error) {
    response.status(500).json({ error: error.message })
  }
})

// GET /api/customers/stats/top-customers - Get top customers
customersRouter.get('/stats/top-customers', async (request, response) => {
  try {
    const { limit = 10, sortBy = 'totalSpent' } = request.query

    const sortField = sortBy === 'totalOrders' ? '-totalPurchases' : '-totalSpent'

    const topCustomers = await Customer
      .find({ isActive: true })
      .sort(sortField)
      .limit(parseInt(limit))
      .select('customerCode fullName email phone totalSpent totalPurchases customerType')

    response.json({
      topCustomers,
      sortedBy: sortBy
    })
  } catch (error) {
    response.status(500).json({ error: error.message })
  }
})

// GET /api/customers/stats/segmentation - Get customer segmentation
customersRouter.get('/stats/segmentation', async (request, response) => {
  try {
    const segmentation = await Customer.aggregate([
      {
        $group: {
          _id: '$customerType',
          count: { $sum: 1 },
          totalRevenue: { $sum: '$totalSpent' },
          averageSpent: { $avg: '$totalSpent' },
          totalOrders: { $sum: '$totalPurchases' }
        }
      },
      {
        $project: {
          customerType: '$_id',
          count: 1,
          totalRevenue: 1,
          averageSpent: { $round: ['$averageSpent', 2] },
          totalOrders: 1,
          _id: 0
        }
      }
    ])

    response.json({ segmentation })
  } catch (error) {
    response.status(500).json({ error: error.message })
  }
})

// GET /api/customers/:id - Get customer by ID
customersRouter.get('/:id', async (request, response) => {
  try {
    const customer = await Customer.findById(request.params.id)

    if (!customer) {
      return response.status(404).json({ error: 'Customer not found' })
    }

    response.json(customer)
  } catch (error) {
    response.status(500).json({ error: error.message })
  }
})

// GET /api/customers/:id/stats - Get customer statistics
customersRouter.get('/:id/stats', async (request, response) => {
  try {
    const customer = await Customer.findById(request.params.id)

    if (!customer) {
      return response.status(404).json({ error: 'Customer not found' })
    }

    // Get order stats
    const orders = await Order.find({ 'customer.customerId': request.params.id })

    const stats = {
      customerCode: customer.customerCode,
      fullName: customer.fullName,
      customerType: customer.customerType,
      totalOrders: customer.totalPurchases,
      totalSpent: customer.totalSpent,
      averageOrderValue: customer.totalPurchases > 0 ? customer.totalSpent / customer.totalPurchases : 0,
      loyaltyPoints: customer.loyaltyPoints,
      memberSince: customer.createdAt,
      lastPurchase: orders.length > 0 ? orders[0].createdAt : null,
      isActive: customer.isActive
    }

    response.json(stats)
  } catch (error) {
    response.status(500).json({ error: error.message })
  }
})

// GET /api/customers/:id/lifetime-value - Get customer lifetime value
customersRouter.get('/:id/lifetime-value', async (request, response) => {
  try {
    const customer = await Customer.findById(request.params.id)

    if (!customer) {
      return response.status(404).json({ error: 'Customer not found' })
    }

    const lifetimeValue = {
      customerCode: customer.customerCode,
      fullName: customer.fullName,
      totalSpent: customer.totalSpent,
      totalOrders: customer.totalPurchases,
      averageOrderValue: customer.totalPurchases > 0 ? customer.totalSpent / customer.totalPurchases : 0,
      customerType: customer.customerType,
      loyaltyPoints: customer.loyaltyPoints,
      estimatedValue: customer.totalSpent * 1.2 // Simple estimation
    }

    response.json(lifetimeValue)
  } catch (error) {
    response.status(500).json({ error: error.message })
  }
})

// GET /api/customers/:id/orders - Get customer orders
customersRouter.get('/:id/orders', async (request, response) => {
  try {
    const { page = 1, limit = 10, status } = request.query
    const skip = (parseInt(page) - 1) * parseInt(limit)

    const filter = { 'customer.customerId': request.params.id }
    if (status) {
      filter.status = status
    }

    const orders = await Order
      .find(filter)
      .sort('-createdAt')
      .limit(parseInt(limit))
      .skip(skip)
      .populate('items.product')

    const total = await Order.countDocuments(filter)

    response.json({
      orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    })
  } catch (error) {
    response.status(500).json({ error: error.message })
  }
})

// GET /api/customers/:id/loyalty/history - Get loyalty points history
customersRouter.get('/:id/loyalty/history', async (request, response) => {
  try {
    const customer = await Customer.findById(request.params.id)

    if (!customer) {
      return response.status(404).json({ error: 'Customer not found' })
    }

    // Simple response - in a real app, you'd track history in a separate collection
    response.json({
      customerCode: customer.customerCode,
      fullName: customer.fullName,
      currentPoints: customer.loyaltyPoints,
      message: 'Loyalty points history tracking not yet implemented'
    })
  } catch (error) {
    response.status(500).json({ error: error.message })
  }
})

// POST /api/customers - Create new customer
customersRouter.post('/', userExtractor, async (request, response) => {
  try {
    const {
      fullName,
      email,
      phone,
      address,
      dateOfBirth,
      gender,
      customerType,
      notes
    } = request.body

    // Validate required fields
    if (!fullName || !phone) {
      return response.status(400).json({
        error: 'Full name and phone are required'
      })
    }

    // Check if email already exists
    if (email) {
      const existingCustomer = await Customer.findOne({ email })
      if (existingCustomer) {
        return response.status(400).json({
          error: 'Email already exists'
        })
      }
    }

    const customer = new Customer({
      fullName,
      email,
      phone,
      address,
      dateOfBirth,
      gender,
      customerType,
      notes
    })

    const savedCustomer = await customer.save()
    response.status(201).json(savedCustomer)
  } catch (error) {
    response.status(400).json({ error: error.message })
  }
})

// PATCH /api/customers/:id/status - Update customer status
customersRouter.patch('/:id/status', userExtractor, async (request, response) => {
  try {
    const { isActive, reason } = request.body

    const customer = await Customer.findById(request.params.id)

    if (!customer) {
      return response.status(404).json({ error: 'Customer not found' })
    }

    customer.isActive = isActive
    if (reason && !isActive) {
      customer.notes = customer.notes
        ? `${customer.notes}\n[Deactivated: ${reason}]`
        : `[Deactivated: ${reason}]`
    }

    await customer.save()

    response.json({
      message: `Customer ${isActive ? 'activated' : 'deactivated'} successfully`,
      customer
    })
  } catch (error) {
    response.status(400).json({ error: error.message })
  }
})

// PUT /api/customers/:id - Update customer
customersRouter.put('/:id', userExtractor, async (request, response) => {
  try {
    const {
      fullName,
      email,
      phone,
      address,
      dateOfBirth,
      gender,
      customerType,
      notes,
      isActive
    } = request.body

    const customer = await Customer.findById(request.params.id)

    if (!customer) {
      return response.status(404).json({ error: 'Customer not found' })
    }

    // Check if email is being changed and if it already exists
    if (email && email !== customer.email) {
      const existingCustomer = await Customer.findOne({ email })
      if (existingCustomer) {
        return response.status(400).json({
          error: 'Email already exists'
        })
      }
    }

    const updatedCustomer = await Customer.findByIdAndUpdate(
      request.params.id,
      {
        fullName,
        email,
        phone,
        address,
        dateOfBirth,
        gender,
        customerType,
        notes,
        isActive
      },
      { new: true, runValidators: true }
    )

    response.json(updatedCustomer)
  } catch (error) {
    response.status(400).json({ error: error.message })
  }
})

// POST /api/customers/:id/loyalty - Add loyalty points
customersRouter.post('/:id/loyalty', userExtractor, async (request, response) => {
  try {
    const { points } = request.body

    if (!points || points <= 0) {
      return response.status(400).json({
        error: 'Points must be a positive number'
      })
    }

    const customer = await Customer.findById(request.params.id)

    if (!customer) {
      return response.status(404).json({ error: 'Customer not found' })
    }

    await customer.addLoyaltyPoints(points)

    response.json({
      message: 'Loyalty points added successfully',
      loyaltyPoints: customer.loyaltyPoints
    })
  } catch (error) {
    response.status(400).json({ error: error.message })
  }
})

// PUT /api/customers/:id/loyalty/add - Add loyalty points (alternative)
customersRouter.put('/:id/loyalty/add', userExtractor, async (request, response) => {
  try {
    const { points } = request.body

    if (!points || points <= 0) {
      return response.status(400).json({
        error: 'Points must be a positive number'
      })
    }

    const customer = await Customer.findById(request.params.id)

    if (!customer) {
      return response.status(404).json({ error: 'Customer not found' })
    }

    await customer.addLoyaltyPoints(points)

    response.json({
      message: 'Loyalty points added successfully',
      loyaltyPoints: customer.loyaltyPoints
    })
  } catch (error) {
    response.status(400).json({ error: error.message })
  }
})

// POST /api/customers/:id/loyalty/redeem - Redeem loyalty points
customersRouter.post('/:id/loyalty/redeem', userExtractor, async (request, response) => {
  try {
    const { points } = request.body

    if (!points || points <= 0) {
      return response.status(400).json({
        error: 'Points must be a positive number'
      })
    }

    const customer = await Customer.findById(request.params.id)

    if (!customer) {
      return response.status(404).json({ error: 'Customer not found' })
    }

    await customer.redeemLoyaltyPoints(points)

    response.json({
      message: 'Loyalty points redeemed successfully',
      loyaltyPoints: customer.loyaltyPoints
    })
  } catch (error) {
    response.status(400).json({ error: error.message })
  }
})

// PUT /api/customers/:id/loyalty/redeem - Redeem loyalty points (alternative)
customersRouter.put('/:id/loyalty/redeem', userExtractor, async (request, response) => {
  try {
    const { points } = request.body

    if (!points || points <= 0) {
      return response.status(400).json({
        error: 'Points must be a positive number'
      })
    }

    const customer = await Customer.findById(request.params.id)

    if (!customer) {
      return response.status(404).json({ error: 'Customer not found' })
    }

    await customer.redeemLoyaltyPoints(points)

    response.json({
      message: 'Loyalty points redeemed successfully',
      loyaltyPoints: customer.loyaltyPoints
    })
  } catch (error) {
    response.status(400).json({ error: error.message })
  }
})

// DELETE /api/customers/:id - Delete customer (only inactive customers can be deleted)
customersRouter.delete('/:id', userExtractor, isAdmin, async (request, response) => {
  try {
    const customer = await Customer.findById(request.params.id)

    if (!customer) {
      return response.status(404).json({ error: 'Customer not found' })
    }

    // Only allow deletion of inactive customers
    if (customer.isActive) {
      return response.status(400).json({
        error: 'Cannot delete active customer. Please deactivate the customer first.'
      })
    }

    // Delete the customer
    await Customer.findByIdAndDelete(request.params.id)
    response.json({ message: 'Customer deleted successfully' })
  } catch (error) {
    response.status(500).json({ error: error.message })
  }
})

module.exports = customersRouter
