import api from './api'

const userAccountService = {
  // Get all user accounts with filters
  getAllUserAccounts: async (filters = {}) => {
    try {
      const params = {}

      if (filters.isActive !== undefined) {
        params.is_active = filters.isActive
      }
      if (filters.roleId) {
        params.role_id = filters.roleId
      }
      if (filters.search) {
        params.search = filters.search
      }
      if (filters.limit) {
        params.limit = filters.limit
      }

      const response = await api.get('/user-accounts', { params })
      return {
        success: true,
        data: response.data.data.userAccounts
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to fetch user accounts'
      }
    }
  },

  // Get user account statistics
  getStatistics: async () => {
    try {
      const response = await api.get('/user-accounts/stats/overview')
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

  // Get active user accounts
  getActiveUsers: async () => {
    try {
      const response = await api.get('/user-accounts/active')
      return {
        success: true,
        data: response.data.data.activeUsers
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to fetch active users'
      }
    }
  },

  // Get current user profile
  getCurrentUserProfile: async () => {
    try {
      const response = await api.get('/user-accounts/me')
      return {
        success: true,
        data: response.data.data.user
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to fetch user profile'
      }
    }
  },

  // Get user by username
  getUserByUsername: async (username) => {
    try {
      const response = await api.get(`/user-accounts/username/${username}`)
      return {
        success: true,
        data: response.data.data.user
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to fetch user'
      }
    }
  },

  // Get single user account by ID
  getUserAccountById: async (id) => {
    try {
      const response = await api.get(`/user-accounts/${id}`)
      return {
        success: true,
        data: response.data.data.user
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to fetch user account'
      }
    }
  },

  // Register new user account
  registerUser: async (userData) => {
    try {
      const { username, email, password, roleId } = userData
      const response = await api.post('/user-accounts/register', {
        username,
        email,
        password,
        roleId
      })

      return {
        success: true,
        data: response.data.data.user,
        message: response.data.message
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to create user account'
      }
    }
  },

  // Login user
  login: async (identifier, password) => {
    try {
      const response = await api.post('/user-accounts/login', {
        identifier,
        password
      })

      if (response.data.success) {
        const { token, user } = response.data.data
        localStorage.setItem('adminToken', token)
        localStorage.setItem('adminUser', JSON.stringify(user))
        return {
          success: true,
          data: { user, token },
          message: response.data.message
        }
      }

      return {
        success: false,
        error: 'Login failed'
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Login failed'
      }
    }
  },

  // Logout user
  logout: async () => {
    try {
      await api.post('/user-accounts/logout')
      localStorage.removeItem('adminToken')
      localStorage.removeItem('adminUser')
      return {
        success: true,
        message: 'Logout successful'
      }
    } catch (error) {
      // Clean up local storage even if API call fails
      localStorage.removeItem('adminToken')
      localStorage.removeItem('adminUser')
      return {
        success: false,
        error: error.response?.data?.error || 'Logout failed'
      }
    }
  },

  // Logout from all devices
  logoutAll: async () => {
    try {
      await api.post('/user-accounts/logout-all')
      localStorage.removeItem('adminToken')
      localStorage.removeItem('adminUser')
      return {
        success: true,
        message: 'Logged out from all devices successfully'
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Logout failed'
      }
    }
  },

  // Update user account
  updateUserAccount: async (id, userData) => {
    try {
      const { username, email, roleId } = userData
      const response = await api.put(`/user-accounts/${id}`, {
        username,
        email,
        roleId
      })

      return {
        success: true,
        data: response.data.data.user,
        message: response.data.message
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to update user account'
      }
    }
  },

  // Change password
  changePassword: async (id, passwordData) => {
    try {
      const { currentPassword, newPassword } = passwordData
      const response = await api.patch(`/user-accounts/${id}/change-password`, {
        currentPassword,
        newPassword
      })

      return {
        success: true,
        message: response.data.message
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to change password'
      }
    }
  },

  // Deactivate user account
  deactivateUserAccount: async (id) => {
    try {
      const response = await api.patch(`/user-accounts/${id}/deactivate`)
      return {
        success: true,
        data: response.data.data.user,
        message: response.data.message
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to deactivate user account'
      }
    }
  },

  // Activate user account
  activateUserAccount: async (id) => {
    try {
      const response = await api.patch(`/user-accounts/${id}/activate`)
      return {
        success: true,
        data: response.data.data.user,
        message: response.data.message
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to activate user account'
      }
    }
  },

  // Delete user account
  deleteUserAccount: async (id) => {
    try {
      const response = await api.delete(`/user-accounts/${id}`)
      return {
        success: true,
        message: response.data.message
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to delete user account'
      }
    }
  },

  // Check if user is authenticated
  isAuthenticated: () => {
    return !!localStorage.getItem('adminToken')
  },

  // Get stored user data
  getStoredUser: () => {
    const user = localStorage.getItem('adminUser')
    return user ? JSON.parse(user) : null
  }
}

export default userAccountService
