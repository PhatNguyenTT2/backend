const mongoose = require('mongoose');

/**
 * DetailInventory Model
 * Manages inventory tracking at batch level (warehouse + shelf stock per batch)
 * References: ProductBatch (one-to-one)
 * 
 * Stock Flow per Batch:
 * 1. Receive batch → quantityOnHand (warehouse)
 * 2. Move batch to shelf → quantityOnShelf
 * 3. Customer order from batch → quantityReserved
 * 4. Delivery → quantityReserved - (completed)
 * 
 * Relationship:
 * - Each ProductBatch has ONE DetailInventory
 * - Parent Inventory aggregates all DetailInventory records for a product
 */
const detailInventorySchema = new mongoose.Schema({
  batchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProductBatch',
    required: [true, 'Batch ID is required'],
    unique: true
  },

  quantityOnHand: {
    type: Number,
    default: 0,
    min: [0, 'Quantity on hand cannot be negative']
  },

  quantityOnShelf: {
    type: Number,
    default: 0,
    min: [0, 'Quantity on shelf cannot be negative']
  },

  quantityReserved: {
    type: Number,
    default: 0,
    min: [0, 'Quantity reserved cannot be negative']
  },

  location: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LocationMaster',
    default: null,
    validate: {
      validator: async function (locationId) {
        // Allow null (batch not assigned to location yet)
        if (!locationId) return true;

        // Check if location exists and is active
        const LocationMaster = mongoose.model('LocationMaster');
        const location = await LocationMaster.findById(locationId);

        if (!location) return false;
        if (!location.isActive) return false;

        // Check if location has enough capacity for this batch
        // Only check on new assignment or location change
        if (this.isModified('location')) {
          const batchQuantity = this.quantityOnHand || 0;

          // Get current occupied capacity (excluding this batch if it's already assigned)
          const DetailInventory = mongoose.model('DetailInventory');
          const existingBatches = await DetailInventory.find({
            location: locationId,
            _id: { $ne: this._id } // Exclude current batch
          });

          const occupiedCapacity = existingBatches.reduce((total, batch) =>
            total + (batch.quantityOnHand || 0), 0
          );

          const availableCapacity = location.maxCapacity - occupiedCapacity;

          if (batchQuantity > availableCapacity) {
            throw new Error(
              `Location capacity exceeded. Available: ${availableCapacity}, Required: ${batchQuantity}`
            );
          }
        }

        return true;
      },
      message: 'Location validation failed: {VALUE}'
    }
  }

}, {
  timestamps: true
});

// ============ INDEXES ============
detailInventorySchema.index({ batchId: 1 });
detailInventorySchema.index({ location: 1 });

// ============ VIRTUALS ============
// Virtual: Batch information (populate from ProductBatch model)
detailInventorySchema.virtual('batch', {
  ref: 'ProductBatch',
  localField: 'batchId',
  foreignField: '_id',
  justOne: true
});

// Virtual: Calculate quantity available for sale
// Available = (OnHand + OnShelf) - Reserved
detailInventorySchema.virtual('quantityAvailable').get(function () {
  return Math.max(0, this.quantityOnHand + this.quantityOnShelf - this.quantityReserved);
});

// Virtual: Calculate total quantity in inventory (warehouse + shelf)
detailInventorySchema.virtual('totalQuantity').get(function () {
  return this.quantityOnHand + this.quantityOnShelf;
});

// Virtual: Check if out of stock
detailInventorySchema.virtual('isOutOfStock').get(function () {
  return this.quantityAvailable === 0;
});

// Virtual: Check if this batch has any quantity in warehouse
detailInventorySchema.virtual('hasWarehouseStock').get(function () {
  return this.quantityOnHand > 0;
});

// Virtual: Check if this batch has any quantity on shelf
detailInventorySchema.virtual('hasShelfStock').get(function () {
  return this.quantityOnShelf > 0;
});

// ============ MIDDLEWARE ============
// Validate that total quantities don't exceed batch quantity
detailInventorySchema.pre('save', async function (next) {
  try {
    // Populate batch if not already populated
    if (!this.populated('batchId')) {
      await this.populate('batchId');
    }

    if (this.batchId) {
      const totalInventory = this.quantityOnHand + this.quantityOnShelf + this.quantityReserved;

      // Warning: In production, you might want to handle this differently
      // This is a soft check - adjust based on your business logic
      if (totalInventory > this.batchId.quantity) {
        console.warn(`DetailInventory total (${totalInventory}) exceeds batch quantity (${this.batchId.quantity})`);
      }
    }
  } catch (error) {
    console.error('Error in DetailInventory pre-save:', error);
  }
  next();
});

// Post-save: Update parent Inventory after DetailInventory changes
detailInventorySchema.post('save', async function (doc) {
  try {
    const Inventory = mongoose.model('Inventory');

    // Get the product ID from the batch
    if (!doc.populated('batchId')) {
      await doc.populate('batchId');
    }

    if (doc.batchId && doc.batchId.product) {
      // Recalculate parent inventory
      await Inventory.recalculateFromDetails(doc.batchId.product);
      console.log(`✅ Inventory updated for product: ${doc.batchId.product}`);
    }
  } catch (error) {
    console.error('Error updating parent inventory after DetailInventory save:', error);
  }
});

// Post-remove: Update parent Inventory after DetailInventory deletion
detailInventorySchema.post('remove', async function (doc) {
  try {
    const Inventory = mongoose.model('Inventory');

    // Get the product ID from the batch
    if (!doc.populated('batchId')) {
      await doc.populate('batchId');
    }

    if (doc.batchId && doc.batchId.product) {
      // Recalculate parent inventory
      await Inventory.recalculateFromDetails(doc.batchId.product);
      console.log(`✅ Inventory updated after DetailInventory deletion for product: ${doc.batchId.product}`);
    }
  } catch (error) {
    console.error('Error updating parent inventory after DetailInventory removal:', error);
  }
});

// Post-findOneAndUpdate: Update parent Inventory after update operations
detailInventorySchema.post('findOneAndUpdate', async function (doc) {
  if (doc) {
    try {
      const Inventory = mongoose.model('Inventory');

      // Get the product ID from the batch
      if (!doc.populated('batchId')) {
        await doc.populate('batchId');
      }

      if (doc.batchId && doc.batchId.product) {
        // Recalculate parent inventory
        await Inventory.recalculateFromDetails(doc.batchId.product);
        console.log(`✅ Inventory updated after DetailInventory update for product: ${doc.batchId.product}`);
      }
    } catch (error) {
      console.error('Error updating parent inventory after DetailInventory update:', error);
    }
  }
});

// ============ JSON TRANSFORMATION ============
detailInventorySchema.set('toJSON', {
  virtuals: true,
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString();
    delete returnedObject._id;
    delete returnedObject.__v;
  }
});

module.exports = mongoose.model('DetailInventory', detailInventorySchema);
