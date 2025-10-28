import api from './api'

/**
 * Purchase Order Service
 * Handles all purchase order-related API calls
 */
const purchaseOrderService = {
  /**
   * Get all purchase orders with pagination and filters
   * @param {Object} params - Query parameters
   * @returns {Promise} Purchase order list
   */
  getPurchaseOrders: async (params = {}) => {
    try {
      console.log('[purchaseOrderService] Fetching purchase orders with params:', params);
      const response = await api.get('/purchase-orders', { params })
      console.log('[purchaseOrderService] Response status:', response.status);
      console.log('[purchaseOrderService] Response data:', response.data);
      return response.data
    } catch (error) {
      console.error('[purchaseOrderService] Error fetching purchase orders:', error)
      console.error('[purchaseOrderService] Error response:', error.response)
      throw error.response?.data || error
    }
  },

  /**
   * Get single purchase order by ID
   * @param {string} id - Purchase Order ID
   * @returns {Promise} Purchase order details
   */
  getPurchaseOrderById: async (id) => {
    try {
      const response = await api.get(`/purchase-orders/${id}`)
      return response.data
    } catch (error) {
      console.error(`Error fetching purchase order ${id}:`, error)
      throw error.response?.data || error
    }
  },

  /**
   * Create new purchase order
   * @param {Object} data - Purchase order data
   * @returns {Promise} Created purchase order
   */
  createPurchaseOrder: async (data) => {
    try {
      console.log('[purchaseOrderService] Sending request:', data);
      const response = await api.post('/purchase-orders', data)
      console.log('[purchaseOrderService] Response status:', response.status);
      console.log('[purchaseOrderService] Response data:', response.data);
      return response.data
    } catch (error) {
      console.error('[purchaseOrderService] Error:', error);
      console.error('[purchaseOrderService] Error response:', error.response);
      console.error('[purchaseOrderService] Error response data:', error.response?.data);
      throw error.response?.data || error
    }
  },

  /**
   * Update purchase order
   * @param {string} id - Purchase Order ID
   * @param {Object} data - Updated data
   * @returns {Promise} Updated purchase order
   */
  updatePurchaseOrder: async (id, data) => {
    try {
      const response = await api.put(`/purchase-orders/${id}`, data)
      return response.data
    } catch (error) {
      console.error(`Error updating purchase order ${id}:`, error)
      throw error.response?.data || error
    }
  },

  /**
   * Update purchase order status
   * @param {string} id - Purchase Order ID
   * @param {string} status - New status (pending, approved, received, cancelled)
   * @param {string} notes - Optional notes
   * @returns {Promise} Updated purchase order
   */
  updatePurchaseOrderStatus: async (id, status, notes = null) => {
    try {
      console.log(`[purchaseOrderService] Updating PO ${id} status to ${status}`);
      const payload = { status };
      if (notes) {
        payload.notes = notes;
      }
      const response = await api.patch(`/purchase-orders/${id}/status`, payload)
      console.log('[purchaseOrderService] Status update response:', response.data);
      return response.data
    } catch (error) {
      console.error(`Error updating purchase order ${id} status:`, error)
      throw error.response?.data || error
    }
  },

  /**
   * Approve purchase order
   * @param {string} id - Purchase Order ID
   * @returns {Promise} Approved purchase order
   */
  approvePurchaseOrder: async (id) => {
    try {
      const response = await api.post(`/purchase-orders/${id}/approve`)
      return response.data
    } catch (error) {
      console.error(`Error approving purchase order ${id}:`, error)
      throw error.response?.data || error
    }
  },

  /**
   * Cancel purchase order
   * @param {string} id - Purchase Order ID
   * @returns {Promise} Cancelled purchase order
   */
  cancelPurchaseOrder: async (id) => {
    try {
      const response = await api.post(`/purchase-orders/${id}/cancel`)
      return response.data
    } catch (error) {
      console.error(`Error cancelling purchase order ${id}:`, error)
      throw error.response?.data || error
    }
  },

  /**
   * Delete purchase order
   * @param {string} id - Purchase Order ID
   * @returns {Promise} Deleted purchase order
   */
  deletePurchaseOrder: async (id) => {
    try {
      const response = await api.delete(`/purchase-orders/${id}`)
      return response.data
    } catch (error) {
      console.error(`Error deleting purchase order ${id}:`, error)
      throw error.response?.data || error
    }
  },

  /**
   * Format purchase orders for display in the table
   * @param {Array} purchaseOrders - Raw purchase orders from API
   * @returns {Array} Formatted purchase orders
   */
  formatPurchaseOrdersForDisplay: (purchaseOrders) => {
    if (!purchaseOrders || !Array.isArray(purchaseOrders)) {
      console.warn('formatPurchaseOrdersForDisplay received invalid input:', purchaseOrders);
      return [];
    }

    return purchaseOrders.map(po => {
      if (!po) {
        console.warn('Found null/undefined purchase order in array');
        return null;
      }

      return {
        id: po.id || po._id,
        poNumber: po.poNumber || 'N/A',
        supplierName: po.supplier?.companyName || 'N/A',
        supplierCode: po.supplier?.supplierCode || '',
        supplierId: po.supplier?.id || po.supplier?._id,
        orderDate: po.orderDate,
        expectedDeliveryDate: po.expectedDeliveryDate,
        status: po.status || 'pending',
        paymentStatus: po.paymentStatus || 'unpaid',
        subtotal: po.subtotal || 0,
        tax: po.tax || 0,
        shippingFee: po.shippingFee || 0,
        discount: po.discount || 0,
        total: po.total || 0,
        paidAmount: po.paidAmount || 0,
        itemCount: po.items?.length || 0,
        items: po.items || [],
        createdBy: po.createdBy?.username || 'N/A',
        createdAt: po.createdAt,
        updatedAt: po.updatedAt,
        notes: po.notes || ''
      };
    }).filter(po => po !== null);
  }
}

export default purchaseOrderService

