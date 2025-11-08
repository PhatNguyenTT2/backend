const posLoginRouter = require('express').Router();
const jwt = require('jsonwebtoken');
const Employee = require('../models/employee');
const UserAccount = require('../models/userAccount');
const posAuthService = require('../services/posAuthService');

/**
 * @route   POST /api/pos-login
 * @desc    POS PIN Authentication
 * @access  Public
 * @body    { employeeCode, pin, deviceId }
 */
posLoginRouter.post('/', async (request, response) => {
  try {
    const { employeeCode, pin, deviceId } = request.body;

    // Validation
    if (!employeeCode || !pin) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Employee code and PIN are required',
          code: 'MISSING_CREDENTIALS'
        }
      });
    }

    // Find UserAccount by employeeCode (userCode)
    const userAccount = await UserAccount.findOne({
      userCode: employeeCode,
      isActive: true
    }).populate('role', 'roleName canAccessPOS permissions level');

    if (!userAccount) {
      return response.status(401).json({
        success: false,
        error: {
          message: 'Invalid employee code or PIN',
          code: 'INVALID_CREDENTIALS'
        }
      });
    }

    // Check if role allows POS access
    if (!userAccount.role.canAccessPOS) {
      return response.status(403).json({
        success: false,
        error: {
          message: 'This role does not have POS access',
          code: 'NO_POS_PERMISSION'
        }
      });
    }

    // Find Employee
    const employee = await Employee.findOne({
      userAccount: userAccount._id
    });

    if (!employee) {
      return response.status(401).json({
        success: false,
        error: {
          message: 'Employee profile not found',
          code: 'EMPLOYEE_NOT_FOUND'
        }
      });
    }

    // Verify PIN using posAuthService
    try {
      const result = await posAuthService.verifyPosPin(employee._id, pin);
      // PIN verified successfully
    } catch (error) {
      return response.status(401).json({
        success: false,
        error: {
          message: error.message,
          code: 'PIN_VERIFICATION_FAILED'
        }
      });
    }

    // Generate POS token (8 hours for work shift)
    const posToken = jwt.sign(
      {
        id: employee._id,
        employeeId: employee._id,
        userAccountId: userAccount._id,
        employeeCode: userAccount.userCode,
        username: userAccount.username,
        fullName: employee.fullName,
        role: {
          id: userAccount.role._id,
          name: userAccount.role.roleName,
          level: userAccount.role.level,
          permissions: userAccount.role.permissions
        },
        type: 'pos'
      },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    // Get POS auth status
    const authStatus = await posAuthService.getPOSAuthStatus(employee._id);

    // Response
    response.status(200).json({
      success: true,
      data: {
        token: posToken,
        employee: {
          id: employee._id,
          employeeCode: userAccount.userCode,
          fullName: employee.fullName,
          phone: employee.phone,
          role: {
            name: userAccount.role.roleName,
            level: userAccount.role.level,
            permissions: userAccount.role.permissions
          }
        },
        session: {
          expiresIn: '8h',
          deviceId: deviceId || null,
          lastLogin: authStatus.lastLogin
        }
      },
      message: 'Login successful'
    });

  } catch (error) {
    console.error('POS login error:', error);
    response.status(500).json({
      success: false,
      error: {
        message: 'Login failed. Please try again',
        code: 'SERVER_ERROR',
        details: error.message
      }
    });
  }
});

/**
 * @route   POST /api/pos-login/verify
 * @desc    Verify current POS session
 * @access  Private (POS token required)
 */
posLoginRouter.post('/verify', async (request, response) => {
  try {
    const token = request.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return response.status(401).json({
        success: false,
        error: {
          message: 'Token required',
          code: 'TOKEN_MISSING'
        }
      });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      return response.status(401).json({
        success: false,
        error: {
          message: 'Invalid or expired token',
          code: 'TOKEN_INVALID'
        }
      });
    }

    // Check token type
    if (decoded.type !== 'pos') {
      return response.status(403).json({
        success: false,
        error: {
          message: 'POS token required',
          code: 'INVALID_TOKEN_TYPE'
        }
      });
    }

    // Find employee
    const employee = await Employee.findById(decoded.employeeId)
      .populate({
        path: 'userAccount',
        select: 'userCode username role isActive',
        populate: {
          path: 'role',
          select: 'roleName canAccessPOS permissions level'
        }
      });

    if (!employee || !employee.userAccount.isActive) {
      return response.status(403).json({
        success: false,
        error: {
          message: 'Employee account is inactive',
          code: 'ACCOUNT_INACTIVE'
        }
      });
    }

    // Check POS access
    const canAccess = await posAuthService.canAccessPOS(employee._id);
    if (!canAccess) {
      return response.status(403).json({
        success: false,
        error: {
          message: 'POS access is disabled or locked',
          code: 'POS_ACCESS_DENIED'
        }
      });
    }

    // Get auth status
    const authStatus = await posAuthService.getPOSAuthStatus(employee._id);

    response.status(200).json({
      success: true,
      data: {
        employee: {
          id: employee._id,
          employeeCode: employee.userAccount.userCode,
          fullName: employee.fullName,
          phone: employee.phone,
          role: {
            name: employee.userAccount.role.roleName,
            level: employee.userAccount.role.level,
            permissions: employee.userAccount.role.permissions
          }
        },
        session: {
          isValid: true,
          lastLogin: authStatus.lastLogin
        }
      }
    });

  } catch (error) {
    console.error('Verify session error:', error);
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to verify session',
        code: 'SERVER_ERROR'
      }
    });
  }
});

