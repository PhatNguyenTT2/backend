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
 * - POST /api/inventories - Create new inventory entry
 * - PUT /api/inventories/:id - Update inventory
 * - DELETE /api/inventories/:id - Delete inventory entry
 * 
 * Methods NOT implemented as endpoints (waiting for frontend request):
 * - getProductsNeedingRestock() - Use GET /api/inventories?needsReorder=true
 * - getInventorySummary() - WAITING for frontend request
 * - getShelfStockSummary() - WAITING for frontend request
 * - adjustInventory() - Use PUT /api/inventories/:id
 * - reserveInventory() - Use PUT /api/inventories/:id
 * - releaseReservation() - Use PUT /api/inventories/:id
 * - completeDelivery() - Use PUT /api/inventories/:id
 * - moveToShelf() - Use PUT /api/inventories/:id
 * - moveToWarehouse() - Use PUT /api/inventories/:id
 * 
 * All inventory operations are handled through the PUT endpoint with
 * different action parameters to maintain minimal endpoint count.
 */

/**
 * GET /api/inventories
 * Get all inventories with filtering via query parameters
 * 
 * Query parameters:
 * - productId: string - Filter by product ID
 * - needsReorder: boolean - Filter products needing restock
 * - lowStock: boolean - Filter products with low available quantity
 * - outOfStock: boolean - Filter products with zero available quantity
 * - warehouseLocation: string - Filter by warehouse location
 * - search: string - Search by product name
 * - minQuantity: number - Filter by minimum available quantity
 * - maxQuantity: number - Filter by maximum available quantity
 * - page: number - Page number for pagination
 * - limit: number - Items per page
 */
