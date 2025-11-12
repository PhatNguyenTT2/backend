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
 * Additional useful query patterns:
 * - GET /api/inventories?needsReorder=true - Get inventories needing restock
 * - GET /api/inventories?lowStock=true - Get low stock items
 * - GET /api/inventories?outOfStock=true - Get out of stock items
 * - GET /api/inventories/product/:productId - Get inventory by product
 * 
 * Stock operations are handled through PUT endpoint:
 * - Adjust warehouse stock (receive/issue goods)
 * - Move stock to shelf
 * - Reserve/release stock
 */

/**
 * GET /api/inventories
 * Get all inventories with filtering via query parameters
 * 
 * Query parameters:
 * - product: string - Filter by product ID
 * - needsReorder: boolean - Filter inventories needing restock
 * - lowStock: boolean - Filter low stock items
 * - outOfStock: boolean - Filter out of stock items
 * - warehouseLocation: string - Filter by warehouse location
 * - minAvailable: number - Filter by minimum available quantity
 * - maxAvailable: number - Filter by maximum available quantity
 * - page: number - Page number for pagination
 * - limit: number - Items per page
 */
inventoriesRouter.get('/', async (request, response) => {
  try {
    const {
      product,
      needsReorder,
      lowStock,
      outOfStock,
      warehouseLocation,
      minAvailable,
      maxAvailable,
      page = 1,
      limit = 20
    } = request.query;

    // Build filter object
    const filter = {};

    if (product) {
      filter.product = product;
    }

    if (warehouseLocation) {
      filter.warehouseLocation = new RegExp(warehouseLocation, 'i');
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get inventories with product population
    const inventories = await Inventory.find(filter)
      .populate('product', 'productCode name unit originalPrice')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ 'product.name': 1 });

    // Post-process filters (for virtual fields)
    let filteredInventories = inventories;

    if (needsReorder === 'true') {
      filteredInventories = filteredInventories.filter(inv => inv.needsReorder);
    }

    if (lowStock === 'true') {
      filteredInventories = filteredInventories.filter(inv => inv.isLowStock);
    }

    if (outOfStock === 'true') {
      filteredInventories = filteredInventories.filter(inv => inv.isOutOfStock);
    }

    if (minAvailable) {
      filteredInventories = filteredInventories.filter(
        inv => inv.quantityAvailable >= parseInt(minAvailable)
      );
    }

    if (maxAvailable) {
      filteredInventories = filteredInventories.filter(
        inv => inv.quantityAvailable <= parseInt(maxAvailable)
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
 * Get single inventory by ID with product details
 */
inventoriesRouter.get('/:id', async (request, response) => {
  try {
    const inventory = await Inventory.findById(request.params.id)
      .populate('product', 'productCode name unit originalPrice category vendor');

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
 * GET /api/inventories/product/:productId
 * Get inventory by product ID
 */
inventoriesRouter.get('/product/:productId', async (request, response) => {
  try {
    const { productId } = request.params;

    const inventory = await Inventory.findOne({ product: productId })
      .populate('product', 'productCode name unit originalPrice category');

    if (!inventory) {
      return response.status(404).json({
        success: false,
        error: {
          message: 'Inventory not found for this product',
          code: 'INVENTORY_NOT_FOUND'
        }
      });
    }

    response.json({
      success: true,
      data: inventory
    });
  } catch (error) {
    console.error('Get inventory by product error:', error);
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
 * 
 * Note: Usually created automatically when product is created
 * This endpoint is for manual creation or correction
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
          code: 'DUPLICATE_INVENTORY',
          details: 'Each product can only have one inventory record'
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

    // Populate product info for response
    await savedInventory.populate('product', 'productCode name unit');

    response.status(201).json({
      success: true,
      data: savedInventory,
      message: 'Inventory created successfully'
    });
  } catch (error) {
    console.error('Create inventory error:', error);

    // Handle duplicate product
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
 * This endpoint handles all inventory operations:
 * - Adjust warehouse stock (receive/issue goods)
 * - Move stock between warehouse and shelf
 * - Reserve/release stock
 * - Update reorder point and warehouse location
 * 
 * Use 'operation' field to specify the type of update:
 * - 'adjust' - Adjust warehouse stock (in/out)
 * - 'moveToShelf' - Move from warehouse to shelf
 * - 'moveToWarehouse' - Move from shelf to warehouse
 * - 'reserve' - Reserve stock for order
 * - 'release' - Release reserved stock
 * - 'completeDelivery' - Complete delivery (reduce reserved)
 * - 'update' - Update basic fields (reorderPoint, warehouseLocation)
 */
inventoriesRouter.put('/:id', userExtractor, async (request, response) => {
  try {
    const {
      operation,
      quantity,
      adjustType,
      returnToShelf,
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

    // Handle different operations
    switch (operation) {
      case 'adjust':
        // Adjust warehouse stock (receive/issue goods)
        if (!quantity || !adjustType) {
          return response.status(400).json({
            success: false,
            error: {
              message: 'Missing required fields for adjust operation',
              details: 'quantity and adjustType (in/out) are required'
            }
          });
        }

        if (adjustType === 'in') {
          inventory.quantityOnHand += quantity;
        } else if (adjustType === 'out') {
          if (inventory.quantityOnHand < quantity) {
            return response.status(400).json({
              success: false,
              error: {
                message: 'Insufficient warehouse stock',
                details: `Available: ${inventory.quantityOnHand}, Requested: ${quantity}`
              }
            });
          }
          inventory.quantityOnHand -= quantity;
        } else {
          return response.status(400).json({
            success: false,
            error: {
              message: 'Invalid adjustType',
              details: 'adjustType must be "in" or "out"'
            }
          });
        }
        break;

      case 'moveToShelf':
        // Move stock from warehouse to shelf
        if (!quantity) {
          return response.status(400).json({
            success: false,
            error: {
              message: 'Missing required field: quantity'
            }
          });
        }

        if (inventory.quantityOnHand < quantity) {
          return response.status(400).json({
            success: false,
            error: {
              message: 'Insufficient warehouse stock',
              details: `Available: ${inventory.quantityOnHand}, Requested: ${quantity}`
            }
          });
        }

        inventory.quantityOnHand -= quantity;
        inventory.quantityOnShelf += quantity;
        break;

      case 'moveToWarehouse':
        // Move stock from shelf to warehouse
        if (!quantity) {
          return response.status(400).json({
            success: false,
            error: {
              message: 'Missing required field: quantity'
            }
          });
        }

        if (inventory.quantityOnShelf < quantity) {
          return response.status(400).json({
            success: false,
            error: {
              message: 'Insufficient shelf stock',
              details: `Available: ${inventory.quantityOnShelf}, Requested: ${quantity}`
            }
          });
        }

        inventory.quantityOnShelf -= quantity;
        inventory.quantityOnHand += quantity;
        break;

      case 'reserve':
        // Reserve stock for order (reduce available, increase reserved)
        if (!quantity) {
          return response.status(400).json({
            success: false,
            error: {
              message: 'Missing required field: quantity'
            }
          });
        }

        const available = inventory.quantityOnHand + inventory.quantityOnShelf - inventory.quantityReserved;
        if (available < quantity) {
          return response.status(400).json({
            success: false,
            error: {
              message: 'Insufficient available inventory',
              details: `Available: ${available}, Requested: ${quantity}`
            }
          });
        }

        // Priority: reserve from shelf first, then from warehouse
        if (inventory.quantityOnShelf >= quantity) {
          inventory.quantityOnShelf -= quantity;
        } else {
          const fromShelf = inventory.quantityOnShelf;
          const fromWarehouse = quantity - fromShelf;

          if (inventory.quantityOnHand < fromWarehouse) {
            return response.status(400).json({
              success: false,
              error: {
                message: 'Insufficient warehouse stock for reservation'
              }
            });
          }

          inventory.quantityOnShelf = 0;
          inventory.quantityOnHand -= fromWarehouse;
        }

        inventory.quantityReserved += quantity;
        break;

      case 'release':
        // Release reserved stock (order cancelled)
        if (!quantity) {
          return response.status(400).json({
            success: false,
            error: {
              message: 'Missing required field: quantity'
            }
          });
        }

        if (inventory.quantityReserved < quantity) {
          return response.status(400).json({
            success: false,
            error: {
              message: 'Cannot release more than reserved quantity',
              details: `Reserved: ${inventory.quantityReserved}, Requested: ${quantity}`
            }
          });
        }

        inventory.quantityReserved -= quantity;

        // Return to shelf or warehouse
        if (returnToShelf) {
          inventory.quantityOnShelf += quantity;
        } else {
          inventory.quantityOnHand += quantity;
        }
        break;

      case 'completeDelivery':
        // Complete delivery (reduce reserved after successful delivery)
        if (!quantity) {
          return response.status(400).json({
            success: false,
            error: {
              message: 'Missing required field: quantity'
            }
          });
        }

        if (inventory.quantityReserved < quantity) {
          return response.status(400).json({
            success: false,
            error: {
              message: 'Cannot complete more than reserved quantity',
              details: `Reserved: ${inventory.quantityReserved}, Requested: ${quantity}`
            }
          });
        }

        inventory.quantityReserved -= quantity;
        break;

      case 'update':
        // Update basic fields
        if (reorderPoint !== undefined) {
          inventory.reorderPoint = reorderPoint;
        }
        if (warehouseLocation !== undefined) {
          inventory.warehouseLocation = warehouseLocation;
        }
        break;

      default:
        return response.status(400).json({
          success: false,
          error: {
            message: 'Invalid operation',
            details: 'operation must be one of: adjust, moveToShelf, moveToWarehouse, reserve, release, completeDelivery, update'
          }
        });
    }

    const updatedInventory = await inventory.save();

    // Populate product info for response
    await updatedInventory.populate('product', 'productCode name unit');

    response.json({
      success: true,
      data: updatedInventory,
      message: `Inventory ${operation} completed successfully`
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
 * Note: Be careful when deleting inventory
 * Usually you should deactivate the product instead
 */
inventoriesRouter.delete('/:id', userExtractor, async (request, response) => {
  try {
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

    // Warning if inventory has stock
    if (inventory.totalQuantity > 0) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Cannot delete inventory with stock',
          code: 'INVENTORY_HAS_STOCK',
          details: `This inventory has ${inventory.totalQuantity} items in stock. Please clear stock before deleting.`
        }
      });
    }

    // Warning if inventory has reserved stock
    if (inventory.quantityReserved > 0) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Cannot delete inventory with reserved stock',
          code: 'INVENTORY_HAS_RESERVED',
          details: `This inventory has ${inventory.quantityReserved} reserved items. Please release reservations before deleting.`
        }
      });
    }

    await Inventory.findByIdAndDelete(request.params.id);

    response.json({
      success: true,
      message: 'Inventory deleted successfully',
      data: {
        id: inventory._id,
        product: inventory.product
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
