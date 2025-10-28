import api from './api';

/**
 * Department Service
 * Handles all department-related API calls
 */
const departmentService = {
  /**
   * Get all departments with pagination and filters
   * @param {Object} params - Query parameters (page, per_page, is_active)
   * @returns {Promise} Department list with pagination
   */
  getDepartments: async (params = {}) => {
    try {
      const response = await api.get('/departments', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching departments:', error);
      throw error.response?.data || error;
    }
  },

  /**
   * Get single department by ID
   * @param {string} id - Department ID
   * @returns {Promise} Department details
   */
  getDepartmentById: async (id) => {
    try {
      const response = await api.get(`/departments/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching department ${id}:`, error);
      throw error.response?.data || error;
    }
  },

  /**
   * Create new department (Admin only)
   * @param {Object} departmentData - Department data
   * @returns {Promise} Created department
   */
  createDepartment: async (departmentData) => {
    try {
      const response = await api.post('/departments', departmentData);
      return response.data;
    } catch (error) {
      console.error('Error creating department:', error);
      throw error.response?.data || error;
    }
  },

  /**
   * Update department
   * @param {string} id - Department ID
   * @param {Object} updates - Updated fields
   * @returns {Promise} Updated department
   */
  updateDepartment: async (id, updates) => {
    try {
      const response = await api.put(`/departments/${id}`, updates);
      return response.data;
    } catch (error) {
      console.error(`Error updating department ${id}:`, error);
      throw error.response?.data || error;
    }
  },

  /**
   * Delete department (Admin only)
   * @param {string} id - Department ID
   * @returns {Promise} Delete confirmation
   */
  deleteDepartment: async (id) => {
    try {
      const response = await api.delete(`/departments/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Error deleting department ${id}:`, error);
      throw error.response?.data || error;
    }
  }
};

export default departmentService;
