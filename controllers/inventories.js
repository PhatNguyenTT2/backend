const inventoriesRouter = require('express').Router();
const Inventory = require('../models/inventory');
const Product = require('../models/product');
const DetailInventory = require('../models/detailInventory');
const ProductBatch = require('../models/productBatch');
const { userExtractor } = require('../utils/auth');

/**
 * Inventories Controller - Minimal CRUD Approach
 * 
 * Only 5 basic CRUD endpoints:
 * - GET /api/inventories - Get all inventories with filtering
 * - GET /api/inventories/:id - Get single inventory by ID
 * - POST /api/inventories - Create new inventory
 * - PUT /api/inventories/:id - Update inventory
 * - DELETE /api/inventories/:id - Delete inventory
 * 
 * Methods NOT implemented as endpoints (waiting for frontend request):
 * - getStatistics() - Inventory statistics
 * - getLowStockItems() - Use GET /api/inventories?lowStock=true
 * - getOutOfStockItems() - Use GET /api/inventories?outOfStock=true
 * - getNeedsReorder() - Use GET /api/inventories?needsReorder=true
 * - adjustStock() - Use PUT /api/inventories/:id with quantity adjustments
 * - transferToShelf() - Use PUT /api/inventories/:id with quantityOnShelf update
 * - reserveStock() - Use PUT /api/inventories/:id with quantityReserved update
 */

/**
 * GET /api/inventories
 * Get all inventories with filtering via query parameters
 * Auto-calculates quantities from DetailInventory records
 * 
 * Query parameters:
 * - productId: string - Filter by product ID
 * - lowStock: boolean - Filter low stock items
 * - outOfStock: boolean - Filter out of stock items
 * - needsReorder: boolean - Filter items that need reordering
 * - search: string - Search by product name or warehouse location
 * - page: number - Page number for pagination
 * - limit: number - Items per page
 */
inventoriesRouter.get('/', async (request, response) => {
  try {
    const {
      productId,
      lowStock,
      outOfStock,
      needsReorder,
      search,
      page = 1,
      limit = 20
    } = request.query;

    // Build filter object
    const filter = {};

    if (productId) {
      filter.product = productId;
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build query with product population
    let query = Inventory.find(filter)
      .populate({
        path: 'product',
        select: 'productCode name image category unitPrice isActive',
        populate: {
          path: 'category',
          select: 'name categoryCode'
        }
      })
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    let inventories = await query;

    // For each inventory, calculate totals from DetailInventory
    const inventoriesWithCalculations = await Promise.all(
      inventories.map(async (inventory) => {
        const inventoryObj = inventory.toObject();

        // Get all batches for this product
        const batches = await ProductBatch.find({
          product: inventory.product._id
        }).select('_id');

        const batchIds = batches.map(b => b._id);

        // Get all detail inventories for these batches
        const detailInventories = await DetailInventory.find({
          batchId: { $in: batchIds }
        });

        // Calculate totals
        let totalOnHand = 0;
        let totalOnShelf = 0;
        let totalReserved = 0;

        detailInventories.forEach(detail => {
          totalOnHand += detail.quantityOnHand || 0;
          totalOnShelf += detail.quantityOnShelf || 0;
          totalReserved += detail.quantityReserved || 0;
        });

        // Update calculated values
        inventoryObj.quantityOnHand = totalOnHand;
        inventoryObj.quantityOnShelf = totalOnShelf;
        inventoryObj.quantityReserved = totalReserved;
        inventoryObj.quantityAvailable = Math.max(0, totalOnHand + totalOnShelf - totalReserved);
        inventoryObj.totalQuantity = totalOnHand + totalOnShelf;
        inventoryObj.needsReorder = inventoryObj.quantityAvailable <= inventoryObj.reorderPoint;
        inventoryObj.isOutOfStock = inventoryObj.quantityAvailable === 0;
        inventoryObj.isLowStock = inventoryObj.quantityAvailable > 0 &&
          inventoryObj.quantityAvailable <= (inventoryObj.reorderPoint * 2);

        return inventoryObj;
      })
    );

    // Apply filters that require calculated values
    let filteredInventories = inventoriesWithCalculations;

    if (lowStock === 'true') {
      filteredInventories = filteredInventories.filter(inv => inv.isLowStock);
    }

    if (outOfStock === 'true') {
      filteredInventories = filteredInventories.filter(inv => inv.isOutOfStock);
    }

    if (needsReorder === 'true') {
      filteredInventories = filteredInventories.filter(inv => inv.needsReorder);
    }

    // Search filter
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      filteredInventories = filteredInventories.filter(inv =>
        (inv.product?.name && searchRegex.test(inv.product.name)) ||
        (inv.product?.productCode && searchRegex.test(inv.product.productCode))
      );
    }

    // Get total count for pagination
    const total = await Inventory.countDocuments(filter);

    response.json({
      success: true,
      data: {
        inventories: filteredInventories,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get inventories error:', error);
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to get inventories',
        details: error.message
      }
    });
  }
});

