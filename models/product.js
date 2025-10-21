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
    type: Number,
    default: 0,
    min: [0, 'Cost price cannot be negative']
  },

  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },

  originalPrice: {
    type: Number,
    min: [0, 'Original price cannot be negative']
  },

  stock: {
    type: Number,
    default: 0,
    min: [0, 'Stock cannot be negative']
  },

  isInStock: {
    type: Boolean,
    default: false
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
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
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

// Virtual: Discount Percent
productSchema.virtual('discountPercent').get(function () {
  if (this.originalPrice && this.originalPrice > this.price) {
    return Math.round(((this.originalPrice - this.price) / this.originalPrice) * 100)
  }
  return 0
})

// Virtual: Profit Margin (%)
productSchema.virtual('profitMargin').get(function () {
  if (this.price && this.costPrice && this.price > 0) {
    return parseFloat((((this.price - this.costPrice) / this.price) * 100).toFixed(2))
  }
  return 0
})

// Virtual: Profit Amount
productSchema.virtual('profitAmount').get(function () {
  if (this.price && this.costPrice) {
    return parseFloat((this.price - this.costPrice).toFixed(2))
  }
  return 0
})

// Indexes for faster queries
productSchema.index({ productCode: 1 })
productSchema.index({ category: 1 })
productSchema.index({ price: 1 })
productSchema.index({ name: 'text' })
productSchema.index({ isActive: 1 })
productSchema.index({ isInStock: 1 })
productSchema.index({ vendor: 1 })

// Pre-save hook to generate product code
productSchema.pre('save', async function (next) {
  if (this.isNew && !this.productCode) {
    const year = new Date().getFullYear()
    const count = await mongoose.model('Product').countDocuments()
    this.productCode = `PROD${year}${String(count + 1).padStart(6, '0')}`
  }

  // Update isInStock based on stock
  this.isInStock = this.stock > 0

  next()
})

// Method to update stock
productSchema.methods.updateStock = function (quantity) {
  this.stock += quantity
  this.isInStock = this.stock > 0
  return this.save()
}

// Method to check if product is low stock
productSchema.methods.isLowStock = async function () {
  const Inventory = mongoose.model('Inventory')
  const inventory = await Inventory.findOne({ product: this._id })

  if (inventory && inventory.reorderPoint) {
    return this.stock <= inventory.reorderPoint
  }

  return false
}

// Method to update price
productSchema.methods.updatePrice = function (newPrice, newOriginalPrice) {
  this.price = newPrice
  if (newOriginalPrice !== undefined) {
    this.originalPrice = newOriginalPrice
  }
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
    .sort({ createdAt: -1 })
}

// Static method to find in-stock products
productSchema.statics.findInStockProducts = function (query = {}) {
  return this.find({ ...query, isInStock: true, isActive: true })
    .populate('category', 'categoryCode name')
    .sort({ name: 1 })
}

// Static method to find by category
productSchema.statics.findByCategory = function (categoryId) {
  return this.find({ category: categoryId, isActive: true })
    .populate('detail')
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
    .limit(20)
}

// Static method to get product statistics
productSchema.statics.getStatistics = async function () {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        totalProducts: { $sum: 1 },
        activeProducts: {
          $sum: { $cond: ['$isActive', 1, 0] }
        },
        inStockProducts: {
          $sum: { $cond: ['$isInStock', 1, 0] }
        },
        outOfStockProducts: {
          $sum: { $cond: ['$isInStock', 0, 1] }
        },
        totalStock: { $sum: '$stock' },
        averagePrice: { $avg: '$price' },
        totalValue: { $sum: { $multiply: ['$stock', '$price'] } }
      }
    }
  ])

  return stats[0] || {
    totalProducts: 0,
    activeProducts: 0,
    inStockProducts: 0,
    outOfStockProducts: 0,
    totalStock: 0,
    averagePrice: 0,
    totalValue: 0
  }
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
productSchema.statics.findByPriceRange = function (minPrice, maxPrice) {
  return this.find({
    price: { $gte: minPrice, $lte: maxPrice },
    isActive: true
  })
    .populate('category', 'name')
    .sort({ price: 1 })
}

productSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString()
    delete returnedObject._id
    delete returnedObject.__v
  }
})

module.exports = mongoose.model('Product', productSchema)
