const mongoose = require('mongoose');

/**
 * PurchaseOrder Model
 * Manages purchase orders from suppliers
 * References: Supplier (many-to-one), Employee (many-to-one)
 * Related: DetailPurchaseOrder (one-to-many)
 */
const purchaseOrderSchema = new mongoose.Schema({
  poNumber: {
    type: String,
    unique: true,
    uppercase: true,
    trim: true,
    match: [/^PO\d{10}$/, 'PO number must follow format PO2025000001']
    // Auto-generated in pre-save hook
  },

  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier',
    required: [true, 'Supplier is required']
  },

  orderDate: {
    type: Date,
    default: Date.now,
    required: [true, 'Order date is required']
  },

  expectedDeliveryDate: {
    type: Date,
    default: null,
    validate: {
      validator: function (value) {
        if (!value) return true;
        return value >= this.orderDate;
      },
      message: 'Expected delivery date must be after order date'
    }
  },

  shippingFee: {
    type: mongoose.Schema.Types.Decimal128,
    default: 0,
    min: [0, 'Shipping fee cannot be negative'],
    get: function (value) {
      if (value) {
        return parseFloat(value.toString());
      }
      return 0;
    }
  },

  discountPercentage: {
    type: mongoose.Schema.Types.Decimal128,
    default: 0,
    min: [0, 'Discount percentage cannot be negative'],
    max: [100, 'Discount percentage cannot exceed 100'],
    get: function (value) {
      if (value) {
        return parseFloat(value.toString());
      }
      return 0;
    }
  },

  totalPrice: {
    type: mongoose.Schema.Types.Decimal128,
    default: 0,
    min: [0, 'Total price cannot be negative'],
    get: function (value) {
      if (value) {
        return parseFloat(value.toString());
      }
      return 0;
    }
  },

  status: {
    type: String,
    enum: {
      values: ['pending', 'approved', 'received', 'cancelled'],
      message: '{VALUE} is not a valid status'
    },
    default: 'pending'
  },

  paymentStatus: {
    type: String,
    enum: {
      values: ['unpaid', 'partial', 'paid'],
      message: '{VALUE} is not a valid payment status'
    },
    default: 'unpaid'
  },

  notes: {
    type: String,
    trim: true,
    maxlength: [1000, 'Notes must be at most 1000 characters']
  },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true, getters: true },
  toObject: { virtuals: true, getters: true }
});

// ============ INDEXES ============
purchaseOrderSchema.index({ poNumber: 1 });
purchaseOrderSchema.index({ supplier: 1 });
purchaseOrderSchema.index({ status: 1 });
purchaseOrderSchema.index({ paymentStatus: 1 });
purchaseOrderSchema.index({ orderDate: -1 });
purchaseOrderSchema.index({ createdBy: 1 });

// ============ VIRTUALS ============
// Virtual: Purchase order details relationship
purchaseOrderSchema.virtual('details', {
  ref: 'DetailPurchaseOrder',
  localField: '_id',
  foreignField: 'purchaseOrder'
});

// Virtual: Calculate subtotal from details (when populated)
purchaseOrderSchema.virtual('subtotal').get(function () {
  if (this.details && Array.isArray(this.details)) {
    return this.details.reduce((sum, detail) => {
      const price = detail.unitPrice || 0;
      const quantity = detail.quantity || 0;
      return sum + (price * quantity);
    }, 0);
  }
  return 0;
});

// Virtual: Calculate discount amount
purchaseOrderSchema.virtual('discountAmount').get(function () {
  const subtotal = this.subtotal || 0;
  const discountPercent = this.discountPercentage || 0;
  return parseFloat((subtotal * (discountPercent / 100)).toFixed(2));
});

// Virtual: Check if order is overdue
purchaseOrderSchema.virtual('isOverdue').get(function () {
  if (!this.expectedDeliveryDate) return false;
  if (this.status === 'received' || this.status === 'cancelled') return false;
  return new Date() > this.expectedDeliveryDate;
});

// Virtual: Days until delivery
purchaseOrderSchema.virtual('daysUntilDelivery').get(function () {
  if (!this.expectedDeliveryDate) return null;
  if (this.status === 'received' || this.status === 'cancelled') return null;
  const today = new Date();
  const expected = new Date(this.expectedDeliveryDate);
  const diffTime = expected - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
});

// ============ MIDDLEWARE ============
// Auto-generate PO number before saving
purchaseOrderSchema.pre('save', async function (next) {
  if (!this.poNumber) {
    try {
      const currentYear = new Date().getFullYear();

      // Find the last PO number for the current year
      const lastPO = await this.constructor
        .findOne({ poNumber: new RegExp(`^PO${currentYear}`) })
        .sort({ poNumber: -1 })
        .select('poNumber')
        .lean();

      let sequenceNumber = 1;

      if (lastPO && lastPO.poNumber) {
        // Extract the sequence number from the last PO number
        const match = lastPO.poNumber.match(/\d{6}$/);
        if (match) {
          sequenceNumber = parseInt(match[0]) + 1;
        }
      }

      // Generate new PO number with 6-digit padding
      this.poNumber = `PO${currentYear}${String(sequenceNumber).padStart(6, '0')}`;
    } catch (error) {
      return next(error);
    }
  }
  next();
});

// ============ JSON TRANSFORMATION ============
purchaseOrderSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString();
    delete returnedObject._id;
    delete returnedObject.__v;

    // Convert Decimal128 to number
    if (returnedObject.shippingFee && typeof returnedObject.shippingFee === 'object') {
      returnedObject.shippingFee = parseFloat(returnedObject.shippingFee.toString());
    }
    if (returnedObject.discountPercentage && typeof returnedObject.discountPercentage === 'object') {
      returnedObject.discountPercentage = parseFloat(returnedObject.discountPercentage.toString());
    }
    if (returnedObject.totalPrice && typeof returnedObject.totalPrice === 'object') {
      returnedObject.totalPrice = parseFloat(returnedObject.totalPrice.toString());
    }
  }
});

module.exports = mongoose.model('PurchaseOrder', purchaseOrderSchema);
