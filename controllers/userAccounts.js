const userAccountsRouter = require('express').Router()
const UserAccount = require('../models/userAccount')
const Employee = require('../models/employee')
const Role = require('../models/role')
const Department = require('../models/department')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const { userExtractor, isAdmin } = require('../utils/auth')

// GET /api/user-accounts - Get all user accounts (Admin only)
userAccountsRouter.get('/', userExtractor, isAdmin, async (request, response) => {
  try {
    const { is_active, role_id, search, limit } = request.query

    // Build filter
    const filter = {}
    if (is_active !== undefined) {
      filter.isActive = is_active === 'true'
    }
    if (role_id) {
      filter.role = role_id
    }
    if (search) {
      filter.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { userCode: { $regex: search, $options: 'i' } }
      ]
    }

    const userAccounts = await UserAccount.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit ? parseInt(limit) : 100)

    const accountsData = userAccounts.map(account => ({
      id: account._id,
      userCode: account.userCode,
      username: account.username,
      email: account.email,
      roleId: account.role,
      isActive: account.isActive,
      lastLogin: account.lastLogin,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt
    }))

    response.status(200).json({
      success: true,
      data: {
        userAccounts: accountsData
      }
    })
  } catch (error) {
    response.status(500).json({
      error: 'Failed to fetch user accounts'
    })
  }
})

// GET /api/user-accounts/stats/overview - Get user account statistics (Admin only)
userAccountsRouter.get('/stats/overview', userExtractor, isAdmin, async (request, response) => {
  try {
    const stats = await UserAccount.getStatistics()

    response.status(200).json({
      success: true,
      data: {
        statistics: stats
      }
    })
  } catch (error) {
    response.status(500).json({
      error: 'Failed to fetch user account statistics'
    })
  }
})

// GET /api/user-accounts/active - Get active user accounts (Admin only)
userAccountsRouter.get('/active', userExtractor, isAdmin, async (request, response) => {
  try {
    const activeUsers = await UserAccount.findActiveUsers()

    const usersData = activeUsers.map(user => ({
      id: user._id,
      userCode: user.userCode,
      username: user.username,
      email: user.email,
      roleId: user.role?._id,
      isActive: user.isActive,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt
    }))

    response.status(200).json({
      success: true,
      data: {
        activeUsers: usersData
      }
    })
  } catch (error) {
    response.status(500).json({
      error: 'Failed to fetch active users'
    })
  }
})

// GET /api/user-accounts/me - Get current user profile
userAccountsRouter.get('/me', userExtractor, async (request, response) => {
  try {
    const user = await UserAccount.findById(request.user.id)
      .populate('role', 'roleCode roleName permissions')

    if (!user) {
      return response.status(404).json({
        error: 'User not found'
      })
    }

    // Get employee profile if exists
    const employee = await Employee.findOne({ userAccount: user._id })
      .populate({
        path: 'department',
        select: 'departmentName departmentCode',
        model: 'Department'
      })

    response.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          userCode: user.userCode,
          username: user.username,
          email: user.email,
          role: user.role ? {
            id: user.role._id,
            roleCode: user.role.roleCode,
            roleName: user.role.roleName
          } : null,
          isActive: user.isActive,
          lastLogin: user.lastLogin,
          employee: employee ? {
            id: employee._id,
            fullName: employee.fullName,
            phone: employee.phone,
            address: employee.address,
            dateOfBirth: employee.dateOfBirth,
            department: employee.department ? {
              id: employee.department._id,
              departmentName: employee.department.departmentName,
              departmentCode: employee.department.departmentCode
            } : null
          } : null,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        }
      }
    })
  } catch (error) {
    console.error('Error fetching user profile:', error)
    response.status(500).json({
      error: 'Failed to fetch user profile',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

// GET /api/user-accounts/username/:username - Get user by username (Admin only)
userAccountsRouter.get('/username/:username', userExtractor, isAdmin, async (request, response) => {
  try {
    const user = await UserAccount.findOne({ username: request.params.username })

    if (!user) {
      return response.status(404).json({
        error: 'User not found'
      })
    }

    response.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          userCode: user.userCode,
          username: user.username,
          email: user.email,
          roleId: user.role,
          isActive: user.isActive,
          lastLogin: user.lastLogin,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        }
      }
    })
  } catch (error) {
    response.status(500).json({
      error: 'Failed to fetch user'
    })
  }
})

// GET /api/user-accounts/:id - Get single user account (Admin only)
userAccountsRouter.get('/:id', userExtractor, isAdmin, async (request, response) => {
  try {
    const user = await UserAccount.findById(request.params.id)

    if (!user) {
      return response.status(404).json({
        error: 'User account not found'
      })
    }

    // Get employee profile if exists
    const employee = await Employee.findOne({ userAccount: user._id })
      .populate('department', 'departmentName')

    response.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          userCode: user.userCode,
          username: user.username,
          email: user.email,
          roleId: user.role,
          isActive: user.isActive,
          lastLogin: user.lastLogin,
          employeeId: employee?._id,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid user account ID'
      })
    }
    response.status(500).json({
      error: 'Failed to fetch user account'
    })
  }
})

