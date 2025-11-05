const userAccountsRouter = require('express').Router()
const UserAccount = require('../models/userAccount')
const bcrypt = require('bcrypt')

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
        .populate('employee')
        .sort({ createdAt: -1 })
    } else {
      users = await UserAccount.find({ ...filter, isActive: true })
        .populate('role', 'roleName permissions')
        .populate('employee')
        .sort({ createdAt: -1 })
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
      .populate('employee')

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
    const existingUser = await UserAccount.findOne({
      $or: [
        { username: username },
        { email: email.toLowerCase() }
      ]
    })
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
    await user.populate('employee')

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
    user.isActive = false
    user.tokens = []
    await user.save()

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

module.exports = userAccountsRouter
