const mongoose = require('mongoose');

/**
 * Order Model
 * Manages customer orders from POS system
 * References: Customer (many-to-one), Employee (many-to-one)
 * Related: OrderDetail (one-to-many)
 */
const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    unique: true,
    uppercase: true,
    trim: true,
    match: [/^ORD\d{10}$/, 'Order number must follow format ORD2501000001']
    // Auto-generated in pre-save hook: ORD + YYMM + 6-digit sequence
  },

  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: [true, 'Customer is required']
  },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: [true, 'Employee is required']
  },

  orderDate: {
    type: Date,
    default: Date.now,
    required: [true, 'Order date is required']
  },

  deliveryType: {
    type: String,
    enum: {
      values: ['delivery', 'pickup'],
      message: '{VALUE} is not a valid delivery type'
    },
    default: 'delivery'
  },

  address: {
    type: String,
    trim: true,
    maxlength: [500, 'Address must be at most 500 characters']
  },

  shippingFee: {
    type: mongoose.Schema.Types.Decimal128,
    default: 0,
    min: [0, 'Shipping fee cannot be negative'],
    get: function (value) {
      if (value) {
        return parseFloat(value.toString());
      }
      return 0;
    }
  },

  discountPercentage: {
    type: Number,
    default: 0,
    min: [0, 'Discount percentage cannot be negative'],
    max: [100, 'Discount percentage cannot exceed 100']
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

  paymentStatus: {
    type: String,
    enum: {
      values: ['pending', 'paid', 'failed', 'refunded'],
      message: '{VALUE} is not a valid payment status'
    },
    default: 'pending'
  },

  status: {
    type: String,
    enum: {
      values: ['pending', 'processing', 'shipping', 'delivered', 'cancelled'],
      message: '{VALUE} is not a valid status'
    },
    default: 'pending'
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true, getters: true },
  toObject: { virtuals: true, getters: true }
});

// ============ INDEXES ============
orderSchema.index({ orderNumber: 1 });
orderSchema.index({ customer: 1, orderDate: -1 });
orderSchema.index({ createdBy: 1, orderDate: -1 });
orderSchema.index({ status: 1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ orderDate: -1 });
orderSchema.index({ total: -1 });

// ============ VIRTUALS ============
// Virtual: Order details relationship
orderSchema.virtual('details', {
  ref: 'OrderDetail',
  localField: '_id',
  foreignField: 'order'
});

// Virtual: Calculate subtotal from details (when populated)
orderSchema.virtual('subtotal').get(function () {
  if (this.details && Array.isArray(this.details)) {
    return this.details.reduce((sum, detail) => {
      const price = detail.unitPrice || 0;
      const quantity = detail.quantity || 0;
      return sum + (price * quantity);
    }, 0);
  }
  return 0;
});

// Virtual: Calculate discount amount
orderSchema.virtual('discountAmount').get(function () {
  const subtotal = this.subtotal || 0;
  const discountPercent = this.discountPercentage || 0;
  return parseFloat((subtotal * (discountPercent / 100)).toFixed(2));
});

// Virtual: Check if order is paid
orderSchema.virtual('isPaid').get(function () {
  return this.paymentStatus === 'paid';
});

// Virtual: Check if order is completed
orderSchema.virtual('isCompleted').get(function () {
  return this.status === 'delivered';
});

// Virtual: Check if order can be cancelled
orderSchema.virtual('canBeCancelled').get(function () {
  return ['pending', 'processing'].includes(this.status) &&
    this.paymentStatus !== 'paid';
});

// ============ MIDDLEWARE ============
/**
 * Pre-save hook: Auto-generate orderNumber
 * Format: ORD[YYMM][SEQUENCE]
 * Example: ORD2501000001
 */
orderSchema.pre('save', async function (next) {
  if (this.isNew && !this.orderNumber) {
    try {
      const Order = mongoose.model('Order');
      const now = new Date();
      const year = now.getFullYear().toString().slice(-2); // YY
      const month = String(now.getMonth() + 1).padStart(2, '0'); // MM
      const yearMonth = year + month; // YYMM

      // Find the last order number for the current month
      const lastOrder = await Order
        .findOne(
          { orderNumber: new RegExp(`^ORD${yearMonth}`) },
          { orderNumber: 1 }
        )
        .sort({ orderNumber: -1 })
        .lean();

      let sequenceNumber = 1;

      if (lastOrder && lastOrder.orderNumber) {
        // Extract the sequence number from the last order number
        const match = lastOrder.orderNumber.match(/\d{6}$/);
        if (match) {
          sequenceNumber = parseInt(match[0], 10) + 1;
        }
      }

      // Generate new order number: ORD + YYMM + 6-digit sequence
      this.orderNumber = `ORD${yearMonth}${String(sequenceNumber).padStart(6, '0')}`;
    } catch (error) {
      return next(error);
    }
  }
  next();
});

// ============ JSON TRANSFORMATION ============
orderSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString();
    delete returnedObject._id;
    delete returnedObject.__v;

    // Convert Decimal128 to number
    if (returnedObject.shippingFee && typeof returnedObject.shippingFee === 'object') {
      returnedObject.shippingFee = parseFloat(returnedObject.shippingFee.toString());
    }
    if (returnedObject.total && typeof returnedObject.total === 'object') {
      returnedObject.total = parseFloat(returnedObject.total.toString());
    }
  }
});

module.exports = mongoose.model('Order', orderSchema);
