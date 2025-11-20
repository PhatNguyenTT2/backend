const jwt = require('jsonwebtoken')
const bcrypt = require('bcrypt')
const loginRouter = require('express').Router()
const UserAccount = require('../models/userAccount')
const Employee = require('../models/employee')
const Role = require('../models/role')

// Helper: Generate JWT token
const generateToken = (userId, username, roleId) => {
  return jwt.sign(
    {
      id: userId,
      username: username,
      role: roleId
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' } // 7 days
  )
}

// POST /api/login - Login
loginRouter.post('/', async (request, response) => {
  const { username, password } = request.body

  // Validation
  if (!username || !password) {
    return response.status(400).json({
      success: false,
      error: 'Username and password are required'
    })
  }

  try {
    // Find user by username or email
    const user = await UserAccount.findOne({
      $or: [
        { username: new RegExp(`^${username}$`, 'i') },
        { email: new RegExp(`^${username}$`, 'i') }
      ]
    })
      .populate('role', 'roleName permissions')

    if (!user) {
      return response.status(401).json({
        success: false,
        error: 'Invalid username or password'
      })
    }

    // Check if user is active
    if (!user.isActive) {
      return response.status(403).json({
        success: false,
        error: 'Account is inactive. Please contact administrator.'
      })
    }

    // Verify password
    const passwordCorrect = await bcrypt.compare(password, user.passwordHash)

    if (!passwordCorrect) {
      return response.status(401).json({
        success: false,
        error: 'Invalid username or password'
      })
    }

    // Get employee profile
    const employee = await Employee.findOne({ userAccount: user._id })

    // Generate token
    const token = generateToken(user._id, user.username, user.role._id)

    // Save token to user's tokens array and update last login
    user.tokens = user.tokens.concat({ token })
    user.lastLogin = new Date()
    await user.save()

    // Return user info and token
    response.status(200).json({
      success: true,
      data: {
        token,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          userCode: user.userCode,
          fullName: employee?.fullName || user.username,
          phone: employee?.phone || '',
          role: user.role.roleName,
          permissions: user.role.permissions,
          employeeId: employee?._id || null
        }
      }
    })
  } catch (error) {
    console.error('Login error:', error)
    response.status(500).json({
      success: false,
      error: 'Something went wrong during login',
      details: error.message
    })
  }
})

// POST /api/login/register - Register new admin
loginRouter.post('/register', async (request, response) => {
  const { username, email, fullName, password } = request.body

  // Validation
  if (!username || !email || !fullName || !password) {
    return response.status(400).json({
      success: false,
      error: 'All fields are required (username, email, fullName, password)'
    })
  }

  if (password.length < 6) {
    return response.status(400).json({
      success: false,
      error: 'Password must be at least 6 characters long'
    })
  }

  try {
    // Check if username already exists
    const existingUsername = await UserAccount.findOne({
      username: new RegExp(`^${username}$`, 'i')
    })
    if (existingUsername) {
      return response.status(400).json({
        success: false,
        error: 'Username already exists'
      })
    }

    // Check if email already exists
    const existingEmail = await UserAccount.findOne({
      email: new RegExp(`^${email}$`, 'i')
    })
    if (existingEmail) {
      return response.status(400).json({
        success: false,
        error: 'Email already exists'
      })
    }

    // Hash password
    const saltRounds = 10
    const passwordHash = await bcrypt.hash(password, saltRounds)

    // Find the ADMIN role
    let adminRole = await Role.findOne({ roleName: 'Admin' })

    // If ADMIN role doesn't exist, create it
    if (!adminRole) {
      adminRole = new Role({
        roleName: 'Admin',
        description: 'Administrator with full access to the system',
        permissions: ['all']
      })
      await adminRole.save()
    }

    // Start transaction
    const session = await require('mongoose').startSession()
    session.startTransaction()

    try {
      // Create user account
      const userAccount = new UserAccount({
        username,
        email,
        passwordHash,
        role: adminRole._id,
        isActive: true
      })
      await userAccount.save({ session })

      // Create employee profile
      const employee = new Employee({
        fullName,
        userAccount: userAccount._id
      })
      await employee.save({ session })

      await session.commitTransaction()

      // Populate for response
      await userAccount.populate('role', 'roleName permissions')

      // Return success (no auto-login, user needs to login)
      response.status(201).json({
        success: true,
        message: 'Registration successful. Please login.',
        data: {
          user: {
            id: userAccount._id,
            username: userAccount.username,
            email: userAccount.email,
            userCode: userAccount.userCode,
            fullName: fullName,
            role: userAccount.role.roleName
          }
        }
      })
    } catch (error) {
      await session.abortTransaction()
      throw error
    } finally {
      session.endSession()
    }
  } catch (error) {
    console.error('Registration error:', error)
    if (error.name === 'ValidationError') {
      return response.status(400).json({
        success: false,
        error: error.message
      })
    }
    response.status(500).json({
      success: false,
      error: 'Something went wrong during registration',
      details: error.message
    })
  }
})

// POST /api/login/logout - Logout (requires authentication)
loginRouter.post('/logout', async (request, response) => {
  try {
    const authorization = request.get('authorization')

    if (!authorization || !authorization.toLowerCase().startsWith('bearer ')) {
      return response.status(401).json({
        success: false,
        error: 'Token missing or invalid'
      })
    }

    const token = authorization.substring(7)
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET)

    // Find user and remove token
    const user = await UserAccount.findById(decodedToken.id)
    if (user) {
      user.tokens = user.tokens.filter(t => t.token !== token)
      await user.save()
    }

    response.status(200).json({
      success: true,
      message: 'Logged out successfully'
    })
  } catch (error) {
    console.error('Logout error:', error)
    // Still return success even if token is invalid (logout is idempotent)
    response.status(200).json({
      success: true,
      message: 'Logged out successfully'
    })
  }
})

// GET /api/login/me - Get current user info (requires authentication)
loginRouter.get('/me', async (request, response) => {
  try {
    // Extract token from header
    const authorization = request.get('authorization')

    if (!authorization || !authorization.toLowerCase().startsWith('bearer ')) {
      return response.status(401).json({
        success: false,
        error: 'Token missing or invalid'
      })
    }

    const token = authorization.substring(7)
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET)

    // Find user and check if token is still valid
    const user = await UserAccount.findById(decodedToken.id)
      .populate('role', 'roleName permissions')

    if (!user || !user.isActive) {
      return response.status(401).json({
        success: false,
        error: 'User not found or inactive'
      })
    }

    // Check if token exists in user's tokens array
    const tokenExists = user.tokens.some(t => t.token === token)
    if (!tokenExists) {
      return response.status(401).json({
        success: false,
        error: 'Token has been revoked'
      })
    }

    // Get employee profile
    const employee = await Employee.findOne({ userAccount: user._id })

    response.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          userCode: user.userCode,
          fullName: employee?.fullName || user.username,
          phone: employee?.phone || '',
          address: employee?.address || '',
          dateOfBirth: employee?.dateOfBirth || null,
          role: user.role.roleName,
          permissions: user.role.permissions,
          isActive: user.isActive,
          lastLogin: user.lastLogin,
          createdAt: user.createdAt,
          employeeId: employee?._id || null
        }
      }
    })
  } catch (error) {
    console.error('Get current user error:', error)
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return response.status(401).json({
        success: false,
        error: 'Invalid or expired token'
      })
    }
    response.status(500).json({
      success: false,
      error: 'Failed to get user info',
      details: error.message
    })
  }
})

module.exports = loginRouter