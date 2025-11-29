import api from './api'

/**
 * Order Service
 * Handles all API calls related to orders
 */
const orderService = {
  /**
   * Get all orders with optional filters
   * @param {Object} params - Query parameters
   * @param {string} params.customer - Filter by customer ID
   * @param {string} params.createdBy - Filter by employee ID
   * @param {string} params.status - Filter by order status (pending/processing/shipping/delivered/cancelled)
   * @param {string} params.paymentStatus - Filter by payment status (pending/paid/failed/refunded)
   * @param {string} params.deliveryType - Filter by delivery type (delivery/pickup)
   * @param {string} params.startDate - Filter orders from this date
   * @param {string} params.endDate - Filter orders to this date
   * @param {number} params.minTotal - Filter by minimum total
   * @param {number} params.maxTotal - Filter by maximum total
   * @param {string} params.search - Search by order number or customer name
   * @param {boolean} params.withDetails - Include order details
   * @param {string} params.sortBy - Sort field (default: orderDate)
   * @param {string} params.sortOrder - Sort order (asc/desc, default: desc)
   * @param {number} params.page - Page number for pagination
   * @param {number} params.limit - Items per page
   * @returns {Promise<Object>} Response with orders array and pagination
   */
  getAllOrders: async (params = {}) => {
    try {
      const response = await api.get('/orders', { params })
      return response.data
    } catch (error) {
      console.error('Error fetching orders:', error)
      throw error
    }
  },

  /**
   * Get order by ID
   * @param {string} orderId - Order ID
   * @returns {Promise<Object>} Order data with customer, employee, and details
   */
  getOrderById: async (orderId) => {
    try {
      const response = await api.get(`/orders/${orderId}`)
      return response.data
    } catch (error) {
      console.error('Error fetching order:', error)
      throw error
    }
  },

  /**
   * Create new order
   * @param {Object} orderData - Order data
   * @param {string} orderData.customer - Customer ID (required)
   * @param {string} orderData.createdBy - Employee ID (required)
   * @param {string} orderData.orderDate - Order date (optional, defaults to now)
   * @param {string} orderData.deliveryType - Delivery type: 'delivery' | 'pickup' (optional, defaults to 'delivery')
   * @param {string} orderData.address - Delivery address (optional)
   * @param {number} orderData.shippingFee - Shipping fee (optional, defaults to 0)
   * @param {number} orderData.discountPercentage - Discount percentage (optional, defaults to 0)
   * @param {string} orderData.status - Order status (optional, defaults to 'pending')
   * @param {string} orderData.paymentStatus - Payment status (optional, defaults to 'pending')
   * @param {Array} orderData.details - Order details array (required)
   * @param {string} orderData.details[].product - Product ID (required)
   * @param {string} orderData.details[].batch - Batch ID (required)
   * @param {number} orderData.details[].quantity - Quantity (required)
   * @param {number} orderData.details[].unitPrice - Unit price (required)
   * @param {string} orderData.details[].notes - Notes (optional)
   * @returns {Promise<Object>} Created order data
   */
  createOrder: async (orderData) => {
    try {
      const response = await api.post('/orders', orderData)
      return response.data
    } catch (error) {
      console.error('Error creating order:', error)
      throw error
    }
  },

  /**
   * Update order
   * @param {string} orderId - Order ID
   * @param {Object} orderData - Updated order data
   * @param {string} orderData.deliveryType - Delivery type (optional)
   * @param {string} orderData.address - Delivery address (optional)
   * @param {number} orderData.shippingFee - Shipping fee (optional)
   * @param {number} orderData.discountPercentage - Discount percentage (optional)
   * @param {string} orderData.status - Order status (optional)
   * @param {string} orderData.paymentStatus - Payment status (optional)
   * @returns {Promise<Object>} Updated order data
   * @note Cannot update delivered or cancelled orders
   */
  updateOrder: async (orderId, orderData) => {
    try {
      const response = await api.put(`/orders/${orderId}`, orderData)
      return response.data
    } catch (error) {
      console.error('Error updating order:', error)
      throw error
    }
  },

  /**
   * Delete order
   * @param {string} orderId - Order ID
   * @param {boolean} hardDelete - Hard delete (true) or soft delete/cancel (false, default)
   * @returns {Promise<Object>} Success message
   * @note Soft delete (cancel) by default, hard delete only for draft/pending unpaid orders
   */
  deleteOrder: async (orderId, hardDelete = false) => {
    try {
      const params = hardDelete ? { hardDelete: 'true' } : {}
      const response = await api.delete(`/orders/${orderId}`, { params })
      return response.data
    } catch (error) {
      console.error('Error deleting order:', error)
      throw error
    }
  },

  /**
   * Delete all draft orders (bulk delete)
   * @returns {Promise<Object>} Response with deleted count
   * @note Hard deletes all draft orders and their details
   */
  deleteAllDrafts: async () => {
    try {
      const response = await api.delete('/orders/bulk/draft')
      return response.data.data
    } catch (error) {
      console.error('Error deleting all draft orders:', error)
      throw error
    }
  },

  /**
   * Refund order (restore inventory to shelf)
   * @param {string} orderId - Order ID
   * @param {Object} refundData - Refund data
   * @param {string} refundData.reason - Reason for refund (optional)
   * @returns {Promise<Object>} Refunded order data
   * @note Can only refund delivered orders that are paid
   */
  refundOrder: async (orderId, refundData = {}) => {
    try {
      const response = await api.post(`/orders/${orderId}/refund`, refundData)
      return response.data
    } catch (error) {
      console.error('Error refunding order:', error)
      throw error
    }
  },

  // ========== CONVENIENCE METHODS ==========

  /**
   * Search orders by keyword
   * @param {string} keyword - Search keyword (order number or customer name)
   * @param {Object} options - Additional options (page, limit, etc.)
   * @returns {Promise<Object>} Search results
   */
  searchOrders: async (keyword, options = {}) => {
    try {
      const params = {
        search: keyword,
        ...options
      }
      const response = await api.get('/orders', { params })
      return response.data
    } catch (error) {
      console.error('Error searching orders:', error)
      throw error
    }
  },

  /**
   * Get orders by status
   * @param {string} status - Order status (pending/processing/shipping/delivered/cancelled)
   * @param {Object} params - Additional query parameters
   * @returns {Promise<Object>} Orders of specified status
   */
  getOrdersByStatus: async (status, params = {}) => {
    try {
      const response = await api.get('/orders', {
        params: {
          status,
          ...params
        }
      })
      return response.data
    } catch (error) {
      console.error('Error fetching orders by status:', error)
      throw error
    }
  },

  /**
   * Get pending orders
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Pending orders
   */
  getPendingOrders: async (params = {}) => {
    return orderService.getOrdersByStatus('pending', params)
  },

  /**
   * Get processing orders
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Processing orders
   */
  getProcessingOrders: async (params = {}) => {
    return orderService.getOrdersByStatus('processing', params)
  },

  /**
   * Get shipping orders
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Shipping orders
   */
  getShippingOrders: async (params = {}) => {
    return orderService.getOrdersByStatus('shipping', params)
  },

  /**
   * Get delivered orders
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Delivered orders
   */
  getDeliveredOrders: async (params = {}) => {
    return orderService.getOrdersByStatus('delivered', params)
  },

  /**
   * Get cancelled orders
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Cancelled orders
   */
  getCancelledOrders: async (params = {}) => {
    return orderService.getOrdersByStatus('cancelled', params)
  },

  /**
   * Get orders by payment status
   * @param {string} paymentStatus - Payment status (pending/paid/failed/refunded)
   * @param {Object} params - Additional query parameters
   * @returns {Promise<Object>} Orders of specified payment status
   */
  getOrdersByPaymentStatus: async (paymentStatus, params = {}) => {
    try {
      const response = await api.get('/orders', {
        params: {
          paymentStatus,
          ...params
        }
      })
      return response.data
    } catch (error) {
      console.error('Error fetching orders by payment status:', error)
      throw error
    }
  },

  /**
   * Get unpaid orders
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Unpaid orders
   */
  getUnpaidOrders: async (params = {}) => {
    return orderService.getOrdersByPaymentStatus('pending', params)
  },

  /**
   * Get paid orders
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Paid orders
   */
  getPaidOrders: async (params = {}) => {
    return orderService.getOrdersByPaymentStatus('paid', params)
  },

  /**
   * Get orders by customer
   * @param {string} customerId - Customer ID
   * @param {Object} params - Additional query parameters
   * @returns {Promise<Object>} Customer orders
   */
  getOrdersByCustomer: async (customerId, params = {}) => {
    try {
      const response = await api.get('/orders', {
        params: {
          customer: customerId,
          ...params
        }
      })
      return response.data
    } catch (error) {
      console.error('Error fetching orders by customer:', error)
      throw error
    }
  },

  /**
   * Get orders by employee
   * @param {string} employeeId - Employee ID
   * @param {Object} params - Additional query parameters
   * @returns {Promise<Object>} Employee orders
   */
  getOrdersByEmployee: async (employeeId, params = {}) => {
    try {
      const response = await api.get('/orders', {
        params: {
          createdBy: employeeId,
          ...params
        }
      })
      return response.data
    } catch (error) {
      console.error('Error fetching orders by employee:', error)
      throw error
    }
  },

  /**
   * Get orders by date range
   * @param {string} startDate - Start date (ISO string)
   * @param {string} endDate - End date (ISO string)
   * @param {Object} params - Additional query parameters
   * @returns {Promise<Object>} Orders in date range
   */
  getOrdersByDateRange: async (startDate, endDate, params = {}) => {
    try {
      const response = await api.get('/orders', {
        params: {
          startDate,
          endDate,
          ...params
        }
      })
      return response.data
    } catch (error) {
      console.error('Error fetching orders by date range:', error)
      throw error
    }
  },

  /**
   * Get orders by delivery type
   * @param {string} deliveryType - Delivery type (delivery/pickup)
   * @param {Object} params - Additional query parameters
   * @returns {Promise<Object>} Orders of specified delivery type
   */
  getOrdersByDeliveryType: async (deliveryType, params = {}) => {
    try {
      const response = await api.get('/orders', {
        params: {
          deliveryType,
          ...params
        }
      })
      return response.data
    } catch (error) {
      console.error('Error fetching orders by delivery type:', error)
      throw error
    }
  },

  /**
   * Get delivery orders
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Delivery orders
   */
  getDeliveryOrders: async (params = {}) => {
    return orderService.getOrdersByDeliveryType('delivery', params)
  },

  /**
   * Get pickup orders
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Pickup orders
   */
  getPickupOrders: async (params = {}) => {
    return orderService.getOrdersByDeliveryType('pickup', params)
  },

  /**
   * Get orders with full details
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Orders with populated details
   */
  getOrdersWithDetails: async (params = {}) => {
    try {
      const response = await api.get('/orders', {
        params: {
          withDetails: true,
          ...params
        }
      })
      return response.data
    } catch (error) {
      console.error('Error fetching orders with details:', error)
      throw error
    }
  },

  /**
   * Get today's orders
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Today's orders
   */
  getTodayOrders: async (params = {}) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    return orderService.getOrdersByDateRange(
      today.toISOString(),
      tomorrow.toISOString(),
      params
    )
  },

  /**
   * Update order status
   * @param {string} orderId - Order ID
   * @param {string} newStatus - New status (pending/processing/shipping/delivered/cancelled)
   * @returns {Promise<Object>} Updated order
   */
  updateOrderStatus: async (orderId, newStatus) => {
    return orderService.updateOrder(orderId, { status: newStatus })
  },

  /**
   * Update payment status
   * @param {string} orderId - Order ID
   * @param {string} newPaymentStatus - New payment status (pending/paid/failed/refunded)
   * @returns {Promise<Object>} Updated order
   */
  updatePaymentStatus: async (orderId, newPaymentStatus) => {
    return orderService.updateOrder(orderId, { paymentStatus: newPaymentStatus })
  },

  /**
   * Mark order as paid
   * @param {string} orderId - Order ID
   * @returns {Promise<Object>} Updated order
   */
  markAsPaid: async (orderId) => {
    return orderService.updatePaymentStatus(orderId, 'paid')
  },

  /**
   * Mark order as pending payment
   * @param {string} orderId - Order ID
   * @returns {Promise<Object>} Updated order
   */
  markAsPending: async (orderId) => {
    return orderService.updatePaymentStatus(orderId, 'pending')
  },

  /**
   * Cancel order
   * @param {string} orderId - Order ID
   * @returns {Promise<Object>} Updated order
   */
  cancelOrder: async (orderId) => {
    return orderService.updateOrderStatus(orderId, 'cancelled')
  },

  /**
   * Process order (move to processing status)
   * @param {string} orderId - Order ID
   * @returns {Promise<Object>} Updated order
   */
  processOrder: async (orderId) => {
    return orderService.updateOrderStatus(orderId, 'processing')
  },

  /**
   * Ship order (move to shipping status)
   * @param {string} orderId - Order ID
   * @returns {Promise<Object>} Updated order
   */
  shipOrder: async (orderId) => {
    return orderService.updateOrderStatus(orderId, 'shipping')
  },

  /**
   * Deliver order (move to delivered status)
   * @param {string} orderId - Order ID
   * @returns {Promise<Object>} Updated order
   */
  deliverOrder: async (orderId) => {
    return orderService.updateOrderStatus(orderId, 'delivered')
  },

  /**
   * Update order shipping fee
   * @param {string} orderId - Order ID
   * @param {number} shippingFee - New shipping fee
   * @returns {Promise<Object>} Updated order
   */
  updateShippingFee: async (orderId, shippingFee) => {
    return orderService.updateOrder(orderId, { shippingFee })
  },

  /**
   * Update order discount
   * @param {string} orderId - Order ID
   * @param {number} discountPercentage - New discount percentage (0-100)
   * @returns {Promise<Object>} Updated order
   */
  updateDiscount: async (orderId, discountPercentage) => {
    return orderService.updateOrder(orderId, { discountPercentage })
  },

  /**
   * Update delivery address
   * @param {string} orderId - Order ID
   * @param {string} address - New delivery address
   * @returns {Promise<Object>} Updated order
   */
  updateAddress: async (orderId, address) => {
    return orderService.updateOrder(orderId, { address })
  },

  /**
   * Change delivery type
   * @param {string} orderId - Order ID
   * @param {string} deliveryType - New delivery type (delivery/pickup)
   * @returns {Promise<Object>} Updated order
   */
  changeDeliveryType: async (orderId, deliveryType) => {
    return orderService.updateOrder(orderId, { deliveryType })
  }
}

export default orderService
