import api from './api';

const POS_TOKEN_KEY = 'posToken';
const POS_EMPLOYEE_KEY = 'posEmployee';

/**
 * POS Login Service
 * Handles authentication for Point of Sale system
 */
const posLoginService = {
  /**
   * Login to POS system
   * @param {string} employeeCode - Employee code (e.g., 'USER001')
   * @param {string} pin - 4-6 digit PIN
   * @returns {Promise<{success: boolean, data?: object, error?: object}>}
   */
  async login(employeeCode, pin) {
    try {
      const response = await api.post('/pos-login', {
        employeeCode: employeeCode.toUpperCase(),
        pin: pin
      });

      if (response.data.success) {
        // Store token and employee info
        this.setToken(response.data.data.token);
        this.setEmployee(response.data.data.employee);

        return {
          success: true,
          data: response.data.data
        };
      }

      return {
        success: false,
        error: response.data.error || 'Login failed'
      };
    } catch (error) {
      console.error('POS Login error:', error);

      // Handle API error responses
      if (error.response?.data?.error) {
        return {
          success: false,
          error: error.response.data.error
        };
      }

      // Handle specific HTTP status codes
      if (error.response?.status === 404) {
        return {
          success: false,
          error: {
            message: 'POS login service is unavailable. Please contact administrator.',
            code: 'SERVICE_UNAVAILABLE'
          }
        };
      }

      // Network or other errors
      return {
        success: false,
        error: {
          message: 'Network error. Please check your connection.',
          code: 'NETWORK_ERROR'
        }
      };
    }
  },

  /**
   * Logout from POS system
   * @returns {Promise<boolean>}
   */
  async logout() {
    try {
      const token = this.getToken();

      if (token) {
        // Call logout API
        await api.post('/pos-login/logout', {}, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
      }

      // Clear local storage regardless of API response
      this.clearSession();
      return true;
    } catch (error) {
      console.error('POS Logout error:', error);
      // Clear session even if API call fails
      this.clearSession();
      return true;
    }
  },

  /**
   * Verify current POS session
   * @returns {Promise<{success: boolean, data?: object, error?: object}>}
   */
  async verifySession() {
    try {
      const token = this.getToken();

      if (!token) {
        return {
          success: false,
          error: {
            message: 'No active session',
            code: 'NO_SESSION'
          }
        };
      }

      const response = await api.get('/pos-login/verify', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (response.data.success) {
        // Update employee info in storage
        this.setEmployee(response.data.data.employee);

        return {
          success: true,
          data: response.data.data
        };
      }

      // Invalid session - clear storage
      this.clearSession();

      return {
        success: false,
        error: response.data.error || 'Session verification failed'
      };
    } catch (error) {
      console.error('POS Verify error:', error);

      // Handle 401 Unauthorized - clear session
      if (error.response?.status === 401 || error.response?.status === 403) {
        this.clearSession();
      }

      if (error.response?.data?.error) {
        return {
          success: false,
          error: error.response.data.error
        };
      }

      return {
        success: false,
        error: {
          message: 'Failed to verify session',
          code: 'VERIFICATION_ERROR'
        }
      };
    }
  },

  /**
   * Store POS token in localStorage
   * @param {string} token
   */
  setToken(token) {
    localStorage.setItem(POS_TOKEN_KEY, token);
  },

  /**
   * Get POS token from localStorage
   * @returns {string|null}
   */
  getToken() {
    return localStorage.getItem(POS_TOKEN_KEY);
  },

  /**
   * Store employee info in localStorage
   * @param {object} employee
   */
  setEmployee(employee) {
    localStorage.setItem(POS_EMPLOYEE_KEY, JSON.stringify(employee));
  },

  /**
   * Get employee info from localStorage
   * @returns {object|null}
   */
  getEmployee() {
    const employee = localStorage.getItem(POS_EMPLOYEE_KEY);
    return employee ? JSON.parse(employee) : null;
  },

  /**
   * Clear POS session data from localStorage
   */
  clearSession() {
    localStorage.removeItem(POS_TOKEN_KEY);
    localStorage.removeItem(POS_EMPLOYEE_KEY);
  },

  /**
   * Check if user is logged in to POS
   * @returns {boolean}
   */
  isLoggedIn() {
    return !!this.getToken();
  },

  /**
   * Get current employee info
   * @returns {object|null}
   */
  getCurrentEmployee() {
    return this.getEmployee();
  },

  /**
   * Get authorization header for API calls
   * @returns {object}
   */
  getAuthHeader() {
    const token = this.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  },

  /**
   * Create order with payment in single atomic transaction
   * @param {object} orderData - Order data with payment method
   * @returns {Promise<{success: boolean, data?: object, error?: object}>}
   */
  async createOrderWithPayment(orderData) {
    try {
      const token = this.getToken();

      if (!token) {
        return {
          success: false,
          error: {
            message: 'POS authentication required',
            code: 'NO_SESSION'
          }
        };
      }

      const response = await api.post('/pos-login/order-with-payment', orderData, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (response.data.success) {
        return {
          success: true,
          data: response.data.data
        };
      }

      return {
        success: false,
        error: response.data.error || 'Failed to create order with payment'
      };
    } catch (error) {
      console.error('POS Create Order+Payment error:', error);

      if (error.response?.data?.error) {
        return {
          success: false,
          error: error.response.data.error
        };
      }

      return {
        success: false,
        error: {
          message: 'Failed to create order with payment',
          code: 'SERVER_ERROR',
          details: error.message
        }
      };
    }
  },

  /**
   * Create order (existing method - kept for backward compatibility)
   * @param {object} orderData
   * @returns {Promise<{success: boolean, data?: object, error?: object}>}
   */
  async createOrder(orderData) {
    try {
      const token = this.getToken();

      if (!token) {
        return {
          success: false,
          error: {
            message: 'POS authentication required',
            code: 'NO_SESSION'
          }
        };
      }

      const response = await api.post('/pos-login/order', orderData, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (response.data.success) {
        return {
          success: true,
          data: response.data.order
        };
      }

      return {
        success: false,
        error: response.data.error || 'Failed to create order'
      };
    } catch (error) {
      console.error('POS Create Order error:', error);

      if (error.response?.data?.error) {
        return {
          success: false,
          error: error.response.data.error
        };
      }

      return {
        success: false,
        error: {
          message: 'Failed to create order',
          code: 'SERVER_ERROR',
          details: error.message
        }
      };
    }
  },

  /**
   * Create payment for existing order (held order)
   * @param {string} orderId - Order ID
   * @param {string} paymentMethod - Payment method (cash/card/bank_transfer)
   * @param {string} notes - Optional payment notes
   * @returns {Promise<{success: boolean, data?: object, error?: object}>}
   */
  async createPaymentForOrder(orderId, paymentMethod, notes = '') {
    try {
      const token = this.getToken();

      if (!token) {
        return {
          success: false,
          error: {
            message: 'POS authentication required',
            code: 'NO_SESSION'
          }
        };
      }

      const response = await api.post('/pos-login/payment', {
        orderId,
        paymentMethod,
        notes
      }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (response.data.success) {
        return {
          success: true,
          data: response.data.data
        };
      }

      return {
        success: false,
        error: response.data.error || 'Failed to create payment'
      };
    } catch (error) {
      console.error('POS Create Payment error:', error);

      if (error.response?.data?.error) {
        return {
          success: false,
          error: error.response.data.error
        };
      }

      return {
        success: false,
        error: {
          message: 'Failed to create payment',
          code: 'SERVER_ERROR',
          details: error.message
        }
      };
    }
  }
};

export default posLoginService;
