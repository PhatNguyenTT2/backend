const mongoose = require('mongoose');

/**
 * StockOutOrder Model
 * Manages stock-out orders (warehouse to shelf transfers)
 * Main function: Move products from warehouse to shelf for sales
 * References: Employee (many-to-one)
 * Related: DetailStockOutOrder (one-to-many)
 */
const stockOutOrderSchema = new mongoose.Schema({
  soNumber: {
    type: String,
    unique: true,
    uppercase: true,
    trim: true,
    match: [/^SO\d{10}$/, 'SO number must follow format SO2025000001']
    // Auto-generated in pre-save hook
  },

  orderDate: {
    type: Date,
    default: Date.now,
    required: [true, 'Order date is required']
  },

  expectedDeliveryDate: {
    type: Date,
    default: null,
    validate: {
      validator: function (value) {
        if (!value) return true;
        return value >= this.orderDate;
      },
      message: 'Expected delivery date must be after order date'
    }
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
    type: mongoose.Schema.Types.Decimal128,
    default: 0,
    min: [0, 'Discount percentage cannot be negative'],
    max: [100, 'Discount percentage cannot exceed 100'],
    get: function (value) {
      if (value) {
        return parseFloat(value.toString());
      }
      return 0;
    }
  },

  totalPrice: {
    type: mongoose.Schema.Types.Decimal128,
    default: 0,
    min: [0, 'Total price cannot be negative'],
    get: function (value) {
      if (value) {
        return parseFloat(value.toString());
      }
      return 0;
    }
  },

  status: {
    type: String,
    enum: {
      values: ['pending', 'processing', 'completed', 'cancelled'],
      message: '{VALUE} is not a valid status'
    },
    default: 'pending'
  },

  paymentStatus: {
    type: String,
    enum: {
      values: ['unpaid', 'partial', 'paid'],
      message: '{VALUE} is not a valid payment status'
    },
    default: 'unpaid'
  },

  notes: {
    type: String,
    trim: true,
    maxlength: [1000, 'Notes must be at most 1000 characters']
  },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true, getters: true },
  toObject: { virtuals: true, getters: true }
});

// ============ INDEXES ============
stockOutOrderSchema.index({ soNumber: 1 });
stockOutOrderSchema.index({ status: 1 });
stockOutOrderSchema.index({ paymentStatus: 1 });
stockOutOrderSchema.index({ orderDate: -1 });
stockOutOrderSchema.index({ createdBy: 1 });

// ============ VIRTUALS ============
// Virtual: Stock-out order details relationship
stockOutOrderSchema.virtual('details', {
  ref: 'DetailStockOutOrder',
  localField: '_id',
  foreignField: 'stockOutOrder'
});

// Virtual: Calculate subtotal from details (when populated)
stockOutOrderSchema.virtual('subtotal').get(function () {
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
stockOutOrderSchema.virtual('discountAmount').get(function () {
  const subtotal = this.subtotal || 0;
  const discountPercent = this.discountPercentage || 0;
  return parseFloat((subtotal * (discountPercent / 100)).toFixed(2));
});

// Virtual: Check if order is overdue
stockOutOrderSchema.virtual('isOverdue').get(function () {
  if (!this.expectedDeliveryDate) return false;
  if (this.status === 'completed' || this.status === 'cancelled') return false;
  return new Date() > this.expectedDeliveryDate;
});

// Virtual: Days until delivery
stockOutOrderSchema.virtual('daysUntilDelivery').get(function () {
  if (!this.expectedDeliveryDate) return null;
  if (this.status === 'completed' || this.status === 'cancelled') return null;
  const today = new Date();
  const expected = new Date(this.expectedDeliveryDate);
  const diffTime = expected - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
});

// Virtual: Check if order is in progress
stockOutOrderSchema.virtual('isInProgress').get(function () {
  return this.status === 'processing';
});

// ============ MIDDLEWARE ============
// Auto-generate SO number before saving
stockOutOrderSchema.pre('save', async function (next) {
  if (!this.soNumber) {
    try {
      const currentYear = new Date().getFullYear();

      // Find the last SO number for the current year
      const lastSO = await this.constructor
        .findOne({ soNumber: new RegExp(`^SO${currentYear}`) })
        .sort({ soNumber: -1 })
        .select('soNumber')
        .lean();

      let sequenceNumber = 1;

      if (lastSO && lastSO.soNumber) {
        // Extract the sequence number from the last SO number
        const match = lastSO.soNumber.match(/\d{6}$/);
        if (match) {
          sequenceNumber = parseInt(match[0]) + 1;
        }
      }

      // Generate new SO number with 6-digit padding
      this.soNumber = `SO${currentYear}${String(sequenceNumber).padStart(6, '0')}`;
    } catch (error) {
      return next(error);
    }
  }
  next();
});

// ============ JSON TRANSFORMATION ============
stockOutOrderSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString();
    delete returnedObject._id;
    delete returnedObject.__v;

    // Convert Decimal128 to number
    if (returnedObject.shippingFee && typeof returnedObject.shippingFee === 'object') {
      returnedObject.shippingFee = parseFloat(returnedObject.shippingFee.toString());
    }
    if (returnedObject.discountPercentage && typeof returnedObject.discountPercentage === 'object') {
      returnedObject.discountPercentage = parseFloat(returnedObject.discountPercentage.toString());
    }
    if (returnedObject.totalPrice && typeof returnedObject.totalPrice === 'object') {
      returnedObject.totalPrice = parseFloat(returnedObject.totalPrice.toString());
    }
  }
});

module.exports = mongoose.model('StockOutOrder', stockOutOrderSchema);
