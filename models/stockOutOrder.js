const mongoose = require('mongoose')

const stockOutOrderSchema = new mongoose.Schema({
  soNumber: {
    type: String,
    unique: true,
    // Auto-generate: SO2025000001
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
      values: ['pending', 'processing', 'completed', 'cancelled'],
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

// Virtual for stock out order details
stockOutOrderSchema.virtual('details', {
  ref: 'DetailStockOutOrder',
  localField: '_id',
  foreignField: 'stockOutOrder'
})

// Virtual field: Calculate subtotal from details (for display purposes)
stockOutOrderSchema.virtual('subtotal').get(function () {
  if (this.details && Array.isArray(this.details)) {
    return this.details.reduce((sum, detail) => sum + detail.total, 0)
  }
  return 0
})

// Virtual field: Calculate discount amount (for display purposes)
stockOutOrderSchema.virtual('discountAmount').get(function () {
  if (this.details && Array.isArray(this.details)) {
    const subtotal = this.details.reduce((sum, detail) => sum + detail.total, 0)
    return (subtotal * this.discountPercentage) / 100
  }
  return 0
})

// Indexes for faster queries
stockOutOrderSchema.index({ soNumber: 1 })
stockOutOrderSchema.index({ status: 1 })
stockOutOrderSchema.index({ paymentStatus: 1 })
stockOutOrderSchema.index({ orderDate: -1 })

// Pre-save hook to generate SO number
stockOutOrderSchema.pre('save', async function (next) {
  if (this.isNew && !this.soNumber) {
    const year = new Date().getFullYear()
    const count = await mongoose.model('StockOutOrder').countDocuments()
    this.soNumber = `SO${year}${String(count + 1).padStart(6, '0')}`
  }
  next()
})

// Method to recalculate and save totalPrice
stockOutOrderSchema.methods.recalculateTotalPrice = async function () {
  const DetailStockOutOrder = mongoose.model('DetailStockOutOrder')
  const details = await DetailStockOutOrder.find({ stockOutOrder: this._id })

  const subtotal = details.reduce((sum, detail) => sum + detail.total, 0)
  const discountAmount = (subtotal * this.discountPercentage) / 100
  this.totalPrice = subtotal - discountAmount + this.shippingFee

  return this.save()
}

// Method to get calculated totals with populated details (for backward compatibility)
stockOutOrderSchema.methods.getCalculatedTotals = async function () {
  const DetailStockOutOrder = mongoose.model('DetailStockOutOrder')
  const details = await DetailStockOutOrder.find({ stockOutOrder: this._id })

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

// Method to start processing
stockOutOrderSchema.methods.startProcessing = function () {
  if (this.status !== 'pending') {
    throw new Error('Only pending stock out orders can be processed')
  }
  this.status = 'processing'
  return this.save()
}

// Method to mark as completed
stockOutOrderSchema.methods.markAsCompleted = async function () {
  if (this.status !== 'processing') {
    throw new Error('Only processing stock out orders can be marked as completed')
  }

  // Update inventory for all items
  const DetailStockOutOrder = mongoose.model('DetailStockOutOrder')
  const InventoryMovement = mongoose.model('InventoryMovement')
  const Inventory = mongoose.model('Inventory')

  const details = await DetailStockOutOrder.find({ stockOutOrder: this._id })
    .populate('product')

  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    for (const detail of details) {
      // Find or create inventory
      let inventory = await Inventory.findOne({ product: detail.product._id }).session(session)

      if (!inventory) {
        throw new Error(`Inventory not found for product: ${detail.product.name}`)
      }

      // Check if sufficient stock
      if (inventory.quantityAvailable < detail.quantity) {
        throw new Error(`Insufficient stock for product: ${detail.product.name}`)
      }

      // Create inventory movement
      await InventoryMovement.createMovementAndUpdateInventory({
        product: detail.product._id,
        inventory: inventory._id,
        movementType: 'out',
        quantity: detail.quantity,
        reason: `Stock out order: ${this.soNumber}`,
        date: new Date(),
        performedBy: this.createdBy,
        notes: `Completed stock out order ${this.soNumber}`
      })
    }

    this.status = 'completed'
    await this.save({ session })

    await session.commitTransaction()
    return this
  } catch (error) {
    await session.abortTransaction()
    throw error
  } finally {
    session.endSession()
  }
}

// Method to cancel stock out order
stockOutOrderSchema.methods.cancel = function () {
  if (this.status === 'completed') {
    throw new Error('Cannot cancel completed stock out orders')
  }
  this.status = 'cancelled'
  return this.save()
}

// Method to update payment status
stockOutOrderSchema.methods.updatePaymentStatus = async function (paidAmount) {
  if (paidAmount === 0) {
    this.paymentStatus = 'unpaid'
  } else if (paidAmount >= this.totalPrice) {
    this.paymentStatus = 'paid'
  } else {
    this.paymentStatus = 'partial'
  }
  return this.save()
}

// Static method to get stock out orders with details and calculated totals
stockOutOrderSchema.statics.findWithDetails = async function (query = {}) {
  const orders = await this.find(query)
    .populate('createdBy', 'username fullName')
    .populate({
      path: 'details',
      populate: {
        path: 'product',
        select: 'name sku image price'
      }
    })
    .sort({ orderDate: -1 })

  // Virtual fields will automatically calculate subtotal, discountAmount, and total
  // when details are populated
  return orders
}

// Static method to get stock out order statistics
stockOutOrderSchema.statics.getStatistics = async function (options = {}) {
  const { startDate, endDate } = options

  const matchStage = {}

  if (startDate || endDate) {
    matchStage.orderDate = {}
    if (startDate) matchStage.orderDate.$gte = new Date(startDate)
    if (endDate) matchStage.orderDate.$lte = new Date(endDate)
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
        processingOrders: {
          $sum: { $cond: [{ $eq: ['$status', 'processing'] }, 1, 0] }
        },
        completedOrders: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
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
      processingOrders: 0,
      completedOrders: 0,
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

stockOutOrderSchema.set('toJSON', {
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

module.exports = mongoose.model('StockOutOrder', stockOutOrderSchema)
