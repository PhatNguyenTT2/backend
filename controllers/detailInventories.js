const detailInventoriesRouter = require('express').Router();
const DetailInventory = require('../models/detailInventory');
const ProductBatch = require('../models/productBatch');
const Product = require('../models/product');
const { userExtractor } = require('../utils/auth');

/**
 * DetailInventories Controller - Minimal CRUD Approach
 * 
 * Only 5 basic CRUD endpoints:
 * - GET /api/detail-inventories - Get all detail inventories with filtering
 * - GET /api/detail-inventories/:id - Get single detail inventory by ID
 * - POST /api/detail-inventories - Create new detail inventory
 * - PUT /api/detail-inventories/:id - Update detail inventory
 * - DELETE /api/detail-inventories/:id - Delete detail inventory
 * 
 * Methods NOT implemented as endpoints (waiting for frontend request):
 * - getStatistics() - Batch-level inventory statistics
 * - getOutOfStockBatches() - Use GET /api/detail-inventories?outOfStock=true
 * - getByLocation() - Use GET /api/detail-inventories?location=value
 * - adjustStock() - Use PUT /api/detail-inventories/:id with quantity adjustments
 * - transferToShelf() - Use PUT /api/detail-inventories/:id with quantityOnShelf update
 * - reserveStock() - Use PUT /api/detail-inventories/:id with quantityReserved update
 * - getExpiringSoon() - Use GET /api/detail-inventories?expiringSoon=true
 */

/**
 * GET /api/detail-inventories
 * Get all detail inventories with filtering via query parameters
 * 
 * Query parameters:
 * - batchId: string - Filter by batch ID
 * - productId: string - Filter by product ID (via batch)
 * - outOfStock: boolean - Filter out of stock batches
 * - hasWarehouseStock: boolean - Filter batches with warehouse stock
 * - hasShelfStock: boolean - Filter batches with shelf stock
 * - location: string - Filter by warehouse location
 * - expiringSoon: boolean - Filter batches expiring soon (within 30 days)
 * - search: string - Search by batch code, product name, or location
 * - page: number - Page number for pagination
 * - limit: number - Items per page
 */
detailInventoriesRouter.get('/', async (request, response) => {
  try {
    const {
      batchId,
      productId,
      outOfStock,
      hasWarehouseStock,
      hasShelfStock,
      location,
      expiringSoon,
      search,
      page = 1,
      limit = 20
    } = request.query;

    // Build filter object
    const filter = {};

    if (batchId) {
      filter.batchId = batchId;
    }

    if (location) {
      filter.location = new RegExp(location, 'i');
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build query with batch and product population
    let query = DetailInventory.find(filter)
      .populate({
        path: 'batchId',
        select: 'batchCode costPrice unitPrice quantity mfgDate expiryDate status productId',
        populate: {
          path: 'productId',
          select: 'productCode name image category',
          populate: {
            path: 'category',
            select: 'name categoryCode'
          }
        }
      })
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    let detailInventories = await query;

    // Filter by productId (after population)
    if (productId) {
      detailInventories = detailInventories.filter(
        inv => inv.batchId?.productId?._id.toString() === productId
      );
    }

    // Apply filters that require virtuals (after query execution)
    if (outOfStock === 'true') {
      detailInventories = detailInventories.filter(inv => inv.isOutOfStock);
    }

    if (hasWarehouseStock === 'true') {
      detailInventories = detailInventories.filter(inv => inv.hasWarehouseStock);
    }

    if (hasShelfStock === 'true') {
      detailInventories = detailInventories.filter(inv => inv.hasShelfStock);
    }

    // Filter expiring soon (within 30 days)
    if (expiringSoon === 'true') {
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      detailInventories = detailInventories.filter(inv =>
        inv.batchId?.expiryDate &&
        new Date(inv.batchId.expiryDate) <= thirtyDaysFromNow &&
        new Date(inv.batchId.expiryDate) > new Date() &&
        inv.batchId.status === 'active'
      );
    }

    // Search filter (after population)
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      detailInventories = detailInventories.filter(inv =>
        (inv.batchId?.batchCode && searchRegex.test(inv.batchId.batchCode)) ||
        (inv.batchId?.productId?.name && searchRegex.test(inv.batchId.productId.name)) ||
        (inv.batchId?.productId?.productCode && searchRegex.test(inv.batchId.productId.productCode)) ||
        (inv.location && searchRegex.test(inv.location))
      );
    }

    // Get total count for pagination
    const total = await DetailInventory.countDocuments(filter);

    response.json({
      success: true,
      data: {
        detailInventories,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get detail inventories error:', error);
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to get detail inventories',
        details: error.message
      }
    });
  }
});

