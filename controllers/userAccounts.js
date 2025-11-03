const userAccountsRouter = require('express').Router()
const UserAccount = require('../models/userAccount')
const bcrypt = require('bcrypt')

/**
 * User Account Controller
 * 
 * Nguyên tắc: CHỈ 5 CRUD endpoints cơ bản
 * - KHÔNG tạo custom endpoints từ đầu
 * - Custom endpoints chỉ thêm khi frontend yêu cầu cụ thể
 * - Sử dụng query parameters cho filtering
 */

/**
 * @route   GET /api/user-accounts
 * @desc    Get all user accounts (with optional filters)
 * @access  Private (Admin/Manager)
 * @query   isActive: boolean - Filter by active status
 * @query   search: string - Search by username or email
 * @query   role: string - Filter by role ID
 */
userAccountsRouter.get('/', async (request, response) => {
  try {
    const { isActive, search, role } = request.query

    // Build filter object
    const filter = {}

    if (isActive !== undefined) {
      filter.isActive = isActive === 'true'
    }

    if (role) {
      filter.role = role
    }

    // Use static method from model
    let users
    if (search) {
      // Search by username or email
      users = await UserAccount.find({
        ...filter,
        $or: [
          { username: new RegExp(search, 'i') },
          { email: new RegExp(search, 'i') }
        ]
      })
        .populate('role', 'roleName permissions')
        .populate({
          path: 'employee',
          populate: {
            path: 'department',
            select: 'departmentName'
          }
        })
        .sort({ createdAt: -1 })
    } else {
      users = await UserAccount.findActiveUsers(filter)
    }

    response.json({
      success: true,
      data: {
        users,
        count: users.length
      }
    })
  } catch (error) {
    console.error('Error in getAll users:', error)
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch user accounts',
        details: error.message
      }
    })
  }
})

/**
 * @route   GET /api/user-accounts/:id
 * @desc    Get user account by ID
 * @access  Private
 */
userAccountsRouter.get('/:id', async (request, response) => {
  try {
    const user = await UserAccount.findById(request.params.id)
      .populate('role', 'roleName permissions')
      .populate({
        path: 'employee',
        populate: {
          path: 'department',
          select: 'departmentName'
        }
      })

    if (!user) {
      return response.status(404).json({
        success: false,
        error: {
          message: 'User account not found',
          code: 'USER_NOT_FOUND'
        }
      })
    }

    response.json({
      success: true,
      data: { user }
    })
  } catch (error) {
    console.error('Error in getById user:', error)
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch user account',
        details: error.message
      }
    })
  }
})

/**
 * @route   POST /api/user-accounts
 * @desc    Create new user account
 * @access  Private (Admin only)
 * @body    { username, email, password, role, isActive }
 */
userAccountsRouter.post('/', async (request, response) => {
  try {
    const { username, email, password, role, isActive } = request.body

    // Validate required fields
    if (!username || !email || !password || !role) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Missing required fields',
          code: 'MISSING_FIELDS',
          details: {
            required: ['username', 'email', 'password', 'role']
          }
        }
      })
    }

    // Check if username or email already exists
    const existingUser = await UserAccount.findByUsernameOrEmail(username)
    if (existingUser) {
      return response.status(409).json({
        success: false,
        error: {
          message: 'Username or email already exists',
          code: 'USER_EXISTS'
        }
      })
    }

    // Hash password
    const saltRounds = 10
    const passwordHash = await bcrypt.hash(password, saltRounds)

    // Create user
    const user = new UserAccount({
      username,
      email,
      passwordHash,
      role,
      isActive: isActive !== undefined ? isActive : true
    })

    await user.save()

    // Populate before returning
    await user.populate('role', 'roleName permissions')

    response.status(201).json({
      success: true,
      data: { user },
      message: 'User account created successfully'
    })
  } catch (error) {
    console.error('Error in create user:', error)

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
        message: 'Failed to create user account',
        details: error.message
      }
    })
  }
})

/**
 * @route   PUT /api/user-accounts/:id
 * @desc    Update user account
 * @access  Private (Admin or own account)
 * @body    { username, email, password, role, isActive }
 */
userAccountsRouter.put('/:id', async (request, response) => {
  try {
    const { username, email, password, role, isActive } = request.body

    const user = await UserAccount.findById(request.params.id)

    if (!user) {
      return response.status(404).json({
        success: false,
        error: {
          message: 'User account not found',
          code: 'USER_NOT_FOUND'
        }
      })
    }

    // Update fields if provided
    if (username) user.username = username
    if (email) user.email = email
    if (role) user.role = role
    if (isActive !== undefined) user.isActive = isActive

    // Update password if provided
    if (password) {
      const saltRounds = 10
      user.passwordHash = await bcrypt.hash(password, saltRounds)
    }

    await user.save()

    // Populate before returning
    await user.populate('role', 'roleName permissions')
    await user.populate({
      path: 'employee',
      populate: {
        path: 'department',
        select: 'departmentName'
      }
    })

    response.json({
      success: true,
      data: { user },
      message: 'User account updated successfully'
    })
  } catch (error) {
    console.error('Error in update user:', error)

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
        message: 'Failed to update user account',
        details: error.message
      }
    })
  }
})

/**
 * @route   DELETE /api/user-accounts/:id
 * @desc    Delete user account (soft delete by deactivating)
 * @access  Private (Admin only)
 * @note    Soft delete: set isActive = false instead of removing from database
 */
userAccountsRouter.delete('/:id', async (request, response) => {
  try {
    const user = await UserAccount.findById(request.params.id)

    if (!user) {
      return response.status(404).json({
        success: false,
        error: {
          message: 'User account not found',
          code: 'USER_NOT_FOUND'
        }
      })
    }

    // Soft delete: deactivate user and clear all tokens
    await user.deactivate()

    response.json({
      success: true,
      message: 'User account deactivated successfully'
    })
  } catch (error) {
    console.error('Error in delete user:', error)
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to delete user account',
        details: error.message
      }
    })
  }
})

/**
 * Methods NOT implemented as endpoints (and why):
 * 
 * 1. generateAuthToken() - Internal use only, handled by auth middleware
 * 2. removeToken() - Internal use only, handled by logout endpoint in auth
 * 3. clearAllTokens() - Internal use only, handled by logout-all endpoint in auth
 * 4. updateLastLogin() - Internal use only, handled by auth middleware
 * 5. findByUsernameOrEmail() - Internal use only, used in login process
 * 6. activate() - Use PUT /user-accounts/:id with { isActive: true }
 * 7. deactivate() - Already handled in delete() method
 * 8. getStatistics() - CHƯA TẠO, đợi frontend yêu cầu
 * 
 * These methods are part of the model for code organization and reusability,
 * but don't need dedicated controller endpoints. They're either:
 * - Used internally by other parts of the system
 * - Can be handled through existing CRUD endpoints
 * - Will be added later when frontend requests them
 */

module.exports = userAccountsRouter
