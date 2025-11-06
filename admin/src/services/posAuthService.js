import api from './api';

const posAuthService = {
  /**
   * Login with employee code and PIN
   * @param {string} employeeCode - Employee code (e.g., USER2025000001)
   * @param {string} pin - 4-6 digit PIN
   * @returns {Promise} Response with token and employee info
   */
  login: async (employeeCode, pin) => {
    try {
      const response = await api.post('/pos-login', {
        employeeCode,
        pin
      });

      if (response.data.success) {
        // Store token and employee info
        localStorage.setItem('posToken', response.data.data.token);
        localStorage.setItem('posEmployee', JSON.stringify(response.data.data.employee));
      }

      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Login failed' };
    }
  },

  /**
   * Verify current POS session
   * @returns {Promise} Response with session status
   */
  verify: async () => {
    try {
      const token = localStorage.getItem('posToken');
      if (!token) {
        throw new Error('No token found');
      }

      const response = await api.post('/pos-login/verify', {}, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      return response.data;
    } catch (error) {
      // Clear invalid token
      localStorage.removeItem('posToken');
      localStorage.removeItem('posEmployee');
      throw error.response?.data || { message: 'Session verification failed' };
    }
  },

  /**
   * Change PIN
   * @param {string} oldPin - Current PIN
   * @param {string} newPin - New PIN (4-6 digits)
   * @param {string} confirmPin - Confirm new PIN
   * @returns {Promise} Response
   */
  changePin: async (oldPin, newPin, confirmPin) => {
    try {
      const token = localStorage.getItem('posToken');
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await api.post('/pos-login/change-pin', {
        oldPin,
        newPin,
        confirmPin
      }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to change PIN' };
    }
  },

  /**
   * Logout from POS
   * @returns {Promise} Response
   */
  logout: async () => {
    try {
      const token = localStorage.getItem('posToken');
      if (token) {
        await api.post('/pos-login/logout', {}, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Always clear local storage
      localStorage.removeItem('posToken');
      localStorage.removeItem('posEmployee');
    }
  },

  /**
   * Get POS auth status
   * @returns {Promise} Response with auth status details
   */
  getStatus: async () => {
    try {
      const token = localStorage.getItem('posToken');
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await api.get('/pos-login/status', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to get status' };
    }
  },

  /**
   * Check if user is authenticated for POS
   * @returns {boolean}
   */
  isAuthenticated: () => {
    const token = localStorage.getItem('posToken');
    const employee = localStorage.getItem('posEmployee');
    return !!(token && employee);
  },

  /**
   * Get current employee info
   * @returns {object|null}
   */
  getCurrentEmployee: () => {
    const employee = localStorage.getItem('posEmployee');
    return employee ? JSON.parse(employee) : null;
  }
};

export default posAuthService;
