const ordersRouter = require('express').Router()
const Order = require('../models/order')
const OrderDetail = require('../models/orderDetail')
const Customer = require('../models/customer')
const Employee = require('../models/employee')
const Inventory = require('../models/inventory')
const { userExtractor, isAdmin } = require('../utils/auth')

// GET /api/orders - Get all orders
ordersRouter.get('/', userExtractor, async (request, response) => {
  try {
    const {
      status,
      payment_status,
      customer_id,
      created_by,
      delivery_type,
      start_date,
      end_date,
      min_total,
      max_total,
      limit
    } = request.query

    // Build filter
    const filter = {}
    if (status) {
      filter.status = status
    }
    if (payment_status) {
      filter.paymentStatus = payment_status
    }
    if (customer_id) {
      filter.customer = customer_id
    }
    if (created_by) {
      filter.createdBy = created_by
    }
    if (delivery_type) {
      filter.deliveryType = delivery_type
    }
    if (start_date || end_date) {
      filter.orderDate = {}
      if (start_date) {
        filter.orderDate.$gte = new Date(start_date)
      }
      if (end_date) {
        filter.orderDate.$lte = new Date(end_date)
      }
    }
    if (min_total || max_total) {
      filter.total = {}
      if (min_total) {
        filter.total.$gte = parseFloat(min_total)
      }
      if (max_total) {
        filter.total.$lte = parseFloat(max_total)
      }
    }

    const orders = await Order.find(filter)
      .sort({ orderDate: -1, createdAt: -1 })
      .limit(limit ? parseInt(limit) : 100)

    const ordersData = orders.map(order => ({
      id: order._id,
      orderNumber: order.orderNumber,
      customerId: order.customer,
      createdBy: order.createdBy,
      orderDate: order.orderDate,
      deliveryType: order.deliveryType,
      address: order.address,
      shippingFee: order.shippingFee,
      discountPercentage: order.discountPercentage,
      total: order.total,
      paymentStatus: order.paymentStatus,
      status: order.status,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt
    }))

    response.status(200).json({
      success: true,
      data: {
        orders: ordersData
      }
    })
  } catch (error) {
    response.status(500).json({
      error: 'Failed to fetch orders'
    })
  }
})

// GET /api/orders/stats/overview - Get order statistics
ordersRouter.get('/stats/overview', userExtractor, isAdmin, async (request, response) => {
  try {
    const { start_date, end_date, customer_id } = request.query

    const options = {}
    if (start_date) options.startDate = start_date
    if (end_date) options.endDate = end_date
    if (customer_id) options.customerId = customer_id

    const stats = await Order.getStatistics(options)

    response.status(200).json({
      success: true,
      data: {
        statistics: stats
      }
    })
  } catch (error) {
    response.status(500).json({
      error: 'Failed to fetch order statistics'
    })
  }
})

// GET /api/orders/stats/daily-revenue - Get daily revenue
ordersRouter.get('/stats/daily-revenue', userExtractor, isAdmin, async (request, response) => {
  try {
    const { days } = request.query
    const numberOfDays = days ? parseInt(days) : 7

    const dailyRevenue = await Order.getDailyRevenue(numberOfDays)

    response.status(200).json({
      success: true,
      data: {
        dailyRevenue,
        period: `Last ${numberOfDays} days`
      }
    })
  } catch (error) {
    response.status(500).json({
      error: 'Failed to fetch daily revenue'
    })
  }
})

// GET /api/orders/stats/top-customers - Get top customers by revenue
ordersRouter.get('/stats/top-customers', userExtractor, isAdmin, async (request, response) => {
  try {
    const { limit } = request.query
    const topCustomers = await Order.getTopCustomers(limit ? parseInt(limit) : 10)

    response.status(200).json({
      success: true,
      data: {
        topCustomers
      }
    })
  } catch (error) {
    response.status(500).json({
      error: 'Failed to fetch top customers'
    })
  }
})

