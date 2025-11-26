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

// Virtual: On shelf quantity from inventory (when populated)
productSchema.virtual('onShelf').get(function () {
  if (this.inventory) {
    return this.inventory.quantityOnShelf || 0;
  }
  return 0;
});

// Virtual: Total quantity on shelf from all batches (when batches are populated)
// This is the ACTUAL available quantity for sale
productSchema.virtual('totalQuantityOnShelf').get(function () {
  if (this.batches && Array.isArray(this.batches)) {
    return this.batches.reduce((total, batch) => {
      return total + (batch.quantityOnShelf || 0);
    }, 0);
  }
  return 0;
});

// Virtual: Discount percentage from FEFO batch (First Expired First Out)
// Returns the discount percentage of the batch with nearest expiry date that has stock
productSchema.virtual('discountPercentage').get(function () {
  // Check if batches virtual is populated
  // Note: Virtual populate returns undefined if not explicitly populated in query
  const batches = this.populated('batches') ? this.batches : null;

  if (!batches || !Array.isArray(batches) || batches.length === 0) {
    return 0;
  }


  // Filter batches with shelf stock and active status
  const availableBatches = batches.filter(batch => {
    // Check detailInventory.quantityOnShelf instead of batch.quantityOnShelf
    // because quantityOnShelf is stored in DetailInventory, not in ProductBatch
    const hasStock = batch.detailInventory
      ? (batch.detailInventory.quantityOnShelf || 0) > 0
      : (batch.quantity || 0) > 0; // Fallback to batch.quantity if detailInventory not populated

    const isActive = batch.status === 'active' || !batch.status;


    return hasStock && isActive;
  });


  if (availableBatches.length === 0) {
    return 0;
  }

  // Sort by expiry date (nearest first) - FEFO logic
  const sortedBatches = [...availableBatches].sort((a, b) => {
    if (!a.expiryDate) return 1;
    if (!b.expiryDate) return -1;
    return new Date(a.expiryDate) - new Date(b.expiryDate);
  });

  const fefoBatch = sortedBatches[0];

  // Return discount percentage if batch has discount promotion
  if (fefoBatch.promotionApplied === 'discount' && (fefoBatch.discountPercentage || 0) > 0) {
    return fefoBatch.discountPercentage;
  }

  return 0;
});

// ============ MIDDLEWARE ============
/**
 * Pre-save hook: Auto-generate productCode
 * Format: PROD[YEAR][SEQUENCE]
 * Example: PROD2025000001
 */
productSchema.pre('save', async function (next) {
  if (this.isNew && !this.productCode) {
    try {
      const Product = mongoose.model('Product');
      const currentYear = new Date().getFullYear();

      // Find the last product code for the current year
      const lastProduct = await Product
        .findOne(
          { productCode: new RegExp(`^PROD${currentYear}`) },
          { productCode: 1 }
        )
        .sort({ productCode: -1 })
        .lean();

      let sequenceNumber = 1;

      if (lastProduct && lastProduct.productCode) {
        // Extract the sequence number from the last product code
        const match = lastProduct.productCode.match(/\d{6}$/);
        if (match) {
          sequenceNumber = parseInt(match[0], 10) + 1;
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
  virtuals: true,
  getters: true,
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
