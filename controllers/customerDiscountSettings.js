const express = require('express');
const router = express.Router();
const CustomerDiscountSettings = require('../models/customerDiscountSettings');
const Employee = require('../models/employee');

/**
 * @route   GET /api/customer-discount-settings
 * @desc    Get currently active customer discount rates
 * @access  Public (used by POS and order creation)
 */
router.get('/', async (req, res) => {
  try {
    const activeDiscounts = await CustomerDiscountSettings.getActiveDiscounts();

    res.json({
      success: true,
      data: {
        retail: activeDiscounts.retail,
        wholesale: activeDiscounts.wholesale,
        vip: activeDiscounts.vip
      }
    });
  } catch (error) {
    console.error('❌ Error fetching active customer discounts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch customer discount settings',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/customer-discount-settings/history
 * @desc    Get version history of customer discount changes
 * @access  Admin/Manager
 * @query   limit - Number of versions to return (default: 50)
 */
router.get('/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;

    if (limit < 1 || limit > 200) {
      return res.status(400).json({
        success: false,
        message: 'Limit must be between 1 and 200'
      });
    }

    const history = await CustomerDiscountSettings.getHistory(limit);

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('❌ Error fetching discount settings history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch discount settings history',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/customer-discount-settings/version/:versionNumber
 * @desc    Get a specific version of customer discount settings
 * @access  Admin/Manager
 * @param   versionNumber - Version number to retrieve
 */
router.get('/version/:versionNumber', async (req, res) => {
  try {
    const versionNumber = parseInt(req.params.versionNumber);

    if (isNaN(versionNumber) || versionNumber < 1) {
      return res.status(400).json({
        success: false,
        message: 'Invalid version number'
      });
    }

    const version = await CustomerDiscountSettings.getVersion(versionNumber);

    if (!version) {
      return res.status(404).json({
        success: false,
        message: `Version ${versionNumber} not found`
      });
    }

    res.json({
      success: true,
      data: version
    });
  } catch (error) {
    console.error('❌ Error fetching discount settings version:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch discount settings version',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/customer-discount-settings
 * @desc    Create a new version of customer discount settings
 * @access  Admin/Manager
 * @body    { retail: Number, wholesale: Number, vip: Number, reason: String, employeeId: ObjectId }
 */
router.post('/', async (req, res) => {
  try {
    const { retail, wholesale, vip, reason, employeeId } = req.body;

    // Validate required fields
    if (retail === undefined || wholesale === undefined || vip === undefined) {
      return res.status(400).json({
        success: false,
        message: 'retail, wholesale, and vip discounts are required'
      });
    }

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: 'employeeId is required for audit trail'
      });
    }

    // Validate discount values
    const discounts = { retail, wholesale, vip };
    for (const [type, value] of Object.entries(discounts)) {
      const numValue = parseFloat(value);
      if (isNaN(numValue) || numValue < 0 || numValue > 100) {
        return res.status(400).json({
          success: false,
          message: `${type} discount must be between 0 and 100`
        });
      }
    }

    // Verify employee exists
    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Create new version
    const newVersion = await CustomerDiscountSettings.createVersion(
      {
        retail: parseFloat(retail),
        wholesale: parseFloat(wholesale),
        vip: parseFloat(vip)
      },
      employeeId,
      reason || 'Manual update'
    );

    res.status(201).json({
      success: true,
      message: 'Customer discount settings updated successfully',
      data: newVersion
    });
  } catch (error) {
    console.error('❌ Error creating new discount settings version:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update customer discount settings',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/customer-discount-settings/rollback
 * @desc    Rollback to a previous version of discount settings
 * @access  Admin
 * @body    { versionNumber: Number, reason: String, employeeId: ObjectId }
 */
router.post('/rollback', async (req, res) => {
  try {
    const { versionNumber, reason, employeeId } = req.body;

    // Validate required fields
    if (!versionNumber) {
      return res.status(400).json({
        success: false,
        message: 'versionNumber is required'
      });
    }

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: 'employeeId is required for audit trail'
      });
    }

    const version = parseInt(versionNumber);
    if (isNaN(version) || version < 1) {
      return res.status(400).json({
        success: false,
        message: 'Invalid version number'
      });
    }

    // Verify employee exists
    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Perform rollback
    const rolledBackVersion = await CustomerDiscountSettings.rollbackToVersion(
      version,
      employeeId,
      reason || `Rollback to version ${version}`
    );

    res.json({
      success: true,
      message: `Successfully rolled back to version ${version}`,
      data: rolledBackVersion
    });
  } catch (error) {
    console.error('❌ Error rolling back discount settings:', error);

    // Handle specific error cases
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to rollback discount settings',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/customer-discount-settings/reset
 * @desc    Reset discount settings to default values
 * @access  Admin
 * @body    { reason: String, employeeId: ObjectId }
 */
router.post('/reset', async (req, res) => {
  try {
    const { reason, employeeId } = req.body;

    // Validate required fields
    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: 'employeeId is required for audit trail'
      });
    }

    // Verify employee exists
    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Get default values and create new version
    const defaults = CustomerDiscountSettings.getDefaults();
    const resetVersion = await CustomerDiscountSettings.createVersion(
      defaults,
      employeeId,
      reason || 'Reset to default values'
    );

    res.json({
      success: true,
      message: 'Customer discount settings reset to defaults',
      data: resetVersion
    });
  } catch (error) {
    console.error('❌ Error resetting discount settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset discount settings',
      error: error.message
    });
  }
});

module.exports = router;
