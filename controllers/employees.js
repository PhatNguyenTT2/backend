const employeesRouter = require('express').Router()
const Employee = require('../models/employee')
const UserAccount = require('../models/userAccount')
const bcrypt = require('bcrypt')

/**
 * @route   GET /api/employees
 * @desc    Get all employees (with optional filters)
 * @access  Private (Admin/Manager)
 * @query   department: string - Filter by department ID
 * @query   search: string - Search by name or phone
 * @query   isActive: boolean - Filter by user account active status
 */
employeesRouter.get('/', async (request, response) => {
  try {
    const { department, search, isActive } = request.query

    let employees

    if (search) {
      // Use search method from model
      employees = await Employee.searchEmployees(search)
    } else {
      // Build filter
      const filter = {}
      if (department) {
        filter.department = department
      }

      // Get all with details
      employees = await Employee.getAllWithDetails(filter)

      // Filter by user account active status if provided
      if (isActive !== undefined) {
        const activeFilter = isActive === 'true'
        employees = employees.filter(emp =>
          emp.userAccount && emp.userAccount.isActive === activeFilter
        )
      }
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
      .populate('department', 'departmentName departmentId location')

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
 *            employeeData: { fullName, department, phone, address, dateOfBirth }
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

    // Prepare user data with hashed password
    const userDataWithHash = {
      username: userData.username,
      email: userData.email,
      passwordHash,
      role: userData.role,
      isActive: userData.isActive !== undefined ? userData.isActive : true
    }

    // Create employee with user account using transaction
    const employee = await Employee.createWithUserAccount(userDataWithHash, employeeData)

    response.status(201).json({
      success: true,
      data: { employee },
      message: 'Employee and user account created successfully'
    })
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
 * @body    { fullName, department, phone, address, dateOfBirth }
 * @note    Xử lý cả updateProfile() và changeDepartment() methods qua endpoint này
 */
employeesRouter.put('/:id', async (request, response) => {
  try {
    const { fullName, department, phone, address, dateOfBirth } = request.body

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

    // Use updateProfile method from model
    const profileData = {}
    if (fullName !== undefined) profileData.fullName = fullName
    if (department !== undefined) profileData.department = department
    if (phone !== undefined) profileData.phone = phone
    if (address !== undefined) profileData.address = address
    if (dateOfBirth !== undefined) profileData.dateOfBirth = dateOfBirth

    await employee.updateProfile(profileData)

    // Populate before returning
    await employee.populate([
      {
        path: 'userAccount',
        select: 'username email userCode role isActive',
        populate: {
          path: 'role',
          select: 'roleName'
        }
      },
      {
        path: 'department',
        select: 'departmentName departmentId location'
      }
    ])

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

/**
 * Methods NOT implemented as endpoints (and why):
 * 
 * 1. updateProfile() - Use PUT /employees/:id
 * 2. changeDepartment() - Use PUT /employees/:id with { department: newId }
 * 3. findByUserAccount() - Use GET /employees?userAccount=:id (thông qua query param)
 * 4. findByDepartment() - Use GET /employees?department=:id (đã có trong getAll)
 * 5. searchEmployees() - Use GET /employees?search=:term (đã có trong getAll)
 * 6. getStatisticsByDepartment() - CHƯA TẠO, đợi frontend yêu cầu
 * 7. getAllWithDetails() - Đã dùng trong getAll
 * 8. createWithUserAccount() - Đã dùng trong create
 * 
 * These methods are part of the model for code organization and reusability.
 * They're either:
 * - Used internally by the CRUD endpoints
 * - Can be accessed through query parameters
 * - Will be added later when frontend requests them
 */

module.exports = employeesRouter
