const logger = require('../utils/logger')

/**
 * Notification Emitter Service
 * Handles real-time notification broadcasting via Socket.IO
 */
class NotificationEmitter {
  constructor() {
    this.io = null
  }

  /**
   * Initialize with Socket.IO instance
   * @param {SocketIO.Server} io - Socket.IO server instance
   */
  initialize(io) {
    this.io = io
    logger.info('NotificationEmitter initialized')
  }

  /**
   * Emit notification to all connected clients
   * @param {string} event - Event name
   * @param {object} data - Notification data
   */
  emit(event, data) {
    if (!this.io) {
      logger.warn('NotificationEmitter not initialized, skipping emit')
      return
    }

    this.io.emit(event, {
      ...data,
      timestamp: new Date().toISOString()
    })

    logger.info('Notification emitted', { event, notificationId: data.id })
  }

  /**
   * Emit inventory expiry notification
   * @param {object} data - Batch and inventory details
   */
  emitInventoryExpired(data) {
    const notification = {
      id: `expired-${data.detailInventoryId}`,
      type: 'expired_on_shelf',
      severity: 'critical',
      title: 'Expired Batch on Shelf',
      message: `${data.batchCode} - ${data.productName} has expired but still has ${data.quantity} units on shelf`,
      batchCode: data.batchCode,
      productName: data.productName,
      quantity: data.quantity,
      expiryDate: data.expiryDate,
      detailInventoryId: data.detailInventoryId
    }

    this.emit('notification:inventory:expired', notification)
  }

  /**
   * Emit inventory expiring soon notification
   * @param {object} data - Batch and inventory details
   */
  emitInventoryExpiring(data) {
    const notification = {
      id: `expiring-${data.detailInventoryId}`,
      type: 'expiring_soon',
      severity: 'warning',
      title: 'Batch Expiring Soon',
      message: `${data.batchCode} - ${data.productName} expires in ${data.daysUntilExpiry} days (${data.quantity} units on shelf)`,
      batchCode: data.batchCode,
      productName: data.productName,
      quantity: data.quantity,
      expiryDate: data.expiryDate,
      daysUntilExpiry: data.daysUntilExpiry,
      detailInventoryId: data.detailInventoryId
    }

    this.emit('notification:inventory:expiring', notification)
  }

  /**
   * Emit low stock notification
   * @param {object} data - Stock details
   */
  emitLowStock(data) {
    const notification = {
      id: `low-stock-${data.detailInventoryId}`,
      type: 'low_stock',
      severity: 'warning',
      title: 'Low Stock Alert',
      message: `${data.batchCode} - ${data.productName} is running low (${data.quantity} units remaining)`,
      batchCode: data.batchCode,
      productName: data.productName,
      quantity: data.quantity,
      detailInventoryId: data.detailInventoryId
    }

    this.emit('notification:stock:low', notification)
  }

  /**
   * Emit supplier credit warning notification
   * @param {object} data - Supplier credit details
   */
  emitSupplierCreditWarning(data) {
    let severity = 'warning'
    let type = 'credit_high_utilization'
    let title = 'High Credit Utilization'

    if (data.currentDebt > data.creditLimit) {
      severity = 'critical'
      type = 'credit_exceeded'
      title = 'Credit Limit Exceeded'
    } else if (data.creditUtilization >= 90) {
      severity = 'high'
      type = 'credit_near_limit'
      title = 'Credit Limit Almost Reached'
    }

    const notification = {
      id: `supplier-${type}-${data.supplierId}`,
      type,
      severity,
      title,
      message: data.message,
      supplierCode: data.supplierCode,
      supplierName: data.supplierName,
      currentDebt: data.currentDebt,
      creditLimit: data.creditLimit,
      creditUtilization: data.creditUtilization,
      supplierId: data.supplierId
    }

    this.emit('notification:supplier:credit', notification)
  }

  /**
   * Emit expired batch in warehouse notification
   * @param {object} data - Batch and inventory details
   */
  emitExpiredInWarehouse(data) {
    const notification = {
      id: `expired-warehouse-${data.detailInventoryId}`,
      type: 'expired_in_warehouse',
      severity: 'high',
      title: 'Expired Batch in Warehouse',
      message: `${data.batchCode} - ${data.productName} has expired with ${data.quantity} units in warehouse`,
      batchCode: data.batchCode,
      productName: data.productName,
      quantity: data.quantity,
      expiryDate: data.expiryDate,
      detailInventoryId: data.detailInventoryId
    }

    this.emit('notification:inventory:expired', notification)
  }

