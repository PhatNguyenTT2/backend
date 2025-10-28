import api from './api'

/**
 * Order Service
 * Handles all order-related API calls
 */
const orderService = {
  /**
   * Get all orders with pagination and filters
   * @param {Object} params - Query parameters
   * @returns {Promise} Order list with pagination
   */
  getOrders: async (params = {}) => {
    try {
      // Clean params - remove empty values
      const cleanParams = {}
      Object.keys(params).forEach(key => {
        const value = params[key]
        // Only include non-empty values
        if (value !== '' && value !== null && value !== undefined) {
          cleanParams[key] = value
        }
      })

      const response = await api.get('/orders', { params: cleanParams })
      return response.data
    } catch (error) {
      console.error('Error fetching orders:', error)
      throw error.response?.data || error
    }
  },

  /**
   * Get single order by ID
   * @param {string} id - Order ID
   * @returns {Promise} Order details
   */
  getOrderById: async (id) => {
    try {
      const response = await api.get(`/orders/${id}`)
      return response.data
    } catch (error) {
      console.error(`Error fetching order ${id}:`, error)
      throw error.response?.data || error
    }
  },

  /**
   * Create new order
   * @param {Object} orderData - Order data
   * @returns {Promise} Created order
   */
  createOrder: async (orderData) => {
    try {
      const response = await api.post('/orders', orderData)
      return response.data
    } catch (error) {
      console.error('Error creating order:', error)
      throw error.response?.data || error
    }
  },

  /**
   * Update order status
   * @param {string} id - Order ID
   * @param {string} status - New status
   * @returns {Promise} Updated order
   */
  updateOrderStatus: async (id, status) => {
    try {
      const response = await api.patch(`/orders/${id}/status`, { status })
      return response.data
    } catch (error) {
      console.error(`Error updating order status ${id}:`, error)
      throw error.response?.data || error
    }
  },

  /**
   * Update entire order
   * @param {string} id - Order ID
   * @param {Object} orderData - Updated order data
   * @returns {Promise} Updated order
   */
  updateOrder: async (id, orderData) => {
    try {
      const response = await api.put(`/orders/${id}`, orderData)
      return response.data
    } catch (error) {
      console.error(`Error updating order ${id}:`, error)
      throw error.response?.data || error
    }
  },

  /**
   * Update order payment status
   * @param {string} id - Order ID
   * @param {string} paymentStatus - New payment status
   * @returns {Promise} Updated order
   */
  updatePaymentStatus: async (id, paymentStatus) => {
    try {
      const response = await api.patch(`/orders/${id}/payment`, { paymentStatus })
      return response.data
    } catch (error) {
      console.error(`Error updating payment status ${id}:`, error)
      throw error.response?.data || error
    }
  },

  /**
   * Get order statistics
   * @returns {Promise} Order statistics
   */
  getOrderStats: async () => {
    try {
      const response = await api.get('/orders/stats')
      return response.data
    } catch (error) {
      console.error('Error fetching order stats:', error)
      throw error.response?.data || error
    }
  },

  /**
   * Delete an order
   * @param {string} id - Order ID
   * @returns {Promise} Delete response
   */
  deleteOrder: async (id) => {
    try {
      const response = await api.delete(`/orders/${id}`)
      return response.data
    } catch (error) {
      console.error(`Error deleting order ${id}:`, error)
      throw error.response?.data || error
    }
  },

  /**
   * Format orders data for display in the table
   * @param {Array} orders - Raw orders from API
   * @returns {Array} Formatted orders
   */
  formatOrdersForDisplay: (orders) => {
    return orders.map(order => ({
      id: order.id || order._id,
      orderNumber: order.orderNumber,
      customerName: order.customer?.name || 'Unknown Customer',
      customerEmail: order.customer?.email || null,
      customerPhone: order.customer?.phone || null,
      customer: order.customer || null,
      date: order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      }) : 'N/A',
      total: order.total?.toFixed(2) || '0.00',
      status: order.status || 'pending',
      paymentStatus: order.paymentStatus || 'pending',
      paymentMethod: order.paymentMethod || 'cash',
      deliveryType: order.deliveryType || 'delivery',
      shippingAddress: order.shippingAddress || null,
      user: order.user || null,
      items: order.items || [],
      // Thêm các trường cần thiết cho invoice modal
      subtotal: order.subtotal || 0,
      discount: order.discount || 0,
      discountPercentage: order.discountPercentage || 0,
      discountType: order.discountType || 'none',
      shippingFee: order.shippingFee || 0,
      tax: order.tax || 0,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt
    }))
  }
}

export default orderService
