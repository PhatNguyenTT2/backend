const mongoose = require('mongoose');

/**
 * Supplier Model
 * Manages supplier information and credit tracking
 * References: Used by PurchaseOrder
 */
const supplierSchema = new mongoose.Schema({
  supplierCode: {
    type: String,
    unique: true,
    uppercase: true,
    trim: true,
    match: [/^SUP\d{10}$/, 'Supplier code must follow format SUP2025000001']
    // Auto-generated in pre-save hook
  },

  companyName: {
    type: String,
    required: [true, 'Company name is required'],
    trim: true,
    maxlength: [200, 'Company name must be at most 200 characters']
  },

  phone: {
    type: String,
    trim: true,
    match: [/^[0-9]{10,15}$/, 'Please provide a valid phone number']
  },

  address: {
    type: String,
    trim: true,
    maxlength: [500, 'Address must be at most 500 characters']
  },

  accountNumber: {
    type: String,
    trim: true,
    maxlength: [50, 'Account number must be at most 50 characters']
  },

  paymentTerms: {
    type: String,
    enum: {
      values: ['cod', 'net15', 'net30', 'net60', 'net90'],
      message: '{VALUE} is not a valid payment term'
    },
    default: 'net30'
  },

  creditLimit: {
    type: mongoose.Schema.Types.Decimal128,
    default: 0,
    min: [0, 'Credit limit cannot be negative'],
    get: function (value) {
      if (value) {
        return parseFloat(value.toString());
      }
      return 0;
    }
  },

  currentDebt: {
    type: mongoose.Schema.Types.Decimal128,
    default: 0,
    min: [0, 'Current debt cannot be negative'],
    get: function (value) {
      if (value) {
        return parseFloat(value.toString());
      }
      return 0;
    }
  },

  isActive: {
    type: Boolean,
    default: true
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true, getters: true },
  toObject: { virtuals: true, getters: true }
});

// ============ INDEXES ============
supplierSchema.index({ supplierCode: 1 });
supplierSchema.index({ companyName: 'text' });
supplierSchema.index({ phone: 1 });
supplierSchema.index({ currentDebt: -1 });
supplierSchema.index({ isActive: 1 });

// ============ VIRTUALS ============
// Virtual: Purchase orders relationship
supplierSchema.virtual('purchaseOrders', {
  ref: 'PurchaseOrder',
  localField: '_id',
  foreignField: 'supplier'
});

// Virtual: Available credit
supplierSchema.virtual('availableCredit').get(function () {
  const creditLimit = this.creditLimit || 0;
  const currentDebt = this.currentDebt || 0;
  return parseFloat((creditLimit - currentDebt).toFixed(2));
});

// Virtual: Check if credit limit exceeded
supplierSchema.virtual('isCreditExceeded').get(function () {
  return this.currentDebt > this.creditLimit;
});

// Virtual: Credit utilization percentage
supplierSchema.virtual('creditUtilization').get(function () {
  const creditLimit = this.creditLimit || 0;
  const currentDebt = this.currentDebt || 0;

  if (creditLimit === 0) return 0;

  return parseFloat(((currentDebt / creditLimit) * 100).toFixed(2));
});

// Virtual: Payment terms in days
supplierSchema.virtual('paymentDays').get(function () {
  const termsMap = {
    'cod': 0,
    'net15': 15,
    'net30': 30,
    'net60': 60,
    'net90': 90
  };
  return termsMap[this.paymentTerms] || 30;
});

// ============ MIDDLEWARE ============
// Auto-generate supplier code before saving
supplierSchema.pre('save', async function (next) {
  if (!this.supplierCode) {
    try {
      const currentYear = new Date().getFullYear();

      // Find the last supplier code for the current year
      const lastSupplier = await this.constructor
        .findOne({ supplierCode: new RegExp(`^SUP${currentYear}`) })
        .sort({ supplierCode: -1 })
        .select('supplierCode')
        .lean();

      let sequenceNumber = 1;

      if (lastSupplier && lastSupplier.supplierCode) {
        // Extract the sequence number from the last supplier code
        const match = lastSupplier.supplierCode.match(/\d{6}$/);
        if (match) {
          sequenceNumber = parseInt(match[0]) + 1;
        }
      }

      // Generate new supplier code with 6-digit padding
      this.supplierCode = `SUP${currentYear}${String(sequenceNumber).padStart(6, '0')}`;
    } catch (error) {
      return next(error);
    }
  }
  next();
});

// ============ JSON TRANSFORMATION ============
supplierSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString();
    delete returnedObject._id;
    delete returnedObject.__v;

    // Convert Decimal128 to number
    if (returnedObject.creditLimit && typeof returnedObject.creditLimit === 'object') {
      returnedObject.creditLimit = parseFloat(returnedObject.creditLimit.toString());
    }
    if (returnedObject.currentDebt && typeof returnedObject.currentDebt === 'object') {
      returnedObject.currentDebt = parseFloat(returnedObject.currentDebt.toString());
    }
  }
});

module.exports = mongoose.model('Supplier', supplierSchema);
