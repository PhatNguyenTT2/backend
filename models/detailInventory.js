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
    type: String,
    trim: true,
    default: null,
    maxlength: [100, 'Location must be at most 100 characters']
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
    if (!this.populated('batch')) {
      await this.populate('batch');
    }

    if (this.batch) {
      const totalInventory = this.quantityOnHand + this.quantityOnShelf + this.quantityReserved;

      // Warning: In production, you might want to handle this differently
      // This is a soft check - adjust based on your business logic
      if (totalInventory > this.batch.quantity) {
        console.warn(`DetailInventory total (${totalInventory}) exceeds batch quantity (${this.batch.quantity})`);
      }
    }
  } catch (error) {
    console.error('Error in DetailInventory pre-save:', error);
  }
  next();
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
