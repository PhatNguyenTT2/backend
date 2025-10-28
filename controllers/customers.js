const customersRouter = require('express').Router()
const Customer = require('../models/customer')
const Order = require('../models/order')
const DetailCustomer = require('../models/detailCustomer')
const { userExtractor, isAdmin } = require('../utils/auth')

// GET /api/customers - Get all customers
customersRouter.get('/', userExtractor, isAdmin, async (request, response) => {
  try {
    const { include_inactive, search, customer_type } = request.query

    // Build filter
    const filter = {}
    if (include_inactive !== 'true') {
      filter.isActive = true
    }

    let customers

    // Search functionality
    if (search) {
      customers = await Customer.searchCustomers(search)
    } else if (customer_type) {
      customers = await Customer.getCustomersByType(customer_type)
    } else {
      customers = await Customer.find(filter).sort({ createdAt: -1 })
    }

    // Get order count for each customer
    const customersWithCount = await Promise.all(
      customers.map(async (customer) => {
        const orderCount = await Order.countDocuments({
          customer: customer._id
        })

        // Get customer details if exists
        const details = await DetailCustomer.findOne({ customer: customer._id })

        return {
          id: customer._id,
          customerCode: customer.customerCode,
          fullName: customer.fullName,
          email: customer.email,
          phone: customer.phone,
          address: customer.address,
          dateOfBirth: customer.dateOfBirth,
          gender: customer.gender,
          isActive: customer.isActive,
          orderCount,
          totalSpent: details?.totalSpent || 0,
          customerType: details?.customerType || 'regular',
          createdAt: customer.createdAt,
          updatedAt: customer.updatedAt
        }
      })
    )

    response.status(200).json({
      success: true,
      data: {
        customers: customersWithCount
      }
    })
  } catch (error) {
    response.status(500).json({
      error: 'Failed to fetch customers'
    })
  }
})

