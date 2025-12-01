const mongoose = require('mongoose');

/**
 * InventoryMovementBatch Model
 * Tracks inventory movements at batch level (ProductBatch)
 * References: ProductBatch, DetailInventory, PurchaseOrder, Employee
 * 
 * Movement Types:
 * - in: Nhập kho batch mới
 * - out: Xuất kho batch
 * - adjustment: Điều chỉnh số lượng batch
 * - transfer: Chuyển batch giữa các vị trí
 * - audit: Kiểm kê batch
 */
const inventoryMovementBatchSchema = new mongoose.Schema({
  movementNumber: {
    type: String,
    unique: true,
    uppercase: true,
    trim: true,
    match: [/^BATCHMOV\d{10}$/, 'Movement number must follow format BATCHMOV2025000001']
    // Auto-generated in pre-save hook
  },

  batchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProductBatch',
    required: [true, 'Batch ID is required']
  },

  inventoryDetail: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DetailInventory',
    required: [true, 'Inventory detail is required']
  },

  movementType: {
    type: String,
    enum: {
      values: ['in', 'out', 'adjustment', 'transfer', 'audit'],
      message: '{VALUE} is not a valid movement type'
    },
    required: [true, 'Movement type is required']
  },

  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    validate: {
      validator: function (value) {
        return value !== 0;
      },
      message: 'Quantity cannot be zero'
    }
  },

  reason: {
    type: String,
    trim: true,
    maxlength: [200, 'Reason must be at most 200 characters']
  },

  date: {
    type: Date,
    default: Date.now,
    required: [true, 'Date is required']
  },

  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  },

  purchaseOrderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PurchaseOrder',
    default: null
  },

  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Notes must be at most 500 characters']
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ============ INDEXES ============
inventoryMovementBatchSchema.index({ movementNumber: 1 });
inventoryMovementBatchSchema.index({ batchId: 1, date: -1 });
inventoryMovementBatchSchema.index({ inventoryDetail: 1, date: -1 });
inventoryMovementBatchSchema.index({ movementType: 1 });
inventoryMovementBatchSchema.index({ date: -1 });
inventoryMovementBatchSchema.index({ performedBy: 1 });
inventoryMovementBatchSchema.index({ purchaseOrderId: 1 });

// ============ VIRTUALS ============
// Virtual: Batch information
inventoryMovementBatchSchema.virtual('batch', {
  ref: 'ProductBatch',
  localField: 'batchId',
  foreignField: '_id',
  justOne: true
});

// Virtual: Product information (through batch)
inventoryMovementBatchSchema.virtual('product', {
  ref: 'Product',
  localField: 'batchId',
  foreignField: '_id',
  justOne: true
});

// ============ MIDDLEWARE ============
// Auto-generate movement number before saving
inventoryMovementBatchSchema.pre('save', async function (next) {
  if (!this.movementNumber) {
    try {
      const currentYear = new Date().getFullYear();

      // Find the last movement number for the current year
      const lastMovement = await this.constructor
        .findOne({ movementNumber: new RegExp(`^BATCHMOV${currentYear}`) })
        .sort({ movementNumber: -1 })
        .select('movementNumber')
        .lean();

      let sequenceNumber = 1;

      if (lastMovement && lastMovement.movementNumber) {
        // Extract the sequence number from the last movement number
        const match = lastMovement.movementNumber.match(/\d{6}$/);
        if (match) {
          sequenceNumber = parseInt(match[0]) + 1;
        }
      }

      // Generate new movement number with 6-digit padding
      this.movementNumber = `BATCHMOV${currentYear}${String(sequenceNumber).padStart(6, '0')}`;
    } catch (error) {
      return next(error);
    }
  }
  next();
});

// ============ JSON TRANSFORMATION ============
inventoryMovementBatchSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString();
    delete returnedObject._id;
    delete returnedObject.__v;
  }
});

module.exports = mongoose.model('InventoryMovementBatch', inventoryMovementBatchSchema);