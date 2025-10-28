const inventoryMovementsRouter = require('express').Router()
const InventoryMovement = require('../models/inventoryMovement')
const Inventory = require('../models/inventory')
const Product = require('../models/product')
const PurchaseOrder = require('../models/purchaseOrder')
const { userExtractor, isAdmin } = require('../utils/auth')

// GET /api/inventory-movements - Get all inventory movements
inventoryMovementsRouter.get('/', userExtractor, async (request, response) => {
  try {
    const {
      movement_type,
      product_id,
      inventory_id,
      purchase_order_id,
      start_date,
      end_date,
      limit
    } = request.query

    // Build filter
    const filter = {}
    if (movement_type) {
      filter.movementType = movement_type
    }
    if (product_id) {
      filter.product = product_id
    }
    if (inventory_id) {
      filter.inventory = inventory_id
    }
    if (purchase_order_id) {
      filter.purchaseOrderId = purchase_order_id
    }
    if (start_date || end_date) {
      filter.date = {}
      if (start_date) {
        filter.date.$gte = new Date(start_date)
      }
      if (end_date) {
        filter.date.$lte = new Date(end_date)
      }
    }

    const movements = await InventoryMovement.find(filter)
      .sort({ date: -1, createdAt: -1 })
      .limit(limit ? parseInt(limit) : 100)

    const movementsData = movements.map(movement => ({
      id: movement._id,
      movementNumber: movement.movementNumber,
      productId: movement.product,
      inventoryId: movement.inventory,
      purchaseOrderId: movement.purchaseOrderId,
      movementType: movement.movementType,
      quantity: movement.quantity,
      reason: movement.reason,
      date: movement.date,
      performedBy: movement.performedBy,
      notes: movement.notes,
      createdAt: movement.createdAt,
      updatedAt: movement.updatedAt
    }))

    response.status(200).json({
      success: true,
      data: {
        inventoryMovements: movementsData
      }
    })
  } catch (error) {
    response.status(500).json({
      error: 'Failed to fetch inventory movements'
    })
  }
})

// GET /api/inventory-movements/stats/summary - Get movement statistics
inventoryMovementsRouter.get('/stats/summary', userExtractor, isAdmin, async (request, response) => {
  try {
    const { start_date, end_date } = request.query

    const filter = {}
    if (start_date || end_date) {
      filter.date = {}
      if (start_date) {
        filter.date.$gte = new Date(start_date)
      }
      if (end_date) {
        filter.date.$lte = new Date(end_date)
      }
    }

    const movements = await InventoryMovement.find(filter)

    // Calculate statistics
    const stats = {
      totalMovements: movements.length,
      byType: {
        in: movements.filter(m => m.movementType === 'in').length,
        out: movements.filter(m => m.movementType === 'out').length,
        adjustment: movements.filter(m => m.movementType === 'adjustment').length,
        reserved: movements.filter(m => m.movementType === 'reserved').length,
        released: movements.filter(m => m.movementType === 'released').length
      },
      totalQuantityIn: movements
        .filter(m => m.movementType === 'in')
        .reduce((sum, m) => sum + Math.abs(m.quantity), 0),
      totalQuantityOut: movements
        .filter(m => m.movementType === 'out')
        .reduce((sum, m) => sum + Math.abs(m.quantity), 0),
      totalQuantityReserved: movements
        .filter(m => m.movementType === 'reserved')
        .reduce((sum, m) => sum + Math.abs(m.quantity), 0),
      totalQuantityReleased: movements
        .filter(m => m.movementType === 'released')
        .reduce((sum, m) => sum + Math.abs(m.quantity), 0),
      netChange: movements.reduce((sum, m) => {
        if (m.movementType === 'in') return sum + Math.abs(m.quantity)
        if (m.movementType === 'out') return sum - Math.abs(m.quantity)
        return sum
      }, 0)
    }

    response.status(200).json({
      success: true,
      data: {
        statistics: stats
      }
    })
  } catch (error) {
    response.status(500).json({
      error: 'Failed to fetch movement statistics'
    })
  }
})

