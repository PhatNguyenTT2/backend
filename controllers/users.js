const usersRouter = require('express').Router()
const bcrypt = require('bcrypt')
const User = require('../models/user')
const Role = require('../models/role')
const Department = require('../models/department')
const { userExtractor, isAdmin } = require('../utils/auth')

// Helper function to generate next userCode
const generateUserCode = async () => {
  const lastUser = await User.findOne()
    .sort({ userCode: -1 })
    .limit(1)
    .select('userCode')

  if (!lastUser || !lastUser.userCode) {
    return 'USER001'
  }

  // Extract number from userCode (e.g., USER001 -> 1)
  const lastNumber = parseInt(lastUser.userCode.substring(4))
  const newNumber = lastNumber + 1

  // Format with leading zeros (e.g., 1 -> USER001, 25 -> USER025)
  return `USER${String(newNumber).padStart(3, '0')}`
}

// GET /api/users - Get all users (Admin only)
usersRouter.get('/', userExtractor, isAdmin, async (request, response) => {
  try {
    const { page = 1, per_page = 20, role, department, is_active } = request.query

    // Build filter
    const filter = {}
    if (role) filter.role = role
    if (department) filter.department = department
    if (is_active !== undefined) filter.isActive = is_active === 'true'

    // Pagination
    const pageNum = parseInt(page)
    const perPage = parseInt(per_page)
    const skip = (pageNum - 1) * perPage

    const users = await User.find(filter)
      .populate('role', 'roleId roleName')
      .populate('department', 'departmentId departmentName')
      .select('-passwordHash -tokens')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(perPage)

    const total = await User.countDocuments(filter)
    const totalPages = Math.ceil(total / perPage)

    response.status(200).json({
      success: true,
      data: {
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
    response.status(500).json({
      error: 'Failed to fetch users'
    })
  }
})

// GET /api/users/:id - Get single user (Admin or self)
usersRouter.get('/:id', userExtractor, async (request, response) => {
  try {
    const user = await User.findById(request.params.id)
      .populate('role', 'roleId roleName permissions')
      .populate('department', 'departmentId departmentName location')
      .select('-passwordHash -tokens')

    if (!user) {
      return response.status(404).json({
        error: 'User not found'
      })
    }

    // Check access: Admin can see all, users can only see themselves
    const userRole = await Role.findById(request.user.role)
    if (userRole?.roleId !== 'ADMIN' &&
      request.user._id.toString() !== user._id.toString()) {
      return response.status(403).json({
        error: 'Access denied'
      })
    }

    response.status(200).json({
      success: true,
      data: { user }
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid user ID'
      })
    }
    response.status(500).json({
      error: 'Failed to fetch user'
    })
  }
})

// POST /api/users - Create new user (Admin only)
usersRouter.post('/', userExtractor, isAdmin, async (request, response) => {
  const { username, email, fullName, password, role, department } = request.body

  // Validation
  if (!username || !email || !fullName || !password || !role) {
    return response.status(400).json({
      error: 'All fields are required (username, email, fullName, password, role)'
    })
  }

  if (password.length < 6) {
    return response.status(400).json({
      error: 'Password must be at least 6 characters long'
    })
  }

  try {
    // Check if username exists
    const existingUser = await User.findOne({ username })
    if (existingUser) {
      return response.status(400).json({
        error: 'Username already exists'
      })
    }

    // Check if email exists
    const existingEmail = await User.findOne({ email })
    if (existingEmail) {
      return response.status(400).json({
        error: 'Email already exists'
      })
    }

    // Validate role exists
    const roleExists = await Role.findById(role)
    if (!roleExists) {
      return response.status(400).json({
        error: 'Invalid role ID'
      })
    }

    // Validate department if provided
    if (department) {
      const departmentExists = await Department.findById(department)
      if (!departmentExists) {
        return response.status(400).json({
          error: 'Invalid department ID'
        })
      }
    }

    // Generate userCode
    const userCode = await generateUserCode()

    // Hash password
    const saltRounds = 10
    const passwordHash = await bcrypt.hash(password, saltRounds)

    // Create user
    const user = new User({
      userCode,
      username,
      email,
      fullName,
      passwordHash,
      role,
      department,
      isActive: true
    })

    const savedUser = await user.save()

    // Populate role and department for response
    const populatedUser = await User.findById(savedUser._id)
      .populate('role', 'roleId roleName')
      .populate('department', 'departmentId departmentName')
      .select('-passwordHash -tokens')

    response.status(201).json({
      success: true,
      message: 'User created successfully',
      data: { user: populatedUser }
    })
  } catch (error) {
    if (error.name === 'ValidationError') {
      return response.status(400).json({
        error: error.message
      })
    }
    response.status(500).json({
      error: 'Failed to create user'
    })
  }
})

// PUT /api/users/:id - Update user (Admin or self)
usersRouter.put('/:id', userExtractor, async (request, response) => {
  const { email, fullName, password, role, department } = request.body

  try {
    const user = await User.findById(request.params.id)

    if (!user) {
      return response.status(404).json({
        error: 'User not found'
      })
    }

    // Check access: Admin can update anyone, users can only update themselves
    const userRole = await Role.findById(request.user.role)
    const isAdmin = userRole?.roleId === 'ADMIN'
    const isSelf = request.user._id.toString() === user._id.toString()

    if (!isAdmin && !isSelf) {
      return response.status(403).json({
        error: 'Access denied'
      })
    }

    // Update fields
    if (email) {
      // Check if email is already used by another user
      const existingEmail = await User.findOne({
        email,
        _id: { $ne: user._id }
      })
      if (existingEmail) {
        return response.status(400).json({
          error: 'Email already in use'
        })
      }
      user.email = email
    }

    if (fullName) user.fullName = fullName

    // Only admin can update role and department
    if (role && isAdmin) {
      const roleExists = await Role.findById(role)
      if (!roleExists) {
        return response.status(400).json({
          error: 'Invalid role ID'
        })
      }
      user.role = role
    }

    if (department !== undefined && isAdmin) {
      if (department) {
        const departmentExists = await Department.findById(department)
        if (!departmentExists) {
          return response.status(400).json({
            error: 'Invalid department ID'
          })
        }
      }
      user.department = department
    }

    if (password) {
      if (password.length < 6) {
        return response.status(400).json({
          error: 'Password must be at least 6 characters long'
        })
      }
      const saltRounds = 10
      user.passwordHash = await bcrypt.hash(password, saltRounds)
      // Clear all tokens on password change
      user.tokens = []
    }

    await user.save()

    const updatedUser = await User.findById(user._id)
      .populate('role', 'roleId roleName')
      .populate('department', 'departmentId departmentName')
      .select('-passwordHash -tokens')

    response.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: { user: updatedUser }
    })
  } catch (error) {
    if (error.name === 'ValidationError') {
      return response.status(400).json({
        error: error.message
      })
    }
    response.status(500).json({
      error: 'Failed to update user'
    })
  }
})

