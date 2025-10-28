import api from './api'

const authService = {
  // Login
  login: async (username, password) => {
    const response = await api.post('/login', { username, password })

    if (response.data.success) {
      const { token, user } = response.data.data
      localStorage.setItem('adminToken', token)
      localStorage.setItem('adminUser', JSON.stringify(user))
      return { success: true, user, token }
    }

    return { success: false, error: 'Login failed' }
  },

  // Register
  register: async (userData) => {
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

  // Get stored user data
  getUser: () => {
    const user = localStorage.getItem('adminUser')
    return user ? JSON.parse(user) : null
  }
}

export default authService
