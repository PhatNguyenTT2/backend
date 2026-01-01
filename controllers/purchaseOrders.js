const purchaseOrdersRouter = require('express').Router();
const PurchaseOrder = require('../models/purchaseOrder');
const Supplier = require('../models/supplier');
const Employee = require('../models/employee');
const DetailPurchaseOrder = require('../models/detailPurchaseOrder');
const ProductBatch = require('../models/productBatch');
const Product = require('../models/product');
const Inventory = require('../models/inventory');
const DetailInventory = require('../models/detailInventory');
const InventoryMovementBatch = require('../models/inventoryMovementBatch');
const { userExtractor } = require('../utils/auth');

/**
 * Purchase Orders Controller - Minimal CRUD Approach
 * 
 * Only 5 basic CRUD endpoints:
 * - GET /api/purchase-orders - Get all purchase orders with filtering
 * - GET /api/purchase-orders/:id - Get single purchase order by ID
 * - POST /api/purchase-orders - Create new purchase order
 * - PUT /api/purchase-orders/:id - Update purchase order
 * - DELETE /api/purchase-orders/:id - Delete purchase order
 * 
 * Methods NOT implemented as endpoints (waiting for frontend request):
 * - getStatistics() - Purchase order statistics
 * - getOverdueOrders() - Use GET /api/purchase-orders?overdue=true
 * - getOrdersByStatus() - Use GET /api/purchase-orders?status=:status
 * - getOrdersBySupplier() - Use GET /api/purchase-orders?supplier=:supplierId
 * - approve() - Use PUT /api/purchase-orders/:id with { status: 'approved' }
 * - receive() - Use PUT /api/purchase-orders/:id with { status: 'received' }
 * - cancel() - Use PUT /api/purchase-orders/:id with { status: 'cancelled' }
 * - updatePaymentStatus() - Use PUT /api/purchase-orders/:id with { paymentStatus: value }
 */

/**
 * GET /api/purchase-orders
 * Get all purchase orders with filtering via query parameters
 * 
 * Query parameters:
 * - status: string - Filter by status (pending/approved/received/cancelled)
 * - paymentStatus: string - Filter by payment status (unpaid/partial/paid)
 * - supplier: ObjectId - Filter by supplier
 * - createdBy: ObjectId - Filter by employee who created the order
 * - overdue: boolean - Filter overdue orders (expected delivery date passed)
 * - startDate: date - Filter orders after this date
 * - endDate: date - Filter orders before this date
 * - minTotal: number - Filter by minimum total price
 * - maxTotal: number - Filter by maximum total price
 * - search: string - Search by PO number
 * - withDetails: boolean - Include purchase order details
 * - page: number - Page number for pagination
 * - limit: number - Items per page
 */
purchaseOrdersRouter.get('/', async (request, response) => {
  try {
    const {
      status,
      paymentStatus,
      supplier,
      createdBy,
      overdue,
      startDate,
      endDate,
      minTotal,
      maxTotal,
      search,
      withDetails,
      page = 1,
      limit = 20
    } = request.query;

    // Build filter object
    const filter = {};

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

    if (supplier) {
      filter.supplier = supplier;
    }

    if (createdBy) {
      filter.createdBy = createdBy;
    }

    if (search) {
      filter.poNumber = new RegExp(search, 'i');
    }

    // Date range filter
    if (startDate || endDate) {
      filter.orderDate = {};
      if (startDate) {
        filter.orderDate.$gte = new Date(startDate);
      }
      if (endDate) {
        filter.orderDate.$lte = new Date(endDate);
      }
    }

    // Total price filter
    if (minTotal !== undefined || maxTotal !== undefined) {
      filter.totalPrice = {};
      if (minTotal !== undefined) {
        filter.totalPrice.$gte = parseFloat(minTotal);
      }
      if (maxTotal !== undefined) {
        filter.totalPrice.$lte = parseFloat(maxTotal);
      }
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build query
    let query = PurchaseOrder.find(filter)
      .populate('supplier', 'supplierCode companyName phone address paymentTerms')
      .populate('createdBy', 'fullName phone')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ orderDate: -1 });

    // Populate details if requested
    if (withDetails === 'true') {
      query = query.populate({
        path: 'details',
        populate: {
          path: 'product',
          select: 'productCode name image'
        }
      });
    }

    let purchaseOrders = await query;

    // Post-processing filter for overdue orders (requires virtuals)
    if (overdue === 'true') {
      purchaseOrders = purchaseOrders.filter(po => po.isOverdue);
    }

    // Get total count for pagination
    const total = await PurchaseOrder.countDocuments(filter);

    response.json({
      success: true,
      data: {
        purchaseOrders,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: overdue === 'true' ? purchaseOrders.length : total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get purchase orders error:', error);
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to get purchase orders',
        details: error.message
      }
    });
  }
});