// PATCH /api/users/:id/role - Update user role (Admin only)
usersRouter.patch('/:id/role', userExtractor, isAdmin, async (request, response) => {
  const { role } = request.body

  if (!role) {
    return response.status(400).json({
      error: 'Role ID is required'
    })
  }

  try {
    // Validate role exists
    const roleExists = await Role.findById(role)
    if (!roleExists) {
      return response.status(400).json({
        error: 'Invalid role ID'
      })
    }

    const user = await User.findByIdAndUpdate(
      request.params.id,
      { role },
      { new: true }
    )
      .populate('role', 'roleId roleName')
      .populate('department', 'departmentId departmentName')
      .select('-passwordHash -tokens')

    if (!user) {
      return response.status(404).json({
        error: 'User not found'
      })
    }

    response.status(200).json({
      success: true,
      message: 'User role updated successfully',
      data: { user }
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid ID format'
      })
    }
    response.status(500).json({
      error: 'Failed to update user role'
    })
  }
})

// PATCH /api/users/:id/status - Activate/deactivate user (Admin only)
usersRouter.patch('/:id/status', userExtractor, isAdmin, async (request, response) => {
  const { isActive } = request.body

  if (typeof isActive !== 'boolean') {
    return response.status(400).json({
      error: 'isActive must be a boolean'
    })
  }

  try {
    const user = await User.findById(request.params.id)

    if (!user) {
      return response.status(404).json({
        error: 'User not found'
      })
    }

    // Prevent admin from deactivating themselves
    if (request.user._id.toString() === user._id.toString() && !isActive) {
      return response.status(400).json({
        error: 'You cannot deactivate your own account'
      })
    }

    user.isActive = isActive
    // Clear tokens if deactivating
    if (!isActive) {
      user.tokens = []
    }
    await user.save()

    const updatedUser = await User.findById(user._id)
      .populate('role', 'roleId roleName')
      .populate('department', 'departmentId departmentName')
      .select('-passwordHash -tokens')

    response.status(200).json({
      success: true,
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: { user: updatedUser }
    })
  } catch (error) {
    response.status(500).json({
      error: 'Failed to update user status'
    })
  }
})

