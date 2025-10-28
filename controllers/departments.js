const departmentsRouter = require('express').Router()
const Department = require('../models/department')
const Employee = require('../models/employee')
const { userExtractor, isAdmin } = require('../utils/auth')

// GET /api/departments - Get all departments
departmentsRouter.get('/', userExtractor, async (request, response) => {
  try {
    const { include_inactive, with_count } = request.query

    // Build filter
    const filter = {}
    if (include_inactive !== 'true') {
      filter.isActive = true
    }

    let departments

    // Get departments with employee count if requested
    if (with_count === 'true') {
      const allDepartments = await Department.getDepartmentsWithEmployeeCount()
      departments = include_inactive === 'true'
        ? allDepartments
        : allDepartments.filter(dept => dept.isActive)
    } else {
      departments = await Department.find(filter)
        .sort({ departmentName: 1 })

      // Get employee count for each department
      departments = await Promise.all(
        departments.map(async (department) => {
          const employeeCount = await Employee.countDocuments({
            department: department._id
          })

          return {
            id: department._id,
            departmentCode: department.departmentCode,
            departmentName: department.departmentName,
            description: department.description,
            managerId: department.manager,
            location: department.location,
            phone: department.phone,
            email: department.email,
            isActive: department.isActive,
            employeeCount,
            createdAt: department.createdAt,
            updatedAt: department.updatedAt
          }
        })
      )
    }

    response.status(200).json({
      success: true,
      data: {
        departments
      }
    })
  } catch (error) {
    response.status(500).json({
      error: 'Failed to fetch departments'
    })
  }
})

