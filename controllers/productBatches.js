const productBatchesRouter = require('express').Router();
const ProductBatch = require('../models/productBatch');
const Product = require('../models/product');
const { userExtractor } = require('../utils/auth');

/**
 * ProductBatches Controller - Minimal CRUD Approach
 * 
 * Only 5 basic CRUD endpoints:
 * - GET /api/productBatches - Get all batches with filtering
 * - GET /api/productBatches/:id - Get single batch by ID
 * - POST /api/productBatches - Create new batch
 * - PUT /api/productBatches/:id - Update batch
 * - DELETE /api/productBatches/:id - Delete batch (soft delete)
 * 
 * Additional useful query patterns:
 * - GET /api/productBatches?product=productId - Get batches by product
 * - GET /api/productBatches?status=expired - Get expired batches
 * - GET /api/productBatches?nearExpiry=true - Get batches near expiry
 */

/**
 * GET /api/productBatches
 * Get all product batches with filtering via query parameters
 * 
 * Query parameters:
 * - product: string - Filter by product ID
 * - status: string - Filter by status (active, expired, disposed)
 * - nearExpiry: boolean - Filter batches expiring within 30 days
 * - expired: boolean - Filter expired batches
 * - search: string - Search by batch code
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

    // Filter for expired batches
    if (expired === 'true') {
      filter.$or = [
        { status: 'expired' },
        { expiryDate: { $lt: new Date() }, status: 'active' }
      ];
    }

    // Filter for near expiry batches (expiring within 30 days)
    if (nearExpiry === 'true') {
      const today = new Date();
      const futureDate = new Date();
      futureDate.setDate(today.getDate() + 30);

      filter.expiryDate = {
        $gte: today,
        $lte: futureDate
      };
      filter.status = 'active';
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get batches with product population
    const batches = await ProductBatch.find(filter)
      .populate('product', 'productCode name unit')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ expiryDate: 1, createdAt: -1 });

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
 * GET /api/productBatches/:id
 * Get single product batch by ID with product details
 */
productBatchesRouter.get('/:id', async (request, response) => {
  try {
    const batch = await ProductBatch.findById(request.params.id)
      .populate('product', 'productCode name unit originalPrice');

    if (!batch) {
      return response.status(404).json({
        success: false,
        error: {
          message: 'Product batch not found',
          code: 'BATCH_NOT_FOUND'
        }
      });
    }

    response.json({
      success: true,
      data: batch
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
 * POST /api/productBatches
 * Create new product batch
 * Requires authentication
 */
productBatchesRouter.post('/', userExtractor, async (request, response) => {
  try {
    const {
      product,
      batchCode,
      mfgDate,
      expiryDate,
      quantity,
      status,
      notes
    } = request.body;

    // Validation
    if (!product || !batchCode || quantity === undefined) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Missing required fields',
          code: 'MISSING_REQUIRED_FIELDS',
          details: 'product, batchCode, and quantity are required'
        }
      });
    }

    // Check if product exists
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

    // Check if batch code already exists
    const existingBatch = await ProductBatch.findOne({
      batchCode: batchCode.toUpperCase()
    });

    if (existingBatch) {
      return response.status(409).json({
        success: false,
        error: {
          message: 'Batch code already exists',
          code: 'DUPLICATE_BATCH_CODE'
        }
      });
    }

    // Auto-set status to expired if already expired
    let batchStatus = status || 'active';
    if (expiryDate && new Date(expiryDate) < new Date() && batchStatus === 'active') {
      batchStatus = 'expired';
    }

    // Create batch
    const batch = new ProductBatch({
      product,
      batchCode,
      mfgDate: mfgDate || null,
      expiryDate: expiryDate || null,
      quantity,
      status: batchStatus,
      notes: notes || null
    });

    const savedBatch = await batch.save();

    // Populate product info for response
    await savedBatch.populate('product', 'productCode name unit');

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
 * PUT /api/productBatches/:id
 * Update product batch
 * Requires authentication
 * 
 * Note: This endpoint handles all updates including:
 * - Basic info updates
 * - Status changes (active, expired, disposed)
 * - Quantity adjustments
 */
productBatchesRouter.put('/:id', userExtractor, async (request, response) => {
  try {
    const {
      batchCode,
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

    // Check if new batch code already exists (excluding current batch)
    if (batchCode && batchCode.toUpperCase() !== batch.batchCode) {
      const existingBatch = await ProductBatch.findOne({
        _id: { $ne: batch._id },
        batchCode: batchCode.toUpperCase()
      });

      if (existingBatch) {
        return response.status(409).json({
          success: false,
          error: {
            message: 'Batch code already exists',
            code: 'DUPLICATE_BATCH_CODE'
          }
        });
      }
    }

    // Update fields
    if (batchCode !== undefined) batch.batchCode = batchCode;
    if (mfgDate !== undefined) batch.mfgDate = mfgDate;
    if (expiryDate !== undefined) batch.expiryDate = expiryDate;
    if (quantity !== undefined) batch.quantity = quantity;
    if (status !== undefined) batch.status = status;
    if (notes !== undefined) batch.notes = notes;

    // Auto-update status if expiry date changed
    if (expiryDate && new Date(expiryDate) < new Date() && batch.status === 'active') {
      batch.status = 'expired';
    }

    const updatedBatch = await batch.save();

    // Populate product info for response
    await updatedBatch.populate('product', 'productCode name unit');

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
 * DELETE /api/productBatches/:id
 * Delete product batch (soft delete by setting status to 'disposed')
 * Requires authentication
 * 
 * Note: Cannot delete batch with quantity > 0 unless force=true
 */
productBatchesRouter.delete('/:id', userExtractor, async (request, response) => {
  try {
    const { force } = request.query;

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

    // Check if batch has quantity (unless force delete)
    if (batch.quantity > 0 && force !== 'true') {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Cannot delete batch with remaining quantity',
          code: 'BATCH_HAS_QUANTITY',
          details: `This batch has ${batch.quantity} items remaining. Use force=true to override.`
        }
      });
    }

    // Soft delete - set status to disposed
    batch.status = 'disposed';
    if (!batch.notes) {
      batch.notes = `Deleted on ${new Date().toISOString()}`;
    } else {
      batch.notes += `\nDeleted on ${new Date().toISOString()}`;
    }

    await batch.save();

    response.json({
      success: true,
      message: 'Product batch deleted successfully (soft delete)',
      data: {
        id: batch._id,
        batchCode: batch.batchCode,
        status: batch.status,
        quantity: batch.quantity
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
