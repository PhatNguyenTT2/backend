const employeesRouter = require('express').Router()
const Employee = require('../models/employee')
const UserAccount = require('../models/userAccount')
const EmployeePOSAuth = require('../models/employeePOSAuth')
const bcrypt = require('bcrypt')
const mongoose = require('mongoose')

/**
 * @route   GET /api/employees
 * @desc    Get all employees (with optional filters)
 * @access  Private (Admin/Manager)
 * @query   search: string - Search by name or phone
 * @query   isActive: boolean - Filter by user account active status
 */
employeesRouter.get('/', async (request, response) => {
  try {
    const { search, isActive } = request.query

    let query = {}

    // Build search query
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ]
    }

    // Get all employees with populated userAccount
    let employees = await Employee.find(query)
      .populate({
        path: 'userAccount',
        select: 'username email userCode role isActive lastLogin createdAt updatedAt',
        populate: {
          path: 'role',
          select: 'roleName permissions'
        }
      })
      .sort({ createdAt: -1 })
      .limit(search ? 20 : undefined)

    // Filter by user account active status if provided
    if (isActive !== undefined) {
      const activeFilter = isActive === 'true'
      employees = employees.filter(emp =>
        emp.userAccount && emp.userAccount.isActive === activeFilter
      )
    }

    response.json({
      success: true,
      data: {
        employees,
        count: employees.length
      }
    })
  } catch (error) {
    console.error('Error in getAll employees:', error)
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch employees',
        details: error.message
      }
    })
  }
})

/**
 * @route   GET /api/employees/:id
 * @desc    Get employee by ID
 * @access  Private
 */
employeesRouter.get('/:id', async (request, response) => {
  try {
    const employee = await Employee.findById(request.params.id)
      .populate({
        path: 'userAccount',
        select: 'username email userCode role isActive lastLogin createdAt updatedAt',
        populate: {
          path: 'role',
          select: 'roleName permissions'
        }
      })

    if (!employee) {
      return response.status(404).json({
        success: false,
        error: {
          message: 'Employee not found',
          code: 'EMPLOYEE_NOT_FOUND'
        }
      })
    }

    response.json({
      success: true,
      data: { employee }
    })
  } catch (error) {
    console.error('Error in getById employee:', error)
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch employee',
        details: error.message
      }
    })
  }
})

/**
 * @route   POST /api/employees
 * @desc    Create new employee with user account (all-in-one)
 * @access  Private (Admin only)
 * @body    { 
 *            userData: { username, email, password, role },
 *            employeeData: { fullName, phone, address, dateOfBirth }
 *          }
 */
employeesRouter.post('/', async (request, response) => {
  try {
    const { userData, employeeData } = request.body

    // Validate required fields
    if (!userData || !employeeData) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Missing required fields',
          code: 'MISSING_FIELDS',
          details: {
            required: ['userData', 'employeeData']
          }
        }
      })
    }

    if (!userData.username || !userData.email || !userData.password || !userData.role) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Missing required user data fields',
          code: 'MISSING_USER_FIELDS',
          details: {
            required: ['username', 'email', 'password', 'role']
          }
        }
      })
    }

    if (!employeeData.fullName) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Missing required employee data fields',
          code: 'MISSING_EMPLOYEE_FIELDS',
          details: {
            required: ['fullName']
          }
        }
      })
    }

    // Hash password
    const saltRounds = 10
    const passwordHash = await bcrypt.hash(userData.password, saltRounds)

    // Start transaction
    const session = await mongoose.startSession()
    session.startTransaction()

    try {
      // Create user account
      const userAccount = new UserAccount({
        username: userData.username,
        email: userData.email,
        passwordHash,
        role: userData.role,
        isActive: userData.isActive !== undefined ? userData.isActive : true
      })
      await userAccount.save({ session })

      // Create employee profile
      const employee = new Employee({
        ...employeeData,
        userAccount: userAccount._id
      })
      await employee.save({ session })

      await session.commitTransaction()

      // Populate and return employee
      await employee.populate({
        path: 'userAccount',
        select: '-passwordHash -tokens'
      })

      response.status(201).json({
        success: true,
        data: { employee },
        message: 'Employee and user account created successfully'
      })
    } catch (error) {
      await session.abortTransaction()
      throw error
    } finally {
      session.endSession()
    }
  } catch (error) {
    console.error('Error in create employee:', error)

    // Handle validation errors
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

    // Handle duplicate key errors
    if (error.code === 11000) {
      return response.status(409).json({
        success: false,
        error: {
          message: 'Username or email already exists',
          code: 'DUPLICATE_KEY'
        }
      })
    }

    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to create employee',
        details: error.message
      }
    })
  }
})