inventoriesRouter.get('/', async (request, response) => {
  try {
    const {
      productId,
      needsReorder,
      lowStock,
      outOfStock,
      warehouseLocation,
      search,
      minQuantity,
      maxQuantity,
      page = 1,
      limit = 20
    } = request.query;

    // Build filter object
    const filter = {};

    if (productId) {
      filter.product = productId;
    }

    if (warehouseLocation) {
      filter.warehouseLocation = new RegExp(warehouseLocation, 'i');
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get inventories with population
    let query = Inventory.find(filter)
      .populate({
        path: 'product',
        select: 'productCode name vendor category',
        populate: {
          path: 'category',
          select: 'name'
        }
      })
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    let inventories = await query;

    // Apply filters that require calculated virtuals (after query)
    if (needsReorder === 'true') {
      inventories = inventories.filter(inv => inv.needsReorder());
    }

    if (lowStock === 'true') {
      inventories = inventories.filter(inv => inv.quantityAvailable < 10 && inv.quantityAvailable > 0);
    }

    if (outOfStock === 'true') {
      inventories = inventories.filter(inv => inv.quantityAvailable === 0);
    }

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      inventories = inventories.filter(inv =>
        inv.product && (
          searchRegex.test(inv.product.name) ||
          searchRegex.test(inv.product.productCode)
        )
      );
    }

    if (minQuantity !== undefined) {
      inventories = inventories.filter(inv => inv.quantityAvailable >= parseInt(minQuantity));
    }

    if (maxQuantity !== undefined) {
      inventories = inventories.filter(inv => inv.quantityAvailable <= parseInt(maxQuantity));
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
 * Get single inventory by ID with full details
 */
inventoriesRouter.get('/:id', async (request, response) => {
  try {
    const inventory = await Inventory.findById(request.params.id)
      .populate({
        path: 'product',
        select: 'productCode name vendor originalPrice category',
        populate: {
          path: 'category',
          select: 'name categoryCode'
        }
      })
      .populate('movements');

    if (!inventory) {
      return response.status(404).json({
        success: false,
        error: {
          message: 'Inventory not found',
          code: 'INVENTORY_NOT_FOUND'
        }
      });
    }

    // Add calculated fields
    const inventoryData = inventory.toObject();
    inventoryData.needsReorder = inventory.needsReorder();

    response.json({
      success: true,
      data: inventoryData
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
 * Create new inventory entry
 * Requires authentication
 * 
 * Note: Inventory is usually auto-created when a product is created.
 * This endpoint is for manual creation or fixing missing entries.
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
      warehouseLocation: warehouseLocation || 'Main Warehouse'
    });

    const savedInventory = await inventory.save();

    // Populate and return
    const populatedInventory = await Inventory.findById(savedInventory._id)
      .populate('product', 'productCode name vendor');

    response.status(201).json({
      success: true,
      data: populatedInventory,
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
 * This endpoint handles ALL inventory operations through the 'action' parameter:
 * - action: 'update' - Update basic fields (default)
 * - action: 'adjust' - Adjust inventory (in/out)
 * - action: 'reserve' - Reserve inventory
 * - action: 'release' - Release reservation
 * - action: 'complete' - Complete delivery
 * - action: 'moveToShelf' - Move stock to shelf
 * - action: 'moveToWarehouse' - Move stock to warehouse
 * 
 * Body parameters depend on action:
 * 
 * UPDATE (default):
 * - quantityOnHand, quantityReserved, quantityOnShelf
 * - reorderPoint, warehouseLocation
 * 
 * ADJUST:
 * - quantity: number (required)
 * - type: 'in' | 'out' (required)
 * 
 * RESERVE:
 * - quantity: number (required)
 * 
 * RELEASE:
 * - quantity: number (required)
 * - returnToShelf: boolean (optional, default true)
 * 
 * COMPLETE:
 * - quantity: number (required)
 * 
 * MOVE_TO_SHELF:
 * - quantity: number (required)
 * 
 * MOVE_TO_WAREHOUSE:
 * - quantity: number (required)
 */
inventoriesRouter.put('/:id', userExtractor, async (request, response) => {
  try {
    const {
      action = 'update',
      quantity,
      type,
      returnToShelf,
      quantityOnHand,
      quantityReserved,
      quantityOnShelf,
      reorderPoint,
      warehouseLocation
    } = request.body;

    // Find inventory
    const inventory = await Inventory.findById(request.params.id)
      .populate('product', 'productCode name');

    if (!inventory) {
      return response.status(404).json({
        success: false,
        error: {
          message: 'Inventory not found',
          code: 'INVENTORY_NOT_FOUND'
        }
      });
    }

    let updatedInventory;
    let message = 'Inventory updated successfully';

    // Handle different actions
    switch (action.toLowerCase()) {
      case 'adjust':
        // Adjust inventory (in/out)
        if (quantity === undefined || !type) {
          return response.status(400).json({
            success: false,
            error: {
              message: 'Missing required fields for adjust action',
              code: 'MISSING_FIELDS',
              details: 'quantity and type (in/out) are required'
            }
          });
        }
        updatedInventory = await inventory.adjustInventory(quantity, type);
        message = `Inventory ${type === 'in' ? 'increased' : 'decreased'} by ${quantity}`;
        break;

      case 'reserve':
        // Reserve inventory
        if (quantity === undefined) {
          return response.status(400).json({
            success: false,
            error: {
              message: 'Missing required fields for reserve action',
              code: 'MISSING_FIELDS',
              details: 'quantity is required'
            }
          });
        }
        updatedInventory = await inventory.reserveInventory(quantity);
        message = `Reserved ${quantity} units`;
        break;

      case 'release':
        // Release reservation
        if (quantity === undefined) {
          return response.status(400).json({
            success: false,
            error: {
              message: 'Missing required fields for release action',
              code: 'MISSING_FIELDS',
              details: 'quantity is required'
            }
          });
        }
        updatedInventory = await inventory.releaseReservation(
          quantity,
          returnToShelf !== false
        );
        message = `Released ${quantity} units from reservation`;
        break;

      case 'complete':
        // Complete delivery
        if (quantity === undefined) {
          return response.status(400).json({
            success: false,
            error: {
              message: 'Missing required fields for complete action',
              code: 'MISSING_FIELDS',
              details: 'quantity is required'
            }
          });
        }
        updatedInventory = await inventory.completeDelivery(quantity);
        message = `Completed delivery of ${quantity} units`;
        break;

      case 'movetoshelf':
        // Move to shelf
        if (quantity === undefined) {
          return response.status(400).json({
            success: false,
            error: {
              message: 'Missing required fields for moveToShelf action',
              code: 'MISSING_FIELDS',
              details: 'quantity is required'
            }
          });
        }
        updatedInventory = await inventory.moveToShelf(quantity);
        message = `Moved ${quantity} units to shelf`;
        break;

      case 'movetowarehouse':
        // Move to warehouse
        if (quantity === undefined) {
          return response.status(400).json({
            success: false,
            error: {
              message: 'Missing required fields for moveToWarehouse action',
              code: 'MISSING_FIELDS',
              details: 'quantity is required'
            }
          });
        }
        updatedInventory = await inventory.moveToWarehouse(quantity);
        message = `Moved ${quantity} units to warehouse`;
        break;

      default:
        // Basic update
        if (quantityOnHand !== undefined) inventory.quantityOnHand = quantityOnHand;
        if (quantityReserved !== undefined) inventory.quantityReserved = quantityReserved;
        if (quantityOnShelf !== undefined) inventory.quantityOnShelf = quantityOnShelf;
        if (reorderPoint !== undefined) inventory.reorderPoint = reorderPoint;
        if (warehouseLocation !== undefined) inventory.warehouseLocation = warehouseLocation;

        updatedInventory = await inventory.save();
        break;
    }

    // Populate and return
    const populatedInventory = await Inventory.findById(updatedInventory._id)
      .populate('product', 'productCode name vendor');

    response.json({
      success: true,
      data: populatedInventory,
      message
    });
  } catch (error) {
    console.error('Update inventory error:', error);

    // Handle custom errors from model methods
    if (error.message.includes('Insufficient')) {
      return response.status(400).json({
        success: false,
        error: {
          message: error.message,
          code: 'INSUFFICIENT_STOCK'
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
        message: 'Failed to update inventory',
        details: error.message
      }
    });
  }
});

/**
 * DELETE /api/inventories/:id
 * Delete inventory entry
 * Requires authentication
 * 
 * Note: This will hard delete the inventory entry.
 * Use with caution - normally you should not delete inventory.
 * Consider setting quantities to 0 instead.
 */
inventoriesRouter.delete('/:id', userExtractor, async (request, response) => {
  try {
    const inventory = await Inventory.findById(request.params.id)
      .populate('product', 'productCode name');

    if (!inventory) {
      return response.status(404).json({
        success: false,
        error: {
          message: 'Inventory not found',
          code: 'INVENTORY_NOT_FOUND'
        }
      });
    }

    // Check if there's reserved or available stock
    if (inventory.quantityReserved > 0) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Cannot delete inventory with reserved stock',
          code: 'HAS_RESERVED_STOCK',
          details: `There are ${inventory.quantityReserved} reserved units`
        }
      });
    }

    if (inventory.quantityAvailable > 0) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Cannot delete inventory with available stock',
          code: 'HAS_AVAILABLE_STOCK',
          details: `There are ${inventory.quantityAvailable} available units. Set quantities to 0 first.`
        }
      });
    }

    // Hard delete
    await Inventory.findByIdAndDelete(request.params.id);

    response.json({
      success: true,
      message: 'Inventory deleted successfully',
      data: {
        id: inventory._id,
        product: {
          id: inventory.product._id,
          code: inventory.product.productCode,
          name: inventory.product.name
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
