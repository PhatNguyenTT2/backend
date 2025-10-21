const mongoose = require('mongoose')

const productBatchSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'Product is required']
  },

  batchCode: {
    type: String,
    required: [true, 'Batch code is required'],
    unique: true,
    uppercase: true,
    trim: true
  },

  mfgDate: {
    type: Date
  },

  expiryDate: {
    type: Date
  },

  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [0, 'Quantity cannot be negative']
  },

  status: {
    type: String,
    enum: {
      values: ['active', 'expired', 'disposed'],
      message: '{VALUE} is not a valid status'
    },
    default: 'active'
  },

  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Notes must be at most 500 characters long']
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
})

// Virtual to check if batch is expired
productBatchSchema.virtual('isExpired').get(function () {
  if (!this.expiryDate) return false
  return new Date() > this.expiryDate
})

// Virtual to calculate days until expiry
productBatchSchema.virtual('daysUntilExpiry').get(function () {
  if (!this.expiryDate) return null
  const today = new Date()
  const expiry = new Date(this.expiryDate)
  const diffTime = expiry - today
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays
})

// Virtual to check if batch is near expiry (30 days)
productBatchSchema.virtual('isNearExpiry').get(function () {
  const days = this.daysUntilExpiry
  return days !== null && days > 0 && days <= 30
})

// Indexes for faster queries
productBatchSchema.index({ product: 1 })
productBatchSchema.index({ batchCode: 1 })
productBatchSchema.index({ expiryDate: 1 })
productBatchSchema.index({ status: 1 })
productBatchSchema.index({ product: 1, status: 1 })

// Pre-save hook to auto-update status based on expiry date
productBatchSchema.pre('save', function (next) {
  if (this.expiryDate && new Date() > this.expiryDate && this.status === 'active') {
    this.status = 'expired'
  }
  next()
})

// Post-save hook to update product stock
productBatchSchema.post('save', async function (doc) {
  const Product = mongoose.model('Product')
  await Product.findByIdAndUpdate(doc.product, {
    $inc: { stock: doc.quantity }
  })
})

// Method to update quantity
productBatchSchema.methods.updateQuantity = function (newQuantity) {
  const diff = newQuantity - this.quantity
  this.quantity = newQuantity

  // Update product stock
  const Product = mongoose.model('Product')
  Product.findByIdAndUpdate(this.product, {
    $inc: { stock: diff }
  }).exec()

  return this.save()
}

// Method to dispose batch
productBatchSchema.methods.dispose = function (reason) {
  this.status = 'disposed'
  if (reason) {
    this.notes = this.notes ? `${this.notes}\nDisposed: ${reason}` : `Disposed: ${reason}`
  }

  // Decrease product stock
  const Product = mongoose.model('Product')
  Product.findByIdAndUpdate(this.product, {
    $inc: { stock: -this.quantity }
  }).exec()

  return this.save()
}

// Method to mark as expired
productBatchSchema.methods.markAsExpired = function () {
  this.status = 'expired'
  return this.save()
}

// Static method to find active batches by product
productBatchSchema.statics.findActiveByProduct = function (productId) {
  return this.find({ product: productId, status: 'active' })
    .sort({ expiryDate: 1 })
}

// Static method to find expired batches
productBatchSchema.statics.findExpiredBatches = function () {
  return this.find({
    $or: [
      { status: 'expired' },
      { expiryDate: { $lt: new Date() }, status: 'active' }
    ]
  })
    .populate('product', 'productCode name')
    .sort({ expiryDate: 1 })
}

// Static method to find batches near expiry
productBatchSchema.statics.findNearExpiryBatches = function (days = 30) {
  const futureDate = new Date()
  futureDate.setDate(futureDate.getDate() + days)

  return this.find({
    expiryDate: {
      $gte: new Date(),
      $lte: futureDate
    },
    status: 'active'
  })
    .populate('product', 'productCode name')
    .sort({ expiryDate: 1 })
}

// Static method to create batch and update product stock
productBatchSchema.statics.createBatchAndUpdateStock = async function (batchData) {
  const Product = mongoose.model('Product')
  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    // Check if product exists
    const product = await Product.findById(batchData.product).session(session)
    if (!product) {
      throw new Error('Product not found')
    }

    // Check if batch code already exists
    const existingBatch = await this.findOne({ batchCode: batchData.batchCode }).session(session)
    if (existingBatch) {
      throw new Error('Batch code already exists')
    }

    // Create batch
    const batch = new this(batchData)
    await batch.save({ session })

    // Update product stock
    product.stock += batchData.quantity
    product.isInStock = product.stock > 0
    await product.save({ session })

    await session.commitTransaction()
    return batch
  } catch (error) {
    await session.abortTransaction()
    throw error
  } finally {
    session.endSession()
  }
}

// Static method to get batch statistics
productBatchSchema.statics.getStatistics = async function () {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        totalBatches: { $sum: 1 },
        activeBatches: {
          $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
        },
        expiredBatches: {
          $sum: { $cond: [{ $eq: ['$status', 'expired'] }, 1, 0] }
        },
        disposedBatches: {
          $sum: { $cond: [{ $eq: ['$status', 'disposed'] }, 1, 0] }
        },
        totalQuantity: { $sum: '$quantity' }
      }
    }
  ])

  return stats[0] || {
    totalBatches: 0,
    activeBatches: 0,
    expiredBatches: 0,
    disposedBatches: 0,
    totalQuantity: 0
  }
}

// Static method to auto-expire batches
productBatchSchema.statics.autoExpireBatches = async function () {
  const result = await this.updateMany(
    {
      expiryDate: { $lt: new Date() },
      status: 'active'
    },
    {
      $set: { status: 'expired' }
    }
  )

  return result
}

productBatchSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString()
    delete returnedObject._id
    delete returnedObject.__v
  }
})

module.exports = mongoose.model('ProductBatch', productBatchSchema)
