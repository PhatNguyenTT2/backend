const userAccountsRouter = require('express').Router()
const UserAccount = require('../models/userAccount')
const bcrypt = require('bcrypt')
const { generateResetToken, hashResetToken, getResetTokenExpiration } = require('../utils/resetPasswordHelpers')

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
      .populate('role', 'roleName permissions')

    if (!user) {
      return response.status(404).json({
        success: false,
        error: {
          message: 'User account not found',
          code: 'USER_NOT_FOUND'
        }
      })
    }

    // 🔒 Check if trying to modify protected account's critical fields
    if (user.isProtected) {
      // Check if trying to change role
      if (role && role.toString() !== user.role._id.toString()) {
        const Role = require('../models/role')
        const newRole = await Role.findById(role)
        const isChangingFromSuperAdmin = !(newRole && newRole.permissions && newRole.permissions.includes('all'))

        if (isChangingFromSuperAdmin) {
          return response.status(403).json({
            success: false,
            error: {
              message: 'Cannot change role of protected super admin account',
              code: 'PROTECTED_ACCOUNT'
            }
          })
        }
      }

      // Check if trying to deactivate
      if (isActive === false) {
        return response.status(403).json({
          success: false,
          error: {
            message: 'Cannot deactivate protected super admin account',
            code: 'PROTECTED_ACCOUNT'
          }
        })
      }
    }

    // 🔒 Check if trying to deactivate or change role of last super admin
    const isSuperAdmin = user.role &&
      user.role.permissions &&
      user.role.permissions.includes('all')

    if (isSuperAdmin) {
      const willBeDeactivated = isActive === false

      let willLoseSuperAdminRole = false
      if (role && role.toString() !== user.role._id.toString()) {
        const Role = require('../models/role')
        const newRole = await Role.findById(role)
        willLoseSuperAdminRole = !(newRole && newRole.permissions && newRole.permissions.includes('all'))
      }

      if (willBeDeactivated || willLoseSuperAdminRole) {
        // Check if this is the last active super admin
        const superAdminCount = await UserAccount.countDocuments({
          role: user.role._id,
          isActive: true,
          _id: { $ne: user._id }
        })

        if (superAdminCount === 0) {
          return response.status(403).json({
            success: false,
            error: {
              message: 'Cannot modify the last active super admin account',
              code: 'LAST_SUPERADMIN'
            }
          })
        }
      }
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
      .populate('role', 'roleName permissions')

    if (!user) {
      return response.status(404).json({
        success: false,
        error: {
          message: 'User account not found',
          code: 'USER_NOT_FOUND'
        }
      })
    }

    // 🔒 Check if protected
    if (user.isProtected) {
      return response.status(403).json({
        success: false,
        error: {
          message: 'Cannot delete protected super admin account',
          code: 'PROTECTED_ACCOUNT'
        }
      })
    }

    // 🔒 Check if any Employee references this UserAccount
    const Employee = require('../models/employee')
    const linkedEmployee = await Employee.findOne({ userAccount: user._id })

    if (linkedEmployee) {
      return response.status(400).json({
        success: false,
        error: {
          message: `Cannot delete user account - Employee "${linkedEmployee.fullName}" still references it`,
          code: 'EMPLOYEE_REFERENCE_EXISTS',
          details: {
            employeeId: linkedEmployee._id,
            employeeName: linkedEmployee.fullName,
            suggestion: 'Please delete or deactivate the Employee first'
          }
        }
      })
    }

    // 🔒 Check if this is a super admin
    const isSuperAdmin = user.role &&
      user.role.permissions &&
      user.role.permissions.includes('all')

    if (isSuperAdmin) {
      // Check if this is the last active super admin
      const superAdminCount = await UserAccount.countDocuments({
        role: user.role._id,
        isActive: true,
        _id: { $ne: user._id }
      })

      if (superAdminCount === 0) {
        return response.status(403).json({
          success: false,
          error: {
            message: 'Cannot delete the last active super admin account',
            code: 'LAST_SUPERADMIN'
          }
        })
      }
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

    // Handle reference constraint errors from model middleware
    if (error.name === 'ReferenceConstraintError') {
      return response.status(400).json({
        success: false,
        error: {
          message: error.message,
          code: error.code,
          details: {
            employeeId: error.employeeId,
            employeeName: error.employeeName
          }
        }
      })
    }

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
 * @route   DELETE /api/user-accounts/:id/hard-delete
 * @desc    Hard delete user account (DANGEROUS - only for admin/testing)
 * @access  Private (Admin only)
 * @query   force=true (required for confirmation)
 * @note    This will be blocked by model middleware if Employee still references it
 */
userAccountsRouter.delete('/:id/hard-delete', async (request, response) => {
  try {
    const { force } = request.query

    // Require explicit confirmation
    if (force !== 'true') {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Hard delete requires explicit confirmation',
          code: 'CONFIRMATION_REQUIRED',
          details: {
            hint: 'Add ?force=true to the URL to confirm hard delete'
          }
        }
      })
    }

    const user = await UserAccount.findById(request.params.id)
      .populate('role', 'roleName permissions')

    if (!user) {
      return response.status(404).json({
        success: false,
        error: {
          message: 'User account not found',
          code: 'USER_NOT_FOUND'
        }
      })
    }

    // 🔒 Check if protected (extra safety)
    if (user.isProtected) {
      return response.status(403).json({
        success: false,
        error: {
          message: 'Cannot hard delete protected super admin account',
          code: 'PROTECTED_ACCOUNT'
        }
      })
    }

    // Attempt hard delete - middleware will check Employee references
    await UserAccount.findByIdAndDelete(request.params.id)

    console.log(`✅ Hard deleted UserAccount ${request.params.id} (${user.username})`)

    response.json({
      success: true,
      message: 'User account permanently deleted'
    })
  } catch (error) {
    console.error('Error in hard delete user:', error)

    // Handle reference constraint errors from model middleware
    if (error.name === 'ReferenceConstraintError') {
      return response.status(400).json({
        success: false,
        error: {
          message: error.message,
          code: error.code,
          details: {
            employeeId: error.employeeId,
            employeeName: error.employeeName,
            suggestion: 'Delete the Employee record first, then retry hard delete'
          }
        }
      })
    }

    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to hard delete user account',
        details: error.message
      }
    })
  }
})

