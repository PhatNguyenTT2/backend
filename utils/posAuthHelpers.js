/**
 * Helper functions for POS Authentication
 */

const SystemSettings = require('../models/systemSettings');

const WEAK_PINS = [
  '1234', '0000', '1111', '2222', '3333', '4444',
  '5555', '6666', '7777', '8888', '9999',
  '1212', '2323', '4321'
];

// Default fallback values if settings not configured
const DEFAULT_MAX_FAILED_ATTEMPTS = 5;
const DEFAULT_LOCK_DURATION_MINUTES = 15;

/**
 * Get POS security settings from database
 * Returns configured values or defaults if not set
 */
const getPOSSecuritySettings = async () => {
  try {
    const settings = await SystemSettings.getPOSSecurity();
    return {
      maxFailedAttempts: settings.maxFailedAttempts || DEFAULT_MAX_FAILED_ATTEMPTS,
      lockDurationMinutes: settings.lockDurationMinutes || DEFAULT_LOCK_DURATION_MINUTES
    };
  } catch (error) {
    console.error('⚠️ Error getting POS security settings, using defaults:', error.message);
    return {
      maxFailedAttempts: DEFAULT_MAX_FAILED_ATTEMPTS,
      lockDurationMinutes: DEFAULT_LOCK_DURATION_MINUTES
    };
  }
};

/**
 * Check if PIN is weak
 */
const isWeakPIN = (pin) => {
  return WEAK_PINS.includes(pin);
};

/**
 * Validate PIN format
 * Fixed PIN length range of 4-6 digits
 */
const isValidPINFormat = (pin) => {
  // PIN must be 4-6 digits
  const regex = /^\d{4,6}$/;
  return regex.test(pin);
};

/**
 * Calculate minutes until unlock
 */
const getMinutesUntilUnlock = (lockedUntil) => {
  if (!lockedUntil || lockedUntil <= Date.now()) {
    return 0
  }
  return Math.ceil((lockedUntil - Date.now()) / 60000)
}

/**
 * Check if account is currently locked
 */
const isAccountLocked = (pinLockedUntil) => {
  return pinLockedUntil && pinLockedUntil > Date.now()
}

/**
 * Format POS auth record for response
 */
const formatPOSAuthRecord = (posAuth) => {
  return {
    id: posAuth._id,
    employee: posAuth.employee,
    canAccessPOS: posAuth.canAccessPOS,
    pinFailedAttempts: posAuth.pinFailedAttempts,
    pinLockedUntil: posAuth.pinLockedUntil,
    posLastLogin: posAuth.posLastLogin,
    isPinLocked: isAccountLocked(posAuth.pinLockedUntil),
    minutesUntilUnlock: getMinutesUntilUnlock(posAuth.pinLockedUntil),
    createdAt: posAuth.createdAt,
    updatedAt: posAuth.updatedAt
  }
}

module.exports = {
  WEAK_PINS,
  DEFAULT_MAX_FAILED_ATTEMPTS,
  DEFAULT_LOCK_DURATION_MINUTES,
  getPOSSecuritySettings,
  isWeakPIN,
  isValidPINFormat,
  getMinutesUntilUnlock,
  isAccountLocked,
  formatPOSAuthRecord
}
