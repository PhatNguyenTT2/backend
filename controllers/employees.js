const employeesRouter = require('express').Router()
const Employee = require('../models/employee')
const UserAccount = require('../models/userAccount')
const Department = require('../models/department')
const { userExtractor, isAdmin } = require('../utils/auth')

// GET /api/employees - Get all employees
employeesRouter.get('/', userExtractor, async (request, response) => {
  try {
    const { department_id, search, include_inactive } = request.query

    let employees

    // Search functionality
    if (search) {
      employees = await Employee.searchEmployees(search)
    } else if (department_id) {
      employees = await Employee.findByDepartment(department_id)
    } else {
      const query = {}
      employees = await Employee.getAllWithDetails(query)
    }

    // Filter by active status if needed
    if (include_inactive !== 'true') {
      employees = employees.filter(emp =>
        emp.userAccount && emp.userAccount.isActive
      )
    }

    const employeesData = employees.map(emp => ({
      id: emp._id,
      fullName: emp.fullName,
      phone: emp.phone,
      address: emp.address,
      dateOfBirth: emp.dateOfBirth,
      age: emp.age,
      department: emp.department ? {
        id: emp.department._id,
        departmentName: emp.department.departmentName,
        departmentCode: emp.department.departmentCode,
        location: emp.department.location
      } : null,
      userAccount: emp.userAccount ? {
        id: emp.userAccount._id,
        username: emp.userAccount.username,
        email: emp.userAccount.email,
        userCode: emp.userAccount.userCode,
        role: emp.userAccount.role ? {
          id: emp.userAccount.role._id,
          roleName: emp.userAccount.role.roleName
        } : null,
        isActive: emp.userAccount.isActive,
        lastLogin: emp.userAccount.lastLogin
      } : null,
      createdAt: emp.createdAt,
      updatedAt: emp.updatedAt
    }))

    response.status(200).json({
      success: true,
      data: {
        employees: employeesData
      }
    })
  } catch (error) {
    response.status(500).json({
      error: 'Failed to fetch employees'
    })
  }
})

// GET /api/employees/stats/by-department - Get employee statistics by department (Admin only)
employeesRouter.get('/stats/by-department', userExtractor, isAdmin, async (request, response) => {
  try {
    const stats = await Employee.getStatisticsByDepartment()

    response.status(200).json({
      success: true,
      data: {
        statistics: stats
      }
    })
  } catch (error) {
    response.status(500).json({
      error: 'Failed to fetch statistics'
    })
  }
})

