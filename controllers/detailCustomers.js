const detailCustomersRouter = require('express').Router()
const DetailCustomer = require('../models/detailCustomer')
const Customer = require('../models/customer')
const { userExtractor, isAdmin } = require('../utils/auth')

// GET /api/detail-customers - Get all detail customers
detailCustomersRouter.get('/', userExtractor, isAdmin, async (request, response) => {
  try {
    const { customer_type, min_spending, max_spending } = request.query

    // Build filter
    const filter = {}
    if (customer_type) {
      filter.customerType = customer_type.toLowerCase()
    }
    if (min_spending) {
      filter.totalSpent = { $gte: parseFloat(min_spending) }
    }
    if (max_spending) {
      filter.totalSpent = { ...filter.totalSpent, $lte: parseFloat(max_spending) }
    }

    const detailCustomers = await DetailCustomer.find(filter)
      .populate('customer', 'customerCode fullName email phone isActive')
      .sort({ totalSpent: -1 })

    const detailCustomersData = detailCustomers.map(detail => ({
      id: detail._id,
      customer: detail.customer ? {
        id: detail.customer._id,
        customerCode: detail.customer.customerCode,
        fullName: detail.customer.fullName,
        email: detail.customer.email,
        phone: detail.customer.phone,
        isActive: detail.customer.isActive
      } : null,
      customerType: detail.customerType,
      totalSpent: detail.totalSpent,
      notes: detail.notes,
      createdAt: detail.createdAt,
      updatedAt: detail.updatedAt
    }))

    response.status(200).json({
      success: true,
      data: {
        detailCustomers: detailCustomersData
      }
    })
  } catch (error) {
    response.status(500).json({
      error: 'Failed to fetch detail customers'
    })
  }
})

// GET /api/detail-customers/stats/overview - Get overall statistics (Admin only)
detailCustomersRouter.get('/stats/overview', userExtractor, isAdmin, async (request, response) => {
  try {
    const stats = await DetailCustomer.getOverallStatistics()

    response.status(200).json({
      success: true,
      data: {
        statistics: stats
      }
    })
  } catch (error) {
    response.status(500).json({
      error: 'Failed to fetch statistics'
    })
  }
})

// GET /api/detail-customers/stats/by-type - Get statistics by customer type (Admin only)
detailCustomersRouter.get('/stats/by-type', userExtractor, isAdmin, async (request, response) => {
  try {
    const stats = await DetailCustomer.getStatisticsByType()

    response.status(200).json({
      success: true,
      data: {
        statistics: stats
      }
    })
  } catch (error) {
    response.status(500).json({
      error: 'Failed to fetch statistics by type'
    })
  }
})

// GET /api/detail-customers/high-value - Get high-value customers (Admin only)
detailCustomersRouter.get('/high-value', userExtractor, isAdmin, async (request, response) => {
  try {
    const { min_spending } = request.query
    const minSpending = min_spending ? parseFloat(min_spending) : 10000000

    const highValueCustomers = await DetailCustomer.getHighValueCustomers(minSpending)

    const customersData = highValueCustomers.map(detail => ({
      id: detail._id,
      customer: detail.customer ? {
        id: detail.customer._id,
        customerCode: detail.customer.customerCode,
        fullName: detail.customer.fullName,
        email: detail.customer.email,
        phone: detail.customer.phone
      } : null,
      customerType: detail.customerType,
      totalSpent: detail.totalSpent,
      notes: detail.notes
    }))

    response.status(200).json({
      success: true,
      data: {
        highValueCustomers: customersData
      }
    })
  } catch (error) {
    response.status(500).json({
      error: 'Failed to fetch high-value customers'
    })
  }
})

