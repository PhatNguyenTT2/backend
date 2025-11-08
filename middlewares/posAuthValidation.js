const mongoose = require('mongoose')
const { isValidPINFormat, isWeakPIN } = require('../utils/posAuthHelpers')

/**
 * Validate employee ID parameter
 */
const validateEmployeeId = (req, res, next) => {
  const { employeeId } = req.params

  if (!mongoose.Types.ObjectId.isValid(employeeId)) {
    return res.status(400).json({
      success: false,
      error: { message: 'Invalid employee ID' }
    })
  }

  next()
}

/**
 * Validate PIN in request body
 */
const validatePIN = (req, res, next) => {
  const { pin } = req.body

  if (!pin) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'PIN is required',
        code: 'MISSING_PIN'
      }
    })
  }

  if (!isValidPINFormat(pin)) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'PIN must be 4-6 digits only',
        code: 'INVALID_PIN_FORMAT'
      }
    })
  }

  if (isWeakPIN(pin)) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'This PIN is too common. Please choose a more secure PIN',
        code: 'WEAK_PIN'
      }
    })
  }

  next()
}

/**
 * Validate grant POS access request
 */
const validateGrantAccess = (req, res, next) => {
  const { employeeId, pin } = req.body

  if (!employeeId || !pin) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Missing required fields',
        code: 'MISSING_FIELDS',
        details: { required: ['employeeId', 'pin'] }
      }
    })
  }

  if (!mongoose.Types.ObjectId.isValid(employeeId)) {
    return res.status(400).json({
      success: false,
      error: { message: 'Invalid employee ID' }
    })
  }

  next()
}

/**
 * Validate verify PIN request
 */
const validateVerifyPIN = (req, res, next) => {
  const { employeeId, pin } = req.body

  if (!employeeId || !pin) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Employee ID and PIN are required',
        code: 'MISSING_FIELDS'
      }
    })
  }

  if (!mongoose.Types.ObjectId.isValid(employeeId)) {
    return res.status(400).json({
      success: false,
      error: { message: 'Invalid employee ID' }
    })
  }

  next()
}

module.exports = {
  validateEmployeeId,
  validatePIN,
  validateGrantAccess,
  validateVerifyPIN
}
