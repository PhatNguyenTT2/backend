const customersRouter = require('express').Router();
const Customer = require('../models/customer');
const Order = require('../models/order');
const { userExtractor } = require('../utils/auth');

/**
 * Customers Controller - Minimal CRUD Approach
 * 
 * Only 5 basic CRUD endpoints:
 * - GET /api/customers - Get all customers with filtering
 * - GET /api/customers/:id - Get single customer by ID
 * - POST /api/customers - Create new customer
 * - PUT /api/customers/:id - Update customer
 * - DELETE /api/customers/:id - Delete customer
 * 
 * All additional filtering/querying done via query parameters on GET /api/customers
 */

/**
 * GET /api/customers
 * Get all customers with filtering via query parameters
 * 
 * Query parameters:
 * - isActive: boolean - Filter by active status
 * - search: string - Search by name, email, phone, or customer code
 * - customerType: string - Filter by type (guest/retail/wholesale/vip)
 * - gender: string - Filter by gender (male/female/other)
 * - minSpent: number - Filter by minimum total spent
 * - maxSpent: number - Filter by maximum total spent
 * - hasEmail: boolean - Filter customers with/without email
 * - hasPhone: boolean - Filter customers with/without phone
 * - withOrders: boolean - Include order history
 * - sortBy: string - Sort field (default: createdAt)
 * - sortOrder: string - Sort order (asc/desc, default: desc)
 * - page: number - Page number for pagination
 * - limit: number - Items per page
 */
customersRouter.get('/', async (request, response) => {
  try {
    const {
      isActive,
      search,
      customerType,
      gender,
      minSpent,
      maxSpent,
      hasEmail,
      hasPhone,
      withOrders,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = 1,
      limit = 20
    } = request.query;

    // Build filter object
    const filter = {};

    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    if (search) {
      filter.$or = [
        { fullName: new RegExp(search, 'i') },
        { customerCode: new RegExp(search, 'i') },
        { email: new RegExp(search, 'i') },
        { phone: new RegExp(search, 'i') }
      ];
    }

    if (customerType) {
      filter.customerType = customerType;
    }

    if (gender) {
      filter.gender = gender;
    }

    if (minSpent !== undefined || maxSpent !== undefined) {
      filter.totalSpent = {};
      if (minSpent !== undefined) {
        filter.totalSpent.$gte = parseFloat(minSpent);
      }
      if (maxSpent !== undefined) {
        filter.totalSpent.$lte = parseFloat(maxSpent);
      }
    }

    if (hasEmail === 'true') {
      filter.email = { $exists: true, $ne: null };
    } else if (hasEmail === 'false') {
      filter.$or = [
        { email: { $exists: false } },
        { email: null }
      ];
    }

    if (hasPhone === 'true') {
      filter.phone = { $exists: true, $ne: null };
    } else if (hasPhone === 'false') {
      filter.$or = [
        { phone: { $exists: false } },
        { phone: null }
      ];
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Build query
    let query = Customer.find(filter)
      .skip(skip)
      .limit(parseInt(limit))
      .sort(sort);

    // Populate orders if requested
    if (withOrders === 'true') {
      query = query.populate({
        path: 'orders',
        select: 'orderCode totalAmount status paymentStatus createdAt',
        options: { limit: 10, sort: { createdAt: -1 } }
      });
    }

    const customers = await query;

    // Get total count for pagination
    const total = await Customer.countDocuments(filter);

    response.json({
      success: true,
      data: {
        customers,
        pagination: {
          currentPage: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get customers error:', error);
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to get customers',
        details: error.message
      }
    });
  }
});

/**
 * GET /api/customers/default-guest
 * Get or create a virtual guest customer for POS
 * Returns a guest customer object (customerType: 'guest')
 * This is a virtual/abstract object - not tied to specific database record
 */
customersRouter.get('/default-guest', async (request, response) => {
  try {
    // Return virtual guest customer object
    // Frontend will use this for walk-in customers
    // Any customer with customerType='guest' is treated as walk-in
    const virtualGuest = {
      id: 'virtual-guest',
      customerCode: 'GUEST',
      fullName: 'Khách vãng lai',
      phone: null,
      email: null,
      customerType: 'guest',
      address: null,
      gender: 'other',
      totalSpent: 0,
      isActive: true,
      isVirtual: true, // Flag to indicate this is not a real DB record
      createdAt: new Date(),
      updatedAt: new Date()
    };

    response.json({
      success: true,
      data: {
        customer: virtualGuest
      }
    });
  } catch (error) {
    console.error('Get default guest error:', error);
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to get default guest customer',
        details: error.message
      }
    });
  }
});

/**
 * GET /api/customers/:id
 * Get single customer by ID with order history and statistics
 */
customersRouter.get('/:id', async (request, response) => {
  try {
    const customer = await Customer.findById(request.params.id)
      .populate({
        path: 'orders',
        select: 'orderCode totalAmount status paymentStatus paymentMethod createdAt',
        options: { sort: { createdAt: -1 } }
      });

    if (!customer) {
      return response.status(404).json({
        success: false,
        error: {
          message: 'Customer not found',
          code: 'CUSTOMER_NOT_FOUND'
        }
      });
    }

    // Get order statistics
    const totalOrders = customer.orders?.length || 0;
    const completedOrders = customer.orders?.filter(order => order.status === 'completed').length || 0;
    const pendingOrders = customer.orders?.filter(order => order.status === 'pending').length || 0;
    const cancelledOrders = customer.orders?.filter(order => order.status === 'cancelled').length || 0;

    response.json({
      success: true,
      data: {
        customer,
        statistics: {
          totalOrders,
          completedOrders,
          pendingOrders,
          cancelledOrders,
          totalSpent: customer.totalSpent,
          isVIP: customer.isVIP,
          qualifiesForUpgrade: customer.qualifiesForUpgrade
        }
      }
    });
  } catch (error) {
    console.error('Get customer by ID error:', error);
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to get customer',
        details: error.message
      }
    });
  }
});

