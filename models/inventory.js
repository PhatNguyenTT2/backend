const mongoose = require('mongoose')

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

  quantityAvailable: {
    type: Number,
    default: 0,
    min: [0, 'Quantity available cannot be negative']
  },

  reorderPoint: {
    type: Number,
    default: 10,
    min: [0, 'Reorder point cannot be negative']
  },

  warehouseLocation: {
    type: String,
    trim: true
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
})

// Virtual for inventory movements
inventorySchema.virtual('movements', {
  ref: 'InventoryMovement',
  localField: '_id',
  foreignField: 'inventory'
})

// Index for faster queries
inventorySchema.index({ product: 1 })
inventorySchema.index({ quantityAvailable: 1 })

// Pre-save hook to calculate quantityAvailable
inventorySchema.pre('save', function (next) {
  this.quantityAvailable = this.quantityOnHand - this.quantityReserved
  next()
})

// Method to check if reorder is needed
inventorySchema.methods.needsReorder = function () {
  return this.quantityAvailable <= this.reorderPoint
}

// Method to update inventory quantities
inventorySchema.methods.updateQuantities = function (onHand, reserved) {
  if (onHand !== undefined) {
    this.quantityOnHand = onHand
  }
  if (reserved !== undefined) {
    this.quantityReserved = reserved
  }
  this.quantityAvailable = this.quantityOnHand - this.quantityReserved
  return this.save()
}

// Method to adjust inventory
inventorySchema.methods.adjustInventory = function (quantity, type = 'in') {
  if (type === 'in') {
    this.quantityOnHand += quantity
  } else if (type === 'out') {
    if (this.quantityOnHand < quantity) {
      throw new Error('Insufficient inventory for this operation')
    }
    this.quantityOnHand -= quantity
  }
  this.quantityAvailable = this.quantityOnHand - this.quantityReserved
  return this.save()
}

// Method to reserve inventory
inventorySchema.methods.reserveInventory = function (quantity) {
  if (this.quantityAvailable < quantity) {
    throw new Error('Insufficient available inventory to reserve')
  }
  this.quantityReserved += quantity
  this.quantityAvailable = this.quantityOnHand - this.quantityReserved
  return this.save()
}

// Method to release reserved inventory
inventorySchema.methods.releaseInventory = function (quantity) {
  if (this.quantityReserved < quantity) {
    throw new Error('Cannot release more than reserved quantity')
  }
  this.quantityReserved -= quantity
  this.quantityAvailable = this.quantityOnHand - this.quantityReserved
  return this.save()
}

inventorySchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString()
    delete returnedObject._id
    delete returnedObject.__v
  }
})

module.exports = mongoose.model('Inventory', inventorySchema)