// GET /api/inventory-movements/stats/by-type/:type - Get movements by type
inventoryMovementsRouter.get('/stats/by-type/:type', userExtractor, async (request, response) => {
  try {
    const movementType = request.params.type
    const validTypes = ['in', 'out', 'adjustment', 'reserved', 'released']

    if (!validTypes.includes(movementType)) {
      return response.status(400).json({
        error: 'Invalid movement type. Valid types are: in, out, adjustment, reserved, released'
      })
    }

    const { start_date, end_date, limit } = request.query

    const filter = { movementType }
    if (start_date || end_date) {
      filter.date = {}
      if (start_date) {
        filter.date.$gte = new Date(start_date)
      }
      if (end_date) {
        filter.date.$lte = new Date(end_date)
      }
    }

    const movements = await InventoryMovement.find(filter)
      .sort({ date: -1 })
      .limit(limit ? parseInt(limit) : 50)

    const movementsData = movements.map(movement => ({
      id: movement._id,
      movementNumber: movement.movementNumber,
      productId: movement.product,
      inventoryId: movement.inventory,
      purchaseOrderId: movement.purchaseOrderId,
      movementType: movement.movementType,
      quantity: movement.quantity,
      reason: movement.reason,
      date: movement.date,
      performedBy: movement.performedBy,
      notes: movement.notes
    }))

    response.status(200).json({
      success: true,
      data: {
        movementType,
        totalMovements: movementsData.length,
        movements: movementsData
      }
    })
  } catch (error) {
    response.status(500).json({
      error: 'Failed to fetch movements by type'
    })
  }
})

// GET /api/inventory-movements/product/:productId - Get movement history for a product
inventoryMovementsRouter.get('/product/:productId', userExtractor, async (request, response) => {
  try {
    const { start_date, end_date, movement_type, limit } = request.query

    const options = {
      startDate: start_date,
      endDate: end_date,
      movementType: movement_type,
      limit: limit ? parseInt(limit) : 50
    }

    const movements = await InventoryMovement.getProductHistory(
      request.params.productId,
      options
    )

    const movementsData = movements.map(movement => ({
      id: movement._id,
      movementNumber: movement.movementNumber,
      productId: movement.product,
      inventoryId: movement.inventory,
      purchaseOrderId: movement.purchaseOrderId,
      movementType: movement.movementType,
      quantity: movement.quantity,
      reason: movement.reason,
      date: movement.date,
      performedBy: movement.performedBy,
      notes: movement.notes,
      createdAt: movement.createdAt
    }))

    response.status(200).json({
      success: true,
      data: {
        productId: request.params.productId,
        totalMovements: movementsData.length,
        movements: movementsData
      }
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid product ID'
      })
    }
    response.status(500).json({
      error: 'Failed to fetch product movement history'
    })
  }
})

// GET /api/inventory-movements/inventory/:inventoryId - Get movements for an inventory
inventoryMovementsRouter.get('/inventory/:inventoryId', userExtractor, async (request, response) => {
  try {
    const { start_date, end_date, movement_type, limit } = request.query

    const filter = { inventory: request.params.inventoryId }
    if (movement_type) {
      filter.movementType = movement_type
    }
    if (start_date || end_date) {
      filter.date = {}
      if (start_date) {
        filter.date.$gte = new Date(start_date)
      }
      if (end_date) {
        filter.date.$lte = new Date(end_date)
      }
    }

    const movements = await InventoryMovement.find(filter)
      .sort({ date: -1 })
      .limit(limit ? parseInt(limit) : 50)

    const movementsData = movements.map(movement => ({
      id: movement._id,
      movementNumber: movement.movementNumber,
      productId: movement.product,
      inventoryId: movement.inventory,
      purchaseOrderId: movement.purchaseOrderId,
      movementType: movement.movementType,
      quantity: movement.quantity,
      reason: movement.reason,
      date: movement.date,
      performedBy: movement.performedBy,
      notes: movement.notes,
      createdAt: movement.createdAt
    }))

    response.status(200).json({
      success: true,
      data: {
        inventoryId: request.params.inventoryId,
        totalMovements: movementsData.length,
        movements: movementsData
      }
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid inventory ID'
      })
    }
    response.status(500).json({
      error: 'Failed to fetch inventory movements'
    })
  }
})

