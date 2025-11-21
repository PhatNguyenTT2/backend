const ordersRouter = require('express').Router();
const Order = require('../models/order');
const OrderDetail = require('../models/orderDetail');
const Customer = require('../models/customer');
const Employee = require('../models/employee');
const Product = require('../models/product');
const { selectBatchFEFO } = require('../utils/batchHelpers');
const mongoose = require('mongoose');

/**
 * Orders Controller - Minimal CRUD Approach
 * 
 * Only 5 basic CRUD endpoints:
 * - GET /api/orders - Get all orders with filtering
 * - GET /api/orders/:id - Get single order by ID
 * - POST /api/orders - Create new order
 * - PUT /api/orders/:id - Update order
 * - DELETE /api/orders/:id - Delete order
 * 
 * Methods NOT implemented as endpoints (waiting for frontend request):
 * - getStatistics() - Order statistics
 * - getOrdersByDateRange() - Use GET /api/orders?startDate=...&endDate=...
 * - calculateRevenue() - Waiting for frontend request
 * - updatePaymentStatus() - Use PUT /api/orders/:id with { paymentStatus: ... }
 * - updateOrderStatus() - Use PUT /api/orders/:id with { status: ... }
 * - cancelOrder() - Use PUT /api/orders/:id with { status: 'cancelled' }
 */

/**
 * GET /api/orders
 * Get all orders with filtering via query parameters
 * 
 * Query parameters:
 * - customer: ObjectId - Filter by customer
 * - createdBy: ObjectId - Filter by employee
 * - status: string - Filter by order status (pending/processing/shipping/delivered/cancelled)
 * - paymentStatus: string - Filter by payment status (pending/paid/failed/refunded)
 * - deliveryType: string - Filter by delivery type (delivery/pickup)
 * - startDate: date - Filter orders from this date
 * - endDate: date - Filter orders to this date
 * - minTotal: number - Filter by minimum total
 * - maxTotal: number - Filter by maximum total
 * - search: string - Search by order number or customer name
 * - withDetails: boolean - Include order details
 * - sortBy: string - Sort field (default: orderDate)
 * - sortOrder: string - Sort order (asc/desc, default: desc)
 * - page: number - Page number for pagination
 * - limit: number - Items per page
 */
ordersRouter.get('/', async (request, response) => {
  try {
    const {
      customer,
      createdBy,
      status,
      paymentStatus,
      deliveryType,
      startDate,
      endDate,
      minTotal,
      maxTotal,
      search,
      withDetails,
      sortBy = 'orderDate',
      sortOrder = 'desc',
      page = 1,
      limit = 20
    } = request.query;

    // Build filter object
    const filter = {};

    if (customer) {
      filter.customer = customer;
    }

    if (createdBy) {
      filter.createdBy = createdBy;
    }

    if (status) {
      filter.status = status;
    }

    if (paymentStatus) {
      filter.paymentStatus = paymentStatus;
    }

    if (deliveryType) {
      filter.deliveryType = deliveryType;
    }

    // Date range filter
    if (startDate || endDate) {
      filter.orderDate = {};
      if (startDate) {
        filter.orderDate.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999); // End of day
        filter.orderDate.$lte = end;
      }
    }

    // Total range filter
    if (minTotal !== undefined || maxTotal !== undefined) {
      filter.total = {};
      if (minTotal !== undefined) {
        filter.total.$gte = parseFloat(minTotal);
      }
      if (maxTotal !== undefined) {
        filter.total.$lte = parseFloat(maxTotal);
      }
    }

    // Search filter
    if (search) {
      // If search is an order number pattern
      if (/^ORD\d{10}$/i.test(search)) {
        filter.orderNumber = new RegExp(search, 'i');
      } else {
        // Search by customer name - need to find customers first
        const customers = await Customer.find({
          fullName: new RegExp(search, 'i')
        }).select('_id').lean();

        if (customers.length > 0) {
          filter.customer = { $in: customers.map(c => c._id) };
        } else {
          // No customers found, search by order number anyway
          filter.orderNumber = new RegExp(search, 'i');
        }
      }
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Build query
    let query = Order.find(filter)
      .populate('customer', 'customerCode fullName phone email address')
      .populate('createdBy', 'fullName phone')
      .skip(skip)
      .limit(parseInt(limit))
      .sort(sort);

    // Populate order details if requested
    if (withDetails === 'true') {
      query = query.populate({
        path: 'details',
        populate: [
          { path: 'product', select: 'productCode name unitPrice image' },
          { path: 'batch', select: 'batchCode expiryDate' }
        ]
      });
    }

    const orders = await query;

    // Get total count for pagination
    const total = await Order.countDocuments(filter);

    response.json({
      success: true,
      data: {
        orders,
        count: orders.length
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error in getAll orders:', error);
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch orders',
        details: error.message
      }
    });
  }
});

/**
 * GET /api/orders/:id
 * Get single order by ID with full details
 */
