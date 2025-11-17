const mongoose = require('mongoose');

/**
 * DetailPurchaseOrder Model
 * Manages purchase order line items with batch information
 * Each line represents a product with its batch and pricing
 * References: PurchaseOrder, Product, ProductBatch
 */
const detailPurchaseOrderSchema = new mongoose.Schema({
  purchaseOrder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PurchaseOrder',
    required: [true, 'Purchase order is required']
  },

  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'Product is required']
  },

  batch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProductBatch',
    default: null  // ✅ NULL khi tạo từ PO, được gán khi receive goods
  },

  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [1, 'Quantity must be at least 1']
  },

  costPrice: {
    type: mongoose.Schema.Types.Decimal128,
    required: [true, 'Cost price is required'],
    min: [0, 'Cost price cannot be negative'],
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
detailPurchaseOrderSchema.index({ purchaseOrder: 1 });
detailPurchaseOrderSchema.index({ product: 1 });
detailPurchaseOrderSchema.index({ batch: 1 });
detailPurchaseOrderSchema.index({ purchaseOrder: 1, product: 1 }, { unique: true });

// ============ VIRTUALS ============
// Virtual: Check if received (has batch)
detailPurchaseOrderSchema.virtual('isReceived').get(function () {
  return this.batch !== null && this.batch !== undefined;
});

// ============ MIDDLEWARE ============
// Pre-save: Calculate total before saving
detailPurchaseOrderSchema.pre('save', function (next) {
  // Auto-calculate total = quantity × costPrice
  const qty = this.quantity || 0;
  const price = this.costPrice ? parseFloat(this.costPrice.toString()) : 0;
  this.total = qty * price;
  next();
});

// Post-save: Update PurchaseOrder totalPrice
detailPurchaseOrderSchema.post('save', async function (doc) {
  try {
    await updatePurchaseOrderTotal(doc.purchaseOrder);
  } catch (error) {
    console.error('Error updating PurchaseOrder totalPrice:', error);
  }
});

// Post-remove: Update PurchaseOrder totalPrice after deletion
detailPurchaseOrderSchema.post('remove', async function (doc) {
  try {
    await updatePurchaseOrderTotal(doc.purchaseOrder);
  } catch (error) {
    console.error('Error updating PurchaseOrder totalPrice:', error);
  }
});

// Post-findOneAndDelete: Update PurchaseOrder totalPrice after deletion
detailPurchaseOrderSchema.post('findOneAndDelete', async function (doc) {
  if (doc) {
    try {
      await updatePurchaseOrderTotal(doc.purchaseOrder);
    } catch (error) {
      console.error('Error updating PurchaseOrder totalPrice after deletion:', error);
    }
  }
});

// Post-deleteMany: Update affected PurchaseOrders
detailPurchaseOrderSchema.post('deleteMany', async function (result) {
  // Note: deleteMany doesn't provide deleted docs, so we can't update here
  // Controller should handle updatePurchaseOrderTotal manually after deleteMany
});

// Helper function to update PurchaseOrder totalPrice
async function updatePurchaseOrderTotal(purchaseOrderId) {
  const PurchaseOrder = mongoose.model('PurchaseOrder');

  try {
    // Use aggregation for better performance
    const result = await mongoose.model('DetailPurchaseOrder').aggregate([
      { $match: { purchaseOrder: purchaseOrderId } },
      {
        $group: {
          _id: null,
          subtotal: {
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

    const subtotal = result.length > 0 ? result[0].subtotal : 0;

    // Get PurchaseOrder to apply shipping and discount
    const po = await PurchaseOrder.findById(purchaseOrderId);

    if (po) {
      const shippingFee = po.shippingFee ? parseFloat(po.shippingFee.toString()) : 0;
      const discountPercentage = po.discountPercentage ? parseFloat(po.discountPercentage.toString()) : 0;

      // Calculate discount amount
      const discountAmount = subtotal * (discountPercentage / 100);

      // Calculate total: subtotal - discount + shipping
      const totalPrice = subtotal - discountAmount + shippingFee;

      // Update PurchaseOrder (skip middleware to avoid infinite loop)
      await PurchaseOrder.updateOne(
        { _id: purchaseOrderId },
        { $set: { totalPrice: totalPrice.toFixed(2) } }
      );
    }
  } catch (error) {
    console.error('Error in updatePurchaseOrderTotal:', error);
    throw error;
  }
}

// ============ JSON TRANSFORMATION ============
detailPurchaseOrderSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString();
    delete returnedObject._id;
    delete returnedObject.__v;

    // Convert Decimal128 to number
    if (returnedObject.costPrice && typeof returnedObject.costPrice === 'object') {
      returnedObject.costPrice = parseFloat(returnedObject.costPrice.toString());
    }
    if (returnedObject.total && typeof returnedObject.total === 'object') {
      returnedObject.total = parseFloat(returnedObject.total.toString());
    }
  }
});

module.exports = mongoose.model('DetailPurchaseOrder', detailPurchaseOrderSchema);
