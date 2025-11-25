const jwt = require('jsonwebtoken')
const posLoginRouter = require('express').Router()
const Employee = require('../models/employee')
const Customer = require('../models/customer')
const posAuthService = require('../services/posAuthService')

/**
 * Helper: Generate JWT token for POS session
 */
const generatePOSToken = (employeeId, userCode, roleId) => {
  return jwt.sign(
    {
      id: employeeId,
      userCode: userCode,
      role: roleId,
      isPOS: true // Flag to identify POS sessions
    },
    process.env.JWT_SECRET,
    { expiresIn: '12h' } // 12 hours for POS sessions
  )
}

/**
 * @route   POST /api/pos-login
 * @desc    Login to POS system with employee code and PIN
 * @access  Public
 */
posLoginRouter.post('/', async (request, response) => {
  const { employeeCode, pin } = request.body

  // Validation
  if (!employeeCode || !pin) {
    return response.status(400).json({
      success: false,
      error: {
        message: 'Employee code and PIN are required',
        code: 'MISSING_CREDENTIALS'
      }
    })
  }

  try {
    // Find user account by userCode first
    const userAccount = await Employee.findOne({})
      .populate({
        path: 'userAccount',
        match: { userCode: employeeCode.toUpperCase() },
        select: 'userCode email role isActive',
        populate: {
          path: 'role',
          select: 'roleName permissions'
        }
      })
      .lean()

    // Better approach: Find by userCode directly
    const UserAccount = require('../models/userAccount')
    const foundUserAccount = await UserAccount.findOne({
      userCode: employeeCode.toUpperCase()
    }).populate('role', 'roleName permissions')

    if (!foundUserAccount) {
      return response.status(401).json({
        success: false,
        error: {
          message: 'Invalid employee code or PIN',
          code: 'INVALID_CREDENTIALS'
        }
      })
    }

    // Find employee by userAccount
    const employee = await Employee.findOne({ userAccount: foundUserAccount._id })
      .populate({
        path: 'userAccount',
        select: 'userCode email role isActive',
        populate: {
          path: 'role',
          select: 'roleName permissions'
        }
      })

    // Check if employee exists
    if (!employee) {
      return response.status(401).json({
        success: false,
        error: {
          message: 'Invalid employee code or PIN',
          code: 'INVALID_CREDENTIALS'
        }
      })
    }

    // Check if user account is active
    if (!employee.userAccount.isActive) {
      return response.status(403).json({
        success: false,
        error: {
          message: 'Your account is inactive. Please contact administrator.',
          code: 'ACCOUNT_INACTIVE'
        }
      })
    }

    // Verify PIN using posAuthService
    try {
      const verifyResult = await posAuthService.verifyPIN(employee._id, pin)

      // Generate POS token
      const token = generatePOSToken(
        employee._id,
        employee.userAccount.userCode,
        employee.userAccount.role._id
      )

      // Return successful login
      return response.status(200).json({
        success: true,
        data: {
          token,
          employee: {
            id: employee._id,
            fullName: employee.fullName,
            userCode: employee.userAccount.userCode,
            email: employee.userAccount.email,
            phone: employee.phone || '',
            role: employee.userAccount.role.roleName,
            permissions: employee.userAccount.role.permissions,
            lastLogin: verifyResult.lastLogin
          }
        },
        message: 'Login successful'
      })
    } catch (pinError) {
      // Handle PIN verification errors
      const status = pinError.statusCode || 401
      return response.status(status).json({
        success: false,
        error: {
          message: pinError.message,
          code: pinError.code,
          attemptsRemaining: pinError.attemptsRemaining,
          minutesLeft: pinError.minutesLeft
        }
      })
    }
  } catch (error) {
    console.error('POS Login error:', error)
    return response.status(500).json({
      success: false,
      error: {
        message: 'An error occurred during login',
        code: 'SERVER_ERROR',
        details: error.message
      }
    })
  }
})

/**
 * @route   POST /api/pos-login/logout
 * @desc    Logout from POS system
 * @access  Private (POS)
 */
