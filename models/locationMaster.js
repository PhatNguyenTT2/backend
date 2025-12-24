const mongoose = require('mongoose');

const locationMasterSchema = new mongoose.Schema({
  locationCode: {
    type: String,
    unique: true,
    uppercase: true,
    trim: true,
    match: [/^LOC\d{10}$/, 'Location code must follow format LOC2025000001']
    // Auto-generated in pre-save hook - NOT required because it's auto-generated
  },

  name: {
    type: String,
    required: [true, 'Location name is required'],
    unique: true,
    trim: true,
    uppercase: true,
    maxlength: [50, 'Location name must be at most 50 characters']
    // Examples: "A-01-R05-S03", "KỆ-A1", "VT-001"
  },

  maxCapacity: {
    type: Number,
    required: [true, 'Maximum capacity is required'],
    min: [1, 'Maximum capacity must be at least 1'],
    default: 100
  },

  isActive: {
    type: Boolean,
    default: true
  }

}, {
  timestamps: true
});

// Indexes for faster queries
locationMasterSchema.index({ locationCode: 1 });
locationMasterSchema.index({ name: 1 });
locationMasterSchema.index({ isActive: 1 });

// Virtual: Current batches in this location (multiple batches allowed)
locationMasterSchema.virtual('currentBatches', {
  ref: 'DetailInventory',
  localField: '_id',
  foreignField: 'location',
  justOne: false
});

// Virtual: Calculate total occupied quantity in this location
locationMasterSchema.virtual('occupiedCapacity').get(async function () {
  const DetailInventory = mongoose.model('DetailInventory');
  const batches = await DetailInventory.find({ location: this._id });
  return batches.reduce((total, batch) => total + batch.totalQuantity, 0);
});

// Virtual: Calculate available capacity
locationMasterSchema.virtual('availableCapacity').get(async function () {
  const occupied = await this.occupiedCapacity;
  return Math.max(0, this.maxCapacity - occupied);
});

/**
 * Pre-save hook: Auto-generate locationCode
 * Format: LOC[YEAR][SEQUENCE]
 * Example: LOC2025000001
 */
locationMasterSchema.pre('save', async function (next) {
  if (this.isNew && !this.locationCode) {
    try {
      const LocationMaster = mongoose.model('LocationMaster');
      const currentYear = new Date().getFullYear();

      // Find the last location code for the current year
      const lastLocation = await LocationMaster
        .findOne(
          { locationCode: new RegExp(`^LOC${currentYear}`) },
          { locationCode: 1 }
        )
        .sort({ locationCode: -1 })
        .lean();

      let sequenceNumber = 1;

      if (lastLocation && lastLocation.locationCode) {
        // Extract the sequence number from the last location code
        const match = lastLocation.locationCode.match(/\d{6}$/);
        if (match) {
          sequenceNumber = parseInt(match[0], 10) + 1;
        }
      }

      // Generate new location code with 6-digit padding
      this.locationCode = `LOC${currentYear}${String(sequenceNumber).padStart(6, '0')}`;
    } catch (error) {
      return next(error);
    }
  }

  // Normalize name to uppercase
  if (this.isModified('name')) {
    this.name = this.name.trim().toUpperCase();
  }

  next();
});

// Pre-remove: Check if location has any batches before deletion
locationMasterSchema.pre('remove', async function (next) {
  const DetailInventory = mongoose.model('DetailInventory');
  const occupiedBatches = await DetailInventory.find({ location: this._id });

  if (occupiedBatches.length > 0) {
    const error = new Error(`Cannot delete location that has ${occupiedBatches.length} batch(es). Please move all batches first.`);
    return next(error);
  }
  next();
});

// Static method: Check if location has enough capacity for a batch
locationMasterSchema.statics.checkCapacity = async function (locationId, additionalQuantity) {
  const location = await this.findById(locationId);
  if (!location) {
    throw new Error('Location not found');
  }

  const DetailInventory = mongoose.model('DetailInventory');
  const batches = await DetailInventory.find({ location: locationId });
  const occupiedCapacity = batches.reduce((total, batch) => total + batch.totalQuantity, 0);
  const availableCapacity = location.maxCapacity - occupiedCapacity;

  return {
    hasCapacity: availableCapacity >= additionalQuantity,
    occupiedCapacity,
    availableCapacity,
    maxCapacity: location.maxCapacity,
    additionalQuantity
  };
};

locationMasterSchema.set('toJSON', {
  virtuals: true,
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString();
    delete returnedObject._id;
    delete returnedObject.__v;
  }
});

module.exports = mongoose.model('LocationMaster', locationMasterSchema);
