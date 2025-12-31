/**
 * Client Configuration Controller
 * 
 * Exposes server configuration to frontend clients.
 * Only includes PUBLIC configuration - never expose secrets!
 */

const logger = require('../utils/logger')

/**
 * Get client-safe configuration
 * @route GET /api/config
 * @access Public
 */
const getClientConfig = (req, res) => {
  try {
    const config = {
      // API URLs
      apiUrl: process.env.APP_URL || 'http://localhost:3001',
      socketUrl: process.env.APP_URL || 'http://localhost:3001',

      // Environment info
      environment: process.env.NODE_ENV || 'development',

      // Feature flags
      features: {
        vnpayEnabled: process.env.VNP_TEST_MODE === 'true',
        realTimeNotifications: true
      },

      // Client settings
      settings: {
        notificationRefreshInterval: 300000, // 5 minutes fallback
        sessionTimeout: 3600000, // 1 hour
        toastDuration: 10000 // 10 seconds
      },

      // Timestamps
      timestamp: new Date().toISOString(),
      version: process.env.API_VERSION || '1.0.0'
    }

    logger.info('Client config requested', {
      ip: req.ip,
      userAgent: req.get('user-agent')
    })

    res.json(config)
  } catch (error) {
    logger.error('Error getting client config:', error)
    res.status(500).json({
      error: 'Failed to get configuration',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
}

/**
 * Health check endpoint
 * @route GET /api/config/health
 * @access Public
 */
const healthCheck = (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  })
}

module.exports = {
  getClientConfig,
  healthCheck
}
