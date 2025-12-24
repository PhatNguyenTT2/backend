const mongoose = require('mongoose');

/**
 * Inventory Model
 * Manages product inventory tracking (warehouse + shelf stock)
 * References: Product (one-to-one)
 * 
 * Stock Flow:
 * 1. Receive goods → quantityOnHand (warehouse)
 * 2. Move to shelf → quantityOnShelf
 * 3. Customer order → quantityReserved
 * 4. Delivery → quantityReserved - (completed)
 */
const inventorySchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'Product is required'],
    unique: true
  },

  quantityOnHand: {
    type: Number,
    default: 0,
    min: [0, 'Quantity on hand cannot be negative']
  },

  quantityReserved: {
    type: Number,
    default: 0,
    min: [0, 'Quantity reserved cannot be negative']
  },

  quantityOnShelf: {
    type: Number,
    default: 0,
    min: [0, 'Quantity on shelf cannot be negative']
  },

  reorderPoint: {
    type: Number,
    default: 10,
    min: [0, 'Reorder point cannot be negative']
  }

}, {
  timestamps: true
});

// ============ INDEXES ============
inventorySchema.index({ product: 1 });

// ============ VIRTUALS ============
// Virtual for inventory movements (populate from InventoryMovement model)
inventorySchema.virtual('movements', {
  ref: 'InventoryMovement',
  localField: '_id',
  foreignField: 'inventory'
});

// Virtual: Calculate quantity available for sale
// Available = (OnHand + OnShelf) - Reserved
inventorySchema.virtual('quantityAvailable').get(function () {
  return Math.max(0, this.quantityOnHand + this.quantityOnShelf - this.quantityReserved);
});

// Virtual: Calculate total quantity in inventory (warehouse + shelf)
inventorySchema.virtual('totalQuantity').get(function () {
  return this.quantityOnHand + this.quantityOnShelf;
});

// Virtual: Check if reorder is needed
inventorySchema.virtual('needsReorder').get(function () {
  return this.quantityAvailable <= this.reorderPoint;
});

// Virtual: Check if out of stock
inventorySchema.virtual('isOutOfStock').get(function () {
  return this.quantityAvailable === 0;
});

// Virtual: Check if low stock (< 2x reorder point)
inventorySchema.virtual('isLowStock').get(function () {
  return this.quantityAvailable > 0 && this.quantityAvailable <= (this.reorderPoint * 2);
});

// ============ STATIC METHODS ============
/**
 * Recalculate and update inventory quantities from DetailInventory
 * This method aggregates all DetailInventory records for a product
 * and updates the main Inventory record
 */
inventorySchema.statics.recalculateFromDetails = async function (productId) {
  const DetailInventory = mongoose.model('DetailInventory');

  try {
    // Aggregate quantities from all detail inventories for this product
    const aggregation = await DetailInventory.aggregate([
      {
        $lookup: {
          from: 'productbatches',
          localField: 'batchId',
          foreignField: '_id',
          as: 'batch'
        }
      },
      {
        $unwind: '$batch'
      },
      {
        $match: {
          'batch.product': new mongoose.Types.ObjectId(productId)
        }
      },
      {
        $group: {
          _id: null,
          totalOnHand: { $sum: '$quantityOnHand' },
          totalOnShelf: { $sum: '$quantityOnShelf' },
          totalReserved: { $sum: '$quantityReserved' }
        }
      }
    ]);

    const totals = aggregation[0] || {
      totalOnHand: 0,
      totalOnShelf: 0,
      totalReserved: 0
    };

    // Update the inventory record
    const inventory = await this.findOneAndUpdate(
      { product: productId },
      {
        quantityOnHand: totals.totalOnHand || 0,
        quantityOnShelf: totals.totalOnShelf || 0,
        quantityReserved: totals.totalReserved || 0
      },
      { new: true, upsert: false }
    );

    return inventory;
  } catch (error) {
    console.error('Error recalculating inventory:', error);
    throw error;
  }
};

/**
 * Recalculate inventory for a specific inventory ID
 */
inventorySchema.methods.recalculate = async function () {
  return this.constructor.recalculateFromDetails(this.product);
};

// ============ JSON TRANSFORMATION ============
inventorySchema.set('toJSON', {
  virtuals: true,
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString();
    delete returnedObject._id;
    delete returnedObject.__v;
  }
});

module.exports = mongoose.model('Inventory', inventorySchema);
