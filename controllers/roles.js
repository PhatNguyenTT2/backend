const rolesRouter = require('express').Router()
const Role = require('../models/role')
const Employee = require('../models/employee')
const { userExtractor, isAdmin } = require('../utils/auth')

// GET /api/roles - Get all roles
rolesRouter.get('/', userExtractor, async (request, response) => {
  try {
    const { include_user_count } = request.query

    let roles

    if (include_user_count === 'true') {
      roles = await Role.getRolesWithUserCount()
    } else {
      roles = await Role.findAllRoles()
    }

    const rolesData = roles.map(role => ({
      id: role._id || role.id,
      roleCode: role.roleCode,
      roleName: role.roleName,
      description: role.description,
      permissions: role.permissions,
      userCount: role.userCount,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt
    }))

    response.status(200).json({
      success: true,
      data: {
        roles: rolesData
      }
    })
  } catch (error) {
    response.status(500).json({
      error: 'Failed to fetch roles'
    })
  }
})

// GET /api/roles/stats/overview - Get role statistics (Admin only)
rolesRouter.get('/stats/overview', userExtractor, isAdmin, async (request, response) => {
  try {
    const stats = await Role.getStatistics()

    response.status(200).json({
      success: true,
      data: {
        statistics: stats
      }
    })
  } catch (error) {
    response.status(500).json({
      error: 'Failed to fetch role statistics'
    })
  }
})

// GET /api/roles/code/:code - Get role by code
rolesRouter.get('/code/:code', userExtractor, async (request, response) => {
  try {
    const role = await Role.findByCode(request.params.code)

    if (!role) {
      return response.status(404).json({
        error: 'Role not found'
      })
    }

    response.status(200).json({
      success: true,
      data: {
        role: {
          id: role._id,
          roleCode: role.roleCode,
          roleName: role.roleName,
          description: role.description,
          permissions: role.permissions,
          createdAt: role.createdAt,
          updatedAt: role.updatedAt
        }
      }
    })
  } catch (error) {
    response.status(500).json({
      error: 'Failed to fetch role'
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

    // Get user count for this role
    const userCount = await Employee.countDocuments({ role: role._id })

    response.status(200).json({
      success: true,
      data: {
        role: {
          id: role._id,
          roleCode: role.roleCode,
          roleName: role.roleName,
          description: role.description,
          permissions: role.permissions,
          userCount,
          createdAt: role.createdAt,
          updatedAt: role.updatedAt
        }
      }
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

// POST /api/roles - Create new role (Admin only)
rolesRouter.post('/', userExtractor, isAdmin, async (request, response) => {
  const { roleName, description, permissions } = request.body

  if (!roleName) {
    return response.status(400).json({
      error: 'Role name is required'
    })
  }

  try {
    // Check if role name already exists
    const existingRole = await Role.findOne({
      roleName: { $regex: new RegExp(`^${roleName}$`, 'i') }
    })

    if (existingRole) {
      return response.status(400).json({
        error: 'Role name already exists'
      })
    }

    const role = new Role({
      roleName,
      description,
      permissions: permissions || []
    })

    const savedRole = await role.save()

    response.status(201).json({
      success: true,
      message: 'Role created successfully',
      data: {
        role: {
          id: savedRole._id,
          roleCode: savedRole.roleCode,
          roleName: savedRole.roleName,
          description: savedRole.description,
          permissions: savedRole.permissions,
          createdAt: savedRole.createdAt
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
        error: 'Role code already exists'
      })
    }
    response.status(500).json({
      error: 'Failed to create role'
    })
  }
})

// PUT /api/roles/:id - Update role (Admin only)
rolesRouter.put('/:id', userExtractor, isAdmin, async (request, response) => {
  const { roleName, description, permissions } = request.body

  try {
    const role = await Role.findById(request.params.id)

    if (!role) {
      return response.status(404).json({
        error: 'Role not found'
      })
    }

    // Check if new role name conflicts with existing role
    if (roleName && roleName !== role.roleName) {
      const existingRole = await Role.findOne({
        roleName: { $regex: new RegExp(`^${roleName}$`, 'i') },
        _id: { $ne: role._id }
      })

      if (existingRole) {
        return response.status(400).json({
          error: 'Role name already exists'
        })
      }
    }

    // Use the updateRole method from the model
    const updateData = {}
    if (roleName !== undefined) updateData.roleName = roleName
    if (description !== undefined) updateData.description = description
    if (permissions !== undefined) updateData.permissions = permissions

    await role.updateRole(updateData)

    response.status(200).json({
      success: true,
      message: 'Role updated successfully',
      data: {
        role: {
          id: role._id,
          roleCode: role.roleCode,
          roleName: role.roleName,
          description: role.description,
          permissions: role.permissions,
          updatedAt: role.updatedAt
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
        error: 'Invalid role ID'
      })
    }
    response.status(500).json({
      error: 'Failed to update role'
    })
  }
})

// PATCH /api/roles/:id/add-permission - Add permission to role (Admin only)
rolesRouter.patch('/:id/add-permission', userExtractor, isAdmin, async (request, response) => {
  const { permission } = request.body

  if (!permission) {
    return response.status(400).json({
      error: 'Permission is required'
    })
  }

  try {
    const role = await Role.findById(request.params.id)

    if (!role) {
      return response.status(404).json({
        error: 'Role not found'
      })
    }

    // Check if permission already exists
    if (role.permissions.includes(permission)) {
      return response.status(400).json({
        error: 'Permission already exists in this role'
      })
    }

    await role.addPermission(permission)

    response.status(200).json({
      success: true,
      message: 'Permission added successfully',
      data: {
        role: {
          id: role._id,
          roleCode: role.roleCode,
          roleName: role.roleName,
          permissions: role.permissions,
          updatedAt: role.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid role ID'
      })
    }
    response.status(500).json({
      error: 'Failed to add permission'
    })
  }
})

// PATCH /api/roles/:id/remove-permission - Remove permission from role (Admin only)
rolesRouter.patch('/:id/remove-permission', userExtractor, isAdmin, async (request, response) => {
  const { permission } = request.body

  if (!permission) {
    return response.status(400).json({
      error: 'Permission is required'
    })
  }

  try {
    const role = await Role.findById(request.params.id)

    if (!role) {
      return response.status(404).json({
        error: 'Role not found'
      })
    }

    // Check if permission exists
    if (!role.permissions.includes(permission)) {
      return response.status(400).json({
        error: 'Permission does not exist in this role'
      })
    }

    await role.removePermission(permission)

    response.status(200).json({
      success: true,
      message: 'Permission removed successfully',
      data: {
        role: {
          id: role._id,
          roleCode: role.roleCode,
          roleName: role.roleName,
          permissions: role.permissions,
          updatedAt: role.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid role ID'
      })
    }
    response.status(500).json({
      error: 'Failed to remove permission'
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

    // Check if role is assigned to any employees
    const employeeCount = await Employee.countDocuments({ role: role._id })
    if (employeeCount > 0) {
      return response.status(400).json({
        error: `Cannot delete role assigned to ${employeeCount} employee(s). Please reassign them first.`
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

module.exports = rolesRouter
