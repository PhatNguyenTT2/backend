const cron = require('node-cron')
const DetailInventory = require('../models/detailInventory')
const Supplier = require('../models/supplier')
const PurchaseOrder = require('../models/purchaseOrder')
const notificationEmitter = require('./notificationEmitter')
const logger = require('../utils/logger')

/**
 * Notification Scheduler Service
 * Runs periodic checks for notification triggers
 */
class NotificationScheduler {
  constructor() {
    this.jobs = []
  }

  /**
   * Initialize all scheduled jobs
   */
  async init() {
    logger.info('Initializing notification scheduler...')

    // Check for expired/expiring batches every hour
    const expiryCheckJob = cron.schedule('0 * * * *', async () => {
      await this.checkBatchExpiry()
    })
    this.jobs.push({ name: 'Batch Expiry Check', job: expiryCheckJob })

    // Check for low stock every 2 hours
    const lowStockCheckJob = cron.schedule('0 */2 * * *', async () => {
      await this.checkLowStock()
    })
    this.jobs.push({ name: 'Low Stock Check', job: lowStockCheckJob })

    // Check supplier credit limits every 6 hours
    const creditCheckJob = cron.schedule('0 */6 * * *', async () => {
      await this.checkSupplierCredit()
    })
    this.jobs.push({ name: 'Supplier Credit Check', job: creditCheckJob })

    // Run initial checks
    await this.checkBatchExpiry()
    await this.checkLowStock()
    await this.checkSupplierCredit()

    logger.info(`Notification scheduler initialized with ${this.jobs.length} jobs`)
  }

  /**
   * Check for expired and expiring batches
   * Emits batch refresh instead of individual notifications to avoid toast spam
   */
  async checkBatchExpiry() {
    try {
      logger.info('Running batch expiry check...')

      // Trigger notification refresh (no toasts, just update list)
      const allNotifications = await notificationEmitter.getAllNotifications()
      notificationEmitter.refreshNotifications(allNotifications)

      logger.info('Batch expiry check completed - notification refresh triggered')
    } catch (error) {
      logger.error('Error in batch expiry check:', error)
    }
  }

  /**
   * Check for low stock levels
   * Emits batch refresh instead of individual notifications to avoid toast spam
   */
  async checkLowStock() {
    try {
      logger.info('Running low stock check...')

      // Trigger notification refresh (no toasts, just update list)
      const allNotifications = await notificationEmitter.getAllNotifications()
      notificationEmitter.refreshNotifications(allNotifications)

      logger.info('Low stock check completed - notification refresh triggered')
    } catch (error) {
      logger.error('Error in low stock check:', error)
    }
  }

  /**
   * Check supplier credit limits
   * Emits batch refresh instead of individual notifications to avoid toast spam
   */
  async checkSupplierCredit() {
    try {
      logger.info('Running supplier credit check...')

      // Trigger notification refresh (no toasts, just update list)
      const allNotifications = await notificationEmitter.getAllNotifications()
      notificationEmitter.refreshNotifications(allNotifications)

      logger.info('Supplier credit check completed - notification refresh triggered')
    } catch (error) {
      logger.error('Error in supplier credit check:', error)
    }
  }

  /**
   * Stop all scheduled jobs
   */
  stop() {
    this.jobs.forEach(({ name, job }) => {
      job.stop()
      logger.info(`Stopped job: ${name}`)
    })
  }
}

module.exports = new NotificationScheduler()