// GET /api/detail-customers/low-spending - Get low-spending customers (Admin only)
detailCustomersRouter.get('/low-spending', userExtractor, isAdmin, async (request, response) => {
  try {
    const { max_spending } = request.query
    const maxSpending = max_spending ? parseFloat(max_spending) : 1000000

    const lowSpendingCustomers = await DetailCustomer.getLowSpendingCustomers(maxSpending)

    const customersData = lowSpendingCustomers.map(detail => ({
      id: detail._id,
      customer: detail.customer ? {
        id: detail.customer._id,
        customerCode: detail.customer.customerCode,
        fullName: detail.customer.fullName,
        email: detail.customer.email,
        phone: detail.customer.phone
      } : null,
      customerType: detail.customerType,
      totalSpent: detail.totalSpent,
      notes: detail.notes
    }))

    response.status(200).json({
      success: true,
      data: {
        lowSpendingCustomers: customersData
      }
    })
  } catch (error) {
    response.status(500).json({
      error: 'Failed to fetch low-spending customers'
    })
  }
})

// GET /api/detail-customers/type/:type - Get customers by type
detailCustomersRouter.get('/type/:type', userExtractor, isAdmin, async (request, response) => {
  try {
    const customerType = request.params.type.toLowerCase()
    const validTypes = ['guest', 'retail', 'wholesale', 'vip']

    if (!validTypes.includes(customerType)) {
      return response.status(400).json({
        error: 'Invalid customer type. Valid types are: guest, retail, wholesale, vip'
      })
    }

    const detailCustomers = await DetailCustomer.findByType(customerType)

    const customersData = detailCustomers.map(detail => ({
      id: detail._id,
      customer: detail.customer ? {
        id: detail.customer._id,
        customerCode: detail.customer.customerCode,
        fullName: detail.customer.fullName,
        email: detail.customer.email,
        phone: detail.customer.phone,
        isActive: detail.customer.isActive
      } : null,
      customerType: detail.customerType,
      totalSpent: detail.totalSpent,
      notes: detail.notes,
      createdAt: detail.createdAt,
      updatedAt: detail.updatedAt
    }))

    response.status(200).json({
      success: true,
      data: {
        detailCustomers: customersData
      }
    })
  } catch (error) {
    response.status(500).json({
      error: 'Failed to fetch customers by type'
    })
  }
})

