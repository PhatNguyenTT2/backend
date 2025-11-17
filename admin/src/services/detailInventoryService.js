import api from './api'

/**
 * Detail Inventory Service
 * Handles all API calls related to batch-level inventories
 */
const detailInventoryService = {
  /**
   * Get all detail inventories with optional filters
   * @param {Object} params - Query parameters
   * @param {string} params.batchId - Filter by batch ID
   * @param {string} params.productId - Filter by product ID (via batch)
   * @param {boolean} params.outOfStock - Filter out of stock batches
   * @param {boolean} params.hasWarehouseStock - Filter batches with warehouse stock
   * @param {boolean} params.hasShelfStock - Filter batches with shelf stock
   * @param {string} params.location - Filter by warehouse location
   * @param {boolean} params.expiringSoon - Filter batches expiring soon (within 30 days)
   * @param {string} params.search - Search by batch code, product name, or location
   * @param {number} params.page - Page number for pagination
   * @param {number} params.limit - Items per page
   * @returns {Promise<Object>} Response with detail inventories array and pagination
   */
  getAllDetailInventories: async (params = {}) => {
    try {
      const response = await api.get('/detail-inventories', { params })
      return response.data
    } catch (error) {
      console.error('Error fetching detail inventories:', error)
      throw error
    }
  },

  /**
   * Get detail inventory by ID
   * @param {string} detailInventoryId - Detail inventory ID
   * @returns {Promise<Object>} Detail inventory data with batch and product details
   */
  getDetailInventoryById: async (detailInventoryId) => {
    try {
      const response = await api.get(`/detail-inventories/${detailInventoryId}`)
      return response.data
    } catch (error) {
      console.error('Error fetching detail inventory:', error)
      throw error
    }
  },

  /**
   * Create new detail inventory
   * @param {Object} detailInventoryData - Detail inventory data
   * @param {string} detailInventoryData.batchId - Batch ID (required)
   * @param {number} detailInventoryData.quantityOnHand - Quantity in warehouse (optional, default 0)
   * @param {number} detailInventoryData.quantityOnShelf - Quantity on shelf (optional, default 0)
   * @param {number} detailInventoryData.quantityReserved - Reserved quantity (optional, default 0)
   * @param {string} detailInventoryData.location - Warehouse location (optional)
   * @returns {Promise<Object>} Created detail inventory data
   */
  createDetailInventory: async (detailInventoryData) => {
    try {
      const response = await api.post('/detail-inventories', detailInventoryData)
      return response.data
    } catch (error) {
      console.error('Error creating detail inventory:', error)
      throw error
    }
  },

  /**
   * Update detail inventory
   * @param {string} detailInventoryId - Detail inventory ID
   * @param {Object} detailInventoryData - Updated detail inventory data
   * @param {number} detailInventoryData.quantityOnHand - Quantity in warehouse (optional)
   * @param {number} detailInventoryData.quantityOnShelf - Quantity on shelf (optional)
   * @param {number} detailInventoryData.quantityReserved - Reserved quantity (optional)
   * @param {string} detailInventoryData.location - Warehouse location (optional)
   * @returns {Promise<Object>} Updated detail inventory data
   */
  updateDetailInventory: async (detailInventoryId, detailInventoryData) => {
    try {
      const response = await api.put(`/detail-inventories/${detailInventoryId}`, detailInventoryData)
      return response.data
    } catch (error) {
      console.error('Error updating detail inventory:', error)
      throw error
    }
  },

  /**
   * Delete detail inventory
   * @param {string} detailInventoryId - Detail inventory ID
   * @returns {Promise<Object>} Success message
   * @note Cannot delete if batch is active or has stock/reservations
   */
  deleteDetailInventory: async (detailInventoryId) => {
    try {
      const response = await api.delete(`/detail-inventories/${detailInventoryId}`)
      return response.data
    } catch (error) {
      console.error('Error deleting detail inventory:', error)
      throw error
    }
  },

  /**
   * Get detail inventory by batch ID
   * @param {string} batchId - Batch ID
   * @returns {Promise<Object>} Detail inventory data for the batch
   */
  getDetailInventoryByBatch: async (batchId) => {
    try {
      const response = await api.get('/detail-inventories', {
        params: { batchId }
      })
      return response.data
    } catch (error) {
      console.error('Error fetching detail inventory by batch:', error)
      throw error
    }
  },

  /**
   * Get detail inventories by product ID
   * @param {string} productId - Product ID
   * @param {Object} params - Additional query parameters (optional)
   * @returns {Promise<Object>} Detail inventories for the product
   */
  getDetailInventoriesByProduct: async (productId, params = {}) => {
    try {
      const response = await api.get('/detail-inventories', {
        params: { productId, ...params }
      })
      return response.data
    } catch (error) {
      console.error('Error fetching detail inventories by product:', error)
      throw error
    }
  },

  /**
   * Get out of stock batches
   * @param {Object} params - Additional query parameters (optional)
   * @returns {Promise<Object>} Out of stock detail inventories
   */
  getOutOfStockBatches: async (params = {}) => {
    try {
      const response = await api.get('/detail-inventories', {
        params: { outOfStock: true, ...params }
      })
      return response.data
    } catch (error) {
      console.error('Error fetching out of stock batches:', error)
      throw error
    }
  },

  /**
   * Get batches with warehouse stock
   * @param {Object} params - Additional query parameters (optional)
   * @returns {Promise<Object>} Detail inventories with warehouse stock
   */
  getBatchesWithWarehouseStock: async (params = {}) => {
    try {
      const response = await api.get('/detail-inventories', {
        params: { hasWarehouseStock: true, ...params }
      })
      return response.data
    } catch (error) {
      console.error('Error fetching batches with warehouse stock:', error)
      throw error
    }
  },

  /**
   * Get batches with shelf stock
   * @param {Object} params - Additional query parameters (optional)
   * @returns {Promise<Object>} Detail inventories with shelf stock
   */
  getBatchesWithShelfStock: async (params = {}) => {
    try {
      const response = await api.get('/detail-inventories', {
        params: { hasShelfStock: true, ...params }
      })
      return response.data
    } catch (error) {
      console.error('Error fetching batches with shelf stock:', error)
      throw error
    }
  },

  /**
   * Get batches expiring soon (within 30 days)
   * @param {Object} params - Additional query parameters (optional)
   * @returns {Promise<Object>} Detail inventories for batches expiring soon
   */
  getExpiringSoonBatches: async (params = {}) => {
    try {
      const response = await api.get('/detail-inventories', {
        params: { expiringSoon: true, ...params }
      })
      return response.data
    } catch (error) {
      console.error('Error fetching expiring soon batches:', error)
      throw error
    }
  },

  /**
   * Get detail inventories by location
   * @param {string} location - Warehouse location
   * @param {Object} params - Additional query parameters (optional)
   * @returns {Promise<Object>} Detail inventories at the location
   */
  getDetailInventoriesByLocation: async (location, params = {}) => {
    try {
      const response = await api.get('/detail-inventories', {
        params: { location, ...params }
      })
      return response.data
    } catch (error) {
      console.error('Error fetching detail inventories by location:', error)
      throw error
    }
  },

  /**
   * Search detail inventories
   * @param {string} searchTerm - Search term (batch code, product name, or location)
   * @param {number} limit - Maximum results (optional, default 20)
   * @returns {Promise<Object>} Matching detail inventories
   */
  searchDetailInventories: async (searchTerm, limit = 20) => {
    try {
      const response = await api.get('/detail-inventories', {
        params: { search: searchTerm, limit }
      })
      return response.data
    } catch (error) {
      console.error('Error searching detail inventories:', error)
      throw error
    }
  },

  /**
   * Adjust batch stock quantities
   * @param {string} detailInventoryId - Detail inventory ID
   * @param {Object} adjustments - Stock adjustments
   * @param {number} adjustments.quantityOnHand - New warehouse quantity (optional)
   * @param {number} adjustments.quantityOnShelf - New shelf quantity (optional)
   * @param {number} adjustments.quantityReserved - New reserved quantity (optional)
   * @returns {Promise<Object>} Updated detail inventory data
   */
  adjustBatchStock: async (detailInventoryId, adjustments) => {
    try {
      const response = await api.put(`/detail-inventories/${detailInventoryId}`, adjustments)
      return response.data
    } catch (error) {
      console.error('Error adjusting batch stock:', error)
      throw error
    }
  },

  /**
   * Transfer batch stock to shelf
   * @param {string} detailInventoryId - Detail inventory ID
   * @param {number} quantity - Quantity to transfer from warehouse to shelf
   * @returns {Promise<Object>} Updated detail inventory data
   */
  transferBatchToShelf: async (detailInventoryId, quantity) => {
    try {
      // Get current detail inventory first
      const currentInventory = await detailInventoryService.getDetailInventoryById(detailInventoryId)
      const current = currentInventory.data

      // Calculate new quantities
      const newQuantityOnHand = current.quantityOnHand - quantity
      const newQuantityOnShelf = current.quantityOnShelf + quantity

      if (newQuantityOnHand < 0) {
        throw new Error('Insufficient warehouse stock for transfer')
      }

      const response = await api.put(`/detail-inventories/${detailInventoryId}`, {
        quantityOnHand: newQuantityOnHand,
        quantityOnShelf: newQuantityOnShelf
      })
      return response.data
    } catch (error) {
      console.error('Error transferring batch to shelf:', error)
      throw error
    }
  },

  /**
   * Transfer batch stock to warehouse
   * @param {string} detailInventoryId - Detail inventory ID
   * @param {number} quantity - Quantity to transfer from shelf to warehouse
   * @returns {Promise<Object>} Updated detail inventory data
   */
  transferBatchToWarehouse: async (detailInventoryId, quantity) => {
    try {
      // Get current detail inventory first
      const currentInventory = await detailInventoryService.getDetailInventoryById(detailInventoryId)
      const current = currentInventory.data

      // Calculate new quantities
      const newQuantityOnShelf = current.quantityOnShelf - quantity
      const newQuantityOnHand = current.quantityOnHand + quantity

      if (newQuantityOnShelf < 0) {
        throw new Error('Insufficient shelf stock for transfer')
      }

      const response = await api.put(`/detail-inventories/${detailInventoryId}`, {
        quantityOnHand: newQuantityOnHand,
        quantityOnShelf: newQuantityOnShelf
      })
      return response.data
    } catch (error) {
      console.error('Error transferring batch to warehouse:', error)
      throw error
    }
  },

  /**
   * Reserve batch stock
   * @param {string} detailInventoryId - Detail inventory ID
   * @param {number} quantity - Quantity to reserve
   * @returns {Promise<Object>} Updated detail inventory data
   */
  reserveBatchStock: async (detailInventoryId, quantity) => {
    try {
      // Get current detail inventory first
      const currentInventory = await detailInventoryService.getDetailInventoryById(detailInventoryId)
      const current = currentInventory.data

      const newQuantityReserved = current.quantityReserved + quantity
      const availableStock = current.quantityOnHand + current.quantityOnShelf - current.quantityReserved

      if (quantity > availableStock) {
        throw new Error('Insufficient available stock for reservation')
      }

      const response = await api.put(`/detail-inventories/${detailInventoryId}`, {
        quantityReserved: newQuantityReserved
      })
      return response.data
    } catch (error) {
      console.error('Error reserving batch stock:', error)
      throw error
    }
  },

  /**
   * Release reserved batch stock
   * @param {string} detailInventoryId - Detail inventory ID
   * @param {number} quantity - Quantity to release from reservation
   * @returns {Promise<Object>} Updated detail inventory data
   */
  releaseReservedBatchStock: async (detailInventoryId, quantity) => {
    try {
      // Get current detail inventory first
      const currentInventory = await detailInventoryService.getDetailInventoryById(detailInventoryId)
      const current = currentInventory.data

      const newQuantityReserved = Math.max(0, current.quantityReserved - quantity)

      const response = await api.put(`/detail-inventories/${detailInventoryId}`, {
        quantityReserved: newQuantityReserved
      })
      return response.data
    } catch (error) {
      console.error('Error releasing reserved batch stock:', error)
      throw error
    }
  },

  /**
   * Update batch location
   * @param {string} detailInventoryId - Detail inventory ID
   * @param {string} location - New warehouse location
   * @returns {Promise<Object>} Updated detail inventory data
   */
  updateBatchLocation: async (detailInventoryId, location) => {
    try {
      const response = await api.put(`/detail-inventories/${detailInventoryId}`, { location })
      return response.data
    } catch (error) {
      console.error('Error updating batch location:', error)
      throw error
    }
  },

  /**
   * Get detail inventories with pagination
   * @param {number} page - Page number
   * @param {number} limit - Items per page
   * @returns {Promise<Object>} Paginated detail inventories
   */
  getDetailInventoriesPaginated: async (page = 1, limit = 20) => {
    try {
      const response = await api.get('/detail-inventories', {
        params: { page, limit }
      })
      return response.data
    } catch (error) {
      console.error('Error fetching paginated detail inventories:', error)
      throw error
    }
  },

  /**
   * Receive batch stock (increase warehouse quantity)
   * @param {string} detailInventoryId - Detail inventory ID
   * @param {number} quantity - Quantity received
   * @returns {Promise<Object>} Updated detail inventory data
   */
  receiveBatchStock: async (detailInventoryId, quantity) => {
    try {
      // Get current detail inventory first
      const currentInventory = await detailInventoryService.getDetailInventoryById(detailInventoryId)
      const current = currentInventory.data

      const response = await api.put(`/detail-inventories/${detailInventoryId}`, {
        quantityOnHand: current.quantityOnHand + quantity
      })
      return response.data
    } catch (error) {
      console.error('Error receiving batch stock:', error)
      throw error
    }
  },

  /**
   * Ship batch stock (decrease shelf quantity)
   * @param {string} detailInventoryId - Detail inventory ID
   * @param {number} quantity - Quantity shipped
   * @returns {Promise<Object>} Updated detail inventory data
   */
  shipBatchStock: async (detailInventoryId, quantity) => {
    try {
      // Get current detail inventory first
      const currentInventory = await detailInventoryService.getDetailInventoryById(detailInventoryId)
      const current = currentInventory.data

      const newQuantityOnShelf = current.quantityOnShelf - quantity

      if (newQuantityOnShelf < 0) {
        throw new Error('Insufficient shelf stock for shipment')
      }

      const response = await api.put(`/detail-inventories/${detailInventoryId}`, {
        quantityOnShelf: newQuantityOnShelf
      })
      return response.data
    } catch (error) {
      console.error('Error shipping batch stock:', error)
      throw error
    }
  },

  /**
   * Check if detail inventory exists for batch
   * @param {string} batchId - Batch ID
   * @returns {Promise<boolean>} True if detail inventory exists
   */
  checkDetailInventoryExists: async (batchId) => {
    try {
      const response = await api.get('/detail-inventories', {
        params: { batchId }
      })

      const detailInventories = response.data.data.detailInventories
      return detailInventories && detailInventories.length > 0
    } catch (error) {
      console.error('Error checking detail inventory existence:', error)
      throw error
    }
  },

  /**
   * Get total available quantity for product across all batches
   * @param {string} productId - Product ID
   * @returns {Promise<number>} Total available quantity
   */
  getTotalAvailableByProduct: async (productId) => {
    try {
      const response = await api.get('/detail-inventories', {
        params: { productId, limit: 1000 } // Get all batches for the product
      })

      const detailInventories = response.data.data.detailInventories

      // Calculate total available quantity
      const totalAvailable = detailInventories.reduce((sum, inv) => {
        const available = inv.quantityOnHand + inv.quantityOnShelf - inv.quantityReserved
        return sum + Math.max(0, available)
      }, 0)

      return totalAvailable
    } catch (error) {
      console.error('Error calculating total available quantity:', error)
      throw error
    }
  },

  /**
   * Get active batches with stock for a product
   * @param {string} productId - Product ID
   * @returns {Promise<Object>} Active batches with available stock
   */
  getActiveBatchesWithStock: async (productId) => {
    try {
      const response = await api.get('/detail-inventories', {
        params: { productId, hasShelfStock: true }
      })

      // Filter for active batches only (check batch status)
      const detailInventories = response.data.data.detailInventories.filter(
        inv => inv.batchId?.status === 'active'
      )

      return {
        ...response.data,
        data: {
          ...response.data.data,
          detailInventories
        }
      }
    } catch (error) {
      console.error('Error fetching active batches with stock:', error)
      throw error
    }
  },

  /**
   * Get batch stock summary
   * @param {string} batchId - Batch ID
   * @returns {Promise<Object>} Stock summary with quantities and status
   */
  getBatchStockSummary: async (batchId) => {
    try {
      const response = await api.get('/detail-inventories', {
        params: { batchId }
      })

      const detailInventory = response.data.data.detailInventories[0]

      if (!detailInventory) {
        return {
          exists: false,
          summary: null
        }
      }

      const available = detailInventory.quantityOnHand +
        detailInventory.quantityOnShelf -
        detailInventory.quantityReserved

      return {
        exists: true,
        summary: {
          quantityOnHand: detailInventory.quantityOnHand,
          quantityOnShelf: detailInventory.quantityOnShelf,
          quantityReserved: detailInventory.quantityReserved,
          totalQuantity: detailInventory.quantityOnHand + detailInventory.quantityOnShelf,
          quantityAvailable: Math.max(0, available),
          isOutOfStock: available <= 0,
          location: detailInventory.location
        }
      }
    } catch (error) {
      console.error('Error fetching batch stock summary:', error)
      throw error
    }
  }
}

export default detailInventoryService
