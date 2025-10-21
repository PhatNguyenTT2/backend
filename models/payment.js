const mongoose = require('mongoose')

const paymentSchema = new mongoose.Schema({
  paymentNumber: {
    type: String,
    unique: true,
    // Auto-generate: PAY2025000001
  },

  paymentType: {
    type: String,
    required: [true, 'Payment type is required'],
    enum: {
      values: ['sales', 'purchase'],
      message: '{VALUE} is not a valid payment type'
    }
  },

  relatedOrderId: {
    type: mongoose.Schema.Types.ObjectId,
    required: [true, 'Related order ID is required']
    // Note: This can reference either Order or PurchaseOrder
  },

  relatedOrderNumber: {
    type: String,
    trim: true
    // Cached order/PO number for quick access
  },

  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0, 'Amount cannot be negative']
  },

  paymentMethod: {
    type: String,
    required: [true, 'Payment method is required'],
    enum: {
      values: ['cash', 'card', 'bank_transfer', 'e_wallet', 'check', 'credit'],
      message: '{VALUE} is not a valid payment method'
    }
  },

  paymentDate: {
    type: Date,
    default: Date.now
  },

  status: {
    type: String,
    enum: {
      values: ['pending', 'completed', 'failed', 'refunded', 'cancelled'],
      message: '{VALUE} is not a valid status'
    },
    default: 'completed'
  },

  refundReason: {
    type: String,
    trim: true,
    maxlength: [500, 'Refund reason must be at most 500 characters']
  },

  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer'
    // For sales payments
  },

  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier'
    // For purchase payments
  },

  receivedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: [true, 'Received by is required']
  },

  notes: {
    type: String,
    trim: true,
    maxlength: [1000, 'Notes must be at most 1000 characters']
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
})

// Indexes for faster queries
paymentSchema.index({ paymentNumber: 1 })
paymentSchema.index({ paymentType: 1 })
paymentSchema.index({ status: 1 })
paymentSchema.index({ paymentDate: -1 })
paymentSchema.index({ customer: 1 })
paymentSchema.index({ supplier: 1 })
paymentSchema.index({ receivedBy: 1 })

// Pre-save hook to generate payment number
paymentSchema.pre('save', async function (next) {
  if (this.isNew && !this.paymentNumber) {
    const year = new Date().getFullYear()
    const count = await mongoose.model('Payment').countDocuments()
    this.paymentNumber = `PAY${year}${String(count + 1).padStart(6, '0')}`
  }
  next()
})

// Pre-save validation: customer for sales, supplier for purchase
paymentSchema.pre('save', function (next) {
  if (this.paymentType === 'sales' && !this.customer) {
    return next(new Error('Customer is required for sales payments'))
  }
  if (this.paymentType === 'purchase' && !this.supplier) {
    return next(new Error('Supplier is required for purchase payments'))
  }
  next()
})

// Method to mark as completed
paymentSchema.methods.markAsCompleted = function () {
  if (this.status !== 'pending') {
    throw new Error('Only pending payments can be marked as completed')
  }
  this.status = 'completed'
  return this.save()
}

// Method to mark as failed
paymentSchema.methods.markAsFailed = function (reason) {
  if (this.status !== 'pending') {
    throw new Error('Only pending payments can be marked as failed')
  }
  this.status = 'failed'
  if (reason) {
    this.notes = this.notes ? `${this.notes}\nFailed: ${reason}` : `Failed: ${reason}`
  }
  return this.save()
}

// Method to refund payment
paymentSchema.methods.refund = function (refundReason) {
  if (this.status !== 'completed') {
    throw new Error('Only completed payments can be refunded')
  }
  this.status = 'refunded'
  this.refundReason = refundReason
  return this.save()
}

// Method to cancel payment
paymentSchema.methods.cancel = function (reason) {
  if (this.status === 'completed' || this.status === 'refunded') {
    throw new Error('Cannot cancel completed or refunded payments')
  }
  this.status = 'cancelled'
  if (reason) {
    this.notes = this.notes ? `${this.notes}\nCancelled: ${reason}` : `Cancelled: ${reason}`
  }
  return this.save()
}

// Static method to create payment for order
paymentSchema.statics.createForOrder = async function (paymentData) {
  const Order = mongoose.model('Order')
  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    // Get order
    const order = await Order.findById(paymentData.relatedOrderId).session(session)
    if (!order) {
      throw new Error('Order not found')
    }

    // Create payment
    const payment = new this({
      ...paymentData,
      paymentType: 'sales',
      relatedOrderNumber: order.orderNumber,
      customer: order.customer
    })
    await payment.save({ session })

    // Update order payment status
    await order.updatePaymentStatus('paid')

    await session.commitTransaction()
    return payment
  } catch (error) {
    await session.abortTransaction()
    throw error
  } finally {
    session.endSession()
  }
}

