const paymentsRouter = require('express').Router()
const Payment = require('../models/payment')
const Order = require('../models/order')
const PurchaseOrder = require('../models/purchaseOrder')
const Customer = require('../models/customer')
const Supplier = require('../models/supplier')
const { userExtractor, isAdmin } = require('../utils/auth')

// GET /api/payments - Get all payments
paymentsRouter.get('/', userExtractor, async (request, response) => {
  try {
    const {
      payment_type,
      status,
      payment_method,
      customer_id,
      supplier_id,
      received_by,
      start_date,
      end_date,
      min_amount,
      max_amount,
      limit
    } = request.query

    // Build filter
    const filter = {}
    if (payment_type) {
      filter.paymentType = payment_type
    }
    if (status) {
      filter.status = status
    }
    if (payment_method) {
      filter.paymentMethod = payment_method
    }
    if (customer_id) {
      filter.customer = customer_id
    }
    if (supplier_id) {
      filter.supplier = supplier_id
    }
    if (received_by) {
      filter.receivedBy = received_by
    }
    if (start_date || end_date) {
      filter.paymentDate = {}
      if (start_date) {
        filter.paymentDate.$gte = new Date(start_date)
      }
      if (end_date) {
        filter.paymentDate.$lte = new Date(end_date)
      }
    }
    if (min_amount || max_amount) {
      filter.amount = {}
      if (min_amount) {
        filter.amount.$gte = parseFloat(min_amount)
      }
      if (max_amount) {
        filter.amount.$lte = parseFloat(max_amount)
      }
    }

    const payments = await Payment.find(filter)
      .sort({ paymentDate: -1, createdAt: -1 })
      .limit(limit ? parseInt(limit) : 100)

    const paymentsData = payments.map(payment => ({
      id: payment._id,
      paymentNumber: payment.paymentNumber,
      paymentType: payment.paymentType,
      relatedOrderId: payment.relatedOrderId,
      amount: payment.amount,
      paymentMethod: payment.paymentMethod,
      paymentDate: payment.paymentDate,
      status: payment.status,
      refundReason: payment.refundReason,
      customerId: payment.customer,
      supplierId: payment.supplier,
      receivedBy: payment.receivedBy,
      notes: payment.notes,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt
    }))

    response.status(200).json({
      success: true,
      data: {
        payments: paymentsData
      }
    })
  } catch (error) {
    response.status(500).json({
      error: 'Failed to fetch payments'
    })
  }
})

// GET /api/payments/stats/overview - Get payment statistics
paymentsRouter.get('/stats/overview', userExtractor, isAdmin, async (request, response) => {
  try {
    const { start_date, end_date, payment_type } = request.query

    const options = {}
    if (start_date) options.startDate = start_date
    if (end_date) options.endDate = end_date
    if (payment_type) options.paymentType = payment_type

    const stats = await Payment.getStatistics(options)

    response.status(200).json({
      success: true,
      data: {
        statistics: stats
      }
    })
  } catch (error) {
    response.status(500).json({
      error: 'Failed to fetch payment statistics'
    })
  }
})

// GET /api/payments/stats/daily-revenue - Get daily revenue
paymentsRouter.get('/stats/daily-revenue', userExtractor, isAdmin, async (request, response) => {
  try {
    const { days, payment_type } = request.query
    const numberOfDays = days ? parseInt(days) : 7

    const dailyRevenue = await Payment.getDailyRevenue(numberOfDays, payment_type)

    response.status(200).json({
      success: true,
      data: {
        dailyRevenue,
        period: `Last ${numberOfDays} days`,
        paymentType: payment_type || 'all'
      }
    })
  } catch (error) {
    response.status(500).json({
      error: 'Failed to fetch daily revenue'
    })
  }
})

