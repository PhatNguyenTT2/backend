const settingsRouter = require('express').Router();
const SystemSettings = require('../models/systemSettings');

/**
 * Settings Controller
 * 
 * Endpoints:
 * - GET /api/settings - Get all settings (Admin only)
 * - GET /api/settings/customer-discounts - Get customer discount rates
 * - PUT /api/settings/customer-discounts - Update customer discount rates (Admin only)
 * - GET /api/settings/pos-security - Get POS security configuration
 * - PUT /api/settings/pos-security - Update POS security configuration (Admin only)
 */

// ============ GET ALL SETTINGS (ADMIN ONLY) ============
/**
 * GET /api/settings
 * Get the single system settings document with all configuration
 */
settingsRouter.get('/', async (request, response) => {
  try {
    const settings = await SystemSettings.getSettings();

    response.json({
      success: true,
      data: settings,
      message: 'System settings retrieved successfully'
    });
  } catch (error) {
    console.error('❌ Error fetching settings:', error);
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch settings',
        code: 'INTERNAL_ERROR',
        details: error.message
      }
    });
  }
});

// ============ CUSTOMER DISCOUNTS ============

/**
 * POST /api/settings/customer-discounts/reset
 * Reset customer discount rates to default values
 */
settingsRouter.post('/customer-discounts/reset', async (request, response) => {
  try {
    const settings = await SystemSettings.resetCustomerDiscounts(null);

    console.log('✅ Customer discounts reset to defaults');

    response.json({
      success: true,
      message: 'Customer discounts reset to default values',
      data: settings.customerDiscounts
    });

  } catch (error) {
    console.error('❌ Error resetting customer discounts:', error);
    response.status(500).json({
      success: false,
      error: {
        message: error.message || 'Failed to reset customer discounts',
        code: 'INTERNAL_ERROR',
        details: error.message
      }
    });
  }
});

/**
 * GET /api/settings/customer-discounts
 * Get customer discount rates
 * Available to all authenticated users
 */
settingsRouter.get('/customer-discounts', async (request, response) => {
  try {
    const discounts = await SystemSettings.getCustomerDiscounts();

    response.json({
      success: true,
      data: discounts,
      message: 'Customer discount rates retrieved successfully'
    });
  } catch (error) {
    console.error('❌ Error fetching customer discounts:', error);
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch customer discounts',
        code: 'INTERNAL_ERROR',
        details: error.message
      }
    });
  }
});

/**
 * POST /api/settings/customer-discounts/reset
 * Reset customer discount rates to default values
 */
settingsRouter.post('/customer-discounts/reset', async (request, response) => {
  try {
    const settings = await SystemSettings.resetCustomerDiscounts(null);

    console.log('✅ Customer discounts reset to defaults');

    response.json({
      success: true,
      message: 'Customer discounts reset to default values',
      data: settings.customerDiscounts
    });

  } catch (error) {
    console.error('❌ Error resetting customer discounts:', error);
    response.status(500).json({
      success: false,
      error: {
        message: error.message || 'Failed to reset customer discounts',
        code: 'INTERNAL_ERROR',
        details: error.message
      }
    });
  }
});

/**
 * PUT /api/settings/customer-discounts
 * Update customer discount rates (Admin only)
 * 
 * Body: { retail: Number, wholesale: Number, vip: Number }
 */
settingsRouter.put('/customer-discounts', async (request, response) => {
  try {
    const { retail, wholesale, vip } = request.body;

    // Validation
    if (retail === undefined || retail === null) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Retail discount is required',
          code: 'MISSING_RETAIL_DISCOUNT'
        }
      });
    }

    if (wholesale === undefined || wholesale === null) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Wholesale discount is required',
          code: 'MISSING_WHOLESALE_DISCOUNT'
        }
      });
    }

    if (vip === undefined || vip === null) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'VIP discount is required',
          code: 'MISSING_VIP_DISCOUNT'
        }
      });
    }

    // Validate range
    const discounts = { retail, wholesale, vip };
    for (const [type, value] of Object.entries(discounts)) {
      const numValue = parseFloat(value);
      if (isNaN(numValue)) {
        return response.status(400).json({
          success: false,
          error: {
            message: `${type} discount must be a valid number`,
            code: 'INVALID_DISCOUNT_VALUE'
          }
        });
      }
      if (numValue < 0 || numValue > 100) {
        return response.status(400).json({
          success: false,
          error: {
            message: `${type} discount must be between 0 and 100`,
            code: 'DISCOUNT_OUT_OF_RANGE'
          }
        });
      }
    }

    // Update settings (no employeeId tracking in this project pattern)
    const settings = await SystemSettings.updateCustomerDiscounts(
      {
        retail: parseFloat(retail),
        wholesale: parseFloat(wholesale),
        vip: parseFloat(vip)
      },
      null
    );

    console.log('✅ Customer discounts updated:', {
      retail: settings.customerDiscounts.retail,
      wholesale: settings.customerDiscounts.wholesale,
      vip: settings.customerDiscounts.vip
    });

    response.json({
      success: true,
      message: 'Customer discounts updated successfully',
      data: settings.customerDiscounts
    });

  } catch (error) {
    console.error('❌ Error updating customer discounts:', error);
    response.status(500).json({
      success: false,
      error: {
        message: error.message || 'Failed to update customer discounts',
        code: 'INTERNAL_ERROR',
        details: error.message
      }
    });
  }
});

