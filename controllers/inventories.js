const inventoriesRouter = require('express').Router()
const Inventory = require('../models/inventory')
const Product = require('../models/product')
const InventoryMovement = require('../models/inventoryMovement')
const { userExtractor, isAdmin } = require('../utils/auth')

// GET /api/inventories - Get all inventories
inventoriesRouter.get('/', userExtractor, async (request, response) => {
  try {
    const {
      needs_reorder,
      out_of_stock,
      on_shelf,
      in_warehouse,
      location
    } = request.query

    let inventories

    // Filter by reorder needs
    if (needs_reorder === 'true') {
      inventories = await Inventory.getProductsNeedingRestock()
    }
    // Get all inventories with optional filters
    else {
      const filter = {}
      if (location) {
        filter.warehouseLocation = { $regex: location, $options: 'i' }
      }

      inventories = await Inventory.find(filter)
        .sort({ createdAt: -1 })

      // Post-query filters using virtuals
      if (out_of_stock === 'true') {
        inventories = inventories.filter(inv => inv.quantityAvailable === 0)
      }
      if (on_shelf === 'true') {
        inventories = inventories.filter(inv => inv.quantityOnShelf > 0)
      }
      if (in_warehouse === 'true') {
        inventories = inventories.filter(inv => inv.quantityOnHand > 0)
      }
    }

    const inventoriesData = inventories.map(inventory => ({
      id: inventory._id,
      productId: inventory.product,
      quantityOnHand: inventory.quantityOnHand,
      quantityReserved: inventory.quantityReserved,
      quantityOnShelf: inventory.quantityOnShelf,
      quantityAvailable: inventory.quantityAvailable,
      totalQuantity: inventory.totalQuantity,
      reorderPoint: inventory.reorderPoint,
      warehouseLocation: inventory.warehouseLocation,
      needsReorder: inventory.needsReorder(),
      createdAt: inventory.createdAt,
      updatedAt: inventory.updatedAt
    }))

    response.status(200).json({
      success: true,
      data: {
        inventories: inventoriesData
      }
    })
  } catch (error) {
    response.status(500).json({
      error: 'Failed to fetch inventories'
    })
  }
})

// GET /api/inventories/stats/summary - Get inventory summary statistics
inventoriesRouter.get('/stats/summary', userExtractor, isAdmin, async (request, response) => {
  try {
    const stats = await Inventory.getInventorySummary()

    response.status(200).json({
      success: true,
      data: {
        statistics: stats
      }
    })
  } catch (error) {
    response.status(500).json({
      error: 'Failed to fetch inventory summary'
    })
  }
})

// GET /api/inventories/stats/shelf - Get shelf stock summary
inventoriesRouter.get('/stats/shelf', userExtractor, isAdmin, async (request, response) => {
  try {
    const stats = await Inventory.getShelfStockSummary()

    response.status(200).json({
      success: true,
      data: {
        statistics: stats
      }
    })
  } catch (error) {
    response.status(500).json({
      error: 'Failed to fetch shelf stock summary'
    })
  }
})

// GET /api/inventories/restock-needed - Get products needing restock
inventoriesRouter.get('/restock-needed', userExtractor, async (request, response) => {
  try {
    const inventories = await Inventory.getProductsNeedingRestock()

    const restockData = inventories.map(inventory => ({
      id: inventory._id,
      productId: inventory.product,
      quantityAvailable: inventory.quantityAvailable,
      reorderPoint: inventory.reorderPoint,
      quantityOnHand: inventory.quantityOnHand,
      quantityOnShelf: inventory.quantityOnShelf,
      quantityReserved: inventory.quantityReserved,
      warehouseLocation: inventory.warehouseLocation
    }))

    response.status(200).json({
      success: true,
      data: {
        restockNeeded: restockData
      }
    })
  } catch (error) {
    response.status(500).json({
      error: 'Failed to fetch restock needed products'
    })
  }
})