/**
 * GET /api/inventories/:id
 * Get single inventory by ID with product details and batch breakdown
 * Auto-calculates quantities from DetailInventory records
 */
inventoriesRouter.get('/:id', async (request, response) => {
  try {
    const inventory = await Inventory.findById(request.params.id)
      .populate({
        path: 'product',
        select: 'productCode name image description category unitPrice isActive',
        populate: {
          path: 'category',
          select: 'name categoryCode'
        }
      });

    if (!inventory) {
      return response.status(404).json({
        success: false,
        error: {
          message: 'Inventory not found',
          code: 'INVENTORY_NOT_FOUND'
        }
      });
    }

    const inventoryObj = inventory.toObject();

    // Get all batches for this product with their detail inventories
    const batches = await ProductBatch.find({
      product: inventory.product._id
    }).populate('supplier', 'name supplierCode');

    const batchIds = batches.map(b => b._id);

    // Get all detail inventories for these batches
    const detailInventories = await DetailInventory.find({
      batchId: { $in: batchIds }
    }).populate({
      path: 'batchId',
      select: 'batchCode expirationDate supplier quantity',
      populate: {
        path: 'supplier',
        select: 'name supplierCode'
      }
    });

    // Calculate totals
    let totalOnHand = 0;
    let totalOnShelf = 0;
    let totalReserved = 0;

    detailInventories.forEach(detail => {
      totalOnHand += detail.quantityOnHand || 0;
      totalOnShelf += detail.quantityOnShelf || 0;
      totalReserved += detail.quantityReserved || 0;
    });

    // Update calculated values
    inventoryObj.quantityOnHand = totalOnHand;
    inventoryObj.quantityOnShelf = totalOnShelf;
    inventoryObj.quantityReserved = totalReserved;
    inventoryObj.quantityAvailable = Math.max(0, totalOnHand + totalOnShelf - totalReserved);
    inventoryObj.totalQuantity = totalOnHand + totalOnShelf;
    inventoryObj.needsReorder = inventoryObj.quantityAvailable <= inventoryObj.reorderPoint;
    inventoryObj.isOutOfStock = inventoryObj.quantityAvailable === 0;
    inventoryObj.isLowStock = inventoryObj.quantityAvailable > 0 &&
      inventoryObj.quantityAvailable <= (inventoryObj.reorderPoint * 2);

    // Add batch breakdown
    inventoryObj.batchBreakdown = detailInventories.map(detail => ({
      detailInventoryId: detail._id,
      batch: detail.batchId,
      quantityOnHand: detail.quantityOnHand,
      quantityOnShelf: detail.quantityOnShelf,
      quantityReserved: detail.quantityReserved,
      quantityAvailable: detail.quantityAvailable,
      totalQuantity: detail.totalQuantity,
      location: detail.location,
      isOutOfStock: detail.isOutOfStock,
      hasWarehouseStock: detail.hasWarehouseStock,
      hasShelfStock: detail.hasShelfStock
    }));

    response.json({
      success: true,
      data: inventoryObj
    });
  } catch (error) {
    console.error('Get inventory by ID error:', error);
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to get inventory',
        details: error.message
      }
    });
  }
});

