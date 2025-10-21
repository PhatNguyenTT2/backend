const mongoose = require('mongoose')

const stockOutOrderSchema = new mongoose.Schema({
  soNumber: {
    type: String,
    unique: true,
    // Auto-generate: SO2025000001
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
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
})

// Virtual for stock out order details
stockOutOrderSchema.virtual('details', {
  ref: 'DetailStockOutOrder',
  localField: '_id',
  foreignField: 'stockOutOrder'
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

// Method to calculate total
stockOutOrderSchema.methods.calculateTotal = async function () {
  const DetailStockOutOrder = mongoose.model('DetailStockOutOrder')
  const details = await DetailStockOutOrder.find({ stockOutOrder: this._id })

  this.subtotal = details.reduce((sum, detail) => sum + detail.totalPrice, 0)

  // Calculate discount amount
  const discountAmount = (this.subtotal * this.discountPercentage) / 100

  // Calculate total
  this.total = this.subtotal - discountAmount + this.shippingFee

  return this.save()
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
stockOutOrderSchema.methods.updatePaymentStatus = function (paidAmount) {
  if (paidAmount === 0) {
    this.paymentStatus = 'unpaid'
  } else if (paidAmount >= this.total) {
    this.paymentStatus = 'paid'
  } else {
    this.paymentStatus = 'partial'
  }
  return this.save()
}

// Static method to get stock out orders with details
stockOutOrderSchema.statics.findWithDetails = function (query = {}) {
  return this.find(query)
    .populate('createdBy', 'username fullName')
    .populate({
      path: 'details',
      populate: {
        path: 'product',
        select: 'name sku image price'
      }
    })
    .sort({ orderDate: -1 })
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
    processingOrders: 0,
    completedOrders: 0,
    cancelledOrders: 0,
    unpaidAmount: 0,
    partialPaidAmount: 0
  }
}

stockOutOrderSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString()
    delete returnedObject._id
    delete returnedObject.__v
  }
})

module.exports = mongoose.model('StockOutOrder', stockOutOrderSchema)
