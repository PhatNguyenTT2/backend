const mongoose = require('mongoose');

/**
 * SalesPayment Model
 * Manages payments received from customers for orders
 * References: Order (many-to-one), Customer (many-to-one), Employee (many-to-one)
 */
const salesPaymentSchema = new mongoose.Schema({
  paymentNumber: {
    type: String,
    unique: true,
    uppercase: true,
    trim: true,
    match: [/^SPAY\d{10}$/, 'Payment number must follow format SPAY2025000001']
    // Auto-generated in pre-save hook
  },

  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: [true, 'Order is required']
  },

  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: [true, 'Customer is required']
  },

  amount: {
    type: mongoose.Schema.Types.Decimal128,
    required: [true, 'Amount is required'],
    min: [0, 'Amount cannot be negative'],
    get: function (value) {
      if (value) {
        return parseFloat(value.toString());
      }
      return 0;
    }
  },

  paymentMethod: {
    type: String,
    enum: {
      values: ['cash', 'card', 'bank_transfer', 'e_wallet'],
      message: '{VALUE} is not a valid payment method'
    },
    required: [true, 'Payment method is required']
  },

  paymentDate: {
    type: Date,
    default: Date.now,
    required: [true, 'Payment date is required']
  },

  status: {
    type: String,
    enum: {
      values: ['pending', 'completed', 'failed', 'refunded'],
      message: '{VALUE} is not a valid status'
    },
    default: 'pending'
  },

  receivedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  },

  transactionId: {
    type: String,
    trim: true,
    maxlength: [100, 'Transaction ID must be at most 100 characters']
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
salesPaymentSchema.index({ paymentNumber: 1 });
salesPaymentSchema.index({ order: 1 });
salesPaymentSchema.index({ customer: 1, paymentDate: -1 });
salesPaymentSchema.index({ paymentDate: -1 });
salesPaymentSchema.index({ status: 1 });
salesPaymentSchema.index({ receivedBy: 1, paymentDate: -1 });

// ============ VIRTUALS ============
// Virtual: Check if payment is successful
salesPaymentSchema.virtual('isSuccessful').get(function () {
  return this.status === 'completed';
});

// Virtual: Check if payment is refundable
salesPaymentSchema.virtual('isRefundable').get(function () {
  return this.status === 'completed' && this.paymentMethod !== 'cash';
});

// ============ MIDDLEWARE ============
// Auto-generate payment number before saving
salesPaymentSchema.pre('save', async function (next) {
  if (!this.paymentNumber) {
    try {
      const currentYear = new Date().getFullYear();

      // Find the last payment number for the current year
      const lastPayment = await this.constructor
        .findOne({ paymentNumber: new RegExp(`^SPAY${currentYear}`) })
        .sort({ paymentNumber: -1 })
        .select('paymentNumber')
        .lean();

      let sequenceNumber = 1;

      if (lastPayment && lastPayment.paymentNumber) {
        // Extract the sequence number from the last payment number
        const match = lastPayment.paymentNumber.match(/\d{6}$/);
        if (match) {
          sequenceNumber = parseInt(match[0]) + 1;
        }
      }

      // Generate new payment number with 6-digit padding
      this.paymentNumber = `SPAY${currentYear}${String(sequenceNumber).padStart(6, '0')}`;
    } catch (error) {
      return next(error);
    }
  }
  next();
});

// ============ JSON TRANSFORMATION ============
salesPaymentSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString();
    delete returnedObject._id;
    delete returnedObject.__v;

    // Convert Decimal128 to number
    if (returnedObject.amount && typeof returnedObject.amount === 'object') {
      returnedObject.amount = parseFloat(returnedObject.amount.toString());
    }
  }
});

module.exports = mongoose.model('SalesPayment', salesPaymentSchema);
