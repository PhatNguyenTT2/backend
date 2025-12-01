const detailPurchaseOrdersRouter = require('express').Router();
const DetailPurchaseOrder = require('../models/detailPurchaseOrder');
const PurchaseOrder = require('../models/purchaseOrder');
const Product = require('../models/product');
const ProductBatch = require('../models/productBatch');
const { userExtractor } = require('../utils/auth');

/**
 * DetailPurchaseOrders Controller - Minimal CRUD Approach
 * 
 * Only 5 basic CRUD endpoints:
 * - GET /api/detail-purchase-orders - Get all detail purchase orders with filtering
 * - GET /api/detail-purchase-orders/:id - Get single detail purchase order by ID
 * - POST /api/detail-purchase-orders - Create new detail purchase order
 * - PUT /api/detail-purchase-orders/:id - Update detail purchase order
 * - DELETE /api/detail-purchase-orders/:id - Delete detail purchase order
 * 
 * Methods NOT implemented as endpoints (waiting for frontend request):
 * - getDetailsByPurchaseOrder() - Use GET /api/detail-purchase-orders?purchaseOrder=:id
 * - getDetailsByProduct() - Use GET /api/detail-purchase-orders?product=:id
 * - getDetailsByBatch() - Use GET /api/detail-purchase-orders?batch=:id
 * - calculateTotal() - Auto-calculated in pre-save middleware
 * - updateQuantity() - Use PUT /api/detail-purchase-orders/:id with { quantity: value }
 * - updateUnitPrice() - Use PUT /api/detail-purchase-orders/:id with { unitPrice: value }
 */

/**
 * GET /api/detail-purchase-orders
 * Get all detail purchase orders with filtering via query parameters
 * 
 * Query parameters:
 * - purchaseOrder: ObjectId - Filter by purchase order
 * - product: ObjectId - Filter by product
 * - batch: ObjectId - Filter by batch
 * - minQuantity: number - Filter by minimum quantity
 * - maxQuantity: number - Filter by maximum quantity
 * - minPrice: number - Filter by minimum unit price
 * - maxPrice: number - Filter by maximum unit price
 * - minTotal: number - Filter by minimum total
 * - maxTotal: number - Filter by maximum total
 * - withPurchaseOrder: boolean - Include purchase order details
 * - withProduct: boolean - Include product details
 * - withBatch: boolean - Include batch details
 * - page: number - Page number for pagination
 * - limit: number - Items per page
 */
detailPurchaseOrdersRouter.get('/', async (request, response) => {
  try {
    const {
      purchaseOrder,
      product,
      batch,
      minQuantity,
      maxQuantity,
      minPrice,
      maxPrice,
      minTotal,
      maxTotal,
      withPurchaseOrder,
      withProduct,
      withBatch,
      page = 1,
      limit = 20
    } = request.query;

    // Build filter object
    const filter = {};

    if (purchaseOrder) {
      filter.purchaseOrder = purchaseOrder;
    }

    if (product) {
      filter.product = product;
    }

    if (batch) {
      filter.batch = batch;
    }

    if (minQuantity !== undefined || maxQuantity !== undefined) {
      filter.quantity = {};
      if (minQuantity !== undefined) {
        filter.quantity.$gte = parseInt(minQuantity);
      }
      if (maxQuantity !== undefined) {
        filter.quantity.$lte = parseInt(maxQuantity);
      }
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      filter.unitPrice = {};
      if (minPrice !== undefined) {
        filter.unitPrice.$gte = parseFloat(minPrice);
      }
      if (maxPrice !== undefined) {
        filter.unitPrice.$lte = parseFloat(maxPrice);
      }
    }

    if (minTotal !== undefined || maxTotal !== undefined) {
      filter.total = {};
      if (minTotal !== undefined) {
        filter.total.$gte = parseFloat(minTotal);
      }
      if (maxTotal !== undefined) {
        filter.total.$lte = parseFloat(maxTotal);
      }
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build query with conditional population
    let query = DetailPurchaseOrder.find(filter)
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    // Populate based on query parameters
    if (withPurchaseOrder === 'true') {
      query = query.populate({
        path: 'purchaseOrder',
        select: 'poNumber orderDate expectedDeliveryDate totalPrice status paymentStatus',
        populate: {
          path: 'supplier',
          select: 'supplierCode companyName'
        }
      });
    }

    if (withProduct === 'true') {
      query = query.populate({
        path: 'product',
        select: 'productCode name image category unitPrice',
        populate: {
          path: 'category',
          select: 'categoryCode name'
        }
      });
    }

    if (withBatch === 'true') {
      query = query.populate({
        path: 'batch',
        select: 'batchCode expiryDate mfgDate quantity costPrice unitPrice status'
      });
    }

    const detailPurchaseOrders = await query;

    // Get total count for pagination
    const total = await DetailPurchaseOrder.countDocuments(filter);

    response.json({
      success: true,
      data: {
        detailPurchaseOrders,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get detail purchase orders error:', error);
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to get detail purchase orders',
        details: error.message
      }
    });
  }
});

/**
 * GET /api/detail-purchase-orders/:id
 * Get single detail purchase order by ID with full details
 */
detailPurchaseOrdersRouter.get('/:id', async (request, response) => {
  try {
    const detailPurchaseOrder = await DetailPurchaseOrder.findById(request.params.id)
      .populate({
        path: 'purchaseOrder',
        select: 'poNumber orderDate expectedDeliveryDate totalPrice status paymentStatus notes',
        populate: {
          path: 'supplier',
          select: 'supplierCode companyName phone address paymentTerms'
        }
      })
      .populate({
        path: 'product',
        select: 'productCode name image category unitPrice vendor',
        populate: {
          path: 'category',
          select: 'categoryCode name'
        }
      })
      .populate({
        path: 'batch',
        select: 'batchCode expiryDate mfgDate quantity costPrice unitPrice promotionApplied discountPercentage status'
      });

    if (!detailPurchaseOrder) {
      return response.status(404).json({
        success: false,
        error: {
          message: 'Detail purchase order not found',
          code: 'DETAIL_PURCHASE_ORDER_NOT_FOUND'
        }
      });
    }

    response.json({
      success: true,
      data: { detailPurchaseOrder }
    });
  } catch (error) {
    console.error('Get detail purchase order by ID error:', error);
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to get detail purchase order',
        details: error.message
      }
    });
  }
});

