import api from './api'

const authService = {
  // Login - uses /api/user-accounts/login
  login: async (username, password) => {
    const response = await api.post('/user-accounts/login', {
      identifier: username,
      password
    })

    if (response.data.success) {
      const { token, user } = response.data.data
      localStorage.setItem('adminToken', token)
      localStorage.setItem('adminUser', JSON.stringify(user))
      return { success: true, user, token }
    }

    return { success: false, error: 'Login failed' }
  },

  // Register - uses /api/user-accounts/signup (public endpoint)
  register: async (userData) => {
    const { fullName, username, email, password } = userData
    const response = await api.post('/user-accounts/signup', {
      username,
      email,
      fullName,
      password
    })

    if (response.data.success) {
      return { success: true, message: response.data.message }
    }

    return { success: false, error: 'Registration failed' }
  },

  // Logout - uses /api/user-accounts/logout
  logout: async () => {
    try {
      await api.post('/user-accounts/logout')
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      localStorage.removeItem('adminToken')
      localStorage.removeItem('adminUser')
    }
  },

  // Get current user - uses /api/user-accounts/me
  getCurrentUser: async () => {
    const response = await api.get('/user-accounts/me')
    return response.data.data.user
  },

  // Check if user is logged in
  isAuthenticated: () => {
    return !!localStorage.getItem('adminToken')
  },

  // Get stored user data
  getUser: () => {
    const user = localStorage.getItem('adminUser')
    return user ? JSON.parse(user) : null
  }
}

export default authService