ordersRouter.get('/:id', async (request, response) => {
  try {
    const order = await Order.findById(request.params.id)
      .populate('customer', 'customerCode fullName phone email address customerType gender')
      .populate('createdBy', 'fullName phone email')
      .populate({
        path: 'details',
        populate: [
          { path: 'product', select: 'productCode name unitPrice image category' },
          { path: 'batch', select: 'batchCode expiryDate manufacturingDate' }
        ]
      });

    if (!order) {
      return response.status(404).json({
        success: false,
        error: {
          message: 'Order not found',
          code: 'ORDER_NOT_FOUND'
        }
      });
    }

    response.json({
      success: true,
      data: { order }
    });
  } catch (error) {
    console.error('Error in getById order:', error);
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch order',
        details: error.message
      }
    });
  }
});

/**
 * POST /api/orders
 * Create new order with automatic FEFO batch selection
 * 
 * Request body:
 * {
 *   customer: ObjectId (required),
 *   createdBy: ObjectId (optional, will use system if not provided),
 *   orderDate: Date (optional, defaults to now),
 *   deliveryType: 'delivery' | 'pickup' (optional, defaults to 'delivery'),
 *   shippingAddress: String (optional, but required if deliveryType is 'delivery'),
 *   shippingFee: Number (optional, defaults to 0),
 *   discount: Number (optional, defaults to 0 - this is discount amount, not percentage),
 *   discountPercentage: Number (optional, defaults to 0),
 *   status: String (optional, defaults to 'pending'),
 *   paymentStatus: String (optional, defaults to 'pending'),
 *   items: Array of {
 *     product: ObjectId (required),
 *     quantity: Number (required),
 *     unitPrice: Number (required),
 *     notes: String (optional)
 *     // batch will be auto-selected using FEFO
 *   }
 * }
 */
ordersRouter.post('/', async (request, response) => {
  try {
    const {
      customer,
      createdBy,
      orderDate,
      deliveryType,
      shippingAddress,
      address, // Support both shippingAddress and address
      shippingFee,
      status,
      paymentStatus,
      items,
      details // Support both items and details
    } = request.body;

    // Use items or details (for backward compatibility)
    const orderItems = items || details;

    // Validate required fields
    if (!customer) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Customer is required',
          code: 'MISSING_CUSTOMER'
        }
      });
    }

    if (!orderItems || !Array.isArray(orderItems) || orderItems.length === 0) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Order must have at least one item',
          code: 'MISSING_ORDER_ITEMS'
        }
      });
    }

    // Validate customer exists and get discount percentage based on customer type
    const customerDoc = await Customer.findById(customer);
    if (!customerDoc) {
      return response.status(404).json({
        success: false,
        error: {
          message: 'Customer not found',
          code: 'CUSTOMER_NOT_FOUND'
        }
      });
    }

    // Auto-calculate discount percentage based on customer type
    const discountPercentageMap = {
      'guest': 0,
      'retail': 10,
      'wholesale': 15,
      'vip': 20
    };
    const autoDiscountPercentage = discountPercentageMap[customerDoc.customerType?.toLowerCase()] || 0;

    // Validate employee if provided
    let validatedCreatedBy = createdBy;
    if (createdBy) {
      const employeeExists = await Employee.findById(createdBy);
      if (!employeeExists) {
        return response.status(404).json({
          success: false,
          error: {
            message: 'Employee not found',
            code: 'EMPLOYEE_NOT_FOUND'
          }
        });
      }
    } else {
      // If no employee provided, find a system/admin employee
      const systemEmployee = await Employee.findOne({ isActive: true }).sort({ createdAt: 1 });
      if (!systemEmployee) {
        return response.status(400).json({
          success: false,
          error: {
            message: 'No active employee found. Please create an employee first.',
            code: 'NO_EMPLOYEE_FOUND'
          }
        });
      }
      validatedCreatedBy = systemEmployee._id;
    }

    // Validate items and auto-select batches using FEFO
    const processedItems = [];
    for (const item of orderItems) {
      if (!item.product || !item.quantity || item.quantity <= 0) {
        return response.status(400).json({
          success: false,
          error: {
            message: 'Each item must have a valid product and quantity',
            code: 'INVALID_ITEM'
          }
        });
      }

      // Get product to check existence and get price if not provided
      const product = await Product.findById(item.product);
      if (!product) {
        return response.status(404).json({
          success: false,
          error: {
            message: `Product not found: ${item.product}`,
            code: 'PRODUCT_NOT_FOUND'
          }
        });
      }

      // Auto-select batch using FEFO
      const batchSelection = await selectBatchFEFO(item.product, item.quantity);

      if (!batchSelection) {
        return response.status(400).json({
          success: false,
          error: {
            message: `Insufficient stock for product: ${product.name}`,
            code: 'INSUFFICIENT_STOCK',
            details: {
              product: product.name,
              requestedQuantity: item.quantity
            }
          }
        });
      }

      processedItems.push({
        product: item.product,
        batch: batchSelection.batch._id,
        quantity: item.quantity,
        unitPrice: item.unitPrice || product.unitPrice,
        notes: item.notes
      });
    }

    // Start transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Create order with auto-calculated discount percentage
      const order = new Order({
        customer,
        createdBy: validatedCreatedBy,
        orderDate: orderDate || Date.now(),
        deliveryType: deliveryType || 'delivery',
        address: shippingAddress || address,
        shippingFee: shippingFee || 0,
        discountPercentage: autoDiscountPercentage,
        status: status || 'draft',
        paymentStatus: paymentStatus || 'pending',
        total: 0 // Will be calculated from details
      });

      await order.save({ session });

      // Create order details with auto-selected batches
      const orderDetails = [];
      for (const item of processedItems) {
        const orderDetail = new OrderDetail({
          order: order._id,
          product: item.product,
          batch: item.batch,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          notes: item.notes
        });

        await orderDetail.save({ session });
        orderDetails.push(orderDetail);
      }

      await session.commitTransaction();

      // Populate and return order
      await order.populate([
        { path: 'customer', select: 'customerCode fullName phone email' },
        { path: 'createdBy', select: 'fullName phone' },
        {
          path: 'details',
          populate: [
            { path: 'product', select: 'productCode name unitPrice image' },
            { path: 'batch', select: 'batchCode expiryDate mfgDate' }
          ]
        }
      ]);

      response.status(201).json({
        success: true,
        data: { order },
        message: 'Order created successfully with FEFO batch allocation'
      });
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    console.error('Error in create order:', error);

    // Handle validation errors
    if (error.name === 'ValidationError') {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: error.errors
        }
      });
    }

    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to create order',
        details: error.message
      }
    });
  }
});