  /**
   * Get all current notifications
   * Used for initial load when socket connects
   */
  async getAllNotifications() {
    const DetailInventory = require('../models/detailInventory')
    const ProductBatch = require('../models/productBatch')
    const Supplier = require('../models/supplier')

    const notifications = []
    const now = new Date()
    const thirtyDaysFromNow = new Date()
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)

    try {
      // Get inventory notifications (expired & expiring batches)
      const detailInventories = await DetailInventory.find({})
        .populate({
          path: 'batchId',
          populate: { path: 'product', select: 'name productCode' }
        })

      detailInventories.forEach(detail => {
        const batch = detail.batchId
        if (!batch || !batch.expiryDate) return

        const expiryDate = new Date(batch.expiryDate)
        const isExpired = expiryDate <= now
        const isExpiringSoon = expiryDate > now && expiryDate <= thirtyDaysFromNow
        const daysUntilExpiry = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24))

        const productName = batch.product?.name || 'Unknown Product'

        // Priority-based: Only ONE notification per batch
        // 1. Critical: Expired on shelf (highest priority)
        if (isExpired && detail.quantityOnShelf > 0) {
          notifications.push({
            id: `expired-shelf-${detail._id}`,
            type: 'expired_on_shelf',
            severity: 'critical',
            title: 'Expired Batch on Shelf',
            message: `${batch.batchCode} - ${productName} has expired`,
            batchCode: batch.batchCode,
            productName,
            expiryDate: batch.expiryDate,
            quantity: detail.quantityOnShelf
          })
        }
        // 2. High: Expired in warehouse (only if NOT on shelf)
        else if (isExpired && detail.quantityOnHand > 0) {
          notifications.push({
            id: `expired-warehouse-${detail._id}`,
            type: 'expired_in_warehouse',
            severity: 'high',
            title: 'Expired Batch in Warehouse',
            message: `${batch.batchCode} - ${productName} has expired`,
            batchCode: batch.batchCode,
            productName,
            expiryDate: batch.expiryDate,
            quantity: detail.quantityOnHand
          })
        }
        // 3. Warning: Expiring soon (only if NOT expired)
        else if (isExpiringSoon && (detail.quantityOnShelf > 0 || detail.quantityOnHand > 0)) {
          notifications.push({
            id: `expiring-${detail._id}`,
            type: 'expiring_soon',
            severity: 'warning',
            title: 'Batch Expiring Soon',
            message: `${batch.batchCode} - ${productName} expires in ${daysUntilExpiry} days`,
            batchCode: batch.batchCode,
            productName,
            expiryDate: batch.expiryDate,
            daysUntilExpiry,
            quantity: detail.quantityOnShelf + detail.quantityOnHand
          })
        }
      })

      // Get low stock notifications
      const lowStockBatches = await ProductBatch.find({ quantity: { $lt: 10 }, status: 'active' })
        .populate('product', 'name productCode')

      lowStockBatches.forEach(batch => {
        notifications.push({
          id: `low-stock-${batch._id}`,
          type: 'low_stock',
          severity: 'warning',
          title: 'Low Stock Alert',
          message: `${batch.batchCode} - ${batch.product?.name || 'Unknown'} has only ${batch.quantity} units`,
          batchCode: batch.batchCode,
          productName: batch.product?.name,
          quantity: batch.quantity
        })
      })

      // Get supplier credit notifications
      const suppliers = await Supplier.find({ isActive: true })

      suppliers.forEach(supplier => {
        const { currentDebt = 0, creditLimit = 0 } = supplier
        if (creditLimit === 0) return

        const creditUtilization = (currentDebt / creditLimit) * 100
        let severity = null
        let type = null

        if (creditUtilization >= 100) {
          severity = 'critical'
          type = 'credit_exceeded'
        } else if (creditUtilization >= 90) {
          severity = 'critical'
          type = 'credit_near_limit'
        } else if (creditUtilization >= 75) {
          severity = 'high'
          type = 'credit_high'
        } else if (creditUtilization >= 50) {
          severity = 'warning'
          type = 'credit_warning'
        }

        if (severity) {
          notifications.push({
            id: `credit-${supplier._id}`,
            type,
            severity,
            title: severity === 'critical' ? 'Credit Limit Exceeded' : 'Credit Limit Warning',
            message: `${supplier.name} has used ${creditUtilization.toFixed(1)}% of credit limit`,
            supplierCode: supplier.supplierCode,
            supplierName: supplier.name,
            currentDebt,
            creditLimit,
            creditUtilization
          })
        }
      })

      return notifications
    } catch (error) {
      console.error('Error getting all notifications:', error)
      return []
    }
  }
}

// Export singleton instance
const notificationEmitter = new NotificationEmitter()
module.exports = notificationEmitter