/**
 * GET /api/detail-inventories/:id
 * Get single detail inventory by ID with batch and product details
 */
detailInventoriesRouter.get('/:id', async (request, response) => {
  try {
    const detailInventory = await DetailInventory.findById(request.params.id)
      .populate({
        path: 'batchId',
        select: 'batchCode costPrice unitPrice quantity mfgDate expiryDate status promotionApplied discountPercentage notes productId',
        populate: {
          path: 'productId',
          select: 'productCode name image description category unitPrice',
          populate: {
            path: 'category',
            select: 'name categoryCode'
          }
        }
      });

    if (!detailInventory) {
      return response.status(404).json({
        success: false,
        error: {
          message: 'Detail inventory not found',
          code: 'DETAIL_INVENTORY_NOT_FOUND'
        }
      });
    }

    response.json({
      success: true,
      data: detailInventory
    });
  } catch (error) {
    console.error('Get detail inventory by ID error:', error);
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to get detail inventory',
        details: error.message
      }
    });
  }
});

/**
 * POST /api/detail-inventories
 * Create new detail inventory
 * Requires authentication
 */
detailInventoriesRouter.post('/', userExtractor, async (request, response) => {
  try {
    const {
      batchId,
      quantityOnHand,
      quantityOnShelf,
      quantityReserved,
      location
    } = request.body;

    // Validation
    if (!batchId) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Missing required fields',
          code: 'MISSING_REQUIRED_FIELDS',
          details: 'batchId is required'
        }
      });
    }

    // Check if batch exists
    const existingBatch = await ProductBatch.findById(batchId);
    if (!existingBatch) {
      return response.status(404).json({
        success: false,
        error: {
          message: 'Product batch not found',
          code: 'BATCH_NOT_FOUND'
        }
      });
    }

    // Check if detail inventory already exists for this batch
    const existingDetailInventory = await DetailInventory.findOne({ batchId });
    if (existingDetailInventory) {
      return response.status(409).json({
        success: false,
        error: {
          message: 'Detail inventory already exists for this batch',
          code: 'DUPLICATE_DETAIL_INVENTORY'
        }
      });
    }

    // Create detail inventory
    const detailInventory = new DetailInventory({
      batchId,
      quantityOnHand: quantityOnHand || 0,
      quantityOnShelf: quantityOnShelf || 0,
      quantityReserved: quantityReserved || 0,
      location: location || null
    });

    const savedDetailInventory = await detailInventory.save();

    // Populate batch and product details
    await savedDetailInventory.populate({
      path: 'batchId',
      select: 'batchCode costPrice unitPrice quantity mfgDate expiryDate status productId',
      populate: {
        path: 'productId',
        select: 'productCode name image category',
        populate: {
          path: 'category',
          select: 'name categoryCode'
        }
      }
    });

    response.status(201).json({
      success: true,
      data: savedDetailInventory,
      message: 'Detail inventory created successfully'
    });
  } catch (error) {
    console.error('Create detail inventory error:', error);

    // Handle duplicate detail inventory
    if (error.code === 11000) {
      return response.status(409).json({
        success: false,
        error: {
          message: 'Detail inventory already exists for this batch',
          code: 'DUPLICATE_DETAIL_INVENTORY',
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
        message: 'Failed to create detail inventory',
        details: error.message
      }
    });
  }
});

/**
 * PUT /api/detail-inventories/:id
 * Update detail inventory
 * Requires authentication
 * 
 * Note: This endpoint handles all updates including:
 * - Stock adjustments (quantityOnHand, quantityOnShelf, quantityReserved)
 * - Location updates
 * - Transfer to shelf
 * - Reserve stock
 */
