const ordersRouter = require('express').Router();
const Order = require('../models/order');
const OrderDetail = require('../models/orderDetail');
const Customer = require('../models/customer');
const Employee = require('../models/employee');
const Product = require('../models/product');
const ProductBatch = require('../models/productBatch');
const CustomerDiscountSettings = require('../models/customerDiscountSettings');
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
 * Supports virtual guest customer (auto-creates guest customer)
 * 
 * Request body:
 * {
 *   customer: ObjectId | 'virtual-guest' | null (required - will auto-create guest if virtual/null),
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
    if (!orderItems || !Array.isArray(orderItems) || orderItems.length === 0) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Order must have at least one item',
          code: 'MISSING_ORDER_ITEMS'
        }
      });
    }

    // ⭐ Handle virtual guest customer
    let customerId = customer;
    let customerDoc = null;

    // If customer is virtual-guest or null, find or create ONE shared virtual guest
    if (!customer || customer === 'virtual-guest') {
      console.log('[Order] Looking for virtual guest customer (shared for all walk-in orders)...');

      try {
        // Try to find existing virtual guest customer (shared instance)
        customerDoc = await Customer.findOne({
          email: 'virtual.guest@pos.system',
          customerType: 'guest'
        });

        // If not found, create it ONCE
        if (!customerDoc) {
          console.log('[Order] Virtual guest not found, creating shared instance...');
          customerDoc = await Customer.create({
            fullName: 'Virtual Guest',
            email: 'virtual.guest@pos.system',
            phone: '0000000000',
            gender: 'other',
            customerType: 'guest',
            totalSpent: 0,
            isActive: true
          });
          console.log(`[Order] ✅ Created shared virtual guest: ${customerDoc.customerCode}`);
        } else {
          console.log(`[Order] ✅ Using existing virtual guest: ${customerDoc.customerCode}`);
        }

        customerId = customerDoc._id;

      } catch (error) {
        console.error('[Order] ❌ Failed to get/create virtual guest customer:', error);
        return response.status(500).json({
          success: false,
          error: {
            message: 'Failed to get virtual guest customer',
            details: error.message,
            code: 'GUEST_CUSTOMER_ERROR'
          }
        });
      }
    } else {
      // Validate customer exists and get discount percentage based on customer type
      customerDoc = await Customer.findById(customer);
      if (!customerDoc) {
        return response.status(404).json({
          success: false,
          error: {
            message: 'Customer not found',
            code: 'CUSTOMER_NOT_FOUND'
          }
        });
      }
    }

    // Auto-calculate discount percentage based on customer type
    // Get discount rates from CustomerDiscountSettings (versioned with audit trail)
    const customerDiscounts = await CustomerDiscountSettings.getActiveDiscounts();
    const discountPercentageMap = {
      'guest': 0,
      'retail': customerDiscounts.retail || 10,
      'wholesale': customerDiscounts.wholesale || 15,
      'vip': customerDiscounts.vip || 20
    };
    const autoDiscountPercentage = discountPercentageMap[customerDoc.customerType?.toLowerCase()] || 0;

    console.log('📊 Customer discount rates from settings:', customerDiscounts);
    console.log(`💰 Customer type: ${customerDoc.customerType}, Discount: ${autoDiscountPercentage}%`);

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

    // Validate items and select batches (manual for fresh, FEFO for others)
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
      const product = await Product.findById(item.product).populate('category');
      if (!product) {
        return response.status(404).json({
          success: false,
          error: {
            message: `Product not found: ${item.product}`,
            code: 'PRODUCT_NOT_FOUND'
          }
        });
      }

      // Check if batch is manually provided (for fresh products)
      if (item.batch) {
        console.log(`🌿 Fresh product: Using manually selected batch for ${product.name}`);

        // Validate batch exists and has sufficient quantity
        const batch = await ProductBatch.findById(item.batch);
        if (!batch) {
          return response.status(404).json({
            success: false,
            error: {
              message: `Batch not found: ${item.batch}`,
              code: 'BATCH_NOT_FOUND'
            }
          });
        }

        // Get DetailInventory for this batch to check availability
        const DetailInventory = require('../models/detailInventory');
        const detailInventory = await DetailInventory.findOne({ batchId: item.batch });

        if (!detailInventory || detailInventory.quantityOnShelf < item.quantity) {
          return response.status(400).json({
            success: false,
            error: {
              message: `Insufficient stock in selected batch: ${batch.batchCode}`,
              code: 'INSUFFICIENT_BATCH_STOCK',
              details: {
                batchCode: batch.batchCode,
                available: detailInventory?.quantityOnShelf || 0,
                requested: item.quantity
              }
            }
          });
        }

        // Use manually selected batch
        processedItems.push({
          product: item.product,
          batch: item.batch,
          quantity: item.quantity,
          unitPrice: item.unitPrice || batch.unitPrice || product.unitPrice,
          notes: item.notes
        });

        console.log(`✅ Manual batch selection: ${batch.batchCode} (${item.quantity} units)`);
      } else {
        // Auto-allocate batches using FEFO for non-fresh products
        console.log(`📦 Regular product: Using FEFO auto-allocation for ${product.name}`);

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
        customer: customerId, // ⭐ Use customerId (may be newly created guest)
        createdBy: validatedCreatedBy,
        orderDate: orderDate || Date.now(),
        deliveryType: deliveryType || 'delivery',
        address: shippingAddress || address,
        shippingFee: shippingFee || 0,
        discountPercentage: autoDiscountPercentage,
        status: status || 'draft', // Allow custom status (e.g., 'draft' for hold orders)
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
 * Helper: Get customer discount percentage from CustomerDiscountSettings
 * @param {String} customerType - Customer type (guest/retail/wholesale/vip)
 * @returns {Promise<Number>} Discount percentage
 */
async function getCustomerDiscountPercentage(customerType) {
  try {
    const customerDiscounts = await CustomerDiscountSettings.getActiveDiscounts();
    const discountPercentageMap = {
      'guest': 0,
      'retail': customerDiscounts.retail || 10,
      'wholesale': customerDiscounts.wholesale || 15,
      'vip': customerDiscounts.vip || 20
    };
    return discountPercentageMap[customerType?.toLowerCase()] || 0;
  } catch (error) {
    console.error('⚠️ Error getting customer discount, using defaults:', error);
    // Fallback to defaults if error
    const defaults = { guest: 0, retail: 10, wholesale: 15, vip: 20 };
    return defaults[customerType?.toLowerCase()] || 0;
  }
}

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

        // Get customer for discount calculation from CustomerDiscountSettings
        const customer = await Customer.findById(order.customer);
        const discountPercentage = await getCustomerDiscountPercentage(customer?.customerType);

        console.log('🎁 Discount percentage from settings:', discountPercentage, `(${customer?.customerType})`);

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

    // ⭐ CRITICAL: Store original status before update to trigger middleware
    if (status !== undefined && status !== order.status) {
      order._originalStatus = order.status; // Store current status as original
      order.status = status;
    }

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
 * Hard delete allowed for draft and pending orders with no payment
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

    // Allow hard delete for draft or pending orders with pending payment
    if (hardDelete === 'true' && ['draft', 'pending'].includes(order.status) && order.paymentStatus === 'pending') {
      // Hard delete: remove order and its details
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        await OrderDetail.deleteMany({ order: order._id }, { session });
        await Order.findByIdAndDelete(request.params.id, { session });

        await session.commitTransaction();

        console.log(`✅ Hard deleted order ${order.orderNumber} (status: ${order.status})`);

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
      // ⭐ CRITICAL: Store original status before update to trigger middleware
      order._originalStatus = order.status;
      order.status = 'cancelled';
      await order.save();

      console.log(`✅ Soft deleted (cancelled) order ${order.orderNumber}`);

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

/**
 * DELETE /api/orders/bulk/draft
 * Delete all draft orders (hard delete)
 * Used to clean up held orders from POS
 */
ordersRouter.delete('/bulk/draft', async (request, response) => {
  try {
    console.log('📋 Bulk deleting all draft orders...');

    // Find all draft orders
    const draftOrders = await Order.find({ status: 'draft' });

    if (draftOrders.length === 0) {
      return response.json({
        success: true,
        message: 'No draft orders to delete',
        data: {
          deletedCount: 0
        }
      });
    }

    console.log(`Found ${draftOrders.length} draft order(s) to delete`);

    // Hard delete all draft orders and their details
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const orderIds = draftOrders.map(o => o._id);

      // Delete all order details for these orders
      const detailsResult = await OrderDetail.deleteMany(
        { order: { $in: orderIds } },
        { session }
      );

      // Delete all draft orders
      const ordersResult = await Order.deleteMany(
        { status: 'draft' },
        { session }
      );

      await session.commitTransaction();

      console.log(`✅ Deleted ${ordersResult.deletedCount} draft order(s) and ${detailsResult.deletedCount} order detail(s)`);

      response.json({
        success: true,
        message: `Successfully deleted ${ordersResult.deletedCount} draft order(s)`,
        data: {
          deletedCount: ordersResult.deletedCount,
          deletedDetailsCount: detailsResult.deletedCount,
          orderNumbers: draftOrders.map(o => o.orderNumber)
        }
      });
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    console.error('❌ Error in bulk delete draft orders:', error);
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to delete draft orders',
        details: error.message
      }
    });
  }
});

