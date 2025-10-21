const mongoose = require('mongoose')

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    maxlength: [255, 'Name must be less than 255 characters'],
    trim: true
  },

  slug: {
    type: String,
    unique: true,
    lowercase: true
  },

  sku: {
    type: String,
    required: [true, 'SKU is required'],
    unique: true,
    uppercase: true
  },

  //Category
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Category is required']
  },

  //Price
  costPrice: {
    type: Number,
    required: [true, 'Cost price is required'],
    min: [0, 'Cost price must be greater than or equal to 0'],
    default: 0
  },

  price: {
    type: Number,
    required: [true, 'Selling price is required'],
    min: [0, 'Selling price must be greater than 0']
  },

  originalPrice: {
    type: Number,
    min: [0, 'Original price must be greater than 0']
  },

  //Images
  image: {
    type: String, // Main image URL
    required: [true, 'Image is required']
  },

  images: [{
    type: String,
    isPrimary: {
      type: Boolean,
      default: false
    }
  }],

  //Description
  description: {
    type: String,
    required: false,
    maxlength: [2000, 'Description must be less than 2000 characters'],
    default: 'No description provided'
  },

  //Detailed Description (JSON object)
  detailDescription: {
    intro: [String],

    specifications: [{
      label: String,
      value: String
    }],

    additionalDesc: String,

    packaging: [String],

    suggestedUse: [String],

    otherIngredients: [String],

    warnings: [String]
  },

  // Vendor
  vendor: {
    type: String,
    required: [true, 'Vendor is required'],
    trim: true
  },

  // Stock & Inventory
  stock: {
    type: Number,
    required: [true, 'Stock is required'],
    min: [0, 'Stock must be greater than 0'],
    default: 0
  },

  isInStock: {
    type: Boolean,
    default: function () {
      return this.stock > 0
    }
  },

  // Rating & Reviews
  rating: {
    type: Number,
    min: 0,
    max: 5,
    default: 0
  },

  reviewCount: {
    type: Number,
    default: 0,
    min: 0
  },

  // Product Meta
  type: {
    type: String, // Organic, Regular, etc.
    trim: true
  },

  tags: [String],

  mfgDate: Date, // Manufacturing date

  shelfLife: {
    type: String, // "70 days", "1 year"
    trim: true
  },

  // Status
  isActive: {
    type: Boolean,
    default: true
  },

  isFeatured: {
    type: Boolean,
    default: false
  }

}, {
  timestamps: true // createdAt, updatedAt
})

productSchema.index({ name: 'text', description: 'text', tags: 'text' });
productSchema.index({ category: 1, price: 1 });
// productSchema.index({ slug: 1 });

// Virtual: Discount Percent
productSchema.virtual('discountPercent').get(function () {
  if (this.originalPrice && this.originalPrice > this.price)
    return Math.round(((this.originalPrice - this.price) / this.originalPrice) * 100);
  return 0;
})

// Virtual: Profit Margin (%)
productSchema.virtual('profitMargin').get(function () {
  if (this.price && this.costPrice && this.price > 0) {
    return parseFloat((((this.price - this.costPrice) / this.price) * 100).toFixed(2));
  }
  return 0;
})

// Virtual: Profit Amount
productSchema.virtual('profitAmount').get(function () {
  if (this.price && this.costPrice) {
    return parseFloat((this.price - this.costPrice).toFixed(2));
  }
  return 0;
})

// Generate slug from name
productSchema.pre('save', function (next) {
  if (this.isModified('name') && !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^\w\s-]/g, '') // Remove special chars
      .replace(/\s+/g, '-')     // Replace spaces with -
      .replace(/-+/g, '-')      // Replace multiple - with single -
      .trim();
  }
  next();
})

productSchema.set('toJSON', {
  virtuals: true,
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString();
    delete returnedObject._id;
    delete returnedObject.__v;
  }
})

module.exports = mongoose.model('Product', productSchema);
