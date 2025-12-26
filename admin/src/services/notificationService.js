import api from './api'

/**
 * Notification Service
 * Handles all API calls related to system notifications
 */
const notificationService = {
  /**
   * Get inventory notifications (expired and expiring soon batches)
   * @returns {Promise<Object>} Notification data with counts and items
   */
  getInventoryNotifications: async () => {
    try {
      // Get all detail inventories with batch info
      const response = await api.get('/detail-inventories', {
        params: {
          limit: 1000 // Get all items
        }
      })

      if (!response.data.success) {
        throw new Error('Failed to fetch detail inventories')
      }

      const detailInventories = response.data.data.detailInventories || []
      const notifications = []

      const now = new Date()
      const thirtyDaysFromNow = new Date()
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)

      detailInventories.forEach(detail => {
        const batch = detail.batchId
        if (!batch || !batch.expiryDate) return

        const expiryDate = new Date(batch.expiryDate)
        const isExpired = expiryDate <= now
        const isExpiringSoon = expiryDate > now && expiryDate <= thirtyDaysFromNow

        // Get product name from batch.product
        const productName = batch.product?.name || 'Unknown Product'

        // Notification: Expired batch still on shelf
        if (isExpired && detail.quantityOnShelf > 0) {
          notifications.push({
            id: `expired-${detail._id || detail.id}`,
            type: 'expired_on_shelf',
            severity: 'critical',
            title: 'Expired Batch on Shelf',
            message: `${batch.batchCode} - ${productName} has expired but still has ${detail.quantityOnShelf} units on shelf`,
            batchCode: batch.batchCode,
            productName: productName,
            quantity: detail.quantityOnShelf,
            expiryDate: batch.expiryDate,
            detailInventoryId: detail._id || detail.id,
            timestamp: now.toISOString()
          })
        }

        // Notification: Expiring soon batch on shelf
        if (isExpiringSoon && detail.quantityOnShelf > 0) {
          const daysUntilExpiry = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24))
          notifications.push({
            id: `expiring-${detail._id || detail.id}`,
            type: 'expiring_soon',
            severity: 'warning',
            title: 'Batch Expiring Soon',
            message: `${batch.batchCode} - ${productName} expires in ${daysUntilExpiry} days (${detail.quantityOnShelf} units on shelf)`,
            batchCode: batch.batchCode,
            productName: productName,
            quantity: detail.quantityOnShelf,
            expiryDate: batch.expiryDate,
            daysUntilExpiry,
            detailInventoryId: detail._id || detail.id,
            timestamp: now.toISOString()
          })
        }

        // Notification: Expired batch in warehouse
        if (isExpired && detail.quantityOnHand > 0) {
          notifications.push({
            id: `expired-warehouse-${detail._id || detail.id}`,
            type: 'expired_in_warehouse',
            severity: 'high',
            title: 'Expired Batch in Warehouse',
            message: `${batch.batchCode} - ${productName} has expired with ${detail.quantityOnHand} units in warehouse`,
            batchCode: batch.batchCode,
            productName: productName,
            quantity: detail.quantityOnHand,
            expiryDate: batch.expiryDate,
            detailInventoryId: detail._id || detail.id,
            timestamp: now.toISOString()
          })
        }
      })

      // Sort by severity and expiry date
      const severityOrder = { critical: 0, high: 1, warning: 2 }
      notifications.sort((a, b) => {
        if (severityOrder[a.severity] !== severityOrder[b.severity]) {
          return severityOrder[a.severity] - severityOrder[b.severity]
        }
        return new Date(a.expiryDate) - new Date(b.expiryDate)
      })

      return {
        success: true,
        data: {
          notifications,
          counts: {
            total: notifications.length,
            critical: notifications.filter(n => n.severity === 'critical').length,
            high: notifications.filter(n => n.severity === 'high').length,
            warning: notifications.filter(n => n.severity === 'warning').length
          }
        }
      }
    } catch (error) {
      console.error('Error fetching inventory notifications:', error)
      throw error
    }
  },

  /**
   * Get low stock notifications
   * @param {number} threshold - Quantity threshold (default 10)
   * @returns {Promise<Object>} Low stock notification data
   */
  getLowStockNotifications: async (threshold = 10) => {
    try {
      const response = await api.get('/detail-inventories', {
        params: {
          limit: 1000
        }
      })

      if (!response.data.success) {
        throw new Error('Failed to fetch detail inventories')
      }

      const detailInventories = response.data.data.detailInventories || []
      const notifications = []

      detailInventories.forEach(detail => {
        const totalStock = (detail.quantityOnHand || 0) + (detail.quantityOnShelf || 0)
        const productName = detail.batchId?.product?.name || 'Unknown Product'

        if (totalStock > 0 && totalStock <= threshold) {
          notifications.push({
            id: `low-stock-${detail._id || detail.id}`,
            type: 'low_stock',
            severity: 'warning',
            title: 'Low Stock Alert',
            message: `${detail.batchId?.batchCode} - ${productName} is running low (${totalStock} units remaining)`,
            batchCode: detail.batchId?.batchCode,
            productName: productName,
            quantity: totalStock,
            detailInventoryId: detail._id || detail.id,
            timestamp: new Date().toISOString()
          })
        }
      })

      return {
        success: true,
        data: {
          notifications,
          count: notifications.length
        }
      }
    } catch (error) {
      console.error('Error fetching low stock notifications:', error)
      throw error
    }
  },

  /**
   * Get supplier credit limit notifications
   * @returns {Promise<Object>} Supplier credit notification data
   */
  getSupplierCreditNotifications: async () => {
    try {
      const response = await api.get('/suppliers', {
        params: {
          isActive: true,
          limit: 1000
        }
      })

      if (!response.data.success) {
        throw new Error('Failed to fetch suppliers')
      }

      const suppliers = response.data.data.suppliers || []
      const notifications = []

      suppliers.forEach(supplier => {
        const currentDebt = supplier.currentDebt || 0
        const creditLimit = supplier.creditLimit || 0
        const creditUtilization = supplier.creditUtilization || 0

        // Skip if no credit limit set
        if (creditLimit === 0) {
          return;
        }

        // Critical: Credit limit exceeded
        if (currentDebt > creditLimit) {
          const excessAmount = currentDebt - creditLimit
          notifications.push({
            id: `supplier-exceeded-${supplier.id}`,
            type: 'credit_exceeded',
            severity: 'critical',
            title: 'Credit Limit Exceeded',
            message: `${supplier.companyName} has exceeded credit limit by ₫${excessAmount.toLocaleString('vi-VN')}`,
            supplierCode: supplier.supplierCode,
            supplierName: supplier.companyName,
            currentDebt,
            creditLimit,
            excessAmount,
            creditUtilization,
            supplierId: supplier.id,
            timestamp: new Date().toISOString()
          })
        }
        // High: 90-100% credit utilization
        else if (creditUtilization >= 90) {
          const remainingCredit = creditLimit - currentDebt
          notifications.push({
            id: `supplier-near-limit-${supplier.id}`,
            type: 'credit_near_limit',
            severity: 'high',
            title: 'Credit Limit Almost Reached',
            message: `${supplier.companyName} is at ${creditUtilization.toFixed(1)}% credit utilization (₫${remainingCredit.toLocaleString('vi-VN')} remaining)`,
            supplierCode: supplier.supplierCode,
            supplierName: supplier.companyName,
            currentDebt,
            creditLimit,
            remainingCredit,
            creditUtilization,
            supplierId: supplier.id,
            timestamp: new Date().toISOString()
          })
        }
        // Warning: 80-89% credit utilization
        else if (creditUtilization >= 80) {
          const remainingCredit = creditLimit - currentDebt
          notifications.push({
            id: `supplier-high-utilization-${supplier.id}`,
            type: 'credit_high_utilization',
            severity: 'warning',
            title: 'High Credit Utilization',
            message: `${supplier.companyName} is at ${creditUtilization.toFixed(1)}% credit utilization (₫${remainingCredit.toLocaleString('vi-VN')} remaining)`,
            supplierCode: supplier.supplierCode,
            supplierName: supplier.companyName,
            currentDebt,
            creditLimit,
            remainingCredit,
            creditUtilization,
            supplierId: supplier.id,
            timestamp: new Date().toISOString()
          })
        }
      })

      // Sort by severity and utilization
      const severityOrder = { critical: 0, high: 1, warning: 2 }
      notifications.sort((a, b) => {
        if (severityOrder[a.severity] !== severityOrder[b.severity]) {
          return severityOrder[a.severity] - severityOrder[b.severity]
        }
        return b.creditUtilization - a.creditUtilization
      })

      return {
        success: true,
        data: {
          notifications,
          counts: {
            total: notifications.length,
            critical: notifications.filter(n => n.severity === 'critical').length,
            high: notifications.filter(n => n.severity === 'high').length,
            warning: notifications.filter(n => n.severity === 'warning').length
          }
        }
      }
    } catch (error) {
      console.error('Error fetching supplier credit notifications:', error)
      throw error
    }
  },

  /**
   * Get all notifications
   * @returns {Promise<Object>} All notification data
   */
  getAllNotifications: async () => {
    try {
      const [inventoryNotifications, lowStockNotifications, supplierCreditNotifications] = await Promise.all([
        notificationService.getInventoryNotifications(),
        notificationService.getLowStockNotifications(),
        notificationService.getSupplierCreditNotifications()
      ])

      const allNotifications = [
        ...inventoryNotifications.data.notifications,
        ...lowStockNotifications.data.notifications,
        ...supplierCreditNotifications.data.notifications
      ]

      return {
        success: true,
        data: {
          notifications: allNotifications,
          counts: {
            total: allNotifications.length,
            critical: inventoryNotifications.data.counts.critical + supplierCreditNotifications.data.counts.critical,
            high: inventoryNotifications.data.counts.high + supplierCreditNotifications.data.counts.high,
            warning: inventoryNotifications.data.counts.warning + supplierCreditNotifications.data.counts.warning + lowStockNotifications.data.count
          }
        }
      }
    } catch (error) {
      console.error('Error fetching all notifications:', error)
      throw error
    }
  }
}

export default notificationService
