const mongoose = require('mongoose');

/**
 * EmployeePOSAuth Model - Simplified
 * Manages POS PIN authentication for employees
 * 1-1 relationship with Employee (usually sales/cashier roles)
 */
const employeePOSAuthSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: [true, 'Employee is required'],
    unique: true  // 1-1 relationship
  },

  posPinHash: {
    type: String,
    required: [true, 'PIN hash is required'],
    select: false  // Security: Don't return by default
  },

  pinFailedAttempts: {
    type: Number,
    default: 0,
    min: 0,
    max: 5  // Hard limit - matches MAX_FAILED_ATTEMPTS in posAuthHelpers
  },

  pinLockedUntil: {
    type: Date,
    default: null  // null = not locked
  },

  posLastLogin: {
    type: Date,
    default: null
  },

  canAccessPOS: {
    type: Boolean,
    default: true
  }

}, {
  timestamps: true  // Auto adds createdAt, updatedAt
});

// Indexes for faster queries
employeePOSAuthSchema.index({ employee: 1 });
employeePOSAuthSchema.index({ canAccessPOS: 1 });
employeePOSAuthSchema.index({ posLastLogin: -1 });

// Virtual: Check if PIN is currently locked
employeePOSAuthSchema.virtual('isPinLocked').get(function () {
  return this.pinLockedUntil && this.pinLockedUntil > Date.now();
});

// Virtual: Minutes until unlock
employeePOSAuthSchema.virtual('minutesUntilUnlock').get(function () {
  if (!this.isPinLocked) return 0;
  return Math.ceil((this.pinLockedUntil - Date.now()) / 60000);
});

// JSON transformation
employeePOSAuthSchema.set('toJSON', {
  virtuals: true,
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString();
    delete returnedObject._id;
    delete returnedObject.__v;
    delete returnedObject.posPinHash;  // Never expose PIN hash in JSON
  }
});

module.exports = mongoose.model('EmployeePOSAuth', employeePOSAuthSchema);
