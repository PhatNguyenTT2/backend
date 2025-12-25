const mongoose = require('mongoose');

/**
 * StockOutOrder Model (Stock Out - SO)
 * Manages outbound inventory movements
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

  completedDate: {
    type: Date,
    default: null
  },

  reason: {
    type: String,
    enum: {
      values: ['sales', 'transfer', 'damage', 'expired', 'return_to_supplier', 'internal_use', 'other'],
      message: '{VALUE} is not a valid reason'
    },
    required: [true, 'Reason is required'],
    default: 'sales'
  },

  destination: {
    type: String,
    trim: true,
    maxlength: [200, 'Destination must be at most 200 characters']
  },

  status: {
    type: String,
    enum: {
      values: ['draft', 'pending', 'approved', 'completed', 'cancelled'],
      message: '{VALUE} is not a valid status'
    },
    default: 'draft'
  },

  notes: {
    type: String,
    trim: true,
    maxlength: [1000, 'Notes must be at most 1000 characters']
  },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: [true, 'Created by is required']
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ============ INDEXES ============
stockOutOrderSchema.index({ soNumber: 1 });
stockOutOrderSchema.index({ status: 1 });
stockOutOrderSchema.index({ reason: 1 });
stockOutOrderSchema.index({ orderDate: -1 });
stockOutOrderSchema.index({ createdBy: 1 });

// ============ VIRTUALS ============
// Virtual: Stock-out order details relationship
stockOutOrderSchema.virtual('details', {
  ref: 'DetailStockOutOrder',
  localField: '_id',
  foreignField: 'stockOutOrder'
});

// Virtual: Count of items (when details populated)
stockOutOrderSchema.virtual('itemCount').get(function () {
  return this.details ? this.details.length : 0;
});

// ============ MIDDLEWARE ============
/**
 * Pre-save hook: Auto-generate soNumber
 * Format: SO[YEAR][SEQUENCE]
 * Example: SO2025000001
 */
stockOutOrderSchema.pre('save', async function (next) {
  if (this.isNew && !this.soNumber) {
    try {
      const StockOutOrder = mongoose.model('StockOutOrder');
      const currentYear = new Date().getFullYear();

      // Find the last SO number for the current year
      const lastSO = await StockOutOrder
        .findOne(
          { soNumber: new RegExp(`^SO${currentYear}`) },
          { soNumber: 1 }
        )
        .sort({ soNumber: -1 })
        .lean();

      let sequenceNumber = 1;

      if (lastSO && lastSO.soNumber) {
        // Extract the sequence number from the last SO number
        const match = lastSO.soNumber.match(/\d{6}$/);
        if (match) {
          sequenceNumber = parseInt(match[0], 10) + 1;
        }
      }

      // Generate new SO number: SO + YEAR + 6-digit sequence
      this.soNumber = `SO${currentYear}${String(sequenceNumber).padStart(6, '0')}`;
    } catch (error) {
      return next(error);
    }
  }

  // Set completedDate when status changes to completed
  if (this.isModified('status') && this.status === 'completed' && !this.completedDate) {
    this.completedDate = new Date();
  }

  next();
});

// ============ INSTANCE METHODS ============
/**
 * Check if SO can be submitted (move from draft to pending)
 */
stockOutOrderSchema.methods.canSubmit = function () {
  return this.status === 'draft';
};

/**
 * Check if SO can be approved
 */
stockOutOrderSchema.methods.canApprove = function () {
  return this.status === 'pending';
};

/**
 * Check if SO can be completed (only from approved status)
 */
stockOutOrderSchema.methods.canComplete = function () {
  return this.status === 'approved';
};

/**
 * Check if SO can be cancelled
 */
stockOutOrderSchema.methods.canCancel = function () {
  return ['draft', 'pending', 'approved'].includes(this.status);
};

/**
 * Check if SO can be edited
 */
stockOutOrderSchema.methods.canEdit = function () {
  return ['draft', 'pending'].includes(this.status);
};

/**
 * Check if SO can be deleted
 */
stockOutOrderSchema.methods.canDelete = function () {
  return this.status === 'draft';
};

// ============ JSON TRANSFORMATION ============
stockOutOrderSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString();
    delete returnedObject._id;
    delete returnedObject.__v;
  }
});

module.exports = mongoose.model('StockOutOrder', stockOutOrderSchema);