// GET /api/detail-customers/customer/:customerId - Get detail by customer ID
detailCustomersRouter.get('/customer/:customerId', userExtractor, isAdmin, async (request, response) => {
  try {
    const detailCustomer = await DetailCustomer.findOne({
      customer: request.params.customerId
    }).populate('customer', 'customerCode fullName email phone address gender dateOfBirth isActive')

    if (!detailCustomer) {
      return response.status(404).json({
        error: 'Customer details not found'
      })
    }

    response.status(200).json({
      success: true,
      data: {
        detailCustomer: {
          id: detailCustomer._id,
          customer: detailCustomer.customer ? {
            id: detailCustomer.customer._id,
            customerCode: detailCustomer.customer.customerCode,
            fullName: detailCustomer.customer.fullName,
            email: detailCustomer.customer.email,
            phone: detailCustomer.customer.phone,
            address: detailCustomer.customer.address,
            gender: detailCustomer.customer.gender,
            dateOfBirth: detailCustomer.customer.dateOfBirth,
            isActive: detailCustomer.customer.isActive
          } : null,
          customerType: detailCustomer.customerType,
          totalSpent: detailCustomer.totalSpent,
          notes: detailCustomer.notes,
          createdAt: detailCustomer.createdAt,
          updatedAt: detailCustomer.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid customer ID'
      })
    }
    response.status(500).json({
      error: 'Failed to fetch customer details'
    })
  }
})

// GET /api/detail-customers/:id - Get single detail customer
detailCustomersRouter.get('/:id', userExtractor, isAdmin, async (request, response) => {
  try {
    const detailCustomer = await DetailCustomer.findById(request.params.id)
      .populate('customer', 'customerCode fullName email phone address gender dateOfBirth isActive')

    if (!detailCustomer) {
      return response.status(404).json({
        error: 'Customer details not found'
      })
    }

    response.status(200).json({
      success: true,
      data: {
        detailCustomer: {
          id: detailCustomer._id,
          customer: detailCustomer.customer ? {
            id: detailCustomer.customer._id,
            customerCode: detailCustomer.customer.customerCode,
            fullName: detailCustomer.customer.fullName,
            email: detailCustomer.customer.email,
            phone: detailCustomer.customer.phone,
            address: detailCustomer.customer.address,
            gender: detailCustomer.customer.gender,
            dateOfBirth: detailCustomer.customer.dateOfBirth,
            isActive: detailCustomer.customer.isActive
          } : null,
          customerType: detailCustomer.customerType,
          totalSpent: detailCustomer.totalSpent,
          notes: detailCustomer.notes,
          createdAt: detailCustomer.createdAt,
          updatedAt: detailCustomer.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid detail customer ID'
      })
    }
    response.status(500).json({
      error: 'Failed to fetch customer details'
    })
  }
})

// POST /api/detail-customers - Create new detail customer (Admin only)
detailCustomersRouter.post('/', userExtractor, isAdmin, async (request, response) => {
  const { customerId, customerType, totalSpent, notes } = request.body

  if (!customerId) {
    return response.status(400).json({
      error: 'Customer ID is required'
    })
  }

  try {
    // Verify customer exists
    const customer = await Customer.findById(customerId)
    if (!customer) {
      return response.status(400).json({
        error: 'Customer not found'
      })
    }

    // Check if detail already exists
    const existingDetail = await DetailCustomer.findOne({ customer: customerId })
    if (existingDetail) {
      return response.status(400).json({
        error: 'Customer details already exist'
      })
    }

    const detailCustomer = new DetailCustomer({
      customer: customerId,
      customerType: customerType || 'retail',
      totalSpent: totalSpent || 0,
      notes
    })

    const savedDetail = await detailCustomer.save()
    await savedDetail.populate('customer', 'customerCode fullName email phone')

    response.status(201).json({
      success: true,
      message: 'Customer details created successfully',
      data: {
        detailCustomer: {
          id: savedDetail._id,
          customer: savedDetail.customer ? {
            id: savedDetail.customer._id,
            customerCode: savedDetail.customer.customerCode,
            fullName: savedDetail.customer.fullName,
            email: savedDetail.customer.email,
            phone: savedDetail.customer.phone
          } : null,
          customerType: savedDetail.customerType,
          totalSpent: savedDetail.totalSpent,
          notes: savedDetail.notes,
          createdAt: savedDetail.createdAt
        }
      }
    })
  } catch (error) {
    if (error.name === 'ValidationError') {
      return response.status(400).json({
        error: error.message
      })
    }
    if (error.code === 11000) {
      return response.status(400).json({
        error: 'Customer details already exist'
      })
    }
    response.status(500).json({
      error: 'Failed to create customer details'
    })
  }
})

// PUT /api/detail-customers/:id - Update detail customer (Admin only)
detailCustomersRouter.put('/:id', userExtractor, isAdmin, async (request, response) => {
  const { customerType, notes } = request.body

  try {
    const detailCustomer = await DetailCustomer.findById(request.params.id)

    if (!detailCustomer) {
      return response.status(404).json({
        error: 'Customer details not found'
      })
    }

    // Update customer type if provided
    if (customerType) {
      await detailCustomer.updateCustomerType(customerType)
    }

    // Update notes if provided
    if (notes !== undefined) {
      await detailCustomer.updateNotes(notes)
    }

    await detailCustomer.populate('customer', 'customerCode fullName email phone')

    response.status(200).json({
      success: true,
      message: 'Customer details updated successfully',
      data: {
        detailCustomer: {
          id: detailCustomer._id,
          customer: detailCustomer.customer ? {
            id: detailCustomer.customer._id,
            customerCode: detailCustomer.customer.customerCode,
            fullName: detailCustomer.customer.fullName,
            email: detailCustomer.customer.email,
            phone: detailCustomer.customer.phone
          } : null,
          customerType: detailCustomer.customerType,
          totalSpent: detailCustomer.totalSpent,
          notes: detailCustomer.notes,
          updatedAt: detailCustomer.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.name === 'ValidationError' || error.message === 'Invalid customer type') {
      return response.status(400).json({
        error: error.message
      })
    }
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid detail customer ID'
      })
    }
    response.status(500).json({
      error: 'Failed to update customer details'
    })
  }
})

// PATCH /api/detail-customers/:id/add-spending - Add spending (Admin only)
detailCustomersRouter.patch('/:id/add-spending', userExtractor, isAdmin, async (request, response) => {
  const { amount } = request.body

  if (!amount || amount <= 0) {
    return response.status(400).json({
      error: 'Amount must be greater than 0'
    })
  }

  try {
    const detailCustomer = await DetailCustomer.findById(request.params.id)

    if (!detailCustomer) {
      return response.status(404).json({
        error: 'Customer details not found'
      })
    }

    // Use the addSpending method from the model (includes auto-upgrade)
    await detailCustomer.addSpending(parseFloat(amount))
    await detailCustomer.populate('customer', 'customerCode fullName')

    response.status(200).json({
      success: true,
      message: 'Spending added successfully',
      data: {
        detailCustomer: {
          id: detailCustomer._id,
          customer: detailCustomer.customer ? {
            id: detailCustomer.customer._id,
            customerCode: detailCustomer.customer.customerCode,
            fullName: detailCustomer.customer.fullName
          } : null,
          customerType: detailCustomer.customerType,
          totalSpent: detailCustomer.totalSpent,
          updatedAt: detailCustomer.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.message === 'Amount cannot be negative') {
      return response.status(400).json({
        error: error.message
      })
    }
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid detail customer ID'
      })
    }
    response.status(500).json({
      error: 'Failed to add spending'
    })
  }
})

// PATCH /api/detail-customers/:id/subtract-spending - Subtract spending (for refunds) (Admin only)
detailCustomersRouter.patch('/:id/subtract-spending', userExtractor, isAdmin, async (request, response) => {
  const { amount } = request.body

  if (!amount || amount <= 0) {
    return response.status(400).json({
      error: 'Amount must be greater than 0'
    })
  }

  try {
    const detailCustomer = await DetailCustomer.findById(request.params.id)

    if (!detailCustomer) {
      return response.status(404).json({
        error: 'Customer details not found'
      })
    }

    // Use the subtractSpending method from the model
    await detailCustomer.subtractSpending(parseFloat(amount))
    await detailCustomer.populate('customer', 'customerCode fullName')

    response.status(200).json({
      success: true,
      message: 'Spending subtracted successfully',
      data: {
        detailCustomer: {
          id: detailCustomer._id,
          customer: detailCustomer.customer ? {
            id: detailCustomer.customer._id,
            customerCode: detailCustomer.customer.customerCode,
            fullName: detailCustomer.customer.fullName
          } : null,
          customerType: detailCustomer.customerType,
          totalSpent: detailCustomer.totalSpent,
          updatedAt: detailCustomer.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.message === 'Amount cannot be negative') {
      return response.status(400).json({
        error: error.message
      })
    }
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid detail customer ID'
      })
    }
    response.status(500).json({
      error: 'Failed to subtract spending'
    })
  }
})

// DELETE /api/detail-customers/:id - Delete detail customer (Admin only)
detailCustomersRouter.delete('/:id', userExtractor, isAdmin, async (request, response) => {
  try {
    const detailCustomer = await DetailCustomer.findById(request.params.id)

    if (!detailCustomer) {
      return response.status(404).json({
        error: 'Customer details not found'
      })
    }

    await DetailCustomer.findByIdAndDelete(request.params.id)

    response.status(200).json({
      success: true,
      message: 'Customer details deleted successfully'
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid detail customer ID'
      })
    }
    response.status(500).json({
      error: 'Failed to delete customer details'
    })
  }
})

module.exports = detailCustomersRouter
