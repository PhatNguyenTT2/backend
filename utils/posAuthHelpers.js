/**
 * Helper functions for POS Authentication
 */

const WEAK_PINS = [
  '1234', '0000', '1111', '2222', '3333', '4444',
  '5555', '6666', '7777', '8888', '9999',
  '1212', '2323', '4321'
]

const MAX_FAILED_ATTEMPTS = 5
const LOCK_DURATION_MINUTES = 15

/**
 * Check if PIN is weak
 */
const isWeakPIN = (pin) => {
  return WEAK_PINS.includes(pin)
}

/**
 * Validate PIN format
 */
const isValidPINFormat = (pin) => {
  return /^\d{4,6}$/.test(pin)
}

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
  MAX_FAILED_ATTEMPTS,
  LOCK_DURATION_MINUTES,
  isWeakPIN,
  isValidPINFormat,
  getMinutesUntilUnlock,
  isAccountLocked,
  formatPOSAuthRecord
}