/**
 * @route   PUT /api/employees/:id
 * @desc    Update employee profile
 * @access  Private (Admin or own profile)
 * @body    { fullName, phone, address, dateOfBirth }
 */
employeesRouter.put('/:id', async (request, response) => {
  try {
    const { fullName, phone, address, dateOfBirth } = request.body

    const employee = await Employee.findById(request.params.id)

    if (!employee) {
      return response.status(404).json({
        success: false,
        error: {
          message: 'Employee not found',
          code: 'EMPLOYEE_NOT_FOUND'
        }
      })
    }

    // Update allowed fields
    if (fullName !== undefined) employee.fullName = fullName
    if (phone !== undefined) employee.phone = phone
    if (address !== undefined) employee.address = address
    if (dateOfBirth !== undefined) employee.dateOfBirth = dateOfBirth

    await employee.save()

    // Populate before returning
    await employee.populate({
      path: 'userAccount',
      select: 'username email userCode role isActive createdAt updatedAt',
      populate: {
        path: 'role',
        select: 'roleName permissions'
      }
    })

    response.json({
      success: true,
      data: { employee },
      message: 'Employee updated successfully'
    })
  } catch (error) {
    console.error('Error in update employee:', error)

    // Handle validation errors
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
        message: 'Failed to update employee',
        details: error.message
      }
    })
  }
})

/**
 * @route   DELETE /api/employees/:id
 * @desc    Delete employee profile
 * @access  Private (Admin only)
 * @note    Hard delete - nếu muốn soft delete, deactivate user account thay vì xóa employee
 */
employeesRouter.delete('/:id', async (request, response) => {
  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    const employee = await Employee.findById(request.params.id)
      .populate('userAccount')
      .session(session)

    if (!employee) {
      await session.abortTransaction()
      session.endSession()
      return response.status(404).json({
        success: false,
        error: {
          message: 'Employee not found',
          code: 'EMPLOYEE_NOT_FOUND'
        }
      })
    }

    // Check if employee account is inactive before allowing deletion
    if (employee.userAccount && employee.userAccount.isActive) {
      await session.abortTransaction()
      session.endSession()
      return response.status(400).json({
        success: false,
        error: {
          message: 'Cannot delete an active employee. Please deactivate the account first.',
          code: 'EMPLOYEE_STILL_ACTIVE'
        }
      })
    }

    // Delete associated POS authentication if exists
    await EmployeePOSAuth.findOneAndDelete(
      { employee: request.params.id },
      { session }
    )

    // Delete associated user account if exists
    if (employee.userAccount) {
      await UserAccount.findByIdAndDelete(employee.userAccount._id, { session })
    }

    // Delete employee
    await Employee.findByIdAndDelete(request.params.id, { session })

    await session.commitTransaction()
    session.endSession()

    response.json({
      success: true,
      message: 'Employee and associated data deleted successfully'
    })
  } catch (error) {
    await session.abortTransaction()
    session.endSession()
    console.error('Error in delete employee:', error)
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to delete employee',
        details: error.message
      }
    })
  }
})

// ============================================
// POS ACCESS MANAGEMENT ROUTES (Admin)
// ============================================

/**
 * @route   GET /api/employees/pos-access
 * @desc    Get all POS access records with employee details
 * @access  Private (Admin only)
 */
employeesRouter.get('/pos-access', async (request, response) => {
  try {
    // Get all employees with POS auth and userAccount
    const employees = await Employee.find()
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

    // Build complete access list (including employees without POS auth)
    const accessList = employees.map(emp => {
      const posAuth = posAuthMap.get(emp._id.toString())

      if (posAuth) {
        // Employee has POS auth record
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
        // Employee doesn't have POS auth yet
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

    response.json({
      success: true,
      data: accessList
    })
  } catch (error) {
    console.error('Error fetching POS access:', error)
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch POS access data',
        details: error.message
      }
    })
  }
})

/**
 * @route   GET /api/employees/:id/pos-access/status
 * @desc    Get POS access status for specific employee
 * @access  Private (Admin only)
 */
