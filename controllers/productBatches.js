const productBatchesRouter = require('express').Router();
const ProductBatch = require('../models/productBatch');
const Product = require('../models/product');
const DetailInventory = require('../models/detailInventory');
const { userExtractor } = require('../utils/auth');

/**
 * ProductBatches Controller - Minimal CRUD Approach
 * 
 * Only 5 basic CRUD endpoints:
 * - GET /api/product-batches - Get all batches with filtering
 * - GET /api/product-batches/:id - Get single batch by ID
 * - POST /api/product-batches - Create new batch
 * - PUT /api/product-batches/:id - Update batch
 * - DELETE /api/product-batches/:id - Delete batch
 * 
 * Methods NOT implemented as endpoints (waiting for frontend request):
 * - getExpiredBatches() - Use GET /api/product-batches?status=expired
 * - getNearExpiryBatches() - Use GET /api/product-batches?nearExpiry=true
 * - getBatchesByProduct() - Use GET /api/product-batches?product=:productId
 * - updateBatchQuantity() - Use PUT /api/product-batches/:id with { quantity: value }
 */

/**
 * GET /api/product-batches
 * Get all product batches with filtering via query parameters
 * 
 * Query parameters:
 * - product: ObjectId - Filter by product
 * - status: string - Filter by status (active/expired)
 * - nearExpiry: boolean - Filter batches expiring within 30 days
 * - expired: boolean - Filter expired batches
 * - search: string - Search by batch code
 * - minQuantity: number - Filter by minimum quantity
 * - maxQuantity: number - Filter by maximum quantity
 * - promotionApplied: string - Filter by promotion type
 * - page: number - Page number for pagination
 * - limit: number - Items per page
 */
productBatchesRouter.get('/', async (request, response) => {
  try {
    const {
      product,
      status,
      nearExpiry,
      expired,
      search,
      minQuantity,
      maxQuantity,
      promotionApplied,
      withInventory,
      page = 1,
      limit = 20
    } = request.query;

    // Build filter object
    const filter = {};

    if (product) {
      filter.product = product;
    }

    if (status) {
      filter.status = status;
    }

    if (search) {
      filter.batchCode = new RegExp(search, 'i');
    }

    if (promotionApplied) {
      filter.promotionApplied = promotionApplied;
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

    // Filter for expired batches
    if (expired === 'true') {
      filter.expiryDate = { $lt: new Date() };
    }

    // Filter for near expiry batches (30 days)
    if (nearExpiry === 'true') {
      const today = new Date();
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(today.getDate() + 30);

      filter.expiryDate = {
        $gt: today,
        $lte: thirtyDaysFromNow
      };
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build query
    const batches = await ProductBatch.find(filter)
      .populate('product', 'productCode name image category unitPrice')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ expiryDate: 1, createdAt: -1 });

    // If withInventory is requested, populate detailInventory for each batch
    if (withInventory === 'true') {
      console.log('📦 Fetching inventory details for', batches.length, 'batches');
      for (const batch of batches) {
        const detailInventory = await DetailInventory.findOne({ batchId: batch._id });
        batch._doc.detailInventory = detailInventory;
        console.log(`  Batch ${batch.batchCode}:`, {
          quantityOnShelf: detailInventory?.quantityOnShelf,
          quantityOnHand: detailInventory?.quantityOnHand
        });
      }
    }

    // Get total count for pagination
    const total = await ProductBatch.countDocuments(filter);

    response.json({
      success: true,
      data: {
        batches,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get product batches error:', error);
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to get product batches',
        details: error.message
      }
    });
  }
});

/**
 * GET /api/product-batches/:id
 * Get single product batch by ID with product and inventory details
 */
productBatchesRouter.get('/:id', async (request, response) => {
  try {
    const batch = await ProductBatch.findById(request.params.id)
      .populate({
        path: 'product',
        select: 'productCode name image category unitPrice vendor',
        populate: {
          path: 'category',
          select: 'categoryCode name'
        }
      });

    if (!batch) {
      return response.status(404).json({
        success: false,
        error: {
          message: 'Product batch not found',
          code: 'BATCH_NOT_FOUND'
        }
      });
    }

    // Get detail inventory for this batch
    const detailInventory = await DetailInventory.findOne({
      productBatch: batch._id
    });

    response.json({
      success: true,
      data: {
        batch,
        detailInventory
      }
    });
  } catch (error) {
    console.error('Get product batch by ID error:', error);
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to get product batch',
        details: error.message
      }
    });
  }
});

/**
 * POST /api/product-batches
 * Create new product batch
 * Requires authentication
 */
