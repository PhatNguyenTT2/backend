const mongoose = require('mongoose')

const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    unique: true,
    // Auto-generate: ORD2501000001
  },

  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer'
  },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  },

  deliveryType: {
    type: String,
    enum: {
      values: ['delivery', 'pickup'],
      message: '{VALUE} is not a valid delivery type'
    },
    default: 'delivery'
  },

  address: {
    type: String,
    trim: true,
    maxlength: [300, 'Address must be at most 300 characters']
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

  total: {
    type: mongoose.Schema.Types.Decimal128,
    default: 0,
    min: [0, 'Total cannot be negative'],
    get: function (value) {
      if (value) {
        return parseFloat(value.toString())
      }
      return 0
    }
  },

  paymentStatus: {
    type: String,
    enum: {
      values: ['pending', 'paid', 'failed', 'refunded'],
      message: '{VALUE} is not a valid payment status'
    },
    default: 'pending'
  },

  status: {
    type: String,
    enum: {
      values: ['pending', 'processing', 'shipping', 'delivered', 'cancelled'],
      message: '{VALUE} is not a valid status'
    },
    default: 'pending'
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true, getters: true },
  toObject: { virtuals: true, getters: true }
})

// Virtual for order details
orderSchema.virtual('details', {
  ref: 'OrderDetail',
  localField: '_id',
  foreignField: 'order'
})

// Virtual: Subtotal (calculated from details when populated)
orderSchema.virtual('subtotal').get(function () {
  if (this.details && Array.isArray(this.details)) {
    return this.details.reduce((sum, detail) => sum + detail.totalPrice, 0)
  }
  return 0
})

// Virtual: Discount Amount
orderSchema.virtual('discountAmount').get(function () {
  return parseFloat(((this.subtotal * this.discountPercentage) / 100).toFixed(2))
})

// Indexes for faster queries
orderSchema.index({ orderNumber: 1 })
orderSchema.index({ customer: 1, createdAt: -1 })
orderSchema.index({ createdBy: 1, createdAt: -1 })
orderSchema.index({ status: 1 })
orderSchema.index({ paymentStatus: 1 })
orderSchema.index({ createdAt: -1 })
orderSchema.index({ total: 1 })

// Pre-save hook to generate order number
orderSchema.pre('save', async function (next) {
  if (this.isNew && !this.orderNumber) {
    const date = new Date()
    const year = date.getFullYear().toString().slice(-2)
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const count = await mongoose.model('Order').countDocuments()
    this.orderNumber = `ORD${year}${month}${String(count + 1).padStart(5, '0')}`
  }
  next()
})

// Method to recalculate and update total from details
orderSchema.methods.recalculateTotals = async function () {
  const OrderDetail = mongoose.model('OrderDetail')
  const details = await OrderDetail.find({ order: this._id })

  // Calculate subtotal
  const subtotal = details.reduce((sum, detail) => sum + detail.totalPrice, 0)

  // Calculate discount amount
  const discountAmount = (subtotal * this.discountPercentage) / 100

  // Calculate and store total
  this.total = subtotal - discountAmount + this.shippingFee

  return this.save()
}

// Method to start processing
orderSchema.methods.startProcessing = function () {
  if (this.status !== 'pending') {
    throw new Error('Only pending orders can be processed')
  }
  this.status = 'processing'
  return this.save()
}

// Method to mark as shipping
orderSchema.methods.markAsShipping = function () {
  if (this.status !== 'processing') {
    throw new Error('Only processing orders can be marked as shipping')
  }
  this.status = 'shipping'
  return this.save()
}

// Method to mark as delivered
orderSchema.methods.markAsDelivered = function () {
  if (this.deliveryType === 'pickup') {
    if (this.status !== 'processing') {
      throw new Error('Pickup orders must be in processing status')
    }
  } else {
    if (this.status !== 'shipping') {
      throw new Error('Delivery orders must be in shipping status')
    }
  }
  this.status = 'delivered'
  return this.save()
}

// Method to cancel order
orderSchema.methods.cancel = function () {
  if (this.status === 'delivered') {
    throw new Error('Cannot cancel delivered orders')
  }
  this.status = 'cancelled'
  return this.save()
}

// Method to update payment status
orderSchema.methods.updatePaymentStatus = function (newStatus) {
  const validStatuses = ['pending', 'paid', 'failed', 'refunded']
  if (!validStatuses.includes(newStatus)) {
    throw new Error('Invalid payment status')
  }
  this.paymentStatus = newStatus
  return this.save()
}

// Method to apply discount
orderSchema.methods.applyDiscount = async function (discountPercentage) {
  this.discountPercentage = discountPercentage
  return this.recalculateTotals()
}

