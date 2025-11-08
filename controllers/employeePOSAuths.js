const employeePOSAuthsRouter = require('express').Router()
const EmployeePOSAuth = require('../models/employeePOSAuth')
const Employee = require('../models/employee')
const bcrypt = require('bcrypt')
const mongoose = require('mongoose')

// Weak PINs that should not be allowed
const WEAK_PINS = [
  '1234', '0000', '1111', '2222', '3333', '4444',
  '5555', '6666', '7777', '8888', '9999',
  '1212', '2323', '4321'
]

const MAX_FAILED_ATTEMPTS = 5
const LOCK_DURATION_MINUTES = 15

/**
 * @route   GET /api/pos-auth
 * @desc    Get all POS auth records with employee details
 * @access  Private (Admin only)
 * @query   status: string - Filter by status (active, locked, denied)
 * @query   search: string - Search by employee name or user code
 */
employeePOSAuthsRouter.get('/', async (request, response) => {
  try {
    const { status, search } = request.query

    // Get all employees with their user accounts
    let employeeQuery = {}
    if (search) {
      employeeQuery.$or = [
        { fullName: { $regex: search, $options: 'i' } }
      ]
    }

    const employees = await Employee.find(employeeQuery)
      .populate({
        path: 'userAccount',
        select: 'userCode email role isActive'
      })
      .lean()

    // Get all POS auth records
    const posAuthRecords = await EmployeePOSAuth.find()
      .populate({
        path: 'employee',
        populate: {
          path: 'userAccount',
          select: 'userCode email role isActive'
        }
      })
      .lean()

    // Create a map of employee IDs to POS auth records
    const posAuthMap = new Map()
    posAuthRecords.forEach(record => {
      if (record.employee) {
        posAuthMap.set(record.employee._id.toString(), record)
      }
    })

    // Build complete access list
    let accessList = employees.map(emp => {
      const posAuth = posAuthMap.get(emp._id.toString())

      if (posAuth) {
        return {
          id: posAuth._id,
          employee: emp,
          canAccessPOS: posAuth.canAccessPOS,
          pinFailedAttempts: posAuth.pinFailedAttempts,
          pinLockedUntil: posAuth.pinLockedUntil,
          posLastLogin: posAuth.posLastLogin,
          isPinLocked: posAuth.isPinLocked,
          minutesUntilUnlock: posAuth.minutesUntilUnlock,
          createdAt: posAuth.createdAt,
          updatedAt: posAuth.updatedAt
        }
      } else {
        return {
          id: `no-auth-${emp._id}`,
          employee: emp,
          canAccessPOS: false,
          pinFailedAttempts: 0,
          pinLockedUntil: null,
          posLastLogin: null,
          isPinLocked: false,
          minutesUntilUnlock: 0,
          createdAt: null,
          updatedAt: null
        }
      }
    })

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

    response.json({
      success: true,
      data: accessList
    })
  } catch (error) {
    console.error('Error fetching POS auth records:', error)
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch POS auth records',
        details: error.message
      }
    })
  }
})

/**
 * @route   GET /api/pos-auth/:employeeId
 * @desc    Get POS auth status for specific employee
 * @access  Private (Admin only)
 */
employeePOSAuthsRouter.get('/:employeeId', async (request, response) => {
  try {
    const { employeeId } = request.params

    if (!mongoose.Types.ObjectId.isValid(employeeId)) {
      return response.status(400).json({
        success: false,
        error: { message: 'Invalid employee ID' }
      })
    }

    const employee = await Employee.findById(employeeId)
      .populate({
        path: 'userAccount',
        select: 'userCode email role isActive'
      })

    if (!employee) {
      return response.status(404).json({
        success: false,
        error: { message: 'Employee not found' }
      })
    }

    const posAuth = await EmployeePOSAuth.findOne({ employee: employeeId })

    if (!posAuth) {
      return response.json({
        success: true,
        data: {
          hasAuth: false,
          canAccessPOS: false,
          employee: employee
        }
      })
    }

    response.json({
      success: true,
      data: {
        id: posAuth._id,
        hasAuth: true,
        canAccessPOS: posAuth.canAccessPOS,
        pinFailedAttempts: posAuth.pinFailedAttempts,
        pinLockedUntil: posAuth.pinLockedUntil,
        posLastLogin: posAuth.posLastLogin,
        isPinLocked: posAuth.isPinLocked,
        minutesUntilUnlock: posAuth.minutesUntilUnlock,
        createdAt: posAuth.createdAt,
        updatedAt: posAuth.updatedAt,
        employee: employee
      }
    })
  } catch (error) {
    console.error('Error fetching POS auth status:', error)
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch POS auth status',
        details: error.message
      }
    })
  }
})