detailInventoriesRouter.put('/:id', userExtractor, async (request, response) => {
  try {
    const {
      quantityOnHand,
      quantityOnShelf,
      quantityReserved,
      location
    } = request.body;

    // Find detail inventory
    const detailInventory = await DetailInventory.findById(request.params.id)
      .populate('batchId', 'quantity batchCode');

    if (!detailInventory) {
      return response.status(404).json({
        success: false,
        error: {
          message: 'Detail inventory not found',
          code: 'DETAIL_INVENTORY_NOT_FOUND'
        }
      });
    }

    // Update fields
    if (quantityOnHand !== undefined) detailInventory.quantityOnHand = quantityOnHand;
    if (quantityOnShelf !== undefined) detailInventory.quantityOnShelf = quantityOnShelf;
    if (quantityReserved !== undefined) detailInventory.quantityReserved = quantityReserved;
    if (location !== undefined) detailInventory.location = location;

    // Validate total quantities don't exceed batch quantity
    const totalInventory = detailInventory.quantityOnHand +
      detailInventory.quantityOnShelf +
      detailInventory.quantityReserved;

    if (detailInventory.batchId && totalInventory > detailInventory.batchId.quantity) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Total inventory quantities exceed batch quantity',
          code: 'QUANTITY_EXCEEDS_BATCH',
          details: `Total (${totalInventory}) exceeds batch quantity (${detailInventory.batchId.quantity})`
        }
      });
    }

    const updatedDetailInventory = await detailInventory.save();

    // Populate batch and product details
    await updatedDetailInventory.populate({
      path: 'batchId',
      select: 'batchCode costPrice unitPrice quantity mfgDate expiryDate status productId',
      populate: {
        path: 'productId',
        select: 'productCode name image category',
        populate: {
          path: 'category',
          select: 'name categoryCode'
        }
      }
    });

    response.json({
      success: true,
      data: updatedDetailInventory,
      message: 'Detail inventory updated successfully'
    });
  } catch (error) {
    console.error('Update detail inventory error:', error);

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
        message: 'Failed to update detail inventory',
        details: error.message
      }
    });
  }
});

/**
 * DELETE /api/detail-inventories/:id
 * Delete detail inventory
 * Requires authentication
 * 
 * Note: Cannot delete detail inventory if it has stock or reservations
 */
detailInventoriesRouter.delete('/:id', userExtractor, async (request, response) => {
  try {
    const detailInventory = await DetailInventory.findById(request.params.id)
      .populate({
        path: 'batchId',
        select: 'batchCode status productId',
        populate: {
          path: 'productId',
          select: 'productCode name'
        }
      });

    if (!detailInventory) {
      return response.status(404).json({
        success: false,
        error: {
          message: 'Detail inventory not found',
          code: 'DETAIL_INVENTORY_NOT_FOUND'
        }
      });
    }

    // Check if batch is active
    if (detailInventory.batchId?.status === 'active') {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Cannot delete detail inventory for active batch',
          code: 'BATCH_ACTIVE',
          details: 'Please expire or dispose the batch before deleting its inventory'
        }
      });
    }

    // Check if detail inventory has stock
    if (detailInventory.totalQuantity > 0) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Cannot delete detail inventory with existing stock',
          code: 'DETAIL_INVENTORY_HAS_STOCK',
          details: `This detail inventory has ${detailInventory.totalQuantity} unit(s) in stock. Please clear stock first.`
        }
      });
    }

    // Check if detail inventory has reserved stock
    if (detailInventory.quantityReserved > 0) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Cannot delete detail inventory with reserved stock',
          code: 'DETAIL_INVENTORY_HAS_RESERVED',
          details: `This detail inventory has ${detailInventory.quantityReserved} unit(s) reserved. Please clear reservations first.`
        }
      });
    }

    // Delete detail inventory
    await DetailInventory.findByIdAndDelete(request.params.id);

    response.json({
      success: true,
      message: 'Detail inventory deleted successfully',
      data: {
        id: detailInventory._id,
        batch: {
          id: detailInventory.batchId?._id,
          batchCode: detailInventory.batchId?.batchCode
        },
        product: {
          id: detailInventory.batchId?.productId?._id,
          productCode: detailInventory.batchId?.productId?.productCode,
          name: detailInventory.batchId?.productId?.name
        }
      }
    });
  } catch (error) {
    console.error('Delete detail inventory error:', error);
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to delete detail inventory',
        details: error.message
      }
    });
  }
});

module.exports = detailInventoriesRouter;
