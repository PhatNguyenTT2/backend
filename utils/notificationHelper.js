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

/**
 * Check and emit supplier credit notification after payment changes
 * Call this after:
 * - Creating payment for PurchaseOrder
 * - Updating payment (especially refund: status from completed to failed/pending)
 * - Deleting payment
 * 
 * @param {string} supplierId - Supplier ID to check
 */
const checkAndEmitSupplierCredit = async (supplierId) => {
  try {
    const PurchaseOrder = require('../models/purchaseOrder')
    const Supplier = require('../models/supplier')

    // Get supplier with credit limit
    const supplier = await Supplier.findById(supplierId)
    if (!supplier) {
      logger.warn(`⚠️ Supplier ${supplierId} not found for credit check`)
      return
    }

    const supplierObj = supplier.toObject({ getters: true })
    const creditLimit = supplierObj.creditLimit || 0

    // Skip if no credit limit set
    if (creditLimit === 0) {
      logger.info(`ℹ️ Supplier ${supplier.companyName} has no credit limit, skipping notification`)
      return
    }

    // Calculate currentDebt from received POs that are unpaid/partial
    const unpaidPOs = await PurchaseOrder.find({
      supplier: supplierId,
      status: 'received',
      paymentStatus: { $in: ['unpaid', 'partial'] }
    }).select('totalPrice')

    const currentDebt = unpaidPOs.reduce((sum, po) => {
      const price = po.totalPrice || 0
      return sum + (typeof price === 'object' ? parseFloat(price.toString()) : price)
    }, 0)

    const creditUtilization = (currentDebt / creditLimit) * 100

    logger.info(`📊 Supplier ${supplier.companyName}: Debt ₫${currentDebt.toLocaleString()}, Limit ₫${creditLimit.toLocaleString()}, Utilization ${creditUtilization.toFixed(1)}%`)

    // Emit notification if utilization >= 50%
    if (creditUtilization >= 50) {
      notificationEmitter.emitSupplierCreditWarning({
        supplierId: supplier._id.toString(),
        supplierCode: supplierObj.supplierCode,
        supplierName: supplierObj.companyName,
        currentDebt,
        creditLimit,
        creditUtilization
      })
      logger.info(`🔔 Emitted supplier credit warning for ${supplier.companyName}`)
    } else {
      // If utilization is below 50%, refresh to remove old notification if it exists
      await refreshNotifications()
    }

  } catch (error) {
    logger.error('❌ Failed to check supplier credit:', error)
    // Don't throw - this is a non-critical operation
  }
}

module.exports = {
  refreshNotifications,
  checkAndEmitSupplierCredit
}