// GET /api/payments/stats/payment-methods - Get payment methods breakdown
paymentsRouter.get('/stats/payment-methods', userExtractor, isAdmin, async (request, response) => {
  try {
    const { start_date, end_date, payment_type } = request.query

    const options = {}
    if (start_date) options.startDate = start_date
    if (end_date) options.endDate = end_date
    if (payment_type) options.paymentType = payment_type

    const breakdown = await Payment.getPaymentMethodsBreakdown(options)

    response.status(200).json({
      success: true,
      data: {
        paymentMethodsBreakdown: breakdown
      }
    })
  } catch (error) {
    response.status(500).json({
      error: 'Failed to fetch payment methods breakdown'
    })
  }
})

// GET /api/payments/type/:type - Get payments by type
paymentsRouter.get('/type/:type', userExtractor, async (request, response) => {
  try {
    const paymentType = request.params.type
    const validTypes = ['sales', 'purchase']

    if (!validTypes.includes(paymentType)) {
      return response.status(400).json({
        error: 'Invalid payment type. Valid types are: sales, purchase'
      })
    }

    const { status, start_date, end_date, limit } = request.query

    const query = {}
    if (status) query.status = status
    if (start_date || end_date) {
      query.paymentDate = {}
      if (start_date) query.paymentDate.$gte = new Date(start_date)
      if (end_date) query.paymentDate.$lte = new Date(end_date)
    }

    const payments = await Payment.findByType(paymentType, query)
      .limit(limit ? parseInt(limit) : 100)

    const paymentsData = payments.map(payment => ({
      id: payment._id,
      paymentNumber: payment.paymentNumber,
      paymentType: payment.paymentType,
      relatedOrderId: payment.relatedOrderId,
      amount: payment.amount,
      paymentMethod: payment.paymentMethod,
      paymentDate: payment.paymentDate,
      status: payment.status,
      customerId: payment.customer,
      supplierId: payment.supplier,
      receivedBy: payment.receivedBy,
      notes: payment.notes,
      createdAt: payment.createdAt
    }))

    response.status(200).json({
      success: true,
      data: {
        paymentType,
        totalPayments: paymentsData.length,
        payments: paymentsData
      }
    })
  } catch (error) {
    response.status(500).json({
      error: 'Failed to fetch payments by type'
    })
  }
})

// GET /api/payments/customer/:customerId - Get payments by customer
paymentsRouter.get('/customer/:customerId', userExtractor, async (request, response) => {
  try {
    const payments = await Payment.findByCustomer(request.params.customerId)

    const paymentsData = payments.map(payment => ({
      id: payment._id,
      paymentNumber: payment.paymentNumber,
      paymentType: payment.paymentType,
      relatedOrderId: payment.relatedOrderId,
      amount: payment.amount,
      paymentMethod: payment.paymentMethod,
      paymentDate: payment.paymentDate,
      status: payment.status,
      customerId: payment.customer,
      receivedBy: payment.receivedBy,
      notes: payment.notes,
      createdAt: payment.createdAt
    }))

    response.status(200).json({
      success: true,
      data: {
        customerId: request.params.customerId,
        totalPayments: paymentsData.length,
        payments: paymentsData
      }
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid customer ID'
      })
    }
    response.status(500).json({
      error: 'Failed to fetch customer payments'
    })
  }
})

// GET /api/payments/supplier/:supplierId - Get payments by supplier
paymentsRouter.get('/supplier/:supplierId', userExtractor, async (request, response) => {
  try {
    const payments = await Payment.findBySupplier(request.params.supplierId)

    const paymentsData = payments.map(payment => ({
      id: payment._id,
      paymentNumber: payment.paymentNumber,
      paymentType: payment.paymentType,
      relatedOrderId: payment.relatedOrderId,
      amount: payment.amount,
      paymentMethod: payment.paymentMethod,
      paymentDate: payment.paymentDate,
      status: payment.status,
      supplierId: payment.supplier,
      receivedBy: payment.receivedBy,
      notes: payment.notes,
      createdAt: payment.createdAt
    }))

    response.status(200).json({
      success: true,
      data: {
        supplierId: request.params.supplierId,
        totalPayments: paymentsData.length,
        payments: paymentsData
      }
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid supplier ID'
      })
    }
    response.status(500).json({
      error: 'Failed to fetch supplier payments'
    })
  }
})