// GET /api/inventory-movements/purchase-order/:purchaseOrderId - Get movements for a purchase order
inventoryMovementsRouter.get('/purchase-order/:purchaseOrderId', userExtractor, async (request, response) => {
  try {
    const movements = await InventoryMovement.find({
      purchaseOrderId: request.params.purchaseOrderId
    })
      .sort({ date: -1 })

    const movementsData = movements.map(movement => ({
      id: movement._id,
      movementNumber: movement.movementNumber,
      productId: movement.product,
      inventoryId: movement.inventory,
      purchaseOrderId: movement.purchaseOrderId,
      movementType: movement.movementType,
      quantity: movement.quantity,
      reason: movement.reason,
      date: movement.date,
      performedBy: movement.performedBy,
      notes: movement.notes
    }))

    response.status(200).json({
      success: true,
      data: {
        purchaseOrderId: request.params.purchaseOrderId,
        totalMovements: movementsData.length,
        movements: movementsData
      }
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid purchase order ID'
      })
    }
    response.status(500).json({
      error: 'Failed to fetch purchase order movements'
    })
  }
})

// GET /api/inventory-movements/number/:movementNumber - Get movement by number
inventoryMovementsRouter.get('/number/:movementNumber', userExtractor, async (request, response) => {
  try {
    const movement = await InventoryMovement.findOne({
      movementNumber: request.params.movementNumber.toUpperCase()
    })

    if (!movement) {
      return response.status(404).json({
        error: 'Movement not found'
      })
    }

    response.status(200).json({
      success: true,
      data: {
        inventoryMovement: {
          id: movement._id,
          movementNumber: movement.movementNumber,
          productId: movement.product,
          inventoryId: movement.inventory,
          purchaseOrderId: movement.purchaseOrderId,
          movementType: movement.movementType,
          quantity: movement.quantity,
          reason: movement.reason,
          date: movement.date,
          performedBy: movement.performedBy,
          notes: movement.notes,
          createdAt: movement.createdAt,
          updatedAt: movement.updatedAt
        }
      }
    })
  } catch (error) {
    response.status(500).json({
      error: 'Failed to fetch movement'
    })
  }
})

