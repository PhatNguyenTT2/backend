const mongoose = require('mongoose')

const detailPurchaseOrderSchema = new mongoose.Schema({
  purchaseOrder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PurchaseOrder',
    required: [true, 'Purchase order is required']
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
detailPurchaseOrderSchema.index({ purchaseOrder: 1 })
detailPurchaseOrderSchema.index({ product: 1 })
detailPurchaseOrderSchema.index({ purchaseOrder: 1, product: 1 })

// Pre-save hook to calculate total
detailPurchaseOrderSchema.pre('save', function (next) {
  this.total = this.quantity * this.unitPrice
  next()
})

// Post-save hook to update purchase order total
detailPurchaseOrderSchema.post('save', async function (doc) {
  const PurchaseOrder = mongoose.model('PurchaseOrder')
  const purchaseOrder = await PurchaseOrder.findById(doc.purchaseOrder)
  if (purchaseOrder) {
    await purchaseOrder.recalculateTotalPrice()
  }
})

// Post-remove hook to update purchase order total
detailPurchaseOrderSchema.post('findOneAndDelete', async function (doc) {
  if (doc) {
    const PurchaseOrder = mongoose.model('PurchaseOrder')
    const purchaseOrder = await PurchaseOrder.findById(doc.purchaseOrder)
    if (purchaseOrder) {
      await purchaseOrder.recalculateTotalPrice()
    }
  }
})

// Static method to create detail and update product cost price
detailPurchaseOrderSchema.statics.createDetailAndUpdateProduct = async function (detailData) {
  const Product = mongoose.model('Product')
  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    // Create detail
    const detail = new this(detailData)
    await detail.save({ session })

    // Update product cost price (optional - only if you want to track latest cost)
    const product = await Product.findById(detailData.product).session(session)
    if (product) {
      product.costPrice = detailData.unitPrice
      await product.save({ session })
    }

    await session.commitTransaction()
    return detail
  } catch (error) {
    await session.abortTransaction()
    throw error
  } finally {
    session.endSession()
  }
}

// Static method to get details by purchase order
detailPurchaseOrderSchema.statics.getByPurchaseOrder = function (purchaseOrderId) {
  return this.find({ purchaseOrder: purchaseOrderId })
    .populate('product', 'name sku image costPrice price')
    .sort({ createdAt: 1 })
}

// Static method to get total quantity and amount for a product in a purchase order
detailPurchaseOrderSchema.statics.getTotalQuantityByProduct = async function (purchaseOrderId, productId) {
  const details = await this.find({
    purchaseOrder: purchaseOrderId,
    product: productId
  })

  const totalQuantity = details.reduce((sum, detail) => sum + detail.quantity, 0)
  const totalAmount = details.reduce((sum, detail) => sum + detail.total, 0)

  return { totalQuantity, totalAmount }
}

// Static method to validate if product already exists in purchase order
detailPurchaseOrderSchema.statics.productExistsInPO = async function (purchaseOrderId, productId, excludeDetailId = null) {
  const query = {
    purchaseOrder: purchaseOrderId,
    product: productId
  }

  if (excludeDetailId) {
    query._id = { $ne: excludeDetailId }
  }

  const existingDetail = await this.findOne(query)
  return !!existingDetail
}

// Instance method to update quantity
detailPurchaseOrderSchema.methods.updateQuantity = function (newQuantity) {
  if (newQuantity < 1) {
    throw new Error('Quantity must be at least 1')
  }
  this.quantity = newQuantity
  // total will be recalculated in pre-save hook
  return this.save()
}

// Instance method to update unit price
detailPurchaseOrderSchema.methods.updateUnitPrice = function (newUnitPrice) {
  if (newUnitPrice < 0) {
    throw new Error('Unit price cannot be negative')
  }
  this.unitPrice = newUnitPrice
  // total will be recalculated in pre-save hook
  return this.save()
}

detailPurchaseOrderSchema.set('toJSON', {
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

module.exports = mongoose.model('DetailPurchaseOrder', detailPurchaseOrderSchema)