productBatchesRouter.post('/', userExtractor, async (request, response) => {
  try {
    const {
      product,
      costPrice,
      unitPrice,
      promotionApplied,
      discountPercentage,
      mfgDate,
      expiryDate,
      quantity,
      status,
      notes
    } = request.body;

    console.log('📦 Creating product batch with data:', {
      product,
      costPrice,
      unitPrice,
      quantity,
      mfgDate,
      expiryDate,
      status,
      promotionApplied
    });

    // Validation
    if (!product || !costPrice || !unitPrice || quantity === undefined) {
      console.error('❌ Missing required fields:', { product, costPrice, unitPrice, quantity });
      return response.status(400).json({
        success: false,
        error: {
          message: 'Missing required fields',
          code: 'MISSING_REQUIRED_FIELDS',
          details: 'product, costPrice, unitPrice, and quantity are required'
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

    // Validate dates
    if (mfgDate && expiryDate) {
      const mfg = new Date(mfgDate);
      const exp = new Date(expiryDate);
      if (mfg >= exp) {
        return response.status(400).json({
          success: false,
          error: {
            message: 'Manufacturing date must be before expiry date',
            code: 'INVALID_DATES'
          }
        });
      }
    }

    // Validate discount percentage if promotion is applied
    if (promotionApplied === 'discount' && (!discountPercentage || discountPercentage <= 0)) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Discount percentage is required when promotion is applied',
          code: 'MISSING_DISCOUNT'
        }
      });
    }

    // Create product batch
    const batch = new ProductBatch({
      product,
      costPrice,
      unitPrice,
      promotionApplied: promotionApplied || 'none',
      discountPercentage: discountPercentage || 0,
      mfgDate: mfgDate || null,
      expiryDate: expiryDate || null,
      quantity,
      status: status || 'active',
      notes: notes || null
    });

    const savedBatch = await batch.save();

    // Populate product before returning
    await savedBatch.populate('product', 'productCode name image category unitPrice');

    response.status(201).json({
      success: true,
      data: savedBatch,
      message: 'Product batch created successfully'
    });
  } catch (error) {
    console.error('Create product batch error:', error);

    // Handle duplicate batch code
    if (error.code === 11000) {
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
        message: 'Failed to create product batch',
        details: error.message
      }
    });
  }
});

/**
 * PUT /api/product-batches/:id
 * Update product batch
 * Requires authentication
 * 
 * Note: This endpoint handles all updates including:
 * - Price updates
 * - Quantity adjustments
 * - Status changes (active/expired)
 * - Promotion updates
 */
