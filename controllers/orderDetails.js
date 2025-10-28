const orderDetailsRouter = require('express').Router()
const OrderDetail = require('../models/orderDetail')
const Order = require('../models/order')
const Product = require('../models/product')
const Inventory = require('../models/inventory')
const { userExtractor, isAdmin } = require('../utils/auth')

// GET /api/order-details - Get all order details (Admin only)
orderDetailsRouter.get('/', userExtractor, isAdmin, async (request, response) => {
  try {
    const {
      order_id,
      product_id,
      start_date,
      end_date,
      min_quantity,
      max_quantity,
      limit
    } = request.query

    // Build filter
    const filter = {}
    if (order_id) {
      filter.order = order_id
    }
    if (product_id) {
      filter.product = product_id
    }
    if (min_quantity) {
      filter.quantity = { $gte: parseInt(min_quantity) }
    }
    if (max_quantity) {
      filter.quantity = { ...filter.quantity, $lte: parseInt(max_quantity) }
    }
    if (start_date || end_date) {
      filter.createdAt = {}
      if (start_date) {
        filter.createdAt.$gte = new Date(start_date)
      }
      if (end_date) {
        filter.createdAt.$lte = new Date(end_date)
      }
    }

    const orderDetails = await OrderDetail.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit ? parseInt(limit) : 100)

    const detailsData = orderDetails.map(detail => ({
      id: detail._id,
      orderId: detail.order,
      productId: detail.product,
      quantity: detail.quantity,
      unitPrice: detail.unitPrice,
      total: detail.total,
      notes: detail.notes,
      createdAt: detail.createdAt,
      updatedAt: detail.updatedAt
    }))

    response.status(200).json({
      success: true,
      data: {
        orderDetails: detailsData
      }
    })
  } catch (error) {
    response.status(500).json({
      error: 'Failed to fetch order details'
    })
  }
})

// GET /api/order-details/stats/best-selling - Get best selling products
orderDetailsRouter.get('/stats/best-selling', userExtractor, async (request, response) => {
  try {
    const { start_date, end_date, limit } = request.query

    const options = {}
    if (start_date) options.startDate = start_date
    if (end_date) options.endDate = end_date

    const bestSelling = await OrderDetail.getBestSellingProducts(
      limit ? parseInt(limit) : 10,
      options
    )

    response.status(200).json({
      success: true,
      data: {
        bestSellingProducts: bestSelling
      }
    })
  } catch (error) {
    response.status(500).json({
      error: 'Failed to fetch best selling products'
    })
  }
})

// GET /api/order-details/order/:orderId - Get details by order
orderDetailsRouter.get('/order/:orderId', userExtractor, async (request, response) => {
  try {
    const orderDetails = await OrderDetail.getByOrder(request.params.orderId)

    const detailsData = orderDetails.map(detail => ({
      id: detail._id,
      orderId: detail.order,
      productId: detail.product,
      quantity: detail.quantity,
      unitPrice: detail.unitPrice,
      total: detail.total,
      notes: detail.notes,
      createdAt: detail.createdAt,
      updatedAt: detail.updatedAt
    }))

    response.status(200).json({
      success: true,
      data: {
        orderId: request.params.orderId,
        orderDetails: detailsData
      }
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid order ID'
      })
    }
    response.status(500).json({
      error: 'Failed to fetch order details'
    })
  }
})

// GET /api/order-details/product/:productId/summary - Get product summary in orders
orderDetailsRouter.get('/product/:productId/summary', userExtractor, async (request, response) => {
  try {
    const { order_id } = request.query

    if (!order_id) {
      return response.status(400).json({
        error: 'Order ID is required'
      })
    }

    const summary = await OrderDetail.getTotalQuantityByProduct(
      order_id,
      request.params.productId
    )

    response.status(200).json({
      success: true,
      data: {
        productId: request.params.productId,
        orderId: order_id,
        totalQuantity: summary.totalQuantity,
        totalAmount: summary.totalAmount
      }
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid product ID or order ID'
      })
    }
    response.status(500).json({
      error: 'Failed to fetch product summary'
    })
  }
})