/**
 * POST /api/inventories
 * Create new inventory
 * Requires authentication
 */
inventoriesRouter.post('/', userExtractor, async (request, response) => {
  try {
    const {
      product,
      quantityOnHand,
      quantityReserved,
      quantityOnShelf,
      reorderPoint
    } = request.body;

    // Validation
    if (!product) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Missing required fields',
          code: 'MISSING_REQUIRED_FIELDS',
          details: 'product is required'
        }
      });
    }

    // Check if product exists
    const existingProduct = await Product.findById(product);
    if (!existingProduct) {
      return response.status(404).json({
        success: false,
        error: {
          message: 'Product not found',
          code: 'PRODUCT_NOT_FOUND'
        }
      });
    }

    // Check if inventory already exists for this product
    const existingInventory = await Inventory.findOne({ product });
    if (existingInventory) {
      return response.status(409).json({
        success: false,
        error: {
          message: 'Inventory already exists for this product',
          code: 'DUPLICATE_INVENTORY'
        }
      });
    }

    // Create inventory
    const inventory = new Inventory({
      product,
      quantityOnHand: quantityOnHand || 0,
      quantityReserved: quantityReserved || 0,
      quantityOnShelf: quantityOnShelf || 0,
      reorderPoint: reorderPoint || 10
    });

    const savedInventory = await inventory.save();

    // Populate product details
    await savedInventory.populate({
      path: 'product',
      select: 'productCode name image category unitPrice',
      populate: {
        path: 'category',
        select: 'name categoryCode'
      }
    });

    response.status(201).json({
      success: true,
      data: savedInventory,
      message: 'Inventory created successfully'
    });
  } catch (error) {
    console.error('Create inventory error:', error);

    // Handle duplicate inventory
    if (error.code === 11000) {
      return response.status(409).json({
        success: false,
        error: {
          message: 'Inventory already exists for this product',
          code: 'DUPLICATE_INVENTORY',
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
        message: 'Failed to create inventory',
        details: error.message
      }
    });
  }
});

/**
 * PUT /api/inventories/:id
 * Update inventory
 * Requires authentication
 * 
 * Note: This endpoint handles all updates including:
 * - Stock adjustments (quantityOnHand, quantityOnShelf, quantityReserved)
 * - Reorder point updates
 * - Warehouse location updates
 */
inventoriesRouter.put('/:id', userExtractor, async (request, response) => {
  try {
    const {
      quantityOnHand,
      quantityReserved,
      quantityOnShelf,
      reorderPoint
    } = request.body;

    // Find inventory
    const inventory = await Inventory.findById(request.params.id);

    if (!inventory) {
      return response.status(404).json({
        success: false,
        error: {
          message: 'Inventory not found',
          code: 'INVENTORY_NOT_FOUND'
        }
      });
    }

    // Update fields
    if (quantityOnHand !== undefined) inventory.quantityOnHand = quantityOnHand;
    if (quantityReserved !== undefined) inventory.quantityReserved = quantityReserved;
    if (quantityOnShelf !== undefined) inventory.quantityOnShelf = quantityOnShelf;
    if (reorderPoint !== undefined) inventory.reorderPoint = reorderPoint;

    const updatedInventory = await inventory.save();

    // Populate product details
    await updatedInventory.populate({
      path: 'product',
      select: 'productCode name image category unitPrice',
      populate: {
        path: 'category',
        select: 'name categoryCode'
      }
    });

    response.json({
      success: true,
      data: updatedInventory,
      message: 'Inventory updated successfully'
    });
  } catch (error) {
    console.error('Update inventory error:', error);

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
        message: 'Failed to update inventory',
        details: error.message
      }
    });
  }
});

/**
 * DELETE /api/inventories/:id
 * Delete inventory
 * Requires authentication
 * 
 * Note: Cannot delete inventory if product is active or has stock
 */
