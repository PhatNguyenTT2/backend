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

  user: {
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

  street: {
    type: String,
    trim: true,
    maxlength: [200, 'Street must be at most 200 characters']
  },

  city: {
    type: String,
    trim: true,
    maxlength: [100, 'City must be at most 100 characters']
  },

  subtotal: {
    type: Number,
    required: [true, 'Subtotal is required'],
    min: [0, 'Subtotal cannot be negative']
  },

  shippingFee: {
    type: Number,
    default: 0,
    min: [0, 'Shipping fee cannot be negative']
  },

  discountType: {
    type: String,
    enum: {
      values: ['none', 'retail', 'wholesale', 'vip'],
      message: '{VALUE} is not a valid discount type'
    },
    default: 'none'
  },

  discountPercentage: {
    type: Number,
    default: 0,
    min: [0, 'Discount percentage cannot be negative'],
    max: [100, 'Discount percentage cannot exceed 100']
  },

  total: {
    type: Number,
    required: [true, 'Total is required'],
    min: [0, 'Total cannot be negative']
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
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
})

// Virtual for order details
orderSchema.virtual('details', {
  ref: 'OrderDetail',
  localField: '_id',
  foreignField: 'order'
})

// Virtual for delivery address
orderSchema.virtual('deliveryAddress').get(function () {
  if (this.deliveryType === 'pickup') {
    return 'Customer Pickup'
  }
  const parts = []
  if (this.street) parts.push(this.street)
  if (this.city) parts.push(this.city)
  return parts.length > 0 ? parts.join(', ') : 'No address provided'
})

// Indexes for faster queries
orderSchema.index({ orderNumber: 1 })
orderSchema.index({ user: 1, createdAt: -1 })
orderSchema.index({ customer: 1, createdAt: -1 })
orderSchema.index({ status: 1 })
orderSchema.index({ paymentStatus: 1 })

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

// Method to calculate total
orderSchema.methods.calculateTotal = async function () {
  const OrderDetail = mongoose.model('OrderDetail')
  const details = await OrderDetail.find({ order: this._id })

  this.subtotal = details.reduce((sum, detail) => sum + detail.totalPrice, 0)

  // Calculate discount amount
  const discountAmount = (this.subtotal * this.discountPercentage) / 100

  // Calculate total
  this.total = this.subtotal - discountAmount + this.shippingFee

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
orderSchema.methods.applyDiscount = function (discountType, discountPercentage) {
  this.discountType = discountType
  this.discountPercentage = discountPercentage

  // Recalculate total
  const discountAmount = (this.subtotal * this.discountPercentage) / 100
  this.total = this.subtotal - discountAmount + this.shippingFee

  return this.save()
}

// Static method to get orders with details
orderSchema.statics.findWithDetails = function (query = {}) {
  return this.find(query)
    .populate('customer', 'customerCode fullName email phone')
    .populate('user', 'fullName')
    .populate({
      path: 'details',
      populate: {
        path: 'product',
        select: 'productCode name'
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
    .populate('user', 'fullName')
    .sort({ createdAt: -1 })
}

// Static method to get statistics
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
        totalRevenue: { $sum: '$total' },
        averageOrderValue: { $avg: '$total' },
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
          $sum: { $cond: [{ $ne: ['$paymentStatus', 'paid'] }, '$total', 0] }
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
        totalRevenue: { $sum: '$total' },
        orderCount: { $sum: 1 }
      }
    },
    {
      $sort: { _id: 1 }
    }
  ])

  return revenue
}

orderSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString()
    delete returnedObject._id
    delete returnedObject.__v
  }
})

module.exports = mongoose.model('Order', orderSchema)