/**
 * POST /api/detail-purchase-orders
 * Create new detail purchase order (add item to purchase order)
 * Requires authentication
 */
detailPurchaseOrdersRouter.post('/', userExtractor, async (request, response) => {
  try {
    const {
      purchaseOrder,
      product,
      batch,
      quantity,
      unitPrice
    } = request.body;

    // Validation
    if (!purchaseOrder || !product || !batch || !quantity || !unitPrice) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Missing required fields',
          code: 'MISSING_REQUIRED_FIELDS',
          details: 'purchaseOrder, product, batch, quantity, and unitPrice are required'
        }
      });
    }

    // Validate purchase order exists and is editable
    const poExists = await PurchaseOrder.findById(purchaseOrder);
    if (!poExists) {
      return response.status(404).json({
        success: false,
        error: {
          message: 'Purchase order not found',
          code: 'PURCHASE_ORDER_NOT_FOUND'
        }
      });
    }

    // Check if purchase order is editable (not received or cancelled)
    if (poExists.status === 'received') {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Cannot add items to a received purchase order',
          code: 'PURCHASE_ORDER_RECEIVED'
        }
      });
    }

    if (poExists.status === 'cancelled') {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Cannot add items to a cancelled purchase order',
          code: 'PURCHASE_ORDER_CANCELLED'
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

    // Validate batch exists and belongs to the product
    const batchExists = await ProductBatch.findById(batch);
    if (!batchExists) {
      return response.status(404).json({
        success: false,
        error: {
          message: 'Product batch not found',
          code: 'BATCH_NOT_FOUND'
        }
      });
    }

    if (batchExists.product.toString() !== product) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Batch does not belong to the specified product',
          code: 'BATCH_PRODUCT_MISMATCH',
          details: {
            batchProduct: batchExists.product,
            requestedProduct: product
          }
        }
      });
    }

    // Check if this product-batch combination already exists in the purchase order
    const existingDetail = await DetailPurchaseOrder.findOne({
      purchaseOrder,
      product,
      batch
    });

    if (existingDetail) {
      return response.status(409).json({
        success: false,
        error: {
          message: 'This product-batch combination already exists in the purchase order',
          code: 'DUPLICATE_DETAIL',
          details: {
            existingDetailId: existingDetail._id,
            existingQuantity: existingDetail.quantity,
            suggestion: 'Please update the existing detail instead'
          }
        }
      });
    }

    // Create detail purchase order
    const detailPurchaseOrder = new DetailPurchaseOrder({
      purchaseOrder,
      product,
      batch,
      quantity,
      unitPrice
    });

    const savedDetail = await detailPurchaseOrder.save();

    // Populate before returning
    await savedDetail.populate('purchaseOrder', 'poNumber orderDate status');
    await savedDetail.populate('product', 'productCode name image');
    await savedDetail.populate('batch', 'batchCode expiryDate');

    response.status(201).json({
      success: true,
      data: savedDetail,
      message: 'Detail purchase order created successfully'
    });
  } catch (error) {
    console.error('Create detail purchase order error:', error);

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
        message: 'Failed to create detail purchase order',
        details: error.message
      }
    });
  }
});

/**
 * PUT /api/detail-purchase-orders/:id
 * Update detail purchase order
 * Requires authentication
 * 
 * Note: This endpoint handles updates including:
 * - Quantity changes (only for pending/approved POs)
 * - Unit price changes (only for pending/approved POs)
 * - Batch assignment (allowed during receiving goods workflow)
 * - Total is auto-calculated
 * - Cannot update quantity/price if purchase order is received or cancelled
 * - Can update batch field during receiving goods process
 */
