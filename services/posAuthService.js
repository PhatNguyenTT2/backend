const bcrypt = require('bcrypt')
const EmployeePOSAuth = require('../models/employeePOSAuth')
const Employee = require('../models/employee')
const {
  getPOSSecuritySettings,
  isAccountLocked,
  formatPOSAuthRecord
} = require('../utils/posAuthHelpers')

/**
 * Get all POS auth records with filtering
 */
const getAllPOSAuthRecords = async (filters = {}) => {
  const { status, search } = filters

  // Get POS auth records with populated employee data
  const posAuthRecords = await EmployeePOSAuth.find({})
    .populate({
      path: 'employee',
      populate: {
        path: 'userAccount',
        select: 'userCode email role isActive',
        populate: {
          path: 'role',
          select: 'roleCode roleName'
        }
      }
    })
    .lean()

  // Filter out records without employee data
  let accessList = posAuthRecords
    .filter(record => record.employee)
    .map(formatPOSAuthRecord)

  // Apply search filter
  if (search) {
    const query = search.toLowerCase()
    accessList = accessList.filter(access => {
      const fullName = access.employee?.fullName?.toLowerCase() || ''
      const userCode = access.employee?.userAccount?.userCode?.toLowerCase() || ''
      return fullName.includes(query) || userCode.includes(query)
    })
  }

  // Filter by status
  if (status) {
    accessList = accessList.filter(access => {
      switch (status) {
        case 'active':
          return access.canAccessPOS && !access.isPinLocked
        case 'locked':
          return access.isPinLocked
        case 'denied':
          return !access.canAccessPOS
        default:
          return true
      }
    })
  }

  return accessList
}

/**
 * Get POS auth status for specific employee
 */
const getPOSAuthStatus = async (employeeId) => {
  const employee = await Employee.findById(employeeId)
    .populate({
      path: 'userAccount',
      select: 'userCode email role isActive'
    })

  if (!employee) {
    throw { statusCode: 404, message: 'Employee not found' }
  }

  const posAuth = await EmployeePOSAuth.findOne({ employee: employeeId })

  if (!posAuth) {
    return {
      hasAuth: false,
      canAccessPOS: false,
      employee: employee
    }
  }

  return {
    ...formatPOSAuthRecord(posAuth),
    hasAuth: true,
    employee: employee
  }
}

/**
 * Get available employees (without POS auth)
 * Only returns employees with Super Admin or Sales role
 */
const getAvailableEmployees = async (search = '') => {
  let employeeQuery = {}
  if (search) {
    employeeQuery.$or = [
      { fullName: { $regex: search, $options: 'i' } }
    ]
  }

  const employees = await Employee.find(employeeQuery)
    .populate({
      path: 'userAccount',
      select: 'userCode email role isActive',
      populate: {
        path: 'role',
        select: 'roleName'
      }
    })
    .lean()

  console.log(`[getAvailableEmployees] Total employees found: ${employees.length}`)

  // Get all existing POS auth employee IDs
  const posAuthRecords = await EmployeePOSAuth.find().select('employee').lean()
  const posAuthEmployeeIds = new Set(posAuthRecords.map(r => r.employee.toString()))

  console.log(`[getAvailableEmployees] POS auth records: ${posAuthEmployeeIds.size}`)

  // Filter: no POS auth, has active user account, and role is Super Admin or Sales
  const availableEmployees = employees.filter(emp => {
    const hasNoPosAuth = !posAuthEmployeeIds.has(emp._id.toString())
    const hasUserAccount = emp.userAccount !== null
    const isActive = emp.userAccount?.isActive === true
    const roleName = emp.userAccount?.role?.roleName
    const isAllowedRole = roleName === 'Super Admin' || roleName === 'Sales'

    console.log(`[Filter] ${emp.fullName}: hasNoPosAuth=${hasNoPosAuth}, hasUserAccount=${hasUserAccount}, isActive=${isActive}, role=${roleName}, isAllowedRole=${isAllowedRole}`)

    return hasNoPosAuth && hasUserAccount && isActive && isAllowedRole
  })

  console.log(`[getAvailableEmployees] Available employees after filter: ${availableEmployees.length}`)

  return availableEmployees
}/**
 * Grant POS access to employee
 */
