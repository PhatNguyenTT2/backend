const stockOutOrdersRouter = require('express').Router()
const StockOutOrder = require('../models/stockOutOrder')
const DetailStockOutOrder = require('../models/detailStockOutOrder')
const Employee = require('../models/employee')
const { userExtractor, isAdmin } = require('../utils/auth')

// GET /api/stock-out-orders - Get all stock out orders
stockOutOrdersRouter.get('/', userExtractor, async (request, response) => {
  try {
    const {
      status,
      payment_status,
      start_date,
      end_date,
      created_by,
      with_details
    } = request.query

    // Build filter
    const filter = {}
    if (status) {
      filter.status = status
    }
    if (payment_status) {
      filter.paymentStatus = payment_status
    }
    if (created_by) {
      filter.createdBy = created_by
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

    let orders

    if (with_details === 'true') {
      // Use static method to get orders with details and calculated totals
      orders = await StockOutOrder.findWithDetails(filter)
    } else {
      orders = await StockOutOrder.find(filter)
        .sort({ orderDate: -1 })
    }

    const ordersData = orders.map(order => {
      const orderData = {
        id: order._id,
        soNumber: order.soNumber,
        orderDate: order.orderDate,
        expectedDeliveryDate: order.expectedDeliveryDate,
        shippingFee: order.shippingFee,
        discountPercentage: order.discountPercentage,
        totalPrice: order.totalPrice,
        status: order.status,
        paymentStatus: order.paymentStatus,
        notes: order.notes,
        createdById: order.createdBy?._id || order.createdBy,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt
      }

      if (with_details === 'true' && order.details) {
        orderData.details = order.details.map(detail => ({
          id: detail._id,
          productId: detail.product?._id || detail.product,
          quantity: detail.quantity,
          unitPrice: detail.unitPrice,
          total: detail.total
        }))
        orderData.subtotal = order.subtotal
        orderData.discountAmount = order.discountAmount
      }

      return orderData
    })

    response.status(200).json({
      success: true,
      data: {
        stockOutOrders: ordersData
      }
    })
  } catch (error) {
    response.status(500).json({
      error: 'Failed to fetch stock out orders'
    })
  }
})

// GET /api/stock-out-orders/stats/overview - Get statistics
stockOutOrdersRouter.get('/stats/overview', userExtractor, isAdmin, async (request, response) => {
  try {
    const { start_date, end_date } = request.query

    const options = {}
    if (start_date) options.startDate = start_date
    if (end_date) options.endDate = end_date

    const stats = await StockOutOrder.getStatistics(options)

    response.status(200).json({
      success: true,
      data: {
        statistics: stats
      }
    })
  } catch (error) {
    response.status(500).json({
      error: 'Failed to fetch statistics'
    })
  }
})

// GET /api/stock-out-orders/:id - Get single stock out order
stockOutOrdersRouter.get('/:id', userExtractor, async (request, response) => {
  try {
    const order = await StockOutOrder.findById(request.params.id)
      .populate({
        path: 'details',
        populate: {
          path: 'product',
          select: 'productCode name vendor image price costPrice'
        }
      })

    if (!order) {
      return response.status(404).json({
        error: 'Stock out order not found'
      })
    }

    // Get calculated totals
    const calculatedTotals = await order.getCalculatedTotals()

    response.status(200).json({
      success: true,
      data: {
        stockOutOrder: {
          id: order._id,
          soNumber: order.soNumber,
          orderDate: order.orderDate,
          expectedDeliveryDate: order.expectedDeliveryDate,
          shippingFee: order.shippingFee,
          discountPercentage: order.discountPercentage,
          totalPrice: order.totalPrice,
          status: order.status,
          paymentStatus: order.paymentStatus,
          notes: order.notes,
          createdById: order.createdBy,
          details: calculatedTotals.details.map(detail => ({
            id: detail._id,
            productId: detail.product?._id || detail.product,
            quantity: detail.quantity,
            unitPrice: detail.unitPrice,
            total: detail.total
          })),
          subtotal: calculatedTotals.subtotal,
          discountAmount: calculatedTotals.discountAmount,
          calculatedTotal: calculatedTotals.total,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid stock out order ID'
      })
    }
    response.status(500).json({
      error: 'Failed to fetch stock out order'
    })
  }
})

// GET /api/stock-out-orders/number/:soNumber - Get stock out order by SO number
stockOutOrdersRouter.get('/number/:soNumber', userExtractor, async (request, response) => {
  try {
    const order = await StockOutOrder.findOne({ soNumber: request.params.soNumber })
      .populate({
        path: 'details',
        populate: {
          path: 'product',
          select: 'productCode name image price'
        }
      })

    if (!order) {
      return response.status(404).json({
        error: 'Stock out order not found'
      })
    }

    response.status(200).json({
      success: true,
      data: {
        stockOutOrder: {
          id: order._id,
          soNumber: order.soNumber,
          orderDate: order.orderDate,
          expectedDeliveryDate: order.expectedDeliveryDate,
          shippingFee: order.shippingFee,
          discountPercentage: order.discountPercentage,
          totalPrice: order.totalPrice,
          status: order.status,
          paymentStatus: order.paymentStatus,
          notes: order.notes,
          createdById: order.createdBy,
          subtotal: order.subtotal,
          discountAmount: order.discountAmount,
          createdAt: order.createdAt
        }
      }
    })
  } catch (error) {
    response.status(500).json({
      error: 'Failed to fetch stock out order'
    })
  }
})

// POST /api/stock-out-orders - Create new stock out order (Admin only)
stockOutOrdersRouter.post('/', userExtractor, isAdmin, async (request, response) => {
  const {
    orderDate,
    expectedDeliveryDate,
    shippingFee,
    discountPercentage,
    notes,
    createdBy
  } = request.body

  try {
    // Verify employee if provided
    if (createdBy) {
      const employee = await Employee.findById(createdBy)
      if (!employee) {
        return response.status(400).json({
          error: 'Employee not found'
        })
      }
    }

    const order = new StockOutOrder({
      orderDate: orderDate || new Date(),
      expectedDeliveryDate,
      shippingFee: shippingFee || 0,
      discountPercentage: discountPercentage || 0,
      notes,
      createdBy: createdBy || request.user.employee
    })

    const savedOrder = await order.save()

    response.status(201).json({
      success: true,
      message: 'Stock out order created successfully',
      data: {
        stockOutOrder: {
          id: savedOrder._id,
          soNumber: savedOrder.soNumber,
          orderDate: savedOrder.orderDate,
          expectedDeliveryDate: savedOrder.expectedDeliveryDate,
          shippingFee: savedOrder.shippingFee,
          discountPercentage: savedOrder.discountPercentage,
          totalPrice: savedOrder.totalPrice,
          status: savedOrder.status,
          paymentStatus: savedOrder.paymentStatus,
          notes: savedOrder.notes,
          createdById: savedOrder.createdBy,
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
      error: 'Failed to create stock out order'
    })
  }
})

// PUT /api/stock-out-orders/:id - Update stock out order (Admin only)
stockOutOrdersRouter.put('/:id', userExtractor, isAdmin, async (request, response) => {
  const {
    orderDate,
    expectedDeliveryDate,
    shippingFee,
    discountPercentage,
    notes
  } = request.body

  try {
    const order = await StockOutOrder.findById(request.params.id)

    if (!order) {
      return response.status(404).json({
        error: 'Stock out order not found'
      })
    }

    // Only allow updates for pending or processing orders
    if (order.status === 'completed' || order.status === 'cancelled') {
      return response.status(400).json({
        error: 'Cannot update completed or cancelled stock out orders'
      })
    }

    // Update fields
    if (orderDate !== undefined) order.orderDate = orderDate
    if (expectedDeliveryDate !== undefined) order.expectedDeliveryDate = expectedDeliveryDate
    if (shippingFee !== undefined) {
      if (shippingFee < 0) {
        return response.status(400).json({
          error: 'Shipping fee cannot be negative'
        })
      }
      order.shippingFee = shippingFee
    }
    if (discountPercentage !== undefined) {
      if (discountPercentage < 0 || discountPercentage > 100) {
        return response.status(400).json({
          error: 'Discount percentage must be between 0 and 100'
        })
      }
      order.discountPercentage = discountPercentage
    }
    if (notes !== undefined) order.notes = notes

    const updatedOrder = await order.save()

    // Recalculate total price if shipping fee or discount changed
    if (shippingFee !== undefined || discountPercentage !== undefined) {
      await updatedOrder.recalculateTotalPrice()
    }

    response.status(200).json({
      success: true,
      message: 'Stock out order updated successfully',
      data: {
        stockOutOrder: {
          id: updatedOrder._id,
          soNumber: updatedOrder.soNumber,
          orderDate: updatedOrder.orderDate,
          expectedDeliveryDate: updatedOrder.expectedDeliveryDate,
          shippingFee: updatedOrder.shippingFee,
          discountPercentage: updatedOrder.discountPercentage,
          totalPrice: updatedOrder.totalPrice,
          status: updatedOrder.status,
          notes: updatedOrder.notes,
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
        error: 'Invalid stock out order ID'
      })
    }
    response.status(500).json({
      error: 'Failed to update stock out order'
    })
  }
})

// PATCH /api/stock-out-orders/:id/start-processing - Start processing order (Admin only)
stockOutOrdersRouter.patch('/:id/start-processing', userExtractor, isAdmin, async (request, response) => {
  try {
    const order = await StockOutOrder.findById(request.params.id)

    if (!order) {
      return response.status(404).json({
        error: 'Stock out order not found'
      })
    }

    const updatedOrder = await order.startProcessing()

    response.status(200).json({
      success: true,
      message: 'Stock out order processing started',
      data: {
        stockOutOrder: {
          id: updatedOrder._id,
          soNumber: updatedOrder.soNumber,
          status: updatedOrder.status,
          updatedAt: updatedOrder.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.message === 'Only pending stock out orders can be processed') {
      return response.status(400).json({
        error: error.message
      })
    }
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid stock out order ID'
      })
    }
    response.status(500).json({
      error: 'Failed to start processing stock out order'
    })
  }
})

// PATCH /api/stock-out-orders/:id/complete - Complete order and update inventory (Admin only)
stockOutOrdersRouter.patch('/:id/complete', userExtractor, isAdmin, async (request, response) => {
  try {
    const order = await StockOutOrder.findById(request.params.id)

    if (!order) {
      return response.status(404).json({
        error: 'Stock out order not found'
      })
    }

    const updatedOrder = await order.markAsCompleted()

    response.status(200).json({
      success: true,
      message: 'Stock out order completed and inventory updated',
      data: {
        stockOutOrder: {
          id: updatedOrder._id,
          soNumber: updatedOrder.soNumber,
          status: updatedOrder.status,
          updatedAt: updatedOrder.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.message && (
      error.message === 'Only processing stock out orders can be marked as completed' ||
      error.message.includes('Inventory not found') ||
      error.message.includes('Insufficient stock')
    )) {
      return response.status(400).json({
        error: error.message
      })
    }
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid stock out order ID'
      })
    }
    response.status(500).json({
      error: 'Failed to complete stock out order'
    })
  }
})

// PATCH /api/stock-out-orders/:id/cancel - Cancel order (Admin only)
stockOutOrdersRouter.patch('/:id/cancel', userExtractor, isAdmin, async (request, response) => {
  try {
    const order = await StockOutOrder.findById(request.params.id)

    if (!order) {
      return response.status(404).json({
        error: 'Stock out order not found'
      })
    }

    const updatedOrder = await order.cancel()

    response.status(200).json({
      success: true,
      message: 'Stock out order cancelled',
      data: {
        stockOutOrder: {
          id: updatedOrder._id,
          soNumber: updatedOrder.soNumber,
          status: updatedOrder.status,
          updatedAt: updatedOrder.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.message === 'Cannot cancel completed stock out orders') {
      return response.status(400).json({
        error: error.message
      })
    }
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid stock out order ID'
      })
    }
    response.status(500).json({
      error: 'Failed to cancel stock out order'
    })
  }
})

// PATCH /api/stock-out-orders/:id/payment-status - Update payment status (Admin only)
stockOutOrdersRouter.patch('/:id/payment-status', userExtractor, isAdmin, async (request, response) => {
  const { paidAmount } = request.body

  if (paidAmount === undefined || paidAmount < 0) {
    return response.status(400).json({
      error: 'Valid paid amount is required'
    })
  }

  try {
    const order = await StockOutOrder.findById(request.params.id)

    if (!order) {
      return response.status(404).json({
        error: 'Stock out order not found'
      })
    }

    const updatedOrder = await order.updatePaymentStatus(paidAmount)

    response.status(200).json({
      success: true,
      message: 'Payment status updated',
      data: {
        stockOutOrder: {
          id: updatedOrder._id,
          soNumber: updatedOrder.soNumber,
          totalPrice: updatedOrder.totalPrice,
          paymentStatus: updatedOrder.paymentStatus,
          paidAmount: paidAmount,
          updatedAt: updatedOrder.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid stock out order ID'
      })
    }
    response.status(500).json({
      error: 'Failed to update payment status'
    })
  }
})

// PATCH /api/stock-out-orders/:id/recalculate - Recalculate total price (Admin only)
stockOutOrdersRouter.patch('/:id/recalculate', userExtractor, isAdmin, async (request, response) => {
  try {
    const order = await StockOutOrder.findById(request.params.id)

    if (!order) {
      return response.status(404).json({
        error: 'Stock out order not found'
      })
    }

    const updatedOrder = await order.recalculateTotalPrice()

    response.status(200).json({
      success: true,
      message: 'Total price recalculated',
      data: {
        stockOutOrder: {
          id: updatedOrder._id,
          soNumber: updatedOrder.soNumber,
          totalPrice: updatedOrder.totalPrice,
          updatedAt: updatedOrder.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid stock out order ID'
      })
    }
    response.status(500).json({
      error: 'Failed to recalculate total price'
    })
  }
})

// DELETE /api/stock-out-orders/:id - Delete stock out order (Admin only)
stockOutOrdersRouter.delete('/:id', userExtractor, isAdmin, async (request, response) => {
  try {
    const order = await StockOutOrder.findById(request.params.id)

    if (!order) {
      return response.status(404).json({
        error: 'Stock out order not found'
      })
    }

    // Only allow deletion for pending or cancelled orders
    if (order.status === 'processing' || order.status === 'completed') {
      return response.status(400).json({
        error: 'Cannot delete processing or completed stock out orders'
      })
    }

    // Delete all related details
    await DetailStockOutOrder.deleteMany({ stockOutOrder: order._id })

    await StockOutOrder.findByIdAndDelete(request.params.id)

    response.status(200).json({
      success: true,
      message: 'Stock out order deleted successfully'
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid stock out order ID'
      })
    }
    response.status(500).json({
      error: 'Failed to delete stock out order'
    })
  }
})

module.exports = stockOutOrdersRouter