// GET /api/orders/status/:status - Get orders by status
ordersRouter.get('/status/:status', userExtractor, async (request, response) => {
  try {
    const status = request.params.status
    const validStatuses = ['pending', 'processing', 'shipping', 'delivered', 'cancelled']

    if (!validStatuses.includes(status)) {
      return response.status(400).json({
        error: 'Invalid status. Valid statuses are: pending, processing, shipping, delivered, cancelled'
      })
    }

    const orders = await Order.findByStatus(status)

    const ordersData = orders.map(order => ({
      id: order._id,
      orderNumber: order.orderNumber,
      customerId: order.customer,
      createdBy: order.createdBy,
      orderDate: order.orderDate,
      deliveryType: order.deliveryType,
      total: order.total,
      paymentStatus: order.paymentStatus,
      status: order.status,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt
    }))

    response.status(200).json({
      success: true,
      data: {
        status,
        totalOrders: ordersData.length,
        orders: ordersData
      }
    })
  } catch (error) {
    response.status(500).json({
      error: 'Failed to fetch orders by status'
    })
  }
})

// GET /api/orders/customer/:customerId - Get orders by customer
ordersRouter.get('/customer/:customerId', userExtractor, async (request, response) => {
  try {
    const orders = await Order.findByCustomer(request.params.customerId)

    const ordersData = orders.map(order => ({
      id: order._id,
      orderNumber: order.orderNumber,
      customerId: order.customer,
      createdBy: order.createdBy,
      orderDate: order.orderDate,
      deliveryType: order.deliveryType,
      address: order.address,
      shippingFee: order.shippingFee,
      discountPercentage: order.discountPercentage,
      total: order.total,
      paymentStatus: order.paymentStatus,
      status: order.status,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt
    }))

    response.status(200).json({
      success: true,
      data: {
        customerId: request.params.customerId,
        totalOrders: ordersData.length,
        orders: ordersData
      }
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid customer ID'
      })
    }
    response.status(500).json({
      error: 'Failed to fetch customer orders'
    })
  }
})

// GET /api/orders/number/:orderNumber - Get order by order number
ordersRouter.get('/number/:orderNumber', userExtractor, async (request, response) => {
  try {
    const order = await Order.findOne({
      orderNumber: request.params.orderNumber.toUpperCase()
    })

    if (!order) {
      return response.status(404).json({
        error: 'Order not found'
      })
    }

    response.status(200).json({
      success: true,
      data: {
        order: {
          id: order._id,
          orderNumber: order.orderNumber,
          customerId: order.customer,
          createdBy: order.createdBy,
          orderDate: order.orderDate,
          deliveryType: order.deliveryType,
          address: order.address,
          shippingFee: order.shippingFee,
          discountPercentage: order.discountPercentage,
          total: order.total,
          paymentStatus: order.paymentStatus,
          status: order.status,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt
        }
      }
    })
  } catch (error) {
    response.status(500).json({
      error: 'Failed to fetch order'
    })
  }
})

