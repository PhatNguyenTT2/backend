import api from './api'

/**
 * Inventory Service
 * Handles all inventory-related API calls
 */
const inventoryService = {
  /**
   * Get all inventory items with pagination and filters
   * @param {Object} params - Query parameters (page, limit, lowStock, outOfStock)
   * @returns {Promise} Inventory list with pagination
   */
  getInventory: async (params = {}) => {
    try {
      const response = await api.get('/inventory', { params })
      return response.data
    } catch (error) {
      console.error('Error fetching inventory:', error)
      throw error.response?.data || error
    }
  },

  /**
   * Get inventory for a specific product
   * @param {string} productId - Product ID
   * @returns {Promise} Inventory for product
   */
  getInventoryByProduct: async (productId) => {
    try {
      const response = await api.get(`/inventory/product/${productId}`)
      return response.data
    } catch (error) {
      console.error('Error fetching inventory for product:', error)
      throw error.response?.data || error
    }
  },

  /**
   * Get inventory statistics
   * @returns {Promise} Inventory statistics
   */
  getStats: async () => {
    try {
      const response = await api.get('/inventory/stats/summary')
      return response.data
    } catch (error) {
      console.error('Error fetching inventory stats:', error)
      throw error.response?.data || error
    }
  },

  /**
   * Get inventory alerts
   * @param {string} type - Alert type filter (optional)
   * @returns {Promise} Inventory alerts
   */
  getAlerts: async (type = null) => {
    try {
      const params = type ? { type } : {}
      const response = await api.get('/inventory/alerts', { params })
      return response.data
    } catch (error) {
      console.error('Error fetching inventory alerts:', error)
      throw error.response?.data || error
    }
  },

  /**
   * Get low stock items
   * @param {number} threshold - Optional threshold
   * @returns {Promise} Low stock items
   */
  getLowStock: async (threshold = null) => {
    try {
      const params = threshold ? { threshold } : {}
      const response = await api.get('/inventory/low-stock', { params })
      return response.data
    } catch (error) {
      console.error('Error fetching low stock items:', error)
      throw error.response?.data || error
    }
  },

  /**
   * Get out of stock items
   * @returns {Promise} Out of stock items
   */
  getOutOfStock: async () => {
    try {
      const response = await api.get('/inventory/out-of-stock')
      return response.data
    } catch (error) {
      console.error('Error fetching out of stock items:', error)
      throw error.response?.data || error
    }
  },

  /**
   * Stock in (receive inventory)
   * @param {Object} data - Stock in data (product, quantity, etc.)
   * @returns {Promise} Updated inventory
   */
  stockIn: async (data) => {
    try {
      const response = await api.post('/inventory/stock-in', data)
      return response.data
    } catch (error) {
      console.error('Error in stock in:', error)
      throw error.response?.data || error
    }
  },

  /**
   * Stock out (ship inventory)
   * @param {Object} data - Stock out data (product, quantity, etc.)
   * @returns {Promise} Updated inventory
   */
  stockOut: async (data) => {
    try {
      const response = await api.post('/inventory/stock-out', data)
      return response.data
    } catch (error) {
      console.error('Error in stock out:', error)
      throw error.response?.data || error
    }
  },

  /**
   * Adjust stock manually
   * @param {string} productId - Product ID
   * @param {Object} data - Adjustment data (type, quantity, adjustmentType, referenceId, referenceType, notes)
   * @returns {Promise} Updated inventory
   */
  adjustStock: async (productId, data) => {
    try {
      console.log('[inventoryService] Adjusting stock for product:', productId);
      console.log('[inventoryService] Adjustment data:', data);
      const response = await api.post(`/inventory/${productId}/adjust`, data)
      console.log('[inventoryService] Adjustment response:', response.data);
      return response.data
    } catch (error) {
      console.error('[inventoryService] Error adjusting stock:', error)
      console.error('[inventoryService] Error response:', error.response?.data)
      throw error.response?.data || error
    }
  },

  /**
   * Reserve stock for order
   * @param {Object} data - Reserve data
   * @returns {Promise} Updated inventory
   */
  reserveStock: async (data) => {
    try {
      const response = await api.post('/inventory/reserve', data)
      return response.data
    } catch (error) {
      console.error('Error reserving stock:', error)
      throw error.response?.data || error
    }
  },

  /**
   * Release reserved stock
   * @param {Object} data - Release data
   * @returns {Promise} Updated inventory
   */
  releaseStock: async (data) => {
    try {
      const response = await api.post('/inventory/release', data)
      return response.data
    } catch (error) {
      console.error('Error releasing stock:', error)
      throw error.response?.data || error
    }
  },

  /**
   * Get movement history for a product
   * @param {string} productId - Product ID
   * @param {Object} params - Query parameters
   * @returns {Promise} Movement history
   */
  getMovements: async (productId, params = {}) => {
    try {
      const response = await api.get(`/inventory/${productId}/movements`, { params })
      return response.data
    } catch (error) {
      console.error('Error fetching movements:', error)
      throw error.response?.data || error
    }
  },

  /**
   * Update reorder settings
   * @param {string} productId - Product ID
   * @param {Object} data - Reorder settings
   * @returns {Promise} Updated inventory
   */
  updateReorderSettings: async (productId, data) => {
    try {
      const response = await api.put(`/inventory/${productId}/reorder-settings`, data)
      return response.data
    } catch (error) {
      console.error('Error updating reorder settings:', error)
      throw error.response?.data || error
    }
  },

  /**
   * Update warehouse location
   * @param {string} productId - Product ID
   * @param {string} warehouseLocation - New location
   * @returns {Promise} Updated inventory
   */
  updateLocation: async (productId, warehouseLocation) => {
    try {
      const response = await api.put(`/inventory/${productId}/location`, { warehouseLocation })
      return response.data
    } catch (error) {
      console.error('Error updating location:', error)
      throw error.response?.data || error
    }
  },

  /**
   * Format inventory data for display in the table
   * @param {Array} inventoryItems - Raw inventory from API
   * @returns {Array} Formatted inventory
   */
  formatInventoryForDisplay: (inventoryItems) => {
    // Handle null, undefined, or non-array input
    if (!inventoryItems || !Array.isArray(inventoryItems)) {
      console.warn('formatInventoryForDisplay received invalid input:', inventoryItems);
      return [];
    }

    return inventoryItems.map(item => {
      // Handle missing item
      if (!item) {
        console.warn('Found null/undefined item in inventory array');
        return null;
      }

      return {
        id: item.id || item._id,
        productId: item.product?.id || item.product?._id,
        sku: item.product?.sku || 'N/A',
        productName: item.product?.name || 'Unknown Product',
        quantityOnHand: item.quantityOnHand || 0,
        quantityReserved: item.quantityReserved || 0,
        quantityAvailable: item.quantityAvailable || 0,
        reorderPoint: item.reorderPoint || 0,
        reorderQuantity: item.reorderQuantity || 0,
        warehouseLocation: item.warehouseLocation || null,
        lastRestocked: item.lastRestocked || null,
        lastSold: item.lastSold || null,
        isLowStock: item.isLowStock || false,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt
      };
    }).filter(item => item !== null); // Remove any null items
  }
}

export default inventoryService

