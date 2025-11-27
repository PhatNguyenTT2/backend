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
      values: ['bank_transfer', 'cash', 'card'],
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
/**
 * Pre-save hook: Store original status for comparison
 */
paymentSchema.pre('save', async function (next) {
  if (!this.isNew && this.isModified('status')) {
    const original = await this.constructor.findById(this._id).lean();
    this._originalStatus = original?.status;
  }
  next();
});

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

/**
 * Post-save hook: Sync paymentStatus with Order/PurchaseOrder
 * Logic:
 * - pending payment → Order.paymentStatus = 'pending'
 * - completed payment → Check if all payments are completed → Order.paymentStatus = 'paid' or 'pending'
 * - cancelled payment → Recalculate Order.paymentStatus based on remaining payments
 */
paymentSchema.post('save', async function (doc) {
  try {
    const Order = mongoose.model(doc.referenceType);
    const Payment = mongoose.model('Payment');

    // Get the order/purchase order
    const order = await Order.findById(doc.referenceId);
    if (!order) {
      console.warn(`⚠️ ${doc.referenceType} not found:`, doc.referenceId);
      return;
    }

    // Get all payments for this order
    const allPayments = await Payment.find({
      referenceType: doc.referenceType,
      referenceId: doc.referenceId,
      status: { $ne: 'cancelled' } // Exclude cancelled payments
    });

    if (allPayments.length === 0) {
      // No active payments
      order.paymentStatus = 'pending';
      await order.save();
      console.log(`✅ ${doc.referenceType} ${order.orderNumber || order.poNumber} paymentStatus updated to: pending (no payments)`);
      return;
    }

    // Calculate total paid and total pending
    let totalPaid = 0;
    let totalPending = 0;

    allPayments.forEach(payment => {
      const amount = typeof payment.amount === 'object'
        ? parseFloat(payment.amount.toString())
        : payment.amount;

      if (payment.status === 'completed') {
        totalPaid += amount;
      } else if (payment.status === 'pending') {
        totalPending += amount;
      }
    });

    const orderTotal = typeof order.total === 'object'
      ? parseFloat(order.total.toString())
      : order.total;

    // Check if order is refunded
    const isOrderRefunded = order.status === 'refunded';

    // Determine payment status based on payment coverage
    let newPaymentStatus = 'pending';

    if (isOrderRefunded) {
      // Order is refunded, set payment status to refunded
      newPaymentStatus = 'refunded';
    } else if (totalPaid >= orderTotal) {
      // Fully paid
      newPaymentStatus = 'paid';
    } else if (totalPaid > 0) {
      // Partially paid (we'll use 'pending' for now, or you can add 'partial' to enum)
      newPaymentStatus = 'pending';
    } else if (totalPending > 0) {
      // Has pending payments but nothing completed yet
      newPaymentStatus = 'pending';
    }

    // Update order payment status if changed
    if (order.paymentStatus !== newPaymentStatus) {
      const oldStatus = order.paymentStatus;
      order.paymentStatus = newPaymentStatus;
      await order.save();
      console.log(
        `✅ ${doc.referenceType} ${order.orderNumber || order.poNumber} paymentStatus updated: ${oldStatus} → ${newPaymentStatus}`,
        `(Paid: ${totalPaid}/${orderTotal})`
      );
    } else {
      console.log(
        `ℹ️ ${doc.referenceType} ${order.orderNumber || order.poNumber} paymentStatus unchanged: ${newPaymentStatus}`,
        `(Paid: ${totalPaid}/${orderTotal})`
      );
    }
  } catch (error) {
    console.error('❌ Error syncing payment status:', error);
    // Don't throw error to avoid breaking the payment save operation
  }
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