// GET /api/order-details/:id - Get single order detail
orderDetailsRouter.get('/:id', userExtractor, async (request, response) => {
  try {
    const orderDetail = await OrderDetail.findById(request.params.id)

    if (!orderDetail) {
      return response.status(404).json({
        error: 'Order detail not found'
      })
    }

    response.status(200).json({
      success: true,
      data: {
        orderDetail: {
          id: orderDetail._id,
          orderId: orderDetail.order,
          productId: orderDetail.product,
          quantity: orderDetail.quantity,
          unitPrice: orderDetail.unitPrice,
          total: orderDetail.total,
          notes: orderDetail.notes,
          createdAt: orderDetail.createdAt,
          updatedAt: orderDetail.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid order detail ID'
      })
    }
    response.status(500).json({
      error: 'Failed to fetch order detail'
    })
  }
})

// POST /api/order-details - Create new order detail with inventory reservation
orderDetailsRouter.post('/', userExtractor, async (request, response) => {
  const {
    orderId,
    productId,
    quantity,
    unitPrice,
    notes
  } = request.body

  if (!orderId) {
    return response.status(400).json({
      error: 'Order ID is required'
    })
  }

  if (!productId) {
    return response.status(400).json({
      error: 'Product ID is required'
    })
  }

  if (!quantity || quantity < 1) {
    return response.status(400).json({
      error: 'Quantity must be at least 1'
    })
  }

  if (unitPrice === undefined || unitPrice < 0) {
    return response.status(400).json({
      error: 'Unit price is required and cannot be negative'
    })
  }

  try {
    // Verify order exists and is not cancelled or delivered
    const order = await Order.findById(orderId)
    if (!order) {
      return response.status(400).json({
        error: 'Order not found'
      })
    }

    if (order.status === 'cancelled') {
      return response.status(400).json({
        error: 'Cannot add items to cancelled order'
      })
    }

    if (order.status === 'delivered') {
      return response.status(400).json({
        error: 'Cannot add items to delivered order'
      })
    }

    // Check if product already exists in order
    const productExists = await OrderDetail.productExistsInOrder(orderId, productId)
    if (productExists) {
      return response.status(400).json({
        error: 'Product already exists in this order. Please update the existing detail instead.'
      })
    }

    // Verify product exists and is active
    const product = await Product.findById(productId)
    if (!product) {
      return response.status(400).json({
        error: 'Product not found'
      })
    }

    if (!product.isActive) {
      return response.status(400).json({
        error: 'Product is not active'
      })
    }

    const detailData = {
      order: orderId,
      product: productId,
      quantity,
      unitPrice,
      notes
    }

    // Use static method to create detail and reserve inventory atomically
    const savedDetail = await OrderDetail.createDetailAndReserveInventory(detailData)

    response.status(201).json({
      success: true,
      message: 'Order detail created successfully and inventory reserved',
      data: {
        orderDetail: {
          id: savedDetail._id,
          orderId: savedDetail.order,
          productId: savedDetail.product,
          quantity: savedDetail.quantity,
          unitPrice: savedDetail.unitPrice,
          total: savedDetail.total,
          notes: savedDetail.notes,
          createdAt: savedDetail.createdAt
        }
      }
    })
  } catch (error) {
    if (error.name === 'ValidationError') {
      return response.status(400).json({
        error: error.message
      })
    }
    if (error.message.includes('Insufficient stock') ||
      error.message.includes('not found') ||
      error.message.includes('not active')) {
      return response.status(400).json({
        error: error.message
      })
    }
    response.status(500).json({
      error: 'Failed to create order detail'
    })
  }
})

// PUT /api/order-details/:id - Update order detail
orderDetailsRouter.put('/:id', userExtractor, async (request, response) => {
  const { quantity, unitPrice, notes } = request.body

  try {
    const orderDetail = await OrderDetail.findById(request.params.id)

    if (!orderDetail) {
      return response.status(404).json({
        error: 'Order detail not found'
      })
    }

    // Verify order is not cancelled or delivered
    const order = await Order.findById(orderDetail.order)
    if (!order) {
      return response.status(400).json({
        error: 'Order not found'
      })
    }

    if (order.status === 'cancelled') {
      return response.status(400).json({
        error: 'Cannot update items in cancelled order'
      })
    }

    if (order.status === 'delivered') {
      return response.status(400).json({
        error: 'Cannot update items in delivered order'
      })
    }

    // Handle quantity update with inventory adjustment
    if (quantity !== undefined && quantity !== orderDetail.quantity) {
      if (quantity < 1) {
        return response.status(400).json({
          error: 'Quantity must be at least 1'
        })
      }

      const inventory = await Inventory.findOne({ product: orderDetail.product })
      if (!inventory) {
        return response.status(400).json({
          error: 'Inventory not found for this product'
        })
      }

      const oldQuantity = orderDetail.quantity
      const quantityDifference = quantity - oldQuantity

      if (quantityDifference > 0) {
        // Increasing quantity - need to reserve more
        if (inventory.quantityAvailable < quantityDifference) {
          return response.status(400).json({
            error: `Insufficient stock. Available: ${inventory.quantityAvailable}, Additional needed: ${quantityDifference}`
          })
        }
        await inventory.reserveInventory(quantityDifference)
      } else if (quantityDifference < 0) {
        // Decreasing quantity - release reservation
        await inventory.releaseReservation(Math.abs(quantityDifference))
      }

      await orderDetail.updateQuantity(quantity)
    }

    // Update unit price if provided
    if (unitPrice !== undefined) {
      await orderDetail.updateUnitPrice(unitPrice)
    }

    // Update notes if provided
    if (notes !== undefined) {
      orderDetail.notes = notes
      await orderDetail.save()
    }

    response.status(200).json({
      success: true,
      message: 'Order detail updated successfully',
      data: {
        orderDetail: {
          id: orderDetail._id,
          orderId: orderDetail.order,
          productId: orderDetail.product,
          quantity: orderDetail.quantity,
          unitPrice: orderDetail.unitPrice,
          total: orderDetail.total,
          notes: orderDetail.notes,
          updatedAt: orderDetail.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.name === 'ValidationError') {
      return response.status(400).json({
        error: error.message
      })
    }
    if (error.message.includes('Quantity must be at least 1') ||
      error.message.includes('Unit price cannot be negative') ||
      error.message.includes('Insufficient')) {
      return response.status(400).json({
        error: error.message
      })
    }
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid order detail ID'
      })
    }
    response.status(500).json({
      error: 'Failed to update order detail'
    })
  }
})

// PATCH /api/order-details/:id/quantity - Update quantity only
orderDetailsRouter.patch('/:id/quantity', userExtractor, async (request, response) => {
  const { quantity } = request.body

  if (!quantity || quantity < 1) {
    return response.status(400).json({
      error: 'Quantity must be at least 1'
    })
  }

  try {
    const orderDetail = await OrderDetail.findById(request.params.id)

    if (!orderDetail) {
      return response.status(404).json({
        error: 'Order detail not found'
      })
    }

    // Verify order status
    const order = await Order.findById(orderDetail.order)
    if (!order) {
      return response.status(400).json({
        error: 'Order not found'
      })
    }

    if (order.status === 'cancelled' || order.status === 'delivered') {
      return response.status(400).json({
        error: `Cannot update quantity for ${order.status} order`
      })
    }

    // Handle inventory adjustment
    const inventory = await Inventory.findOne({ product: orderDetail.product })
    if (!inventory) {
      return response.status(400).json({
        error: 'Inventory not found for this product'
      })
    }

    const oldQuantity = orderDetail.quantity
    const quantityDifference = quantity - oldQuantity

    if (quantityDifference > 0) {
      // Increasing - reserve more
      await inventory.reserveInventory(quantityDifference)
    } else if (quantityDifference < 0) {
      // Decreasing - release reservation
      await inventory.releaseReservation(Math.abs(quantityDifference))
    }

    await orderDetail.updateQuantity(quantity)

    response.status(200).json({
      success: true,
      message: 'Quantity updated successfully',
      data: {
        orderDetail: {
          id: orderDetail._id,
          orderId: orderDetail.order,
          productId: orderDetail.product,
          quantity: orderDetail.quantity,
          unitPrice: orderDetail.unitPrice,
          total: orderDetail.total,
          updatedAt: orderDetail.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.message.includes('Quantity must be at least 1') ||
      error.message.includes('Insufficient')) {
      return response.status(400).json({
        error: error.message
      })
    }
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid order detail ID'
      })
    }
    response.status(500).json({
      error: 'Failed to update quantity'
    })
  }
})

// PATCH /api/order-details/:id/unit-price - Update unit price only
orderDetailsRouter.patch('/:id/unit-price', userExtractor, async (request, response) => {
  const { unitPrice } = request.body

  if (unitPrice === undefined || unitPrice < 0) {
    return response.status(400).json({
      error: 'Unit price is required and cannot be negative'
    })
  }

  try {
    const orderDetail = await OrderDetail.findById(request.params.id)

    if (!orderDetail) {
      return response.status(404).json({
        error: 'Order detail not found'
      })
    }

    // Verify order status
    const order = await Order.findById(orderDetail.order)
    if (!order) {
      return response.status(400).json({
        error: 'Order not found'
      })
    }

    if (order.status === 'cancelled' || order.status === 'delivered') {
      return response.status(400).json({
        error: `Cannot update price for ${order.status} order`
      })
    }

    await orderDetail.updateUnitPrice(unitPrice)

    response.status(200).json({
      success: true,
      message: 'Unit price updated successfully',
      data: {
        orderDetail: {
          id: orderDetail._id,
          orderId: orderDetail.order,
          productId: orderDetail.product,
          quantity: orderDetail.quantity,
          unitPrice: orderDetail.unitPrice,
          total: orderDetail.total,
          updatedAt: orderDetail.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.message.includes('Unit price cannot be negative')) {
      return response.status(400).json({
        error: error.message
      })
    }
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid order detail ID'
      })
    }
    response.status(500).json({
      error: 'Failed to update unit price'
    })
  }
})

// DELETE /api/order-details/:id - Delete order detail and release inventory
orderDetailsRouter.delete('/:id', userExtractor, async (request, response) => {
  try {
    const orderDetail = await OrderDetail.findById(request.params.id)

    if (!orderDetail) {
      return response.status(404).json({
        error: 'Order detail not found'
      })
    }

    // Verify order status
    const order = await Order.findById(orderDetail.order)
    if (!order) {
      return response.status(400).json({
        error: 'Order not found'
      })
    }

    if (order.status === 'cancelled') {
      return response.status(400).json({
        error: 'Cannot delete items from cancelled order'
      })
    }

    if (order.status === 'delivered') {
      return response.status(400).json({
        error: 'Cannot delete items from delivered order'
      })
    }

    // Release inventory reservation
    const inventory = await Inventory.findOne({ product: orderDetail.product })
    if (inventory) {
      await inventory.releaseReservation(orderDetail.quantity)
    }

    await OrderDetail.findByIdAndDelete(request.params.id)

    response.status(200).json({
      success: true,
      message: 'Order detail deleted successfully and inventory reservation released'
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid order detail ID'
      })
    }
    response.status(500).json({
      error: 'Failed to delete order detail'
    })
  }
})

module.exports = orderDetailsRouter
