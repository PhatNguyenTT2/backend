const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  categoryCode: {
    type: String,
    required: [true, 'Category code is required'],
    unique: true,
    uppercase: true,
    trim: true,
    match: [/^CAT\d{10}$/, 'Category code must follow format CAT2025000001']
    // Auto-generated in pre-save hook
  },

  name: {
    type: String,
    required: [true, 'Category name is required'],
    unique: true,
    trim: true,
    maxlength: 100
  },

  image: {
    type: String,
    default: null
  },

  description: {
    type: String,
    trim: true,
    maxlength: 500,
    default: null
  },

  isActive: {
    type: Boolean,
    default: true
  }

}, {
  timestamps: true
});

// Indexes for faster queries
categorySchema.index({ categoryCode: 1 });
categorySchema.index({ name: 1 });
categorySchema.index({ isActive: 1 });

// Virtual: Product count relationship
categorySchema.virtual('productCount', {
  ref: 'Product',
  localField: '_id',
  foreignField: 'category',
  count: true
});

// Pre-save hook: Auto-generate category code
categorySchema.pre('save', async function (next) {
  if (this.isNew && !this.categoryCode) {
    const year = new Date().getFullYear();
    const count = await mongoose.model('Category').countDocuments();
    this.categoryCode = `CAT${year}${String(count + 1).padStart(6, '0')}`;
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