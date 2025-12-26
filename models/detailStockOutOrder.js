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
      console.error('Error updating StockOutOrder totalPrice after deletion:', error);
    }
  }
});

// Post-deleteMany: Update affected StockOutOrders
detailStockOutOrderSchema.post('deleteMany', async function (result) {
  // Note: deleteMany doesn't provide deleted docs, so we can't update here
  // Controller should handle updateStockOutOrderTotal manually after deleteMany
});

// Helper function to update StockOutOrder totalPrice
async function updateStockOutOrderTotal(stockOutOrderId) {
  const StockOutOrder = mongoose.model('StockOutOrder');

  try {
    // Use aggregation for better performance
    const result = await mongoose.model('DetailStockOutOrder').aggregate([
      { $match: { stockOutOrder: stockOutOrderId } },
      {
        $group: {
          _id: null,
          totalPrice: {
            $sum: {
              $convert: {
                input: '$total',
                to: 'double',
                onError: 0,
                onNull: 0
              }
            }
          }
        }
      }
    ]);

    const totalPrice = result.length > 0 ? result[0].totalPrice : 0;

    // Update StockOutOrder (skip middleware to avoid infinite loop)
    await StockOutOrder.updateOne(
      { _id: stockOutOrderId },
      { $set: { totalPrice: totalPrice.toFixed(2) } }
    );
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
