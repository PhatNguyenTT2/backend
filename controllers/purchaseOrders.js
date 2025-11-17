const purchaseOrdersRouter = require('express').Router();
const PurchaseOrder = require('../models/purchaseOrder');
const Supplier = require('../models/supplier');
const Employee = require('../models/employee');
const DetailPurchaseOrder = require('../models/detailPurchaseOrder');
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
      filter.status = status;
    }

    if (paymentStatus) {
      filter.paymentStatus = paymentStatus;
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
      .populate('createdBy', 'employeeCode firstName lastName email')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ orderDate: -1 });

    // Populate details if requested
    if (withDetails === 'true') {
      query = query.populate({
        path: 'details',
        populate: {
          path: 'product',
          select: 'productCode name image unitPrice'
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
      .populate('createdBy', 'employeeCode firstName lastName email phone')
      .populate({
        path: 'details',
        populate: {
          path: 'product',
          select: 'productCode name image category unitPrice',
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
      notes
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
      createdBy: request.user.id
    });

    const savedPurchaseOrder = await purchaseOrder.save();

    // Populate before returning
    await savedPurchaseOrder.populate('supplier', 'supplierCode companyName phone address');
    await savedPurchaseOrder.populate('createdBy', 'employeeCode firstName lastName');

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
      notes
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

    // Populate before returning
    await updatedPurchaseOrder.populate('supplier', 'supplierCode companyName phone address');
    await updatedPurchaseOrder.populate('createdBy', 'employeeCode firstName lastName');

    response.json({
      success: true,
      data: updatedPurchaseOrder,
      message: 'Purchase order updated successfully'
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
 * Note: Can only delete pending purchase orders with no details
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

    // Only allow deletion of pending orders
    if (purchaseOrder.status !== 'pending') {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Can only delete pending purchase orders',
          code: 'INVALID_STATUS_FOR_DELETION',
          details: {
            currentStatus: purchaseOrder.status,
            message: 'To remove non-pending orders, cancel them instead'
          }
        }
      });
    }

    // Check if purchase order has details
    const detailsCount = await DetailPurchaseOrder.countDocuments({
      purchaseOrder: purchaseOrder._id
    });

    if (detailsCount > 0) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Cannot delete purchase order with order details',
          code: 'ORDER_HAS_DETAILS',
          details: {
            detailsCount,
            message: 'Please remove all order details before deleting, or cancel the order instead'
          }
        }
      });
    }

    // Delete the purchase order
    await PurchaseOrder.findByIdAndDelete(request.params.id);

    response.json({
      success: true,
      message: 'Purchase order deleted successfully',
      data: {
        id: purchaseOrder._id,
        poNumber: purchaseOrder.poNumber
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

module.exports = purchaseOrdersRouter;
