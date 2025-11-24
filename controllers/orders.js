const ordersRouter = require('express').Router();
const Order = require('../models/order');
const OrderDetail = require('../models/orderDetail');
const Customer = require('../models/customer');
const Employee = require('../models/employee');
const Product = require('../models/product');
const ProductBatch = require('../models/productBatch');
const { selectBatchFEFO, allocateQuantityFEFO } = require('../utils/batchHelpers');
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
      // Support multiple statuses separated by comma
      if (status.includes(',')) {
        filter.status = { $in: status.split(',').map(s => s.trim()) };
      } else {
        filter.status = status;
      }
    }

    if (paymentStatus) {
      // Support multiple payment statuses separated by comma
      if (paymentStatus.includes(',')) {
        filter.paymentStatus = { $in: paymentStatus.split(',').map(s => s.trim()) };
      } else {
        filter.paymentStatus = paymentStatus;
      }
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
      .populate({
        path: 'createdBy',
        select: 'fullName phone',
        populate: {
          path: 'userAccount',
          select: 'userCode username'
        }
      })
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
      .populate({
        path: 'createdBy',
        select: 'fullName phone email',
        populate: {
          path: 'userAccount',
          select: 'userCode username'
        }
      })
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

      // Auto-allocate batches using FEFO (may use multiple batches if needed)
      let batchAllocations;
      try {
        batchAllocations = await allocateQuantityFEFO(item.product, item.quantity);
      } catch (error) {
        return response.status(400).json({
          success: false,
          error: {
            message: error.message || `Insufficient stock on shelf for product: ${product.name}`,
            code: 'INSUFFICIENT_SHELF_STOCK',
            details: {
              product: product.name,
              productCode: product.productCode,
              requestedQuantity: item.quantity,
              note: 'Stock may be in warehouse but not on shelf yet'
            }
          }
        });
      }

      console.log(`✅ Allocated ${batchAllocations.length} batch(es) for ${product.name}:`,
        batchAllocations.map(a => `${a.batchCode} (${a.quantity})`).join(', ')
      );

      // Create order detail for each batch allocation
      // If multiple batches needed, create multiple order details
      for (const allocation of batchAllocations) {
        processedItems.push({
          product: item.product,
          batch: allocation.batchId,
          quantity: allocation.quantity,
          unitPrice: item.unitPrice || allocation.unitPrice,
          notes: item.notes
        });
      }
    }

    // Calculate total from processedItems BEFORE creating order
    const subtotal = processedItems.reduce((sum, item) => {
      const itemTotal = item.quantity * parseFloat(item.unitPrice || 0);
      return sum + itemTotal;
    }, 0);

    const discountAmount = subtotal * (autoDiscountPercentage / 100);
    const calculatedTotal = subtotal - discountAmount + (shippingFee || 0);

    console.log(`💰 Calculated order total: Subtotal=${subtotal}, Discount=${discountAmount} (${autoDiscountPercentage}%), Shipping=${shippingFee || 0}, Total=${calculatedTotal}`);

    // Start transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Create order with status='draft' (inventory will be reserved when moved to 'pending')
      const order = new Order({
        customer,
        createdBy: validatedCreatedBy,
        orderDate: orderDate || Date.now(),
        deliveryType: deliveryType || 'delivery',
        address: shippingAddress || address,
        shippingFee: shippingFee || 0,
        discountPercentage: autoDiscountPercentage,
        status: 'draft', // Always start as draft, inventory reserved on pending
        paymentStatus: paymentStatus || 'pending',
        total: calculatedTotal // Pre-calculated from items
      });

      console.log(`📝 Creating order with status 'draft' and total=${calculatedTotal} - inventory will be reserved when moved to 'pending'`);

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

      // Count unique products and total detail lines
      const uniqueProducts = new Set(processedItems.map(item => item.product.toString())).size;
      const totalDetailLines = processedItems.length;

      console.log(`✅ Order created: ${uniqueProducts} product(s), ${totalDetailLines} detail line(s) (multi-batch allocation)`);

      response.status(201).json({
        success: true,
        data: { order },
        message: `Order created successfully with FEFO batch allocation (${uniqueProducts} product(s), ${totalDetailLines} detail line(s))`
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
      shippingAddress, // Frontend gửi shippingAddress
      shippingFee,
      status,
      paymentStatus,
      notes,
      items
    } = request.body;

    console.log('📥 Update order request:', {
      orderId: request.params.id,
      deliveryType,
      hasItems: items ? items.length : 0,
      status
    });

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

    console.log('📦 Current order status:', order.status);

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

    // Handle items update for draft orders
    if (items && Array.isArray(items) && items.length > 0) {
      console.log('🔄 Updating items:', items.length, 'items');

      // Only allow item updates for draft orders
      if (order.status !== 'draft') {
        console.log('❌ Cannot update items - order status:', order.status);
        return response.status(400).json({
          success: false,
          error: {
            message: 'Items can only be updated for draft orders',
            code: 'ITEMS_LOCKED'
          }
        });
      }

      // Validate and process items
      const processedItems = [];
      for (const item of items) {
        console.log('🔍 Processing item:', { product: item.product, quantity: item.quantity, unitPrice: item.unitPrice });

        if (!item.product || !item.quantity || item.quantity <= 0) {
          console.log('❌ Invalid item:', item);
          return response.status(400).json({
            success: false,
            error: {
              message: 'Each item must have a valid product and quantity',
              code: 'INVALID_ITEM'
            }
          });
        }

        // Get product to validate existence
        const product = await Product.findById(item.product);
        if (!product) {
          console.log('❌ Product not found:', item.product);
          return response.status(404).json({
            success: false,
            error: {
              message: `Product not found: ${item.product}`,
              code: 'PRODUCT_NOT_FOUND'
            }
          });
        }

        console.log('✅ Product found:', product.name);

        // Check inventory quantityOnShelf (actual available for sale)
        const Inventory = require('../models/inventory');
        const inventory = await Inventory.findOne({ product: item.product });

        if (!inventory) {
          console.log('❌ Inventory not found for product:', product.name);
          return response.status(400).json({
            success: false,
            error: {
              message: `Inventory not found for product: ${product.name}`,
              code: 'INVENTORY_NOT_FOUND'
            }
          });
        }

        const availableOnShelf = inventory.quantityOnShelf || 0;
        console.log('📊 Quantity on shelf:', availableOnShelf, 'needed:', item.quantity);

        if (availableOnShelf < item.quantity) {
          console.log('❌ Insufficient stock for:', product.name, `(need ${item.quantity}, have ${availableOnShelf})`);
          return response.status(400).json({
            success: false,
            error: {
              message: `Insufficient stock for product: ${product.name}. Available: ${availableOnShelf}, Needed: ${item.quantity}`,
              code: 'INSUFFICIENT_STOCK'
            }
          });
        }

        // Get available batches with detail inventory for FEFO allocation
        const DetailInventory = require('../models/detailInventory');
        const batchesWithInventory = await ProductBatch.find({
          product: item.product
        }).sort({ expiryDate: 1 });

        console.log('📦 Available batches for FEFO:', batchesWithInventory.length);

        // Select batch using FEFO (earliest expiry first) that has stock on shelf
        let selectedBatch = null;
        for (const batch of batchesWithInventory) {
          const detailInv = await DetailInventory.findOne({ batchId: batch._id });
          if (detailInv && detailInv.quantityOnShelf > 0) {
            selectedBatch = batch;
            console.log('✅ Selected batch (FEFO):', batch.batchCode, 'Qty on shelf:', detailInv.quantityOnShelf);
            break;
          }
        }

        if (!selectedBatch) {
          console.log('❌ No batch with shelf stock found for:', product.name);
          return response.status(400).json({
            success: false,
            error: {
              message: `No batch available for product: ${product.name}`,
              code: 'NO_BATCH_AVAILABLE'
            }
          });
        }

        processedItems.push({
          product: item.product,
          batch: selectedBatch._id,
          quantity: item.quantity,
          unitPrice: item.unitPrice || product.unitPrice
        });
      }

      console.log('📝 Starting transaction to update order details...');

      // Delete existing order details and create new ones
      const session = await mongoose.startSession();
      await session.startTransaction();

      try {
        // Delete old details
        const deleteResult = await OrderDetail.deleteMany({ order: order._id }, { session });
        console.log('🗑️ Deleted old details:', deleteResult.deletedCount);

        // Create new details
        const orderDetails = await OrderDetail.insertMany(
          processedItems.map(item => ({
            ...item,
            order: order._id
          })),
          { session }
        );
        console.log('✅ Created new details:', orderDetails.length);

        // Get customer for discount calculation
        const customer = await Customer.findById(order.customer);
        const discountPercentageMap = {
          'guest': 0,
          'retail': 10,
          'wholesale': 15,
          'vip': 20
        };
        const discountPercentage = discountPercentageMap[customer?.customerType?.toLowerCase()] || 0;

        console.log('🎁 Discount percentage:', discountPercentage);

        // Update order discount percentage (total will be auto-calculated in pre-save hook)
        order.discountPercentage = discountPercentage;

        await session.commitTransaction();
        console.log('✅ Transaction committed successfully');
      } catch (error) {
        await session.abortTransaction();
        console.error('❌ Transaction failed:', error);
        throw error;
      } finally {
        session.endSession();
      }
    }

    // Update allowed fields
    if (deliveryType !== undefined) order.deliveryType = deliveryType;

    // Handle both 'address' and 'shippingAddress' for backward compatibility
    if (shippingAddress !== undefined) {
      order.address = shippingAddress;
    } else if (address !== undefined) {
      order.address = address;
    }

    if (shippingFee !== undefined) order.shippingFee = shippingFee;
    if (status !== undefined) order.status = status;
    if (paymentStatus !== undefined) order.paymentStatus = paymentStatus;
    if (notes !== undefined) order.notes = notes;

    // Note: discountPercentage is auto-calculated from customer type and cannot be manually updated
    // Note: total will be auto-calculated in pre-save hook from order details, discount, and shipping fee

    console.log('💾 Saving order (total will be auto-calculated)...');
    await order.save();
    console.log('✅ Order saved successfully with total:', order.total);

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
    console.error('❌ Error in update order:', error);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Error name:', error.name);
    console.error('❌ Error message:', error.message);

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

    // Handle MongoDB errors
    if (error.name === 'CastError') {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Invalid ID format',
          code: 'INVALID_ID',
          details: error.message
        }
      });
    }

    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to update order',
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
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
