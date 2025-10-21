const paymentsRouter = require('express').Router()
const Payment = require('../models/payment')
const Order = require('../models/order')
const PurchaseOrder = require('../models/purchaseOrder')
const Product = require('../models/product')
const Inventory = require('../models/inventory')
const Customer = require('../models/customer')
const Supplier = require('../models/supplier')
const { userExtractor } = require('../utils/auth')

// GET /api/payments - Get all payments with filtering
paymentsRouter.get('/', userExtractor, async (request, response) => {
  try {
    const {
      page = 1,
      limit = 10,
      sort = '-paymentDate',
      paymentType,
      paymentMethod,
      status,
      startDate,
      endDate
    } = request.query

    // Build filter object
    const filter = {}

    if (paymentType) {
      filter.paymentType = paymentType
    }

    if (paymentMethod) {
      filter.paymentMethod = paymentMethod
    }

    if (status) {
      filter.status = status
    }

    if (startDate || endDate) {
      filter.paymentDate = {}
      if (startDate) filter.paymentDate.$gte = new Date(startDate)
      if (endDate) filter.paymentDate.$lte = new Date(endDate)
    }

    const skip = (parseInt(page) - 1) * parseInt(limit)

    const payments = await Payment
      .find(filter)
      .sort(sort)
      .limit(parseInt(limit))
      .skip(skip)
      .populate('customer', 'customerCode fullName')
      .populate('supplier', 'supplierCode companyName')
      .populate('receivedBy', 'username')

    const total = await Payment.countDocuments(filter)

    response.json({
      payments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    })
  } catch (error) {
    response.status(500).json({ error: error.message })
  }
})

// GET /api/payments/stats - Get payment statistics
paymentsRouter.get('/stats', userExtractor, async (request, response) => {
  try {
    const totalPayments = await Payment.countDocuments()

    // Total sales payments
    const salesPayments = await Payment.aggregate([
      { $match: { paymentType: 'sales', status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ])

    // Total purchase payments
    const purchasePayments = await Payment.aggregate([
      { $match: { paymentType: 'purchase', status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ])

    // Payments by method
    const paymentsByMethod = await Payment.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: '$paymentMethod', count: { $sum: 1 }, total: { $sum: '$amount' } } }
    ])

    response.json({
      totalPayments,
      totalSalesAmount: salesPayments[0]?.total || 0,
      totalPurchaseAmount: purchasePayments[0]?.total || 0,
      paymentsByMethod
    })
  } catch (error) {
    response.status(500).json({ error: error.message })
  }
})

// GET /api/payments/:id - Get payment by ID
paymentsRouter.get('/:id', userExtractor, async (request, response) => {
  try {
    const payment = await Payment
      .findById(request.params.id)
      .populate('customer', 'customerCode fullName email phone')
      .populate('supplier', 'supplierCode companyName email phone')
      .populate('receivedBy', 'username email')

    if (!payment) {
      return response.status(404).json({ error: 'Payment not found' })
    }

    response.json(payment)
  } catch (error) {
    response.status(500).json({ error: error.message })
  }
})

// GET /api/payments/order/:orderId - Get payments for an order
paymentsRouter.get('/order/:orderId', userExtractor, async (request, response) => {
  try {
    const payments = await Payment
      .find({ relatedOrderId: request.params.orderId })
      .sort('-paymentDate')
      .populate('receivedBy', 'username')

    const totalPaid = payments
      .filter(p => p.status === 'completed')
      .reduce((sum, p) => sum + p.netAmount, 0)

    response.json({
      payments,
      totalPaid
    })
  } catch (error) {
    response.status(500).json({ error: error.message })
  }
})

