import api from './api';

/**
 * Report Service
 * Handles all report-related API calls (simplified - no database storage)
 */
const reportService = {
  /**
   * Get sales report data (query directly from orders)
   * @param {Object} params - Query parameters (startDate, endDate, periodType)
   * @returns {Promise} Sales data with product breakdown
   */
  getSalesReport: async (params = {}) => {
    try {
      console.log('[reportService] Fetching sales report with params:', params);
      const response = await api.get('/reports/sales', { params });
      console.log('[reportService] Sales data:', response.data);
      return response.data;
    } catch (error) {
      console.error('[reportService] Error fetching sales report:', error);
      throw error.response?.data || error;
    }
  },

  /**
   * Get purchase report data
   * @param {Object} params - Query parameters
   * @returns {Promise} Purchase data
   */
  getPurchaseReport: async (params = {}) => {
    try {
      const response = await api.get('/reports/purchase', { params });
      return response.data;
    } catch (error) {
      console.error('[reportService] Error fetching purchase report:', error);
      throw error.response?.data || error;
    }
  },

  /**
   * Get inventory report data
   * @param {Object} params - Query parameters
   * @returns {Promise} Inventory data
   */
  getInventoryReport: async (params = {}) => {
    try {
      const response = await api.get('/reports/inventory', { params });
      return response.data;
    } catch (error) {
      console.error('[reportService] Error fetching inventory report:', error);
      throw error.response?.data || error;
    }
  },

  /**
   * Get profit report data
   * @param {Object} params - Query parameters
   * @returns {Promise} Profit data
   */
  getProfitReport: async (params = {}) => {
    try {
      const response = await api.get('/reports/profit', { params });
      return response.data;
    } catch (error) {
      console.error('[reportService] Error fetching profit report:', error);
      throw error.response?.data || error;
    }
  }
};

export default reportService;