// ============ POS SECURITY ============

/**
 * POST /api/settings/pos-security/reset
 * Reset POS security configuration to default values
 */
settingsRouter.post('/pos-security/reset', async (request, response) => {
  try {
    const settings = await SystemSettings.resetPOSSecurity(null);

    console.log('✅ POS security reset to defaults');

    response.json({
      success: true,
      message: 'POS security configuration reset to default values',
      data: settings.posSecurity
    });

  } catch (error) {
    console.error('❌ Error resetting POS security:', error);
    response.status(500).json({
      success: false,
      error: {
        message: error.message || 'Failed to reset POS security',
        code: 'INTERNAL_ERROR',
        details: error.message
      }
    });
  }
});

/**
 * GET /api/settings/pos-security
 * Get POS security configuration
 * Available to all authenticated users (needed for POS auth)
 */
settingsRouter.get('/pos-security', async (request, response) => {
  try {
    const posSecurity = await SystemSettings.getPOSSecurity();

    response.json({
      success: true,
      data: posSecurity,
      message: 'POS security configuration retrieved successfully'
    });
  } catch (error) {
    console.error('❌ Error fetching POS security:', error);
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch POS security configuration',
        code: 'INTERNAL_ERROR',
        details: error.message
      }
    });
  }
});

/**
 * POST /api/settings/pos-security/reset
 * Reset POS security configuration to default values
 */
settingsRouter.post('/pos-security/reset', async (request, response) => {
  try {
    const settings = await SystemSettings.resetPOSSecurity(null);

    console.log('✅ POS security reset to defaults');

    response.json({
      success: true,
      message: 'POS security configuration reset to default values',
      data: settings.posSecurity
    });

  } catch (error) {
    console.error('❌ Error resetting POS security:', error);
    response.status(500).json({
      success: false,
      error: {
        message: error.message || 'Failed to reset POS security',
        code: 'INTERNAL_ERROR',
        details: error.message
      }
    });
  }
});

/**
 * PUT /api/settings/pos-security
 * Update POS security configuration (Admin only)
 * 
 * Body: { 
 *   maxFailedAttempts: Number (1-10),
 *   lockDurationMinutes: Number (1-1440)
 * }
 */
settingsRouter.put('/pos-security', async (request, response) => {
  try {
    const { maxFailedAttempts, lockDurationMinutes } = request.body;

    // Validation
    if (maxFailedAttempts !== undefined && maxFailedAttempts !== null) {
      const attempts = parseInt(maxFailedAttempts);
      if (isNaN(attempts) || attempts < 1 || attempts > 10) {
        return response.status(400).json({
          success: false,
          error: {
            message: 'maxFailedAttempts must be between 1 and 10',
            code: 'INVALID_FAILED_ATTEMPTS'
          }
        });
      }
    }

    if (lockDurationMinutes !== undefined && lockDurationMinutes !== null) {
      const duration = parseInt(lockDurationMinutes);
      if (isNaN(duration) || duration < 1 || duration > 1440) {
        return response.status(400).json({
          success: false,
          error: {
            message: 'lockDurationMinutes must be between 1 and 1440 (24 hours)',
            code: 'INVALID_LOCK_DURATION'
          }
        });
      }
    }

    // Build security object with only provided fields
    const security = {};
    if (maxFailedAttempts !== undefined && maxFailedAttempts !== null) {
      security.maxFailedAttempts = parseInt(maxFailedAttempts);
    }
    if (lockDurationMinutes !== undefined && lockDurationMinutes !== null) {
      security.lockDurationMinutes = parseInt(lockDurationMinutes);
    }

    // Update settings (no employeeId tracking in this project pattern)
    const settings = await SystemSettings.updatePOSSecurity(security, null);

    console.log('✅ POS security updated:', settings.posSecurity);

    response.json({
      success: true,
      message: 'POS security configuration updated successfully',
      data: settings.posSecurity
    });

  } catch (error) {
    console.error('❌ Error updating POS security:', error);
    response.status(500).json({
      success: false,
      error: {
        message: error.message || 'Failed to update POS security configuration',
        code: 'INTERNAL_ERROR',
        details: error.message
      }
    });
  }
});

module.exports = settingsRouter;
