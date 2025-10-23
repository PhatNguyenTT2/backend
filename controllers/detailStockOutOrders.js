const detailStockOutOrdersRouter = require('express').Router()
const DetailStockOutOrder = require('../models/detailStockOutOrder')
const StockOutOrder = require('../models/stockOutOrder')
const Product = require('../models/product')
const { userExtractor, isAdmin } = require('../utils/auth')

// GET /api/detail-stock-out-orders - Get all detail stock out orders
detailStockOutOrdersRouter.get('/', userExtractor, isAdmin, async (request, response) => {
  try {
    const { stock_out_order_id, product_id } = request.query

    // Build filter
    const filter = {}
    if (stock_out_order_id) {
      filter.stockOutOrder = stock_out_order_id
    }
    if (product_id) {
      filter.product = product_id
    }

    const detailOrders = await DetailStockOutOrder.find(filter)
      .populate('stockOutOrder', 'soNumber orderDate status')
      .populate('product', 'productCode name vendor')
      .sort({ createdAt: -1 })

    const detailsData = detailOrders.map(detail => ({
      id: detail._id,
      stockOutOrder: detail.stockOutOrder ? {
        id: detail.stockOutOrder._id,
        soNumber: detail.stockOutOrder.soNumber,
        orderDate: detail.stockOutOrder.orderDate,
        status: detail.stockOutOrder.status
      } : null,
      product: detail.product ? {
        id: detail.product._id,
        productCode: detail.product.productCode,
        name: detail.product.name,
        vendor: detail.product.vendor
      } : null,
      quantity: detail.quantity,
      unitPrice: detail.unitPrice,
      total: detail.total,
      createdAt: detail.createdAt,
      updatedAt: detail.updatedAt
    }))

    response.status(200).json({
      success: true,
      data: {
        detailStockOutOrders: detailsData
      }
    })
  } catch (error) {
    response.status(500).json({
      error: 'Failed to fetch detail stock out orders'
    })
  }
})

// GET /api/detail-stock-out-orders/stock-out-order/:soId - Get details by stock out order
detailStockOutOrdersRouter.get('/stock-out-order/:soId', userExtractor, async (request, response) => {
  try {
    const details = await DetailStockOutOrder.getByStockOutOrder(request.params.soId)

    const detailsData = details.map(detail => ({
      id: detail._id,
      product: detail.product ? {
        id: detail.product._id,
        productCode: detail.product.productCode,
        name: detail.product.name,
        vendor: detail.product.vendor,
        image: detail.product.image,
        price: detail.product.price,
        stock: detail.product.stock
      } : null,
      quantity: detail.quantity,
      unitPrice: detail.unitPrice,
      total: detail.total,
      createdAt: detail.createdAt,
      updatedAt: detail.updatedAt
    }))

    response.status(200).json({
      success: true,
      data: {
        details: detailsData
      }
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid stock out order ID'
      })
    }
    response.status(500).json({
      error: 'Failed to fetch stock out order details'
    })
  }
})

// GET /api/detail-stock-out-orders/stock-out-order/:soId/product/:productId/total - Get total quantity by product
detailStockOutOrdersRouter.get('/stock-out-order/:soId/product/:productId/total', userExtractor, async (request, response) => {
  try {
    const totals = await DetailStockOutOrder.getTotalQuantityByProduct(
      request.params.soId,
      request.params.productId
    )

    response.status(200).json({
      success: true,
      data: {
        totalQuantity: totals.totalQuantity,
        totalAmount: totals.totalAmount
      }
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid ID'
      })
    }
    response.status(500).json({
      error: 'Failed to get totals'
    })
  }
})

