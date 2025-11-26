const mongoose = require('mongoose');

/**
 * ProductBatch Model
 * Manages product batches with expiry tracking and pricing
 * References: Product (many-to-one)
 */
const productBatchSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'Product is required']
  },

  costPrice: {
    type: mongoose.Schema.Types.Decimal128,
    required: [true, 'Cost price is required'],
    min: [0, 'Cost price cannot be negative']
  },

  unitPrice: {
    type: mongoose.Schema.Types.Decimal128,
    required: [true, 'Unit price is required'],
    min: [0, 'Unit price cannot be negative']
  },

  promotionApplied: {
    type: String,
    enum: {
      values: ['none', 'discount'],
      message: '{VALUE} is not a valid promotion type'
    },
    default: 'none'
  },

  discountPercentage: {
    type: mongoose.Schema.Types.Decimal128,
    default: 0,
    min: [0, 'Discount percentage cannot be negative'],
    max: [100, 'Discount percentage cannot exceed 100']
  },

  batchCode: {
    type: String,
    unique: true,
    uppercase: true,
    trim: true
  },

  mfgDate: {
    type: Date,
    default: null
  },

  expiryDate: {
    type: Date,
    default: null
  },

  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [0, 'Quantity cannot be negative'],
    default: 0
  },

  status: {
    type: String,
    enum: {
      values: ['active', 'expired'],
      message: '{VALUE} is not a valid status'
    },
    default: 'active'
  },

  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Notes must be at most 500 characters long']
  }

}, {
  timestamps: true
});

// ============ MIDDLEWARE ============
/**
 * Pre-save hook: Auto-generate batchCode
 * Format: BATCH[YEAR][SEQUENCE]
 * Example: BATCH2025000001
 */
productBatchSchema.pre('save', async function (next) {
  if (this.isNew && !this.batchCode) {
    try {
      const ProductBatch = mongoose.model('ProductBatch');
      const currentYear = new Date().getFullYear();

      // Find the last batch code for the current year
      const lastBatch = await ProductBatch
        .findOne(
          { batchCode: new RegExp(`^BATCH${currentYear}`) },
          { batchCode: 1 }
        )
        .sort({ batchCode: -1 })
        .lean();

      let sequenceNumber = 1;

      if (lastBatch && lastBatch.batchCode) {
        // Extract the sequence number from the last batch code
        const match = lastBatch.batchCode.match(/\d{6}$/);
        if (match) {
          sequenceNumber = parseInt(match[0], 10) + 1;
        }
      }

      // Generate new batch code with 6-digit padding
      this.batchCode = `BATCH${currentYear}${String(sequenceNumber).padStart(6, '0')}`;
    } catch (error) {
      return next(error);
    }
  }
  next();
});

// ============ INDEXES ============
productBatchSchema.index({ product: 1 });
productBatchSchema.index({ batchCode: 1 });
productBatchSchema.index({ status: 1 });
productBatchSchema.index({ expiryDate: 1 });

// ============ VIRTUALS ============
// Virtual: Get detail inventory for this batch
productBatchSchema.virtual('detailInventory', {
  ref: 'DetailInventory',
  localField: '_id',
  foreignField: 'batchId',
  justOne: true
});

// Virtual to check if batch is expired
productBatchSchema.virtual('isExpired').get(function () {
  if (!this.expiryDate) return false;
  return new Date() > this.expiryDate;
});

// Virtual to calculate days until expiry
productBatchSchema.virtual('daysUntilExpiry').get(function () {
  if (!this.expiryDate) return null;
  const today = new Date();
  const expiry = new Date(this.expiryDate);
  const diffTime = expiry - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
});

// Virtual to check if batch is near expiry (30 days)
productBatchSchema.virtual('isNearExpiry').get(function () {
  const days = this.daysUntilExpiry;
  return days !== null && days > 0 && days <= 30;
});

// ============ JSON TRANSFORMATION ============
productBatchSchema.set('toJSON', {
  virtuals: true,
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString();
    delete returnedObject._id;
    delete returnedObject.__v;

    // Convert Decimal128 to number for JSON response
    if (returnedObject.costPrice) {
      returnedObject.costPrice = parseFloat(returnedObject.costPrice.toString());
    }
    if (returnedObject.unitPrice) {
      returnedObject.unitPrice = parseFloat(returnedObject.unitPrice.toString());
    }
    if (returnedObject.discountPercentage) {
      returnedObject.discountPercentage = parseFloat(returnedObject.discountPercentage.toString());
    }
  }
});

module.exports = mongoose.model('ProductBatch', productBatchSchema);
