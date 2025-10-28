import api from './api';

/**
 * Role Service
 * Handles all role-related API calls
 */
const roleService = {
  /**
   * Get all roles with pagination and filters
   * @param {Object} params - Query parameters (page, per_page, is_active)
   * @returns {Promise} Role list with pagination
   */
  getRoles: async (params = {}) => {
    try {
      const response = await api.get('/roles', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching roles:', error);
      throw error.response?.data || error;
    }
  },

  /**
   * Get single role by ID
   * @param {string} id - Role ID
   * @returns {Promise} Role details
   */
  getRoleById: async (id) => {
    try {
      const response = await api.get(`/roles/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching role ${id}:`, error);
      throw error.response?.data || error;
    }
  },

  /**
   * Create new role (Admin only)
   * @param {Object} roleData - Role data
   * @returns {Promise} Created role
   */
  createRole: async (roleData) => {
    try {
      const response = await api.post('/roles', roleData);
      return response.data;
    } catch (error) {
      console.error('Error creating role:', error);
      throw error.response?.data || error;
    }
  },

  /**
   * Update role
   * @param {string} id - Role ID
   * @param {Object} updates - Updated fields
   * @returns {Promise} Updated role
   */
  updateRole: async (id, updates) => {
    try {
      const response = await api.put(`/roles/${id}`, updates);
      return response.data;
    } catch (error) {
      console.error(`Error updating role ${id}:`, error);
      throw error.response?.data || error;
    }
  },

  /**
   * Delete role (Admin only)
   * @param {string} id - Role ID
   * @returns {Promise} Delete confirmation
   */
  deleteRole: async (id) => {
    try {
      const response = await api.delete(`/roles/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Error deleting role ${id}:`, error);
      throw error.response?.data || error;
    }
  }
};

export default roleService;
