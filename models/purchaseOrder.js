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
    default: Date.now
  },

  expectedDeliveryDate: {
    type: Date
  },

  subtotal: {
    type: Number,
    default: 0,
    min: [0, 'Subtotal cannot be negative']
  },

  shippingFee: {
    type: Number,
    default: 0,
    min: [0, 'Shipping fee cannot be negative']
  },

  discountPercentage: {
    type: Number,
    default: 0,
    min: [0, 'Discount percentage cannot be negative'],
    max: [100, 'Discount percentage cannot exceed 100']
  },

  total: {
    type: Number,
    default: 0,
    min: [0, 'Total cannot be negative']
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
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
})

// Virtual for purchase order details
purchaseOrderSchema.virtual('details', {
  ref: 'DetailPurchaseOrder',
  localField: '_id',
  foreignField: 'purchaseOrder'
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

// Method to calculate total
purchaseOrderSchema.methods.calculateTotal = async function () {
  const DetailPurchaseOrder = mongoose.model('DetailPurchaseOrder')
  const details = await DetailPurchaseOrder.find({ purchaseOrder: this._id })

  this.subtotal = details.reduce((sum, detail) => sum + detail.totalPrice, 0)

  // Calculate discount amount
  const discountAmount = (this.subtotal * this.discountPercentage) / 100

  // Calculate total
  this.total = this.subtotal - discountAmount + this.shippingFee

  return this.save()
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
purchaseOrderSchema.methods.updatePaymentStatus = function (paidAmount) {
  if (paidAmount === 0) {
    this.paymentStatus = 'unpaid'
  } else if (paidAmount >= this.total) {
    this.paymentStatus = 'paid'
  } else {
    this.paymentStatus = 'partial'
  }
  return this.save()
}

// Static method to get purchase orders with details
purchaseOrderSchema.statics.findWithDetails = function (query = {}) {
  return this.find(query)
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

  const stats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalAmount: { $sum: '$total' },
        averageAmount: { $avg: '$total' },
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
          $sum: { $cond: [{ $eq: ['$paymentStatus', 'unpaid'] }, '$total', 0] }
        },
        partialPaidAmount: {
          $sum: { $cond: [{ $eq: ['$paymentStatus', 'partial'] }, '$total', 0] }
        }
      }
    }
  ])

  return stats[0] || {
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

purchaseOrderSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString()
    delete returnedObject._id
    delete returnedObject.__v
  }
})

module.exports = mongoose.model('PurchaseOrder', purchaseOrderSchema)