/**
 * PUT /api/orders/:id
 * Update order
 * 
 * Can update:
 * - deliveryType
 * - address
 * - shippingFee
 * - discountPercentage
 * - status
 * - paymentStatus
 * 
 * Cannot update:
 * - customer
 * - createdBy
 * - orderDate
 * - orderNumber (auto-generated)
 */
ordersRouter.put('/:id', async (request, response) => {
  try {
    const {
      deliveryType,
      address,
      shippingFee,
      status,
      paymentStatus
    } = request.body;

    const order = await Order.findById(request.params.id);

    if (!order) {
      return response.status(404).json({
        success: false,
        error: {
          message: 'Order not found',
          code: 'ORDER_NOT_FOUND'
        }
      });
    }

    // Check if order can be updated
    if (order.status === 'delivered' || order.status === 'cancelled') {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Cannot update delivered or cancelled orders',
          code: 'ORDER_CANNOT_BE_UPDATED'
        }
      });
    }

    // Update allowed fields
    if (deliveryType !== undefined) order.deliveryType = deliveryType;
    if (address !== undefined) order.address = address;
    if (shippingFee !== undefined) order.shippingFee = shippingFee;
    if (status !== undefined) order.status = status;
    if (paymentStatus !== undefined) order.paymentStatus = paymentStatus;

    // Note: discountPercentage is auto-calculated from customer type and cannot be manually updated

    await order.save();

    // Populate before returning
    await order.populate([
      { path: 'customer', select: 'customerCode fullName phone email' },
      { path: 'createdBy', select: 'fullName phone' },
      {
        path: 'details',
        populate: [
          { path: 'product', select: 'productCode name unitPrice' },
          { path: 'batch', select: 'batchCode expiryDate' }
        ]
      }
    ]);

    response.json({
      success: true,
      data: { order },
      message: 'Order updated successfully'
    });
  } catch (error) {
    console.error('Error in update order:', error);

    // Handle validation errors
    if (error.name === 'ValidationError') {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: error.errors
        }
      });
    }

    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to update order',
        details: error.message
      }
    });
  }
});

/**
 * DELETE /api/orders/:id
 * Delete order (soft delete by setting status to 'cancelled')
 * Hard delete only allowed for pending orders with no payment
 */
ordersRouter.delete('/:id', async (request, response) => {
  try {
    const { hardDelete } = request.query;

    const order = await Order.findById(request.params.id);

    if (!order) {
      return response.status(404).json({
        success: false,
        error: {
          message: 'Order not found',
          code: 'ORDER_NOT_FOUND'
        }
      });
    }

    // Check if order can be deleted
    if (order.status === 'delivered') {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Cannot delete delivered orders',
          code: 'ORDER_CANNOT_BE_DELETED'
        }
      });
    }

    if (order.paymentStatus === 'paid' && hardDelete === 'true') {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Cannot hard delete paid orders',
          code: 'ORDER_CANNOT_BE_HARD_DELETED'
        }
      });
    }

    if (hardDelete === 'true' && order.status === 'pending' && order.paymentStatus === 'pending') {
      // Hard delete: remove order and its details
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        await OrderDetail.deleteMany({ order: order._id }, { session });
        await Order.findByIdAndDelete(request.params.id, { session });

        await session.commitTransaction();

        response.json({
          success: true,
          message: 'Order deleted successfully'
        });
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        session.endSession();
      }
    } else {
      // Soft delete: set status to cancelled
      order.status = 'cancelled';
      await order.save();

      response.json({
        success: true,
        message: 'Order cancelled successfully'
      });
    }
  } catch (error) {
    console.error('Error in delete order:', error);
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to delete order',
        details: error.message
      }
    });
  }
});

module.exports = ordersRouter;