const grantPOSAccess = async (employeeId, pin) => {
  // Check if employee exists and populate user account with role
  const employee = await Employee.findById(employeeId)
    .populate({
      path: 'userAccount',
      select: 'userCode email role isActive',
      populate: {
        path: 'role',
        select: 'roleName'
      }
    })

  if (!employee) {
    throw { statusCode: 404, message: 'Employee not found' }
  }

  // Validate user account exists and is active
  if (!employee.userAccount) {
    throw {
      statusCode: 400,
      message: 'Employee does not have a user account',
      code: 'NO_USER_ACCOUNT'
    }
  }

  if (!employee.userAccount.isActive) {
    throw {
      statusCode: 400,
      message: 'Employee user account is not active',
      code: 'INACTIVE_USER_ACCOUNT'
    }
  }

  // Validate role is Super Admin or Sales
  const roleName = employee.userAccount.role?.roleName
  if (roleName !== 'Super Admin' && roleName !== 'Sales') {
    throw {
      statusCode: 403,
      message: 'POS access can only be granted to Super Admin or Sales roles',
      code: 'INVALID_ROLE',
      details: { currentRole: roleName, allowedRoles: ['Super Admin', 'Sales'] }
    }
  }

  // Check if POS auth already exists
  const existingAuth = await EmployeePOSAuth.findOne({ employee: employeeId })
  if (existingAuth) {
    throw {
      statusCode: 409,
      message: 'POS access already granted to this employee',
      code: 'POS_AUTH_EXISTS'
    }
  }

  // Hash the PIN
  const saltRounds = 10
  const posPinHash = await bcrypt.hash(pin, saltRounds)

  // Create POS auth record
  const posAuth = new EmployeePOSAuth({
    employee: employeeId,
    posPinHash,
    canAccessPOS: true
  })

  await posAuth.save()

  // Populate employee data
  await posAuth.populate({
    path: 'employee',
    populate: {
      path: 'userAccount',
      select: 'userCode email role isActive',
      populate: {
        path: 'role',
        select: 'roleName'
      }
    }
  })

  return posAuth
}

/**
 * Update PIN for employee
 */
const updatePIN = async (employeeId, pin) => {
  const posAuth = await EmployeePOSAuth.findOne({ employee: employeeId })

  if (!posAuth) {
    throw {
      statusCode: 404,
      message: 'POS auth record not found',
      code: 'POS_AUTH_NOT_FOUND'
    }
  }

  // Hash new PIN
  const saltRounds = 10
  posAuth.posPinHash = await bcrypt.hash(pin, saltRounds)
  posAuth.pinFailedAttempts = 0
  posAuth.pinLockedUntil = null

  await posAuth.save()

  return { employeeId, pinUpdated: true }
}

/**
 * Enable POS access
 */
const enablePOSAccess = async (employeeId) => {
  const posAuth = await EmployeePOSAuth.findOne({ employee: employeeId })

  if (!posAuth) {
    throw {
      statusCode: 404,
      message: 'POS auth record not found. Please grant POS access first',
      code: 'POS_AUTH_NOT_FOUND'
    }
  }

  posAuth.canAccessPOS = true
  posAuth.pinFailedAttempts = 0
  posAuth.pinLockedUntil = null

  await posAuth.save()

  return posAuth
}

/**
 * Disable POS access
 */
const disablePOSAccess = async (employeeId) => {
  const posAuth = await EmployeePOSAuth.findOne({ employee: employeeId })

  if (!posAuth) {
    throw {
      statusCode: 404,
      message: 'POS auth record not found',
      code: 'POS_AUTH_NOT_FOUND'
    }
  }

  posAuth.canAccessPOS = false
  await posAuth.save()

  return posAuth
}

/**
 * Reset failed login attempts
 */
const resetFailedAttempts = async (employeeId) => {
  const posAuth = await EmployeePOSAuth.findOne({ employee: employeeId })

  if (!posAuth) {
    throw {
      statusCode: 404,
      message: 'POS auth record not found',
      code: 'POS_AUTH_NOT_FOUND'
    }
  }

  posAuth.pinFailedAttempts = 0
  posAuth.pinLockedUntil = null
  await posAuth.save()

  return {
    pinFailedAttempts: 0,
    isPinLocked: false
  }
}

