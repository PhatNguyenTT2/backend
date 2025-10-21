const rolesRouter = require('express').Router()
const Role = require('../models/role')
const { userExtractor, isAdmin } = require('../utils/auth')

// GET /api/roles - Get all roles
rolesRouter.get('/', userExtractor, async (request, response) => {
  try {
    const { page = 1, per_page = 20, is_active } = request.query

    // Build filter
    const filter = {}
    if (is_active !== undefined) filter.isActive = is_active === 'true'

    // Pagination
    const pageNum = parseInt(page)
    const perPage = parseInt(per_page)
    const skip = (pageNum - 1) * perPage

    const roles = await Role.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(perPage)

    const total = await Role.countDocuments(filter)
    const totalPages = Math.ceil(total / perPage)

    response.status(200).json({
      success: true,
      data: {
        roles,
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
      error: 'Failed to fetch roles'
    })
  }
})

// GET /api/roles/:id - Get single role
rolesRouter.get('/:id', userExtractor, async (request, response) => {
  try {
    const role = await Role.findById(request.params.id)

    if (!role) {
      return response.status(404).json({
        error: 'Role not found'
      })
    }

    response.status(200).json({
      success: true,
      data: { role }
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid role ID'
      })
    }
    response.status(500).json({
      error: 'Failed to fetch role'
    })
  }
})

// GET /api/roles/code/:roleId - Get role by roleId
rolesRouter.get('/code/:roleId', userExtractor, async (request, response) => {
  try {
    const role = await Role.findOne({ roleId: request.params.roleId.toUpperCase() })

    if (!role) {
      return response.status(404).json({
        error: 'Role not found'
      })
    }

    response.status(200).json({
      success: true,
      data: { role }
    })
  } catch (error) {
    response.status(500).json({
      error: 'Failed to fetch role'
    })
  }
})

// POST /api/roles - Create new role (Admin only)
rolesRouter.post('/', userExtractor, isAdmin, async (request, response) => {
  const { roleId, roleName, description, permissions, isActive } = request.body

  // Validation
  if (!roleId || !roleName) {
    return response.status(400).json({
      error: 'roleId and roleName are required'
    })
  }

  try {
    // Check if roleId exists
    const existingRole = await Role.findOne({ roleId: roleId.toUpperCase() })
    if (existingRole) {
      return response.status(400).json({
        error: 'Role ID already exists'
      })
    }

    // Create role
    const role = new Role({
      roleId: roleId.toUpperCase(),
      roleName,
      description,
      permissions: permissions || [],
      isActive: isActive !== undefined ? isActive : true
    })

    const savedRole = await role.save()

    response.status(201).json({
      success: true,
      message: 'Role created successfully',
      data: { role: savedRole }
    })
  } catch (error) {
    if (error.name === 'ValidationError') {
      return response.status(400).json({
        error: error.message
      })
    }
    response.status(500).json({
      error: 'Failed to create role'
    })
  }
})

// PUT /api/roles/:id - Update role (Admin only)
rolesRouter.put('/:id', userExtractor, isAdmin, async (request, response) => {
  const { roleName, description, permissions, isActive } = request.body

  try {
    const role = await Role.findById(request.params.id)

    if (!role) {
      return response.status(404).json({
        error: 'Role not found'
      })
    }

    // Update fields
    if (roleName !== undefined) role.roleName = roleName
    if (description !== undefined) role.description = description
    if (permissions !== undefined) role.permissions = permissions
    if (isActive !== undefined) role.isActive = isActive

    const updatedRole = await role.save()

    response.status(200).json({
      success: true,
      message: 'Role updated successfully',
      data: { role: updatedRole }
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid role ID'
      })
    }
    if (error.name === 'ValidationError') {
      return response.status(400).json({
        error: error.message
      })
    }
    response.status(500).json({
      error: 'Failed to update role'
    })
  }
})

// DELETE /api/roles/:id - Delete role (Admin only)
rolesRouter.delete('/:id', userExtractor, isAdmin, async (request, response) => {
  try {
    const role = await Role.findById(request.params.id)

    if (!role) {
      return response.status(404).json({
        error: 'Role not found'
      })
    }

    // Check if role is being used by any users
    const User = require('../models/user')
    const usersWithRole = await User.countDocuments({ role: role._id })

    if (usersWithRole > 0) {
      return response.status(400).json({
        error: `Cannot delete role. ${usersWithRole} user(s) are assigned to this role`
      })
    }

    await Role.findByIdAndDelete(request.params.id)

    response.status(200).json({
      success: true,
      message: 'Role deleted successfully'
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid role ID'
      })
    }
    response.status(500).json({
      error: 'Failed to delete role'
    })
  }
})

// PATCH /api/roles/:id/toggle - Toggle role active status (Admin only)
rolesRouter.patch('/:id/toggle', userExtractor, isAdmin, async (request, response) => {
  try {
    const role = await Role.findById(request.params.id)

    if (!role) {
      return response.status(404).json({
        error: 'Role not found'
      })
    }

    role.isActive = !role.isActive
    const updatedRole = await role.save()

    response.status(200).json({
      success: true,
      message: `Role ${updatedRole.isActive ? 'activated' : 'deactivated'} successfully`,
      data: { role: updatedRole }
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid role ID'
      })
    }
    response.status(500).json({
      error: 'Failed to toggle role status'
    })
  }
})

module.exports = rolesRouter
