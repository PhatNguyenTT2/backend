const orderDetailsRouter = require('express').Router();
const OrderDetail = require('../models/orderDetail');
const Order = require('../models/order');
const Product = require('../models/product');
const ProductBatch = require('../models/productBatch');
const mongoose = require('mongoose');

/**
 * OrderDetails Controller - Minimal CRUD Approach
 * 
 * Only 5 basic CRUD endpoints:
 * - GET /api/order-details - Get all order details with filtering
 * - GET /api/order-details/:id - Get single order detail by ID
 * - POST /api/order-details - Create new order detail
 * - PUT /api/order-details/:id - Update order detail
 * - DELETE /api/order-details/:id - Delete order detail
 * 
 * Methods NOT implemented as endpoints (waiting for frontend request):
 * - getDetailsByOrder() - Use GET /api/order-details?order=:orderId
 * - getDetailsByProduct() - Use GET /api/order-details?product=:productId
 * - getDetailsByBatch() - Use GET /api/order-details?batch=:batchId
 * - calculateTotalRevenue() - Waiting for frontend request
 */

/**
 * GET /api/order-details
 * Get all order details with filtering via query parameters
 * 
 * Query parameters:
 * - order: ObjectId - Filter by order
 * - product: ObjectId - Filter by product
 * - batch: ObjectId - Filter by batch
 * - minQuantity: number - Filter by minimum quantity
 * - maxQuantity: number - Filter by maximum quantity
 * - minPrice: number - Filter by minimum unit price
 * - maxPrice: number - Filter by maximum unit price
 * - startDate: date - Filter by order date (from)
 * - endDate: date - Filter by order date (to)
 * - sortBy: string - Sort field (default: createdAt)
 * - sortOrder: string - Sort order (asc/desc, default: desc)
 * - page: number - Page number for pagination
 * - limit: number - Items per page
 */
orderDetailsRouter.get('/', async (request, response) => {
  try {
    const {
      order,
      product,
      batch,
      minQuantity,
      maxQuantity,
      minPrice,
      maxPrice,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = 1,
      limit = 50
    } = request.query;

    // Build filter object
    const filter = {};

    if (order) {
      filter.order = order;
    }

    if (product) {
      filter.product = product;
    }

    if (batch) {
      filter.batch = batch;
    }

    // Quantity range filter
    if (minQuantity !== undefined || maxQuantity !== undefined) {
      filter.quantity = {};
      if (minQuantity !== undefined) {
        filter.quantity.$gte = parseInt(minQuantity);
      }
      if (maxQuantity !== undefined) {
        filter.quantity.$lte = parseInt(maxQuantity);
      }
    }

    // Unit price range filter
    if (minPrice !== undefined || maxPrice !== undefined) {
      filter.unitPrice = {};
      if (minPrice !== undefined) {
        filter.unitPrice.$gte = parseFloat(minPrice);
      }
      if (maxPrice !== undefined) {
        filter.unitPrice.$lte = parseFloat(maxPrice);
      }
    }

    // Date range filter (via order's orderDate)
    if (startDate || endDate) {
      const orderFilter = {};
      if (startDate || endDate) {
        orderFilter.orderDate = {};
        if (startDate) {
          orderFilter.orderDate.$gte = new Date(startDate);
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          orderFilter.orderDate.$lte = end;
        }
      }

      // Find orders that match date filter
      const orders = await Order.find(orderFilter).select('_id').lean();
      if (orders.length > 0) {
        filter.order = { $in: orders.map(o => o._id) };
      } else {
        // No orders in date range, return empty result
        return response.json({
          success: true,
          data: {
            orderDetails: [],
            count: 0
          },
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: 0,
            pages: 0
          }
        });
      }
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Build query
    const orderDetails = await OrderDetail.find(filter)
      .populate('order', 'orderNumber orderDate status paymentStatus total')
      .populate('product', 'productCode name unitPrice image')
      .populate('batch', 'batchCode expiryDate manufacturingDate')
      .skip(skip)
      .limit(parseInt(limit))
      .sort(sort);

    // Get total count for pagination
    const total = await OrderDetail.countDocuments(filter);

    response.json({
      success: true,
      data: {
        orderDetails,
        count: orderDetails.length
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error in getAll order details:', error);
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch order details',
        details: error.message
      }
    });
  }
});

/**
 * GET /api/order-details/:id
 * Get single order detail by ID
 */
orderDetailsRouter.get('/:id', async (request, response) => {
  try {
    const orderDetail = await OrderDetail.findById(request.params.id)
      .populate('order', 'orderNumber orderDate status paymentStatus customer createdBy')
      .populate('product', 'productCode name unitPrice image category')
      .populate('batch', 'batchCode expiryDate manufacturingDate costPrice');

    if (!orderDetail) {
      return response.status(404).json({
        success: false,
        error: {
          message: 'Order detail not found',
          code: 'ORDER_DETAIL_NOT_FOUND'
        }
      });
    }

    response.json({
      success: true,
      data: { orderDetail }
    });
  } catch (error) {
    console.error('Error in getById order detail:', error);
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch order detail',
        details: error.message
      }
    });
  }
});

/**
 * POST /api/order-details
 * Create new order detail
 * 
 * Request body:
 * {
 *   order: ObjectId (required),
 *   product: ObjectId (required),
 *   batch: ObjectId (required),
 *   quantity: Number (required),
 *   unitPrice: Number (required),
 *   notes: String (optional)
 * }
 */