/**
 * @route   POST /api/pos-auth
 * @desc    Grant POS access to employee (create POS auth record)
 * @access  Private (Admin only)
 * @body    { employeeId, pin }
 */
employeePOSAuthsRouter.post('/', async (request, response) => {
  try {
    const { employeeId, pin } = request.body

    // Validate required fields
    if (!employeeId || !pin) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Missing required fields',
          code: 'MISSING_FIELDS',
          details: { required: ['employeeId', 'pin'] }
        }
      })
    }

    if (!mongoose.Types.ObjectId.isValid(employeeId)) {
      return response.status(400).json({
        success: false,
        error: { message: 'Invalid employee ID' }
      })
    }

    // Validate PIN format
    if (!/^\d{4,6}$/.test(pin)) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'PIN must be 4-6 digits only',
          code: 'INVALID_PIN_FORMAT'
        }
      })
    }

    // Check for weak PINs
    if (WEAK_PINS.includes(pin)) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'This PIN is too common. Please choose a more secure PIN',
          code: 'WEAK_PIN'
        }
      })
    }

    // Check if employee exists
    const employee = await Employee.findById(employeeId)
    if (!employee) {
      return response.status(404).json({
        success: false,
        error: { message: 'Employee not found' }
      })
    }

    // Check if POS auth already exists
    const existingAuth = await EmployeePOSAuth.findOne({ employee: employeeId })
    if (existingAuth) {
      return response.status(409).json({
        success: false,
        error: {
          message: 'POS access already granted to this employee',
          code: 'POS_AUTH_EXISTS'
        }
      })
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
        select: 'userCode email role isActive'
      }
    })

    response.status(201).json({
      success: true,
      data: posAuth,
      message: 'POS access granted successfully'
    })
  } catch (error) {
    console.error('Error granting POS access:', error)

    if (error.name === 'ValidationError') {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: error.errors
        }
      })
    }

    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to grant POS access',
        details: error.message
      }
    })
  }
})

/**
 * @route   PUT /api/pos-auth/:employeeId/pin
 * @desc    Update PIN for employee
 * @access  Private (Admin only)
 * @body    { pin }
 */
employeePOSAuthsRouter.put('/:employeeId/pin', async (request, response) => {
  try {
    const { employeeId } = request.params
    const { pin } = request.body

    if (!mongoose.Types.ObjectId.isValid(employeeId)) {
      return response.status(400).json({
        success: false,
        error: { message: 'Invalid employee ID' }
      })
    }

    // Validate PIN format
    if (!pin || !/^\d{4,6}$/.test(pin)) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'PIN must be 4-6 digits only',
          code: 'INVALID_PIN_FORMAT'
        }
      })
    }

    // Check for weak PINs
    if (WEAK_PINS.includes(pin)) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'This PIN is too common. Please choose a more secure PIN',
          code: 'WEAK_PIN'
        }
      })
    }

    const posAuth = await EmployeePOSAuth.findOne({ employee: employeeId })

    if (!posAuth) {
      return response.status(404).json({
        success: false,
        error: {
          message: 'POS auth record not found',
          code: 'POS_AUTH_NOT_FOUND'
        }
      })
    }

    // Hash new PIN
    const saltRounds = 10
    posAuth.posPinHash = await bcrypt.hash(pin, saltRounds)
    posAuth.pinFailedAttempts = 0
    posAuth.pinLockedUntil = null

    await posAuth.save()

    response.json({
      success: true,
      message: 'PIN updated successfully',
      data: {
        employeeId,
        pinUpdated: true
      }
    })
  } catch (error) {
    console.error('Error updating PIN:', error)
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to update PIN',
        details: error.message
      }
    })
  }
})

