const jwt = require('jsonwebtoken')
const Employee = require('../models/employee')
const posAuthService = require('../services/posAuthService')

/**
 * Middleware to verify POS authentication token
 * Use this for protected POS routes
 */
const posAuthMiddleware = async (request, response, next) => {
  try {
    // Extract token from header
    const authorization = request.get('authorization')

    if (!authorization || !authorization.toLowerCase().startsWith('bearer ')) {
      return response.status(401).json({
        success: false,
        error: {
          message: 'Authentication required',
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
          message: 'Invalid token type. POS token required.',
          code: 'INVALID_TOKEN_TYPE'
        }
      })
    }

    // Get employee
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

    // Check if user account is active
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
          message: 'POS access denied',
          code: 'ACCESS_DENIED'
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

    // Add employee and token info to request
    request.employee = employee
    request.token = decodedToken

    next()
  } catch (error) {
    console.error('POS Auth Middleware error:', error)

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
        message: 'Authentication failed',
        code: 'AUTH_ERROR',
        details: error.message
      }
    })
  }
}

module.exports = {
  posAuthMiddleware
}