/**
 * @route   POST /api/pos-login/change-pin
 * @desc    Change POS PIN
 * @access  Private (POS token required)
 * @body    { oldPin, newPin, confirmPin }
 */
posLoginRouter.post('/change-pin', async (request, response) => {
  try {
    const { oldPin, newPin, confirmPin } = request.body;

    // Validation
    if (!oldPin || !newPin || !confirmPin) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'All fields are required',
          code: 'MISSING_FIELDS'
        }
      });
    }

    if (newPin !== confirmPin) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'New PIN and confirm PIN do not match',
          code: 'PIN_MISMATCH'
        }
      });
    }

    // Extract and verify token
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return response.status(401).json({
        success: false,
        error: {
          message: 'Token required',
          code: 'TOKEN_MISSING'
        }
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      return response.status(401).json({
        success: false,
        error: {
          message: 'Invalid or expired token',
          code: 'TOKEN_INVALID'
        }
      });
    }

    if (decoded.type !== 'pos') {
      return response.status(403).json({
        success: false,
        error: {
          message: 'POS token required',
          code: 'INVALID_TOKEN_TYPE'
        }
      });
    }

    const employeeId = decoded.employeeId;

    // Verify old PIN first
    try {
      await posAuthService.verifyPosPin(employeeId, oldPin);
    } catch (error) {
      return response.status(401).json({
        success: false,
        error: {
          message: 'Invalid old PIN',
          code: 'INVALID_OLD_PIN',
          details: error.message
        }
      });
    }

    // Set new PIN (will validate and throw if weak)
    try {
      await posAuthService.setPosPin(employeeId, newPin);

      response.status(200).json({
        success: true,
        message: 'PIN changed successfully. Please login again with new PIN'
      });

    } catch (error) {
      return response.status(400).json({
        success: false,
        error: {
          message: error.message,
          code: 'PIN_CHANGE_FAILED'
        }
      });
    }

  } catch (error) {
    console.error('Change PIN error:', error);
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to change PIN',
        code: 'SERVER_ERROR'
      }
    });
  }
});

/**
 * @route   POST /api/pos-login/logout
 * @desc    POS logout
 * @access  Private (POS token required)
 */
posLoginRouter.post('/logout', async (request, response) => {
  try {
    // Optional: Add logout logging here for audit trail

    response.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (error) {
    console.error('Logout error:', error);
    response.status(500).json({
      success: false,
      error: {
        message: 'Logout failed',
        code: 'SERVER_ERROR'
      }
    });
  }
});

/**
 * @route   GET /api/pos-login/status
 * @desc    Get POS auth status
 * @access  Private (POS token required)
 */
posLoginRouter.get('/status', async (request, response) => {
  try {
    const token = request.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return response.status(401).json({
        success: false,
        error: {
          message: 'Token required',
          code: 'TOKEN_MISSING'
        }
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      return response.status(401).json({
        success: false,
        error: {
          message: 'Invalid or expired token',
          code: 'TOKEN_INVALID'
        }
      });
    }

    if (decoded.type !== 'pos') {
      return response.status(403).json({
        success: false,
        error: {
          message: 'POS token required',
          code: 'INVALID_TOKEN_TYPE'
        }
      });
    }

    // Get detailed auth status
    const authStatus = await posAuthService.getPOSAuthStatus(decoded.employeeId);

    response.status(200).json({
      success: true,
      data: {
        hasAuth: authStatus.hasAuth,
        canAccess: authStatus.canAccess,
        isPinLocked: authStatus.isPinLocked,
        failedAttempts: authStatus.failedAttempts,
        minutesUntilUnlock: authStatus.minutesUntilUnlock,
        lastLogin: authStatus.lastLogin,
        createdAt: authStatus.createdAt,
        updatedAt: authStatus.updatedAt
      }
    });

  } catch (error) {
    console.error('Get status error:', error);
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to get status',
        code: 'SERVER_ERROR'
      }
    });
  }
});

module.exports = posLoginRouter;