/**
 * GET /api/purchase-orders/:id
 * Get single purchase order by ID with details, supplier, and employee info
 */
purchaseOrdersRouter.get('/:id', async (request, response) => {
  try {
    const purchaseOrder = await PurchaseOrder.findById(request.params.id)
      .populate('supplier', 'supplierCode companyName phone address accountNumber paymentTerms creditLimit currentDebt')
      .populate('createdBy', 'employeeCode fullName email phone')
      .populate({
        path: 'details',
        populate: {
          path: 'product',
          select: 'productCode name image category',
          populate: {
            path: 'category',
            select: 'categoryCode name'
          }
        }
      });

    if (!purchaseOrder) {
      return response.status(404).json({
        success: false,
        error: {
          message: 'Purchase order not found',
          code: 'PURCHASE_ORDER_NOT_FOUND'
        }
      });
    }

    // Calculate additional info
    const totalItems = purchaseOrder.details?.reduce((sum, detail) => sum + detail.quantity, 0) || 0;
    const uniqueProducts = purchaseOrder.details?.length || 0;

    response.json({
      success: true,
      data: {
        purchaseOrder,
        summary: {
          totalItems,
          uniqueProducts,
          subtotal: purchaseOrder.subtotal,
          discountAmount: purchaseOrder.discountAmount,
          isOverdue: purchaseOrder.isOverdue,
          daysUntilDelivery: purchaseOrder.daysUntilDelivery
        }
      }
    });
  } catch (error) {
    console.error('Get purchase order by ID error:', error);
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to get purchase order',
        details: error.message
      }
    });
  }
});

/**
 * POST /api/purchase-orders
 * Create new purchase order
 * Requires authentication
 */