/**
 * @route   PUT /api/pos-auth/:employeeId/enable
 * @desc    Enable POS access for employee
 * @access  Private (Admin only)
 */
employeePOSAuthsRouter.put('/:employeeId/enable', async (request, response) => {
  try {
    const { employeeId } = request.params

    if (!mongoose.Types.ObjectId.isValid(employeeId)) {
      return response.status(400).json({
        success: false,
        error: { message: 'Invalid employee ID' }
      })
    }

    const posAuth = await EmployeePOSAuth.findOne({ employee: employeeId })

    if (!posAuth) {
      return response.status(404).json({
        success: false,
        error: {
          message: 'POS auth record not found. Please grant POS access first',
          code: 'POS_AUTH_NOT_FOUND'
        }
      })
    }

    posAuth.canAccessPOS = true
    posAuth.pinFailedAttempts = 0
    posAuth.pinLockedUntil = null

    await posAuth.save()

    response.json({
      success: true,
      data: posAuth,
      message: 'POS access enabled successfully'
    })
  } catch (error) {
    console.error('Error enabling POS access:', error)
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to enable POS access',
        details: error.message
      }
    })
  }
})

/**
 * @route   PUT /api/pos-auth/:employeeId/disable
 * @desc    Disable POS access for employee
 * @access  Private (Admin only)
 */
employeePOSAuthsRouter.put('/:employeeId/disable', async (request, response) => {
  try {
    const { employeeId } = request.params

    if (!mongoose.Types.ObjectId.isValid(employeeId)) {
      return response.status(400).json({
        success: false,
        error: { message: 'Invalid employee ID' }
      })
    }

    const posAuth = await EmployeePOSAuth.findOne({ employee: employeeId })

    if (!posAuth) {
      return response.status(404).json({
        success: false,
        error: {
          message: 'POS auth record not found',
          code: 'POS_AUTH_NOT_FOUND'
        }
      })
    }

    posAuth.canAccessPOS = false

    await posAuth.save()

    response.json({
      success: true,
      data: posAuth,
      message: 'POS access disabled successfully'
    })
  } catch (error) {
    console.error('Error disabling POS access:', error)
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to disable POS access',
        details: error.message
      }
    })
  }
})

/**
 * @route   POST /api/pos-auth/:employeeId/reset-attempts
 * @desc    Reset failed login attempts and unlock account
 * @access  Private (Admin only)
 */
employeePOSAuthsRouter.post('/:employeeId/reset-attempts', async (request, response) => {
  try {
    const { employeeId } = request.params

    if (!mongoose.Types.ObjectId.isValid(employeeId)) {
      return response.status(400).json({
        success: false,
        error: { message: 'Invalid employee ID' }
      })
    }

    const posAuth = await EmployeePOSAuth.findOne({ employee: employeeId })

    if (!posAuth) {
      return response.status(404).json({
        success: false,
        error: {
          message: 'POS auth record not found',
          code: 'POS_AUTH_NOT_FOUND'
        }
      })
    }

    posAuth.pinFailedAttempts = 0
    posAuth.pinLockedUntil = null

    await posAuth.save()

    response.json({
      success: true,
      data: {
        pinFailedAttempts: 0,
        isPinLocked: false
      },
      message: 'Failed attempts reset and account unlocked successfully'
    })
  } catch (error) {
    console.error('Error resetting attempts:', error)
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to reset attempts',
        details: error.message
      }
    })
  }
})

/**
 * @route   DELETE /api/pos-auth/:employeeId
 * @desc    Revoke POS access (delete POS auth record)
 * @access  Private (Admin only)
 */
