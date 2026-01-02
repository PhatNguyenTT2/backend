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
   */
  async checkBatchExpiry() {
    try {
      logger.info('Running batch expiry check...')

      const detailInventories = await DetailInventory.find({
        $or: [
          { quantityOnShelf: { $gt: 0 } },
          { quantityOnHand: { $gt: 0 } }
        ]
      }).populate({
        path: 'batchId',
        populate: { path: 'product', select: 'name productCode' }
      })

      const now = new Date()
      const thirtyDaysFromNow = new Date()
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)

      let expiredCount = 0
      let expiringCount = 0

      for (const detail of detailInventories) {
        const batch = detail.batchId
        if (!batch || !batch.expiryDate) continue

        const expiryDate = new Date(batch.expiryDate)
        const isExpired = expiryDate <= now
        const isExpiringSoon = expiryDate > now && expiryDate <= thirtyDaysFromNow

        const productName = batch.product?.name || 'Unknown Product'

        // Expired batch on shelf - Critical
        if (isExpired && detail.quantityOnShelf > 0) {
          notificationEmitter.emitInventoryExpired({
            detailInventoryId: detail._id.toString(),
            batchCode: batch.batchCode,
            productName,
            quantity: detail.quantityOnShelf,
            expiryDate: batch.expiryDate
          })
          expiredCount++
        }

        // Expired batch in warehouse - High
        if (isExpired && detail.quantityOnHand > 0) {
          notificationEmitter.emitExpiredInWarehouse({
            detailInventoryId: detail._id.toString(),
            batchCode: batch.batchCode,
            productName,
            quantity: detail.quantityOnHand,
            expiryDate: batch.expiryDate
          })
          expiredCount++
        }

        // Expiring soon on shelf - Warning
        if (isExpiringSoon && detail.quantityOnShelf > 0) {
          const daysUntilExpiry = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24))
          notificationEmitter.emitInventoryExpiring({
            detailInventoryId: detail._id.toString(),
            batchCode: batch.batchCode,
            productName,
            quantity: detail.quantityOnShelf,
            expiryDate: batch.expiryDate,
            daysUntilExpiry
          })
          expiringCount++
        }
      }

      logger.info('Batch expiry check completed', { expiredCount, expiringCount })
    } catch (error) {
      logger.error('Error in batch expiry check:', error)
    }
  }

  /**
   * Check for low stock levels
   */
  async checkLowStock() {
    try {
      logger.info('Running low stock check...')

      const threshold = 10 // Low stock threshold

      const detailInventories = await DetailInventory.find({}).populate({
        path: 'batchId',
        populate: { path: 'product', select: 'name productCode' }
      })

      let lowStockCount = 0

      for (const detail of detailInventories) {
        const totalStock = (detail.quantityOnHand || 0) + (detail.quantityOnShelf || 0)
        const batch = detail.batchId

        if (!batch || !batch.product) continue

        const productName = batch.product.name || 'Unknown Product'

        if (totalStock > 0 && totalStock <= threshold) {
          notificationEmitter.emitLowStock({
            detailInventoryId: detail._id.toString(),
            batchCode: batch.batchCode,
            productName,
            quantity: totalStock
          })
          lowStockCount++
        }
      }

      logger.info('Low stock check completed', { lowStockCount })
    } catch (error) {
      logger.error('Error in low stock check:', error)
    }
  }

  /**
   * Check supplier credit limits
   */
  async checkSupplierCredit() {
    try {
      logger.info('Running supplier credit check...')

      const suppliers = await Supplier.find({
        isActive: true,
        creditLimit: { $gt: 0 }
      })

      let warningCount = 0

      for (const supplier of suppliers) {
        const supplierObj = supplier.toObject({ getters: true })
        const creditLimit = supplierObj.creditLimit || 0

        // Calculate currentDebt from received POs that are unpaid/partial
        const unpaidPOs = await PurchaseOrder.find({
          supplier: supplier._id,
          status: 'received',
          paymentStatus: { $in: ['unpaid', 'partial'] }
        }).select('totalPrice')

        const currentDebt = unpaidPOs.reduce((sum, po) => {
          const price = po.totalPrice || 0
          return sum + (typeof price === 'object' ? parseFloat(price.toString()) : price)
        }, 0)

        const creditUtilization = creditLimit > 0 ? (currentDebt / creditLimit) * 100 : 0

        let shouldNotify = false

        // Critical: Credit limit exceeded (100%+)
        if (currentDebt > creditLimit) {
          shouldNotify = true
        }
        // Critical: Near limit (90-99%)
        else if (creditUtilization >= 90) {
          shouldNotify = true
        }
        // High: High utilization (75-89%)
        else if (creditUtilization >= 75) {
          shouldNotify = true
        }
        // Warning: Medium utilization (50-74%)
        else if (creditUtilization >= 50) {
          shouldNotify = true
        }

        if (shouldNotify) {
          notificationEmitter.emitSupplierCreditWarning({
            supplierId: supplier._id.toString(),
            supplierCode: supplierObj.supplierCode,
            supplierName: supplierObj.companyName,
            currentDebt,
            creditLimit,
            creditUtilization
          })
          warningCount++
        }
      }

      logger.info('Supplier credit check completed', { warningCount })
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
