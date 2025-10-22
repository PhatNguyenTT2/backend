const mongoose = require('mongoose')

const productSchema = new mongoose.Schema({
  productCode: {
    type: String,
    required: [true, 'Product code is required'],
    unique: true,
    uppercase: true,
    trim: true,
    match: [/^PROD\d{10}$/, 'Product code must follow format PROD2025000001']
    // Auto-generate: PROD2025000001
  },

  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    maxlength: [255, 'Name must be at most 255 characters long']
  },

  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Category is required']
  },

  costPrice: {
    type: mongoose.Schema.Types.Decimal128,
    default: 0,
    min: [0, 'Cost price cannot be negative'],
    get: function (value) {
      if (value) {
        return parseFloat(value.toString())
      }
      return 0
    }
  },

  originalPrice: {
    type: mongoose.Schema.Types.Decimal128,
    required: [true, 'Original price is required'],
    min: [0, 'Original price cannot be negative'],
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

  isActive: {
    type: Boolean,
    default: true
  },

  vendor: {
    type: String,
    required: [true, 'Vendor is required'],
    trim: true,
    maxlength: [100, 'Vendor name must be at most 100 characters long']
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true, getters: true },
  toObject: { virtuals: true, getters: true }
})

// Virtual for product detail
productSchema.virtual('detail', {
  ref: 'DetailProduct',
  localField: '_id',
  foreignField: 'product',
  justOne: true
})

// Virtual for product batches
productSchema.virtual('batches', {
  ref: 'ProductBatch',
  localField: '_id',
  foreignField: 'product'
})

// Virtual for inventory
productSchema.virtual('inventory', {
  ref: 'Inventory',
  localField: '_id',
  foreignField: 'product',
  justOne: true
})

// Virtual: Selling Price (after discount)
productSchema.virtual('sellPrice').get(function () {
  const discountAmount = this.originalPrice * (this.discountPercentage / 100)
  return parseFloat((this.originalPrice - discountAmount).toFixed(2))
})

// Virtual: Discount Amount
productSchema.virtual('discountAmount').get(function () {
  return parseFloat((this.originalPrice * (this.discountPercentage / 100)).toFixed(2))
})

// Virtual: Stock from inventory (sync version for toJSON when populated)
productSchema.virtual('stock').get(function () {
  if (this.inventory) {
    return this.inventory.quantity || 0
  }
  return 0
})

// Virtual: Profit Margin (%)
productSchema.virtual('profitMargin').get(function () {
  if (this.sellPrice && this.costPrice && this.sellPrice > 0) {
    return parseFloat((((this.sellPrice - this.costPrice) / this.sellPrice) * 100).toFixed(2))
  }
  return 0
})

// Virtual: Profit Amount
productSchema.virtual('profitAmount').get(function () {
  if (this.sellPrice && this.costPrice) {
    return parseFloat((this.sellPrice - this.costPrice).toFixed(2))
  }
  return 0
})

// Indexes for faster queries
productSchema.index({ productCode: 1 })
productSchema.index({ category: 1 })
productSchema.index({ name: 'text' })
productSchema.index({ isActive: 1 })
productSchema.index({ vendor: 1 })

// Pre-save hook to generate product code
productSchema.pre('save', async function (next) {
  if (this.isNew && !this.productCode) {
    const year = new Date().getFullYear()
    const count = await mongoose.model('Product').countDocuments()
    this.productCode = `PROD${year}${String(count + 1).padStart(6, '0')}`
  }
  next()
})

// Method to get stock from inventory (when not populated)
productSchema.methods.getStockFromInventory = async function () {
  const Inventory = mongoose.model('Inventory')
  const inventory = await Inventory.findOne({ product: this._id })
  return inventory ? inventory.quantity : 0
}

// Method to check if product is low stock
productSchema.methods.isLowStock = async function () {
  const Inventory = mongoose.model('Inventory')
  const inventory = await Inventory.findOne({ product: this._id })

  if (inventory && inventory.reorderPoint) {
    return inventory.quantity <= inventory.reorderPoint
  }

  return false
}

