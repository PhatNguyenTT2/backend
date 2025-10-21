const departmentsRouter = require('express').Router()
const Department = require('../models/department')
const User = require('../models/user')
const { userExtractor, isAdmin } = require('../utils/auth')

// GET /api/departments - Get all departments
departmentsRouter.get('/', userExtractor, async (request, response) => {
  try {
    const { page = 1, per_page = 20, is_active } = request.query

    // Build filter
    const filter = {}
    if (is_active !== undefined) filter.isActive = is_active === 'true'

    // Pagination
    const pageNum = parseInt(page)
    const perPage = parseInt(per_page)
    const skip = (pageNum - 1) * perPage

    const departments = await Department.find(filter)
      .populate('manager', 'username fullName email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(perPage)

    const total = await Department.countDocuments(filter)
    const totalPages = Math.ceil(total / perPage)

    response.status(200).json({
      success: true,
      data: {
        departments,
        pagination: {
          current_page: pageNum,
          per_page: perPage,
          total,
          total_pages: totalPages,
          has_next: pageNum < totalPages,
          has_prev: pageNum > 1
        }
      }
    })
  } catch (error) {
    response.status(500).json({
      error: 'Failed to fetch departments'
    })
  }
})

// GET /api/departments/:id - Get single department
departmentsRouter.get('/:id', userExtractor, async (request, response) => {
  try {
    const department = await Department.findById(request.params.id)
      .populate('manager', 'username fullName email')

    if (!department) {
      return response.status(404).json({
        error: 'Department not found'
      })
    }

    response.status(200).json({
      success: true,
      data: { department }
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

// GET /api/departments/code/:departmentId - Get department by departmentId
departmentsRouter.get('/code/:departmentId', userExtractor, async (request, response) => {
  try {
    const department = await Department.findOne({ departmentId: request.params.departmentId.toUpperCase() })
      .populate('manager', 'username fullName email')

    if (!department) {
      return response.status(404).json({
        error: 'Department not found'
      })
    }

    response.status(200).json({
      success: true,
      data: { department }
    })
  } catch (error) {
    response.status(500).json({
      error: 'Failed to fetch department'
    })
  }
})

// GET /api/departments/:id/users - Get users in department
departmentsRouter.get('/:id/users', userExtractor, async (request, response) => {
  try {
    const { page = 1, per_page = 20 } = request.query

    const department = await Department.findById(request.params.id)
    if (!department) {
      return response.status(404).json({
        error: 'Department not found'
      })
    }

    // Pagination
    const pageNum = parseInt(page)
    const perPage = parseInt(per_page)
    const skip = (pageNum - 1) * perPage

    const users = await User.find({ department: request.params.id })
      .populate('role', 'roleId roleName')
      .select('-passwordHash -tokens')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(perPage)

    const total = await User.countDocuments({ department: request.params.id })
    const totalPages = Math.ceil(total / perPage)

    response.status(200).json({
      success: true,
      data: {
        department: {
          id: department._id,
          departmentId: department.departmentId,
          departmentName: department.departmentName
        },
        users,
        pagination: {
          current_page: pageNum,
          per_page: perPage,
          total,
          total_pages: totalPages,
          has_next: pageNum < totalPages,
          has_prev: pageNum > 1
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
      error: 'Failed to fetch department users'
    })
  }
})

// POST /api/departments - Create new department (Admin only)
departmentsRouter.post('/', userExtractor, isAdmin, async (request, response) => {
  const { departmentId, departmentName, description, manager, location, phone, email, isActive } = request.body

  // Validation
  if (!departmentId || !departmentName) {
    return response.status(400).json({
      error: 'departmentId and departmentName are required'
    })
  }

  try {
    // Check if departmentId exists
    const existingDepartment = await Department.findOne({ departmentId: departmentId.toUpperCase() })
    if (existingDepartment) {
      return response.status(400).json({
        error: 'Department ID already exists'
      })
    }

    // Validate manager if provided
    if (manager) {
      const managerUser = await User.findById(manager)
      if (!managerUser) {
        return response.status(400).json({
          error: 'Manager user not found'
        })
      }
    }

    // Create department
    const department = new Department({
      departmentId: departmentId.toUpperCase(),
      departmentName,
      description,
      manager,
      location,
      phone,
      email,
      isActive: isActive !== undefined ? isActive : true
    })

    const savedDepartment = await department.save()
    const populatedDepartment = await Department.findById(savedDepartment._id)
      .populate('manager', 'username fullName email')

    response.status(201).json({
      success: true,
      message: 'Department created successfully',
      data: { department: populatedDepartment }
    })
  } catch (error) {
    if (error.name === 'ValidationError') {
      return response.status(400).json({
        error: error.message
      })
    }
    response.status(500).json({
      error: 'Failed to create department'
    })
  }
})

// PUT /api/departments/:id - Update department (Admin only)
departmentsRouter.put('/:id', userExtractor, isAdmin, async (request, response) => {
  const { departmentName, description, manager, location, phone, email, isActive } = request.body

  try {
    const department = await Department.findById(request.params.id)

    if (!department) {
      return response.status(404).json({
        error: 'Department not found'
      })
    }

    // Validate manager if provided
    if (manager) {
      const managerUser = await User.findById(manager)
      if (!managerUser) {
        return response.status(400).json({
          error: 'Manager user not found'
        })
      }
    }

    // Update fields
    if (departmentName !== undefined) department.departmentName = departmentName
    if (description !== undefined) department.description = description
    if (manager !== undefined) department.manager = manager
    if (location !== undefined) department.location = location
    if (phone !== undefined) department.phone = phone
    if (email !== undefined) department.email = email
    if (isActive !== undefined) department.isActive = isActive

    const updatedDepartment = await department.save()
    const populatedDepartment = await Department.findById(updatedDepartment._id)
      .populate('manager', 'username fullName email')

    response.status(200).json({
      success: true,
      message: 'Department updated successfully',
      data: { department: populatedDepartment }
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid department ID'
      })
    }
    if (error.name === 'ValidationError') {
      return response.status(400).json({
        error: error.message
      })
    }
    response.status(500).json({
      error: 'Failed to update department'
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

    // Check if department has users
    const usersInDepartment = await User.countDocuments({ department: department._id })

    if (usersInDepartment > 0) {
      return response.status(400).json({
        error: `Cannot delete department. ${usersInDepartment} user(s) are assigned to this department`
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

// PATCH /api/departments/:id/toggle - Toggle department active status (Admin only)
departmentsRouter.patch('/:id/toggle', userExtractor, isAdmin, async (request, response) => {
  try {
    const department = await Department.findById(request.params.id)

    if (!department) {
      return response.status(404).json({
        error: 'Department not found'
      })
    }

    department.isActive = !department.isActive
    const updatedDepartment = await department.save()
    const populatedDepartment = await Department.findById(updatedDepartment._id)
      .populate('manager', 'username fullName email')

    response.status(200).json({
      success: true,
      message: `Department ${updatedDepartment.isActive ? 'activated' : 'deactivated'} successfully`,
      data: { department: populatedDepartment }
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

module.exports = departmentsRouter
