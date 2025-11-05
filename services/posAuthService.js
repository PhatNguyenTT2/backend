const bcrypt = require('bcrypt');
const EmployeePOSAuth = require('../models/employeePOSAuth');

/**
 * POS Authentication Service
 * Handles PIN-based authentication for POS system
 */

// Weak PINs that should not be allowed
const WEAK_PINS = [
  '1234', '0000', '1111', '2222', '3333', '4444',
  '5555', '6666', '7777', '8888', '9999',
  '1212', '2323', '4321'
];

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MINUTES = 15;

/**
 * Set or update PIN for an employee
 * @param {ObjectId} employeeId - Employee ID
 * @param {string} pin - 4-6 digit PIN
 * @returns {Promise<EmployeePOSAuth>}
 */
const setPosPin = async (employeeId, pin) => {
  // Validate PIN format
  if (!/^\d{4,6}$/.test(pin)) {
    throw new Error('PIN must be 4-6 digits only');
  }

  // Check for weak PINs
  if (WEAK_PINS.includes(pin)) {
    throw new Error('This PIN is too common. Please choose a more secure PIN');
  }

  // Hash the PIN
  const posPinHash = await bcrypt.hash(pin, 10);

  // Find or create POS auth record
  let posAuth = await EmployeePOSAuth.findOne({ employee: employeeId });

  if (posAuth) {
    // Update existing record
    posAuth.posPinHash = posPinHash;
    posAuth.pinLastChanged = Date.now();
    posAuth.pinExpiresAt = Date.now() + 90 * 24 * 60 * 60 * 1000; // 90 days
    posAuth.pinFailedAttempts = 0;
    posAuth.pinLockedUntil = null;
  } else {
    // Create new record
    posAuth = new EmployeePOSAuth({
      employee: employeeId,
      posPinHash,
      pinLastChanged: Date.now(),
      pinExpiresAt: Date.now() + 90 * 24 * 60 * 60 * 1000,
      canAccessPOS: true
    });
  }

  await posAuth.save();
  return posAuth;
};

/**
 * Verify PIN for an employee
 * @param {ObjectId} employeeId - Employee ID
 * @param {string} pin - PIN to verify
 * @returns {Promise<{success: boolean, posAuth: EmployeePOSAuth}>}
 */
const verifyPosPin = async (employeeId, pin) => {
  // Find POS auth record (include PIN hash)
  const posAuth = await EmployeePOSAuth.findOne({ employee: employeeId })
    .select('+posPinHash');

  if (!posAuth) {
    throw new Error('POS authentication not set up for this employee');
  }

  // Check if employee can access POS
  if (!posAuth.canAccessPOS) {
    throw new Error('POS access is disabled for this employee');
  }

  // Check if PIN is locked
  if (posAuth.pinLockedUntil && posAuth.pinLockedUntil > Date.now()) {
    const minutesLeft = Math.ceil((posAuth.pinLockedUntil - Date.now()) / 60000);
    throw new Error(`PIN locked. Try again in ${minutesLeft} minutes`);
  }

  // Check if PIN expired
  if (posAuth.pinExpiresAt && posAuth.pinExpiresAt < Date.now()) {
    throw new Error('PIN expired. Please contact admin to reset');
  }

  // Verify PIN
  const isValid = await bcrypt.compare(pin, posAuth.posPinHash);

  if (!isValid) {
    // Increment failed attempts
    posAuth.pinFailedAttempts += 1;

    // Lock after max failed attempts
    if (posAuth.pinFailedAttempts >= MAX_FAILED_ATTEMPTS) {
      posAuth.pinLockedUntil = Date.now() + LOCK_DURATION_MINUTES * 60 * 1000;
      await posAuth.save();
      throw new Error(`Too many failed attempts. PIN locked for ${LOCK_DURATION_MINUTES} minutes`);
    }

    await posAuth.save();
    throw new Error(`Invalid PIN. ${MAX_FAILED_ATTEMPTS - posAuth.pinFailedAttempts} attempts remaining`);
  }

  // Success: Reset failed attempts and update last login
  posAuth.pinFailedAttempts = 0;
  posAuth.pinLockedUntil = null;
  posAuth.posLastLogin = Date.now();
  await posAuth.save();

  return { success: true, posAuth };
};

