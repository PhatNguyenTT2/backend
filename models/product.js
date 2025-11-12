const mongoose = require('mongoose');

/**
 * Product Model
 * Master product information
 * Pricing details are managed at batch level (ProductBatch)
 * References: Category (many-to-one)
 */
const productSchema = new mongoose.Schema({
  productCode: {
    type: String,
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
    maxlength: [255, 'Product name must be at most 255 characters']
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

  unitPrice: {
    type: mongoose.Schema.Types.Decimal128,
    required: [true, 'Unit price is required'],
    min: [0, 'Unit price cannot be negative'],
    get: function (value) {
      if (value) {
        return parseFloat(value.toString());
      }
      return 0;
    }
  },

  isActive: {
    type: Boolean,
    default: true
  },

  vendor: {
    type: String,
    trim: true,
    maxlength: [100, 'Vendor name must be at most 100 characters']
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true, getters: true },
  toObject: { virtuals: true, getters: true }
});

// ============ INDEXES ============
productSchema.index({ productCode: 1 });
productSchema.index({ name: 'text' });
productSchema.index({ category: 1 });
productSchema.index({ isActive: 1 });

// ============ VIRTUALS ============
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

// Virtual: Total stock from inventory (when populated)
productSchema.virtual('stock').get(function () {
  if (this.inventory) {
    return this.inventory.quantityAvailable || 0;
  }
  return 0;
});

// ============ MIDDLEWARE ============
// Auto-generate product code before saving
productSchema.pre('save', async function (next) {
  if (!this.productCode) {
    try {
      const currentYear = new Date().getFullYear();

      // Find the last product code for the current year
      const lastProduct = await this.constructor
        .findOne({ productCode: new RegExp(`^PROD${currentYear}`) })
        .sort({ productCode: -1 })
        .select('productCode')
        .lean();

      let sequenceNumber = 1;

      if (lastProduct && lastProduct.productCode) {
        // Extract the sequence number from the last product code
        const match = lastProduct.productCode.match(/\d{6}$/);
        if (match) {
          sequenceNumber = parseInt(match[0]) + 1;
        }
      }

      // Generate new product code with 6-digit padding
      this.productCode = `PROD${currentYear}${String(sequenceNumber).padStart(6, '0')}`;
    } catch (error) {
      return next(error);
    }
  }
  next();
});

// ============ JSON TRANSFORMATION ============
productSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString();
    delete returnedObject._id;
    delete returnedObject.__v;

    // Convert Decimal128 to number
    if (returnedObject.unitPrice && typeof returnedObject.unitPrice === 'object') {
      returnedObject.unitPrice = parseFloat(returnedObject.unitPrice.toString());
    }
  }
});

module.exports = mongoose.model('Product', productSchema);
