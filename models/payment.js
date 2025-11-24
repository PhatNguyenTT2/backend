const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  paymentNumber: {
    type: String,
    unique: true,
    uppercase: true,
    trim: true,
    match: [/^PPAY\d{10}$/, 'Payment number must follow format PPAY2025000001']
    // Auto-generated in pre-save hook
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
      values: ['bank_transfer', 'cash'],
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
      values: ['pending', 'completed', 'cancelled'],
      message: '{VALUE} is not a valid status'
    },
    default: 'pending'
  },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  },

  // Polymorphic reference to Order or PurchaseOrder
  referenceType: {
    type: String,
    enum: {
      values: ['Order', 'PurchaseOrder'],
      message: '{VALUE} is not a valid reference type'
    },
    required: [true, 'Reference type is required']
  },

  referenceId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'referenceType',
    required: [true, 'Reference ID is required']
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
paymentSchema.index({ paymentNumber: 1 });
paymentSchema.index({ paymentDate: -1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ createdBy: 1, paymentDate: -1 });
paymentSchema.index({ referenceType: 1, referenceId: 1 });
paymentSchema.index({ referenceId: 1 });

// ============ VIRTUALS ============
// Virtual: Check if payment is successful
paymentSchema.virtual('isCompleted').get(function () {
  return this.status === 'completed';
});

// Virtual: Check if payment is overdue
paymentSchema.virtual('isOverdue').get(function () {
  if (!this.dueDate || this.status === 'completed' || this.status === 'cancelled') {
    return false;
  }
  return new Date() > this.dueDate;
});

// ============ MIDDLEWARE ============
// Validate reference exists before saving
paymentSchema.pre('save', async function (next) {
  // Validate that the referenced Order or PurchaseOrder exists
  if (this.isNew || this.isModified('referenceId') || this.isModified('referenceType')) {
    try {
      const Model = mongoose.model(this.referenceType);
      const exists = await Model.exists({ _id: this.referenceId });
      if (!exists) {
        const error = new Error(`${this.referenceType} with ID ${this.referenceId} not found`);
        error.name = 'ValidationError';
        return next(error);
      }
    } catch (error) {
      return next(error);
    }
  }
  next();
});

// Auto-generate payment number before saving
paymentSchema.pre('save', async function (next) {
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
paymentSchema.set('toJSON', {
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

module.exports = mongoose.model('Payment', paymentSchema);
