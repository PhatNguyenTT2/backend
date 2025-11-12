const mongoose = require('mongoose');

/**
 * PurchasePayment Model
 * Manages payments made to suppliers for purchase orders
 * References: PurchaseOrder (many-to-one), Supplier (many-to-one), Employee (many-to-one)
 */
const purchasePaymentSchema = new mongoose.Schema({
  paymentNumber: {
    type: String,
    unique: true,
    uppercase: true,
    trim: true,
    match: [/^PPAY\d{10}$/, 'Payment number must follow format PPAY2025000001']
    // Auto-generated in pre-save hook
  },

  purchaseOrder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PurchaseOrder',
    required: [true, 'Purchase order is required']
  },

  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier',
    required: [true, 'Supplier is required']
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
      values: ['bank_transfer', 'check', 'credit', 'cash'],
      message: '{VALUE} is not a valid payment method'
    },
    required: [true, 'Payment method is required']
  },

  paymentDate: {
    type: Date,
    default: Date.now,
    required: [true, 'Payment date is required']
  },

  dueDate: {
    type: Date,
    default: null,
    validate: {
      validator: function (value) {
        if (!value) return true;
        return value >= this.paymentDate;
      },
      message: 'Due date must be after payment date'
    }
  },

  status: {
    type: String,
    enum: {
      values: ['pending', 'completed', 'failed', 'cancelled'],
      message: '{VALUE} is not a valid status'
    },
    default: 'pending'
  },

  paidBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  },

  checkNumber: {
    type: String,
    trim: true,
    maxlength: [50, 'Check number must be at most 50 characters']
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
purchasePaymentSchema.index({ paymentNumber: 1 });
purchasePaymentSchema.index({ purchaseOrder: 1 });
purchasePaymentSchema.index({ supplier: 1, paymentDate: -1 });
purchasePaymentSchema.index({ paymentDate: -1 });
purchasePaymentSchema.index({ dueDate: 1 });
purchasePaymentSchema.index({ status: 1 });
purchasePaymentSchema.index({ paidBy: 1, paymentDate: -1 });

// ============ VIRTUALS ============
// Virtual: Check if payment is successful
purchasePaymentSchema.virtual('isCompleted').get(function () {
  return this.status === 'completed';
});

// Virtual: Check if payment is overdue
purchasePaymentSchema.virtual('isOverdue').get(function () {
  if (!this.dueDate || this.status === 'completed' || this.status === 'cancelled') {
    return false;
  }
  return new Date() > this.dueDate;
});

// Virtual: Days until due date
purchasePaymentSchema.virtual('daysUntilDue').get(function () {
  if (!this.dueDate || this.status === 'completed' || this.status === 'cancelled') {
    return null;
  }
  const today = new Date();
  const due = new Date(this.dueDate);
  const diffTime = due - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
});

// Virtual: Check if payment is pending and approaching due date
purchasePaymentSchema.virtual('needsAttention').get(function () {
  if (this.status !== 'pending' || !this.dueDate) return false;
  const daysUntilDue = this.daysUntilDue;
  return daysUntilDue !== null && daysUntilDue <= 7;
});

// ============ MIDDLEWARE ============
// Auto-generate payment number before saving
purchasePaymentSchema.pre('save', async function (next) {
  if (!this.paymentNumber) {
    try {
      const currentYear = new Date().getFullYear();

      // Find the last payment number for the current year
      const lastPayment = await this.constructor
        .findOne({ paymentNumber: new RegExp(`^PPAY${currentYear}`) })
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
      this.paymentNumber = `PPAY${currentYear}${String(sequenceNumber).padStart(6, '0')}`;
    } catch (error) {
      return next(error);
    }
  }
  next();
});

// ============ JSON TRANSFORMATION ============
purchasePaymentSchema.set('toJSON', {
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

module.exports = mongoose.model('PurchasePayment', purchasePaymentSchema);
