import axios from 'axios'

// Use relative URL - works with Vite proxy in dev, same origin in production
const baseURL = import.meta.env.VITE_API_URL || '/api'

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Add token to requests if it exists
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('adminToken')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Handle response errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.log('Interceptor caught error:', error.response?.status, error.config?.url);

    if (error.response?.status === 401) {
      // Don't redirect if it's a login attempt (allow login errors to be handled by the component)
      const url = error.config?.url || ''
      const isLoginRequest = url.includes('/pos-login') || url.includes('/login')

      console.log('401 error - URL:', url, 'isLoginRequest:', isLoginRequest);

      if (!isLoginRequest) {
        // Token invalid or expired for authenticated requests
        console.log('Not a login request, redirecting to /');
        localStorage.removeItem('adminToken')
        localStorage.removeItem('adminUser')
        localStorage.removeItem('posToken')
        localStorage.removeItem('posEmployee')
        window.location.href = '/'
      } else {
        console.log('Login request, allowing error to propagate');
      }
    }
    return Promise.reject(error)
  }
)

export default api
