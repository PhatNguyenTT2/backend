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

  batch: {
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
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true, getters: true },
  toObject: { virtuals: true, getters: true }
});

// ============ INDEXES ============
detailStockOutOrderSchema.index({ stockOutOrder: 1 });
detailStockOutOrderSchema.index({ product: 1 });
detailStockOutOrderSchema.index({ batch: 1 });
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
  // Auto-calculate total from quantity * unitPrice
  this.total = this.quantity * parseFloat(this.unitPrice.toString());
  next();
});

// Post-save: Update StockOutOrder totalPrice
detailStockOutOrderSchema.post('save', async function (doc) {
  try {
    await updateStockOutOrderTotal(doc.stockOutOrder);
  } catch (error) {
    console.error('Error updating StockOutOrder totalPrice:', error);
  }
});

// Post-remove: Update StockOutOrder totalPrice after deletion
detailStockOutOrderSchema.post('remove', async function (doc) {
  try {
    await updateStockOutOrderTotal(doc.stockOutOrder);
  } catch (error) {
    console.error('Error updating StockOutOrder totalPrice:', error);
  }
});

// Post-findOneAndDelete: Update StockOutOrder totalPrice after deletion
detailStockOutOrderSchema.post('findOneAndDelete', async function (doc) {
  if (doc) {
    try {
      await updateStockOutOrderTotal(doc.stockOutOrder);
    } catch (error) {
      console.error('Error updating StockOutOrder totalPrice:', error);
    }
  }
});

// Helper function to update StockOutOrder totalPrice
async function updateStockOutOrderTotal(stockOutOrderId) {
  const StockOutOrder = mongoose.model('StockOutOrder');
  const DetailStockOutOrder = mongoose.model('DetailStockOutOrder');

  try {
    // Calculate subtotal from all details
    const details = await DetailStockOutOrder.find({
      stockOutOrder: stockOutOrderId
    }).lean();

    const subtotal = details.reduce((sum, detail) => {
      const total = detail.total ? parseFloat(detail.total.toString()) : 0;
      return sum + total;
    }, 0);

    // Get stock-out order to apply shipping and discount
    const so = await StockOutOrder.findById(stockOutOrderId);

    if (so) {
      const shippingFee = so.shippingFee ? parseFloat(so.shippingFee.toString()) : 0;
      const discountPercentage = so.discountPercentage ? parseFloat(so.discountPercentage.toString()) : 0;

      // Calculate discount amount
      const discountAmount = subtotal * (discountPercentage / 100);

      // Calculate total: subtotal - discount + shipping
      const totalPrice = subtotal - discountAmount + shippingFee;

      // Update StockOutOrder
      so.totalPrice = totalPrice;
      await so.save();
    }
  } catch (error) {
    console.error('Error in updateStockOutOrderTotal:', error);
    throw error;
  }
}

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