orderDetailsRouter.post('/', async (request, response) => {
  try {
    const { order, product, batch, quantity, unitPrice, notes } = request.body;

    // Validate required fields
    if (!order || !product || !batch || !quantity || !unitPrice) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Missing required fields',
          code: 'MISSING_FIELDS',
          details: {
            required: ['order', 'product', 'batch', 'quantity', 'unitPrice']
          }
        }
      });
    }

    // Validate order exists
    const orderExists = await Order.findById(order);
    if (!orderExists) {
      return response.status(404).json({
        success: false,
        error: {
          message: 'Order not found',
          code: 'ORDER_NOT_FOUND'
        }
      });
    }

    // Check if order can be modified
    if (orderExists.status === 'delivered' || orderExists.status === 'cancelled') {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Cannot add details to delivered or cancelled orders',
          code: 'ORDER_CANNOT_BE_MODIFIED'
        }
      });
    }

    // Validate product exists
    const productExists = await Product.findById(product);
    if (!productExists) {
      return response.status(404).json({
        success: false,
        error: {
          message: 'Product not found',
          code: 'PRODUCT_NOT_FOUND'
        }
      });
    }

    // Validate batch exists
    const batchExists = await ProductBatch.findById(batch);
    if (!batchExists) {
      return response.status(404).json({
        success: false,
        error: {
          message: 'Batch not found',
          code: 'BATCH_NOT_FOUND'
        }
      });
    }

    // Check if batch belongs to product
    if (batchExists.product.toString() !== product.toString()) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Batch does not belong to the specified product',
          code: 'BATCH_PRODUCT_MISMATCH'
        }
      });
    }

    // Create order detail
    const orderDetail = new OrderDetail({
      order,
      product,
      batch,
      quantity,
      unitPrice,
      notes
    });

    await orderDetail.save();

    // Populate before returning
    await orderDetail.populate([
      { path: 'order', select: 'orderNumber orderDate status' },
      { path: 'product', select: 'productCode name unitPrice image' },
      { path: 'batch', select: 'batchCode expiryDate' }
    ]);

    response.status(201).json({
      success: true,
      data: { orderDetail },
      message: 'Order detail created successfully'
    });
  } catch (error) {
    console.error('Error in create order detail:', error);

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
        message: 'Failed to create order detail',
        details: error.message
      }
    });
  }
});

/**
 * PUT /api/order-details/:id
 * Update order detail
 * 
 * Can update:
 * - quantity
 * - unitPrice
 * - notes
 * 
 * Cannot update:
 * - order
 * - product
 * - batch
 */
orderDetailsRouter.put('/:id', async (request, response) => {
  try {
    const { quantity, unitPrice, notes } = request.body;

    const orderDetail = await OrderDetail.findById(request.params.id).populate('order');

    if (!orderDetail) {
      return response.status(404).json({
        success: false,
        error: {
          message: 'Order detail not found',
          code: 'ORDER_DETAIL_NOT_FOUND'
        }
      });
    }

    // Check if parent order can be modified
    if (orderDetail.order.status === 'delivered' || orderDetail.order.status === 'cancelled') {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Cannot update details of delivered or cancelled orders',
          code: 'ORDER_CANNOT_BE_MODIFIED'
        }
      });
    }

    // Update allowed fields
    if (quantity !== undefined) orderDetail.quantity = quantity;
    if (unitPrice !== undefined) orderDetail.unitPrice = unitPrice;
    if (notes !== undefined) orderDetail.notes = notes;

    await orderDetail.save();

    // Populate before returning
    await orderDetail.populate([
      { path: 'order', select: 'orderNumber orderDate status' },
      { path: 'product', select: 'productCode name unitPrice image' },
      { path: 'batch', select: 'batchCode expiryDate' }
    ]);

    response.json({
      success: true,
      data: { orderDetail },
      message: 'Order detail updated successfully'
    });
  } catch (error) {
    console.error('Error in update order detail:', error);

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
        message: 'Failed to update order detail',
        details: error.message
      }
    });
  }
});

/**
 * DELETE /api/order-details/:id
 * Delete order detail
 * Only allowed for orders that are not delivered or cancelled
 */
orderDetailsRouter.delete('/:id', async (request, response) => {
  try {
    const orderDetail = await OrderDetail.findById(request.params.id).populate('order');

    if (!orderDetail) {
      return response.status(404).json({
        success: false,
        error: {
          message: 'Order detail not found',
          code: 'ORDER_DETAIL_NOT_FOUND'
        }
      });
    }

    // Check if parent order can be modified
    if (orderDetail.order.status === 'delivered' || orderDetail.order.status === 'cancelled') {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Cannot delete details from delivered or cancelled orders',
          code: 'ORDER_CANNOT_BE_MODIFIED'
        }
      });
    }

    // Check if this is the last detail of the order
    const detailCount = await OrderDetail.countDocuments({ order: orderDetail.order._id });
    if (detailCount === 1) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Cannot delete the last detail of an order. Delete the order instead.',
          code: 'LAST_ORDER_DETAIL'
        }
      });
    }

    await OrderDetail.findByIdAndDelete(request.params.id);

    response.json({
      success: true,
      message: 'Order detail deleted successfully'
    });
  } catch (error) {
    console.error('Error in delete order detail:', error);
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to delete order detail',
        details: error.message
      }
    });
  }
});

module.exports = orderDetailsRouter;
