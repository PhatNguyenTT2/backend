const inventoriesRouter = require('express').Router();
const Inventory = require('../models/inventory');
const Product = require('../models/product');
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

    // Apply filters that require virtuals (after query execution)
    if (lowStock === 'true') {
      inventories = inventories.filter(inv => inv.isLowStock);
    }

    if (outOfStock === 'true') {
      inventories = inventories.filter(inv => inv.isOutOfStock);
    }

    if (needsReorder === 'true') {
      inventories = inventories.filter(inv => inv.needsReorder);
    }

    // Search filter (after population)
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      inventories = inventories.filter(inv =>
        (inv.product?.name && searchRegex.test(inv.product.name)) ||
        (inv.product?.productCode && searchRegex.test(inv.product.productCode)) ||
        (inv.warehouseLocation && searchRegex.test(inv.warehouseLocation))
      );
    }

    // Get total count for pagination
    const total = await Inventory.countDocuments(filter);

    response.json({
      success: true,
      data: {
        inventories,
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
 * Get single inventory by ID with product details
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

    response.json({
      success: true,
      data: inventory
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
      reorderPoint,
      warehouseLocation
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
      reorderPoint: reorderPoint || 10,
      warehouseLocation: warehouseLocation || null
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
      reorderPoint,
      warehouseLocation
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
    if (warehouseLocation !== undefined) inventory.warehouseLocation = warehouseLocation;

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

module.exports = inventoriesRouter;
