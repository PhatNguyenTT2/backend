import api from './api'

/**
 * Inventory Service
 * Handles all API calls related to product-level inventories
 */
const inventoryService = {
  /**
   * Get all inventories with optional filters
   * @param {Object} params - Query parameters
   * @param {string} params.productId - Filter by product ID
   * @param {boolean} params.lowStock - Filter low stock items
   * @param {boolean} params.outOfStock - Filter out of stock items
   * @param {boolean} params.needsReorder - Filter items that need reordering
   * @param {string} params.search - Search by product name or warehouse location
   * @param {number} params.page - Page number for pagination
   * @param {number} params.limit - Items per page
   * @returns {Promise<Object>} Response with inventories array and pagination
   */
  getAllInventories: async (params = {}) => {
    try {
      const response = await api.get('/inventories', { params })
      return response.data
    } catch (error) {
      console.error('Error fetching inventories:', error)
      throw error
    }
  },

  /**
   * Get inventory by ID
   * @param {string} inventoryId - Inventory ID
   * @returns {Promise<Object>} Inventory data with product details
   */
  getInventoryById: async (inventoryId) => {
    try {
      const response = await api.get(`/inventories/${inventoryId}`)
      return response.data
    } catch (error) {
      console.error('Error fetching inventory:', error)
      throw error
    }
  },

  /**
   * Create new inventory
   * @param {Object} inventoryData - Inventory data
   * @param {string} inventoryData.product - Product ID (required)
   * @param {number} inventoryData.quantityOnHand - Quantity in warehouse (optional, default 0)
   * @param {number} inventoryData.quantityReserved - Reserved quantity (optional, default 0)
   * @param {number} inventoryData.quantityOnShelf - Quantity on shelf (optional, default 0)
   * @param {number} inventoryData.reorderPoint - Reorder point (optional, default 10)
   * @param {string} inventoryData.warehouseLocation - Warehouse location (optional)
   * @returns {Promise<Object>} Created inventory data
   */
  createInventory: async (inventoryData) => {
    try {
      const response = await api.post('/inventories', inventoryData)
      return response.data
    } catch (error) {
      console.error('Error creating inventory:', error)
      throw error
    }
  },

  /**
   * Update inventory
   * @param {string} inventoryId - Inventory ID
   * @param {Object} inventoryData - Updated inventory data
   * @param {number} inventoryData.quantityOnHand - Quantity in warehouse (optional)
   * @param {number} inventoryData.quantityReserved - Reserved quantity (optional)
   * @param {number} inventoryData.quantityOnShelf - Quantity on shelf (optional)
   * @param {number} inventoryData.reorderPoint - Reorder point (optional)
   * @param {string} inventoryData.warehouseLocation - Warehouse location (optional)
   * @returns {Promise<Object>} Updated inventory data
   */
  updateInventory: async (inventoryId, inventoryData) => {
    try {
      const response = await api.put(`/inventories/${inventoryId}`, inventoryData)
      return response.data
    } catch (error) {
      console.error('Error updating inventory:', error)
      throw error
    }
  },

  /**
   * Delete inventory
   * @param {string} inventoryId - Inventory ID
   * @returns {Promise<Object>} Success message
   * @note Cannot delete if product is active or has stock
   */
  deleteInventory: async (inventoryId) => {
    try {
      const response = await api.delete(`/inventories/${inventoryId}`)
      return response.data
    } catch (error) {
      console.error('Error deleting inventory:', error)
      throw error
    }
  },

  /**
   * Get inventory by product ID
   * @param {string} productId - Product ID
   * @returns {Promise<Object>} Inventory data for the product
   */
  getInventoryByProduct: async (productId) => {
    try {
      const response = await api.get('/inventories', {
        params: { productId }
      })
      return response.data
    } catch (error) {
      console.error('Error fetching inventory by product:', error)
      throw error
    }
  },

  /**
   * Get low stock items
   * @param {Object} params - Additional query parameters (optional)
   * @returns {Promise<Object>} Low stock inventories
   */
  getLowStockItems: async (params = {}) => {
    try {
      const response = await api.get('/inventories', {
        params: { lowStock: true, ...params }
      })
      return response.data
    } catch (error) {
      console.error('Error fetching low stock items:', error)
      throw error
    }
  },

  /**
   * Get out of stock items
   * @param {Object} params - Additional query parameters (optional)
   * @returns {Promise<Object>} Out of stock inventories
   */
  getOutOfStockItems: async (params = {}) => {
    try {
      const response = await api.get('/inventories', {
        params: { outOfStock: true, ...params }
      })
      return response.data
    } catch (error) {
      console.error('Error fetching out of stock items:', error)
      throw error
    }
  },

  /**
   * Get items that need reordering
   * @param {Object} params - Additional query parameters (optional)
   * @returns {Promise<Object>} Inventories that need reordering
   */
  getNeedsReorderItems: async (params = {}) => {
    try {
      const response = await api.get('/inventories', {
        params: { needsReorder: true, ...params }
      })
      return response.data
    } catch (error) {
      console.error('Error fetching items that need reorder:', error)
      throw error
    }
  },

  /**
   * Search inventories
   * @param {string} searchTerm - Search term (product name, code, or location)
   * @param {number} limit - Maximum results (optional, default 20)
   * @returns {Promise<Object>} Matching inventories
   */
  searchInventories: async (searchTerm, limit = 20) => {
    try {
      const response = await api.get('/inventories', {
        params: { search: searchTerm, limit }
      })
      return response.data
    } catch (error) {
      console.error('Error searching inventories:', error)
      throw error
    }
  },

  /**
   * Adjust stock quantities
   * @param {string} inventoryId - Inventory ID
   * @param {Object} adjustments - Stock adjustments
   * @param {number} adjustments.quantityOnHand - New warehouse quantity (optional)
   * @param {number} adjustments.quantityOnShelf - New shelf quantity (optional)
   * @param {number} adjustments.quantityReserved - New reserved quantity (optional)
   * @returns {Promise<Object>} Updated inventory data
   */
  adjustStock: async (inventoryId, adjustments) => {
    try {
      const response = await api.put(`/inventories/${inventoryId}`, adjustments)
      return response.data
    } catch (error) {
      console.error('Error adjusting stock:', error)
      throw error
    }
  },

  /**
   * Transfer stock to shelf
   * @param {string} inventoryId - Inventory ID
   * @param {number} quantity - Quantity to transfer from warehouse to shelf
   * @returns {Promise<Object>} Updated inventory data
   */
  transferToShelf: async (inventoryId, quantity) => {
    try {
      // Get current inventory first
      const currentInventory = await inventoryService.getInventoryById(inventoryId)
      const current = currentInventory.data

      // Calculate new quantities
      const newQuantityOnHand = current.quantityOnHand - quantity
      const newQuantityOnShelf = current.quantityOnShelf + quantity

      if (newQuantityOnHand < 0) {
        throw new Error('Insufficient warehouse stock for transfer')
      }

      const response = await api.put(`/inventories/${inventoryId}`, {
        quantityOnHand: newQuantityOnHand,
        quantityOnShelf: newQuantityOnShelf
      })
      return response.data
    } catch (error) {
      console.error('Error transferring to shelf:', error)
      throw error
    }
  },

  /**
   * Transfer stock to warehouse
   * @param {string} inventoryId - Inventory ID
   * @param {number} quantity - Quantity to transfer from shelf to warehouse
   * @returns {Promise<Object>} Updated inventory data
   */
  transferToWarehouse: async (inventoryId, quantity) => {
    try {
      // Get current inventory first
      const currentInventory = await inventoryService.getInventoryById(inventoryId)
      const current = currentInventory.data

      // Calculate new quantities
      const newQuantityOnShelf = current.quantityOnShelf - quantity
      const newQuantityOnHand = current.quantityOnHand + quantity

      if (newQuantityOnShelf < 0) {
        throw new Error('Insufficient shelf stock for transfer')
      }

      const response = await api.put(`/inventories/${inventoryId}`, {
        quantityOnHand: newQuantityOnHand,
        quantityOnShelf: newQuantityOnShelf
      })
      return response.data
    } catch (error) {
      console.error('Error transferring to warehouse:', error)
      throw error
    }
  },

  /**
   * Reserve stock
   * @param {string} inventoryId - Inventory ID
   * @param {number} quantity - Quantity to reserve
   * @returns {Promise<Object>} Updated inventory data
   */
  reserveStock: async (inventoryId, quantity) => {
    try {
      // Get current inventory first
      const currentInventory = await inventoryService.getInventoryById(inventoryId)
      const current = currentInventory.data

      const newQuantityReserved = current.quantityReserved + quantity
      const availableStock = current.quantityOnHand + current.quantityOnShelf - current.quantityReserved

      if (quantity > availableStock) {
        throw new Error('Insufficient available stock for reservation')
      }

      const response = await api.put(`/inventories/${inventoryId}`, {
        quantityReserved: newQuantityReserved
      })
      return response.data
    } catch (error) {
      console.error('Error reserving stock:', error)
      throw error
    }
  },

  /**
   * Release reserved stock
   * @param {string} inventoryId - Inventory ID
   * @param {number} quantity - Quantity to release from reservation
   * @returns {Promise<Object>} Updated inventory data
   */
  releaseReservedStock: async (inventoryId, quantity) => {
    try {
      // Get current inventory first
      const currentInventory = await inventoryService.getInventoryById(inventoryId)
      const current = currentInventory.data

      const newQuantityReserved = Math.max(0, current.quantityReserved - quantity)

      const response = await api.put(`/inventories/${inventoryId}`, {
        quantityReserved: newQuantityReserved
      })
      return response.data
    } catch (error) {
      console.error('Error releasing reserved stock:', error)
      throw error
    }
  },

  /**
   * Update reorder point
   * @param {string} inventoryId - Inventory ID
   * @param {number} reorderPoint - New reorder point
   * @returns {Promise<Object>} Updated inventory data
   */
  updateReorderPoint: async (inventoryId, reorderPoint) => {
    try {
      const response = await api.put(`/inventories/${inventoryId}`, { reorderPoint })
      return response.data
    } catch (error) {
      console.error('Error updating reorder point:', error)
      throw error
    }
  },

  /**
   * Update warehouse location
   * @param {string} inventoryId - Inventory ID
   * @param {string} warehouseLocation - New warehouse location
   * @returns {Promise<Object>} Updated inventory data
   */
  updateWarehouseLocation: async (inventoryId, warehouseLocation) => {
    try {
      const response = await api.put(`/inventories/${inventoryId}`, { warehouseLocation })
      return response.data
    } catch (error) {
      console.error('Error updating warehouse location:', error)
      throw error
    }
  },

  /**
   * Get inventories with pagination
   * @param {number} page - Page number
   * @param {number} limit - Items per page
   * @returns {Promise<Object>} Paginated inventories
   */
  getInventoriesPaginated: async (page = 1, limit = 20) => {
    try {
      const response = await api.get('/inventories', {
        params: { page, limit }
      })
      return response.data
    } catch (error) {
      console.error('Error fetching paginated inventories:', error)
      throw error
    }
  },

  /**
   * Receive stock (increase warehouse quantity)
   * @param {string} inventoryId - Inventory ID
   * @param {number} quantity - Quantity received
   * @returns {Promise<Object>} Updated inventory data
   */
  receiveStock: async (inventoryId, quantity) => {
    try {
      // Get current inventory first
      const currentInventory = await inventoryService.getInventoryById(inventoryId)
      const current = currentInventory.data

      const response = await api.put(`/inventories/${inventoryId}`, {
        quantityOnHand: current.quantityOnHand + quantity
      })
      return response.data
    } catch (error) {
      console.error('Error receiving stock:', error)
      throw error
    }
  },

  /**
   * Ship stock (decrease shelf quantity)
   * @param {string} inventoryId - Inventory ID
   * @param {number} quantity - Quantity shipped
   * @returns {Promise<Object>} Updated inventory data
   */
  shipStock: async (inventoryId, quantity) => {
    try {
      // Get current inventory first
      const currentInventory = await inventoryService.getInventoryById(inventoryId)
      const current = currentInventory.data

      const newQuantityOnShelf = current.quantityOnShelf - quantity

      if (newQuantityOnShelf < 0) {
        throw new Error('Insufficient shelf stock for shipment')
      }

      const response = await api.put(`/inventories/${inventoryId}`, {
        quantityOnShelf: newQuantityOnShelf
      })
      return response.data
    } catch (error) {
      console.error('Error shipping stock:', error)
      throw error
    }
  },

  /**
   * Check if inventory exists for product
   * @param {string} productId - Product ID
   * @returns {Promise<boolean>} True if inventory exists
   */
  checkInventoryExists: async (productId) => {
    try {
      const response = await api.get('/inventories', {
        params: { productId }
      })

      const inventories = response.data.data.inventories
      return inventories && inventories.length > 0
    } catch (error) {
      console.error('Error checking inventory existence:', error)
      throw error
    }
  }
}

export default inventoryService
