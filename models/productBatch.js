const mongoose = require('mongoose');

/**
 * ProductBatch Model
 * Manages product batches with expiry tracking
 * References: Product (many-to-one)
 */
const productBatchSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'Product is required']
  },

  batchCode: {
    type: String,
    required: [true, 'Batch code is required'],
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
      values: ['active', 'expired', 'disposed'],
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

// ============ INDEXES ============
productBatchSchema.index({ product: 1 });
productBatchSchema.index({ batchCode: 1 });
productBatchSchema.index({ expiryDate: 1 });
productBatchSchema.index({ status: 1 });
productBatchSchema.index({ product: 1, status: 1 });

// ============ VIRTUALS ============
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
  }
});

module.exports = mongoose.model('ProductBatch', productBatchSchema);