// PATCH /api/users/:id/department - Update user department (Admin only)
usersRouter.patch('/:id/department', userExtractor, isAdmin, async (request, response) => {
  const { department } = request.body

  try {
    // Validate department if provided
    if (department) {
      const departmentExists = await Department.findById(department)
      if (!departmentExists) {
        return response.status(400).json({
          error: 'Invalid department ID'
        })
      }
    }

    const user = await User.findByIdAndUpdate(
      request.params.id,
      { department },
      { new: true }
    )
      .populate('role', 'roleId roleName')
      .populate('department', 'departmentId departmentName')
      .select('-passwordHash -tokens')

    if (!user) {
      return response.status(404).json({
        error: 'User not found'
      })
    }

    response.status(200).json({
      success: true,
      message: 'User department updated successfully',
      data: { user }
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid ID format'
      })
    }
    response.status(500).json({
      error: 'Failed to update user department'
    })
  }
})

// POST /api/users/:id/reset-password - Reset user password (Admin only)
usersRouter.post('/:id/reset-password', userExtractor, isAdmin, async (request, response) => {
  const { newPassword } = request.body

  // Validation
  if (!newPassword) {
    return response.status(400).json({
      error: 'New password is required'
    })
  }

  if (newPassword.length < 6) {
    return response.status(400).json({
      error: 'Password must be at least 6 characters long'
    })
  }

  try {
    const user = await User.findById(request.params.id)

    if (!user) {
      return response.status(404).json({
        error: 'User not found'
      })
    }

    // Hash new password
    const saltRounds = 10
    user.passwordHash = await bcrypt.hash(newPassword, saltRounds)

    // Clear all tokens to force re-login
    user.tokens = []

    await user.save()

    response.status(200).json({
      success: true,
      message: 'Password reset successfully',
      data: {
        username: user.username
      }
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid user ID'
      })
    }
    response.status(500).json({
      error: 'Failed to reset password'
    })
  }
})// DELETE /api/users/:id - Delete user (Admin only)
usersRouter.delete('/:id', userExtractor, isAdmin, async (request, response) => {
  try {
    const user = await User.findById(request.params.id)

    if (!user) {
      return response.status(404).json({
        error: 'User not found'
      })
    }

    // Prevent admin from deleting themselves
    if (request.user._id.toString() === user._id.toString()) {
      return response.status(400).json({
        error: 'You cannot delete your own account'
      })
    }

    await User.findByIdAndDelete(request.params.id)

    response.status(200).json({
      success: true,
      message: 'User deleted successfully'
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid user ID'
      })
    }
    response.status(500).json({
      error: 'Failed to delete user'
    })
  }
})

module.exports = usersRouter