posLoginRouter.post('/logout', async (request, response) => {
  try {
    const authorization = request.get('authorization')

    if (!authorization || !authorization.toLowerCase().startsWith('bearer ')) {
      return response.status(401).json({
        success: false,
        error: {
          message: 'Token missing or invalid',
          code: 'MISSING_TOKEN'
        }
      })
    }

    const token = authorization.substring(7)

    // Verify token
    try {
      const decodedToken = jwt.verify(token, process.env.JWT_SECRET)

      // Check if it's a POS token
      if (!decodedToken.isPOS) {
        return response.status(403).json({
          success: false,
          error: {
            message: 'Invalid POS token',
            code: 'INVALID_TOKEN_TYPE'
          }
        })
      }

      // Successfully logged out
      return response.status(200).json({
        success: true,
        message: 'Logged out successfully'
      })
    } catch (tokenError) {
      // Token is invalid or expired - still return success (logout is idempotent)
      return response.status(200).json({
        success: true,
        message: 'Logged out successfully'
      })
    }
  } catch (error) {
    console.error('POS Logout error:', error)
    // Return success even on error (logout should always succeed)
    return response.status(200).json({
      success: true,
      message: 'Logged out successfully'
    })
  }
})

/**
 * @route   GET /api/pos-login/verify
 * @desc    Verify POS session and get current employee info
 * @access  Private (POS)
 */
posLoginRouter.get('/verify', async (request, response) => {
  try {
    const authorization = request.get('authorization')

    if (!authorization || !authorization.toLowerCase().startsWith('bearer ')) {
      return response.status(401).json({
        success: false,
        error: {
          message: 'Token missing or invalid',
          code: 'MISSING_TOKEN'
        }
      })
    }

    const token = authorization.substring(7)

    // Verify token
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET)

    // Check if it's a POS token
    if (!decodedToken.isPOS) {
      return response.status(403).json({
        success: false,
        error: {
          message: 'Invalid POS token',
          code: 'INVALID_TOKEN_TYPE'
        }
      })
    }

    // Get employee with user account
    const employee = await Employee.findById(decodedToken.id)
      .populate({
        path: 'userAccount',
        select: 'userCode email role isActive',
        populate: {
          path: 'role',
          select: 'roleName permissions'
        }
      })

    if (!employee) {
      return response.status(404).json({
        success: false,
        error: {
          message: 'Employee not found',
          code: 'EMPLOYEE_NOT_FOUND'
        }
      })
    }

    // Check if user account is still active
    if (!employee.userAccount || !employee.userAccount.isActive) {
      return response.status(403).json({
        success: false,
        error: {
          message: 'Account is inactive',
          code: 'ACCOUNT_INACTIVE'
        }
      })
    }

    // Check POS auth status
    const posAuthStatus = await posAuthService.getPOSAuthStatus(employee._id)

    if (!posAuthStatus.hasAuth || !posAuthStatus.canAccessPOS) {
      return response.status(403).json({
        success: false,
        error: {
          message: 'POS access has been revoked',
          code: 'ACCESS_REVOKED'
        }
      })
    }

    // Check if account is locked
    if (posAuthStatus.isPinLocked) {
      return response.status(423).json({
        success: false,
        error: {
          message: 'Account is temporarily locked',
          code: 'ACCOUNT_LOCKED',
          minutesLeft: posAuthStatus.minutesUntilUnlock
        }
      })
    }

    // Return employee info
    return response.status(200).json({
      success: true,
      data: {
        employee: {
          id: employee._id,
          fullName: employee.fullName,
          userCode: employee.userAccount.userCode,
          email: employee.userAccount.email,
          phone: employee.phone || '',
          role: employee.userAccount.role.roleName,
          permissions: employee.userAccount.role.permissions,
          lastLogin: posAuthStatus.posLastLogin
        }
      }
    })
  } catch (error) {
    console.error('POS Verify error:', error)

    if (error.name === 'JsonWebTokenError') {
      return response.status(401).json({
        success: false,
        error: {
          message: 'Invalid token',
          code: 'INVALID_TOKEN'
        }
      })
    }

    if (error.name === 'TokenExpiredError') {
      return response.status(401).json({
        success: false,
        error: {
          message: 'Token has expired',
          code: 'TOKEN_EXPIRED'
        }
      })
    }

    return response.status(500).json({
      success: false,
      error: {
        message: 'Failed to verify session',
        code: 'SERVER_ERROR',
        details: error.message
      }
    })
  }
})

