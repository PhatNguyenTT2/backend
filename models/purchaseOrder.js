const mongoose = require('mongoose')

const purchaseOrderSchema = new mongoose.Schema({
  poNumber: {
    type: String,
    unique: true,
    // Auto-generate: PO2025000001
  },

  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier',
    required: [true, 'Supplier is required']
  },

  expectedDeliveryDate: {
    type: Date
  },

  shippingFee: {
    type: mongoose.Schema.Types.Decimal128,
    default: 0,
    min: [0, 'Shipping fee cannot be negative'],
    get: function (value) {
      if (value) {
        return parseFloat(value.toString())
      }
      return 0
    }
  },

  discountPercentage: {
    type: Number,
    default: 0,
    min: [0, 'Discount percentage cannot be negative'],
    max: [100, 'Discount percentage cannot exceed 100']
  },

  status: {
    type: String,
    enum: {
      values: ['pending', 'approved', 'received', 'cancelled'],
      message: '{VALUE} is not a valid status'
    },
    default: 'pending'
  },

  paymentStatus: {
    type: String,
    enum: {
      values: ['unpaid', 'partial', 'paid'],
      message: '{VALUE} is not a valid payment status'
    },
    default: 'unpaid'
  },

  notes: {
    type: String,
    trim: true
  },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true, getters: true },
  toObject: { virtuals: true, getters: true }
})

// Virtual for purchase order details
purchaseOrderSchema.virtual('details', {
  ref: 'DetailPurchaseOrder',
  localField: '_id',
  foreignField: 'purchaseOrder'
})

// Virtual field: Calculate subtotal from details (sync version for toJSON)
// Note: This returns 0 for non-populated documents
purchaseOrderSchema.virtual('subtotal').get(function () {
  if (this.details && Array.isArray(this.details)) {
    return this.details.reduce((sum, detail) => sum + detail.totalPrice, 0)
  }
  return 0
})

// Virtual field: Calculate discount amount
purchaseOrderSchema.virtual('discountAmount').get(function () {
  return (this.subtotal * this.discountPercentage) / 100
})

// Virtual field: Calculate total
purchaseOrderSchema.virtual('total').get(function () {
  return this.subtotal - this.discountAmount + this.shippingFee
})

// Indexes for faster queries
purchaseOrderSchema.index({ poNumber: 1 })
purchaseOrderSchema.index({ supplier: 1 })
purchaseOrderSchema.index({ status: 1 })
purchaseOrderSchema.index({ paymentStatus: 1 })
purchaseOrderSchema.index({ createdAt: -1 })

// Pre-save hook to generate PO number
purchaseOrderSchema.pre('save', async function (next) {
  if (this.isNew && !this.poNumber) {
    const year = new Date().getFullYear()
    const count = await mongoose.model('PurchaseOrder').countDocuments()
    this.poNumber = `PO${year}${String(count + 1).padStart(6, '0')}`
  }
  next()
})

// Method to get calculated totals with populated details
purchaseOrderSchema.methods.getCalculatedTotals = async function () {
  const DetailPurchaseOrder = mongoose.model('DetailPurchaseOrder')
  const details = await DetailPurchaseOrder.find({ purchaseOrder: this._id })

  const subtotal = details.reduce((sum, detail) => sum + detail.totalPrice, 0)
  const discountAmount = (subtotal * this.discountPercentage) / 100
  const total = subtotal - discountAmount + this.shippingFee

  return {
    subtotal,
    discountAmount,
    total,
    details
  }
}

// Method to approve purchase order
purchaseOrderSchema.methods.approve = function () {
  if (this.status !== 'pending') {
    throw new Error('Only pending purchase orders can be approved')
  }
  this.status = 'approved'
  return this.save()
}

// Method to mark as received
purchaseOrderSchema.methods.markAsReceived = function () {
  if (this.status !== 'approved') {
    throw new Error('Only approved purchase orders can be marked as received')
  }
  this.status = 'received'
  return this.save()
}

// Method to cancel purchase order
purchaseOrderSchema.methods.cancel = function () {
  if (this.status === 'received') {
    throw new Error('Cannot cancel received purchase orders')
  }
  this.status = 'cancelled'
  return this.save()
}

// Method to update payment status
purchaseOrderSchema.methods.updatePaymentStatus = async function (paidAmount) {
  const { total } = await this.getCalculatedTotals()

  if (paidAmount === 0) {
    this.paymentStatus = 'unpaid'
  } else if (paidAmount >= total) {
    this.paymentStatus = 'paid'
  } else {
    this.paymentStatus = 'partial'
  }
  return this.save()
}

// Static method to get purchase orders with details and calculated totals
purchaseOrderSchema.statics.findWithDetails = async function (query = {}) {
  const orders = await this.find(query)
    .populate('supplier', 'companyName email phone')
    .populate('createdBy', 'username fullName')
    .populate({
      path: 'details',
      populate: {
        path: 'product',
        select: 'name sku image'
      }
    })
    .sort({ createdAt: -1 })

  // Virtual fields will automatically calculate subtotal, discountAmount, and total
  // when details are populated
  return orders
}

// Static method to get purchase order statistics
purchaseOrderSchema.statics.getStatistics = async function (options = {}) {
  const { startDate, endDate, supplierId } = options

  const matchStage = {}

  if (startDate || endDate) {
    matchStage.createdAt = {}
    if (startDate) matchStage.createdAt.$gte = new Date(startDate)
    if (endDate) matchStage.createdAt.$lte = new Date(endDate)
  }

  if (supplierId) {
    matchStage.supplier = new mongoose.Types.ObjectId(supplierId)
  }

  // Get all matching orders and calculate totals
  const orders = await this.find(matchStage).populate('details')

  // Calculate statistics from orders with virtual fields
  const totalOrders = orders.length
  const totalAmount = orders.reduce((sum, order) => sum + order.total, 0)
  const averageAmount = totalOrders > 0 ? totalAmount / totalOrders : 0

  const pendingOrders = orders.filter(o => o.status === 'pending').length
  const approvedOrders = orders.filter(o => o.status === 'approved').length
  const receivedOrders = orders.filter(o => o.status === 'received').length
  const cancelledOrders = orders.filter(o => o.status === 'cancelled').length

  const unpaidAmount = orders
    .filter(o => o.paymentStatus === 'unpaid')
    .reduce((sum, order) => sum + order.total, 0)

  const partialPaidAmount = orders
    .filter(o => o.paymentStatus === 'partial')
    .reduce((sum, order) => sum + order.total, 0)

  return {
    totalOrders,
    totalAmount,
    averageAmount,
    pendingOrders,
    approvedOrders,
    receivedOrders,
    cancelledOrders,
    unpaidAmount,
    partialPaidAmount
  }
}

purchaseOrderSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString()
    delete returnedObject._id
    delete returnedObject.__v

    // Convert Decimal128 to number
    if (returnedObject.shippingFee && typeof returnedObject.shippingFee === 'object') {
      returnedObject.shippingFee = parseFloat(returnedObject.shippingFee.toString())
    }
  }
})

module.exports = mongoose.model('PurchaseOrder', purchaseOrderSchema)
