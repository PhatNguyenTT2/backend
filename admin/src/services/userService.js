import api from './api'

/**
 * User Service
 * Handles all user-related API calls
 */
const userService = {
  /**
   * Get all users with pagination and filters
   * @param {Object} params - Query parameters (page, per_page, role, department, is_active)
   * @returns {Promise} User list with pagination
   */
  getUsers: async (params = {}) => {
    try {
      const response = await api.get('/users', { params })
      return response.data
    } catch (error) {
      console.error('Error fetching users:', error)
      throw error.response?.data || error
    }
  },

  /**
   * Get single user by ID
   * @param {string} id - User ID
   * @returns {Promise} User details
   */
  getUserById: async (id) => {
    try {
      const response = await api.get(`/users/${id}`)
      return response.data
    } catch (error) {
      console.error(`Error fetching user ${id}:`, error)
      throw error.response?.data || error
    }
  },

  /**
   * Create new user (Admin only)
   * @param {Object} userData - User data
   * @returns {Promise} Created user
   */
  createUser: async (userData) => {
    try {
      const response = await api.post('/users', userData)
      return response.data
    } catch (error) {
      console.error('Error creating user:', error)
      throw error.response?.data || error
    }
  },

  /**
   * Update user
   * @param {string} id - User ID
   * @param {Object} updates - Updated fields
   * @returns {Promise} Updated user
   */
  updateUser: async (id, updates) => {
    try {
      const response = await api.put(`/users/${id}`, updates)
      return response.data
    } catch (error) {
      console.error(`Error updating user ${id}:`, error)
      throw error.response?.data || error
    }
  },

  /**
   * Update user active status
   * @param {string} id - User ID
   * @param {boolean} isActive - Active status
   * @returns {Promise} Updated user
   */
  updateActiveStatus: async (id, isActive) => {
    try {
      const response = await api.patch(`/users/${id}/status`, { isActive })
      return response.data
    } catch (error) {
      console.error(`Error updating user ${id} active status:`, error)
      throw error.response?.data || error
    }
  },

  /**
   * Delete user (Admin only)
   * @param {string} id - User ID
   * @returns {Promise} Delete confirmation
   */
  deleteUser: async (id) => {
    try {
      const response = await api.delete(`/users/${id}`)
      return response.data
    } catch (error) {
      console.error(`Error deleting user ${id}:`, error)
      throw error.response?.data || error
    }
  },

  /**
   * Reset user password (Admin only)
   * @param {string} id - User ID
   * @param {string} newPassword - New password
   * @returns {Promise} Reset confirmation
   */
  resetPassword: async (id, newPassword) => {
    try {
      const response = await api.post(`/users/${id}/reset-password`, { newPassword })
      return response.data
    } catch (error) {
      console.error(`Error resetting password for user ${id}:`, error)
      throw error.response?.data || error
    }
  },

  /**
   * Format users data for display in the table
   * @param {Array} users - Raw users from API
   * @returns {Array} Formatted users
   */
  formatUsersForDisplay: (users) => {
    return users.map(user => ({
      id: user.id || user._id,
      userCode: user.userCode,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      roleName: user.role?.roleName || 'N/A',
      roleId: user.role?.roleId || null,
      departmentName: user.department?.departmentName || 'N/A',
      departmentId: user.department?.departmentId || null,
      isActive: user.isActive,
      lastLogin: user.lastLogin || null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    }))
  }
}

export default userService
