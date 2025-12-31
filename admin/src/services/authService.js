import api from './api'

const authService = {
  // Login
  login: async (username, password) => {
    try {
      const response = await api.post('/login', { username, password })

      if (response.data.success) {
        const { token, user } = response.data.data
        localStorage.setItem('adminToken', token)
        localStorage.setItem('adminUser', JSON.stringify(user))
        return { success: true, user, token }
      }

      return { success: false, error: 'Login failed' }
    } catch (error) {
      // Re-throw error for component to handle
      throw error
    }
  },

  // Register
  register: async (userData) => {
    try {
      const { fullName, username, email, password } = userData
      const response = await api.post('/login/register', {
        username,
        email,
        fullName,
        password
      })

      if (response.data.success) {
        return { success: true, message: response.data.message }
      }

      return { success: false, error: 'Registration failed' }
    } catch (error) {
      // Re-throw error for component to handle
      throw error
    }
  },

  // Logout
  logout: async () => {
    try {
      await api.post('/login/logout')
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      localStorage.removeItem('adminToken')
      localStorage.removeItem('adminUser')
    }
  },

  // Get current user
  getCurrentUser: async () => {
    const response = await api.get('/login/me')
    return response.data.data.user
  },

  // Check if user is logged in
  isAuthenticated: () => {
    return !!localStorage.getItem('adminToken')
  },

  // Get stored token
  getToken: () => {
    return localStorage.getItem('adminToken')
  },

  // Get stored user data
  getUser: () => {
    const user = localStorage.getItem('adminUser')
    return user ? JSON.parse(user) : null
  },

  // Check if user has specific permission
  hasPermission: (permission) => {
    const user = authService.getUser()
    if (!user || !user.role) return false

    const permissions = user.role.permissions || []
    // Check for super admin permission (bypass all checks)
    if (permissions.includes('all')) return true

    return permissions.includes(permission)
  }
}

export default authService