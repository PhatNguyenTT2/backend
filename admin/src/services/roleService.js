import api from './api'

const roleService = {
  // Get all roles
  getAllRoles: async (includeUserCount = false) => {
    try {
      const params = {}
      if (includeUserCount) {
        params.include_user_count = 'true'
      }

      const response = await api.get('/roles', { params })
      return {
        success: true,
        data: response.data.data.roles
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to fetch roles'
      }
    }
  },

  // Get roles for registration dropdown (only basic roles)
  getRegistrationRoles: async () => {
    try {
      const response = await api.get('/roles')
      const roles = response.data.data.roles

      // Filter to show only Admin, Manager, and Staff for registration
      const registrationRoles = roles.filter(role =>
        ['Admin', 'Manager', 'Staff'].includes(role.roleName)
      )

      return {
        success: true,
        data: registrationRoles
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to fetch roles'
      }
    }
  },

  // Get role statistics
  getStatistics: async () => {
    try {
      const response = await api.get('/roles/stats/overview')
      return {
        success: true,
        data: response.data.data.statistics
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to fetch statistics'
      }
    }
  },

  // Get role by code
  getRoleByCode: async (roleCode) => {
    try {
      const response = await api.get(`/roles/code/${roleCode}`)
      return {
        success: true,
        data: response.data.data.role
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to fetch role'
      }
    }
  },

  // Get single role by ID
  getRoleById: async (id) => {
    try {
      const response = await api.get(`/roles/${id}`)
      return {
        success: true,
        data: response.data.data.role
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to fetch role'
      }
    }
  },

  // Create new role (Admin only)
  createRole: async (roleData) => {
    try {
      const { roleName, description, permissions } = roleData
      const response = await api.post('/roles', {
        roleName,
        description,
        permissions
      })

      return {
        success: true,
        data: response.data.data.role,
        message: response.data.message
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to create role'
      }
    }
  },

  // Update role (Admin only)
  updateRole: async (id, roleData) => {
    try {
      const { roleName, description, permissions } = roleData
      const response = await api.put(`/roles/${id}`, {
        roleName,
        description,
        permissions
      })

      return {
        success: true,
        data: response.data.data.role,
        message: response.data.message
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to update role'
      }
    }
  },

  // Add permission to role (Admin only)
  addPermission: async (id, permission) => {
    try {
      const response = await api.patch(`/roles/${id}/add-permission`, {
        permission
      })

      return {
        success: true,
        data: response.data.data.role,
        message: response.data.message
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to add permission'
      }
    }
  },

  // Remove permission from role (Admin only)
  removePermission: async (id, permission) => {
    try {
      const response = await api.patch(`/roles/${id}/remove-permission`, {
        permission
      })

      return {
        success: true,
        data: response.data.data.role,
        message: response.data.message
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to remove permission'
      }
    }
  },

  // Delete role (Admin only)
  deleteRole: async (id) => {
    try {
      const response = await api.delete(`/roles/${id}`)
      return {
        success: true,
        message: response.data.message
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to delete role'
      }
    }
  }
}

export default roleService