// GET /api/orders/:id - Get single order
ordersRouter.get('/:id', userExtractor, async (request, response) => {
  try {
    const order = await Order.findById(request.params.id)

    if (!order) {
      return response.status(404).json({
        error: 'Order not found'
      })
    }

    response.status(200).json({
      success: true,
      data: {
        order: {
          id: order._id,
          orderNumber: order.orderNumber,
          customerId: order.customer,
          createdBy: order.createdBy,
          orderDate: order.orderDate,
          deliveryType: order.deliveryType,
          address: order.address,
          shippingFee: order.shippingFee,
          discountPercentage: order.discountPercentage,
          total: order.total,
          paymentStatus: order.paymentStatus,
          status: order.status,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid order ID'
      })
    }
    response.status(500).json({
      error: 'Failed to fetch order'
    })
  }
})

// POST /api/orders - Create new order
ordersRouter.post('/', userExtractor, async (request, response) => {
  const {
    customerId,
    deliveryType,
    address,
    shippingFee,
    discountPercentage
  } = request.body

  // Validate delivery type specific requirements
  if (deliveryType === 'delivery' && !address) {
    return response.status(400).json({
      error: 'Address is required for delivery orders'
    })
  }

  try {
    // Verify customer exists if provided
    if (customerId) {
      const customer = await Customer.findById(customerId)
      if (!customer) {
        return response.status(400).json({
          error: 'Customer not found'
        })
      }
      if (!customer.isActive) {
        return response.status(400).json({
          error: 'Customer is not active'
        })
      }
    }

    const order = new Order({
      customer: customerId || null,
      createdBy: request.user.id,
      orderDate: new Date(),
      deliveryType: deliveryType || 'delivery',
      address: deliveryType === 'delivery' ? address : null,
      shippingFee: shippingFee || 0,
      discountPercentage: discountPercentage || 0,
      total: 0, // Will be updated when order details are added
      paymentStatus: 'pending',
      status: 'pending'
    })

    const savedOrder = await order.save()

    response.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: {
        order: {
          id: savedOrder._id,
          orderNumber: savedOrder.orderNumber,
          customerId: savedOrder.customer,
          createdBy: savedOrder.createdBy,
          orderDate: savedOrder.orderDate,
          deliveryType: savedOrder.deliveryType,
          address: savedOrder.address,
          shippingFee: savedOrder.shippingFee,
          discountPercentage: savedOrder.discountPercentage,
          total: savedOrder.total,
          paymentStatus: savedOrder.paymentStatus,
          status: savedOrder.status,
          createdAt: savedOrder.createdAt
        }
      }
    })
  } catch (error) {
    if (error.name === 'ValidationError') {
      return response.status(400).json({
        error: error.message
      })
    }
    response.status(500).json({
      error: 'Failed to create order'
    })
  }
})