// Static method to create payment for purchase order
paymentSchema.statics.createForPurchaseOrder = async function (paymentData) {
  const PurchaseOrder = mongoose.model('PurchaseOrder')
  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    // Get purchase order
    const po = await PurchaseOrder.findById(paymentData.relatedOrderId).session(session)
    if (!po) {
      throw new Error('Purchase order not found')
    }

    // Create payment
    const payment = new this({
      ...paymentData,
      paymentType: 'purchase',
      relatedOrderNumber: po.poNumber,
      supplier: po.supplier
    })
    await payment.save({ session })

    // Update purchase order payment status
    const totalPaid = await this.getTotalPaidForOrder(po._id)
    await po.updatePaymentStatus(totalPaid)

    await session.commitTransaction()
    return payment
  } catch (error) {
    await session.abortTransaction()
    throw error
  } finally {
    session.endSession()
  }
}

// Static method to get payments by type
paymentSchema.statics.findByType = function (paymentType, query = {}) {
  return this.find({ ...query, paymentType })
    .populate('receivedBy', 'fullName')
    .populate('customer', 'customerCode fullName')
    .populate('supplier', 'supplierCode companyName')
    .sort({ paymentDate: -1 })
}

// Static method to get payments by customer
paymentSchema.statics.findByCustomer = function (customerId) {
  return this.find({ customer: customerId, paymentType: 'sales' })
    .populate('receivedBy', 'fullName')
    .sort({ paymentDate: -1 })
}

// Static method to get payments by supplier
paymentSchema.statics.findBySupplier = function (supplierId) {
  return this.find({ supplier: supplierId, paymentType: 'purchase' })
    .populate('receivedBy', 'fullName')
    .sort({ paymentDate: -1 })
}

// Static method to get total paid for an order
paymentSchema.statics.getTotalPaidForOrder = async function (orderId) {
  const result = await this.aggregate([
    {
      $match: {
        relatedOrderId: orderId,
        status: { $in: ['completed', 'pending'] }
      }
    },
    {
      $group: {
        _id: null,
        totalPaid: { $sum: '$amount' }
      }
    }
  ])

  return result.length > 0 ? result[0].totalPaid : 0
}

// Static method to get payment statistics
paymentSchema.statics.getStatistics = async function (options = {}) {
  const { startDate, endDate, paymentType } = options

  const matchStage = {}

  if (startDate || endDate) {
    matchStage.paymentDate = {}
    if (startDate) matchStage.paymentDate.$gte = new Date(startDate)
    if (endDate) matchStage.paymentDate.$lte = new Date(endDate)
  }

  if (paymentType) {
    matchStage.paymentType = paymentType
  }

  const stats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalPayments: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
        averageAmount: { $avg: '$amount' },
        completedPayments: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
        },
        pendingPayments: {
          $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
        },
        failedPayments: {
          $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
        },
        refundedPayments: {
          $sum: { $cond: [{ $eq: ['$status', 'refunded'] }, 1, 0] }
        },
        refundedAmount: {
          $sum: { $cond: [{ $eq: ['$status', 'refunded'] }, '$amount', 0] }
        },
        cashPayments: {
          $sum: { $cond: [{ $eq: ['$paymentMethod', 'cash'] }, '$amount', 0] }
        },
        cardPayments: {
          $sum: { $cond: [{ $eq: ['$paymentMethod', 'card'] }, '$amount', 0] }
        },
        transferPayments: {
          $sum: { $cond: [{ $eq: ['$paymentMethod', 'bank_transfer'] }, '$amount', 0] }
        }
      }
    }
  ])

  return stats[0] || {
    totalPayments: 0,
    totalAmount: 0,
    averageAmount: 0,
    completedPayments: 0,
    pendingPayments: 0,
    failedPayments: 0,
    refundedPayments: 0,
    refundedAmount: 0,
    cashPayments: 0,
    cardPayments: 0,
    transferPayments: 0
  }
}

// Static method to get daily revenue
paymentSchema.statics.getDailyRevenue = async function (days = 7, paymentType = null) {
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  const matchStage = {
    paymentDate: { $gte: startDate },
    status: 'completed'
  }

  if (paymentType) {
    matchStage.paymentType = paymentType
  }

  const revenue = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$paymentDate' }
        },
        totalAmount: { $sum: '$amount' },
        paymentCount: { $sum: 1 }
      }
    },
    {
      $sort: { _id: 1 }
    }
  ])

  return revenue
}

// Static method to get payment methods breakdown
paymentSchema.statics.getPaymentMethodsBreakdown = async function (options = {}) {
  const { startDate, endDate, paymentType } = options

  const matchStage = {
    status: 'completed'
  }

  if (startDate || endDate) {
    matchStage.paymentDate = {}
    if (startDate) matchStage.paymentDate.$gte = new Date(startDate)
    if (endDate) matchStage.paymentDate.$lte = new Date(endDate)
  }

  if (paymentType) {
    matchStage.paymentType = paymentType
  }

  const breakdown = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$paymentMethod',
        totalAmount: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    },
    {
      $sort: { totalAmount: -1 }
    }
  ])

  return breakdown
}

paymentSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString()
    delete returnedObject._id
    delete returnedObject.__v
  }
})

module.exports = mongoose.model('Payment', paymentSchema)