// GET /api/detail-stock-out-orders/stock-out-order/:soId/low-stock - Get products with low stock warning
detailStockOutOrdersRouter.get('/stock-out-order/:soId/low-stock', userExtractor, isAdmin, async (request, response) => {
  try {
    const lowStockProducts = await DetailStockOutOrder.getProductsWithLowStock(request.params.soId)

    response.status(200).json({
      success: true,
      data: {
        lowStockProducts: lowStockProducts.map(item => ({
          product: {
            id: item.product._id,
            productCode: item.product.productCode,
            name: item.product.name,
            vendor: item.product.vendor
          },
          requested: item.requested,
          available: item.available,
          shortage: item.shortage
        }))
      }
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid stock out order ID'
      })
    }
    response.status(500).json({
      error: 'Failed to check stock levels'
    })
  }
})

// GET /api/detail-stock-out-orders/:id - Get single detail stock out order
detailStockOutOrdersRouter.get('/:id', userExtractor, async (request, response) => {
  try {
    const detail = await DetailStockOutOrder.findById(request.params.id)
      .populate('stockOutOrder', 'soNumber orderDate status expectedDeliveryDate')
      .populate('product', 'productCode name vendor price originalPrice image')

    if (!detail) {
      return response.status(404).json({
        error: 'Detail stock out order not found'
      })
    }

    response.status(200).json({
      success: true,
      data: {
        detailStockOutOrder: {
          id: detail._id,
          stockOutOrder: detail.stockOutOrder ? {
            id: detail.stockOutOrder._id,
            soNumber: detail.stockOutOrder.soNumber,
            orderDate: detail.stockOutOrder.orderDate,
            status: detail.stockOutOrder.status,
            expectedDeliveryDate: detail.stockOutOrder.expectedDeliveryDate
          } : null,
          product: detail.product ? {
            id: detail.product._id,
            productCode: detail.product.productCode,
            name: detail.product.name,
            vendor: detail.product.vendor,
            price: detail.product.price,
            originalPrice: detail.product.originalPrice,
            image: detail.product.image
          } : null,
          quantity: detail.quantity,
          unitPrice: detail.unitPrice,
          total: detail.total,
          createdAt: detail.createdAt,
          updatedAt: detail.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid detail stock out order ID'
      })
    }
    response.status(500).json({
      error: 'Failed to fetch detail stock out order'
    })
  }
})

// POST /api/detail-stock-out-orders - Create new detail stock out order (Admin only)
detailStockOutOrdersRouter.post('/', userExtractor, isAdmin, async (request, response) => {
  const { stockOutOrderId, productId, quantity, unitPrice, validateStock } = request.body

  if (!stockOutOrderId) {
    return response.status(400).json({
      error: 'Stock out order ID is required'
    })
  }

  if (!productId) {
    return response.status(400).json({
      error: 'Product ID is required'
    })
  }

  if (!quantity || quantity < 1) {
    return response.status(400).json({
      error: 'Valid quantity (minimum 1) is required'
    })
  }

  if (unitPrice === undefined || unitPrice < 0) {
    return response.status(400).json({
      error: 'Valid unit price is required'
    })
  }

  try {
    // Verify stock out order exists
    const stockOutOrder = await StockOutOrder.findById(stockOutOrderId)
    if (!stockOutOrder) {
      return response.status(400).json({
        error: 'Stock out order not found'
      })
    }

    // Only allow adding items to pending or processing orders
    if (stockOutOrder.status === 'completed' || stockOutOrder.status === 'cancelled') {
      return response.status(400).json({
        error: 'Cannot add items to completed or cancelled stock out orders'
      })
    }

    // Verify product exists
    const product = await Product.findById(productId)
    if (!product) {
      return response.status(400).json({
        error: 'Product not found'
      })
    }

    // Check if product already exists in this stock out order
    const exists = await DetailStockOutOrder.productExistsInSO(stockOutOrderId, productId)
    if (exists) {
      return response.status(400).json({
        error: 'Product already exists in this stock out order. Please update the existing item instead.'
      })
    }

    let detail

    // Use createDetailWithValidation if validateStock is true (reserves inventory)
    if (validateStock === true) {
      detail = await DetailStockOutOrder.createDetailWithValidation({
        stockOutOrder: stockOutOrderId,
        product: productId,
        quantity,
        unitPrice
      })
    } else {
      // Create detail without reserving inventory (will validate in pre-save hook)
      detail = new DetailStockOutOrder({
        stockOutOrder: stockOutOrderId,
        product: productId,
        quantity,
        unitPrice
      })
      await detail.save()
    }

    await detail.populate('stockOutOrder', 'soNumber')
    await detail.populate('product', 'productCode name vendor')

    response.status(201).json({
      success: true,
      message: 'Detail stock out order created successfully',
      data: {
        detailStockOutOrder: {
          id: detail._id,
          stockOutOrder: detail.stockOutOrder ? {
            id: detail.stockOutOrder._id,
            soNumber: detail.stockOutOrder.soNumber
          } : null,
          product: detail.product ? {
            id: detail.product._id,
            productCode: detail.product.productCode,
            name: detail.product.name,
            vendor: detail.product.vendor
          } : null,
          quantity: detail.quantity,
          unitPrice: detail.unitPrice,
          total: detail.total,
          createdAt: detail.createdAt
        }
      }
    })
  } catch (error) {
    if (error.name === 'ValidationError') {
      return response.status(400).json({
        error: error.message
      })
    }
    if (error.message && (
      error.message.includes('Insufficient stock') ||
      error.message.includes('inventory not found')
    )) {
      return response.status(400).json({
        error: error.message
      })
    }
    response.status(500).json({
      error: 'Failed to create detail stock out order'
    })
  }
})

// PUT /api/detail-stock-out-orders/:id - Update detail stock out order (Admin only)
detailStockOutOrdersRouter.put('/:id', userExtractor, isAdmin, async (request, response) => {
  const { quantity, unitPrice } = request.body

  try {
    const detail = await DetailStockOutOrder.findById(request.params.id)
      .populate('stockOutOrder', 'status')

    if (!detail) {
      return response.status(404).json({
        error: 'Detail stock out order not found'
      })
    }

    // Only allow updates for pending or processing orders
    if (detail.stockOutOrder.status === 'completed' || detail.stockOutOrder.status === 'cancelled') {
      return response.status(400).json({
        error: 'Cannot update items in completed or cancelled stock out orders'
      })
    }

    // Update fields
    if (quantity !== undefined) {
      if (quantity < 1) {
        return response.status(400).json({
          error: 'Quantity must be at least 1'
        })
      }
      detail.quantity = quantity
    }

    if (unitPrice !== undefined) {
      if (unitPrice < 0) {
        return response.status(400).json({
          error: 'Unit price cannot be negative'
        })
      }
      detail.unitPrice = unitPrice
    }

    const updatedDetail = await detail.save()
    await updatedDetail.populate('product', 'productCode name')

    response.status(200).json({
      success: true,
      message: 'Detail stock out order updated successfully',
      data: {
        detailStockOutOrder: {
          id: updatedDetail._id,
          product: updatedDetail.product ? {
            id: updatedDetail.product._id,
            productCode: updatedDetail.product.productCode,
            name: updatedDetail.product.name
          } : null,
          quantity: updatedDetail.quantity,
          unitPrice: updatedDetail.unitPrice,
          total: updatedDetail.total,
          updatedAt: updatedDetail.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.name === 'ValidationError') {
      return response.status(400).json({
        error: error.message
      })
    }
    if (error.message && error.message.includes('Insufficient stock')) {
      return response.status(400).json({
        error: error.message
      })
    }
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid detail stock out order ID'
      })
    }
    response.status(500).json({
      error: 'Failed to update detail stock out order'
    })
  }
})

// PATCH /api/detail-stock-out-orders/:id/quantity - Update quantity (Admin only)
detailStockOutOrdersRouter.patch('/:id/quantity', userExtractor, isAdmin, async (request, response) => {
  const { quantity } = request.body

  if (!quantity || quantity < 1) {
    return response.status(400).json({
      error: 'Valid quantity (minimum 1) is required'
    })
  }

  try {
    const detail = await DetailStockOutOrder.findById(request.params.id)
      .populate('stockOutOrder', 'status')

    if (!detail) {
      return response.status(404).json({
        error: 'Detail stock out order not found'
      })
    }

    // Only allow updates for pending or processing orders
    if (detail.stockOutOrder.status === 'completed' || detail.stockOutOrder.status === 'cancelled') {
      return response.status(400).json({
        error: 'Cannot update items in completed or cancelled stock out orders'
      })
    }

    // Use the updateQuantity method from the model
    const updatedDetail = await detail.updateQuantity(quantity)

    response.status(200).json({
      success: true,
      message: 'Quantity updated successfully',
      data: {
        detailStockOutOrder: {
          id: updatedDetail._id,
          quantity: updatedDetail.quantity,
          total: updatedDetail.total,
          updatedAt: updatedDetail.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.message === 'Quantity must be at least 1' || error.message.includes('Insufficient stock')) {
      return response.status(400).json({
        error: error.message
      })
    }
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid detail stock out order ID'
      })
    }
    response.status(500).json({
      error: 'Failed to update quantity'
    })
  }
})

// PATCH /api/detail-stock-out-orders/:id/unit-price - Update unit price (Admin only)
detailStockOutOrdersRouter.patch('/:id/unit-price', userExtractor, isAdmin, async (request, response) => {
  const { unitPrice } = request.body

  if (unitPrice === undefined || unitPrice < 0) {
    return response.status(400).json({
      error: 'Valid unit price is required'
    })
  }

  try {
    const detail = await DetailStockOutOrder.findById(request.params.id)
      .populate('stockOutOrder', 'status')

    if (!detail) {
      return response.status(404).json({
        error: 'Detail stock out order not found'
      })
    }

    // Only allow updates for pending or processing orders
    if (detail.stockOutOrder.status === 'completed' || detail.stockOutOrder.status === 'cancelled') {
      return response.status(400).json({
        error: 'Cannot update items in completed or cancelled stock out orders'
      })
    }

    // Use the updateUnitPrice method from the model
    const updatedDetail = await detail.updateUnitPrice(unitPrice)

    response.status(200).json({
      success: true,
      message: 'Unit price updated successfully',
      data: {
        detailStockOutOrder: {
          id: updatedDetail._id,
          unitPrice: updatedDetail.unitPrice,
          total: updatedDetail.total,
          updatedAt: updatedDetail.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.message === 'Unit price cannot be negative') {
      return response.status(400).json({
        error: error.message
      })
    }
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid detail stock out order ID'
      })
    }
    response.status(500).json({
      error: 'Failed to update unit price'
    })
  }
})

// DELETE /api/detail-stock-out-orders/:id - Delete detail stock out order (Admin only)
detailStockOutOrdersRouter.delete('/:id', userExtractor, isAdmin, async (request, response) => {
  try {
    const detail = await DetailStockOutOrder.findById(request.params.id)
      .populate('stockOutOrder', 'status')

    if (!detail) {
      return response.status(404).json({
        error: 'Detail stock out order not found'
      })
    }

    // Only allow deletion for pending or processing orders
    if (detail.stockOutOrder.status === 'completed' || detail.stockOutOrder.status === 'cancelled') {
      return response.status(400).json({
        error: 'Cannot delete items from completed or cancelled stock out orders'
      })
    }

    await DetailStockOutOrder.findByIdAndDelete(request.params.id)

    response.status(200).json({
      success: true,
      message: 'Detail stock out order deleted successfully'
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid detail stock out order ID'
      })
    }
    response.status(500).json({
      error: 'Failed to delete detail stock out order'
    })
  }
})

module.exports = detailStockOutOrdersRouter