// GET /api/customers/stats/overview - Get customer statistics (Admin only)
customersRouter.get('/stats/overview', userExtractor, isAdmin, async (request, response) => {
  try {
    const stats = await Customer.getStatistics()

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

// GET /api/customers/top - Get top customers by spending (Admin only)
customersRouter.get('/top', userExtractor, isAdmin, async (request, response) => {
  try {
    const { limit } = request.query
    const topCustomers = await Customer.getTopCustomers(limit ? parseInt(limit) : 10)

    response.status(200).json({
      success: true,
      data: {
        topCustomers
      }
    })
  } catch (error) {
    response.status(500).json({
      error: 'Failed to fetch top customers'
    })
  }
})

// GET /api/customers/code/:code - Get customer by code
customersRouter.get('/code/:code', userExtractor, isAdmin, async (request, response) => {
  try {
    const customer = await Customer.findOne({
      customerCode: request.params.code.toUpperCase()
    })

    if (!customer) {
      return response.status(404).json({
        error: 'Customer not found'
      })
    }

    // Get order count
    const orderCount = await Order.countDocuments({
      customer: customer._id
    })

    // Get customer details
    const details = await DetailCustomer.findOne({ customer: customer._id })

    response.status(200).json({
      success: true,
      data: {
        customer: {
          id: customer._id,
          customerCode: customer.customerCode,
          fullName: customer.fullName,
          email: customer.email,
          phone: customer.phone,
          address: customer.address,
          dateOfBirth: customer.dateOfBirth,
          gender: customer.gender,
          isActive: customer.isActive,
          orderCount,
          totalSpent: details?.totalSpent || 0,
          customerType: details?.customerType || 'regular',
          createdAt: customer.createdAt,
          updatedAt: customer.updatedAt
        }
      }
    })
  } catch (error) {
    response.status(500).json({
      error: 'Failed to fetch customer'
    })
  }
})

// GET /api/customers/:id - Get single customer
customersRouter.get('/:id', userExtractor, isAdmin, async (request, response) => {
  try {
    const customer = await Customer.findById(request.params.id)

    if (!customer) {
      return response.status(404).json({
        error: 'Customer not found'
      })
    }

    // Get order count
    const orderCount = await Order.countDocuments({
      customer: customer._id
    })

    // Get customer details
    const details = await DetailCustomer.findOne({ customer: customer._id })

    response.status(200).json({
      success: true,
      data: {
        customer: {
          id: customer._id,
          customerCode: customer.customerCode,
          fullName: customer.fullName,
          email: customer.email,
          phone: customer.phone,
          address: customer.address,
          dateOfBirth: customer.dateOfBirth,
          gender: customer.gender,
          isActive: customer.isActive,
          orderCount,
          totalSpent: details?.totalSpent || 0,
          customerType: details?.customerType || 'regular',
          createdAt: customer.createdAt,
          updatedAt: customer.updatedAt
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
      error: 'Failed to fetch customer'
    })
  }
})

// POST /api/customers - Create new customer (Admin only)
customersRouter.post('/', userExtractor, isAdmin, async (request, response) => {
  const { fullName, email, phone, address, dateOfBirth, gender } = request.body

  if (!fullName) {
    return response.status(400).json({
      error: 'Full name is required'
    })
  }

  if (!phone) {
    return response.status(400).json({
      error: 'Phone number is required'
    })
  }

  try {
    const customer = new Customer({
      fullName,
      email,
      phone,
      address,
      dateOfBirth,
      gender,
      isActive: true
    })

    const savedCustomer = await customer.save()

    response.status(201).json({
      success: true,
      message: 'Customer created successfully',
      data: {
        customer: {
          id: savedCustomer._id,
          customerCode: savedCustomer.customerCode,
          fullName: savedCustomer.fullName,
          email: savedCustomer.email,
          phone: savedCustomer.phone,
          address: savedCustomer.address,
          dateOfBirth: savedCustomer.dateOfBirth,
          gender: savedCustomer.gender,
          isActive: savedCustomer.isActive,
          createdAt: savedCustomer.createdAt
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
      const field = Object.keys(error.keyPattern)[0]
      return response.status(400).json({
        error: `${field === 'email' ? 'Email' : 'Phone'} already exists`
      })
    }
    response.status(500).json({
      error: 'Failed to create customer'
    })
  }
})

// PUT /api/customers/:id - Update customer (Admin only)
customersRouter.put('/:id', userExtractor, isAdmin, async (request, response) => {
  const { fullName, email, phone, address, dateOfBirth, gender } = request.body

  try {
    const customer = await Customer.findById(request.params.id)

    if (!customer) {
      return response.status(404).json({
        error: 'Customer not found'
      })
    }

    // Use the updateCustomer method from the model
    const updatedCustomer = await customer.updateCustomer({
      fullName,
      email,
      phone,
      address,
      dateOfBirth,
      gender
    })

    response.status(200).json({
      success: true,
      message: 'Customer updated successfully',
      data: {
        customer: {
          id: updatedCustomer._id,
          customerCode: updatedCustomer.customerCode,
          fullName: updatedCustomer.fullName,
          email: updatedCustomer.email,
          phone: updatedCustomer.phone,
          address: updatedCustomer.address,
          dateOfBirth: updatedCustomer.dateOfBirth,
          gender: updatedCustomer.gender,
          isActive: updatedCustomer.isActive,
          updatedAt: updatedCustomer.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.name === 'ValidationError') {
      return response.status(400).json({
        error: error.message
      })
    }
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid customer ID'
      })
    }
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0]
      return response.status(400).json({
        error: `${field === 'email' ? 'Email' : 'Phone'} already exists`
      })
    }
    response.status(500).json({
      error: 'Failed to update customer'
    })
  }
})

// PATCH /api/customers/:id/toggle - Toggle customer active status (Admin only)
customersRouter.patch('/:id/toggle', userExtractor, isAdmin, async (request, response) => {
  try {
    const customer = await Customer.findById(request.params.id)

    if (!customer) {
      return response.status(404).json({
        error: 'Customer not found'
      })
    }

    // Use the toggleActive method from the model
    const updatedCustomer = await customer.toggleActive()

    response.status(200).json({
      success: true,
      message: `Customer ${updatedCustomer.isActive ? 'activated' : 'deactivated'} successfully`,
      data: {
        customer: {
          id: updatedCustomer._id,
          customerCode: updatedCustomer.customerCode,
          fullName: updatedCustomer.fullName,
          isActive: updatedCustomer.isActive,
          updatedAt: updatedCustomer.updatedAt
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
      error: 'Failed to toggle customer status'
    })
  }
})

// DELETE /api/customers/:id - Delete customer (Admin only)
customersRouter.delete('/:id', userExtractor, isAdmin, async (request, response) => {
  try {
    const customer = await Customer.findById(request.params.id)

    if (!customer) {
      return response.status(404).json({
        error: 'Customer not found'
      })
    }

    // Check if customer is still active
    if (customer.isActive !== false) {
      return response.status(400).json({
        error: 'Cannot delete active customer. Please deactivate it first.'
      })
    }

    // Check if customer has ANY orders
    const orderCount = await Order.countDocuments({
      customer: request.params.id
    })

    if (orderCount > 0) {
      return response.status(400).json({
        error: `Cannot delete customer with ${orderCount} order(s). Customer records with orders must be retained.`
      })
    }

    // Delete associated detail customer if exists
    await DetailCustomer.findOneAndDelete({ customer: request.params.id })

    await Customer.findByIdAndDelete(request.params.id)

    response.status(200).json({
      success: true,
      message: 'Customer deleted successfully'
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid customer ID'
      })
    }
    response.status(500).json({
      error: 'Failed to delete customer'
    })
  }
})

module.exports = customersRouter