purchaseOrdersRouter.post('/', userExtractor, async (request, response) => {
  try {
    const {
      supplier,
      orderDate,
      expectedDeliveryDate,
      shippingFee,
      discountPercentage,
      totalPrice,
      status,
      paymentStatus,
      notes,
      items // Array of {product, quantity, costPrice}
    } = request.body;

    // Validation
    if (!supplier) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Supplier is required',
          code: 'MISSING_SUPPLIER'
        }
      });
    }

    // Validate items array
    if (!items || !Array.isArray(items) || items.length === 0) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Purchase order must have at least one item',
          code: 'MISSING_ITEMS'
        }
      });
    }

    // Validate each item
    for (const item of items) {
      if (!item.product || !item.quantity || !item.costPrice) {
        return response.status(400).json({
          success: false,
          error: {
            message: 'Each item must have product, quantity, and costPrice',
            code: 'INVALID_ITEM'
          }
        });
      }
      if (item.quantity <= 0 || item.costPrice < 0) {
        return response.status(400).json({
          success: false,
          error: {
            message: 'Quantity must be positive and costPrice cannot be negative',
            code: 'INVALID_ITEM_VALUES'
          }
        });
      }
    }

    // Validate supplier exists
    const supplierExists = await Supplier.findById(supplier);
    if (!supplierExists) {
      return response.status(404).json({
        success: false,
        error: {
          message: 'Supplier not found',
          code: 'SUPPLIER_NOT_FOUND'
        }
      });
    }

    // Check if supplier is active
    if (!supplierExists.isActive) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Cannot create purchase order for inactive supplier',
          code: 'INACTIVE_SUPPLIER'
        }
      });
    }

    // Get employee from authenticated user
    let employeeId = null;
    if (request.user && request.user.employeeId) {
      // User has employeeId field (from userAccount)
      employeeId = request.user.employeeId;
    } else if (request.user && request.user.id) {
      // Try to find employee by userAccount
      const employee = await Employee.findOne({ userAccount: request.user.id });
      if (employee) {
        employeeId = employee._id;
      }
    }

    // If no employee found, find a system/admin employee as fallback
    if (!employeeId) {
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
      employeeId = systemEmployee._id;
    }

    // Validate expected delivery date
    if (expectedDeliveryDate) {
      const deliveryDate = new Date(expectedDeliveryDate);
      const orderDateValue = orderDate ? new Date(orderDate) : new Date();

      if (deliveryDate < orderDateValue) {
        return response.status(400).json({
          success: false,
          error: {
            message: 'Expected delivery date must be after order date',
            code: 'INVALID_DELIVERY_DATE'
          }
        });
      }
    }

    // Create purchase order
    const purchaseOrder = new PurchaseOrder({
      supplier,
      orderDate: orderDate || new Date(),
      expectedDeliveryDate: expectedDeliveryDate || null,
      shippingFee: shippingFee || 0,
      discountPercentage: discountPercentage || 0,
      totalPrice: totalPrice || 0,
      status: status || 'pending',
      paymentStatus: paymentStatus || 'unpaid',
      notes: notes || null,
      createdBy: employeeId
    });

    const savedPurchaseOrder = await purchaseOrder.save();

    // Create DetailPurchaseOrder records for each item
    const detailPromises = items.map(item => {
      const detail = new DetailPurchaseOrder({
        purchaseOrder: savedPurchaseOrder._id,
        product: item.product,
        quantity: item.quantity,
        costPrice: item.costPrice,
        batch: null // Will be set when receiving goods
      });
      return detail.save();
    });

    await Promise.all(detailPromises);

    // Populate before returning
    await savedPurchaseOrder.populate('supplier', 'supplierCode companyName phone address');
    await savedPurchaseOrder.populate('createdBy', 'fullName phone');
    await savedPurchaseOrder.populate({
      path: 'details',
      populate: {
        path: 'product',
        select: 'productCode name'
      }
    });

    response.status(201).json({
      success: true,
      data: savedPurchaseOrder,
      message: 'Purchase order created successfully'
    });
  } catch (error) {
    console.error('Create purchase order error:', error);

    // Handle duplicate PO number (should not happen with auto-generation)
    if (error.code === 11000) {
      return response.status(409).json({
        success: false,
        error: {
          message: 'Purchase order number already exists',
          code: 'DUPLICATE_PO_NUMBER',
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
        message: 'Failed to create purchase order',
        details: error.message
      }
    });
  }
});

/**
 * PUT /api/purchase-orders/:id
 * Update purchase order
 * Requires authentication
 * 
 * Note: This endpoint handles all updates including:
 * - Order information updates
 * - Status changes (approve/receive/cancel via status field)
 * - Payment status updates
 * - Price and discount updates
 */
