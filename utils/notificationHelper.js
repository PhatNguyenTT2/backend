const notificationEmitter = require('../services/notificationEmitter')
const logger = require('./logger')

/**
 * Refresh all notifications for all connected clients
 * Call this after ANY inventory-related changes to ensure UI stays in sync
 * 
 * Use cases:
 * - After moving batches between locations (shelf <-> warehouse)
 * - After stock adjustments (manual quantity changes)
 * - After completing stock out orders
 * - After receiving purchase orders
 * - After updating batch expiry dates
 * - After deleting/deactivating batches
 */
const refreshNotifications = async () => {
  try {
    const notifications = await notificationEmitter.getAllNotifications()

    // Emit to Socket.IO - will be received by all connected clients
    if (notificationEmitter.io) {
      notificationEmitter.io.emit('notification:refresh', notifications)
      logger.info(`✅ Notification refresh broadcast to all clients: ${notifications.length} notifications`)
    } else {
      logger.warn('⚠️ NotificationEmitter not initialized, skipping refresh')
    }

    return notifications
  } catch (error) {
    logger.error('❌ Failed to refresh notifications:', error)
    throw error
  }
}

module.exports = {
  refreshNotifications
}
