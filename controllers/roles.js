const rolesRouter = require('express').Router()
const Role = require('../models/role')

/**
 * @route   GET /api/roles
 * @desc    Get all roles (with optional filters)
 * @access  Private (All authenticated users)
 * @query   code: string - Filter by role code (e.g., ROLE001)
 * @query   search: string - Search by role name or description
 */
rolesRouter.get('/', async (request, response) => {
  try {
    const { code, search, withEmployees } = request.query

    let query

    if (code) {
      // Find by code
      query = Role.findOne({ roleCode: code.toUpperCase() })
    } else if (search) {
      // Search by name or description
      query = Role.find({
        $or: [
          { roleName: new RegExp(search, 'i') },
          { description: new RegExp(search, 'i') }
        ]
      }).sort({ roleName: 1 })
    } else {
      // Get all roles
      query = Role.find().sort({ roleName: 1 })
    }

    // Populate employee count if requested
    if (withEmployees === 'true') {
      query = query.populate('userCount')
    }

    let roles = await query

    // Convert single result to array for consistent response
    if (code && roles) {
      roles = [roles]
    } else if (code && !roles) {
      roles = []
    }

    // Add employeeCount field from virtual userCount
    if (withEmployees === 'true') {
      roles = roles.map(role => {
        const roleObj = role.toJSON()
        roleObj.employeeCount = roleObj.userCount || 0
        delete roleObj.userCount
        return roleObj
      })
    }

    response.json({
      success: true,
      data: {
        roles,
        count: roles.length
      }
    })
  } catch (error) {
    console.error('Error in getAll roles:', error)
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch roles',
        details: error.message
      }
    })
  }
})

/**
 * @route   GET /api/roles/:id
 * @desc    Get role by ID
 * @access  Private (All authenticated users)
 */
rolesRouter.get('/:id', async (request, response) => {
  try {
    const { withEmployees } = request.query

    let query = Role.findById(request.params.id)

    // Populate employee count if requested
    if (withEmployees === 'true') {
      query = query.populate('userCount')
    }

    let role = await query

    if (!role) {
      return response.status(404).json({
        success: false,
        error: {
          message: 'Role not found',
          code: 'ROLE_NOT_FOUND'
        }
      })
    }

    // Add employeeCount field from virtual userCount
    if (withEmployees === 'true') {
      const roleObj = role.toJSON()
      roleObj.employeeCount = roleObj.userCount || 0
      delete roleObj.userCount
      role = roleObj
    }

    response.json({
      success: true,
      data: { role }
    })
  } catch (error) {
    console.error('Error in getById role:', error)
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch role',
        details: error.message
      }
    })
  }
})

/**
 * @route   POST /api/roles
 * @desc    Create new role
 * @access  Private (Admin only)
 * @body    { roleName, description, permissions }
 */
rolesRouter.post('/', async (request, response) => {
  try {
    const { roleName, description, permissions } = request.body

    // Validate required fields
    if (!roleName) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Missing required fields',
          code: 'MISSING_FIELDS',
          details: {
            required: ['roleName']
          }
        }
      })
    }

    // Check if role name already exists
    const existingRole = await Role.findOne({
      roleName: new RegExp(`^${roleName}$`, 'i')
    })
    if (existingRole) {
      return response.status(409).json({
        success: false,
        error: {
          message: 'Role name already exists',
          code: 'ROLE_EXISTS'
        }
      })
    }

    // Create role
    const role = new Role({
      roleName,
      description,
      permissions: permissions || []
    })

    await role.save()

    response.status(201).json({
      success: true,
      data: { role },
      message: 'Role created successfully'
    })
  } catch (error) {
    console.error('Error in create role:', error)

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
          message: 'Role code or name already exists',
          code: 'DUPLICATE_KEY'
        }
      })
    }

    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to create role',
        details: error.message
      }
    })
  }
})

/**
 * @route   PUT /api/roles/:id
 * @desc    Update role
 * @access  Private (Admin only)
 * @body    { roleName, description, permissions }
 * @note    Xử lý cả addPermission() và removePermission() thông qua update permissions array
 */
rolesRouter.put('/:id', async (request, response) => {
  try {
    const { roleName, description, permissions } = request.body

    const role = await Role.findById(request.params.id)

    if (!role) {
      return response.status(404).json({
        success: false,
        error: {
          message: 'Role not found',
          code: 'ROLE_NOT_FOUND'
        }
      })
    }

    // Update allowed fields
    if (roleName !== undefined) role.roleName = roleName
    if (description !== undefined) role.description = description
    if (permissions !== undefined) role.permissions = permissions

    await role.save()

    response.json({
      success: true,
      data: { role },
      message: 'Role updated successfully'
    })
  } catch (error) {
    console.error('Error in update role:', error)

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
          message: 'Role name already exists',
          code: 'DUPLICATE_KEY'
        }
      })
    }

    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to update role',
        details: error.message
      }
    })
  }
})

/**
 * @route   DELETE /api/roles/:id
 * @desc    Delete role
 * @access  Private (Admin only)
 * @note    Nên check xem có users nào đang dùng role này không trước khi xóa
 */
rolesRouter.delete('/:id', async (request, response) => {
  try {
    const role = await Role.findById(request.params.id)

    if (!role) {
      return response.status(404).json({
        success: false,
        error: {
          message: 'Role not found',
          code: 'ROLE_NOT_FOUND'
        }
      })
    }

    // Check if any users are using this role
    const UserAccount = require('../models/userAccount')
    const usersWithRole = await UserAccount.countDocuments({ role: request.params.id })

    if (usersWithRole > 0) {
      return response.status(400).json({
        success: false,
        error: {
          message: `Cannot delete role. ${usersWithRole} user(s) are currently assigned to this role`,
          code: 'ROLE_IN_USE',
          details: {
            userCount: usersWithRole
          }
        }
      })
    }

    // Delete role
    await Role.findByIdAndDelete(request.params.id)

    response.json({
      success: true,
      message: 'Role deleted successfully'
    })
  } catch (error) {
    console.error('Error in delete role:', error)
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to delete role',
        details: error.message
      }
    })
  }
})

module.exports = rolesRouter
