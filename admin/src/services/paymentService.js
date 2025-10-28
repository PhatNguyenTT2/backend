import api from './api';

/**
 * Payment Service
 * Handles all payment-related API calls for both Sales Orders and Purchase Orders
 */
const paymentService = {
  /**
   * Get all payments with filters
   * @param {Object} params - Query parameters (page, limit, type, status, paymentMethod, startDate, endDate)
   * @returns {Promise} Payments list with pagination
   */
  getPayments: async (params = {}) => {
    try {
      console.log('[paymentService] Fetching payments with params:', params);
      const response = await api.get('/payments', { params });
      console.log('[paymentService] Response status:', response.status);
      console.log('[paymentService] Response data:', response.data);
      return response.data;
    } catch (error) {
      console.error('[paymentService] Error fetching payments:', error);
      console.error('[paymentService] Error response:', error.response);
      throw error.response?.data || error;
    }
  },

  /**
   * Get payment by ID
   * @param {string} id - Payment ID
   * @returns {Promise} Payment details
   */
  getPaymentById: async (id) => {
    try {
      const response = await api.get(`/payments/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching payment:', error);
      throw error.response?.data || error;
    }
  },

  /**
   * Create payment
   * @param {Object} data - Payment data
   * @returns {Promise} Created payment
   */
  createPayment: async (data) => {
    try {
      console.log('[paymentService] Creating payment:', data);
      const response = await api.post('/payments', data);
      console.log('[paymentService] Payment created:', response.data);
      return response.data;
    } catch (error) {
      console.error('[paymentService] Error creating payment:', error);
      throw error.response?.data || error;
    }
  },

  /**
   * Update payment
   * @param {string} id - Payment ID
   * @param {Object} data - Update data
   * @returns {Promise} Updated payment
   */
  updatePayment: async (id, data) => {
    try {
      const response = await api.put(`/payments/${id}`, data);
      return response.data;
    } catch (error) {
      console.error('Error updating payment:', error);
      throw error.response?.data || error;
    }
  },

  /**
   * Update payment status (with inventory management)
   * @param {string} id - Payment ID
   * @param {string} status - New status (pending, completed, failed)
   * @returns {Promise} Updated payment
   */
  updatePaymentStatus: async (id, status) => {
    try {
      console.log(`[paymentService] Updating payment ${id} status to ${status}`);
      const response = await api.put(`/payments/${id}/status`, { status });
      console.log('[paymentService] Payment status updated:', response.data);
      return response.data;
    } catch (error) {
      console.error('[paymentService] Error updating payment status:', error);
      throw error.response?.data || error;
    }
  },

  /**
   * Update payment method
   * @param {string} id - Payment ID
   * @param {string} paymentMethod - New payment method (cash, card, bank_transfer, e_wallet, check, credit)
   * @returns {Promise} Updated payment
   */
  updatePaymentMethod: async (id, paymentMethod) => {
    try {
      console.log(`[paymentService] Updating payment ${id} method to ${paymentMethod}`);
      const response = await api.patch(`/payments/${id}/method`, { paymentMethod });
      console.log('[paymentService] Payment method updated:', response.data);
      return response.data;
    } catch (error) {
      console.error('[paymentService] Error updating payment method:', error);
      throw error.response?.data || error;
    }
  },

  /**
   * Process refund for a payment (with inventory restoration)
   * @param {string} id - Payment ID
   * @param {number} amount - Refund amount
   * @param {string} reason - Refund reason
   * @returns {Promise} Updated payment
   */
  processRefund: async (id, amount, reason) => {
    try {
      console.log(`[paymentService] Processing refund for payment ${id}:`, { amount, reason });
      const response = await api.post(`/payments/${id}/refund`, { amount, reason });
      console.log('[paymentService] Refund processed:', response.data);
      return response.data;
    } catch (error) {
      console.error('[paymentService] Error processing refund:', error);
      throw error.response?.data || error;
    }
  },

  /**
   * Get payment statistics
   * @returns {Promise} Payment statistics
   */
  getStats: async () => {
    try {
      const response = await api.get('/payments/stats');
      return response.data;
    } catch (error) {
      console.error('Error fetching payment stats:', error);
      throw error.response?.data || error;
    }
  },

  /**
   * Format payments for display in the table
   * @param {Array} payments - Raw payments from API
   * @returns {Array} Formatted payments
   */
  formatPaymentsForDisplay: (payments) => {
    if (!payments || !Array.isArray(payments)) {
      console.warn('[paymentService] formatPaymentsForDisplay received invalid input:', payments);
      return [];
    }

    console.log(`[paymentService] Formatting ${payments.length} payments for display`);

    return payments.map(payment => {
      if (!payment) {
        console.warn('[paymentService] Found null/undefined payment in array');
        return null;
      }

      // Backend uses 'paymentType' not 'type'
      const paymentType = payment.paymentType || 'sales';

      // Get related order number with proper fallback logic
      let relatedOrderNumber = payment.relatedOrderNumber;

      // Fallback for payments that don't have cached relatedOrderNumber
      if (!relatedOrderNumber) {
        if (paymentType === 'purchase') {
          // For purchase payments, try to get from populated purchaseOrder
          relatedOrderNumber = payment.purchaseOrder?.poNumber ||
            payment.purchaseOrder?.purchaseOrderNumber ||
            'N/A';
        } else {
          // For sales payments, try to get from populated order
          relatedOrderNumber = payment.order?.orderNumber || 'N/A';
        }
      }

      const formatted = {
        id: payment.id || payment._id,
        paymentNumber: payment.paymentNumber || 'N/A',
        type: paymentType, // 'sales' or 'purchase'
        relatedOrderNumber: relatedOrderNumber,
        relatedOrderId: payment.relatedOrderId,
        amount: payment.amount || 0,
        paymentMethod: payment.paymentMethod || 'cash', // cash, card, bank_transfer, e_wallet, check, credit
        date: payment.paymentDate || payment.createdAt,
        status: payment.status || 'pending', // pending, completed, failed, refunded, cancelled
        receivedBy: payment.receivedBy?.username || 'N/A',
        receivedById: payment.receivedBy?.id || payment.receivedBy?._id,
        customer: payment.customer?.fullName || payment.customer?.customerCode || null,
        supplier: payment.supplier?.companyName || payment.supplier?.supplierCode || null,
        reference: payment.reference || '',
        notes: payment.notes || '',
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt
      };

      console.log('[paymentService] Formatted payment:', {
        id: formatted.id,
        paymentNumber: formatted.paymentNumber,
        type: formatted.type,
        relatedOrderNumber: formatted.relatedOrderNumber,
        hasRelatedOrderNumber: !!payment.relatedOrderNumber
      });

      return formatted;
    }).filter(payment => payment !== null);
  }
};

export default paymentService;
