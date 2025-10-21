const mongoose = require('mongoose')

const paymentSchema = new mongoose.Schema({
  paymentNumber: {
    type: String,
    unique: true,
    // Auto-generate: PAY2025000001
  },

  paymentType: {
    type: String,
    enum: ['sales', 'purchase'],
    required: true
  },

  // Reference to Order or PurchaseOrder
  relatedOrderId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },

  relatedOrderNumber: {
    type: String, // Cached order/PO number for history
  },

  amount: {
    type: Number,
    required: true,
    min: 0
  },

  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'bank_transfer', 'e_wallet', 'check', 'credit'],
    required: true
  },

  paymentDate: {
    type: Date,
    default: Date.now
  },

  transactionId: {
    type: String,
    trim: true
  },

  bankReference: {
    type: String,
    trim: true
  },

  cardLastFourDigits: {
    type: String,
    trim: true
  },

  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded', 'cancelled'],
    default: 'completed'
  },

  refundedAmount: {
    type: Number,
    default: 0,
    min: 0
  },

  refundReason: {
    type: String,
    trim: true
  },

  refundedAt: {
    type: Date
  },

  // For sales payments
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer'
  },

  // For purchase payments
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier'
  },

  receivedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  notes: {
    type: String,
    trim: true
  },

  attachments: [{
    filename: String,
    url: String,
    uploadedAt: Date
  }]

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
})

// Index for faster queries
paymentSchema.index({ paymentNumber: 1 })
paymentSchema.index({ paymentType: 1 })
paymentSchema.index({ relatedOrderId: 1 })
paymentSchema.index({ status: 1 })
paymentSchema.index({ paymentDate: -1 })
paymentSchema.index({ customer: 1 })
paymentSchema.index({ supplier: 1 })

// Pre-save hook to generate payment number
paymentSchema.pre('save', async function (next) {
  if (this.isNew && !this.paymentNumber) {
    const year = new Date().getFullYear()
    const count = await mongoose.model('Payment').countDocuments()
    this.paymentNumber = `PAY${year}${String(count + 1).padStart(6, '0')}`
  }
  next()
})

// Method to process refund
paymentSchema.methods.processRefund = function (amount, reason) {
  if (this.status !== 'completed') {
    throw new Error('Only completed payments can be refunded')
  }

  if (amount <= 0) {
    throw new Error('Refund amount must be positive')
  }

  if (this.refundedAmount + amount > this.amount) {
    throw new Error('Refund amount exceeds payment amount')
  }

  this.refundedAmount += amount
  this.refundReason = reason
  this.refundedAt = new Date()

  if (this.refundedAmount >= this.amount) {
    this.status = 'refunded'
  }

  return this.save()
}

// Method to cancel payment
paymentSchema.methods.cancel = function (reason) {
  if (this.status === 'completed') {
    throw new Error('Cannot cancel completed payment. Use refund instead.')
  }

  if (this.status === 'cancelled') {
    throw new Error('Payment is already cancelled')
  }

  this.status = 'cancelled'
  this.notes = `Cancelled: ${reason}. ${this.notes || ''}`

  return this.save()
}

// Method to mark as failed
paymentSchema.methods.markAsFailed = function (reason) {
  this.status = 'failed'
  this.notes = `Failed: ${reason}. ${this.notes || ''}`

  return this.save()
}

// Virtual for net amount (after refunds)
paymentSchema.virtual('netAmount').get(function () {
  return this.amount - this.refundedAmount
})

paymentSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString()
    delete returnedObject._id
    delete returnedObject.__v
  }
})

module.exports = mongoose.model('Payment', paymentSchema)
