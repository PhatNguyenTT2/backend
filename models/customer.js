const mongoose = require('mongoose');

/**
 * Customer Model
 * Manages customer information and purchase history
 * Consolidated design: includes customer type and spending tracking
 */
const customerSchema = new mongoose.Schema({
  customerCode: {
    type: String,
    unique: true,
    uppercase: true,
    trim: true,
    match: [/^CUST\d{10}$/, 'Customer code must follow format CUST2025000001']
    // Auto-generated in pre-save hook - NOT required because it's auto-generated
  },

  fullName: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true,
    maxlength: [100, 'Full name must be at most 100 characters']
  },

  email: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
  },

  phone: {
    type: String,
    trim: true,
    match: [/^[0-9]{10,15}$/, 'Please provide a valid phone number']
  },

  address: {
    type: String,
    trim: true,
    maxlength: [200, 'Address must be at most 200 characters']
  },

  dateOfBirth: {
    type: Date,
    default: null,
    validate: {
      validator: function (value) {
        return !value || value < new Date();
      },
      message: 'Date of birth must be in the past'
    }
  },

  gender: {
    type: String,
    enum: {
      values: ['male', 'female', 'other'],
      message: '{VALUE} is not a valid gender'
    },
    lowercase: true
  },

  customerType: {
    type: String,
    enum: {
      values: ['guest', 'retail', 'wholesale', 'vip'],
      message: '{VALUE} is not a valid customer type'
    },
    default: 'guest'
  },

  totalSpent: {
    type: mongoose.Schema.Types.Decimal128,
    default: 0,
    min: [0, 'Total spent cannot be negative'],
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
customerSchema.index({ customerCode: 1 });
customerSchema.index({ fullName: 'text' });
customerSchema.index({ email: 1 });
customerSchema.index({ phone: 1 });
customerSchema.index({ customerType: 1 });
customerSchema.index({ totalSpent: -1 });
customerSchema.index({ isActive: 1 });

// ============ VIRTUALS ============
// Virtual: Orders relationship
customerSchema.virtual('orders', {
  ref: 'Order',
  localField: '_id',
  foreignField: 'customer'
});

// Virtual: Check if customer is VIP based on spending
customerSchema.virtual('isVIP').get(function () {
  return this.customerType === 'vip';
});

// Virtual: Check if customer qualifies for upgrade
customerSchema.virtual('qualifiesForUpgrade').get(function () {
  const spentAmount = this.totalSpent;
  if (this.customerType === 'guest' && spentAmount >= 1000000) return 'retail';
  if (this.customerType === 'retail' && spentAmount >= 5000000) return 'wholesale';
  if (this.customerType === 'wholesale' && spentAmount >= 10000000) return 'vip';
  return null;
});

// ============ MIDDLEWARE ============
/**
 * Pre-save hook: Auto-generate customerCode
 * Format: CUST[YEAR][SEQUENCE]
 * Example: CUST2025000001
 */
customerSchema.pre('save', async function (next) {
  if (this.isNew && !this.customerCode) {
    try {
      const Customer = mongoose.model('Customer');
      const currentYear = new Date().getFullYear();

      // Find the last customer code for the current year
      const lastCustomer = await Customer
        .findOne(
          { customerCode: new RegExp(`^CUST${currentYear}`) },
          { customerCode: 1 }
        )
        .sort({ customerCode: -1 })
        .lean();

      let sequenceNumber = 1;

      if (lastCustomer && lastCustomer.customerCode) {
        // Extract the sequence number from the last customer code
        const match = lastCustomer.customerCode.match(/\d{6}$/);
        if (match) {
          sequenceNumber = parseInt(match[0], 10) + 1;
        }
      }

      // Generate new customer code with 6-digit padding
      this.customerCode = `CUST${currentYear}${String(sequenceNumber).padStart(6, '0')}`;
    } catch (error) {
      return next(error);
    }
  }
  next();
});

// ============ JSON TRANSFORMATION ============
customerSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString();
    delete returnedObject._id;
    delete returnedObject.__v;

    // Convert Decimal128 to number
    if (returnedObject.totalSpent && typeof returnedObject.totalSpent === 'object') {
      returnedObject.totalSpent = parseFloat(returnedObject.totalSpent.toString());
    }
  }
});

module.exports = mongoose.model('Customer', customerSchema);
