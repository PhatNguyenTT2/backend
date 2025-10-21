const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  categoryCode: {
    type: String,
    required: [true, 'Category code is required'],
    unique: true,
    uppercase: true,
    trim: true,
    match: [/^CAT\d{10}$/, 'Category code must follow format CAT2025000001']
    // Auto-generate: CAT2025000001
  },

  name: {
    type: String,
    required: [true, 'Category name is required'],
    unique: true,
    trim: true,
    maxlength: [100, 'Category name must be at most 100 characters']
  },

  image: {
    type: String, // Category image URL
    default: null
  },

  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description must be at most 500 characters']
  },

  isActive: {
    type: Boolean,
    default: true
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual: Product count
categorySchema.virtual('productCount', {
  ref: 'Product',
  localField: '_id',
  foreignField: 'category',
  count: true
});

// Indexes for faster queries
categorySchema.index({ categoryCode: 1 });
categorySchema.index({ name: 1 });
categorySchema.index({ isActive: 1 });

// Pre-save hook to generate category code
categorySchema.pre('save', async function (next) {
  if (this.isNew && !this.categoryCode) {
    const year = new Date().getFullYear();
    const count = await mongoose.model('Category').countDocuments();
    this.categoryCode = `CAT${year}${String(count + 1).padStart(6, '0')}`;
  }
  next();
});

// Method to update category
categorySchema.methods.updateCategory = function (updates) {
  const allowedUpdates = ['name', 'image', 'description'];
  Object.keys(updates).forEach(key => {
    if (allowedUpdates.includes(key)) {
      this[key] = updates[key];
    }
  });
  return this.save();
};

// Method to activate/deactivate
categorySchema.methods.toggleActive = function () {
  this.isActive = !this.isActive;
  return this.save();
};

// Static method to find active categories
categorySchema.statics.findActiveCategories = function () {
  return this.find({ isActive: true }).sort({ name: 1 });
};

// Static method to get categories with product count
categorySchema.statics.getCategoriesWithProductCount = async function () {
  const Product = mongoose.model('Product');

  const categories = await this.find({ isActive: true });

  const categoriesWithCount = await Promise.all(
    categories.map(async (category) => {
      const productCount = await Product.countDocuments({
        category: category._id,
        isActive: true
      });

      return {
        ...category.toJSON(),
        productCount
      };
    })
  );

  return categoriesWithCount.sort((a, b) => b.productCount - a.productCount);
};

// Static method to get statistics
categorySchema.statics.getStatistics = async function () {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        active: {
          $sum: { $cond: ['$isActive', 1, 0] }
        },
        inactive: {
          $sum: { $cond: ['$isActive', 0, 1] }
        }
      }
    }
  ]);

  return stats[0] || {
    total: 0,
    active: 0,
    inactive: 0
  };
};

categorySchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString();
    delete returnedObject._id;
    delete returnedObject.__v;
  }
});

module.exports = mongoose.model('Category', categorySchema);