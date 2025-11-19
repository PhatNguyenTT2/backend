import api from './api'

/**
 * Inventory Movement Batch Service
 * Handles all API calls related to batch-level inventory movements
 */
const inventoryMovementBatchService = {
  /**
   * Get all inventory movement batches with optional filters
   * @param {Object} params - Query parameters
   * @param {string} params.batchId - Filter by batch ID
   * @param {string} params.productId - Filter by product ID (via batch)
   * @param {string} params.inventoryDetail - Filter by detail inventory ID
   * @param {string} params.movementType - Filter by movement type (in/out/adjustment/transfer/audit)
   * @param {string} params.performedBy - Filter by employee ID
   * @param {string} params.purchaseOrderId - Filter by purchase order ID
   * @param {string} params.startDate - Filter movements from this date
   * @param {string} params.endDate - Filter movements until this date
   * @param {string} params.search - Search by movement number, batch code, or reason
   * @param {number} params.page - Page number for pagination
   * @param {number} params.limit - Items per page
   * @returns {Promise<Object>} Response with movements array and pagination
   */
  getAllMovements: async (params = {}) => {
    try {
      const response = await api.get('/inventory-movement-batches', { params })
      return response.data
    } catch (error) {
      console.error('Error fetching inventory movement batches:', error)
      throw error
    }
  },

  /**
   * Get inventory movement batch by ID
   * @param {string} movementId - Movement ID
   * @returns {Promise<Object>} Movement data with full details
   */
  getMovementById: async (movementId) => {
    try {
      const response = await api.get(`/inventory-movement-batches/${movementId}`)
      return response.data
    } catch (error) {
      console.error('Error fetching inventory movement batch:', error)
      throw error
    }
  },

  /**
   * Create new inventory movement batch
   * @param {Object} movementData - Movement data
   * @param {string} movementData.batchId - Batch ID (required)
   * @param {string} movementData.inventoryDetail - Detail inventory ID (required)
   * @param {string} movementData.movementType - Movement type (required: in/out/adjustment/transfer/audit)
   * @param {number} movementData.quantity - Quantity (required, cannot be 0)
   * @param {string} movementData.reason - Reason for movement (optional)
   * @param {Date} movementData.date - Movement date (optional, default now)
   * @param {string} movementData.performedBy - Employee ID (optional)
   * @param {string} movementData.purchaseOrderId - Purchase order ID (optional)
   * @param {string} movementData.notes - Notes (optional)
   * @returns {Promise<Object>} Created movement data
   * @note This will automatically update DetailInventory quantities
   */
  createMovement: async (movementData) => {
    try {
      const response = await api.post('/inventory-movement-batches', movementData)
      return response.data
    } catch (error) {
      console.error('Error creating inventory movement batch:', error)
      throw error
    }
  },

  /**
   * Update inventory movement batch
   * @param {string} movementId - Movement ID
   * @param {Object} movementData - Updated movement data
   * @param {string} movementData.reason - Reason (optional)
   * @param {string} movementData.notes - Notes (optional)
   * @param {Date} movementData.date - Movement date (optional)
   * @returns {Promise<Object>} Updated movement data
   * @note Only administrative fields can be updated (reason, notes, date)
   */
  updateMovement: async (movementId, movementData) => {
    try {
      const response = await api.put(`/inventory-movement-batches/${movementId}`, movementData)
      return response.data
    } catch (error) {
      console.error('Error updating inventory movement batch:', error)
      throw error
    }
  },

  /**
   * Delete inventory movement batch
   * @param {string} movementId - Movement ID
   * @returns {Promise<Object>} Success message
   * @note This will automatically reverse the inventory effect
   */
  deleteMovement: async (movementId) => {
    try {
      const response = await api.delete(`/inventory-movement-batches/${movementId}`)
      return response.data
    } catch (error) {
      console.error('Error deleting inventory movement batch:', error)
      throw error
    }
  },

  /**
   * Get movements by batch ID
   * @param {string} batchId - Batch ID
   * @param {Object} params - Additional query parameters (optional)
   * @returns {Promise<Object>} Movements for the batch
   */
  getMovementsByBatch: async (batchId, params = {}) => {
    try {
      const response = await api.get('/inventory-movement-batches', {
        params: { batchId, ...params }
      })
      return response.data
    } catch (error) {
      console.error('Error fetching movements by batch:', error)
      throw error
    }
  },

  /**
   * Get movements by product ID
   * @param {string} productId - Product ID
   * @param {Object} params - Additional query parameters (optional)
   * @returns {Promise<Object>} Movements for the product
   */
  getMovementsByProduct: async (productId, params = {}) => {
    try {
      const response = await api.get('/inventory-movement-batches', {
        params: { productId, ...params }
      })
      return response.data
    } catch (error) {
      console.error('Error fetching movements by product:', error)
      throw error
    }
  },

  /**
   * Get movements by movement type
   * @param {string} movementType - Movement type (in/out/adjustment/transfer/audit)
   * @param {Object} params - Additional query parameters (optional)
   * @returns {Promise<Object>} Movements of the specified type
   */
  getMovementsByType: async (movementType, params = {}) => {
    try {
      const response = await api.get('/inventory-movement-batches', {
        params: { movementType, ...params }
      })
      return response.data
    } catch (error) {
      console.error('Error fetching movements by type:', error)
      throw error
    }
  },

  /**
   * Get movements by date range
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {Object} params - Additional query parameters (optional)
   * @returns {Promise<Object>} Movements within the date range
   */
  getMovementsByDateRange: async (startDate, endDate, params = {}) => {
    try {
      const response = await api.get('/inventory-movement-batches', {
        params: { startDate, endDate, ...params }
      })
      return response.data
    } catch (error) {
      console.error('Error fetching movements by date range:', error)
      throw error
    }
  },

  /**
   * Get movements performed by employee
   * @param {string} employeeId - Employee ID
   * @param {Object} params - Additional query parameters (optional)
   * @returns {Promise<Object>} Movements performed by the employee
   */
  getMovementsByEmployee: async (employeeId, params = {}) => {
    try {
      const response = await api.get('/inventory-movement-batches', {
        params: { performedBy: employeeId, ...params }
      })
      return response.data
    } catch (error) {
      console.error('Error fetching movements by employee:', error)
      throw error
    }
  },

  /**
   * Get movements by purchase order
   * @param {string} purchaseOrderId - Purchase order ID
   * @param {Object} params - Additional query parameters (optional)
   * @returns {Promise<Object>} Movements linked to the purchase order
   */
  getMovementsByPurchaseOrder: async (purchaseOrderId, params = {}) => {
    try {
      const response = await api.get('/inventory-movement-batches', {
        params: { purchaseOrderId, ...params }
      })
      return response.data
    } catch (error) {
      console.error('Error fetching movements by purchase order:', error)
      throw error
    }
  },

  /**
   * Search movements
   * @param {string} searchTerm - Search term (movement number, batch code, or reason)
   * @param {number} limit - Maximum results (optional, default 20)
   * @returns {Promise<Object>} Matching movements
   */
  searchMovements: async (searchTerm, limit = 20) => {
    try {
      const response = await api.get('/inventory-movement-batches', {
        params: { search: searchTerm, limit }
      })
      return response.data
    } catch (error) {
      console.error('Error searching movements:', error)
      throw error
    }
  },

  /**
   * Get inbound movements (type: in)
   * @param {Object} params - Additional query parameters (optional)
   * @returns {Promise<Object>} Inbound movements
   */
  getInboundMovements: async (params = {}) => {
    try {
      const response = await api.get('/inventory-movement-batches', {
        params: { movementType: 'in', ...params }
      })
      return response.data
    } catch (error) {
      console.error('Error fetching inbound movements:', error)
      throw error
    }
  },

  /**
   * Get outbound movements (type: out)
   * @param {Object} params - Additional query parameters (optional)
   * @returns {Promise<Object>} Outbound movements
   */
  getOutboundMovements: async (params = {}) => {
    try {
      const response = await api.get('/inventory-movement-batches', {
        params: { movementType: 'out', ...params }
      })
      return response.data
    } catch (error) {
      console.error('Error fetching outbound movements:', error)
      throw error
    }
  },

  /**
   * Get adjustment movements (type: adjustment)
   * @param {Object} params - Additional query parameters (optional)
   * @returns {Promise<Object>} Adjustment movements
   */
  getAdjustmentMovements: async (params = {}) => {
    try {
      const response = await api.get('/inventory-movement-batches', {
        params: { movementType: 'adjustment', ...params }
      })
      return response.data
    } catch (error) {
      console.error('Error fetching adjustment movements:', error)
      throw error
    }
  },

  /**
   * Get transfer movements (type: transfer)
   * @param {Object} params - Additional query parameters (optional)
   * @returns {Promise<Object>} Transfer movements
   */
  getTransferMovements: async (params = {}) => {
    try {
      const response = await api.get('/inventory-movement-batches', {
        params: { movementType: 'transfer', ...params }
      })
      return response.data
    } catch (error) {
      console.error('Error fetching transfer movements:', error)
      throw error
    }
  },

  /**
   * Get audit movements (type: audit)
   * @param {Object} params - Additional query parameters (optional)
   * @returns {Promise<Object>} Audit movements
   */
  getAuditMovements: async (params = {}) => {
    try {
      const response = await api.get('/inventory-movement-batches', {
        params: { movementType: 'audit', ...params }
      })
      return response.data
    } catch (error) {
      console.error('Error fetching audit movements:', error)
      throw error
    }
  },

  /**
   * Record stock receipt (inbound movement)
   * @param {string} batchId - Batch ID
   * @param {string} inventoryDetailId - Detail inventory ID
   * @param {number} quantity - Quantity received
   * @param {Object} additionalData - Additional movement data (optional)
   * @returns {Promise<Object>} Created movement
   */
  recordStockReceipt: async (batchId, inventoryDetailId, quantity, additionalData = {}) => {
    try {
      const movementData = {
        batchId,
        inventoryDetail: inventoryDetailId,
        movementType: 'in',
        quantity: Math.abs(quantity),
        ...additionalData
      }
      const response = await api.post('/inventory-movement-batches', movementData)
      return response.data
    } catch (error) {
      console.error('Error recording stock receipt:', error)
      throw error
    }
  },

  /**
   * Record stock shipment (outbound movement)
   * @param {string} batchId - Batch ID
   * @param {string} inventoryDetailId - Detail inventory ID
   * @param {number} quantity - Quantity shipped
   * @param {Object} additionalData - Additional movement data (optional)
   * @returns {Promise<Object>} Created movement
   */
  recordStockShipment: async (batchId, inventoryDetailId, quantity, additionalData = {}) => {
    try {
      const movementData = {
        batchId,
        inventoryDetail: inventoryDetailId,
        movementType: 'out',
        quantity: Math.abs(quantity),
        ...additionalData
      }
      const response = await api.post('/inventory-movement-batches', movementData)
      return response.data
    } catch (error) {
      console.error('Error recording stock shipment:', error)
      throw error
    }
  },

  /**
   * Record stock adjustment
   * @param {string} batchId - Batch ID
   * @param {string} inventoryDetailId - Detail inventory ID
   * @param {number} quantity - Adjustment quantity (positive to add, negative to reduce)
   * @param {string} reason - Reason for adjustment
   * @param {Object} additionalData - Additional movement data (optional)
   * @returns {Promise<Object>} Created movement
   */
  recordStockAdjustment: async (batchId, inventoryDetailId, quantity, reason, additionalData = {}) => {
    try {
      const movementData = {
        batchId,
        inventoryDetail: inventoryDetailId,
        movementType: 'adjustment',
        quantity,
        reason,
        ...additionalData
      }
      const response = await api.post('/inventory-movement-batches', movementData)
      return response.data
    } catch (error) {
      console.error('Error recording stock adjustment:', error)
      throw error
    }
  },

  /**
   * Record stock transfer (warehouse to shelf or vice versa)
   * @param {string} batchId - Batch ID
   * @param {string} inventoryDetailId - Detail inventory ID
   * @param {number} quantity - Transfer quantity (positive for warehouse→shelf, negative for shelf→warehouse)
   * @param {Object} additionalData - Additional movement data (optional)
   * @returns {Promise<Object>} Created movement
   */
  recordStockTransfer: async (batchId, inventoryDetailId, quantity, additionalData = {}) => {
    try {
      const movementData = {
        batchId,
        inventoryDetail: inventoryDetailId,
        movementType: 'transfer',
        quantity,
        ...additionalData
      }
      const response = await api.post('/inventory-movement-batches', movementData)
      return response.data
    } catch (error) {
      console.error('Error recording stock transfer:', error)
      throw error
    }
  },

  /**
   * Record stock audit
   * @param {string} batchId - Batch ID
   * @param {string} inventoryDetailId - Detail inventory ID
   * @param {number} discrepancy - Discrepancy quantity (positive if found more, negative if found less)
   * @param {string} reason - Audit reason/notes
   * @param {Object} additionalData - Additional movement data (optional)
   * @returns {Promise<Object>} Created movement
   */
  recordStockAudit: async (batchId, inventoryDetailId, discrepancy, reason, additionalData = {}) => {
    try {
      const movementData = {
        batchId,
        inventoryDetail: inventoryDetailId,
        movementType: 'audit',
        quantity: discrepancy,
        reason,
        ...additionalData
      }
      const response = await api.post('/inventory-movement-batches', movementData)
      return response.data
    } catch (error) {
      console.error('Error recording stock audit:', error)
      throw error
    }
  },

  /**
   * Get recent movements
   * @param {number} limit - Number of recent movements (default 20)
   * @returns {Promise<Object>} Recent movements
   */
  getRecentMovements: async (limit = 20) => {
    try {
      const response = await api.get('/inventory-movement-batches', {
        params: { limit, page: 1 }
      })
      return response.data
    } catch (error) {
      console.error('Error fetching recent movements:', error)
      throw error
    }
  },

  /**
   * Get movements with pagination
   * @param {number} page - Page number
   * @param {number} limit - Items per page
   * @returns {Promise<Object>} Paginated movements
   */
  getMovementsPaginated: async (page = 1, limit = 20) => {
    try {
      const response = await api.get('/inventory-movement-batches', {
        params: { page, limit }
      })
      return response.data
    } catch (error) {
      console.error('Error fetching paginated movements:', error)
      throw error
    }
  },

  /**
   * Get today's movements
   * @param {Object} params - Additional query parameters (optional)
   * @returns {Promise<Object>} Today's movements
   */
  getTodaysMovements: async (params = {}) => {
    try {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)

      const response = await api.get('/inventory-movement-batches', {
        params: {
          startDate: today.toISOString(),
          endDate: tomorrow.toISOString(),
          ...params
        }
      })
      return response.data
    } catch (error) {
      console.error('Error fetching today\'s movements:', error)
      throw error
    }
  },

  /**
   * Get movement history for a batch
   * @param {string} batchId - Batch ID
   * @param {Object} params - Additional query parameters (optional)
   * @returns {Promise<Object>} Complete movement history for the batch
   */
  getBatchMovementHistory: async (batchId, params = {}) => {
    try {
      const response = await api.get('/inventory-movement-batches', {
        params: { batchId, limit: 1000, ...params }
      })
      return response.data
    } catch (error) {
      console.error('Error fetching batch movement history:', error)
      throw error
    }
  },

  /**
   * Update movement notes
   * @param {string} movementId - Movement ID
   * @param {string} notes - New notes
   * @returns {Promise<Object>} Updated movement
   */
  updateMovementNotes: async (movementId, notes) => {
    try {
      const response = await api.put(`/inventory-movement-batches/${movementId}`, { notes })
      return response.data
    } catch (error) {
      console.error('Error updating movement notes:', error)
      throw error
    }
  },

  /**
   * Update movement reason
   * @param {string} movementId - Movement ID
   * @param {string} reason - New reason
   * @returns {Promise<Object>} Updated movement
   */
  updateMovementReason: async (movementId, reason) => {
    try {
      const response = await api.put(`/inventory-movement-batches/${movementId}`, { reason })
      return response.data
    } catch (error) {
      console.error('Error updating movement reason:', error)
      throw error
    }
  },

  /**
   * Update movement date
   * @param {string} movementId - Movement ID
   * @param {Date} date - New date
   * @returns {Promise<Object>} Updated movement
   */
  updateMovementDate: async (movementId, date) => {
    try {
      const response = await api.put(`/inventory-movement-batches/${movementId}`, { date })
      return response.data
    } catch (error) {
      console.error('Error updating movement date:', error)
      throw error
    }
  }
}

export default inventoryMovementBatchService