detailPurchaseOrdersRouter.put('/:id', userExtractor, async (request, response) => {
  try {
    const {
      quantity,
      unitPrice,
      batch
    } = request.body;

    // Find detail purchase order
    const detailPurchaseOrder = await DetailPurchaseOrder.findById(request.params.id)
      .populate('purchaseOrder', 'status');

    if (!detailPurchaseOrder) {
      return response.status(404).json({
        success: false,
        error: {
          message: 'Detail purchase order not found',
          code: 'DETAIL_PURCHASE_ORDER_NOT_FOUND'
        }
      });
    }

    // Check if purchase order is editable (batch can be updated during receiving, so check separately)
    const isReceivingBatch = batch !== undefined && !quantity && !unitPrice;

    if (!isReceivingBatch) {
      // Only enforce status restrictions for non-batch updates
      if (detailPurchaseOrder.purchaseOrder.status === 'received') {
        return response.status(400).json({
          success: false,
          error: {
            message: 'Cannot update items in a received purchase order',
            code: 'PURCHASE_ORDER_RECEIVED'
          }
        });
      }

      if (detailPurchaseOrder.purchaseOrder.status === 'cancelled') {
        return response.status(400).json({
          success: false,
          error: {
            message: 'Cannot update items in a cancelled purchase order',
            code: 'PURCHASE_ORDER_CANCELLED'
          }
        });
      }
    }

    // Update fields
    if (quantity !== undefined) {
      if (quantity < 1) {
        return response.status(400).json({
          success: false,
          error: {
            message: 'Quantity must be at least 1',
            code: 'INVALID_QUANTITY'
          }
        });
      }
      detailPurchaseOrder.quantity = quantity;
    }

    if (unitPrice !== undefined) {
      if (unitPrice < 0) {
        return response.status(400).json({
          success: false,
          error: {
            message: 'Unit price cannot be negative',
            code: 'INVALID_UNIT_PRICE'
          }
        });
      }
      detailPurchaseOrder.unitPrice = unitPrice;
    }

    // ✅ Allow updating batch field (for receiving goods workflow)
    if (batch !== undefined) {
      // Validate batch exists if provided
      if (batch) {
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

        // Validate batch belongs to the same product
        if (batchExists.product.toString() !== detailPurchaseOrder.product.toString()) {
          return response.status(400).json({
            success: false,
            error: {
              message: 'Batch does not belong to this product',
              code: 'BATCH_PRODUCT_MISMATCH'
            }
          });
        }
      }

      detailPurchaseOrder.batch = batch;
    }

    const updatedDetail = await detailPurchaseOrder.save();

    // Populate before returning
    await updatedDetail.populate('purchaseOrder', 'poNumber orderDate status totalPrice');
    await updatedDetail.populate('product', 'productCode name image');
    await updatedDetail.populate('batch', 'batchCode expiryDate');

    response.json({
      success: true,
      data: updatedDetail,
      message: 'Detail purchase order updated successfully'
    });
  } catch (error) {
    console.error('Update detail purchase order error:', error);

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
        message: 'Failed to update detail purchase order',
        details: error.message
      }
    });
  }
});

/**
 * DELETE /api/detail-purchase-orders/:id
 * Delete detail purchase order (remove item from purchase order)
 * Requires authentication
 * 
 * Note: Cannot delete if purchase order is received or cancelled
 */
detailPurchaseOrdersRouter.delete('/:id', userExtractor, async (request, response) => {
  try {
    const detailPurchaseOrder = await DetailPurchaseOrder.findById(request.params.id)
      .populate('purchaseOrder', 'status poNumber');

    if (!detailPurchaseOrder) {
      return response.status(404).json({
        success: false,
        error: {
          message: 'Detail purchase order not found',
          code: 'DETAIL_PURCHASE_ORDER_NOT_FOUND'
        }
      });
    }

    // Check if purchase order is editable
    if (detailPurchaseOrder.purchaseOrder.status === 'received') {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Cannot delete items from a received purchase order',
          code: 'PURCHASE_ORDER_RECEIVED'
        }
      });
    }

    if (detailPurchaseOrder.purchaseOrder.status === 'cancelled') {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Cannot delete items from a cancelled purchase order',
          code: 'PURCHASE_ORDER_CANCELLED'
        }
      });
    }

    // Store info before deletion
    const deletedInfo = {
      id: detailPurchaseOrder._id,
      purchaseOrder: detailPurchaseOrder.purchaseOrder.poNumber,
      product: detailPurchaseOrder.product,
      batch: detailPurchaseOrder.batch,
      quantity: detailPurchaseOrder.quantity,
      total: detailPurchaseOrder.total
    };

    // Delete the detail purchase order
    await DetailPurchaseOrder.findByIdAndDelete(detailPurchaseOrder._id);

    response.json({
      success: true,
      message: 'Detail purchase order deleted successfully',
      data: deletedInfo
    });
  } catch (error) {
    console.error('Delete detail purchase order error:', error);
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to delete detail purchase order',
        details: error.message
      }
    });
  }
});

module.exports = detailPurchaseOrdersRouter;
