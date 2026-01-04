import api from './api';

/**
 * Stock Out Order Service
 * Uses shared api instance (baseURL = '/api')
 * Handles all API calls for stock out order management
 */

const API_PATH = '/stock-out-orders';

/**
 * Get all stock out orders with optional filtering
 * @param {Object} filters - Filter parameters
 * @returns {Promise<Array>} List of stock out orders
 */
export const getAllStockOutOrders = async (filters = {}) => {
  try {
    const params = new URLSearchParams();

    if (filters.status) params.append('status', filters.status);
    if (filters.reason) params.append('reason', filters.reason);
    if (filters.search) params.append('search', filters.search);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);

    const queryString = params.toString();
    const url = queryString ? `${API_PATH}?${queryString}` : API_PATH;

    const response = await api.get(url);
    return response.data;
  } catch (error) {
    console.error('Error fetching stock out orders:', error);
    throw error;
  }
};

/**
 * Get single stock out order by ID
 * @param {string} id - Stock out order ID
 * @returns {Promise<Object>} Stock out order details
 */
export const getStockOutOrderById = async (id) => {
  try {
    const response = await api.get(`${API_PATH}/${id}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching stock out order ${id}:`, error);
    throw error;
  }
};

/**
 * Create new stock out order
 * @param {Object} orderData - Stock out order data
 * @returns {Promise<Object>} Created stock out order
 */
export const createStockOutOrder = async (orderData) => {
  try {
    const response = await api.post(API_PATH, orderData);
    return response.data;
  } catch (error) {
    console.error('Error creating stock out order:', error);
    throw error;
  }
};

/**
 * Update stock out order
 * @param {string} id - Stock out order ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated stock out order
 */
export const updateStockOutOrder = async (id, updates) => {
  try {
    const response = await api.put(`${API_PATH}/${id}`, updates);
    return response.data;
  } catch (error) {
    console.error(`Error updating stock out order ${id}:`, error);
    throw error;
  }
};

/**
 * Delete stock out order
 * @param {string} id - Stock out order ID
 * @returns {Promise<Object>} Deletion confirmation
 */
export const deleteStockOutOrder = async (id) => {
  try {
    const response = await api.delete(`${API_PATH}/${id}`);
    return response.data;
  } catch (error) {
    console.error(`Error deleting stock out order ${id}:`, error);
    throw error;
  }
};

/**
 * Update stock out order status
 * @param {string} id - Stock out order ID
 * @param {string} status - New status
 * @returns {Promise<Object>} Updated stock out order
 */
export const updateStockOutOrderStatus = async (id, status) => {
  try {
    const response = await api.put(`${API_PATH}/${id}/status`, { status });
    return response.data;
  } catch (error) {
    console.error(`Error updating stock out order status ${id}:`, error);
    throw error;
  }
};

/**
 * Create draft stock out order
 * @param {Object} orderData - Basic order data
 * @returns {Promise<Object>} Created draft order
 */
export const createDraftStockOutOrder = async (orderData) => {
  try {
    const draftData = {
      ...orderData,
      status: 'draft'
    };
    return await createStockOutOrder(draftData);
  } catch (error) {
    console.error('Error creating draft stock out order:', error);
    throw error;
  }
};

/**
 * Submit stock out order (draft → pending)
 * @param {string} id - Stock out order ID
 * @returns {Promise<Object>} Updated stock out order
 */
export const submitStockOutOrder = async (id) => {
  try {
    return await updateStockOutOrderStatus(id, 'pending');
  } catch (error) {
    console.error(`Error submitting stock out order ${id}:`, error);
    throw error;
  }
};

/**
 * Approve stock out order (pending → approved)
 * @param {string} id - Stock out order ID
 * @returns {Promise<Object>} Updated stock out order
 */
export const approveStockOutOrder = async (id) => {
  try {
    return await updateStockOutOrderStatus(id, 'approved');
  } catch (error) {
    console.error(`Error approving stock out order ${id}:`, error);
    throw error;
  }
};

/**
 * Complete stock out order (approved → completed)
 * @param {string} id - Stock out order ID
 * @returns {Promise<Object>} Updated stock out order
 */
export const completeStockOutOrder = async (id) => {
  try {
    return await updateStockOutOrderStatus(id, 'completed');
  } catch (error) {
    console.error(`Error completing stock out order ${id}:`, error);
    throw error;
  }
};

/**
 * Cancel stock out order
 * @param {string} id - Stock out order ID
 * @returns {Promise<Object>} Updated stock out order
 */
export const cancelStockOutOrder = async (id) => {
  try {
    return await updateStockOutOrderStatus(id, 'cancelled');
  } catch (error) {
    console.error(`Error cancelling stock out order ${id}:`, error);
    throw error;
  }
};

/**
 * Get stock out orders by status
 * @param {string} status - Order status
 * @returns {Promise<Array>} Filtered orders
 */
export const getStockOutOrdersByStatus = async (status) => {
  try {
    return await getAllStockOutOrders({ status });
  } catch (error) {
    console.error(`Error fetching stock out orders with status ${status}:`, error);
    throw error;
  }
};

/**
 * Get stock out orders by reason
 * @param {string} reason - Order reason
 * @returns {Promise<Array>} Filtered orders
 */
export const getStockOutOrdersByReason = async (reason) => {
  try {
    return await getAllStockOutOrders({ reason });
  } catch (error) {
    console.error(`Error fetching stock out orders with reason ${reason}:`, error);
    throw error;
  }
};

/**
 * Get stock out orders by date range
 * @param {string} startDate - Start date (ISO string)
 * @param {string} endDate - End date (ISO string)
 * @returns {Promise<Array>} Filtered orders
 */
export const getStockOutOrdersByDateRange = async (startDate, endDate) => {
  try {
    return await getAllStockOutOrders({ startDate, endDate });
  } catch (error) {
    console.error('Error fetching stock out orders by date range:', error);
    throw error;
  }
};

/**
 * Search stock out orders
 * @param {string} searchTerm - Search term
 * @returns {Promise<Array>} Search results
 */
export const searchStockOutOrders = async (searchTerm) => {
  try {
    return await getAllStockOutOrders({ search: searchTerm });
  } catch (error) {
    console.error('Error searching stock out orders:', error);
    throw error;
  }
};

export default {
  getAllStockOutOrders,
  getStockOutOrderById,
  createStockOutOrder,
  updateStockOutOrder,
  deleteStockOutOrder,
  updateStockOutOrderStatus,
  createDraftStockOutOrder,
  submitStockOutOrder,
  approveStockOutOrder,
  completeStockOutOrder,
  cancelStockOutOrder,
  getStockOutOrdersByStatus,
  getStockOutOrdersByReason,
  getStockOutOrdersByDateRange,
  searchStockOutOrders
};
