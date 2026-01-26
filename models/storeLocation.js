const mongoose = require('mongoose');

/**
 * StoreLocation Model
 * Tracks batch positions on store shelves (for batches with quantityOnShelf > 0)
 * Simple design: BatchCode + Store Location Name (e.g., "SHELF A01")
 */
const storeLocationSchema = new mongoose.Schema({
  batchCode: {
    type: String,
    unique: true,
    sparse: true, // Allow multiple null/undefined values (empty locations)
    trim: true,
    uppercase: true
  },

  name: {
    type: String,
    required: [true, 'Store location name is required'],
    trim: true,
    uppercase: true,
    maxlength: [50, 'Store location name must be at most 50 characters']
    // Format: "SHELF A01", "SHELF A02", etc.
  }

}, {
  timestamps: true
});

// Indexes for faster queries
storeLocationSchema.index({ batchCode: 1 });
storeLocationSchema.index({ name: 1 });

// Virtual: Get batch details from DetailInventory
storeLocationSchema.virtual('batchDetails', {
  ref: 'ProductBatch',
  localField: 'batchCode',
  foreignField: 'batchCode',
  justOne: true
});

// JSON transformation
storeLocationSchema.set('toJSON', {
  virtuals: true,
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString();
    delete returnedObject._id;
    delete returnedObject.__v;
  }
});

module.exports = mongoose.model('StoreLocation', storeLocationSchema);