/**
 * POST /api/customers
 * Create new customer
 * Requires authentication
 */
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
      isActive
    } = request.body;

    // Validation
    if (!fullName) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Full name is required',
          code: 'MISSING_FULL_NAME'
        }
      });
    }

    // Check if customer with same email already exists (if email provided)
    if (email) {
      const existingEmail = await Customer.findOne({ email: email.toLowerCase() });
      if (existingEmail) {
        return response.status(409).json({
          success: false,
          error: {
            message: 'Customer with this email already exists',
            code: 'DUPLICATE_EMAIL',
            details: {
              existingCustomer: {
                id: existingEmail._id,
                customerCode: existingEmail.customerCode,
                fullName: existingEmail.fullName
              }
            }
          }
        });
      }
    }

    // Create customer
    const customer = new Customer({
      fullName,
      email: email || null,
      phone: phone || null,
      address: address || null,
      dateOfBirth: dateOfBirth || null,
      gender: gender || null,
      customerType: customerType || 'guest',
      totalSpent: 0,
      isActive: isActive !== undefined ? isActive : true
    });

    const savedCustomer = await customer.save();

    response.status(201).json({
      success: true,
      data: savedCustomer,
      message: 'Customer created successfully'
    });
  } catch (error) {
    console.error('Create customer error:', error);

    // Handle duplicate customer code (should not happen with auto-generation)
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return response.status(409).json({
        success: false,
        error: {
          message: `Duplicate ${field}`,
          code: 'DUPLICATE_FIELD',
          details: error.message
        }
      });
    }

    // Handle validation errors
    if (error.name === 'ValidationError') {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Validation error',
          code: 'VALIDATION_ERROR',
          details: error.message
        }
      });
    }

    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to create customer',
        details: error.message
      }
    });
  }
});

/**
 * PUT /api/customers/:id
 * Update customer
 * Requires authentication
 * 
 * Note: This endpoint handles all updates including:
 * - Personal information updates
 * - Customer type changes
 * - Status changes (activate/deactivate via isActive field)
 * - Total spent updates (normally handled internally by orders)
 */
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
      totalSpent,
      isActive
    } = request.body;

    // Find customer
    const customer = await Customer.findById(request.params.id);

    if (!customer) {
      return response.status(404).json({
        success: false,
        error: {
          message: 'Customer not found',
          code: 'CUSTOMER_NOT_FOUND'
        }
      });
    }

    // Check if email is being changed and if it conflicts
    if (email && email !== customer.email) {
      const existingEmail = await Customer.findOne({
        _id: { $ne: customer._id },
        email: email.toLowerCase()
      });

      if (existingEmail) {
        return response.status(409).json({
          success: false,
          error: {
            message: 'Another customer with this email already exists',
            code: 'DUPLICATE_EMAIL'
          }
        });
      }
    }

    // Update fields
    if (fullName !== undefined) customer.fullName = fullName;
    if (email !== undefined) customer.email = email;
    if (phone !== undefined) customer.phone = phone;
    if (address !== undefined) customer.address = address;
    if (dateOfBirth !== undefined) customer.dateOfBirth = dateOfBirth;
    if (gender !== undefined) customer.gender = gender;
    if (customerType !== undefined) customer.customerType = customerType;
    if (totalSpent !== undefined) customer.totalSpent = totalSpent;
    if (isActive !== undefined) customer.isActive = isActive;

    const updatedCustomer = await customer.save();

    response.json({
      success: true,
      data: updatedCustomer,
      message: 'Customer updated successfully'
    });
  } catch (error) {
    console.error('Update customer error:', error);

    // Handle validation errors
    if (error.name === 'ValidationError') {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Validation error',
          code: 'VALIDATION_ERROR',
          details: error.message
        }
      });
    }

    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to update customer',
        details: error.message
      }
    });
  }
});

/**
 * DELETE /api/customers/:id
 * Delete customer (soft delete by setting isActive to false)
 * Requires authentication
 * 
 * Note: Cannot delete customer if they have active orders
 */
customersRouter.delete('/:id', userExtractor, async (request, response) => {
  try {
    const customer = await Customer.findById(request.params.id);

    if (!customer) {
      return response.status(404).json({
        success: false,
        error: {
          message: 'Customer not found',
          code: 'CUSTOMER_NOT_FOUND'
        }
      });
    }

    // Check if customer has active orders
    const activeOrders = await Order.countDocuments({
      customer: customer._id,
      status: { $in: ['pending', 'processing', 'confirmed'] }
    });

    if (activeOrders > 0) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Cannot delete customer with active orders',
          code: 'CUSTOMER_HAS_ACTIVE_ORDERS',
          details: {
            activeOrders,
            message: 'Please complete or cancel all active orders before deleting, or deactivate the customer instead'
          }
        }
      });
    }

    // Soft delete - set isActive to false instead of actual deletion
    customer.isActive = false;
    await customer.save();

    response.json({
      success: true,
      message: 'Customer deactivated successfully',
      data: {
        id: customer._id,
        customerCode: customer.customerCode,
        fullName: customer.fullName,
        isActive: customer.isActive
      }
    });
  } catch (error) {
    console.error('Delete customer error:', error);
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to delete customer',
        details: error.message
      }
    });
  }
});

module.exports = customersRouter;