// GET /api/payments/order/:orderId/total - Get total paid for an order
paymentsRouter.get('/order/:orderId/total', userExtractor, async (request, response) => {
  try {
    const totalPaid = await Payment.getTotalPaidForOrder(request.params.orderId)

    response.status(200).json({
      success: true,
      data: {
        orderId: request.params.orderId,
        totalPaid
      }
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid order ID'
      })
    }
    response.status(500).json({
      error: 'Failed to fetch total paid for order'
    })
  }
})

// GET /api/payments/number/:paymentNumber - Get payment by payment number
paymentsRouter.get('/number/:paymentNumber', userExtractor, async (request, response) => {
  try {
    const payment = await Payment.findOne({
      paymentNumber: request.params.paymentNumber.toUpperCase()
    })

    if (!payment) {
      return response.status(404).json({
        error: 'Payment not found'
      })
    }

    response.status(200).json({
      success: true,
      data: {
        payment: {
          id: payment._id,
          paymentNumber: payment.paymentNumber,
          paymentType: payment.paymentType,
          relatedOrderId: payment.relatedOrderId,
          amount: payment.amount,
          paymentMethod: payment.paymentMethod,
          paymentDate: payment.paymentDate,
          status: payment.status,
          refundReason: payment.refundReason,
          customerId: payment.customer,
          supplierId: payment.supplier,
          receivedBy: payment.receivedBy,
          notes: payment.notes,
          createdAt: payment.createdAt,
          updatedAt: payment.updatedAt
        }
      }
    })
  } catch (error) {
    response.status(500).json({
      error: 'Failed to fetch payment'
    })
  }
})

