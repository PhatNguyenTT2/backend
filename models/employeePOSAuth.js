const mongoose = require('mongoose');

const employeePOSAuthSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: [true, 'Employee is required'],
    unique: true
  },

  posPinHash: {
    type: String,
    required: [true, 'PIN hash is required'],
    select: false  // Don't return by default for security
  },

  pinFailedAttempts: {
    type: Number,
    default: 0,
    min: 0
  },

  pinLockedUntil: {
    type: Date,
    default: null
  },

  pinLastChanged: {
    type: Date,
    default: Date.now
  },

  pinExpiresAt: {
    type: Date,
    default: () => Date.now() + 90 * 24 * 60 * 60 * 1000  // 90 days from now
  },

  posLastLogin: {
    type: Date,
    default: null
  },

  posDeviceId: {
    type: String,
    trim: true,
    default: null
  },

  canAccessPOS: {
    type: Boolean,
    default: true
  }

}, {
  timestamps: true
});

// Indexes for faster queries
employeePOSAuthSchema.index({ employee: 1 });
employeePOSAuthSchema.index({ canAccessPOS: 1 });
employeePOSAuthSchema.index({ posLastLogin: -1 });
employeePOSAuthSchema.index({ pinLockedUntil: 1 });

// Virtual: Check if PIN is locked
employeePOSAuthSchema.virtual('isPinLocked').get(function () {
  return this.pinLockedUntil && this.pinLockedUntil > Date.now();
});

// Virtual: Check if PIN is expired
employeePOSAuthSchema.virtual('isPinExpired').get(function () {
  return this.pinExpiresAt && this.pinExpiresAt < Date.now();
});

// Virtual: Minutes until unlock
employeePOSAuthSchema.virtual('minutesUntilUnlock').get(function () {
  if (!this.isPinLocked) return 0;
  return Math.ceil((this.pinLockedUntil - Date.now()) / 60000);
});

employeePOSAuthSchema.set('toJSON', {
  virtuals: true,
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString();
    delete returnedObject._id;
    delete returnedObject.__v;
    delete returnedObject.posPinHash;  // Never expose PIN hash
  }
});

module.exports = mongoose.model('EmployeePOSAuth', employeePOSAuthSchema);