purchaseOrdersRouter.put('/:id', userExtractor, async (request, response) => {
  try {
    const {
      supplier,
      orderDate,
      expectedDeliveryDate,
      shippingFee,
      discountPercentage,
      totalPrice,
      status,
      paymentStatus,
      notes,
      items // Array of {product, quantity, costPrice}
    } = request.body;

    // Find purchase order
    const purchaseOrder = await PurchaseOrder.findById(request.params.id);

    if (!purchaseOrder) {
      return response.status(404).json({
        success: false,
        error: {
          message: 'Purchase order not found',
          code: 'PURCHASE_ORDER_NOT_FOUND'
        }
      });
    }

    // Prevent updates to received or cancelled orders
    if (purchaseOrder.status === 'received') {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Cannot update a received purchase order',
          code: 'ORDER_ALREADY_RECEIVED'
        }
      });
    }

    if (purchaseOrder.status === 'cancelled') {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Cannot update a cancelled purchase order',
          code: 'ORDER_CANCELLED'
        }
      });
    }

    // Validate supplier if changed
    if (supplier && supplier !== purchaseOrder.supplier.toString()) {
      const supplierExists = await Supplier.findById(supplier);
      if (!supplierExists) {
        return response.status(404).json({
          success: false,
          error: {
            message: 'Supplier not found',
            code: 'SUPPLIER_NOT_FOUND'
          }
        });
      }

      if (!supplierExists.isActive) {
        return response.status(400).json({
          success: false,
          error: {
            message: 'Cannot assign inactive supplier to purchase order',
            code: 'INACTIVE_SUPPLIER'
          }
        });
      }
    }

    // Validate expected delivery date if changed
    if (expectedDeliveryDate) {
      const deliveryDate = new Date(expectedDeliveryDate);
      const orderDateValue = orderDate ? new Date(orderDate) : purchaseOrder.orderDate;

      if (deliveryDate < orderDateValue) {
        return response.status(400).json({
          success: false,
          error: {
            message: 'Expected delivery date must be after order date',
            code: 'INVALID_DELIVERY_DATE'
          }
        });
      }
    }

    // Validate status transition
    if (status && status !== purchaseOrder.status) {
      const validTransitions = {
        draft: ['pending', 'cancelled'],
        pending: ['approved', 'cancelled'],
        approved: ['received', 'cancelled'],
        received: [], // Cannot transition from received
        cancelled: [] // Cannot transition from cancelled
      };

      if (!validTransitions[purchaseOrder.status].includes(status)) {
        return response.status(400).json({
          success: false,
          error: {
            message: `Cannot transition from ${purchaseOrder.status} to ${status}`,
            code: 'INVALID_STATUS_TRANSITION',
            details: {
              currentStatus: purchaseOrder.status,
              allowedTransitions: validTransitions[purchaseOrder.status]
            }
          }
        });
      }
    }

    // Track old status for message generation
    const oldStatus = purchaseOrder.status;

    // Update fields
    if (supplier !== undefined) purchaseOrder.supplier = supplier;
    if (orderDate !== undefined) purchaseOrder.orderDate = orderDate;
    if (expectedDeliveryDate !== undefined) purchaseOrder.expectedDeliveryDate = expectedDeliveryDate;
    if (shippingFee !== undefined) purchaseOrder.shippingFee = shippingFee;
    if (discountPercentage !== undefined) purchaseOrder.discountPercentage = discountPercentage;
    if (totalPrice !== undefined) purchaseOrder.totalPrice = totalPrice;
    if (status !== undefined) purchaseOrder.status = status;
    if (paymentStatus !== undefined) purchaseOrder.paymentStatus = paymentStatus;
    if (notes !== undefined) purchaseOrder.notes = notes;

    const updatedPurchaseOrder = await purchaseOrder.save();

    // Update items if provided (only for pending/approved orders)
    if (items && Array.isArray(items)) {
      // Delete existing detail items
      await DetailPurchaseOrder.deleteMany({ purchaseOrder: purchaseOrder._id });

      // Create new detail items
      const detailPromises = items.map(item => {
        const detail = new DetailPurchaseOrder({
          purchaseOrder: purchaseOrder._id,
          product: item.product,
          quantity: item.quantity,
          costPrice: item.costPrice,
          batch: null
        });
        return detail.save();
      });

      await Promise.all(detailPromises);
    }

    // Populate before returning
    await updatedPurchaseOrder.populate('supplier', 'supplierCode companyName phone address');
    await updatedPurchaseOrder.populate('createdBy', 'fullName phone');
    await updatedPurchaseOrder.populate({
      path: 'details',
      populate: {
        path: 'product',
        select: 'productCode name'
      }
    });

    // Generate appropriate success message based on what was updated
    let message = 'Purchase order updated successfully';
    if (status !== undefined && status !== oldStatus) {
      const statusMessages = {
        approved: 'Purchase order approved successfully',
        received: 'Purchase order marked as received successfully',
        cancelled: 'Purchase order cancelled successfully',
        pending: 'Purchase order status updated to pending'
      };
      message = statusMessages[status] || `Purchase order status updated to ${status}`;
    }

    response.json({
      success: true,
      data: updatedPurchaseOrder,
      message
    });
  } catch (error) {
    console.error('Update purchase order error:', error);

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
        message: 'Failed to update purchase order',
        details: error.message
      }
    });
  }
});