// GET /api/inventories/product/:productId - Get inventory by product ID
inventoriesRouter.get('/product/:productId', userExtractor, async (request, response) => {
  try {
    const inventory = await Inventory.findByProduct(request.params.productId)

    if (!inventory) {
      return response.status(404).json({
        error: 'Inventory not found for this product'
      })
    }

    response.status(200).json({
      success: true,
      data: {
        inventory: {
          id: inventory._id,
          productId: inventory.product,
          quantityOnHand: inventory.quantityOnHand,
          quantityReserved: inventory.quantityReserved,
          quantityOnShelf: inventory.quantityOnShelf,
          quantityAvailable: inventory.quantityAvailable,
          totalQuantity: inventory.totalQuantity,
          reorderPoint: inventory.reorderPoint,
          warehouseLocation: inventory.warehouseLocation,
          needsReorder: inventory.needsReorder(),
          createdAt: inventory.createdAt,
          updatedAt: inventory.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid product ID'
      })
    }
    response.status(500).json({
      error: 'Failed to fetch inventory'
    })
  }
})

// GET /api/inventories/:id - Get single inventory
inventoriesRouter.get('/:id', userExtractor, async (request, response) => {
  try {
    const inventory = await Inventory.findById(request.params.id)

    if (!inventory) {
      return response.status(404).json({
        error: 'Inventory not found'
      })
    }

    response.status(200).json({
      success: true,
      data: {
        inventory: {
          id: inventory._id,
          productId: inventory.product,
          quantityOnHand: inventory.quantityOnHand,
          quantityReserved: inventory.quantityReserved,
          quantityOnShelf: inventory.quantityOnShelf,
          quantityAvailable: inventory.quantityAvailable,
          totalQuantity: inventory.totalQuantity,
          reorderPoint: inventory.reorderPoint,
          warehouseLocation: inventory.warehouseLocation,
          needsReorder: inventory.needsReorder(),
          createdAt: inventory.createdAt,
          updatedAt: inventory.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid inventory ID'
      })
    }
    response.status(500).json({
      error: 'Failed to fetch inventory'
    })
  }
})

// POST /api/inventories - Create new inventory (Admin only)
inventoriesRouter.post('/', userExtractor, isAdmin, async (request, response) => {
  const {
    productId,
    quantityOnHand,
    quantityReserved,
    quantityOnShelf,
    reorderPoint,
    warehouseLocation
  } = request.body

  if (!productId) {
    return response.status(400).json({
      error: 'Product ID is required'
    })
  }

  try {
    // Verify product exists
    const product = await Product.findById(productId)
    if (!product) {
      return response.status(400).json({
        error: 'Product not found'
      })
    }

    // Check if inventory already exists
    const existingInventory = await Inventory.findOne({ product: productId })
    if (existingInventory) {
      return response.status(400).json({
        error: 'Inventory already exists for this product'
      })
    }

    const inventory = new Inventory({
      product: productId,
      quantityOnHand: quantityOnHand || 0,
      quantityReserved: quantityReserved || 0,
      quantityOnShelf: quantityOnShelf || 0,
      reorderPoint: reorderPoint || 10,
      warehouseLocation
    })

    const savedInventory = await inventory.save()

    response.status(201).json({
      success: true,
      message: 'Inventory created successfully',
      data: {
        inventory: {
          id: savedInventory._id,
          productId: savedInventory.product,
          quantityOnHand: savedInventory.quantityOnHand,
          quantityReserved: savedInventory.quantityReserved,
          quantityOnShelf: savedInventory.quantityOnShelf,
          quantityAvailable: savedInventory.quantityAvailable,
          totalQuantity: savedInventory.totalQuantity,
          reorderPoint: savedInventory.reorderPoint,
          warehouseLocation: savedInventory.warehouseLocation,
          createdAt: savedInventory.createdAt
        }
      }
    })
  } catch (error) {
    if (error.name === 'ValidationError') {
      return response.status(400).json({
        error: error.message
      })
    }
    if (error.code === 11000) {
      return response.status(400).json({
        error: 'Inventory already exists for this product'
      })
    }
    response.status(500).json({
      error: 'Failed to create inventory'
    })
  }
})

// PUT /api/inventories/:id - Update inventory quantities (Admin only)
inventoriesRouter.put('/:id', userExtractor, isAdmin, async (request, response) => {
  const { quantityOnHand, quantityReserved, quantityOnShelf } = request.body

  try {
    const inventory = await Inventory.findById(request.params.id)

    if (!inventory) {
      return response.status(404).json({
        error: 'Inventory not found'
      })
    }

    // Use the updateQuantities method from the model
    await inventory.updateQuantities(quantityOnHand, quantityReserved, quantityOnShelf)

    response.status(200).json({
      success: true,
      message: 'Inventory quantities updated successfully',
      data: {
        inventory: {
          id: inventory._id,
          productId: inventory.product,
          quantityOnHand: inventory.quantityOnHand,
          quantityReserved: inventory.quantityReserved,
          quantityOnShelf: inventory.quantityOnShelf,
          quantityAvailable: inventory.quantityAvailable,
          totalQuantity: inventory.totalQuantity,
          updatedAt: inventory.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.name === 'ValidationError') {
      return response.status(400).json({
        error: error.message
      })
    }
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid inventory ID'
      })
    }
    response.status(500).json({
      error: 'Failed to update inventory'
    })
  }
})

// PATCH /api/inventories/:id/reorder-point - Update reorder point (Admin only)
inventoriesRouter.patch('/:id/reorder-point', userExtractor, isAdmin, async (request, response) => {
  const { reorderPoint } = request.body

  if (reorderPoint === undefined || reorderPoint < 0) {
    return response.status(400).json({
      error: 'Valid reorder point is required (must be >= 0)'
    })
  }

  try {
    const inventory = await Inventory.findById(request.params.id)

    if (!inventory) {
      return response.status(404).json({
        error: 'Inventory not found'
      })
    }

    inventory.reorderPoint = reorderPoint
    await inventory.save()

    response.status(200).json({
      success: true,
      message: 'Reorder point updated successfully',
      data: {
        inventory: {
          id: inventory._id,
          productId: inventory.product,
          reorderPoint: inventory.reorderPoint,
          quantityAvailable: inventory.quantityAvailable,
          needsReorder: inventory.needsReorder(),
          updatedAt: inventory.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.name === 'ValidationError') {
      return response.status(400).json({
        error: error.message
      })
    }
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid inventory ID'
      })
    }
    response.status(500).json({
      error: 'Failed to update reorder point'
    })
  }
})

// PATCH /api/inventories/:id/location - Update warehouse location (Admin only)
inventoriesRouter.patch('/:id/location', userExtractor, isAdmin, async (request, response) => {
  const { warehouseLocation } = request.body

  if (!warehouseLocation) {
    return response.status(400).json({
      error: 'Warehouse location is required'
    })
  }

  try {
    const inventory = await Inventory.findById(request.params.id)

    if (!inventory) {
      return response.status(404).json({
        error: 'Inventory not found'
      })
    }

    inventory.warehouseLocation = warehouseLocation
    await inventory.save()

    response.status(200).json({
      success: true,
      message: 'Warehouse location updated successfully',
      data: {
        inventory: {
          id: inventory._id,
          productId: inventory.product,
          warehouseLocation: inventory.warehouseLocation,
          updatedAt: inventory.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid inventory ID'
      })
    }
    response.status(500).json({
      error: 'Failed to update warehouse location'
    })
  }
})

// PATCH /api/inventories/:id/adjust - Adjust inventory (receive/return goods) (Admin only)
inventoriesRouter.patch('/:id/adjust', userExtractor, isAdmin, async (request, response) => {
  const { quantity, type, reason } = request.body

  if (!quantity || quantity <= 0) {
    return response.status(400).json({
      error: 'Quantity must be greater than 0'
    })
  }

  if (!type || !['in', 'out'].includes(type)) {
    return response.status(400).json({
      error: 'Type must be either "in" or "out"'
    })
  }

  try {
    const inventory = await Inventory.findById(request.params.id)

    if (!inventory) {
      return response.status(404).json({
        error: 'Inventory not found'
      })
    }

    // Use the adjustInventory method from the model
    await inventory.adjustInventory(quantity, type)

    // Create inventory movement record
    const movement = new InventoryMovement({
      inventory: inventory._id,
      product: inventory.product,
      movementType: type === 'in' ? 'receive' : 'adjustment',
      quantity: type === 'in' ? quantity : -quantity,
      reason: reason || `Inventory ${type === 'in' ? 'received' : 'adjustment'}`,
      performedBy: request.user.id
    })
    await movement.save()

    response.status(200).json({
      success: true,
      message: `Inventory ${type === 'in' ? 'received' : 'adjusted'} successfully`,
      data: {
        inventory: {
          id: inventory._id,
          productId: inventory.product,
          quantityOnHand: inventory.quantityOnHand,
          quantityOnShelf: inventory.quantityOnShelf,
          quantityReserved: inventory.quantityReserved,
          quantityAvailable: inventory.quantityAvailable,
          totalQuantity: inventory.totalQuantity,
          updatedAt: inventory.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.message.includes('Insufficient')) {
      return response.status(400).json({
        error: error.message
      })
    }
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid inventory ID'
      })
    }
    response.status(500).json({
      error: 'Failed to adjust inventory'
    })
  }
})

// PATCH /api/inventories/:id/reserve - Reserve inventory (Admin only)
inventoriesRouter.patch('/:id/reserve', userExtractor, isAdmin, async (request, response) => {
  const { quantity, orderId } = request.body

  if (!quantity || quantity <= 0) {
    return response.status(400).json({
      error: 'Quantity must be greater than 0'
    })
  }

  try {
    const inventory = await Inventory.findById(request.params.id)

    if (!inventory) {
      return response.status(404).json({
        error: 'Inventory not found'
      })
    }

    // Use the reserveInventory method from the model
    await inventory.reserveInventory(quantity)

    // Create inventory movement record
    const movement = new InventoryMovement({
      inventory: inventory._id,
      product: inventory.product,
      movementType: 'reserve',
      quantity: -quantity,
      reason: orderId ? `Reserved for order ${orderId}` : 'Reserved for customer order',
      relatedOrder: orderId,
      performedBy: request.user.id
    })
    await movement.save()

    response.status(200).json({
      success: true,
      message: 'Inventory reserved successfully',
      data: {
        inventory: {
          id: inventory._id,
          productId: inventory.product,
          quantityOnHand: inventory.quantityOnHand,
          quantityOnShelf: inventory.quantityOnShelf,
          quantityReserved: inventory.quantityReserved,
          quantityAvailable: inventory.quantityAvailable,
          totalQuantity: inventory.totalQuantity,
          updatedAt: inventory.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.message.includes('Insufficient')) {
      return response.status(400).json({
        error: error.message
      })
    }
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid inventory ID'
      })
    }
    response.status(500).json({
      error: 'Failed to reserve inventory'
    })
  }
})

// PATCH /api/inventories/:id/release - Release reserved inventory (Admin only)
inventoriesRouter.patch('/:id/release', userExtractor, isAdmin, async (request, response) => {
  const { quantity, returnToShelf, reason } = request.body

  if (!quantity || quantity <= 0) {
    return response.status(400).json({
      error: 'Quantity must be greater than 0'
    })
  }

  try {
    const inventory = await Inventory.findById(request.params.id)

    if (!inventory) {
      return response.status(404).json({
        error: 'Inventory not found'
      })
    }

    // Use the releaseReservation method from the model
    await inventory.releaseReservation(quantity, returnToShelf !== false)

    // Create inventory movement record
    const movement = new InventoryMovement({
      inventory: inventory._id,
      product: inventory.product,
      movementType: 'release',
      quantity: quantity,
      reason: reason || 'Order cancelled - reservation released',
      performedBy: request.user.id
    })
    await movement.save()

    response.status(200).json({
      success: true,
      message: 'Reservation released successfully',
      data: {
        inventory: {
          id: inventory._id,
          productId: inventory.product,
          quantityOnHand: inventory.quantityOnHand,
          quantityOnShelf: inventory.quantityOnShelf,
          quantityReserved: inventory.quantityReserved,
          quantityAvailable: inventory.quantityAvailable,
          totalQuantity: inventory.totalQuantity,
          updatedAt: inventory.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.message.includes('Cannot release')) {
      return response.status(400).json({
        error: error.message
      })
    }
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid inventory ID'
      })
    }
    response.status(500).json({
      error: 'Failed to release reservation'
    })
  }
})

// PATCH /api/inventories/:id/complete-delivery - Complete delivery (Admin only)
inventoriesRouter.patch('/:id/complete-delivery', userExtractor, isAdmin, async (request, response) => {
  const { quantity, orderId } = request.body

  if (!quantity || quantity <= 0) {
    return response.status(400).json({
      error: 'Quantity must be greater than 0'
    })
  }

  try {
    const inventory = await Inventory.findById(request.params.id)

    if (!inventory) {
      return response.status(404).json({
        error: 'Inventory not found'
      })
    }

    // Use the completeDelivery method from the model
    await inventory.completeDelivery(quantity)

    // Create inventory movement record
    const movement = new InventoryMovement({
      inventory: inventory._id,
      product: inventory.product,
      movementType: 'sale',
      quantity: -quantity,
      reason: orderId ? `Delivered to customer - Order ${orderId}` : 'Delivered to customer',
      relatedOrder: orderId,
      performedBy: request.user.id
    })
    await movement.save()

    response.status(200).json({
      success: true,
      message: 'Delivery completed successfully',
      data: {
        inventory: {
          id: inventory._id,
          productId: inventory.product,
          quantityOnHand: inventory.quantityOnHand,
          quantityOnShelf: inventory.quantityOnShelf,
          quantityReserved: inventory.quantityReserved,
          quantityAvailable: inventory.quantityAvailable,
          totalQuantity: inventory.totalQuantity,
          updatedAt: inventory.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.message.includes('Cannot complete')) {
      return response.status(400).json({
        error: error.message
      })
    }
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid inventory ID'
      })
    }
    response.status(500).json({
      error: 'Failed to complete delivery'
    })
  }
})

// PATCH /api/inventories/:id/move-to-shelf - Move stock to shelf (Admin only)
inventoriesRouter.patch('/:id/move-to-shelf', userExtractor, isAdmin, async (request, response) => {
  const { quantity } = request.body

  if (!quantity || quantity <= 0) {
    return response.status(400).json({
      error: 'Quantity must be greater than 0'
    })
  }

  try {
    const inventory = await Inventory.findById(request.params.id)

    if (!inventory) {
      return response.status(404).json({
        error: 'Inventory not found'
      })
    }

    // Use the moveToShelf method from the model
    await inventory.moveToShelf(quantity)

    // Create inventory movement record
    const movement = new InventoryMovement({
      inventory: inventory._id,
      product: inventory.product,
      movementType: 'transfer',
      quantity: 0, // Net change is 0 (just moving location)
      reason: `Moved ${quantity} units from warehouse to shelf`,
      performedBy: request.user.id
    })
    await movement.save()

    response.status(200).json({
      success: true,
      message: 'Stock moved to shelf successfully',
      data: {
        inventory: {
          id: inventory._id,
          productId: inventory.product,
          quantityOnHand: inventory.quantityOnHand,
          quantityOnShelf: inventory.quantityOnShelf,
          quantityReserved: inventory.quantityReserved,
          quantityAvailable: inventory.quantityAvailable,
          totalQuantity: inventory.totalQuantity,
          updatedAt: inventory.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.message.includes('Insufficient')) {
      return response.status(400).json({
        error: error.message
      })
    }
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid inventory ID'
      })
    }
    response.status(500).json({
      error: 'Failed to move stock to shelf'
    })
  }
})

// PATCH /api/inventories/:id/move-to-warehouse - Move stock back to warehouse (Admin only)
inventoriesRouter.patch('/:id/move-to-warehouse', userExtractor, isAdmin, async (request, response) => {
  const { quantity } = request.body

  if (!quantity || quantity <= 0) {
    return response.status(400).json({
      error: 'Quantity must be greater than 0'
    })
  }

  try {
    const inventory = await Inventory.findById(request.params.id)

    if (!inventory) {
      return response.status(404).json({
        error: 'Inventory not found'
      })
    }

    // Use the moveToWarehouse method from the model
    await inventory.moveToWarehouse(quantity)

    // Create inventory movement record
    const movement = new InventoryMovement({
      inventory: inventory._id,
      product: inventory.product,
      movementType: 'transfer',
      quantity: 0, // Net change is 0 (just moving location)
      reason: `Moved ${quantity} units from shelf to warehouse`,
      performedBy: request.user.id
    })
    await movement.save()

    response.status(200).json({
      success: true,
      message: 'Stock moved to warehouse successfully',
      data: {
        inventory: {
          id: inventory._id,
          productId: inventory.product,
          quantityOnHand: inventory.quantityOnHand,
          quantityOnShelf: inventory.quantityOnShelf,
          quantityReserved: inventory.quantityReserved,
          quantityAvailable: inventory.quantityAvailable,
          totalQuantity: inventory.totalQuantity,
          updatedAt: inventory.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.message.includes('Cannot remove')) {
      return response.status(400).json({
        error: error.message
      })
    }
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid inventory ID'
      })
    }
    response.status(500).json({
      error: 'Failed to move stock to warehouse'
    })
  }
})

// DELETE /api/inventories/:id - Delete inventory (Admin only)
inventoriesRouter.delete('/:id', userExtractor, isAdmin, async (request, response) => {
  try {
    const inventory = await Inventory.findById(request.params.id)

    if (!inventory) {
      return response.status(404).json({
        error: 'Inventory not found'
      })
    }

    // Check if inventory has stock
    if (inventory.totalQuantity > 0) {
      return response.status(400).json({
        error: `Cannot delete inventory with ${inventory.totalQuantity} item(s) in stock. Please clear inventory first.`
      })
    }

    // Check if there are reserved items
    if (inventory.quantityReserved > 0) {
      return response.status(400).json({
        error: `Cannot delete inventory with ${inventory.quantityReserved} reserved item(s). Please release reservations first.`
      })
    }

    await Inventory.findByIdAndDelete(request.params.id)

    response.status(200).json({
      success: true,
      message: 'Inventory deleted successfully'
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid inventory ID'
      })
    }
    response.status(500).json({
      error: 'Failed to delete inventory'
    })
  }
})

module.exports = inventoriesRouter