// POST /api/payments - Create new payment
paymentsRouter.post('/', userExtractor, async (request, response) => {
  try {
    const {
      paymentType,
      relatedOrderId,
      amount,
      paymentMethod,
      paymentDate,
      transactionId,
      bankReference,
      cardLastFourDigits,
      notes
    } = request.body

    // Validate required fields
    if (!paymentType || !relatedOrderId || !amount || !paymentMethod) {
      return response.status(400).json({
        error: 'Payment type, related order, amount, and payment method are required'
      })
    }

    let order
    let relatedOrderNumber
    let customer
    let supplier

    // Verify order exists and get details
    if (paymentType === 'sales') {
      order = await Order.findById(relatedOrderId)
      if (!order) {
        return response.status(404).json({ error: 'Order not found' })
      }
      relatedOrderNumber = order.orderNumber
      customer = order.customer?.customerId
    } else if (paymentType === 'purchase') {
      order = await PurchaseOrder.findById(relatedOrderId)
      if (!order) {
        return response.status(404).json({ error: 'Purchase order not found' })
      }
      relatedOrderNumber = order.poNumber
      supplier = order.supplier
    }

    const payment = new Payment({
      paymentType,
      relatedOrderId,
      relatedOrderNumber,
      amount,
      paymentMethod,
      paymentDate: paymentDate || new Date(),
      transactionId,
      bankReference,
      cardLastFourDigits,
      customer,
      supplier,
      receivedBy: request.user.id,
      notes
    })

    const savedPayment = await payment.save()

    // Update order payment status
    if (paymentType === 'sales') {
      const totalPaid = await Payment.aggregate([
        {
          $match: {
            relatedOrderId: order._id,
            status: 'completed'
          }
        },
        { $group: { _id: null, total: { $sum: { $subtract: ['$amount', '$refundedAmount'] } } } }
      ])

      const paidAmount = totalPaid[0]?.total || 0

      if (paidAmount >= order.total) {
        order.paymentStatus = 'paid'
      } else if (paidAmount > 0) {
        order.paymentStatus = 'partial'
      }

      await order.save()
    } else if (paymentType === 'purchase') {
      await order.addPayment(amount)
    }

    await savedPayment.populate('customer', 'customerCode fullName')
    await savedPayment.populate('supplier', 'supplierCode companyName')
    await savedPayment.populate('receivedBy', 'username')

    response.status(201).json(savedPayment)
  } catch (error) {
    response.status(400).json({ error: error.message })
  }
})

// POST /api/payments/:id/refund - Process refund with inventory management
paymentsRouter.post('/:id/refund', userExtractor, async (request, response) => {
  try {
    const { amount, reason } = request.body

    if (!amount || amount <= 0) {
      return response.status(400).json({
        error: 'Refund amount must be positive'
      })
    }

    if (!reason) {
      return response.status(400).json({
        error: 'Refund reason is required'
      })
    }

    const payment = await Payment.findById(request.params.id)

    if (!payment) {
      return response.status(404).json({ error: 'Payment not found' })
    }

    // Process refund (updates payment model)
    await payment.processRefund(amount, reason)

    // Handle inventory restoration for sales payments
    if (payment.paymentType === 'sales') {
      const order = await Order.findById(payment.relatedOrderId).populate('items.product')

      if (order) {
        // Restore inventory for each item in the order
        for (const item of order.items) {
          const inventory = await Inventory.findOne({ product: item.product._id })

          if (inventory) {
            // Find the 'out' movement for this order to get the exact quantity that was sold
            const outMovement = inventory.movements.find(
              m => m.type === 'out' &&
                m.referenceId === payment.relatedOrderNumber &&
                m.referenceType === 'order'
            )

            const quantityToRestore = outMovement ? outMovement.quantity : item.quantity

            // Add stock back to inventory as adjustment (increase)
            await inventory.adjustStockIncrease(
              quantityToRestore,
              `Refund: ${reason}`,
              payment.relatedOrderNumber,
              request.user.id
            )

            // Update product stock to match inventory
            const product = await Product.findById(item.product._id)
            if (product) {
              product.stock = inventory.quantityAvailable
              await product.save()
            }
          }
        }

        // Update order payment status
        const totalPaid = await Payment.aggregate([
          {
            $match: {
              relatedOrderId: order._id,
              status: 'completed'
            }
          },
          { $group: { _id: null, total: { $sum: { $subtract: ['$amount', '$refundedAmount'] } } } }
        ])

        const paidAmount = totalPaid[0]?.total || 0

        if (paidAmount >= order.total) {
          order.paymentStatus = 'paid'
        } else if (paidAmount > 0) {
          order.paymentStatus = 'partial'
        } else {
          order.paymentStatus = 'refunded'
        }

        await order.save()
      }
    }

    // Populate and return
    await payment.populate('customer', 'customerCode fullName')
    await payment.populate('supplier', 'supplierCode companyName')
    await payment.populate('receivedBy', 'username')

    response.json({
      message: 'Refund processed successfully. Inventory has been restored.',
      payment
    })
  } catch (error) {
    console.error('Error processing refund:', error)
    response.status(400).json({ error: error.message })
  }
})

