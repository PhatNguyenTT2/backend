const mongoose = require('mongoose');

/**
 * DetailStockOutOrder Model
 * Manages stock-out order line items with batch information
 * Each line represents a product with its batch and pricing
 * References: StockOutOrder, Product, ProductBatch
 */
const detailStockOutOrderSchema = new mongoose.Schema({
  stockOutOrder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StockOutOrder',
    required: [true, 'Stock-out order is required']
  },

  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'Product is required']
  },

  batchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProductBatch',
    required: [true, 'Batch is required']
  },

  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [1, 'Quantity must be at least 1']
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

  total: {
    type: mongoose.Schema.Types.Decimal128,
    default: 0,
    min: [0, 'Total cannot be negative'],
    get: function (value) {
      if (value) {
        return parseFloat(value.toString());
      }
      return 0;
    }
  },

  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Notes must be at most 500 characters']
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true, getters: true },
  toObject: { virtuals: true, getters: true }
});

// ============ INDEXES ============
detailStockOutOrderSchema.index({ stockOutOrder: 1 });
detailStockOutOrderSchema.index({ product: 1 });
detailStockOutOrderSchema.index({ batchId: 1 });
detailStockOutOrderSchema.index({ stockOutOrder: 1, product: 1 });

// ============ VIRTUALS ============
// Virtual: Calculate total from quantity and unitPrice
detailStockOutOrderSchema.virtual('calculatedTotal').get(function () {
  const qty = this.quantity || 0;
  const price = this.unitPrice || 0;
  return parseFloat((qty * price).toFixed(2));
});

// ============ MIDDLEWARE ============
// Pre-save: Calculate total before saving
detailStockOutOrderSchema.pre('save', function (next) {
  // Auto-calculate total = quantity × unitPrice
  const qty = this.quantity || 0;
  const price = this.unitPrice ? parseFloat(this.unitPrice.toString()) : 0;
  this.total = qty * price;
  next();
});

// ============ JSON TRANSFORMATION ============
detailStockOutOrderSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString();
    delete returnedObject._id;
    delete returnedObject.__v;

    // Convert Decimal128 to number
    if (returnedObject.unitPrice && typeof returnedObject.unitPrice === 'object') {
      returnedObject.unitPrice = parseFloat(returnedObject.unitPrice.toString());
    }
    if (returnedObject.total && typeof returnedObject.total === 'object') {
      returnedObject.total = parseFloat(returnedObject.total.toString());
    }
  }
});

module.exports = mongoose.model('DetailStockOutOrder', detailStockOutOrderSchema);