employeesRouter.get('/:id/pos-access/status', async (request, response) => {
  try {
    const { id } = request.params

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return response.status(400).json({
        success: false,
        error: { message: 'Invalid employee ID' }
      })
    }

    const employee = await Employee.findById(id)
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

    const posAuth = await EmployeePOSAuth.findOne({ employee: id })

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
    console.error('Error fetching POS status:', error)
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch POS status',
        details: error.message
      }
    })
  }
})

/**
 * @route   POST /api/employees/:id/pos-access/enable
 * @desc    Enable POS access for employee
 * @access  Private (Admin only)
 */
employeesRouter.post('/:id/pos-access/enable', async (request, response) => {
  try {
    const { id } = request.params

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return response.status(400).json({
        success: false,
        error: { message: 'Invalid employee ID' }
      })
    }

    const employee = await Employee.findById(id)
    if (!employee) {
      return response.status(404).json({
        success: false,
        error: { message: 'Employee not found' }
      })
    }

    // Find or create POS auth record
    let posAuth = await EmployeePOSAuth.findOne({ employee: id })

    if (!posAuth) {
      // Create new POS auth record (without PIN)
      posAuth = new EmployeePOSAuth({
        employee: id,
        canAccessPOS: true
      })
    } else {
      // Update existing record
      posAuth.canAccessPOS = true
    }

    await posAuth.save()

    response.json({
      success: true,
      message: 'POS access enabled successfully',
      data: posAuth
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
 * @route   POST /api/employees/:id/pos-access/disable
 * @desc    Disable POS access for employee
 * @access  Private (Admin only)
 */
employeesRouter.post('/:id/pos-access/disable', async (request, response) => {
  try {
    const { id } = request.params

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return response.status(400).json({
        success: false,
        error: { message: 'Invalid employee ID' }
      })
    }

    const posAuth = await EmployeePOSAuth.findOne({ employee: id })

    if (!posAuth) {
      return response.status(404).json({
        success: false,
        error: { message: 'POS access record not found' }
      })
    }

    posAuth.canAccessPOS = false
    await posAuth.save()

    response.json({
      success: true,
      message: 'POS access disabled successfully',
      data: posAuth
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
 * @route   POST /api/employees/:id/pos-access/set-pin
 * @desc    Set PIN for employee (Admin only - for initial setup)
 * @access  Private (Admin only)
 * @body    pin: string (4-6 digits)
 */
employeesRouter.post('/:id/pos-access/set-pin', async (request, response) => {
  try {
    const { id } = request.params
    const { pin } = request.body

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return response.status(400).json({
        success: false,
        error: { message: 'Invalid employee ID' }
      })
    }

    // Validate PIN format
    if (!pin || !/^\d{4,6}$/.test(pin)) {
      return response.status(400).json({
        success: false,
        error: { message: 'PIN must be 4-6 digits' }
      })
    }

    const employee = await Employee.findById(id)
    if (!employee) {
      return response.status(404).json({
        success: false,
        error: { message: 'Employee not found' }
      })
    }

    // Find or create POS auth record
    let posAuth = await EmployeePOSAuth.findOne({ employee: id })

    if (!posAuth) {
      posAuth = new EmployeePOSAuth({
        employee: id,
        canAccessPOS: true
      })
    }

    // Hash the PIN
    const saltRounds = 10
    posAuth.posPinHash = await bcrypt.hash(pin, saltRounds)

    await posAuth.save()

    response.json({
      success: true,
      message: 'PIN set successfully',
      data: {
        employeeId: id,
        hasPIN: true
      }
    })
  } catch (error) {
    console.error('Error setting PIN:', error)
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to set PIN',
        details: error.message
      }
    })
  }
})

/**
 * @route   POST /api/employees/:id/pos-access/reset-attempts
 * @desc    Reset failed attempts and unlock account
 * @access  Private (Admin only)
 */
employeesRouter.post('/:id/pos-access/reset-attempts', async (request, response) => {
  try {
    const { id } = request.params

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return response.status(400).json({
        success: false,
        error: { message: 'Invalid employee ID' }
      })
    }

    const posAuth = await EmployeePOSAuth.findOne({ employee: id })

    if (!posAuth) {
      return response.status(404).json({
        success: false,
        error: { message: 'POS access record not found' }
      })
    }

    // Reset failed attempts and unlock
    posAuth.pinFailedAttempts = 0
    posAuth.pinLockedUntil = null

    await posAuth.save()

    response.json({
      success: true,
      message: 'Failed attempts reset and account unlocked successfully',
      data: {
        pinFailedAttempts: 0,
        isPinLocked: false
      }
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

module.exports = employeesRouter