// PUT /api/payments/:id/cancel - Cancel payment
paymentsRouter.put('/:id/cancel', userExtractor, async (request, response) => {
  try {
    const { reason } = request.body

    if (!reason) {
      return response.status(400).json({
        error: 'Cancellation reason is required'
      })
    }

    const payment = await Payment.findById(request.params.id)

    if (!payment) {
      return response.status(404).json({ error: 'Payment not found' })
    }

    await payment.cancel(reason)

    response.json({
      message: 'Payment cancelled successfully',
      payment
    })
  } catch (error) {
    response.status(400).json({ error: error.message })
  }
})

// PUT /api/payments/:id/fail - Mark payment as failed
paymentsRouter.put('/:id/fail', userExtractor, async (request, response) => {
  try {
    const { reason } = request.body

    if (!reason) {
      return response.status(400).json({
        error: 'Failure reason is required'
      })
    }

    const payment = await Payment.findById(request.params.id)

    if (!payment) {
      return response.status(404).json({ error: 'Payment not found' })
    }

    await payment.markAsFailed(reason)

    response.json({
      message: 'Payment marked as failed',
      payment
    })
  } catch (error) {
    response.status(400).json({ error: error.message })
  }
})

// PUT /api/payments/:id/status - Update payment status with inventory management
paymentsRouter.put('/:id/status', userExtractor, async (request, response) => {
  try {
    const { status } = request.body

    // Validate status
    const validStatuses = ['pending', 'completed', 'failed']
    if (!validStatuses.includes(status)) {
      return response.status(400).json({
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      })
    }

    const payment = await Payment.findById(request.params.id)
    if (!payment) {
      return response.status(404).json({ error: 'Payment not found' })
    }

    const oldStatus = payment.status

    // Only allow status changes from pending
    if (oldStatus !== 'pending' && oldStatus !== status) {
      return response.status(400).json({
        error: `Cannot change status from ${oldStatus}. Only pending payments can be updated.`
      })
    }

    // If status is already the same, just return
    if (oldStatus === status) {
      return response.json({
        message: 'Payment status is already ' + status,
        payment
      })
    }

    // Handle sales payments with inventory management
    if (payment.paymentType === 'sales') {
      const order = await Order.findById(payment.relatedOrderId).populate('items.product')

      if (!order) {
        return response.status(404).json({ error: 'Related order not found' })
      }

      // Process each item in the order
      for (const item of order.items) {
        const inventory = await Inventory.findOne({ product: item.product._id })

        if (!inventory) {
          return response.status(404).json({
            error: `Inventory not found for product ${item.product.name}`
          })
        }

        if (status === 'failed') {
          // Release reserved stock back to available
          await inventory.releaseStock(
            item.quantity,
            order.orderNumber,
            request.user.id
          )

        } else if (status === 'completed') {
          // Deduct from onHand and release from reserved
          // First remove from onHand
          await inventory.removeStock(
            item.quantity,
            'Payment completed',
            order.orderNumber,
            request.user.id
          )

          // Then release from reserved
          await inventory.releaseStock(
            item.quantity,
            order.orderNumber,
            request.user.id
          )

          // Update product stock
          const product = await Product.findById(item.product._id)
          if (product) {
            product.stock = inventory.quantityAvailable
            await product.save()
          }
        }
      }

      // Update order payment status
      if (status === 'completed') {
        order.paymentStatus = 'paid'
        order.paidAt = new Date()

        // Update customer totalSpent if customer exists
        if (order.customer && order.customer.email) {
          try {
            const customer = await Customer.findOne({ email: order.customer.email })
            if (customer) {
              await customer.updatePurchaseStats(order.total)
            }
          } catch (customerError) {
            console.error('Error updating customer stats:', customerError)
            // Don't fail the payment if customer update fails
          }
        }
      } else if (status === 'failed') {
        order.paymentStatus = 'failed'
      }
      await order.save()
    }

    // Handle purchase payments with supplier debt management
    if (payment.paymentType === 'purchase') {
      const purchaseOrder = await PurchaseOrder.findById(payment.relatedOrderId).populate('supplier')

      if (!purchaseOrder) {
        return response.status(404).json({ error: 'Related purchase order not found' })
      }

      if (status === 'completed') {
        // Update purchase order payment tracking
        purchaseOrder.paidAmount = (purchaseOrder.paidAmount || 0) + payment.amount

        // Update payment status based on paid amount
        if (purchaseOrder.paidAmount >= purchaseOrder.total) {
          purchaseOrder.paymentStatus = 'paid'
        } else if (purchaseOrder.paidAmount > 0) {
          purchaseOrder.paymentStatus = 'partial'
        }

        await purchaseOrder.save()

        // Update supplier debt and purchase stats
        if (purchaseOrder.supplier) {
          try {
            const supplier = await Supplier.findById(purchaseOrder.supplier._id || purchaseOrder.supplier)
            if (supplier) {
              // Pay debt (reduce current debt)
              await supplier.payDebt(payment.amount)

              // Update total purchase amount (only amount, not count)
              supplier.totalPurchaseAmount = (supplier.totalPurchaseAmount || 0) + payment.amount
              await supplier.save()
            }
          } catch (supplierError) {
            console.error('Error updating supplier stats:', supplierError)
            // Don't fail the payment if supplier update fails
          }
        }
      } else if (status === 'failed') {
        purchaseOrder.paymentStatus = purchaseOrder.paidAmount > 0 ? 'partial' : 'unpaid'
        await purchaseOrder.save()
      }
    }

    // Update payment status
    payment.status = status
    await payment.save()

    // Populate and return
    await payment.populate('customer', 'customerCode fullName')
    await payment.populate('supplier', 'supplierCode companyName')
    await payment.populate('receivedBy', 'username')

    response.json({
      message: `Payment status updated to ${status}`,
      payment
    })
  } catch (error) {
    console.error('Error updating payment status:', error)
    response.status(400).json({ error: error.message })
  }
})