// GET /api/payments/:id - Get single payment
paymentsRouter.get('/:id', userExtractor, async (request, response) => {
  try {
    const payment = await Payment.findById(request.params.id)

    if (!payment) {
      return response.status(404).json({
        error: 'Payment not found'
      })
    }

    response.status(200).json({
      success: true,
      data: {
        payment: {
          id: payment._id,
          paymentNumber: payment.paymentNumber,
          paymentType: payment.paymentType,
          relatedOrderId: payment.relatedOrderId,
          amount: payment.amount,
          paymentMethod: payment.paymentMethod,
          paymentDate: payment.paymentDate,
          status: payment.status,
          refundReason: payment.refundReason,
          customerId: payment.customer,
          supplierId: payment.supplier,
          receivedBy: payment.receivedBy,
          notes: payment.notes,
          createdAt: payment.createdAt,
          updatedAt: payment.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid payment ID'
      })
    }
    response.status(500).json({
      error: 'Failed to fetch payment'
    })
  }
})

// POST /api/payments/order - Create payment for order (sales)
paymentsRouter.post('/order', userExtractor, async (request, response) => {
  const {
    orderId,
    amount,
    paymentMethod,
    paymentDate,
    notes
  } = request.body

  if (!orderId) {
    return response.status(400).json({
      error: 'Order ID is required'
    })
  }

  if (!amount || amount <= 0) {
    return response.status(400).json({
      error: 'Amount must be greater than 0'
    })
  }

  if (!paymentMethod) {
    return response.status(400).json({
      error: 'Payment method is required'
    })
  }

  const validMethods = ['cash', 'card', 'bank_transfer', 'e_wallet', 'check', 'credit']
  if (!validMethods.includes(paymentMethod)) {
    return response.status(400).json({
      error: 'Invalid payment method. Valid methods are: cash, card, bank_transfer, e_wallet, check, credit'
    })
  }

  try {
    // Verify order exists
    const order = await Order.findById(orderId)
    if (!order) {
      return response.status(400).json({
        error: 'Order not found'
      })
    }

    if (order.status === 'cancelled') {
      return response.status(400).json({
        error: 'Cannot create payment for cancelled order'
      })
    }

    const paymentData = {
      relatedOrderId: orderId,
      amount,
      paymentMethod,
      paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
      receivedBy: request.user.id,
      notes,
      status: 'completed'
    }

    // Use static method to create payment and update order atomically
    const savedPayment = await Payment.createForOrder(paymentData)

    response.status(201).json({
      success: true,
      message: 'Payment created successfully for order',
      data: {
        payment: {
          id: savedPayment._id,
          paymentNumber: savedPayment.paymentNumber,
          paymentType: savedPayment.paymentType,
          relatedOrderId: savedPayment.relatedOrderId,
          amount: savedPayment.amount,
          paymentMethod: savedPayment.paymentMethod,
          paymentDate: savedPayment.paymentDate,
          status: savedPayment.status,
          customerId: savedPayment.customer,
          receivedBy: savedPayment.receivedBy,
          notes: savedPayment.notes,
          createdAt: savedPayment.createdAt
        }
      }
    })
  } catch (error) {
    if (error.name === 'ValidationError') {
      return response.status(400).json({
        error: error.message
      })
    }
    if (error.message.includes('not found') || error.message.includes('required')) {
      return response.status(400).json({
        error: error.message
      })
    }
    response.status(500).json({
      error: 'Failed to create payment for order'
    })
  }
})

// POST /api/payments/purchase-order - Create payment for purchase order
paymentsRouter.post('/purchase-order', userExtractor, async (request, response) => {
  const {
    purchaseOrderId,
    amount,
    paymentMethod,
    paymentDate,
    notes
  } = request.body

  if (!purchaseOrderId) {
    return response.status(400).json({
      error: 'Purchase order ID is required'
    })
  }

  if (!amount || amount <= 0) {
    return response.status(400).json({
      error: 'Amount must be greater than 0'
    })
  }

  if (!paymentMethod) {
    return response.status(400).json({
      error: 'Payment method is required'
    })
  }

  const validMethods = ['cash', 'card', 'bank_transfer', 'e_wallet', 'check', 'credit']
  if (!validMethods.includes(paymentMethod)) {
    return response.status(400).json({
      error: 'Invalid payment method. Valid methods are: cash, card, bank_transfer, e_wallet, check, credit'
    })
  }

  try {
    // Verify purchase order exists
    const purchaseOrder = await PurchaseOrder.findById(purchaseOrderId)
    if (!purchaseOrder) {
      return response.status(400).json({
        error: 'Purchase order not found'
      })
    }

    if (purchaseOrder.status === 'cancelled') {
      return response.status(400).json({
        error: 'Cannot create payment for cancelled purchase order'
      })
    }

    const paymentData = {
      relatedOrderId: purchaseOrderId,
      amount,
      paymentMethod,
      paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
      receivedBy: request.user.id,
      notes,
      status: 'completed'
    }

    // Use static method to create payment and update purchase order atomically
    const savedPayment = await Payment.createForPurchaseOrder(paymentData)

    response.status(201).json({
      success: true,
      message: 'Payment created successfully for purchase order',
      data: {
        payment: {
          id: savedPayment._id,
          paymentNumber: savedPayment.paymentNumber,
          paymentType: savedPayment.paymentType,
          relatedOrderId: savedPayment.relatedOrderId,
          amount: savedPayment.amount,
          paymentMethod: savedPayment.paymentMethod,
          paymentDate: savedPayment.paymentDate,
          status: savedPayment.status,
          supplierId: savedPayment.supplier,
          receivedBy: savedPayment.receivedBy,
          notes: savedPayment.notes,
          createdAt: savedPayment.createdAt
        }
      }
    })
  } catch (error) {
    if (error.name === 'ValidationError') {
      return response.status(400).json({
        error: error.message
      })
    }
    if (error.message.includes('not found') || error.message.includes('required')) {
      return response.status(400).json({
        error: error.message
      })
    }
    response.status(500).json({
      error: 'Failed to create payment for purchase order'
    })
  }
})

// PUT /api/payments/:id - Update payment
paymentsRouter.put('/:id', userExtractor, async (request, response) => {
  const { amount, paymentMethod, paymentDate, notes } = request.body

  try {
    const payment = await Payment.findById(request.params.id)

    if (!payment) {
      return response.status(404).json({
        error: 'Payment not found'
      })
    }

    // Only allow updating pending payments
    if (payment.status !== 'pending') {
      return response.status(400).json({
        error: 'Only pending payments can be updated'
      })
    }

    // Update fields
    if (amount !== undefined) {
      if (amount <= 0) {
        return response.status(400).json({
          error: 'Amount must be greater than 0'
        })
      }
      payment.amount = amount
    }

    if (paymentMethod !== undefined) {
      const validMethods = ['cash', 'card', 'bank_transfer', 'e_wallet', 'check', 'credit']
      if (!validMethods.includes(paymentMethod)) {
        return response.status(400).json({
          error: 'Invalid payment method'
        })
      }
      payment.paymentMethod = paymentMethod
    }

    if (paymentDate !== undefined) {
      payment.paymentDate = new Date(paymentDate)
    }

    if (notes !== undefined) {
      payment.notes = notes
    }

    const updatedPayment = await payment.save()

    response.status(200).json({
      success: true,
      message: 'Payment updated successfully',
      data: {
        payment: {
          id: updatedPayment._id,
          paymentNumber: updatedPayment.paymentNumber,
          paymentType: updatedPayment.paymentType,
          relatedOrderId: updatedPayment.relatedOrderId,
          amount: updatedPayment.amount,
          paymentMethod: updatedPayment.paymentMethod,
          paymentDate: updatedPayment.paymentDate,
          status: updatedPayment.status,
          customerId: updatedPayment.customer,
          supplierId: updatedPayment.supplier,
          receivedBy: updatedPayment.receivedBy,
          notes: updatedPayment.notes,
          updatedAt: updatedPayment.updatedAt
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
        error: 'Invalid payment ID'
      })
    }
    response.status(500).json({
      error: 'Failed to update payment'
    })
  }
})

// PATCH /api/payments/:id/mark-completed - Mark payment as completed
paymentsRouter.patch('/:id/mark-completed', userExtractor, async (request, response) => {
  try {
    const payment = await Payment.findById(request.params.id)

    if (!payment) {
      return response.status(404).json({
        error: 'Payment not found'
      })
    }

    await payment.markAsCompleted()

    // Update related order payment status
    if (payment.paymentType === 'sales') {
      const order = await Order.findById(payment.relatedOrderId)
      if (order) {
        await order.updatePaymentStatus('paid')
      }
    } else if (payment.paymentType === 'purchase') {
      const po = await PurchaseOrder.findById(payment.relatedOrderId)
      if (po) {
        const totalPaid = await Payment.getTotalPaidForOrder(po._id)
        await po.updatePaymentStatus(totalPaid)
      }
    }

    response.status(200).json({
      success: true,
      message: 'Payment marked as completed',
      data: {
        payment: {
          id: payment._id,
          paymentNumber: payment.paymentNumber,
          status: payment.status,
          updatedAt: payment.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.message === 'Only pending payments can be marked as completed') {
      return response.status(400).json({
        error: error.message
      })
    }
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid payment ID'
      })
    }
    response.status(500).json({
      error: 'Failed to mark payment as completed'
    })
  }
})

// PATCH /api/payments/:id/mark-failed - Mark payment as failed
paymentsRouter.patch('/:id/mark-failed', userExtractor, async (request, response) => {
  const { reason } = request.body

  try {
    const payment = await Payment.findById(request.params.id)

    if (!payment) {
      return response.status(404).json({
        error: 'Payment not found'
      })
    }

    await payment.markAsFailed(reason)

    response.status(200).json({
      success: true,
      message: 'Payment marked as failed',
      data: {
        payment: {
          id: payment._id,
          paymentNumber: payment.paymentNumber,
          status: payment.status,
          notes: payment.notes,
          updatedAt: payment.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.message === 'Only pending payments can be marked as failed') {
      return response.status(400).json({
        error: error.message
      })
    }
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid payment ID'
      })
    }
    response.status(500).json({
      error: 'Failed to mark payment as failed'
    })
  }
})

// PATCH /api/payments/:id/refund - Refund payment
paymentsRouter.patch('/:id/refund', userExtractor, async (request, response) => {
  const { refundReason } = request.body

  if (!refundReason) {
    return response.status(400).json({
      error: 'Refund reason is required'
    })
  }

  try {
    const payment = await Payment.findById(request.params.id)

    if (!payment) {
      return response.status(404).json({
        error: 'Payment not found'
      })
    }

    await payment.refund(refundReason)

    // Update related order payment status if needed
    if (payment.paymentType === 'sales') {
      const order = await Order.findById(payment.relatedOrderId)
      if (order && order.paymentStatus === 'paid') {
        await order.updatePaymentStatus('refunded')
      }
    }

    response.status(200).json({
      success: true,
      message: 'Payment refunded successfully',
      data: {
        payment: {
          id: payment._id,
          paymentNumber: payment.paymentNumber,
          status: payment.status,
          refundReason: payment.refundReason,
          updatedAt: payment.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.message === 'Only completed payments can be refunded') {
      return response.status(400).json({
        error: error.message
      })
    }
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid payment ID'
      })
    }
    response.status(500).json({
      error: 'Failed to refund payment'
    })
  }
})

// PATCH /api/payments/:id/cancel - Cancel payment
paymentsRouter.patch('/:id/cancel', userExtractor, async (request, response) => {
  const { reason } = request.body

  try {
    const payment = await Payment.findById(request.params.id)

    if (!payment) {
      return response.status(404).json({
        error: 'Payment not found'
      })
    }

    await payment.cancel(reason)

    response.status(200).json({
      success: true,
      message: 'Payment cancelled successfully',
      data: {
        payment: {
          id: payment._id,
          paymentNumber: payment.paymentNumber,
          status: payment.status,
          notes: payment.notes,
          updatedAt: payment.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.message === 'Cannot cancel completed or refunded payments') {
      return response.status(400).json({
        error: error.message
      })
    }
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid payment ID'
      })
    }
    response.status(500).json({
      error: 'Failed to cancel payment'
    })
  }
})

// DELETE /api/payments/:id - Delete payment (Admin only, strict conditions)
paymentsRouter.delete('/:id', userExtractor, isAdmin, async (request, response) => {
  try {
    const payment = await Payment.findById(request.params.id)

    if (!payment) {
      return response.status(404).json({
        error: 'Payment not found'
      })
    }

    // Only allow deletion of cancelled or failed payments
    if (!['cancelled', 'failed'].includes(payment.status)) {
      return response.status(400).json({
        error: 'Only cancelled or failed payments can be deleted'
      })
    }

    // Check if payment was created recently (within 24 hours)
    const paymentAge = Date.now() - new Date(payment.createdAt).getTime()
    const twentyFourHours = 24 * 60 * 60 * 1000

    if (paymentAge > twentyFourHours) {
      return response.status(400).json({
        error: 'Cannot delete payments older than 24 hours'
      })
    }

    await Payment.findByIdAndDelete(request.params.id)

    response.status(200).json({
      success: true,
      message: 'Payment deleted successfully'
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid payment ID'
      })
    }
    response.status(500).json({
      error: 'Failed to delete payment'
    })
  }
})

module.exports = paymentsRouter
