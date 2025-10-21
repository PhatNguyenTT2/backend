const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  categoryCode: {
    type: String,
    unique: true,
    uppercase: true,
    trim: true,
    match: [/^CAT\d{3,}$/, 'Category code must follow format CAT001, CAT002, etc.']
  },

  name: {
    type: String,
    required: [true, 'Category name is required'],
    unique: true,
    trim: true,
    maxlength: 100
  },

  image: {
    type: String, // Category image URL
    default: null
  },

  description: {
    type: String,
    maxlength: 500
  },

  // Parent category (for nested categories)
  parent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    default: null
  },

  // Display order
  order: {
    type: Number,
    default: 0
  },

  isActive: {
    type: Boolean,
    default: true
  }

}, {
  timestamps: true
});

// Virtual: Product count
categorySchema.virtual('productCount', {
  ref: 'Product',
  localField: '_id',
  foreignField: 'category',
  count: true
});

// Indexes
categorySchema.index({ categoryCode: 1 });
categorySchema.index({ name: 1 });
categorySchema.index({ isActive: 1 });
categorySchema.index({ parent: 1 });

// Pre-save hook to generate category code
categorySchema.pre('save', async function (next) {
  if (this.isNew && !this.categoryCode) {
    const count = await mongoose.model('Category').countDocuments();
    this.categoryCode = `CAT${String(count + 1).padStart(3, '0')}`;
  }
  next();
});

categorySchema.set('toJSON', {
  virtuals: true,
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString();
    delete returnedObject._id;
    delete returnedObject.__v;
  }
});

module.exports = mongoose.model('Category', categorySchema);