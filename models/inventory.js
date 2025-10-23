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

  quantityOnShelf: {
    type: Number,
    default: 0,
    min: [0, 'Quantity on shelf cannot be negative']
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
  toJSON: { virtuals: true, getters: true },
  toObject: { virtuals: true, getters: true }
})

// Virtual for inventory movements
inventorySchema.virtual('movements', {
  ref: 'InventoryMovement',
  localField: '_id',
  foreignField: 'inventory'
})

// Virtual field: Calculate quantity available
// Available = (OnHand + OnShelf) - Reserved
inventorySchema.virtual('quantityAvailable').get(function () {
  return Math.max(0, this.quantityOnHand + this.quantityOnShelf - this.quantityReserved)
})

// Virtual field: Calculate total quantity in inventory
inventorySchema.virtual('totalQuantity').get(function () {
  return this.quantityOnHand + this.quantityOnShelf
})

// Index for faster queries
inventorySchema.index({ product: 1 })

// Method to check if reorder is needed
inventorySchema.methods.needsReorder = function () {
  return this.quantityAvailable <= this.reorderPoint
}

// Method to update inventory quantities
inventorySchema.methods.updateQuantities = function (onHand, reserved, onShelf) {
  if (onHand !== undefined) {
    this.quantityOnHand = onHand
  }
  if (reserved !== undefined) {
    this.quantityReserved = reserved
  }
  if (onShelf !== undefined) {
    this.quantityOnShelf = onShelf
  }
  return this.save()
}

// Method to adjust inventory (receive/return goods to warehouse - not on shelf yet)
inventorySchema.methods.adjustInventory = function (quantity, type = 'in') {
  if (type === 'in') {
    // Nhập hàng vào kho (chưa lên kệ)
    this.quantityOnHand += quantity
  } else if (type === 'out') {
    // Xuất hàng từ kho (damaged, return to supplier, etc.)
    if (this.quantityOnHand < quantity) {
      throw new Error(`Insufficient warehouse stock. Available in warehouse: ${this.quantityOnHand}`)
    }
    this.quantityOnHand -= quantity
  }
  return this.save()
}

// Method to reserve inventory (customer places order)
// This will reduce quantityOnShelf and increase quantityReserved
inventorySchema.methods.reserveInventory = function (quantity) {
  const available = this.quantityOnHand + this.quantityOnShelf - this.quantityReserved
  if (available < quantity) {
    throw new Error(`Insufficient available inventory to reserve. Available: ${available}, Requested: ${quantity}`)
  }

  // Priority: reserve from shelf first, then from warehouse
  if (this.quantityOnShelf >= quantity) {
    // Enough on shelf
    this.quantityOnShelf -= quantity
  } else {
    // Need to take from both shelf and warehouse
    const fromShelf = this.quantityOnShelf
    const fromWarehouse = quantity - fromShelf

    if (this.quantityOnHand < fromWarehouse) {
      throw new Error('Insufficient warehouse stock for reservation')
    }

    this.quantityOnShelf = 0
    this.quantityOnHand -= fromWarehouse
  }

  this.quantityReserved += quantity
  return this.save()
}

// Method to release reserved inventory (order cancelled before delivery)
// This will increase quantityOnShelf and decrease quantityReserved
inventorySchema.methods.releaseReservation = function (quantity, returnToShelf = true) {
  if (this.quantityReserved < quantity) {
    throw new Error('Cannot release more than reserved quantity')
  }
  this.quantityReserved -= quantity

  if (returnToShelf) {
    this.quantityOnShelf += quantity
  } else {
    this.quantityOnHand += quantity
  }

  return this.save()
}

// Method to complete delivery (reduce reserved quantity after successful delivery)
inventorySchema.methods.completeDelivery = function (quantity) {
  if (this.quantityReserved < quantity) {
    throw new Error('Cannot complete more than reserved quantity')
  }
  this.quantityReserved -= quantity
  return this.save()
}

// Method to move stock to shelf
inventorySchema.methods.moveToShelf = function (quantity) {
  if (this.quantityOnHand < quantity) {
    throw new Error(`Insufficient warehouse stock. Available in warehouse: ${this.quantityOnHand}`)
  }
  this.quantityOnHand -= quantity
  this.quantityOnShelf += quantity
  return this.save()
}

// Method to move stock back to warehouse (remove from shelf)
inventorySchema.methods.moveToWarehouse = function (quantity) {
  if (this.quantityOnShelf < quantity) {
    throw new Error('Cannot remove more than quantity on shelf')
  }
  this.quantityOnShelf -= quantity
  this.quantityOnHand += quantity
  return this.save()
}

// Static method to get products needing restock
inventorySchema.statics.getProductsNeedingRestock = async function () {
  const inventories = await this.find()
    .populate('product', 'productCode name vendor')
    .sort({ quantityOnHand: 1 })

  // Filter by virtual quantityAvailable
  return inventories.filter(inv => inv.quantityAvailable <= inv.reorderPoint)
}

// Static method to get inventory summary
inventorySchema.statics.getInventorySummary = async function () {
  const inventories = await this.find().populate('product', 'name')

  const stats = {
    totalProducts: inventories.length,
    totalOnHand: inventories.reduce((sum, inv) => sum + inv.quantityOnHand, 0),
    totalOnShelf: inventories.reduce((sum, inv) => sum + inv.quantityOnShelf, 0),
    totalReserved: inventories.reduce((sum, inv) => sum + inv.quantityReserved, 0),
    totalAvailable: inventories.reduce((sum, inv) => sum + inv.quantityAvailable, 0),
    totalQuantity: inventories.reduce((sum, inv) => sum + inv.totalQuantity, 0),
    productsNeedingRestock: inventories.filter(inv => inv.quantityAvailable <= inv.reorderPoint).length,
    productsOutOfStock: inventories.filter(inv => inv.quantityAvailable === 0).length
  }

  return stats
}

// Static method to get shelf stock summary
inventorySchema.statics.getShelfStockSummary = async function () {
  const inventories = await this.find()

  const stats = {
    totalOnShelf: inventories.reduce((sum, inv) => sum + inv.quantityOnShelf, 0),
    totalOnHand: inventories.reduce((sum, inv) => sum + inv.quantityOnHand, 0),
    totalAvailable: inventories.reduce((sum, inv) => sum + inv.quantityAvailable, 0),
    totalReserved: inventories.reduce((sum, inv) => sum + inv.quantityReserved, 0),
    productsOnShelf: inventories.filter(inv => inv.quantityOnShelf > 0).length
  }

  return stats
}

// Static method to find inventory by product
inventorySchema.statics.findByProduct = function (productId) {
  return this.findOne({ product: productId })
    .populate('product', 'productCode name vendor')
}

inventorySchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString()
    delete returnedObject._id
    delete returnedObject.__v
  }
})

module.exports = mongoose.model('Inventory', inventorySchema)