/**
 * @route   POST /api/user-accounts/forgot-password
 * @desc    Request password reset - generates reset token
 * @access  Public
 * @body    { email }
 */
userAccountsRouter.post('/forgot-password', async (request, response) => {
  try {
    const { email } = request.body

    if (!email) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Email is required',
          code: 'MISSING_EMAIL'
        }
      })
    }

    // Find user by email
    const user = await UserAccount.findOne({
      email: email.toLowerCase()
    }).populate('role', 'roleName')

    if (!user) {
      // Don't reveal if email exists or not for security
      return response.json({
        success: true,
        message: 'If the email exists, a reset link will be sent'
      })
    }

    // Check if user is active
    if (!user.isActive) {
      return response.status(403).json({
        success: false,
        error: {
          message: 'Account is inactive. Please contact administrator.',
          code: 'ACCOUNT_INACTIVE'
        }
      })
    }

    // Generate reset token
    const resetToken = generateResetToken()
    const hashedToken = hashResetToken(resetToken)

    // Save hashed token and expiration to database
    user.resetPasswordToken = hashedToken
    user.resetPasswordExpire = getResetTokenExpiration()
    await user.save()

    // In production, you would send an email here
    // For now, return the token in response (DEV ONLY)
    console.log('Password reset token for', user.email, ':', resetToken)

    response.json({
      success: true,
      message: 'If the email exists, a reset link will be sent',
      // TODO: Remove this in production - only for development
      devOnly: {
        resetToken,
        userId: user._id,
        expiresAt: user.resetPasswordExpire
      }
    })
  } catch (error) {
    console.error('Error in forgot-password:', error)
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to process password reset request',
        details: error.message
      }
    })
  }
})

/**
 * @route   POST /api/user-accounts/reset-password
 * @desc    Reset password using reset token
 * @access  Public
 * @body    { resetToken, newPassword }
 */
userAccountsRouter.post('/reset-password', async (request, response) => {
  try {
    const { resetToken, newPassword } = request.body

    // Validate input
    if (!resetToken || !newPassword) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Reset token and new password are required',
          code: 'MISSING_FIELDS'
        }
      })
    }

    if (newPassword.length < 6) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Password must be at least 6 characters long',
          code: 'INVALID_PASSWORD'
        }
      })
    }

    // Hash the provided token to compare with stored hash
    const hashedToken = hashResetToken(resetToken)

    // Find user with valid reset token
    const user = await UserAccount.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() }
    })

    if (!user) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Invalid or expired reset token',
          code: 'INVALID_TOKEN'
        }
      })
    }

    // Check if user is active
    if (!user.isActive) {
      return response.status(403).json({
        success: false,
        error: {
          message: 'Account is inactive. Please contact administrator.',
          code: 'ACCOUNT_INACTIVE'
        }
      })
    }

    // Hash new password
    const saltRounds = 10
    const passwordHash = await bcrypt.hash(newPassword, saltRounds)

    // Update password and clear reset token fields
    user.passwordHash = passwordHash
    user.resetPasswordToken = null
    user.resetPasswordExpire = null

    // Clear all existing tokens (logout from all devices)
    user.tokens = []

    await user.save()

    response.json({
      success: true,
      message: 'Password has been reset successfully. Please login with your new password.'
    })
  } catch (error) {
    console.error('Error in reset-password:', error)
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to reset password',
        details: error.message
      }
    })
  }
})

/**
 * @route   POST /api/user-accounts/verify-reset-token
 * @desc    Verify if reset token is valid
 * @access  Public
 * @body    { resetToken }
 */
userAccountsRouter.post('/verify-reset-token', async (request, response) => {
  try {
    const { resetToken } = request.body

    if (!resetToken) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Reset token is required',
          code: 'MISSING_TOKEN'
        }
      })
    }

    // Hash the provided token
    const hashedToken = hashResetToken(resetToken)

    // Find user with valid reset token
    const user = await UserAccount.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() }
    }).select('email username')

    if (!user) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Invalid or expired reset token',
          code: 'INVALID_TOKEN'
        }
      })
    }

    response.json({
      success: true,
      data: {
        email: user.email,
        username: user.username
      }
    })
  } catch (error) {
    console.error('Error in verify-reset-token:', error)
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to verify reset token',
        details: error.message
      }
    })
  }
})

module.exports = userAccountsRouter
