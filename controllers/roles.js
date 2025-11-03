const rolesRouter = require('express').Router()
const Role = require('../models/role')

/**
 * Role Controller
 * 
 * Nguyên tắc: CHỈ 5 CRUD endpoints cơ bản
 * - KHÔNG tạo custom endpoints từ đầu
 * - Custom endpoints chỉ thêm khi frontend yêu cầu cụ thể
 * - Sử dụng query parameters cho filtering
 * 
 * Access Control:
 * - GET (all, byId): Authenticated users (cần xem danh sách roles trong form)
 * - POST, PUT, DELETE: Admin only (chỉ admin quản lý roles và permissions)
 */

/**
 * @route   GET /api/roles
 * @desc    Get all roles (with optional filters)
 * @access  Private (All authenticated users)
 * @query   code: string - Filter by role code (e.g., ROLE001)
 * @query   search: string - Search by role name or description
 */
rolesRouter.get('/', async (request, response) => {
  try {
    const { code, search } = request.query

    let roles

    if (code) {
      // Find by code
      const role = await Role.findByCode(code)
      roles = role ? [role] : []
    } else if (search) {
      // Search by name or description
      roles = await Role.find({
        $or: [
          { roleName: new RegExp(search, 'i') },
          { description: new RegExp(search, 'i') }
        ]
      }).sort({ roleName: 1 })
    } else {
      // Get all roles
      roles = await Role.findAllRoles()
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

    // Prepare update data
    const updateData = {}
    if (roleName !== undefined) updateData.roleName = roleName
    if (description !== undefined) updateData.description = description
    if (permissions !== undefined) updateData.permissions = permissions

    // Use updateRole method from model
    await role.updateRole(updateData)

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

/**
 * Methods NOT implemented as endpoints (and why):
 * 
 * 1. updateRole() - Use PUT /roles/:id
 * 2. addPermission() - Use PUT /roles/:id with updated permissions array
 *    Example: { permissions: [...existingPermissions, 'new_permission'] }
 * 3. removePermission() - Use PUT /roles/:id with updated permissions array
 *    Example: { permissions: existingPermissions.filter(p => p !== 'removed_permission') }
 * 4. findByCode() - Use GET /roles?code=ROLE001 (đã có trong getAll)
 * 5. getRolesWithUserCount() - CHƯA TẠO, đợi frontend yêu cầu cho dashboard
 * 6. getStatistics() - CHƯA TẠO, đợi frontend yêu cầu cho reports
 * 7. findAllRoles() - Đã dùng trong getAll
 * 
 * Permission Management Pattern:
 * Frontend should:
 * 1. GET /roles/:id to get current permissions
 * 2. Modify permissions array in client
 * 3. PUT /roles/:id with new permissions array
 * 
 * This is simpler and more RESTful than having separate add/remove endpoints.
 */

module.exports = rolesRouter
