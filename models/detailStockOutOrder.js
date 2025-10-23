const mongoose = require('mongoose')

const detailStockOutOrderSchema = new mongoose.Schema({
  stockOutOrder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StockOutOrder',
    required: [true, 'Stock out order is required']
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
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true, getters: true },
  toObject: { virtuals: true, getters: true }
})

// Indexes for faster queries
detailStockOutOrderSchema.index({ stockOutOrder: 1 })
detailStockOutOrderSchema.index({ product: 1 })
detailStockOutOrderSchema.index({ stockOutOrder: 1, product: 1 })

// Pre-save hook to calculate total
detailStockOutOrderSchema.pre('save', async function (next) {
  // Calculate total
  this.total = this.quantity * this.unitPrice

  // Validate stock availability
  if (this.isNew || this.isModified('quantity')) {
    const Inventory = mongoose.model('Inventory')
    const inventory = await Inventory.findOne({ product: this.product })

    if (!inventory) {
      return next(new Error('Product inventory not found'))
    }

    if (inventory.quantityAvailable < this.quantity) {
      return next(new Error(`Insufficient stock. Available: ${inventory.quantityAvailable}, Requested: ${this.quantity}`))
    }
  }
  next()
})

// Post-save hook to update stock out order total
detailStockOutOrderSchema.post('save', async function (doc) {
  const StockOutOrder = mongoose.model('StockOutOrder')
  const stockOutOrder = await StockOutOrder.findById(doc.stockOutOrder)
  if (stockOutOrder) {
    await stockOutOrder.recalculateTotalPrice()
  }
})

// Post-remove hook to update stock out order total
detailStockOutOrderSchema.post('findOneAndDelete', async function (doc) {
  if (doc) {
    const StockOutOrder = mongoose.model('StockOutOrder')
    const stockOutOrder = await StockOutOrder.findById(doc.stockOutOrder)
    if (stockOutOrder) {
      await stockOutOrder.recalculateTotalPrice()
    }
  }
})

// Static method to create detail with validation
detailStockOutOrderSchema.statics.createDetailWithValidation = async function (detailData) {
  const Inventory = mongoose.model('Inventory')
  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    // Check inventory availability
    const inventory = await Inventory.findOne({ product: detailData.product }).session(session)

    if (!inventory) {
      throw new Error('Product inventory not found')
    }

    if (inventory.quantityAvailable < detailData.quantity) {
      throw new Error(`Insufficient stock. Available: ${inventory.quantityAvailable}, Requested: ${detailData.quantity}`)
    }

    // Reserve inventory
    await inventory.reserveInventory(detailData.quantity)

    // Create detail
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

// Static method to get details by stock out order
detailStockOutOrderSchema.statics.getByStockOutOrder = function (stockOutOrderId) {
  return this.find({ stockOutOrder: stockOutOrderId })
    .populate('product', 'name sku image price stock')
    .sort({ createdAt: 1 })
}

// Static method to get total quantity and amount for a product in a stock out order
detailStockOutOrderSchema.statics.getTotalQuantityByProduct = async function (stockOutOrderId, productId) {
  const details = await this.find({
    stockOutOrder: stockOutOrderId,
    product: productId
  })

  const totalQuantity = details.reduce((sum, detail) => sum + detail.quantity, 0)
  const totalAmount = details.reduce((sum, detail) => sum + detail.total, 0)

  return { totalQuantity, totalAmount }
}

// Static method to validate if product already exists in stock out order
detailStockOutOrderSchema.statics.productExistsInSO = async function (stockOutOrderId, productId, excludeDetailId = null) {
  const query = {
    stockOutOrder: stockOutOrderId,
    product: productId
  }

  if (excludeDetailId) {
    query._id = { $ne: excludeDetailId }
  }

  const existingDetail = await this.findOne(query)
  return !!existingDetail
}

// Static method to get products with low stock warning
detailStockOutOrderSchema.statics.getProductsWithLowStock = async function (stockOutOrderId) {
  const Inventory = mongoose.model('Inventory')

  const details = await this.find({ stockOutOrder: stockOutOrderId })
    .populate('product', 'name sku')

  const lowStockProducts = []

  for (const detail of details) {
    const inventory = await Inventory.findOne({ product: detail.product._id })

    if (inventory && inventory.quantityAvailable < detail.quantity) {
      lowStockProducts.push({
        product: detail.product,
        requested: detail.quantity,
        available: inventory.quantityAvailable,
        shortage: detail.quantity - inventory.quantityAvailable
      })
    }
  }

  return lowStockProducts
}

// Instance method to update quantity
detailStockOutOrderSchema.methods.updateQuantity = function (newQuantity) {
  if (newQuantity < 1) {
    throw new Error('Quantity must be at least 1')
  }
  this.quantity = newQuantity
  // total will be recalculated in pre-save hook
  return this.save()
}

// Instance method to update unit price
detailStockOutOrderSchema.methods.updateUnitPrice = function (newUnitPrice) {
  if (newUnitPrice < 0) {
    throw new Error('Unit price cannot be negative')
  }
  this.unitPrice = newUnitPrice
  // total will be recalculated in pre-save hook
  return this.save()
}

detailStockOutOrderSchema.set('toJSON', {
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

module.exports = mongoose.model('DetailStockOutOrder', detailStockOutOrderSchema)
