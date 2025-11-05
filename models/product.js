const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  productCode: {
    type: String,
    required: [true, 'Product code is required'],
    unique: true,
    uppercase: true,
    trim: true,
    match: [/^PROD\d{10}$/, 'Product code must follow format PROD2025000001']
    // Auto-generated in pre-save hook
  },

  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    maxlength: 255
  },

  image: {
    type: String,
    default: null
  },

  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Category is required']
  },

  costPrice: {
    type: mongoose.Schema.Types.Decimal128,
    default: 0,
    min: 0,
    get: function (value) {
      if (value) {
        return parseFloat(value.toString());
      }
      return 0;
    }
  },

  originalPrice: {
    type: mongoose.Schema.Types.Decimal128,
    required: [true, 'Original price is required'],
    min: 0,
    get: function (value) {
      if (value) {
        return parseFloat(value.toString());
      }
      return 0;
    }
  },

  discountPercentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },

  isActive: {
    type: Boolean,
    default: true
  },

  vendor: {
    type: String,
    required: [true, 'Vendor is required'],
    trim: true,
    maxlength: 100
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true, getters: true },
  toObject: { virtuals: true, getters: true }
});

// Indexes for faster queries
productSchema.index({ productCode: 1 });
productSchema.index({ category: 1 });
productSchema.index({ name: 'text' });
productSchema.index({ isActive: 1 });
productSchema.index({ vendor: 1 });

// Virtual: Product detail relationship
productSchema.virtual('detail', {
  ref: 'DetailProduct',
  localField: '_id',
  foreignField: 'product',
  justOne: true
});

// Virtual: Product batches relationship
productSchema.virtual('batches', {
  ref: 'ProductBatch',
  localField: '_id',
  foreignField: 'product'
});

// Virtual: Inventory relationship
productSchema.virtual('inventory', {
  ref: 'Inventory',
  localField: '_id',
  foreignField: 'product',
  justOne: true
});

// Virtual: Selling Price (after discount)
productSchema.virtual('sellPrice').get(function () {
  const discountAmount = this.originalPrice * (this.discountPercentage / 100);
  return parseFloat((this.originalPrice - discountAmount).toFixed(2));
});

// Virtual: Discount Amount
productSchema.virtual('discountAmount').get(function () {
  return parseFloat((this.originalPrice * (this.discountPercentage / 100)).toFixed(2));
});

// Virtual: Stock from inventory (when populated)
productSchema.virtual('stock').get(function () {
  if (this.inventory) {
    return this.inventory.quantity || 0;
  }
  return 0;
});

// Virtual: Profit Margin (%)
productSchema.virtual('profitMargin').get(function () {
  if (this.sellPrice && this.costPrice && this.sellPrice > 0) {
    return parseFloat((((this.sellPrice - this.costPrice) / this.sellPrice) * 100).toFixed(2));
  }
  return 0;
});

// Virtual: Profit Amount
productSchema.virtual('profitAmount').get(function () {
  if (this.sellPrice && this.costPrice) {
    return parseFloat((this.sellPrice - this.costPrice).toFixed(2));
  }
  return 0;
});

// Pre-save hook: Auto-generate product code
productSchema.pre('save', async function (next) {
  if (this.isNew && !this.productCode) {
    const year = new Date().getFullYear();
    const count = await mongoose.model('Product').countDocuments();
    this.productCode = `PROD${year}${String(count + 1).padStart(6, '0')}`;
  }
  next();
});

productSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString();
    delete returnedObject._id;
    delete returnedObject.__v;

    // Convert Decimal128 to number
    if (returnedObject.costPrice && typeof returnedObject.costPrice === 'object') {
      returnedObject.costPrice = parseFloat(returnedObject.costPrice.toString());
    }
    if (returnedObject.originalPrice && typeof returnedObject.originalPrice === 'object') {
      returnedObject.originalPrice = parseFloat(returnedObject.originalPrice.toString());
    }
  }
});

module.exports = mongoose.model('Product', productSchema);