// POST /api/user-accounts/register - Register new user account (Admin only)
userAccountsRouter.post('/register', userExtractor, isAdmin, async (request, response) => {
  const { username, email, password, roleId } = request.body

  if (!username) {
    return response.status(400).json({
      error: 'Username is required'
    })
  }

  if (!email) {
    return response.status(400).json({
      error: 'Email is required'
    })
  }

  if (!password) {
    return response.status(400).json({
      error: 'Password is required'
    })
  }

  if (password.length < 6) {
    return response.status(400).json({
      error: 'Password must be at least 6 characters long'
    })
  }

  if (!roleId) {
    return response.status(400).json({
      error: 'Role is required'
    })
  }

  try {
    // Verify role exists
    const role = await Role.findById(roleId)
    if (!role) {
      return response.status(400).json({
        error: 'Role not found'
      })
    }

    // Check if username already exists
    const existingUsername = await UserAccount.findOne({ username })
    if (existingUsername) {
      return response.status(400).json({
        error: 'Username already exists'
      })
    }

    // Check if email already exists
    const existingEmail = await UserAccount.findOne({ email: email.toLowerCase() })
    if (existingEmail) {
      return response.status(400).json({
        error: 'Email already exists'
      })
    }

    // Hash password
    const saltRounds = 10
    const passwordHash = await bcrypt.hash(password, saltRounds)

    const userAccount = new UserAccount({
      username,
      email: email.toLowerCase(),
      passwordHash,
      role: roleId,
      isActive: true
    })

    const savedUser = await userAccount.save()

    response.status(201).json({
      success: true,
      message: 'User account created successfully',
      data: {
        user: {
          id: savedUser._id,
          userCode: savedUser.userCode,
          username: savedUser.username,
          email: savedUser.email,
          roleId: savedUser.role,
          isActive: savedUser.isActive,
          createdAt: savedUser.createdAt
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
        error: 'Username or email already exists'
      })
    }
    response.status(500).json({
      error: 'Failed to create user account'
    })
  }
})

// POST /api/user-accounts/signup - Public registration (auto-assigns default role)
userAccountsRouter.post('/signup', async (request, response) => {
  const { username, email, password, fullName } = request.body

  if (!username) {
    return response.status(400).json({
      error: 'Username is required'
    })
  }

  if (!email) {
    return response.status(400).json({
      error: 'Email is required'
    })
  }

  if (!password) {
    return response.status(400).json({
      error: 'Password is required'
    })
  }

  if (password.length < 6) {
    return response.status(400).json({
      error: 'Password must be at least 6 characters long'
    })
  }

  try {
    // Check if username already exists
    const existingUsername = await UserAccount.findOne({ username })
    if (existingUsername) {
      return response.status(400).json({
        error: 'Username already exists'
      })
    }

    // Check if email already exists
    const existingEmail = await UserAccount.findOne({ email: email.toLowerCase() })
    if (existingEmail) {
      return response.status(400).json({
        error: 'Email already exists'
      })
    }

    // Find default Admin role for signup (ROLE001)
    // For admin dashboard, new registrations should default to Admin role
    let defaultRole = await Role.findOne({ roleCode: 'ROLE001' }) // Admin role
    if (!defaultRole) {
      // If Admin role doesn't exist, try to find any role or create one
      defaultRole = await Role.findOne({ roleName: 'Admin' })
      if (!defaultRole) {
        return response.status(500).json({
          error: 'System error: Default role not found. Please run setup:roles script first.'
        })
      }
    }

    // Hash password
    const saltRounds = 10
    const passwordHash = await bcrypt.hash(password, saltRounds)

    const userAccount = new UserAccount({
      username,
      email: email.toLowerCase(),
      passwordHash,
      role: defaultRole._id,
      isActive: true
    })

    const savedUser = await userAccount.save()

    // Create employee profile automatically
    let employee = null
    if (fullName) {
      try {
        employee = await Employee.create({
          fullName: fullName,
          userAccount: savedUser._id,
          department: null // Can be updated later
        })
        console.log(`✅ Employee profile created for user: ${savedUser.username}`)
      } catch (err) {
        console.error('❌ Failed to create employee profile:', err.message)
        // Continue even if employee creation fails - user account is still created
      }
    }

    response.status(201).json({
      success: true,
      message: 'Registration successful! Please login with your credentials.',
      data: {
        user: {
          id: savedUser._id,
          userCode: savedUser.userCode,
          username: savedUser.username,
          email: savedUser.email,
          employeeId: employee?._id,
          createdAt: savedUser.createdAt
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
        error: 'Username or email already exists'
      })
    }
    response.status(500).json({
      error: 'Failed to create account'
    })
  }
})

// POST /api/user-accounts/login - Login
userAccountsRouter.post('/login', async (request, response) => {
  const { identifier, password } = request.body

  if (!identifier) {
    return response.status(400).json({
      error: 'Username or email is required'
    })
  }

  if (!password) {
    return response.status(400).json({
      error: 'Password is required'
    })
  }

  try {
    // Find user by username or email
    const user = await UserAccount.findByUsernameOrEmail(identifier)
      .populate('role', 'roleCode roleName permissions')

    if (!user) {
      return response.status(401).json({
        error: 'Invalid username/email or password'
      })
    }

    // Check if account is active
    if (!user.isActive) {
      return response.status(403).json({
        error: 'Account is inactive. Please contact administrator.'
      })
    }

    // Verify password
    const passwordCorrect = await bcrypt.compare(password, user.passwordHash)
    if (!passwordCorrect) {
      return response.status(401).json({
        error: 'Invalid username/email or password'
      })
    }

    // Generate JWT token
    const userForToken = {
      id: user._id,
      username: user.username,
      email: user.email
    }

    const token = jwt.sign(userForToken, process.env.JWT_SECRET, {
      expiresIn: '7d'
    })

    // Save token to user's tokens array
    await user.generateAuthToken(token)

    // Update last login
    await user.updateLastLogin()

    response.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user._id,
          userCode: user.userCode,
          username: user.username,
          email: user.email,
          roleId: user.role?._id,
          isActive: user.isActive,
          lastLogin: user.lastLogin
        }
      }
    })
  } catch (error) {
    response.status(500).json({
      error: 'Login failed'
    })
  }
})