// GET /api/employees/user/:userId - Get employee by user account ID
employeesRouter.get('/user/:userId', userExtractor, async (request, response) => {
  try {
    const employee = await Employee.findByUserAccount(request.params.userId)

    if (!employee) {
      return response.status(404).json({
        error: 'Employee not found'
      })
    }

    response.status(200).json({
      success: true,
      data: {
        employee: {
          id: employee._id,
          fullName: employee.fullName,
          phone: employee.phone,
          address: employee.address,
          dateOfBirth: employee.dateOfBirth,
          age: employee.age,
          department: employee.department ? {
            id: employee.department._id,
            departmentName: employee.department.departmentName,
            departmentCode: employee.department.departmentCode
          } : null,
          userAccount: employee.userAccount ? {
            id: employee.userAccount._id,
            username: employee.userAccount.username,
            email: employee.userAccount.email,
            userCode: employee.userAccount.userCode,
            role: employee.userAccount.role,
            isActive: employee.userAccount.isActive
          } : null,
          createdAt: employee.createdAt,
          updatedAt: employee.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid user ID'
      })
    }
    response.status(500).json({
      error: 'Failed to fetch employee'
    })
  }
})

// GET /api/employees/:id - Get single employee
employeesRouter.get('/:id', userExtractor, async (request, response) => {
  try {
    const employee = await Employee.findById(request.params.id)
      .populate({
        path: 'userAccount',
        select: 'username email userCode role isActive lastLogin createdAt',
        populate: {
          path: 'role',
          select: 'roleName permissions'
        }
      })
      .populate('department', 'departmentName departmentCode location phone email')

    if (!employee) {
      return response.status(404).json({
        error: 'Employee not found'
      })
    }

    response.status(200).json({
      success: true,
      data: {
        employee: {
          id: employee._id,
          fullName: employee.fullName,
          phone: employee.phone,
          address: employee.address,
          dateOfBirth: employee.dateOfBirth,
          age: employee.age,
          department: employee.department ? {
            id: employee.department._id,
            departmentName: employee.department.departmentName,
            departmentCode: employee.department.departmentCode,
            location: employee.department.location,
            phone: employee.department.phone,
            email: employee.department.email
          } : null,
          userAccount: employee.userAccount ? {
            id: employee.userAccount._id,
            username: employee.userAccount.username,
            email: employee.userAccount.email,
            userCode: employee.userAccount.userCode,
            role: employee.userAccount.role ? {
              id: employee.userAccount.role._id,
              roleName: employee.userAccount.role.roleName,
              permissions: employee.userAccount.role.permissions
            } : null,
            isActive: employee.userAccount.isActive,
            lastLogin: employee.userAccount.lastLogin,
            createdAt: employee.userAccount.createdAt
          } : null,
          createdAt: employee.createdAt,
          updatedAt: employee.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid employee ID'
      })
    }
    response.status(500).json({
      error: 'Failed to fetch employee'
    })
  }
})

// POST /api/employees - Create new employee with user account (Admin only)
employeesRouter.post('/', userExtractor, isAdmin, async (request, response) => {
  const {
    username,
    email,
    password,
    role,
    fullName,
    phone,
    address,
    dateOfBirth,
    department
  } = request.body

  if (!username || !email || !password) {
    return response.status(400).json({
      error: 'Username, email, and password are required'
    })
  }

  if (!fullName) {
    return response.status(400).json({
      error: 'Full name is required'
    })
  }

  try {
    // Verify department exists if provided
    if (department) {
      const departmentExists = await Department.findById(department)
      if (!departmentExists) {
        return response.status(400).json({
          error: 'Department not found'
        })
      }
    }

    // Create employee with user account using the static method
    const employee = await Employee.createWithUserAccount(
      { username, email, password, role },
      { fullName, phone, address, dateOfBirth, department }
    )

    response.status(201).json({
      success: true,
      message: 'Employee created successfully',
      data: {
        employee: {
          id: employee._id,
          fullName: employee.fullName,
          phone: employee.phone,
          address: employee.address,
          dateOfBirth: employee.dateOfBirth,
          department: employee.department ? {
            id: employee.department._id,
            departmentName: employee.department.departmentName,
            departmentCode: employee.department.departmentCode
          } : null,
          userAccount: {
            id: employee.userAccount._id,
            username: employee.userAccount.username,
            email: employee.userAccount.email,
            userCode: employee.userAccount.userCode
          },
          createdAt: employee.createdAt
        }
      }
    })
  } catch (error) {
    if (error.name === 'ValidationError') {
      return response.status(400).json({
        error: error.message
      })
    }
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0]
      return response.status(400).json({
        error: `${field === 'username' ? 'Username' : field === 'email' ? 'Email' : 'User account'} already exists`
      })
    }
    response.status(500).json({
      error: 'Failed to create employee'
    })
  }
})

