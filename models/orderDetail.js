const mongoose = require('mongoose')

const orderDetailSchema = new mongoose.Schema({
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: [true, 'Order is required']
  },

  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'Product is required']
  },

  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [1, 'Quantity must be at least 1']
  },

  unitPrice: {
    type: mongoose.Schema.Types.Decimal128,
    required: [true, 'Unit price is required'],
    min: [0, 'Unit price cannot be negative'],
    get: function (value) {
      if (value) {
        return parseFloat(value.toString())
      }
      return 0
    }
  },

  total: {
    type: mongoose.Schema.Types.Decimal128,
    required: [true, 'Total is required'],
    min: [0, 'Total cannot be negative'],
    get: function (value) {
      if (value) {
        return parseFloat(value.toString())
      }
      return 0
    }
  },

  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Notes must be at most 500 characters']
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true, getters: true },
  toObject: { virtuals: true, getters: true }
})

// Indexes for faster queries
orderDetailSchema.index({ order: 1 })
orderDetailSchema.index({ product: 1 })
orderDetailSchema.index({ order: 1, product: 1 })

// Pre-save hook to calculate total
orderDetailSchema.pre('save', function (next) {
  this.total = this.quantity * this.unitPrice
  next()
})

// Post-save hook to update order total
orderDetailSchema.post('save', async function (doc) {
  const Order = mongoose.model('Order')
  const order = await Order.findById(doc.order)
  if (order) {
    await order.recalculateTotals()
  }
})

// Post-remove hook to update order total
orderDetailSchema.post('findOneAndDelete', async function (doc) {
  if (doc) {
    const Order = mongoose.model('Order')
    const order = await Order.findById(doc.order)
    if (order) {
      await order.recalculateTotals()
    }
  }
})

// Method to update quantity
orderDetailSchema.methods.updateQuantity = function (newQuantity) {
  if (newQuantity < 1) {
    throw new Error('Quantity must be at least 1')
  }
  this.quantity = newQuantity
  // total will be recalculated in pre-save hook
  return this.save()
}

// Method to update unit price
orderDetailSchema.methods.updateUnitPrice = function (newUnitPrice) {
  if (newUnitPrice < 0) {
    throw new Error('Unit price cannot be negative')
  }
  this.unitPrice = newUnitPrice
  // total will be recalculated in pre-save hook
  return this.save()
}

// Static method to create detail and reserve inventory
orderDetailSchema.statics.createDetailAndReserveInventory = async function (detailData) {
  const Inventory = mongoose.model('Inventory')
  const Product = mongoose.model('Product')
  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    // Check product availability
    const product = await Product.findById(detailData.product)
      .populate('inventory')
      .session(session)

    if (!product) {
      throw new Error('Product not found')
    }

    if (!product.isActive) {
      throw new Error('Product is not active')
    }

    // Check inventory
    const inventory = await Inventory.findOne({ product: detailData.product }).session(session)
    if (!inventory) {
      throw new Error('Inventory not found for this product')
    }

    if (inventory.quantityAvailable < detailData.quantity) {
      throw new Error(`Insufficient stock. Available: ${inventory.quantityAvailable}, Requested: ${detailData.quantity}`)
    }

    // Reserve inventory
    await inventory.reserveInventory(detailData.quantity)

    // Create order detail (total will be calculated in pre-save hook)
    const detail = new this(detailData)
    await detail.save({ session })

    await session.commitTransaction()
    return detail
  } catch (error) {
    await session.abortTransaction()
    throw error
  } finally {
    session.endSession()
  }
}

// Static method to get details by order
orderDetailSchema.statics.getByOrder = function (orderId) {
  return this.find({ order: orderId })
    .populate('product', 'productCode name image')
    .sort({ createdAt: 1 })
}

// Static method to get total quantity for a product in an order
orderDetailSchema.statics.getTotalQuantityByProduct = async function (orderId, productId) {
  const details = await this.find({
    order: orderId,
    product: productId
  })

  const totalQuantity = details.reduce((sum, detail) => sum + detail.quantity, 0)
  const totalAmount = details.reduce((sum, detail) => sum + detail.total, 0)

  return { totalQuantity, totalAmount }
}

// Static method to validate if product already exists in order
orderDetailSchema.statics.productExistsInOrder = async function (orderId, productId, excludeDetailId = null) {
  const query = {
    order: orderId,
    product: productId
  }

  if (excludeDetailId) {
    query._id = { $ne: excludeDetailId }
  }

  const existingDetail = await this.findOne(query)
  return !!existingDetail
}

// Static method to get best selling products
orderDetailSchema.statics.getBestSellingProducts = async function (limit = 10, options = {}) {
  const { startDate, endDate } = options

  const matchStage = {}

  if (startDate || endDate) {
    matchStage.createdAt = {}
    if (startDate) matchStage.createdAt.$gte = new Date(startDate)
    if (endDate) matchStage.createdAt.$lte = new Date(endDate)
  }

  const pipeline = [
    { $match: matchStage },
    {
      $group: {
        _id: '$product',
        totalQuantity: { $sum: '$quantity' },
        totalRevenue: { $sum: { $toDouble: '$total' } },
        orderCount: { $sum: 1 }
      }
    },
    {
      $lookup: {
        from: 'products',
        localField: '_id',
        foreignField: '_id',
        as: 'productInfo'
      }
    },
    {
      $unwind: '$productInfo'
    },
    {
      $project: {
        _id: 0,
        product: {
          id: '$_id',
          productCode: '$productInfo.productCode',
          name: '$productInfo.name'
        },
        totalQuantity: 1,
        totalRevenue: 1,
        orderCount: 1,
        averageQuantityPerOrder: {
          $divide: ['$totalQuantity', '$orderCount']
        }
      }
    },
    {
      $sort: { totalQuantity: -1 }
    },
    {
      $limit: limit
    }
  ]

  return this.aggregate(pipeline)
}

orderDetailSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString()
    delete returnedObject._id
    delete returnedObject.__v

    // Convert Decimal128 to number
    if (returnedObject.unitPrice && typeof returnedObject.unitPrice === 'object') {
      returnedObject.unitPrice = parseFloat(returnedObject.unitPrice.toString())
    }
    if (returnedObject.total && typeof returnedObject.total === 'object') {
      returnedObject.total = parseFloat(returnedObject.total.toString())
    }
  }
})

module.exports = mongoose.model('OrderDetail', orderDetailSchema)