/**
 * Check if employee can access POS
 * @param {ObjectId} employeeId - Employee ID
 * @returns {Promise<boolean>}
 */
const canAccessPOS = async (employeeId) => {
  const posAuth = await EmployeePOSAuth.findOne({ employee: employeeId });

  if (!posAuth) return false;

  return posAuth.canAccessPOS &&
    !posAuth.isPinExpired &&
    !posAuth.isPinLocked;
};

/**
 * Enable POS access for employee
 * @param {ObjectId} employeeId - Employee ID
 * @returns {Promise<EmployeePOSAuth>}
 */
const enablePOSAccess = async (employeeId) => {
  const posAuth = await EmployeePOSAuth.findOne({ employee: employeeId });

  if (!posAuth) {
    throw new Error('POS authentication not set up. Please set PIN first');
  }

  posAuth.canAccessPOS = true;
  posAuth.pinFailedAttempts = 0;
  posAuth.pinLockedUntil = null;
  await posAuth.save();

  return posAuth;
};

/**
 * Disable POS access for employee
 * @param {ObjectId} employeeId - Employee ID
 * @returns {Promise<EmployeePOSAuth>}
 */
const disablePOSAccess = async (employeeId) => {
  const posAuth = await EmployeePOSAuth.findOne({ employee: employeeId });

  if (!posAuth) {
    throw new Error('POS authentication not found');
  }

  posAuth.canAccessPOS = false;
  await posAuth.save();

  return posAuth;
};

/**
 * Reset PIN failed attempts (admin function)
 * @param {ObjectId} employeeId - Employee ID
 * @returns {Promise<EmployeePOSAuth>}
 */
const resetFailedAttempts = async (employeeId) => {
  const posAuth = await EmployeePOSAuth.findOne({ employee: employeeId });

  if (!posAuth) {
    throw new Error('POS authentication not found');
  }

  posAuth.pinFailedAttempts = 0;
  posAuth.pinLockedUntil = null;
  await posAuth.save();

  return posAuth;
};

/**
 * Get POS auth status for employee
 * @param {ObjectId} employeeId - Employee ID
 * @returns {Promise<Object>}
 */
const getPOSAuthStatus = async (employeeId) => {
  const posAuth = await EmployeePOSAuth.findOne({ employee: employeeId })
    .populate('employee', 'fullName');

  if (!posAuth) {
    return {
      hasAuth: false,
      canAccess: false,
      message: 'POS authentication not set up'
    };
  }

  return {
    hasAuth: true,
    canAccess: posAuth.canAccessPOS && !posAuth.isPinExpired && !posAuth.isPinLocked,
    isPinExpired: posAuth.isPinExpired,
    isPinLocked: posAuth.isPinLocked,
    failedAttempts: posAuth.pinFailedAttempts,
    minutesUntilUnlock: posAuth.minutesUntilUnlock,
    lastLogin: posAuth.posLastLogin,
    pinLastChanged: posAuth.pinLastChanged,
    pinExpiresAt: posAuth.pinExpiresAt
  };
};

/**
 * Get all employees with expired PINs
 * @returns {Promise<Array>}
 */
const getExpiredPINs = async () => {
  const now = Date.now();

  const expiredAuths = await EmployeePOSAuth.find({
    pinExpiresAt: { $lt: now },
    canAccessPOS: true
  }).populate('employee', 'fullName userAccount');

  return expiredAuths;
};

/**
 * Get all locked accounts
 * @returns {Promise<Array>}
 */
const getLockedAccounts = async () => {
  const now = Date.now();

  const lockedAuths = await EmployeePOSAuth.find({
    pinLockedUntil: { $gt: now }
  }).populate('employee', 'fullName userAccount');

  return lockedAuths;
};

module.exports = {
  setPosPin,
  verifyPosPin,
  canAccessPOS,
  enablePOSAccess,
  disablePOSAccess,
  resetFailedAttempts,
  getPOSAuthStatus,
  getExpiredPINs,
  getLockedAccounts
};