/**
 * @route   POST /api/pos-login/customer
 * @desc    Create new customer from POS (no admin auth required)
 * @access  Private (POS)
 */
posLoginRouter.post('/customer', async (request, response) => {
  try {
    const authorization = request.get('authorization')

    if (!authorization || !authorization.toLowerCase().startsWith('bearer ')) {
      return response.status(401).json({
        success: false,
        error: {
          message: 'Token missing or invalid',
          code: 'MISSING_TOKEN'
        }
      })
    }

    const token = authorization.substring(7)

    // Verify POS token
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET)

    if (!decodedToken.isPOS) {
      return response.status(403).json({
        success: false,
        error: {
          message: 'Invalid POS token',
          code: 'INVALID_TOKEN_TYPE'
        }
      })
    }

    // Get request body
    const { fullName, email, phone, address, dateOfBirth, gender, customerType } = request.body

    // Validation: Full name is required
    if (!fullName || fullName.trim().length === 0) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Full name is required',
          code: 'MISSING_FULLNAME'
        }
      })
    }

    // Validation: Phone is required
    if (!phone || phone.trim().length === 0) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Phone number is required',
          code: 'MISSING_PHONE'
        }
      })
    }

    // Validation: Gender is required
    if (!gender || !['male', 'female', 'other'].includes(gender.toLowerCase())) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Valid gender is required (male/female/other)',
          code: 'INVALID_GENDER'
        }
      })
    }

    // Check if email already exists (if provided)
    if (email && email.trim().length > 0) {
      const existingCustomerByEmail = await Customer.findOne({
        email: email.trim().toLowerCase()
      })

      if (existingCustomerByEmail) {
        return response.status(409).json({
          success: false,
          error: {
            message: 'This email is already registered',
            code: 'DUPLICATE_EMAIL'
          }
        })
      }
    }

    // Generate customer code
    const lastCustomer = await Customer.findOne()
      .sort({ createdAt: -1 })
      .select('customerCode')
      .lean()

    let newCustomerCode = 'CUST0000000001'
    if (lastCustomer && lastCustomer.customerCode) {
      const lastCodeNum = parseInt(lastCustomer.customerCode.replace('CUST', ''))
      newCustomerCode = 'CUST' + String(lastCodeNum + 1).padStart(10, '0')
    }

    // Create customer
    const newCustomer = new Customer({
      customerCode: newCustomerCode,
      fullName: fullName.trim(),
      email: email ? email.trim().toLowerCase() : undefined,
      phone: phone.trim().replace(/[\s\-()]/g, ''),
      address: address ? address.trim() : undefined,
      dateOfBirth: dateOfBirth || undefined,
      gender: gender.toLowerCase(),
      customerType: customerType ? customerType.toLowerCase() : 'retail',
      totalSpent: 0,
      isActive: true
    })

    await newCustomer.save()

    // Return created customer
    return response.status(201).json({
      success: true,
      data: {
        customer: {
          id: newCustomer._id,
          customerCode: newCustomer.customerCode,
          fullName: newCustomer.fullName,
          email: newCustomer.email,
          phone: newCustomer.phone,
          address: newCustomer.address,
          dateOfBirth: newCustomer.dateOfBirth,
          gender: newCustomer.gender,
          customerType: newCustomer.customerType,
          totalSpent: newCustomer.totalSpent,
          isActive: newCustomer.isActive,
          createdAt: newCustomer.createdAt
        }
      },
      message: 'Customer created successfully'
    })
  } catch (error) {
    console.error('POS Create Customer error:', error)

    if (error.name === 'JsonWebTokenError') {
      return response.status(401).json({
        success: false,
        error: {
          message: 'Invalid token',
          code: 'INVALID_TOKEN'
        }
      })
    }

    if (error.name === 'TokenExpiredError') {
      return response.status(401).json({
        success: false,
        error: {
          message: 'Token has expired',
          code: 'TOKEN_EXPIRED'
        }
      })
    }

    if (error.name === 'ValidationError') {
      return response.status(400).json({
        success: false,
        error: {
          message: error.message,
          code: 'VALIDATION_ERROR'
        }
      })
    }

    return response.status(500).json({
      success: false,
      error: {
        message: 'Failed to create customer',
        code: 'SERVER_ERROR',
        details: error.message
      }
    })
  }
})

module.exports = posLoginRouter