/**
 * POST /api/orders/:id/refund
 * Refund delivered order (restore inventory to shelf)
 * 
 * Request body:
 * {
 *   reason: string (optional - reason for refund)
 * }
 * 
 * Note: Order model middleware will automatically:
 * - Restore inventory to shelf (quantityOnShelf)
 * - Create inventory movement logs (type: 'in')
 * - Update parent inventory statistics
 */
ordersRouter.post('/:id/refund', async (request, response) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { reason } = request.body;

    console.log('\n========== REFUND ORDER ==========');
    console.log(`📝 Order ID: ${request.params.id}`);
    console.log(`📄 Reason: ${reason || 'N/A'}`);
    console.log('==================================\n');

    // Step 1: Get order with full details
    const order = await Order.findById(request.params.id)
      .populate('customer', 'customerCode fullName phone')
      .populate('createdBy', 'fullName')
      .populate({
        path: 'details',
        populate: [
          { path: 'product', select: 'productCode name' },
          { path: 'batch', select: 'batchCode status' }
        ]
      })
      .session(session);

    if (!order) {
      await session.abortTransaction();
      return response.status(404).json({
        success: false,
        error: {
          message: 'Order not found',
          code: 'ORDER_NOT_FOUND'
        }
      });
    }

    console.log(`📦 Order: ${order.orderNumber}`);
    console.log(`   Status: ${order.status}`);
    console.log(`   Payment: ${order.paymentStatus}`);
    console.log(`   Total: ${order.total}`);

    // Step 2: Validate refund conditions
    if (order.status !== 'delivered') {
      await session.abortTransaction();
      return response.status(400).json({
        success: false,
        error: {
          message: 'Can only refund delivered orders',
          code: 'INVALID_ORDER_STATUS',
          details: { currentStatus: order.status }
        }
      });
    }

    if (order.paymentStatus !== 'paid') {
      await session.abortTransaction();
      return response.status(400).json({
        success: false,
        error: {
          message: 'Can only refund paid orders',
          code: 'INVALID_PAYMENT_STATUS',
          details: { currentPaymentStatus: order.paymentStatus }
        }
      });
    }

    if (order.status === 'refunded') {
      await session.abortTransaction();
      return response.status(400).json({
        success: false,
        error: {
          message: 'Order has already been refunded',
          code: 'ALREADY_REFUNDED'
        }
      });
    }

    console.log('✅ Refund conditions validated');

    // Step 3: Validate order has details with batch info
    if (!order.details || order.details.length === 0) {
      await session.abortTransaction();
      return response.status(400).json({
        success: false,
        error: {
          message: 'Order has no details to refund',
          code: 'NO_ORDER_DETAILS'
        }
      });
    }

    // Check all details have batch info
    const missingBatch = order.details.find(d => !d.batch);
    if (missingBatch) {
      await session.abortTransaction();
      return response.status(400).json({
        success: false,
        error: {
          message: `Order detail missing batch info: ${missingBatch.product?.name}`,
          code: 'MISSING_BATCH_INFO'
        }
      });
    }

    console.log(`📋 Order has ${order.details.length} detail line(s) to refund`);

    // Step 4: Update order status (middleware will handle inventory restoration)
    // Store original status for middleware
    order._originalStatus = order.status;
    order.status = 'refunded';
    order.paymentStatus = 'refunded';

    // Save order (triggers middleware that restores inventory)
    await order.save({ session });

    console.log('✅ Order status updated: delivered → refunded');
    console.log('✅ Inventory restored by middleware (CASE 7)');

    // Step 5: Update payment status
    const Payment = require('../models/payment');
    const payment = await Payment.findOneAndUpdate(
      {
        referenceType: 'Order',
        referenceId: order._id,
        status: { $in: ['completed', 'paid'] }
      },
      {
        status: 'refunded',
        notes: reason ? `Refunded: ${reason}` : 'Order refunded'
      },
      { session, new: true }
    );

    if (payment) {
      console.log(`✅ Payment status updated: ${payment.paymentNumber} → refunded`);
    } else {
      console.warn(`⚠️ No payment found for order ${order.orderNumber}`);
    }

    // Step 6: Commit transaction
    await session.commitTransaction();

    console.log('\n========== REFUND COMPLETE ==========');
    console.log(`✅ Order ${order.orderNumber} refunded successfully`);
    console.log(`   Refund amount: ${order.total}`);
    console.log(`   Inventory restored: ${order.details.length} batch(es)`);
    console.log('=====================================\n');

    // Populate and return
    await order.populate([
      { path: 'customer', select: 'customerCode fullName phone' },
      { path: 'createdBy', select: 'fullName' },
      {
        path: 'details',
        populate: [
          { path: 'product', select: 'productCode name' },
          { path: 'batch', select: 'batchCode expiryDate' }
        ]
      }
    ]);

    response.json({
      success: true,
      data: { order },
      message: `Order refunded successfully. Inventory restored: ${order.details.length} batch(es)`
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('\n========== REFUND ERROR ==========');
    console.error('❌ Error:', error.message);
    console.error('==================================\n');

    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to refund order',
        code: 'REFUND_FAILED',
        details: error.message
      }
    });
  } finally {
    session.endSession();
  }
});

module.exports = ordersRouter;
