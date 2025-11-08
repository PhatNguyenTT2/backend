const employeePOSAuthsRouter = require('express').Router()
const posAuthService = require('../services/posAuthService')
const {
  validateEmployeeId,
  validatePIN,
  validateGrantAccess,
  validateVerifyPIN
} = require('../middlewares/posAuthValidation')

/**
 * @route   GET /api/pos-auth
 * @desc    Get all POS auth records with employee details
 * @access  Private (Admin only)
 */
employeePOSAuthsRouter.get('/', async (req, res) => {
  try {
    const data = await posAuthService.getAllPOSAuthRecords(req.query)
    res.json({ success: true, data })
  } catch (error) {
    console.error('Error fetching POS auth records:', error)
    res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch POS auth records', details: error.message }
    })
  }
})

/**
 * @route   GET /api/pos-auth/available-employees
 * @desc    Get employees available for POS access grant
 * @access  Private (Admin only)
 */
employeePOSAuthsRouter.get('/available-employees', async (req, res) => {
  try {
    const data = await posAuthService.getAvailableEmployees(req.query.search)
    res.json({ success: true, data })
  } catch (error) {
    console.error('Error fetching available employees:', error)
    res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch available employees', details: error.message }
    })
  }
})

/**
 * @route   GET /api/pos-auth/status/locked
 * @desc    Get all locked POS accounts
 * @access  Private (Admin only)
 */
employeePOSAuthsRouter.get('/status/locked', async (req, res) => {
  try {
    const data = await posAuthService.getLockedAccounts()
    res.json({ success: true, data })
  } catch (error) {
    console.error('Error fetching locked accounts:', error)
    res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch locked accounts', details: error.message }
    })
  }
})

/**
 * @route   GET /api/pos-auth/:employeeId
 * @desc    Get POS auth status for specific employee
 * @access  Private (Admin only)
 */
employeePOSAuthsRouter.get('/:employeeId', validateEmployeeId, async (req, res) => {
  try {
    const data = await posAuthService.getPOSAuthStatus(req.params.employeeId)
    res.json({ success: true, data })
  } catch (error) {
    const status = error.statusCode || 500
    res.status(status).json({
      success: false,
      error: { message: error.message || 'Failed to fetch POS auth status' }
    })
  }
})

/**
 * @route   POST /api/pos-auth
 * @desc    Grant POS access to employee
 * @access  Private (Admin only)
 */
employeePOSAuthsRouter.post('/', validateGrantAccess, validatePIN, async (req, res) => {
  try {
    const { employeeId, pin } = req.body
    const data = await posAuthService.grantPOSAccess(employeeId, pin)
    res.status(201).json({
      success: true,
      data,
      message: 'POS access granted successfully'
    })
  } catch (error) {
    const status = error.statusCode || 500
    res.status(status).json({
      success: false,
      error: {
        message: error.message || 'Failed to grant POS access',
        code: error.code
      }
    })
  }
})

/**
 * @route   POST /api/pos-auth/verify-pin
 * @desc    Verify PIN for POS login
 * @access  Public (POS Login)
 */
employeePOSAuthsRouter.post('/verify-pin', validateVerifyPIN, async (req, res) => {
  try {
    const { employeeId, pin } = req.body
    const data = await posAuthService.verifyPIN(employeeId, pin)
    res.json({
      success: true,
      data,
      message: 'PIN verified successfully'
    })
  } catch (error) {
    const status = error.statusCode || 500
    res.status(status).json({
      success: false,
      error: {
        message: error.message || 'Failed to verify PIN',
        code: error.code,
        attemptsRemaining: error.attemptsRemaining,
        minutesLeft: error.minutesLeft
      }
    })
  }
})

/**
 * @route   PUT /api/pos-auth/:employeeId/pin
 * @desc    Update PIN for employee
 * @access  Private (Admin only)
 */
employeePOSAuthsRouter.put('/:employeeId/pin', validateEmployeeId, validatePIN, async (req, res) => {
  try {
    const data = await posAuthService.updatePIN(req.params.employeeId, req.body.pin)
    res.json({
      success: true,
      message: 'PIN updated successfully',
      data
    })
  } catch (error) {
    const status = error.statusCode || 500
    res.status(status).json({
      success: false,
      error: { message: error.message || 'Failed to update PIN', code: error.code }
    })
  }
})

/**
 * @route   PUT /api/pos-auth/:employeeId/enable
 * @desc    Enable POS access
 * @access  Private (Admin only)
 */
employeePOSAuthsRouter.put('/:employeeId/enable', validateEmployeeId, async (req, res) => {
  try {
    const data = await posAuthService.enablePOSAccess(req.params.employeeId)
    res.json({
      success: true,
      data,
      message: 'POS access enabled successfully'
    })
  } catch (error) {
    const status = error.statusCode || 500
    res.status(status).json({
      success: false,
      error: { message: error.message || 'Failed to enable POS access', code: error.code }
    })
  }
})

/**
 * @route   PUT /api/pos-auth/:employeeId/disable
 * @desc    Disable POS access
 * @access  Private (Admin only)
 */
employeePOSAuthsRouter.put('/:employeeId/disable', validateEmployeeId, async (req, res) => {
  try {
    const data = await posAuthService.disablePOSAccess(req.params.employeeId)
    res.json({
      success: true,
      data,
      message: 'POS access disabled successfully'
    })
  } catch (error) {
    const status = error.statusCode || 500
    res.status(status).json({
      success: false,
      error: { message: error.message || 'Failed to disable POS access', code: error.code }
    })
  }
})

/**
 * @route   POST /api/pos-auth/:employeeId/reset-attempts
 * @desc    Reset failed login attempts
 * @access  Private (Admin only)
 */
employeePOSAuthsRouter.post('/:employeeId/reset-attempts', validateEmployeeId, async (req, res) => {
  try {
    const data = await posAuthService.resetFailedAttempts(req.params.employeeId)
    res.json({
      success: true,
      data,
      message: 'Failed attempts reset and account unlocked successfully'
    })
  } catch (error) {
    const status = error.statusCode || 500
    res.status(status).json({
      success: false,
      error: { message: error.message || 'Failed to reset attempts', code: error.code }
    })
  }
})

/**
 * @route   DELETE /api/pos-auth/:employeeId
 * @desc    Revoke POS access
 * @access  Private (Admin only)
 */
employeePOSAuthsRouter.delete('/:employeeId', validateEmployeeId, async (req, res) => {
  try {
    await posAuthService.revokePOSAccess(req.params.employeeId)
    res.json({
      success: true,
      message: 'POS access revoked successfully'
    })
  } catch (error) {
    const status = error.statusCode || 500
    res.status(status).json({
      success: false,
      error: { message: error.message || 'Failed to revoke POS access', code: error.code }
    })
  }
})

module.exports = employeePOSAuthsRouter