inventoriesRouter.delete('/:id', userExtractor, async (request, response) => {
  try {
    const inventory = await Inventory.findById(request.params.id)
      .populate('product', 'productCode name isActive');

    if (!inventory) {
      return response.status(404).json({
        success: false,
        error: {
          message: 'Inventory not found',
          code: 'INVENTORY_NOT_FOUND'
        }
      });
    }

    // Check if product is active
    if (inventory.product?.isActive) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Cannot delete inventory for active product',
          code: 'PRODUCT_ACTIVE',
          details: 'Please deactivate the product before deleting its inventory'
        }
      });
    }

    // Check if inventory has stock
    if (inventory.totalQuantity > 0) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Cannot delete inventory with existing stock',
          code: 'INVENTORY_HAS_STOCK',
          details: `This inventory has ${inventory.totalQuantity} unit(s) in stock. Please clear stock first.`
        }
      });
    }

    // Check if inventory has reserved stock
    if (inventory.quantityReserved > 0) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Cannot delete inventory with reserved stock',
          code: 'INVENTORY_HAS_RESERVED',
          details: `This inventory has ${inventory.quantityReserved} unit(s) reserved. Please clear reservations first.`
        }
      });
    }

    // Delete inventory
    await Inventory.findByIdAndDelete(request.params.id);

    response.json({
      success: true,
      message: 'Inventory deleted successfully',
      data: {
        id: inventory._id,
        product: {
          id: inventory.product?._id,
          productCode: inventory.product?.productCode,
          name: inventory.product?.name
        }
      }
    });
  } catch (error) {
    console.error('Delete inventory error:', error);
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to delete inventory',
        details: error.message
      }
    });
  }
});

/**
 * POST /api/inventories/recalculate-all
 * Recalculate all inventory quantities from DetailInventory
 * Useful for syncing data or fixing inconsistencies
 * Requires authentication
 */
inventoriesRouter.post('/recalculate-all', userExtractor, async (request, response) => {
  try {
    const inventories = await Inventory.find({}).populate('product', 'productCode name');

    const results = {
      total: inventories.length,
      succeeded: 0,
      failed: 0,
      details: []
    };

    for (const inventory of inventories) {
      try {
        const updated = await Inventory.recalculateFromDetails(inventory.product._id);

        if (updated) {
          results.succeeded++;
          results.details.push({
            productId: inventory.product._id,
            productCode: inventory.product.productCode,
            productName: inventory.product.name,
            status: 'success',
            onHand: updated.quantityOnHand,
            onShelf: updated.quantityOnShelf,
            reserved: updated.quantityReserved
          });
        }
      } catch (error) {
        results.failed++;
        results.details.push({
          productId: inventory.product._id,
          productCode: inventory.product.productCode,
          productName: inventory.product.name,
          status: 'failed',
          error: error.message
        });
      }
    }

    response.json({
      success: true,
      message: `Recalculated ${results.succeeded} of ${results.total} inventories`,
      data: results
    });
  } catch (error) {
    console.error('Recalculate all inventories error:', error);
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to recalculate inventories',
        details: error.message
      }
    });
  }
});

/**
 * POST /api/inventories/:id/recalculate
 * Recalculate specific inventory quantities from DetailInventory
 * Requires authentication
 */
inventoriesRouter.post('/:id/recalculate', userExtractor, async (request, response) => {
  try {
    const inventory = await Inventory.findById(request.params.id).populate('product', 'productCode name');

    if (!inventory) {
      return response.status(404).json({
        success: false,
        error: {
          message: 'Inventory not found',
          code: 'INVENTORY_NOT_FOUND'
        }
      });
    }

    const updated = await Inventory.recalculateFromDetails(inventory.product._id);

    response.json({
      success: true,
      message: 'Inventory recalculated successfully',
      data: {
        product: {
          id: inventory.product._id,
          productCode: inventory.product.productCode,
          name: inventory.product.name
        },
        before: {
          onHand: inventory.quantityOnHand,
          onShelf: inventory.quantityOnShelf,
          reserved: inventory.quantityReserved
        },
        after: {
          onHand: updated.quantityOnHand,
          onShelf: updated.quantityOnShelf,
          reserved: updated.quantityReserved
        }
      }
    });
  } catch (error) {
    console.error('Recalculate inventory error:', error);
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to recalculate inventory',
        details: error.message
      }
    });
  }
});

module.exports = inventoriesRouter;
