const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  categoryCode: {
    type: String,
    unique: true,
    uppercase: true,
    trim: true,
    match: [/^CAT\d{10}$/, 'Category code must follow format CAT2025000001']
    // Auto-generated in pre-save hook - NOT required because it's auto-generated
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

/**
 * Pre-save hook: Auto-generate categoryCode
 * Format: CAT[YEAR][SEQUENCE]
 * Example: CAT2025000001
 */
categorySchema.pre('save', async function (next) {
  if (this.isNew && !this.categoryCode) {
    try {
      const Category = mongoose.model('Category');
      const currentYear = new Date().getFullYear();

      // Find the last category code for the current year
      const lastCategory = await Category
        .findOne(
          { categoryCode: new RegExp(`^CAT${currentYear}`) },
          { categoryCode: 1 }
        )
        .sort({ categoryCode: -1 })
        .lean();

      let sequenceNumber = 1;

      if (lastCategory && lastCategory.categoryCode) {
        // Extract the sequence number from the last category code
        const match = lastCategory.categoryCode.match(/\d{6}$/);
        if (match) {
          sequenceNumber = parseInt(match[0], 10) + 1;
        }
      }

      // Generate new category code with 6-digit padding
      this.categoryCode = `CAT${currentYear}${String(sequenceNumber).padStart(6, '0')}`;
    } catch (error) {
      return next(error);
    }
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