// PUT /api/employees/:id - Update employee profile (Admin or own profile)
employeesRouter.put('/:id', userExtractor, async (request, response) => {
  const { fullName, phone, address, dateOfBirth, department } = request.body

  try {
    const employee = await Employee.findById(request.params.id)
      .populate('userAccount')

    if (!employee) {
      return response.status(404).json({
        error: 'Employee not found'
      })
    }

    // Check if user is admin or updating own profile
    const isOwnProfile = employee.userAccount._id.toString() === request.user.id
    if (!request.user.isAdmin && !isOwnProfile) {
      return response.status(403).json({
        error: 'You can only update your own profile'
      })
    }

    // Verify department exists if provided and changing
    if (department && department !== employee.department?.toString()) {
      const departmentExists = await Department.findById(department)
      if (!departmentExists) {
        return response.status(400).json({
          error: 'Department not found'
        })
      }
    }

    // Use the updateProfile method from the model
    const updatedEmployee = await employee.updateProfile({
      fullName,
      phone,
      address,
      dateOfBirth,
      department
    })

    await updatedEmployee.populate('department', 'departmentName departmentCode')

    response.status(200).json({
      success: true,
      message: 'Employee profile updated successfully',
      data: {
        employee: {
          id: updatedEmployee._id,
          fullName: updatedEmployee.fullName,
          phone: updatedEmployee.phone,
          address: updatedEmployee.address,
          dateOfBirth: updatedEmployee.dateOfBirth,
          age: updatedEmployee.age,
          department: updatedEmployee.department ? {
            id: updatedEmployee.department._id,
            departmentName: updatedEmployee.department.departmentName,
            departmentCode: updatedEmployee.department.departmentCode
          } : null,
          updatedAt: updatedEmployee.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.name === 'ValidationError') {
      return response.status(400).json({
        error: error.message
      })
    }
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid employee ID'
      })
    }
    response.status(500).json({
      error: 'Failed to update employee'
    })
  }
})

// PATCH /api/employees/:id/change-department - Change employee department (Admin only)
employeesRouter.patch('/:id/change-department', userExtractor, isAdmin, async (request, response) => {
  const { departmentId } = request.body

  if (!departmentId) {
    return response.status(400).json({
      error: 'Department ID is required'
    })
  }

  try {
    const employee = await Employee.findById(request.params.id)

    if (!employee) {
      return response.status(404).json({
        error: 'Employee not found'
      })
    }

    // Verify department exists
    const department = await Department.findById(departmentId)
    if (!department) {
      return response.status(400).json({
        error: 'Department not found'
      })
    }

    if (!department.isActive) {
      return response.status(400).json({
        error: 'Cannot assign to inactive department'
      })
    }

    // Use the changeDepartment method from the model
    const updatedEmployee = await employee.changeDepartment(departmentId)
    await updatedEmployee.populate('department', 'departmentName departmentCode location')

    response.status(200).json({
      success: true,
      message: 'Department changed successfully',
      data: {
        employee: {
          id: updatedEmployee._id,
          fullName: updatedEmployee.fullName,
          department: {
            id: updatedEmployee.department._id,
            departmentName: updatedEmployee.department.departmentName,
            departmentCode: updatedEmployee.department.departmentCode,
            location: updatedEmployee.department.location
          },
          updatedAt: updatedEmployee.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid ID'
      })
    }
    response.status(500).json({
      error: 'Failed to change department'
    })
  }
})

// DELETE /api/employees/:id - Delete employee (Admin only)
employeesRouter.delete('/:id', userExtractor, isAdmin, async (request, response) => {
  try {
    const employee = await Employee.findById(request.params.id)
      .populate('userAccount')

    if (!employee) {
      return response.status(404).json({
        error: 'Employee not found'
      })
    }

    // Check if user account is still active
    if (employee.userAccount && employee.userAccount.isActive) {
      return response.status(400).json({
        error: 'Cannot delete employee with active user account. Please deactivate the user account first.'
      })
    }

    // Delete employee (this will cascade to user account if needed)
    await Employee.findByIdAndDelete(request.params.id)

    response.status(200).json({
      success: true,
      message: 'Employee deleted successfully'
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid employee ID'
      })
    }
    response.status(500).json({
      error: 'Failed to delete employee'
    })
  }
})

module.exports = employeesRouter