// Method to update pricing
productSchema.methods.updatePricing = function (originalPrice, discountPercentage) {
  if (originalPrice !== undefined) {
    this.originalPrice = originalPrice
  }
  if (discountPercentage !== undefined) {
    this.discountPercentage = discountPercentage
  }
  return this.save()
}

// Method to apply discount
productSchema.methods.applyDiscount = function (discountPercentage) {
  this.discountPercentage = discountPercentage
  return this.save()
}

// Method to remove discount
productSchema.methods.removeDiscount = function () {
  this.discountPercentage = 0
  return this.save()
}

// Method to update cost price
productSchema.methods.updateCostPrice = function (newCostPrice) {
  this.costPrice = newCostPrice
  return this.save()
}

// Method to activate/deactivate
productSchema.methods.toggleActive = function () {
  this.isActive = !this.isActive
  return this.save()
}

// Static method to find active products
productSchema.statics.findActiveProducts = function (query = {}) {
  return this.find({ ...query, isActive: true })
    .populate('category', 'categoryCode name')
    .populate('detail')
    .populate('inventory')
    .sort({ createdAt: -1 })
}

// Static method to find in-stock products
productSchema.statics.findInStockProducts = async function (query = {}) {
  const products = await this.find({ ...query, isActive: true })
    .populate('category', 'categoryCode name')
    .populate('detail')
    .populate('inventory')
    .sort({ name: 1 })

  // Filter products that have stock > 0
  return products.filter(product => product.stock > 0)
}

// Static method to find by category
productSchema.statics.findByCategory = function (categoryId) {
  return this.find({ category: categoryId, isActive: true })
    .populate('detail')
    .populate('inventory')
    .sort({ name: 1 })
}

// Static method to search products
productSchema.statics.searchProducts = function (searchTerm) {
  return this.find({
    $or: [
      { name: { $regex: searchTerm, $options: 'i' } },
      { productCode: { $regex: searchTerm, $options: 'i' } },
      { vendor: { $regex: searchTerm, $options: 'i' } }
    ],
    isActive: true
  })
    .populate('category', 'name')
    .populate('detail')
    .populate('inventory')
    .limit(20)
}

// Static method to get product statistics
productSchema.statics.getStatistics = async function () {
  const products = await this.find().populate('inventory')

  const stats = {
    totalProducts: products.length,
    activeProducts: products.filter(p => p.isActive).length,
    inStockProducts: products.filter(p => p.stock > 0).length,
    outOfStockProducts: products.filter(p => p.stock === 0).length,
    totalStock: products.reduce((sum, p) => sum + p.stock, 0),
    averagePrice: 0,
    totalValue: 0
  }

  if (stats.totalProducts > 0) {
    const totalPrice = products.reduce((sum, p) => sum + p.sellPrice, 0)
    stats.averagePrice = parseFloat((totalPrice / stats.totalProducts).toFixed(2))
    stats.totalValue = parseFloat(products.reduce((sum, p) => sum + (p.stock * p.sellPrice), 0).toFixed(2))
  }

  return stats
}

// Static method to get low stock products
productSchema.statics.getLowStockProducts = async function () {
  const products = await this.find({ isActive: true })
    .populate('inventory')

  return products.filter(product => {
    if (product.inventory && product.inventory.reorderPoint) {
      return product.stock <= product.inventory.reorderPoint
    }
    return false
  })
}

// Static method to get products by price range
productSchema.statics.findByPriceRange = async function (minPrice, maxPrice) {
  const products = await this.find({ isActive: true })
    .populate('category', 'name')
    .populate('inventory')

  // Filter by sellPrice (virtual field)
  return products.filter(product => {
    return product.sellPrice >= minPrice && product.sellPrice <= maxPrice
  }).sort((a, b) => a.sellPrice - b.sellPrice)
}

productSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString()
    delete returnedObject._id
    delete returnedObject.__v

    // Convert Decimal128 to number
    if (returnedObject.costPrice && typeof returnedObject.costPrice === 'object') {
      returnedObject.costPrice = parseFloat(returnedObject.costPrice.toString())
    }
    if (returnedObject.originalPrice && typeof returnedObject.originalPrice === 'object') {
      returnedObject.originalPrice = parseFloat(returnedObject.originalPrice.toString())
    }
  }
})

module.exports = mongoose.model('Product', productSchema)