// PATCH /api/payments/:id/method - Update payment method
paymentsRouter.patch('/:id/method', userExtractor, async (request, response) => {
  try {
    const { paymentMethod } = request.body

    // Validate payment method
    const validMethods = ['cash', 'card', 'bank_transfer', 'e_wallet', 'check', 'credit']
    if (!paymentMethod || !validMethods.includes(paymentMethod)) {
      return response.status(400).json({
        error: `Invalid payment method. Must be one of: ${validMethods.join(', ')}`
      })
    }

    const payment = await Payment.findById(request.params.id)

    if (!payment) {
      return response.status(404).json({ error: 'Payment not found' })
    }

    // Update payment method
    payment.paymentMethod = paymentMethod
    await payment.save()

    // Populate and return
    await payment.populate('customer', 'customerCode fullName')
    await payment.populate('supplier', 'supplierCode companyName')
    await payment.populate('receivedBy', 'username')

    response.json({
      message: `Payment method updated to ${paymentMethod}`,
      payment
    })
  } catch (error) {
    console.error('Error updating payment method:', error)
    response.status(400).json({ error: error.message })
  }
})

// DELETE /api/payments/:id - Delete payment (only pending/failed)
paymentsRouter.delete('/:id', userExtractor, async (request, response) => {
  try {
    const payment = await Payment.findById(request.params.id)

    if (!payment) {
      return response.status(404).json({ error: 'Payment not found' })
    }

    // Only pending or failed payments can be deleted
    if (!['pending', 'failed', 'cancelled'].includes(payment.status)) {
      return response.status(400).json({
        error: 'Only pending, failed, or cancelled payments can be deleted'
      })
    }

    await Payment.findByIdAndDelete(request.params.id)
    response.json({ message: 'Payment deleted successfully' })
  } catch (error) {
    response.status(500).json({ error: error.message })
  }
})

module.exports = paymentsRouter