// GET /api/departments/stats/overview - Get department statistics (Admin only)
departmentsRouter.get('/stats/overview', userExtractor, isAdmin, async (request, response) => {
  try {
    const stats = await Department.getStatistics()

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

// GET /api/departments/without-manager - Get departments without manager (Admin only)
departmentsRouter.get('/without-manager', userExtractor, isAdmin, async (request, response) => {
  try {
    const departments = await Department.findWithoutManager()

    const departmentsData = departments.map(dept => ({
      id: dept._id,
      departmentCode: dept.departmentCode,
      departmentName: dept.departmentName,
      location: dept.location,
      createdAt: dept.createdAt
    }))

    response.status(200).json({
      success: true,
      data: {
        departments: departmentsData
      }
    })
  } catch (error) {
    response.status(500).json({
      error: 'Failed to fetch departments without manager'
    })
  }
})

// GET /api/departments/code/:code - Get department by code
departmentsRouter.get('/code/:code', userExtractor, async (request, response) => {
  try {
    const department = await Department.findByCode(request.params.code)

    if (!department) {
      return response.status(404).json({
        error: 'Department not found'
      })
    }

    // Get employee count
    const employeeCount = await Employee.countDocuments({
      department: department._id
    })

    response.status(200).json({
      success: true,
      data: {
        department: {
          id: department._id,
          departmentCode: department.departmentCode,
          departmentName: department.departmentName,
          description: department.description,
          managerId: department.manager,
          location: department.location,
          phone: department.phone,
          email: department.email,
          isActive: department.isActive,
          employeeCount,
          createdAt: department.createdAt,
          updatedAt: department.updatedAt
        }
      }
    })
  } catch (error) {
    response.status(500).json({
      error: 'Failed to fetch department'
    })
  }
})

// GET /api/departments/:id - Get single department
departmentsRouter.get('/:id', userExtractor, async (request, response) => {
  try {
    const department = await Department.findById(request.params.id)

    if (!department) {
      return response.status(404).json({
        error: 'Department not found'
      })
    }

    // Get employee count
    const employeeCount = await Employee.countDocuments({
      department: department._id
    })

    // Get employees list
    const employees = await Employee.find({ department: department._id })
      .select('employeeCode fullName email position')
      .sort({ fullName: 1 })

    response.status(200).json({
      success: true,
      data: {
        department: {
          id: department._id,
          departmentCode: department.departmentCode,
          departmentName: department.departmentName,
          description: department.description,
          managerId: department.manager,
          location: department.location,
          phone: department.phone,
          email: department.email,
          isActive: department.isActive,
          employeeCount,
          employees: employees.map(emp => ({
            id: emp._id,
            employeeCode: emp.employeeCode,
            fullName: emp.fullName,
            email: emp.email,
            position: emp.position
          })),
          createdAt: department.createdAt,
          updatedAt: department.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid department ID'
      })
    }
    response.status(500).json({
      error: 'Failed to fetch department'
    })
  }
})

// POST /api/departments - Create new department (Admin only)
departmentsRouter.post('/', userExtractor, isAdmin, async (request, response) => {
  const { departmentName, description, manager, location, phone, email } = request.body

  if (!departmentName) {
    return response.status(400).json({
      error: 'Department name is required'
    })
  }

  try {
    // If manager is provided, verify it exists
    if (manager) {
      const managerExists = await Employee.findById(manager)
      if (!managerExists) {
        return response.status(400).json({
          error: 'Manager not found'
        })
      }
    }

    const department = new Department({
      departmentName,
      description,
      manager: manager || null,
      location,
      phone,
      email,
      isActive: true
    })

    const savedDepartment = await department.save()

    response.status(201).json({
      success: true,
      message: 'Department created successfully',
      data: {
        department: {
          id: savedDepartment._id,
          departmentCode: savedDepartment.departmentCode,
          departmentName: savedDepartment.departmentName,
          description: savedDepartment.description,
          managerId: savedDepartment.manager,
          location: savedDepartment.location,
          phone: savedDepartment.phone,
          email: savedDepartment.email,
          isActive: savedDepartment.isActive,
          createdAt: savedDepartment.createdAt
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
      return response.status(400).json({
        error: 'Department code already exists'
      })
    }
    response.status(500).json({
      error: 'Failed to create department'
    })
  }
})

// PUT /api/departments/:id - Update department (Admin only)
departmentsRouter.put('/:id', userExtractor, isAdmin, async (request, response) => {
  const { departmentName, description, manager, location, phone, email } = request.body

  try {
    const department = await Department.findById(request.params.id)

    if (!department) {
      return response.status(404).json({
        error: 'Department not found'
      })
    }

    // If manager is provided, verify it exists
    if (manager) {
      const managerExists = await Employee.findById(manager)
      if (!managerExists) {
        return response.status(400).json({
          error: 'Manager not found'
        })
      }
    }

    // Use the updateDepartment method from the model
    const updatedDepartment = await department.updateDepartment({
      departmentName,
      description,
      manager,
      location,
      phone,
      email
    })

    response.status(200).json({
      success: true,
      message: 'Department updated successfully',
      data: {
        department: {
          id: updatedDepartment._id,
          departmentCode: updatedDepartment.departmentCode,
          departmentName: updatedDepartment.departmentName,
          description: updatedDepartment.description,
          managerId: updatedDepartment.manager,
          location: updatedDepartment.location,
          phone: updatedDepartment.phone,
          email: updatedDepartment.email,
          isActive: updatedDepartment.isActive,
          updatedAt: updatedDepartment.updatedAt
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
        error: 'Invalid department ID'
      })
    }
    response.status(500).json({
      error: 'Failed to update department'
    })
  }
})

// PATCH /api/departments/:id/assign-manager - Assign manager to department (Admin only)
departmentsRouter.patch('/:id/assign-manager', userExtractor, isAdmin, async (request, response) => {
  const { managerId } = request.body

  if (!managerId) {
    return response.status(400).json({
      error: 'Manager ID is required'
    })
  }

  try {
    const department = await Department.findById(request.params.id)

    if (!department) {
      return response.status(404).json({
        error: 'Department not found'
      })
    }

    // Verify manager exists
    const manager = await Employee.findById(managerId)
    if (!manager) {
      return response.status(400).json({
        error: 'Manager not found'
      })
    }

    // Use the assignManager method from the model
    const updatedDepartment = await department.assignManager(managerId)

    response.status(200).json({
      success: true,
      message: 'Manager assigned successfully',
      data: {
        department: {
          id: updatedDepartment._id,
          departmentCode: updatedDepartment.departmentCode,
          departmentName: updatedDepartment.departmentName,
          managerId: updatedDepartment.manager,
          updatedAt: updatedDepartment.updatedAt
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
      error: 'Failed to assign manager'
    })
  }
})

// PATCH /api/departments/:id/toggle - Toggle department active status (Admin only)
departmentsRouter.patch('/:id/toggle', userExtractor, isAdmin, async (request, response) => {
  try {
    const department = await Department.findById(request.params.id)

    if (!department) {
      return response.status(404).json({
        error: 'Department not found'
      })
    }

    // If trying to deactivate, check if department has active employees
    if (department.isActive) {
      const activeEmployeeCount = await Employee.countDocuments({
        department: department._id,
        isActive: true
      })

      if (activeEmployeeCount > 0) {
        return response.status(400).json({
          error: `Cannot deactivate department with ${activeEmployeeCount} active employee(s). Please reassign or deactivate all employees first.`
        })
      }
    }

    // Use the toggleActive method from the model
    const updatedDepartment = await department.toggleActive()

    response.status(200).json({
      success: true,
      message: `Department ${updatedDepartment.isActive ? 'activated' : 'deactivated'} successfully`,
      data: {
        department: {
          id: updatedDepartment._id,
          departmentCode: updatedDepartment.departmentCode,
          departmentName: updatedDepartment.departmentName,
          isActive: updatedDepartment.isActive,
          updatedAt: updatedDepartment.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid department ID'
      })
    }
    response.status(500).json({
      error: 'Failed to toggle department status'
    })
  }
})

// DELETE /api/departments/:id - Delete department (Admin only)
departmentsRouter.delete('/:id', userExtractor, isAdmin, async (request, response) => {
  try {
    const department = await Department.findById(request.params.id)

    if (!department) {
      return response.status(404).json({
        error: 'Department not found'
      })
    }

    // Check if department is still active
    if (department.isActive !== false) {
      return response.status(400).json({
        error: 'Cannot delete active department. Please deactivate it first.'
      })
    }

    // Check if department has ANY employees
    const employeeCount = await Employee.countDocuments({
      department: request.params.id
    })

    if (employeeCount > 0) {
      return response.status(400).json({
        error: `Cannot delete department with ${employeeCount} employee(s). Please reassign or delete all employees first.`
      })
    }

    await Department.findByIdAndDelete(request.params.id)

    response.status(200).json({
      success: true,
      message: 'Department deleted successfully'
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid department ID'
      })
    }
    response.status(500).json({
      error: 'Failed to delete department'
    })
  }
})

module.exports = departmentsRouter