/**
 * DELETE /api/purchase-orders/:id
 * Delete purchase order
 * Requires authentication
 * 
 * Note: Can delete pending, cancelled, or received purchase orders
 * Cannot delete approved orders (they must be cancelled first or received)
 * All related DetailPurchaseOrder records will be deleted automatically
 */
purchaseOrdersRouter.delete('/:id', userExtractor, async (request, response) => {
  try {
    const purchaseOrder = await PurchaseOrder.findById(request.params.id);

    if (!purchaseOrder) {
      return response.status(404).json({
        success: false,
        error: {
          message: 'Purchase order not found',
          code: 'PURCHASE_ORDER_NOT_FOUND'
        }
      });
    }

    // Only allow deletion of pending, cancelled, or received orders
    // Note: Approved orders should not be deleted as they may have active processes
    if (purchaseOrder.status === 'approved') {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Cannot delete approved purchase orders',
          code: 'INVALID_STATUS_FOR_DELETION',
          details: {
            currentStatus: purchaseOrder.status,
            message: 'Approved purchase orders cannot be deleted. Please cancel the order first or wait until goods are received.'
          }
        }
      });
    }

    // Check if purchase order has details
    const detailsCount = await DetailPurchaseOrder.countDocuments({
      purchaseOrder: purchaseOrder._id
    });

    // Delete all detail purchase orders first
    if (detailsCount > 0) {
      await DetailPurchaseOrder.deleteMany({ purchaseOrder: purchaseOrder._id });
    }

    // Delete the purchase order
    await PurchaseOrder.findByIdAndDelete(request.params.id);

    response.json({
      success: true,
      message: 'Purchase order deleted successfully',
      data: {
        id: purchaseOrder._id,
        poNumber: purchaseOrder.poNumber,
        status: purchaseOrder.status,
        deletedDetails: detailsCount
      }
    });
  } catch (error) {
    console.error('Delete purchase order error:', error);
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to delete purchase order',
        details: error.message
      }
    });
  }
});

/**
 * POST /api/purchase-orders/:id/receive
 * Receive purchase order goods
 * Requires authentication
 * 
 * Workflow:
 * 1. Validate PO can be received (status must be 'approved')
 * 2. For each item in request body:
 *    - Create ProductBatch with batch info (mfgDate, expiryDate, batchCode, unitPrice)
 *    - Update DetailPurchaseOrder.batch = created batch ID
 *    - Create/Update DetailInventory for the product
 *    - Create InventoryMovementBatch to track stock in
 * 3. Update PurchaseOrder status to 'received'
 * 
 * Request body:
 * {
 *   items: [
 *     {
 *       detailPurchaseOrderId: ObjectId,
 *       actualQuantity: Number (optional, defaults to ordered quantity),
 *       actualCostPrice: Number (optional, defaults to ordered costPrice),
 *       unitPrice: Number (selling price, required),
 *       batchCode: String (required),
 *       mfgDate: Date (optional),
 *       expiryDate: Date (optional)
 *     }
 *   ]
 * }
 */
