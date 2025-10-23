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

  orderDate: {
    type: Date,
    default: Date.now,
    required: [true, 'Order date is required']
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
    type: mongoose.Schema.Types.Decimal128,
    default: 0,
    min: [0, 'Discount percentage cannot be negative'],
    max: [100, 'Discount percentage cannot exceed 100'],
    get: function (value) {
      if (value) {
        return parseFloat(value.toString())
      }
      return 0
    }
  },

  totalPrice: {
    type: mongoose.Schema.Types.Decimal128,
    default: 0,
    min: [0, 'Total price cannot be negative'],
    get: function (value) {
      if (value) {
        return parseFloat(value.toString())
      }
      return 0
    }
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

// Virtual field: Calculate subtotal from details (for display purposes)
purchaseOrderSchema.virtual('subtotal').get(function () {
  if (this.details && Array.isArray(this.details)) {
    return this.details.reduce((sum, detail) => sum + detail.total, 0)
  }
  return 0
})

// Virtual field: Calculate discount amount (for display purposes)
purchaseOrderSchema.virtual('discountAmount').get(function () {
  if (this.details && Array.isArray(this.details)) {
    const subtotal = this.details.reduce((sum, detail) => sum + detail.total, 0)
    return (subtotal * this.discountPercentage) / 100
  }
  return 0
})

// Indexes for faster queries
purchaseOrderSchema.index({ poNumber: 1 })
purchaseOrderSchema.index({ supplier: 1 })
purchaseOrderSchema.index({ status: 1 })
purchaseOrderSchema.index({ paymentStatus: 1 })
purchaseOrderSchema.index({ orderDate: -1 })

// Pre-save hook to generate PO number
purchaseOrderSchema.pre('save', async function (next) {
  if (this.isNew && !this.poNumber) {
    const year = new Date().getFullYear()
    const count = await mongoose.model('PurchaseOrder').countDocuments()
    this.poNumber = `PO${year}${String(count + 1).padStart(6, '0')}`
  }
  next()
})

// Method to recalculate and save totalPrice
purchaseOrderSchema.methods.recalculateTotalPrice = async function () {
  const DetailPurchaseOrder = mongoose.model('DetailPurchaseOrder')
  const details = await DetailPurchaseOrder.find({ purchaseOrder: this._id })

  const subtotal = details.reduce((sum, detail) => sum + detail.total, 0)
  const discountAmount = (subtotal * this.discountPercentage) / 100
  this.totalPrice = subtotal - discountAmount + this.shippingFee

  return this.save()
}

// Method to get calculated totals with populated details (for backward compatibility)
purchaseOrderSchema.methods.getCalculatedTotals = async function () {
  const DetailPurchaseOrder = mongoose.model('DetailPurchaseOrder')
  const details = await DetailPurchaseOrder.find({ purchaseOrder: this._id })

  const subtotal = details.reduce((sum, detail) => sum + detail.total, 0)
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
  if (paidAmount === 0) {
    this.paymentStatus = 'unpaid'
  } else if (paidAmount >= this.totalPrice) {
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
    .sort({ orderDate: -1 })

  // Virtual fields will automatically calculate subtotal, discountAmount, and total
  // when details are populated
  return orders
}

// Static method to get purchase order statistics
purchaseOrderSchema.statics.getStatistics = async function (options = {}) {
  const { startDate, endDate, supplierId } = options

  const matchStage = {}

  if (startDate || endDate) {
    matchStage.orderDate = {}
    if (startDate) matchStage.orderDate.$gte = new Date(startDate)
    if (endDate) matchStage.orderDate.$lte = new Date(endDate)
  }

  if (supplierId) {
    matchStage.supplier = new mongoose.Types.ObjectId(supplierId)
  }

  const pipeline = [
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalAmount: { $sum: { $toDouble: '$totalPrice' } },
        pendingOrders: {
          $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
        },
        approvedOrders: {
          $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] }
        },
        receivedOrders: {
          $sum: { $cond: [{ $eq: ['$status', 'received'] }, 1, 0] }
        },
        cancelledOrders: {
          $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
        },
        unpaidAmount: {
          $sum: {
            $cond: [
              { $eq: ['$paymentStatus', 'unpaid'] },
              { $toDouble: '$totalPrice' },
              0
            ]
          }
        },
        partialPaidAmount: {
          $sum: {
            $cond: [
              { $eq: ['$paymentStatus', 'partial'] },
              { $toDouble: '$totalPrice' },
              0
            ]
          }
        }
      }
    }
  ]

  const result = await this.aggregate(pipeline)

  if (result.length === 0) {
    return {
      totalOrders: 0,
      totalAmount: 0,
      averageAmount: 0,
      pendingOrders: 0,
      approvedOrders: 0,
      receivedOrders: 0,
      cancelledOrders: 0,
      unpaidAmount: 0,
      partialPaidAmount: 0
    }
  }

  const stats = result[0]
  stats.averageAmount = stats.totalOrders > 0 ? stats.totalAmount / stats.totalOrders : 0
  delete stats._id

  return stats
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
    if (returnedObject.discountPercentage && typeof returnedObject.discountPercentage === 'object') {
      returnedObject.discountPercentage = parseFloat(returnedObject.discountPercentage.toString())
    }
    if (returnedObject.totalPrice && typeof returnedObject.totalPrice === 'object') {
      returnedObject.totalPrice = parseFloat(returnedObject.totalPrice.toString())
    }
  }
})

module.exports = mongoose.model('PurchaseOrder', purchaseOrderSchema)