// Method to update shipping fee
orderSchema.methods.updateShippingFee = async function (shippingFee) {
  this.shippingFee = shippingFee
  return this.recalculateTotals()
}

// Static method to get orders with details (subtotal will be calculated)
orderSchema.statics.findWithDetails = function (query = {}) {
  return this.find(query)
    .populate('customer', 'customerCode fullName email phone')
    .populate('createdBy', 'fullName')
    .populate({
      path: 'details',
      populate: {
        path: 'product',
        select: 'productCode name image'
      }
    })
    .sort({ createdAt: -1 })
}

// Static method to find by customer
orderSchema.statics.findByCustomer = function (customerId) {
  return this.find({ customer: customerId })
    .populate('details')
    .sort({ createdAt: -1 })
}

// Static method to find by status
orderSchema.statics.findByStatus = function (status) {
  return this.find({ status })
    .populate('customer', 'customerCode fullName phone')
    .populate('createdBy', 'fullName')
    .sort({ createdAt: -1 })
}

// Static method to get statistics (FAST with stored total)
orderSchema.statics.getStatistics = async function (options = {}) {
  const { startDate, endDate, customerId } = options

  const matchStage = {}

  if (startDate || endDate) {
    matchStage.createdAt = {}
    if (startDate) matchStage.createdAt.$gte = new Date(startDate)
    if (endDate) matchStage.createdAt.$lte = new Date(endDate)
  }

  if (customerId) {
    matchStage.customer = new mongoose.Types.ObjectId(customerId)
  }

  const stats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalRevenue: {
          $sum: { $toDouble: '$total' }
        },
        averageOrderValue: {
          $avg: { $toDouble: '$total' }
        },
        pendingOrders: {
          $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
        },
        processingOrders: {
          $sum: { $cond: [{ $eq: ['$status', 'processing'] }, 1, 0] }
        },
        shippingOrders: {
          $sum: { $cond: [{ $eq: ['$status', 'shipping'] }, 1, 0] }
        },
        deliveredOrders: {
          $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] }
        },
        cancelledOrders: {
          $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
        },
        paidOrders: {
          $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, 1, 0] }
        },
        unpaidAmount: {
          $sum: {
            $cond: [
              { $ne: ['$paymentStatus', 'paid'] },
              { $toDouble: '$total' },
              0
            ]
          }
        }
      }
    }
  ])

  return stats[0] || {
    totalOrders: 0,
    totalRevenue: 0,
    averageOrderValue: 0,
    pendingOrders: 0,
    processingOrders: 0,
    shippingOrders: 0,
    deliveredOrders: 0,
    cancelledOrders: 0,
    paidOrders: 0,
    unpaidAmount: 0
  }
}

// Static method to get daily revenue
orderSchema.statics.getDailyRevenue = async function (days = 7) {
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  const revenue = await this.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate },
        status: { $ne: 'cancelled' }
      }
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
        },
        totalRevenue: {
          $sum: { $toDouble: '$total' }
        },
        orderCount: { $sum: 1 },
        averageOrderValue: {
          $avg: { $toDouble: '$total' }
        }
      }
    },
    {
      $sort: { _id: 1 }
    }
  ])

  return revenue
}

// Static method to get top customers by revenue
orderSchema.statics.getTopCustomers = async function (limit = 10) {
  return this.aggregate([
    {
      $match: {
        status: { $ne: 'cancelled' },
        customer: { $exists: true }
      }
    },
    {
      $group: {
        _id: '$customer',
        totalSpent: { $sum: { $toDouble: '$total' } },
        orderCount: { $sum: 1 },
        averageOrderValue: { $avg: { $toDouble: '$total' } }
      }
    },
    {
      $sort: { totalSpent: -1 }
    },
    {
      $limit: limit
    },
    {
      $lookup: {
        from: 'customers',
        localField: '_id',
        foreignField: '_id',
        as: 'customerInfo'
      }
    },
    {
      $unwind: '$customerInfo'
    },
    {
      $project: {
        _id: 0,
        customer: {
          id: '$_id',
          customerCode: '$customerInfo.customerCode',
          fullName: '$customerInfo.fullName',
          email: '$customerInfo.email'
        },
        totalSpent: 1,
        orderCount: 1,
        averageOrderValue: 1
      }
    }
  ])
}

orderSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString()
    delete returnedObject._id
    delete returnedObject.__v

    // Convert Decimal128 to number
    if (returnedObject.shippingFee && typeof returnedObject.shippingFee === 'object') {
      returnedObject.shippingFee = parseFloat(returnedObject.shippingFee.toString())
    }
    if (returnedObject.total && typeof returnedObject.total === 'object') {
      returnedObject.total = parseFloat(returnedObject.total.toString())
    }
  }
})

module.exports = mongoose.model('Order', orderSchema)
