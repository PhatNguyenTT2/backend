const employeesRouter = require('express').Router()
const Employee = require('../models/employee')
const UserAccount = require('../models/userAccount')
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
        select: 'username email userCode role isActive lastLogin',
        populate: {
          path: 'role',
          select: 'roleName'
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
        select: 'username email userCode role isActive lastLogin',
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
      select: 'username email userCode role isActive',
      populate: {
        path: 'role',
        select: 'roleName'
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
  try {
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

    // Delete employee
    await Employee.findByIdAndDelete(request.params.id)

    response.json({
      success: true,
      message: 'Employee deleted successfully'
    })
  } catch (error) {
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

module.exports = employeesRouter
