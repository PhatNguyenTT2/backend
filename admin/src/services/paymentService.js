import api from './api'

/**
 * Payment Service
 * Handles all API calls related to payments
 */
const paymentService = {
  /**
   * Get all payments with optional filters
   * @param {Object} params - Query parameters
   * @param {string} params.referenceType - Filter by reference type (Order/PurchaseOrder)
   * @param {string} params.referenceId - Filter by specific order or purchase order ID
   * @param {string} params.status - Filter by payment status (pending/completed/cancelled)
   * @param {string} params.paymentMethod - Filter by payment method (cash/bank_transfer)
   * @param {string} params.startDate - Filter payments from this date
   * @param {string} params.endDate - Filter payments to this date
   * @param {number} params.minAmount - Filter by minimum amount
   * @param {number} params.maxAmount - Filter by maximum amount
   * @param {string} params.createdBy - Filter by employee ID who created the payment
   * @param {string} params.search - Search by payment number
   * @param {string} params.sortBy - Sort field (default: paymentDate)
   * @param {string} params.sortOrder - Sort order (asc/desc, default: desc)
   * @param {number} params.page - Page number for pagination
   * @param {number} params.limit - Items per page
   * @returns {Promise<Object>} Response with payments array and pagination
   */
  getAllPayments: async (params = {}) => {
    try {
      const response = await api.get('/payments', { params })
      return response.data
    } catch (error) {
      console.error('Error fetching payments:', error)
      throw error
    }
  },

  /**
   * Get payment by ID
   * @param {string} paymentId - Payment ID
   * @returns {Promise<Object>} Payment data with createdBy and reference details
   */
  getPaymentById: async (paymentId) => {
    try {
      const response = await api.get(`/payments/${paymentId}`)
      return response.data
    } catch (error) {
      console.error('Error fetching payment:', error)
      throw error
    }
  },

  /**
   * Create new payment
   * @param {Object} paymentData - Payment data
   * @param {string} paymentData.referenceType - Reference type: 'Order' | 'PurchaseOrder' (required)
   * @param {string} paymentData.referenceId - Order or PurchaseOrder ID (required)
   * @param {number} paymentData.amount - Payment amount (required)
   * @param {string} paymentData.paymentMethod - Payment method: 'cash' | 'bank_transfer' (required)
   * @param {string} paymentData.paymentDate - Payment date (optional, defaults to now)
   * @param {string} paymentData.status - Payment status: 'pending' | 'completed' | 'cancelled' (optional, defaults to 'pending')
   * @param {string} paymentData.notes - Additional notes (optional)
   * @returns {Promise<Object>} Created payment data
   */
  createPayment: async (paymentData) => {
    try {
      const response = await api.post('/payments', paymentData)
      return response.data
    } catch (error) {
      console.error('Error creating payment:', error)
      throw error
    }
  },

  /**
   * Update payment
   * @param {string} paymentId - Payment ID
   * @param {Object} paymentData - Updated payment data
   * @param {number} paymentData.amount - Payment amount (optional)
   * @param {string} paymentData.paymentMethod - Payment method (optional)
   * @param {string} paymentData.paymentDate - Payment date (optional)
   * @param {string} paymentData.status - Payment status (optional)
   * @param {string} paymentData.notes - Additional notes (optional)
   * @returns {Promise<Object>} Updated payment data
   */
  updatePayment: async (paymentId, paymentData) => {
    try {
      const response = await api.put(`/payments/${paymentId}`, paymentData)
      return response.data
    } catch (error) {
      console.error('Error updating payment:', error)
      throw error
    }
  },

  /**
   * Delete payment
   * @param {string} paymentId - Payment ID
   * @returns {Promise<Object>} Success message
   * @note Only pending payments can be deleted
   */
  deletePayment: async (paymentId) => {
    try {
      const response = await api.delete(`/payments/${paymentId}`)
      return response.data
    } catch (error) {
      console.error('Error deleting payment:', error)
      throw error
    }
  },

  /**
   * Refund a completed payment
   * @param {string} paymentId - Payment ID
   * @returns {Promise<Object>} Refunded payment data
   * @note Only completed PurchaseOrder payments can be refunded
   */
  refundPayment: async (paymentId) => {
    try {
      const response = await api.post(`/payments/${paymentId}/refund`)
      return response.data
    } catch (error) {
      console.error('Error refunding payment:', error)
      throw error
    }
  },

  // ========== CONVENIENCE METHODS ==========

  /**
   * Search payments by payment number
   * @param {string} keyword - Search keyword (payment number)
   * @param {Object} options - Additional options (page, limit, etc.)
   * @returns {Promise<Object>} Search results
   */
  searchPayments: async (keyword, options = {}) => {
    try {
      const params = {
        search: keyword,
        ...options
      }
      const response = await api.get('/payments', { params })
      return response.data
    } catch (error) {
      console.error('Error searching payments:', error)
      throw error
    }
  },

  /**
   * Get payments by status
   * @param {string} status - Payment status (pending/completed/cancelled)
   * @param {Object} params - Additional query parameters
   * @returns {Promise<Object>} Payments of specified status
   */
  getPaymentsByStatus: async (status, params = {}) => {
    try {
      const response = await api.get('/payments', {
        params: {
          status,
          ...params
        }
      })
      return response.data
    } catch (error) {
      console.error('Error fetching payments by status:', error)
      throw error
    }
  },

  /**
   * Get pending payments
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Pending payments
   */
  getPendingPayments: async (params = {}) => {
    return paymentService.getPaymentsByStatus('pending', params)
  },

  /**
   * Get completed payments
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Completed payments
   */
  getCompletedPayments: async (params = {}) => {
    return paymentService.getPaymentsByStatus('completed', params)
  },

  /**
   * Get cancelled payments
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Cancelled payments
   */
  getCancelledPayments: async (params = {}) => {
    return paymentService.getPaymentsByStatus('cancelled', params)
  },

  /**
   * Get payments by payment method
   * @param {string} paymentMethod - Payment method (cash/bank_transfer)
   * @param {Object} params - Additional query parameters
   * @returns {Promise<Object>} Payments of specified method
   */
  getPaymentsByMethod: async (paymentMethod, params = {}) => {
    try {
      const response = await api.get('/payments', {
        params: {
          paymentMethod,
          ...params
        }
      })
      return response.data
    } catch (error) {
      console.error('Error fetching payments by method:', error)
      throw error
    }
  },

  /**
   * Get cash payments
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Cash payments
   */
  getCashPayments: async (params = {}) => {
    return paymentService.getPaymentsByMethod('cash', params)
  },

  /**
   * Get bank transfer payments
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Bank transfer payments
   */
  getBankTransferPayments: async (params = {}) => {
    return paymentService.getPaymentsByMethod('bank_transfer', params)
  },

  /**
   * Get payments by reference type
   * @param {string} referenceType - Reference type (Order/PurchaseOrder)
   * @param {Object} params - Additional query parameters
   * @returns {Promise<Object>} Payments of specified reference type
   */
  getPaymentsByReferenceType: async (referenceType, params = {}) => {
    try {
      const response = await api.get('/payments', {
        params: {
          referenceType,
          ...params
        }
      })
      return response.data
    } catch (error) {
      console.error('Error fetching payments by reference type:', error)
      throw error
    }
  },

  /**
   * Get order payments (sales payments)
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Order payments
   */
  getOrderPayments: async (params = {}) => {
    return paymentService.getPaymentsByReferenceType('Order', params)
  },

  /**
   * Get purchase order payments (purchase payments)
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Purchase order payments
   */
  getPurchaseOrderPayments: async (params = {}) => {
    return paymentService.getPaymentsByReferenceType('PurchaseOrder', params)
  },

  /**
   * Get payments by date range
   * @param {string} startDate - Start date (ISO string)
   * @param {string} endDate - End date (ISO string)
   * @param {Object} params - Additional query parameters
   * @returns {Promise<Object>} Payments in date range
   */
  getPaymentsByDateRange: async (startDate, endDate, params = {}) => {
    try {
      const response = await api.get('/payments', {
        params: {
          startDate,
          endDate,
          ...params
        }
      })
      return response.data
    } catch (error) {
      console.error('Error fetching payments by date range:', error)
      throw error
    }
  },

  /**
   * Get payments by employee
   * @param {string} employeeId - Employee ID
   * @param {Object} params - Additional query parameters
   * @returns {Promise<Object>} Employee payments
   */
  getPaymentsByEmployee: async (employeeId, params = {}) => {
    try {
      const response = await api.get('/payments', {
        params: {
          createdBy: employeeId,
          ...params
        }
      })
      return response.data
    } catch (error) {
      console.error('Error fetching payments by employee:', error)
      throw error
    }
  },

  /**
   * Get payments by amount range
   * @param {number} minAmount - Minimum amount
   * @param {number} maxAmount - Maximum amount
   * @param {Object} params - Additional query parameters
   * @returns {Promise<Object>} Payments in amount range
   */
  getPaymentsByAmountRange: async (minAmount, maxAmount, params = {}) => {
    try {
      const response = await api.get('/payments', {
        params: {
          minAmount,
          maxAmount,
          ...params
        }
      })
      return response.data
    } catch (error) {
      console.error('Error fetching payments by amount range:', error)
      throw error
    }
  },

  /**
   * Get today's payments
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Today's payments
   */
  getTodayPayments: async (params = {}) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    return paymentService.getPaymentsByDateRange(
      today.toISOString(),
      tomorrow.toISOString(),
      params
    )
  },

  /**
   * Get payments for a specific order
   * @param {string} orderId - Order ID
   * @param {Object} params - Additional query parameters
   * @returns {Promise<Object>} Order payments with summary
   */
  getPaymentsForOrder: async (orderId, params = {}) => {
    try {
      const response = await api.get('/payments', {
        params: {
          referenceType: 'Order',
          referenceId: orderId,
          ...params
        }
      })
      return response.data
    } catch (error) {
      console.error('Error fetching payments for order:', error)
      throw error
    }
  },

  /**
   * Get payments for a specific purchase order
   * @param {string} purchaseOrderId - Purchase Order ID
   * @param {Object} params - Additional query parameters
   * @returns {Promise<Object>} Purchase order payments with summary
   */
  getPaymentsForPurchaseOrder: async (purchaseOrderId, params = {}) => {
    try {
      const response = await api.get('/payments', {
        params: {
          referenceType: 'PurchaseOrder',
          referenceId: purchaseOrderId,
          ...params
        }
      })
      return response.data
    } catch (error) {
      console.error('Error fetching payments for purchase order:', error)
      throw error
    }
  },

  /**
   * Create payment for order
   * @param {string} orderId - Order ID
   * @param {Object} paymentData - Payment data
   * @param {number} paymentData.amount - Payment amount (required)
   * @param {string} paymentData.paymentMethod - Payment method (required)
   * @param {string} paymentData.paymentDate - Payment date (optional)
   * @param {string} paymentData.status - Payment status (optional)
   * @param {string} paymentData.notes - Notes (optional)
   * @returns {Promise<Object>} Created payment
   */
  createOrderPayment: async (orderId, paymentData) => {
    return paymentService.createPayment({
      ...paymentData,
      referenceType: 'Order',
      referenceId: orderId
    })
  },

  /**
   * Create payment for purchase order
   * @param {string} purchaseOrderId - Purchase Order ID
   * @param {Object} paymentData - Payment data
   * @param {number} paymentData.amount - Payment amount (required)
   * @param {string} paymentData.paymentMethod - Payment method (required)
   * @param {string} paymentData.paymentDate - Payment date (optional)
   * @param {string} paymentData.status - Payment status (optional)
   * @param {string} paymentData.notes - Notes (optional)
   * @returns {Promise<Object>} Created payment
   */
  createPurchaseOrderPayment: async (purchaseOrderId, paymentData) => {
    return paymentService.createPayment({
      ...paymentData,
      referenceType: 'PurchaseOrder',
      referenceId: purchaseOrderId
    })
  },

  /**
   * Update payment status
   * @param {string} paymentId - Payment ID
   * @param {string} newStatus - New status (pending/completed/cancelled)
   * @returns {Promise<Object>} Updated payment
   */
  updatePaymentStatus: async (paymentId, newStatus) => {
    return paymentService.updatePayment(paymentId, { status: newStatus })
  },

  /**
   * Complete payment (mark as completed)
   * @param {string} paymentId - Payment ID
   * @returns {Promise<Object>} Updated payment
   */
  completePayment: async (paymentId) => {
    return paymentService.updatePaymentStatus(paymentId, 'completed')
  },

  /**
   * Cancel payment
   * @param {string} paymentId - Payment ID
   * @returns {Promise<Object>} Updated payment
   */
  cancelPayment: async (paymentId) => {
    return paymentService.updatePaymentStatus(paymentId, 'cancelled')
  },

  /**
   * Update payment amount
   * @param {string} paymentId - Payment ID
   * @param {number} amount - New amount
   * @returns {Promise<Object>} Updated payment
   */
  updatePaymentAmount: async (paymentId, amount) => {
    return paymentService.updatePayment(paymentId, { amount })
  },

  /**
   * Update payment method
   * @param {string} paymentId - Payment ID
   * @param {string} paymentMethod - New payment method (cash/bank_transfer)
   * @returns {Promise<Object>} Updated payment
   */
  updatePaymentMethod: async (paymentId, paymentMethod) => {
    return paymentService.updatePayment(paymentId, { paymentMethod })
  },

  /**
   * Update payment date
   * @param {string} paymentId - Payment ID
   * @param {string} paymentDate - New payment date (ISO string)
   * @returns {Promise<Object>} Updated payment
   */
  updatePaymentDate: async (paymentId, paymentDate) => {
    return paymentService.updatePayment(paymentId, { paymentDate })
  },

  /**
   * Update payment notes
   * @param {string} paymentId - Payment ID
   * @param {string} notes - New notes
   * @returns {Promise<Object>} Updated payment
   */
  updatePaymentNotes: async (paymentId, notes) => {
    return paymentService.updatePayment(paymentId, { notes })
  }
}

export default paymentService