// PUT /api/orders/:id - Update order
ordersRouter.put('/:id', userExtractor, async (request, response) => {
  const {
    customerId,
    deliveryType,
    address,
    shippingFee,
    discountPercentage
  } = request.body

  try {
    const order = await Order.findById(request.params.id)

    if (!order) {
      return response.status(404).json({
        error: 'Order not found'
      })
    }

    // Check if order can be updated
    if (order.status === 'delivered') {
      return response.status(400).json({
        error: 'Cannot update delivered order'
      })
    }

    if (order.status === 'cancelled') {
      return response.status(400).json({
        error: 'Cannot update cancelled order'
      })
    }

    // Verify customer if changing
    if (customerId && customerId !== order.customer?.toString()) {
      const customer = await Customer.findById(customerId)
      if (!customer) {
        return response.status(400).json({
          error: 'Customer not found'
        })
      }
      if (!customer.isActive) {
        return response.status(400).json({
          error: 'Customer is not active'
        })
      }
      order.customer = customerId
    }

    // Update delivery type and address
    if (deliveryType !== undefined) {
      if (deliveryType === 'delivery' && !address && !order.address) {
        return response.status(400).json({
          error: 'Address is required for delivery orders'
        })
      }
      order.deliveryType = deliveryType
    }

    if (address !== undefined) {
      order.address = address
    }

    // Update shipping fee
    if (shippingFee !== undefined) {
      await order.updateShippingFee(shippingFee)
    }

    // Update discount
    if (discountPercentage !== undefined) {
      await order.applyDiscount(discountPercentage)
    }

    // Save other changes
    const updatedOrder = await order.save()

    response.status(200).json({
      success: true,
      message: 'Order updated successfully',
      data: {
        order: {
          id: updatedOrder._id,
          orderNumber: updatedOrder.orderNumber,
          customerId: updatedOrder.customer,
          createdBy: updatedOrder.createdBy,
          orderDate: updatedOrder.orderDate,
          deliveryType: updatedOrder.deliveryType,
          address: updatedOrder.address,
          shippingFee: updatedOrder.shippingFee,
          discountPercentage: updatedOrder.discountPercentage,
          total: updatedOrder.total,
          paymentStatus: updatedOrder.paymentStatus,
          status: updatedOrder.status,
          updatedAt: updatedOrder.updatedAt
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
        error: 'Invalid order ID'
      })
    }
    response.status(500).json({
      error: 'Failed to update order'
    })
  }
})

// PATCH /api/orders/:id/discount - Apply discount to order
ordersRouter.patch('/:id/discount', userExtractor, async (request, response) => {
  const { discountPercentage } = request.body

  if (discountPercentage === undefined || discountPercentage < 0 || discountPercentage > 100) {
    return response.status(400).json({
      error: 'Valid discount percentage (0-100) is required'
    })
  }

  try {
    const order = await Order.findById(request.params.id)

    if (!order) {
      return response.status(404).json({
        error: 'Order not found'
      })
    }

    if (order.status === 'delivered' || order.status === 'cancelled') {
      return response.status(400).json({
        error: `Cannot apply discount to ${order.status} order`
      })
    }

    await order.applyDiscount(discountPercentage)

    response.status(200).json({
      success: true,
      message: 'Discount applied successfully',
      data: {
        order: {
          id: order._id,
          orderNumber: order.orderNumber,
          discountPercentage: order.discountPercentage,
          total: order.total,
          updatedAt: order.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid order ID'
      })
    }
    response.status(500).json({
      error: 'Failed to apply discount'
    })
  }
})

// PATCH /api/orders/:id/shipping-fee - Update shipping fee
ordersRouter.patch('/:id/shipping-fee', userExtractor, async (request, response) => {
  const { shippingFee } = request.body

  if (shippingFee === undefined || shippingFee < 0) {
    return response.status(400).json({
      error: 'Valid shipping fee is required (must be >= 0)'
    })
  }

  try {
    const order = await Order.findById(request.params.id)

    if (!order) {
      return response.status(404).json({
        error: 'Order not found'
      })
    }

    if (order.status === 'delivered' || order.status === 'cancelled') {
      return response.status(400).json({
        error: `Cannot update shipping fee for ${order.status} order`
      })
    }

    await order.updateShippingFee(shippingFee)

    response.status(200).json({
      success: true,
      message: 'Shipping fee updated successfully',
      data: {
        order: {
          id: order._id,
          orderNumber: order.orderNumber,
          shippingFee: order.shippingFee,
          total: order.total,
          updatedAt: order.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid order ID'
      })
    }
    response.status(500).json({
      error: 'Failed to update shipping fee'
    })
  }
})

// PATCH /api/orders/:id/payment-status - Update payment status
ordersRouter.patch('/:id/payment-status', userExtractor, async (request, response) => {
  const { paymentStatus } = request.body

  if (!paymentStatus) {
    return response.status(400).json({
      error: 'Payment status is required'
    })
  }

  const validStatuses = ['pending', 'paid', 'failed', 'refunded']
  if (!validStatuses.includes(paymentStatus)) {
    return response.status(400).json({
      error: 'Invalid payment status. Valid statuses are: pending, paid, failed, refunded'
    })
  }

  try {
    const order = await Order.findById(request.params.id)

    if (!order) {
      return response.status(404).json({
        error: 'Order not found'
      })
    }

    await order.updatePaymentStatus(paymentStatus)

    response.status(200).json({
      success: true,
      message: 'Payment status updated successfully',
      data: {
        order: {
          id: order._id,
          orderNumber: order.orderNumber,
          paymentStatus: order.paymentStatus,
          updatedAt: order.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.message === 'Invalid payment status') {
      return response.status(400).json({
        error: error.message
      })
    }
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid order ID'
      })
    }
    response.status(500).json({
      error: 'Failed to update payment status'
    })
  }
})

// PATCH /api/orders/:id/start-processing - Start processing order
ordersRouter.patch('/:id/start-processing', userExtractor, async (request, response) => {
  try {
    const order = await Order.findById(request.params.id)

    if (!order) {
      return response.status(404).json({
        error: 'Order not found'
      })
    }

    await order.startProcessing()

    response.status(200).json({
      success: true,
      message: 'Order processing started',
      data: {
        order: {
          id: order._id,
          orderNumber: order.orderNumber,
          status: order.status,
          updatedAt: order.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.message === 'Only pending orders can be processed') {
      return response.status(400).json({
        error: error.message
      })
    }
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid order ID'
      })
    }
    response.status(500).json({
      error: 'Failed to start processing order'
    })
  }
})

// PATCH /api/orders/:id/mark-shipping - Mark order as shipping
ordersRouter.patch('/:id/mark-shipping', userExtractor, async (request, response) => {
  try {
    const order = await Order.findById(request.params.id)

    if (!order) {
      return response.status(404).json({
        error: 'Order not found'
      })
    }

    await order.markAsShipping()

    response.status(200).json({
      success: true,
      message: 'Order marked as shipping',
      data: {
        order: {
          id: order._id,
          orderNumber: order.orderNumber,
          status: order.status,
          updatedAt: order.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.message === 'Only processing orders can be marked as shipping') {
      return response.status(400).json({
        error: error.message
      })
    }
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid order ID'
      })
    }
    response.status(500).json({
      error: 'Failed to mark order as shipping'
    })
  }
})

// PATCH /api/orders/:id/mark-delivered - Mark order as delivered and complete inventory
ordersRouter.patch('/:id/mark-delivered', userExtractor, async (request, response) => {
  try {
    const order = await Order.findById(request.params.id)

    if (!order) {
      return response.status(404).json({
        error: 'Order not found'
      })
    }

    // Get order details to complete inventory delivery
    const orderDetails = await OrderDetail.find({ order: order._id })

    // Complete delivery for each product's inventory
    for (const detail of orderDetails) {
      const inventory = await Inventory.findOne({ product: detail.product })
      if (inventory) {
        await inventory.completeDelivery(detail.quantity)
      }
    }

    await order.markAsDelivered()

    response.status(200).json({
      success: true,
      message: 'Order marked as delivered and inventory updated',
      data: {
        order: {
          id: order._id,
          orderNumber: order.orderNumber,
          status: order.status,
          updatedAt: order.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.message.includes('must be in') || error.message.includes('Cannot complete')) {
      return response.status(400).json({
        error: error.message
      })
    }
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid order ID'
      })
    }
    response.status(500).json({
      error: 'Failed to mark order as delivered'
    })
  }
})

// PATCH /api/orders/:id/cancel - Cancel order and release inventory
ordersRouter.patch('/:id/cancel', userExtractor, async (request, response) => {
  try {
    const order = await Order.findById(request.params.id)

    if (!order) {
      return response.status(404).json({
        error: 'Order not found'
      })
    }

    // Get order details to release inventory reservations
    const orderDetails = await OrderDetail.find({ order: order._id })

    // Release inventory for each product
    for (const detail of orderDetails) {
      const inventory = await Inventory.findOne({ product: detail.product })
      if (inventory) {
        await inventory.releaseReservation(detail.quantity)
      }
    }

    await order.cancel()

    response.status(200).json({
      success: true,
      message: 'Order cancelled and inventory reservations released',
      data: {
        order: {
          id: order._id,
          orderNumber: order.orderNumber,
          status: order.status,
          updatedAt: order.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.message === 'Cannot cancel delivered orders') {
      return response.status(400).json({
        error: error.message
      })
    }
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid order ID'
      })
    }
    response.status(500).json({
      error: 'Failed to cancel order'
    })
  }
})

// DELETE /api/orders/:id - Delete order (Admin only, strict conditions)
ordersRouter.delete('/:id', userExtractor, isAdmin, async (request, response) => {
  try {
    const order = await Order.findById(request.params.id)

    if (!order) {
      return response.status(404).json({
        error: 'Order not found'
      })
    }

    // Only allow deletion of cancelled orders with no order details
    if (order.status !== 'cancelled') {
      return response.status(400).json({
        error: 'Only cancelled orders can be deleted'
      })
    }

    const orderDetailsCount = await OrderDetail.countDocuments({ order: order._id })
    if (orderDetailsCount > 0) {
      return response.status(400).json({
        error: `Cannot delete order with ${orderDetailsCount} order detail(s). Please delete order details first.`
      })
    }

    await Order.findByIdAndDelete(request.params.id)

    response.status(200).json({
      success: true,
      message: 'Order deleted successfully'
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid order ID'
      })
    }
    response.status(500).json({
      error: 'Failed to delete order'
    })
  }
})

module.exports = ordersRouter