/**
 * Revoke POS access (delete record)
 */
const revokePOSAccess = async (employeeId) => {
  const posAuth = await EmployeePOSAuth.findOne({ employee: employeeId })

  if (!posAuth) {
    throw {
      statusCode: 404,
      message: 'POS auth record not found',
      code: 'POS_AUTH_NOT_FOUND'
    }
  }

  await EmployeePOSAuth.findByIdAndDelete(posAuth._id)

  return { deleted: true }
}

/**
 * Get all locked accounts
 */
const getLockedAccounts = async () => {
  const now = Date.now()

  const lockedAuths = await EmployeePOSAuth.find({
    pinLockedUntil: { $gt: now }
  }).populate({
    path: 'employee',
    populate: {
      path: 'userAccount',
      select: 'userCode email role isActive'
    }
  })

  return lockedAuths
}

/**
 * Verify PIN for POS login
 */
const verifyPIN = async (employeeId, pin) => {
  // Find POS auth record with PIN hash
  const posAuth = await EmployeePOSAuth.findOne({ employee: employeeId })
    .select('+posPinHash')
    .populate({
      path: 'employee',
      populate: {
        path: 'userAccount',
        select: 'userCode email role isActive'
      }
    })

  if (!posAuth) {
    throw {
      statusCode: 404,
      message: 'POS authentication not set up for this employee',
      code: 'POS_AUTH_NOT_FOUND'
    }
  }

  // Check if employee can access POS
  if (!posAuth.canAccessPOS) {
    throw {
      statusCode: 403,
      message: 'POS access is disabled for this employee',
      code: 'ACCESS_DENIED'
    }
  }

  // Check if PIN is locked
  if (isAccountLocked(posAuth.pinLockedUntil)) {
    const minutesLeft = Math.ceil((posAuth.pinLockedUntil - Date.now()) / 60000)
    throw {
      statusCode: 423,
      message: `PIN locked. Try again in ${minutesLeft} minutes`,
      code: 'PIN_LOCKED',
      minutesLeft
    }
  }

  // Get security settings
  const securitySettings = await getPOSSecuritySettings();
  const MAX_FAILED_ATTEMPTS = securitySettings.maxFailedAttempts;
  const LOCK_DURATION_MINUTES = securitySettings.lockDurationMinutes;

  // Verify PIN
  const isValid = await bcrypt.compare(pin, posAuth.posPinHash)

  if (!isValid) {
    // Increment failed attempts
    posAuth.pinFailedAttempts += 1

    // Lock after max failed attempts
    if (posAuth.pinFailedAttempts >= MAX_FAILED_ATTEMPTS) {
      posAuth.pinLockedUntil = Date.now() + LOCK_DURATION_MINUTES * 60 * 1000
      await posAuth.save()

      throw {
        statusCode: 423,
        message: `Too many failed attempts. PIN locked for ${LOCK_DURATION_MINUTES} minutes`,
        code: 'PIN_LOCKED'
      }
    }

    await posAuth.save()

    throw {
      statusCode: 401,
      message: `Invalid PIN. ${MAX_FAILED_ATTEMPTS - posAuth.pinFailedAttempts} attempts remaining`,
      code: 'INVALID_PIN',
      attemptsRemaining: MAX_FAILED_ATTEMPTS - posAuth.pinFailedAttempts
    }
  }

  // Success: Reset failed attempts and update last login
  posAuth.pinFailedAttempts = 0
  posAuth.pinLockedUntil = null
  posAuth.posLastLogin = Date.now()
  await posAuth.save()

  return {
    employee: posAuth.employee,
    lastLogin: posAuth.posLastLogin
  }
}

module.exports = {
  getAllPOSAuthRecords,
  getPOSAuthStatus,
  getAvailableEmployees,
  grantPOSAccess,
  updatePIN,
  enablePOSAccess,
  disablePOSAccess,
  resetFailedAttempts,
  revokePOSAccess,
  getLockedAccounts,
  verifyPIN
}
