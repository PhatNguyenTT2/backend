const mongoose = require('mongoose');

/**
 * OrderDetail Model
 * Manages order line items with batch tracking
 * Each line represents a product with its specific batch and pricing
 * References: Order, Product, ProductBatch
 */
const orderDetailSchema = new mongoose.Schema({
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: [true, 'Order is required']
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
orderDetailSchema.index({ order: 1 });
orderDetailSchema.index({ product: 1 });
orderDetailSchema.index({ batch: 1 });
orderDetailSchema.index({ order: 1, product: 1 });

// ============ VIRTUALS ============
// Virtual: Calculate total from quantity and unitPrice
orderDetailSchema.virtual('calculatedTotal').get(function () {
  const qty = this.quantity || 0;
  const price = this.unitPrice || 0;
  return parseFloat((qty * price).toFixed(2));
});

// ============ MIDDLEWARE ============
// Pre-save: Calculate total before saving
orderDetailSchema.pre('save', function (next) {
  // Auto-calculate total from quantity * unitPrice
  this.total = this.quantity * parseFloat(this.unitPrice.toString());
  next();
});

// Post-save: Update Order total
orderDetailSchema.post('save', async function (doc) {
  try {
    await updateOrderTotal(doc.order);
  } catch (error) {
    console.error('Error updating Order total:', error);
  }
});

// Post-remove: Update Order total after deletion
orderDetailSchema.post('remove', async function (doc) {
  try {
    await updateOrderTotal(doc.order);
  } catch (error) {
    console.error('Error updating Order total:', error);
  }
});

// Post-findOneAndDelete: Update Order total after deletion
orderDetailSchema.post('findOneAndDelete', async function (doc) {
  if (doc) {
    try {
      await updateOrderTotal(doc.order);
    } catch (error) {
      console.error('Error updating Order total:', error);
    }
  }
});

// Helper function to update Order total
async function updateOrderTotal(orderId) {
  const Order = mongoose.model('Order');
  const OrderDetail = mongoose.model('OrderDetail');

  try {
    // Calculate subtotal from all details
    const details = await OrderDetail.find({
      order: orderId
    }).lean();

    const subtotal = details.reduce((sum, detail) => {
      const total = detail.total ? parseFloat(detail.total.toString()) : 0;
      return sum + total;
    }, 0);

    // Get order to apply shipping and discount
    const order = await Order.findById(orderId);

    if (order) {
      const shippingFee = order.shippingFee ? parseFloat(order.shippingFee.toString()) : 0;
      const discountPercentage = order.discountPercentage || 0;

      // Calculate discount amount
      const discountAmount = subtotal * (discountPercentage / 100);

      // Calculate total: subtotal - discount + shipping
      const total = subtotal - discountAmount + shippingFee;

      // Update Order
      order.total = total;
      await order.save();
    }
  } catch (error) {
    console.error('Error in updateOrderTotal:', error);
    throw error;
  }
}

// ============ JSON TRANSFORMATION ============
orderDetailSchema.set('toJSON', {
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

module.exports = mongoose.model('OrderDetail', orderDetailSchema);
