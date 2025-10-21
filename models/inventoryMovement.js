const mongoose = require('mongoose')

const inventoryMovementSchema = new mongoose.Schema({
  movementNumber: {
    type: String,
    unique: true,
    // Auto-generate: INV2025000001
  },

  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'Product is required']
  },

  inventory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Inventory',
    required: [true, 'Inventory is required']
  },

  purchaseOrderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PurchaseOrder',
    default: null
  },

  movementType: {
    type: String,
    enum: {
      values: ['in', 'out', 'adjustment', 'reserved', 'released'],
      message: '{VALUE} is not a valid movement type'
    },
    required: [true, 'Movement type is required']
  },

  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    validate: {
      validator: function (value) {
        return value !== 0
      },
      message: 'Quantity cannot be zero'
    }
  },

  reason: {
    type: String,
    trim: true
  },

  date: {
    type: Date,
    default: Date.now,
    required: true
  },

  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  notes: {
    type: String,
    trim: true
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
})

// Indexes for faster queries
inventoryMovementSchema.index({ movementNumber: 1 })
inventoryMovementSchema.index({ product: 1, date: -1 })
inventoryMovementSchema.index({ inventory: 1, date: -1 })
inventoryMovementSchema.index({ movementType: 1 })
inventoryMovementSchema.index({ purchaseOrderId: 1 })

// Pre-save hook to generate movement number
inventoryMovementSchema.pre('save', async function (next) {
  if (this.isNew && !this.movementNumber) {
    const year = new Date().getFullYear()
    const count = await mongoose.model('InventoryMovement').countDocuments()
    this.movementNumber = `INV${year}${String(count + 1).padStart(6, '0')}`
  }
  next()
})

// Static method to create movement and update inventory
inventoryMovementSchema.statics.createMovementAndUpdateInventory = async function (movementData) {
  const Inventory = mongoose.model('Inventory')
  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    // Create movement record
    const movement = new this(movementData)
    await movement.save({ session })

    // Update inventory based on movement type
    const inventory = await Inventory.findById(movementData.inventory).session(session)

    if (!inventory) {
      throw new Error('Inventory not found')
    }

    switch (movementData.movementType) {
      case 'in':
        inventory.quantityOnHand += Math.abs(movementData.quantity)
        break
      case 'out':
        if (inventory.quantityOnHand < Math.abs(movementData.quantity)) {
          throw new Error('Insufficient inventory')
        }
        inventory.quantityOnHand -= Math.abs(movementData.quantity)
        break
      case 'adjustment':
        inventory.quantityOnHand = Math.abs(movementData.quantity)
        break
      case 'reserved':
        if (inventory.quantityAvailable < Math.abs(movementData.quantity)) {
          throw new Error('Insufficient available inventory to reserve')
        }
        inventory.quantityReserved += Math.abs(movementData.quantity)
        break
      case 'released':
        if (inventory.quantityReserved < Math.abs(movementData.quantity)) {
          throw new Error('Cannot release more than reserved')
        }
        inventory.quantityReserved -= Math.abs(movementData.quantity)
        break
    }

    // Update quantityAvailable
    inventory.quantityAvailable = inventory.quantityOnHand - inventory.quantityReserved
    await inventory.save({ session })

    await session.commitTransaction()
    return movement
  } catch (error) {
    await session.abortTransaction()
    throw error
  } finally {
    session.endSession()
  }
}

// Static method to get movement history for a product
inventoryMovementSchema.statics.getProductHistory = function (productId, options = {}) {
  const { startDate, endDate, movementType, limit = 50 } = options

  const query = { product: productId }

  if (startDate || endDate) {
    query.date = {}
    if (startDate) query.date.$gte = new Date(startDate)
    if (endDate) query.date.$lte = new Date(endDate)
  }

  if (movementType) {
    query.movementType = movementType
  }

  return this.find(query)
    .populate('performedBy', 'username fullName')
    .populate('purchaseOrderId', 'poNumber')
    .sort({ date: -1 })
    .limit(limit)
}

inventoryMovementSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString()
    delete returnedObject._id
    delete returnedObject.__v
  }
})

module.exports = mongoose.model('InventoryMovement', inventoryMovementSchema)
