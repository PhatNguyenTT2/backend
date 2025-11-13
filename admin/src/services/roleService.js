import api from './api'

/**
 * Role Service
 * Handles all API calls related to roles
 */
const roleService = {
  /**
   * Get all roles with optional filters
   * @param {Object} params - Query parameters
   * @param {string} params.code - Filter by role code (e.g., ROLE001)
   * @param {string} params.search - Search by role name or description
   * @param {boolean} params.withEmployees - Include employee count
   * @returns {Promise<Object>} Response with roles array and count
   */
  getAllRoles: async (params = {}) => {
    try {
      const response = await api.get('/roles', { params })
      return response.data
    } catch (error) {
      console.error('Error fetching roles:', error)
      throw error
    }
  },

  /**
   * Get role by ID
   * @param {string} roleId - Role ID
   * @param {boolean} withEmployees - Include employee count
   * @returns {Promise<Object>} Role data
   */
  getRoleById: async (roleId, withEmployees = false) => {
    try {
      const params = withEmployees ? { withEmployees: true } : {}
      const response = await api.get(`/roles/${roleId}`, { params })
      return response.data
    } catch (error) {
      console.error('Error fetching role:', error)
      throw error
    }
  },

  /**
   * Create new role
   * @param {Object} roleData - Role data
   * @param {string} roleData.roleName - Role name (required)
   * @param {string} roleData.description - Role description (optional)
   * @param {Array<string>} roleData.permissions - Array of permissions (optional)
   * @returns {Promise<Object>} Created role data
   */
  createRole: async (roleData) => {
    try {
      const response = await api.post('/roles', roleData)
      return response.data
    } catch (error) {
      console.error('Error creating role:', error)
      throw error
    }
  },

  /**
   * Update role
   * @param {string} roleId - Role ID
   * @param {Object} roleData - Updated role data
   * @param {string} roleData.roleName - Role name (optional)
   * @param {string} roleData.description - Role description (optional)
   * @param {Array<string>} roleData.permissions - Array of permissions (optional)
   * @returns {Promise<Object>} Updated role data
   */
  updateRole: async (roleId, roleData) => {
    try {
      const response = await api.put(`/roles/${roleId}`, roleData)
      return response.data
    } catch (error) {
      console.error('Error updating role:', error)
      throw error
    }
  },

  /**
   * Delete role
   * @param {string} roleId - Role ID
   * @returns {Promise<Object>} Success message
   * @note Will fail if any users are currently assigned to this role
   */
  deleteRole: async (roleId) => {
    try {
      const response = await api.delete(`/roles/${roleId}`)
      return response.data
    } catch (error) {
      console.error('Error deleting role:', error)
      throw error
    }
  },

  /**
   * Search roles by name or description
   * @param {string} searchTerm - Search term
   * @returns {Promise<Object>} Search results
   */
  searchRoles: async (searchTerm) => {
    try {
      const response = await api.get('/roles', {
        params: { search: searchTerm }
      })
      return response.data
    } catch (error) {
      console.error('Error searching roles:', error)
      throw error
    }
  },

  /**
   * Get role by code
   * @param {string} roleCode - Role code (e.g., ROLE001)
   * @returns {Promise<Object>} Role data
   */
  getRoleByCode: async (roleCode) => {
    try {
      const response = await api.get('/roles', {
        params: { code: roleCode }
      })
      return response.data
    } catch (error) {
      console.error('Error fetching role by code:', error)
      throw error
    }
  },

  /**
   * Add permission to role
   * @param {string} roleId - Role ID
   * @param {string} permission - Permission to add
   * @returns {Promise<Object>} Updated role data
   */
  addPermission: async (roleId, permission) => {
    try {
      // Get current role
      const roleResponse = await api.get(`/roles/${roleId}`)
      const currentRole = roleResponse.data.data.role

      // Add new permission if not already exists
      const permissions = currentRole.permissions || []
      if (!permissions.includes(permission)) {
        permissions.push(permission)
      }

      // Update role with new permissions
      const response = await api.put(`/roles/${roleId}`, { permissions })
      return response.data
    } catch (error) {
      console.error('Error adding permission:', error)
      throw error
    }
  },

  /**
   * Remove permission from role
   * @param {string} roleId - Role ID
   * @param {string} permission - Permission to remove
   * @returns {Promise<Object>} Updated role data
   */
  removePermission: async (roleId, permission) => {
    try {
      // Get current role
      const roleResponse = await api.get(`/roles/${roleId}`)
      const currentRole = roleResponse.data.data.role

      // Remove permission
      const permissions = (currentRole.permissions || []).filter(p => p !== permission)

      // Update role with filtered permissions
      const response = await api.put(`/roles/${roleId}`, { permissions })
      return response.data
    } catch (error) {
      console.error('Error removing permission:', error)
      throw error
    }
  },

  /**
   * Update multiple permissions at once
   * @param {string} roleId - Role ID
   * @param {Array<string>} permissions - Array of permissions
   * @returns {Promise<Object>} Updated role data
   */
  updatePermissions: async (roleId, permissions) => {
    try {
      const response = await api.put(`/roles/${roleId}`, { permissions })
      return response.data
    } catch (error) {
      console.error('Error updating permissions:', error)
      throw error
    }
  }
}

export default roleService