employeePOSAuthsRouter.delete('/:employeeId', async (request, response) => {
  try {
    const { employeeId } = request.params

    if (!mongoose.Types.ObjectId.isValid(employeeId)) {
      return response.status(400).json({
        success: false,
        error: { message: 'Invalid employee ID' }
      })
    }

    const posAuth = await EmployeePOSAuth.findOne({ employee: employeeId })

    if (!posAuth) {
      return response.status(404).json({
        success: false,
        error: {
          message: 'POS auth record not found',
          code: 'POS_AUTH_NOT_FOUND'
        }
      })
    }

    await EmployeePOSAuth.findByIdAndDelete(posAuth._id)

    response.json({
      success: true,
      message: 'POS access revoked successfully'
    })
  } catch (error) {
    console.error('Error revoking POS access:', error)
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to revoke POS access',
        details: error.message
      }
    })
  }
})

/**
 * @route   GET /api/pos-auth/locked
 * @desc    Get all locked POS accounts
 * @access  Private (Admin only)
 */
employeePOSAuthsRouter.get('/status/locked', async (request, response) => {
  try {
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

    response.json({
      success: true,
      data: lockedAuths
    })
  } catch (error) {
    console.error('Error fetching locked accounts:', error)
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch locked accounts',
        details: error.message
      }
    })
  }
})

/**
 * @route   POST /api/pos-auth/verify-pin
 * @desc    Verify PIN for POS login (used by POS system)
 * @access  Public (POS Login)
 * @body    { employeeId, pin }
 */
employeePOSAuthsRouter.post('/verify-pin', async (request, response) => {
  try {
    const { employeeId, pin } = request.body

    if (!employeeId || !pin) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Employee ID and PIN are required',
          code: 'MISSING_FIELDS'
        }
      })
    }

    if (!mongoose.Types.ObjectId.isValid(employeeId)) {
      return response.status(400).json({
        success: false,
        error: { message: 'Invalid employee ID' }
      })
    }

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
      return response.status(404).json({
        success: false,
        error: {
          message: 'POS authentication not set up for this employee',
          code: 'POS_AUTH_NOT_FOUND'
        }
      })
    }

    // Check if employee can access POS
    if (!posAuth.canAccessPOS) {
      return response.status(403).json({
        success: false,
        error: {
          message: 'POS access is disabled for this employee',
          code: 'ACCESS_DENIED'
        }
      })
    }

    // Check if PIN is locked
    if (posAuth.pinLockedUntil && posAuth.pinLockedUntil > Date.now()) {
      const minutesLeft = Math.ceil((posAuth.pinLockedUntil - Date.now()) / 60000)
      return response.status(423).json({
        success: false,
        error: {
          message: `PIN locked. Try again in ${minutesLeft} minutes`,
          code: 'PIN_LOCKED',
          minutesLeft
        }
      })
    }

    // Verify PIN
    const isValid = await bcrypt.compare(pin, posAuth.posPinHash)

    if (!isValid) {
      // Increment failed attempts
      posAuth.pinFailedAttempts += 1

      // Lock after max failed attempts
      if (posAuth.pinFailedAttempts >= MAX_FAILED_ATTEMPTS) {
        posAuth.pinLockedUntil = Date.now() + LOCK_DURATION_MINUTES * 60 * 1000
        await posAuth.save()

        return response.status(423).json({
          success: false,
          error: {
            message: `Too many failed attempts. PIN locked for ${LOCK_DURATION_MINUTES} minutes`,
            code: 'PIN_LOCKED'
          }
        })
      }

      await posAuth.save()

      return response.status(401).json({
        success: false,
        error: {
          message: `Invalid PIN. ${MAX_FAILED_ATTEMPTS - posAuth.pinFailedAttempts} attempts remaining`,
          code: 'INVALID_PIN',
          attemptsRemaining: MAX_FAILED_ATTEMPTS - posAuth.pinFailedAttempts
        }
      })
    }

    // Success: Reset failed attempts and update last login
    posAuth.pinFailedAttempts = 0
    posAuth.pinLockedUntil = null
    posAuth.posLastLogin = Date.now()
    await posAuth.save()

    response.json({
      success: true,
      data: {
        employee: posAuth.employee,
        lastLogin: posAuth.posLastLogin
      },
      message: 'PIN verified successfully'
    })
  } catch (error) {
    console.error('Error verifying PIN:', error)
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to verify PIN',
        details: error.message
      }
    })
  }
})

module.exports = employeePOSAuthsRouter