purchaseOrdersRouter.post('/:id/receive', userExtractor, async (request, response) => {
  const session = await PurchaseOrder.startSession();
  session.startTransaction();

  try {
    const { items } = request.body;
    const purchaseOrderId = request.params.id;

    // Validate request
    if (!items || !Array.isArray(items) || items.length === 0) {
      await session.abortTransaction();
      return response.status(400).json({
        success: false,
        error: {
          message: 'Items array is required',
          code: 'MISSING_ITEMS'
        }
      });
    }

    // Find and validate purchase order
    const purchaseOrder = await PurchaseOrder.findById(purchaseOrderId).session(session);

    if (!purchaseOrder) {
      await session.abortTransaction();
      return response.status(404).json({
        success: false,
        error: {
          message: 'Purchase order not found',
          code: 'PURCHASE_ORDER_NOT_FOUND'
        }
      });
    }

    // Check if PO can be received
    if (!purchaseOrder.canReceive()) {
      await session.abortTransaction();
      return response.status(400).json({
        success: false,
        error: {
          message: `Cannot receive purchase order with status: ${purchaseOrder.status}`,
          code: 'INVALID_STATUS',
          details: {
            currentStatus: purchaseOrder.status,
            requiredStatus: 'approved'
          }
        }
      });
    }

    // Get default inventory (assuming inventory code 'INV001')
    let inventory = await Inventory.findOne({ inventoryCode: 'INV001' }).session(session);

    if (!inventory) {
      // Create default inventory if not exists
      inventory = new Inventory({
        inventoryCode: 'INV001',
        name: 'Main Warehouse',
        location: 'Default Location',
        isActive: true
      });
      await inventory.save({ session });
    }

    const receivedItems = [];

    // Process each item
    for (const item of items) {
      const {
        detailPurchaseOrderId,
        actualQuantity,
        actualCostPrice,
        unitPrice,
        batchCode,
        mfgDate,
        expiryDate
      } = item;

      // Validate required fields
      if (!detailPurchaseOrderId) {
        await session.abortTransaction();
        return response.status(400).json({
          success: false,
          error: {
            message: 'detailPurchaseOrderId is required for each item',
            code: 'MISSING_DETAIL_ID'
          }
        });
      }

      if (!unitPrice || unitPrice <= 0) {
        await session.abortTransaction();
        return response.status(400).json({
          success: false,
          error: {
            message: 'unitPrice (selling price) is required and must be positive',
            code: 'INVALID_UNIT_PRICE'
          }
        });
      }

      if (!batchCode) {
        await session.abortTransaction();
        return response.status(400).json({
          success: false,
          error: {
            message: 'batchCode is required for each item',
            code: 'MISSING_BATCH_CODE'
          }
        });
      }

      // Find DetailPurchaseOrder
      const detailPO = await DetailPurchaseOrder.findById(detailPurchaseOrderId)
        .session(session)
        .populate('product');

      if (!detailPO) {
        await session.abortTransaction();
        return response.status(404).json({
          success: false,
          error: {
            message: `DetailPurchaseOrder not found: ${detailPurchaseOrderId}`,
            code: 'DETAIL_NOT_FOUND'
          }
        });
      }

      // Check if already received
      if (detailPO.batch) {
        await session.abortTransaction();
        return response.status(400).json({
          success: false,
          error: {
            message: `Item already received: ${detailPO.product.name}`,
            code: 'ALREADY_RECEIVED',
            details: {
              productName: detailPO.product.name,
              existingBatchId: detailPO.batch
            }
          }
        });
      }

      // Use actual values or defaults from DetailPurchaseOrder
      const finalQuantity = actualQuantity || detailPO.quantity;
      const finalCostPrice = actualCostPrice || parseFloat(detailPO.costPrice.toString());

      // Validate dates
      if (mfgDate && expiryDate && new Date(expiryDate) <= new Date(mfgDate)) {
        await session.abortTransaction();
        return response.status(400).json({
          success: false,
          error: {
            message: 'Expiry date must be after manufacturing date',
            code: 'INVALID_DATES'
          }
        });
      }

      // Create ProductBatch
      const productBatch = new ProductBatch({
        product: detailPO.product._id,
        costPrice: finalCostPrice,
        unitPrice: unitPrice,
        batchCode: batchCode.toUpperCase(),
        mfgDate: mfgDate || null,
        expiryDate: expiryDate || null,
        quantity: finalQuantity,
        promotionApplied: 'none',
        discountPercentage: 0
      });

      await productBatch.save({ session });

      // Update DetailPurchaseOrder with batch reference
      detailPO.batch = productBatch._id;

      // Update quantity and costPrice if actual values provided
      if (actualQuantity) detailPO.quantity = actualQuantity;
      if (actualCostPrice) detailPO.costPrice = actualCostPrice;

      await detailPO.save({ session });

      // Find or create DetailInventory
      let detailInventory = await DetailInventory.findOne({
        inventory: inventory._id,
        product: detailPO.product._id
      }).session(session);

      if (!detailInventory) {
        detailInventory = new DetailInventory({
          inventory: inventory._id,
          product: detailPO.product._id,
          quantity: 0
        });
        await detailInventory.save({ session });
      }

      // Update DetailInventory quantity
      detailInventory.quantity += finalQuantity;
      await detailInventory.save({ session });

      // Create InventoryMovementBatch to track stock in
      const movement = new InventoryMovementBatch({
        batchId: productBatch._id,
        inventoryDetail: detailInventory._id,
        movementType: 'in',
        quantity: finalQuantity,
        reason: `Received from PO ${purchaseOrder.poNumber}`,
        reference: purchaseOrder._id,
        performedBy: request.user.id
      });

      await movement.save({ session });

      receivedItems.push({
        product: detailPO.product.name,
        batchCode: productBatch.batchCode,
        quantity: finalQuantity,
        costPrice: finalCostPrice,
        unitPrice: unitPrice
      });
    }

    // Update PurchaseOrder status to received
    purchaseOrder.status = 'received';
    purchaseOrder.receivedDate = new Date();
    await purchaseOrder.save({ session });

    await session.commitTransaction();

    // Refresh notifications after receiving new inventory
    const { refreshNotifications } = require('../utils/notificationHelper');
    await refreshNotifications();
    console.log('✅ Notifications refreshed after purchase order received');

    // Populate for response
    await purchaseOrder.populate('supplier', 'supplierCode companyName');
    await purchaseOrder.populate('createdBy', 'fullName phone');
    await purchaseOrder.populate({
      path: 'details',
      populate: [
        { path: 'product', select: 'productCode name' },
        { path: 'batch', select: 'batchCode mfgDate expiryDate unitPrice' }
      ]
    });

    response.json({
      success: true,
      data: {
        purchaseOrder,
        receivedItems,
        summary: {
          totalItems: receivedItems.length,
          receivedDate: purchaseOrder.receivedDate
        }
      },
      message: 'Purchase order received successfully'
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('Receive purchase order error:', error);

    // Handle duplicate batch code
    if (error.code === 11000 && error.message.includes('batchCode')) {
      return response.status(409).json({
        success: false,
        error: {
          message: 'Batch code already exists',
          code: 'DUPLICATE_BATCH_CODE',
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
        message: 'Failed to receive purchase order',
        details: error.message
      }
    });
  } finally {
    session.endSession();
  }
});

module.exports = purchaseOrdersRouter;