// POST /api/user-accounts/logout - Logout
userAccountsRouter.post('/logout', userExtractor, async (request, response) => {
  try {
    const user = await UserAccount.findById(request.user.id)

    if (!user) {
      return response.status(404).json({
        error: 'User not found'
      })
    }

    // Remove current token
    await user.removeToken(request.token)

    response.status(200).json({
      success: true,
      message: 'Logout successful'
    })
  } catch (error) {
    response.status(500).json({
      error: 'Logout failed'
    })
  }
})

// POST /api/user-accounts/logout-all - Logout from all devices
userAccountsRouter.post('/logout-all', userExtractor, async (request, response) => {
  try {
    const user = await UserAccount.findById(request.user.id)

    if (!user) {
      return response.status(404).json({
        error: 'User not found'
      })
    }

    // Clear all tokens
    await user.clearAllTokens()

    response.status(200).json({
      success: true,
      message: 'Logged out from all devices successfully'
    })
  } catch (error) {
    response.status(500).json({
      error: 'Logout failed'
    })
  }
})

// PUT /api/user-accounts/:id - Update user account (Admin only)
userAccountsRouter.put('/:id', userExtractor, isAdmin, async (request, response) => {
  const { username, email, roleId } = request.body

  try {
    const user = await UserAccount.findById(request.params.id)

    if (!user) {
      return response.status(404).json({
        error: 'User account not found'
      })
    }

    // Check username uniqueness if changing
    if (username && username !== user.username) {
      const existingUsername = await UserAccount.findOne({
        username,
        _id: { $ne: user._id }
      })
      if (existingUsername) {
        return response.status(400).json({
          error: 'Username already exists'
        })
      }
      user.username = username
    }

    // Check email uniqueness if changing
    if (email && email.toLowerCase() !== user.email) {
      const existingEmail = await UserAccount.findOne({
        email: email.toLowerCase(),
        _id: { $ne: user._id }
      })
      if (existingEmail) {
        return response.status(400).json({
          error: 'Email already exists'
        })
      }
      user.email = email.toLowerCase()
    }

    // Update role if provided and verify it exists
    if (roleId && roleId !== user.role.toString()) {
      const role = await Role.findById(roleId)
      if (!role) {
        return response.status(400).json({
          error: 'Role not found'
        })
      }
      user.role = roleId
    }

    const updatedUser = await user.save()

    response.status(200).json({
      success: true,
      message: 'User account updated successfully',
      data: {
        user: {
          id: updatedUser._id,
          userCode: updatedUser.userCode,
          username: updatedUser.username,
          email: updatedUser.email,
          roleId: updatedUser.role,
          isActive: updatedUser.isActive,
          updatedAt: updatedUser.updatedAt
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
        error: 'Invalid user account ID'
      })
    }
    response.status(500).json({
      error: 'Failed to update user account'
    })
  }
})

// PATCH /api/user-accounts/:id/change-password - Change password (Admin or Self)
userAccountsRouter.patch('/:id/change-password', userExtractor, async (request, response) => {
  const { currentPassword, newPassword } = request.body

  // Check if user is admin or changing own password
  const isOwnAccount = request.user.id === request.params.id
  const isAdminUser = request.user.role?.roleName === 'Admin' ||
    request.user.role?.permissions?.includes('admin.all')

  if (!isOwnAccount && !isAdminUser) {
    return response.status(403).json({
      error: 'You can only change your own password'
    })
  }

  if (!newPassword) {
    return response.status(400).json({
      error: 'New password is required'
    })
  }

  if (newPassword.length < 6) {
    return response.status(400).json({
      error: 'New password must be at least 6 characters long'
    })
  }

  try {
    const user = await UserAccount.findById(request.params.id)

    if (!user) {
      return response.status(404).json({
        error: 'User account not found'
      })
    }

    // If user is changing own password, verify current password
    if (isOwnAccount && !isAdminUser) {
      if (!currentPassword) {
        return response.status(400).json({
          error: 'Current password is required'
        })
      }

      const passwordCorrect = await bcrypt.compare(currentPassword, user.passwordHash)
      if (!passwordCorrect) {
        return response.status(401).json({
          error: 'Current password is incorrect'
        })
      }
    }

    // Hash new password
    const saltRounds = 10
    const passwordHash = await bcrypt.hash(newPassword, saltRounds)
    user.passwordHash = passwordHash

    // Clear all tokens (force re-login)
    user.tokens = []

    await user.save()

    response.status(200).json({
      success: true,
      message: 'Password changed successfully. Please login again.'
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid user account ID'
      })
    }
    response.status(500).json({
      error: 'Failed to change password'
    })
  }
})

