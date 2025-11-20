import api from './api'

/**
 * OrderDetail Service
 * Handles all API calls related to order details
 */
const orderDetailService = {
  /**
   * Get all order details with optional filters
   * @param {Object} params - Query parameters
   * @param {string} params.order - Filter by order ID
   * @param {string} params.product - Filter by product ID
   * @param {string} params.batch - Filter by batch ID
   * @param {number} params.minQuantity - Filter by minimum quantity
   * @param {number} params.maxQuantity - Filter by maximum quantity
   * @param {number} params.minPrice - Filter by minimum unit price
   * @param {number} params.maxPrice - Filter by maximum unit price
   * @param {string} params.startDate - Filter by order date (from)
   * @param {string} params.endDate - Filter by order date (to)
   * @param {string} params.sortBy - Sort field (default: createdAt)
   * @param {string} params.sortOrder - Sort order (asc/desc, default: desc)
   * @param {number} params.page - Page number for pagination
   * @param {number} params.limit - Items per page
   * @returns {Promise<Object>} Response with order details array and pagination
   */
  getAllOrderDetails: async (params = {}) => {
    try {
      const response = await api.get('/order-details', { params })
      return response.data
    } catch (error) {
      console.error('Error fetching order details:', error)
      throw error
    }
  },

  /**
   * Get order detail by ID
   * @param {string} orderDetailId - Order detail ID
   * @returns {Promise<Object>} Order detail data with order, product, and batch
   */
  getOrderDetailById: async (orderDetailId) => {
    try {
      const response = await api.get(`/order-details/${orderDetailId}`)
      return response.data
    } catch (error) {
      console.error('Error fetching order detail:', error)
      throw error
    }
  },

  /**
   * Create new order detail
   * @param {Object} orderDetailData - Order detail data
   * @param {string} orderDetailData.order - Order ID (required)
   * @param {string} orderDetailData.product - Product ID (required)
   * @param {string} orderDetailData.batch - Batch ID (required)
   * @param {number} orderDetailData.quantity - Quantity (required)
   * @param {number} orderDetailData.unitPrice - Unit price (required)
   * @param {string} orderDetailData.notes - Notes (optional)
   * @returns {Promise<Object>} Created order detail data
   * @note Cannot add details to delivered or cancelled orders
   */
  createOrderDetail: async (orderDetailData) => {
    try {
      const response = await api.post('/order-details', orderDetailData)
      return response.data
    } catch (error) {
      console.error('Error creating order detail:', error)
      throw error
    }
  },

  /**
   * Update order detail
   * @param {string} orderDetailId - Order detail ID
   * @param {Object} orderDetailData - Updated order detail data
   * @param {number} orderDetailData.quantity - Quantity (optional)
   * @param {number} orderDetailData.unitPrice - Unit price (optional)
   * @param {string} orderDetailData.notes - Notes (optional)
   * @returns {Promise<Object>} Updated order detail data
   * @note Cannot update details of delivered or cancelled orders
   */
  updateOrderDetail: async (orderDetailId, orderDetailData) => {
    try {
      const response = await api.put(`/order-details/${orderDetailId}`, orderDetailData)
      return response.data
    } catch (error) {
      console.error('Error updating order detail:', error)
      throw error
    }
  },

  /**
   * Delete order detail
   * @param {string} orderDetailId - Order detail ID
   * @returns {Promise<Object>} Success message
   * @note Cannot delete details from delivered or cancelled orders
   * @note Cannot delete the last detail of an order
   */
  deleteOrderDetail: async (orderDetailId) => {
    try {
      const response = await api.delete(`/order-details/${orderDetailId}`)
      return response.data
    } catch (error) {
      console.error('Error deleting order detail:', error)
      throw error
    }
  },

  // ========== CONVENIENCE METHODS ==========

  /**
   * Get order details by order
   * @param {string} orderId - Order ID
   * @param {Object} params - Additional query parameters
   * @returns {Promise<Object>} Order details for the specified order
   */
  getDetailsByOrder: async (orderId, params = {}) => {
    try {
      const response = await api.get('/order-details', {
        params: {
          order: orderId,
          ...params
        }
      })
      return response.data
    } catch (error) {
      console.error('Error fetching order details by order:', error)
      throw error
    }
  },

  /**
   * Get order details by product
   * @param {string} productId - Product ID
   * @param {Object} params - Additional query parameters
   * @returns {Promise<Object>} Order details for the specified product
   */
  getDetailsByProduct: async (productId, params = {}) => {
    try {
      const response = await api.get('/order-details', {
        params: {
          product: productId,
          ...params
        }
      })
      return response.data
    } catch (error) {
      console.error('Error fetching order details by product:', error)
      throw error
    }
  },

  /**
   * Get order details by batch
   * @param {string} batchId - Batch ID
   * @param {Object} params - Additional query parameters
   * @returns {Promise<Object>} Order details for the specified batch
   */
  getDetailsByBatch: async (batchId, params = {}) => {
    try {
      const response = await api.get('/order-details', {
        params: {
          batch: batchId,
          ...params
        }
      })
      return response.data
    } catch (error) {
      console.error('Error fetching order details by batch:', error)
      throw error
    }
  },

  /**
   * Get order details by date range
   * @param {string} startDate - Start date (ISO string)
   * @param {string} endDate - End date (ISO string)
   * @param {Object} params - Additional query parameters
   * @returns {Promise<Object>} Order details in date range
   */
  getDetailsByDateRange: async (startDate, endDate, params = {}) => {
    try {
      const response = await api.get('/order-details', {
        params: {
          startDate,
          endDate,
          ...params
        }
      })
      return response.data
    } catch (error) {
      console.error('Error fetching order details by date range:', error)
      throw error
    }
  },

  /**
   * Get order details by quantity range
   * @param {number} minQuantity - Minimum quantity
   * @param {number} maxQuantity - Maximum quantity (optional)
   * @param {Object} params - Additional query parameters
   * @returns {Promise<Object>} Order details in quantity range
   */
  getDetailsByQuantityRange: async (minQuantity, maxQuantity = null, params = {}) => {
    try {
      const queryParams = {
        minQuantity,
        ...params
      }
      if (maxQuantity !== null) {
        queryParams.maxQuantity = maxQuantity
      }
      const response = await api.get('/order-details', { params: queryParams })
      return response.data
    } catch (error) {
      console.error('Error fetching order details by quantity range:', error)
      throw error
    }
  },

  /**
   * Get order details by price range
   * @param {number} minPrice - Minimum unit price
   * @param {number} maxPrice - Maximum unit price (optional)
   * @param {Object} params - Additional query parameters
   * @returns {Promise<Object>} Order details in price range
   */
  getDetailsByPriceRange: async (minPrice, maxPrice = null, params = {}) => {
    try {
      const queryParams = {
        minPrice,
        ...params
      }
      if (maxPrice !== null) {
        queryParams.maxPrice = maxPrice
      }
      const response = await api.get('/order-details', { params: queryParams })
      return response.data
    } catch (error) {
      console.error('Error fetching order details by price range:', error)
      throw error
    }
  },

  /**
   * Update order detail quantity
   * @param {string} orderDetailId - Order detail ID
   * @param {number} quantity - New quantity
   * @returns {Promise<Object>} Updated order detail
   */
  updateQuantity: async (orderDetailId, quantity) => {
    return orderDetailService.updateOrderDetail(orderDetailId, { quantity })
  },

  /**
   * Update order detail price
   * @param {string} orderDetailId - Order detail ID
   * @param {number} unitPrice - New unit price
   * @returns {Promise<Object>} Updated order detail
   */
  updatePrice: async (orderDetailId, unitPrice) => {
    return orderDetailService.updateOrderDetail(orderDetailId, { unitPrice })
  },

  /**
   * Update order detail notes
   * @param {string} orderDetailId - Order detail ID
   * @param {string} notes - New notes
   * @returns {Promise<Object>} Updated order detail
   */
  updateNotes: async (orderDetailId, notes) => {
    return orderDetailService.updateOrderDetail(orderDetailId, { notes })
  },

  /**
   * Add item to order
   * Convenience method for creating order detail
   * @param {string} orderId - Order ID
   * @param {string} productId - Product ID
   * @param {string} batchId - Batch ID
   * @param {number} quantity - Quantity
   * @param {number} unitPrice - Unit price
   * @param {string} notes - Notes (optional)
   * @returns {Promise<Object>} Created order detail
   */
  addItemToOrder: async (orderId, productId, batchId, quantity, unitPrice, notes = '') => {
    return orderDetailService.createOrderDetail({
      order: orderId,
      product: productId,
      batch: batchId,
      quantity,
      unitPrice,
      notes
    })
  },

  /**
   * Remove item from order
   * Convenience method for deleting order detail
   * @param {string} orderDetailId - Order detail ID
   * @returns {Promise<Object>} Success message
   */
  removeItemFromOrder: async (orderDetailId) => {
    return orderDetailService.deleteOrderDetail(orderDetailId)
  },

  /**
   * Get best-selling products from order details
   * @param {Object} params - Query parameters (startDate, endDate, limit, etc.)
   * @returns {Promise<Object>} Order details sorted by quantity or frequency
   */
  getBestSellingProducts: async (params = {}) => {
    try {
      const response = await api.get('/order-details', {
        params: {
          sortBy: 'quantity',
          sortOrder: 'desc',
          limit: 10,
          ...params
        }
      })
      return response.data
    } catch (error) {
      console.error('Error fetching best-selling products:', error)
      throw error
    }
  },

  /**
   * Get today's order details
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Today's order details
   */
  getTodayOrderDetails: async (params = {}) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    return orderDetailService.getDetailsByDateRange(
      today.toISOString(),
      tomorrow.toISOString(),
      params
    )
  },

  /**
   * Calculate total revenue from order details
   * @param {Object} params - Query parameters (startDate, endDate, etc.)
   * @returns {Promise<number>} Total revenue
   */
  calculateRevenue: async (params = {}) => {
    try {
      const response = await orderDetailService.getAllOrderDetails({
        limit: 10000, // Get all for calculation
        ...params
      })

      const details = response.data?.orderDetails || []
      const revenue = details.reduce((sum, detail) => {
        const total = detail.total || (detail.quantity * detail.unitPrice)
        return sum + total
      }, 0)

      return revenue
    } catch (error) {
      console.error('Error calculating revenue:', error)
      throw error
    }
  }
}

export default orderDetailService