// GET /api/inventory-movements/:id - Get single inventory movement
inventoryMovementsRouter.get('/:id', userExtractor, async (request, response) => {
  try {
    const movement = await InventoryMovement.findById(request.params.id)

    if (!movement) {
      return response.status(404).json({
        error: 'Movement not found'
      })
    }

    response.status(200).json({
      success: true,
      data: {
        inventoryMovement: {
          id: movement._id,
          movementNumber: movement.movementNumber,
          productId: movement.product,
          inventoryId: movement.inventory,
          purchaseOrderId: movement.purchaseOrderId,
          movementType: movement.movementType,
          quantity: movement.quantity,
          reason: movement.reason,
          date: movement.date,
          performedBy: movement.performedBy,
          notes: movement.notes,
          createdAt: movement.createdAt,
          updatedAt: movement.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid movement ID'
      })
    }
    response.status(500).json({
      error: 'Failed to fetch movement'
    })
  }
})

// POST /api/inventory-movements - Create new inventory movement (Admin only)
inventoryMovementsRouter.post('/', userExtractor, isAdmin, async (request, response) => {
  const {
    productId,
    inventoryId,
    purchaseOrderId,
    movementType,
    quantity,
    reason,
    date,
    notes
  } = request.body

  if (!productId) {
    return response.status(400).json({
      error: 'Product ID is required'
    })
  }

  if (!inventoryId) {
    return response.status(400).json({
      error: 'Inventory ID is required'
    })
  }

  if (!movementType) {
    return response.status(400).json({
      error: 'Movement type is required'
    })
  }

  if (!quantity || quantity === 0) {
    return response.status(400).json({
      error: 'Quantity is required and cannot be zero'
    })
  }

  const validTypes = ['in', 'out', 'adjustment', 'reserved', 'released']
  if (!validTypes.includes(movementType)) {
    return response.status(400).json({
      error: 'Invalid movement type. Valid types are: in, out, adjustment, reserved, released'
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

    // Verify inventory exists
    const inventory = await Inventory.findById(inventoryId)
    if (!inventory) {
      return response.status(400).json({
        error: 'Inventory not found'
      })
    }

    // Verify inventory belongs to product
    if (inventory.product.toString() !== productId) {
      return response.status(400).json({
        error: 'Inventory does not belong to the specified product'
      })
    }

    // Verify purchase order if provided
    if (purchaseOrderId) {
      const purchaseOrder = await PurchaseOrder.findById(purchaseOrderId)
      if (!purchaseOrder) {
        return response.status(400).json({
          error: 'Purchase order not found'
        })
      }
    }

    const movementData = {
      product: productId,
      inventory: inventoryId,
      purchaseOrderId: purchaseOrderId || null,
      movementType,
      quantity,
      reason,
      date: date ? new Date(date) : new Date(),
      performedBy: request.user.id,
      notes
    }

    // Use static method to create movement and update inventory atomically
    const savedMovement = await InventoryMovement.createMovementAndUpdateInventory(movementData)

    response.status(201).json({
      success: true,
      message: 'Inventory movement created successfully',
      data: {
        inventoryMovement: {
          id: savedMovement._id,
          movementNumber: savedMovement.movementNumber,
          productId: savedMovement.product,
          inventoryId: savedMovement.inventory,
          purchaseOrderId: savedMovement.purchaseOrderId,
          movementType: savedMovement.movementType,
          quantity: savedMovement.quantity,
          reason: savedMovement.reason,
          date: savedMovement.date,
          performedBy: savedMovement.performedBy,
          notes: savedMovement.notes,
          createdAt: savedMovement.createdAt
        }
      }
    })
  } catch (error) {
    if (error.name === 'ValidationError') {
      return response.status(400).json({
        error: error.message
      })
    }
    if (error.message.includes('Insufficient') || error.message.includes('Cannot release')) {
      return response.status(400).json({
        error: error.message
      })
    }
    if (error.code === 11000) {
      return response.status(400).json({
        error: 'Movement number already exists'
      })
    }
    response.status(500).json({
      error: 'Failed to create inventory movement'
    })
  }
})

// PUT /api/inventory-movements/:id - Update inventory movement (Admin only)
inventoryMovementsRouter.put('/:id', userExtractor, isAdmin, async (request, response) => {
  const { reason, notes, date } = request.body

  try {
    const movement = await InventoryMovement.findById(request.params.id)

    if (!movement) {
      return response.status(404).json({
        error: 'Movement not found'
      })
    }

    // Only allow updating non-critical fields
    if (reason !== undefined) {
      movement.reason = reason
    }
    if (notes !== undefined) {
      movement.notes = notes
    }
    if (date) {
      movement.date = new Date(date)
    }

    const updatedMovement = await movement.save()

    response.status(200).json({
      success: true,
      message: 'Movement updated successfully',
      data: {
        inventoryMovement: {
          id: updatedMovement._id,
          movementNumber: updatedMovement.movementNumber,
          productId: updatedMovement.product,
          inventoryId: updatedMovement.inventory,
          purchaseOrderId: updatedMovement.purchaseOrderId,
          movementType: updatedMovement.movementType,
          quantity: updatedMovement.quantity,
          reason: updatedMovement.reason,
          date: updatedMovement.date,
          performedBy: updatedMovement.performedBy,
          notes: updatedMovement.notes,
          updatedAt: updatedMovement.updatedAt
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
        error: 'Invalid movement ID'
      })
    }
    response.status(500).json({
      error: 'Failed to update movement'
    })
  }
})

// DELETE /api/inventory-movements/:id - Delete inventory movement (Admin only)
// Note: This should be used carefully as it doesn't reverse the inventory changes
inventoryMovementsRouter.delete('/:id', userExtractor, isAdmin, async (request, response) => {
  try {
    const movement = await InventoryMovement.findById(request.params.id)

    if (!movement) {
      return response.status(404).json({
        error: 'Movement not found'
      })
    }

    // Check if movement was created recently (within 24 hours)
    const movementAge = Date.now() - new Date(movement.createdAt).getTime()
    const twentyFourHours = 24 * 60 * 60 * 1000

    if (movementAge > twentyFourHours) {
      return response.status(400).json({
        error: 'Cannot delete movements older than 24 hours. Please create a reversal movement instead.'
      })
    }

    await InventoryMovement.findByIdAndDelete(request.params.id)

    response.status(200).json({
      success: true,
      message: 'Movement deleted successfully',
      warning: 'Note: This does not reverse inventory changes. Please adjust inventory manually if needed.'
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid movement ID'
      })
    }
    response.status(500).json({
      error: 'Failed to delete movement'
    })
  }
})

module.exports = inventoryMovementsRouter