productBatchesRouter.put('/:id', userExtractor, async (request, response) => {
  try {
    const {
      costPrice,
      unitPrice,
      promotionApplied,
      discountPercentage,
      mfgDate,
      expiryDate,
      quantity,
      status,
      notes
    } = request.body;

    // Find batch
    const batch = await ProductBatch.findById(request.params.id);

    if (!batch) {
      return response.status(404).json({
        success: false,
        error: {
          message: 'Product batch not found',
          code: 'BATCH_NOT_FOUND'
        }
      });
    }

    // Validate dates if provided
    if (mfgDate !== undefined || expiryDate !== undefined) {
      const mfg = new Date(mfgDate !== undefined ? mfgDate : batch.mfgDate);
      const exp = new Date(expiryDate !== undefined ? expiryDate : batch.expiryDate);

      if (mfg && exp && mfg >= exp) {
        return response.status(400).json({
          success: false,
          error: {
            message: 'Manufacturing date must be before expiry date',
            code: 'INVALID_DATES'
          }
        });
      }
    }

    // Validate discount percentage if promotion is discount
    const newPromotion = promotionApplied !== undefined ? promotionApplied : batch.promotionApplied;
    const newDiscount = discountPercentage !== undefined ? discountPercentage : batch.discountPercentage;

    if (newPromotion === 'discount' && newDiscount <= 0) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Discount percentage must be greater than 0 when promotion is discount',
          code: 'INVALID_DISCOUNT'
        }
      });
    }

    // Check if quantity is being reduced and validate against inventory
    if (quantity !== undefined && quantity < batch.quantity) {
      const detailInventory = await DetailInventory.findOne({
        productBatch: batch._id
      });

      if (detailInventory) {
        const quantityDifference = batch.quantity - quantity;
        const availableToReduce = batch.quantity - detailInventory.quantityOnHand;

        if (quantityDifference > availableToReduce) {
          return response.status(400).json({
            success: false,
            error: {
              message: 'Cannot reduce quantity below inventory on hand',
              code: 'QUANTITY_BELOW_INVENTORY',
              details: `Current inventory on hand: ${detailInventory.quantityOnHand}, requested quantity: ${quantity}`
            }
          });
        }
      }
    }

    // Update fields
    if (costPrice !== undefined) batch.costPrice = costPrice;
    if (unitPrice !== undefined) batch.unitPrice = unitPrice;
    if (promotionApplied !== undefined) batch.promotionApplied = promotionApplied;
    if (discountPercentage !== undefined) batch.discountPercentage = discountPercentage;
    if (mfgDate !== undefined) batch.mfgDate = mfgDate;
    if (expiryDate !== undefined) batch.expiryDate = expiryDate;
    if (quantity !== undefined) batch.quantity = quantity;
    if (status !== undefined) batch.status = status;
    if (notes !== undefined) batch.notes = notes;

    const updatedBatch = await batch.save();

    // Populate product before returning
    await updatedBatch.populate('product', 'productCode name image category unitPrice');

    // Check and emit real-time notifications if expiry-related changes
    if (expiryDate !== undefined) {
      const notificationEmitter = require('../services/notificationEmitter');
      const detailInventory = await DetailInventory.findOne({ batchId: updatedBatch._id });

      if (detailInventory && updatedBatch.expiryDate) {
        const now = new Date();
        const expiry = new Date(updatedBatch.expiryDate);
        const daysUntilExpiry = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
        const isExpired = expiry <= now;
        const isExpiringSoon = expiry > now && daysUntilExpiry <= 30;

        // Emit individual notification for toast (will be replaced by refresh, but toast will show)
        // Priority: Emit only ONE notification per batch
        // 1. Critical: Expired on shelf (highest priority)
        if (isExpired && detailInventory.quantityOnShelf > 0) {
          notificationEmitter.emitInventoryExpired({
            detailInventoryId: detailInventory._id,
            batchCode: updatedBatch.batchCode,
            productName: updatedBatch.product?.name || 'Unknown Product',
            quantity: detailInventory.quantityOnShelf,
            expiryDate: updatedBatch.expiryDate
          });
          console.log('🔔 Emitted expired on shelf notification for batch:', updatedBatch.batchCode);
        }
        // 2. High: Expired in warehouse (only if NOT on shelf)
        else if (isExpired && detailInventory.quantityOnHand > 0) {
          notificationEmitter.emitExpiredInWarehouse({
            detailInventoryId: detailInventory._id,
            batchCode: updatedBatch.batchCode,
            productName: updatedBatch.product?.name || 'Unknown Product',
            quantity: detailInventory.quantityOnHand,
            expiryDate: updatedBatch.expiryDate
          });
          console.log('🔔 Emitted warehouse expired notification for batch:', updatedBatch.batchCode);
        }
        // 3. Warning: Expiring soon (only if NOT expired)
        else if (isExpiringSoon && (detailInventory.quantityOnShelf > 0 || detailInventory.quantityOnHand > 0)) {
          notificationEmitter.emitInventoryExpiring({
            detailInventoryId: detailInventory._id,
            batchCode: updatedBatch.batchCode,
            productName: updatedBatch.product?.name || 'Unknown Product',
            quantity: detailInventory.quantityOnShelf + detailInventory.quantityOnHand,
            expiryDate: updatedBatch.expiryDate,
            daysUntilExpiry
          });
          console.log('🔔 Emitted expiring soon notification for batch:', updatedBatch.batchCode);
        }
      }

      // After any expiry-related update, refresh ALL notifications for all clients
      // This ensures removed/resolved notifications are cleared from UI
      // Individual notification emitted above will show toast, refresh will sync the list
      console.log('🔄 Refreshing all notifications after batch update...');
      const allNotifications = await notificationEmitter.getAllNotifications();
      const io = request.app.get('io');
      if (io) {
        io.emit('notification:refresh', allNotifications);
        console.log('✅ Broadcast notification refresh to all clients:', allNotifications.length);
      }
    }

    response.json({
      success: true,
      data: updatedBatch,
      message: 'Product batch updated successfully'
    });
  } catch (error) {
    console.error('Update product batch error:', error);

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
        message: 'Failed to update product batch',
        details: error.message
      }
    });
  }
});

/**
 * DELETE /api/product-batches/:id
 * Delete product batch
 * Requires authentication
 * 
 * Note: Cannot delete batch if it has inventory or is referenced in orders
 */
productBatchesRouter.delete('/:id', userExtractor, async (request, response) => {
  try {
    const batch = await ProductBatch.findById(request.params.id);

    if (!batch) {
      return response.status(404).json({
        success: false,
        error: {
          message: 'Product batch not found',
          code: 'BATCH_NOT_FOUND'
        }
      });
    }

    // Check if batch has inventory
    const detailInventory = await DetailInventory.findOne({
      productBatch: batch._id
    });

    if (detailInventory && detailInventory.quantityOnHand > 0) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Cannot delete batch with inventory',
          code: 'BATCH_HAS_INVENTORY',
          details: `This batch has ${detailInventory.quantityOnHand} unit(s) in inventory. Please clear inventory first.`
        }
      });
    }

    // Check if batch has any quantity remaining
    if (batch.quantity > 0) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Cannot delete batch with remaining quantity',
          code: 'BATCH_HAS_QUANTITY',
          details: `This batch has ${batch.quantity} unit(s) remaining. Please update quantity to 0 first.`
        }
      });
    }

    // Delete the batch
    await ProductBatch.findByIdAndDelete(batch._id);

    response.json({
      success: true,
      message: 'Product batch deleted successfully',
      data: {
        id: batch._id,
        batchCode: batch.batchCode,
        product: batch.product
      }
    });
  } catch (error) {
    console.error('Delete product batch error:', error);
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to delete product batch',
        details: error.message
      }
    });
  }
});

module.exports = productBatchesRouter;