// PATCH /api/user-accounts/:id/deactivate - Deactivate user account (Admin only)
userAccountsRouter.patch('/:id/deactivate', userExtractor, isAdmin, async (request, response) => {
  try {
    const user = await UserAccount.findById(request.params.id)

    if (!user) {
      return response.status(404).json({
        error: 'User account not found'
      })
    }

    if (!user.isActive) {
      return response.status(400).json({
        error: 'User account is already inactive'
      })
    }

    // Prevent deactivating own account
    if (request.user.id === user._id.toString()) {
      return response.status(400).json({
        error: 'You cannot deactivate your own account'
      })
    }

    await user.deactivate()

    response.status(200).json({
      success: true,
      message: 'User account deactivated successfully',
      data: {
        user: {
          id: user._id,
          userCode: user.userCode,
          username: user.username,
          isActive: user.isActive,
          updatedAt: user.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid user account ID'
      })
    }
    response.status(500).json({
      error: 'Failed to deactivate user account'
    })
  }
})

// PATCH /api/user-accounts/:id/activate - Activate user account (Admin only)
userAccountsRouter.patch('/:id/activate', userExtractor, isAdmin, async (request, response) => {
  try {
    const user = await UserAccount.findById(request.params.id)

    if (!user) {
      return response.status(404).json({
        error: 'User account not found'
      })
    }

    if (user.isActive) {
      return response.status(400).json({
        error: 'User account is already active'
      })
    }

    await user.activate()

    response.status(200).json({
      success: true,
      message: 'User account activated successfully',
      data: {
        user: {
          id: user._id,
          userCode: user.userCode,
          username: user.username,
          isActive: user.isActive,
          updatedAt: user.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid user account ID'
      })
    }
    response.status(500).json({
      error: 'Failed to activate user account'
    })
  }
})

// DELETE /api/user-accounts/:id - Delete user account (Admin only, strict conditions)
userAccountsRouter.delete('/:id', userExtractor, isAdmin, async (request, response) => {
  try {
    const user = await UserAccount.findById(request.params.id)

    if (!user) {
      return response.status(404).json({
        error: 'User account not found'
      })
    }

    // Prevent deleting own account
    if (request.user.id === user._id.toString()) {
      return response.status(400).json({
        error: 'You cannot delete your own account'
      })
    }

    // Check if account is already inactive (safety check)
    if (user.isActive) {
      return response.status(400).json({
        error: 'Please deactivate the account before deleting'
      })
    }

    // Check if there's an associated employee profile
    const employee = await Employee.findOne({ userAccount: user._id })
    if (employee) {
      return response.status(400).json({
        error: 'Cannot delete user account with associated employee profile. Please delete employee profile first.'
      })
    }

    await UserAccount.findByIdAndDelete(request.params.id)

    response.status(200).json({
      success: true,
      message: 'User account deleted successfully'
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid user account ID'
      })
    }
    response.status(500).json({
      error: 'Failed to delete user account'
    })
  }
})

module.exports = userAccountsRouter
