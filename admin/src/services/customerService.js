import api from './api'

/**
 * Customer Service
 * Handles all API calls related to customers
 */
const customerService = {
  /**
   * Get all customers with optional filters
   * @param {Object} params - Query parameters
   * @param {boolean} params.isActive - Filter by active status
   * @param {string} params.search - Search by name, email, phone, or customer code
   * @param {string} params.customerType - Filter by type (guest/retail/wholesale/vip)
   * @param {string} params.gender - Filter by gender (male/female/other)
   * @param {number} params.minSpent - Filter by minimum total spent
   * @param {number} params.maxSpent - Filter by maximum total spent
   * @param {boolean} params.hasEmail - Filter customers with/without email
   * @param {boolean} params.hasPhone - Filter customers with/without phone
   * @param {boolean} params.withOrders - Include order history
   * @param {string} params.sortBy - Sort field (default: createdAt)
   * @param {string} params.sortOrder - Sort order (asc/desc, default: desc)
   * @param {number} params.page - Page number for pagination
   * @param {number} params.limit - Items per page
   * @returns {Promise<Object>} Response with customers array and pagination
   */
  getAllCustomers: async (params = {}) => {
    try {
      const response = await api.get('/customers', { params })
      return response.data
    } catch (error) {
      console.error('Error fetching customers:', error)
      throw error
    }
  },

  /**
   * Get customer by ID
   * @param {string} customerId - Customer ID
   * @returns {Promise<Object>} Customer data with order history and statistics
   */
  getCustomerById: async (customerId) => {
    try {
      const response = await api.get(`/customers/${customerId}`)
      return response.data
    } catch (error) {
      console.error('Error fetching customer:', error)
      throw error
    }
  },

  /**
   * Create new customer
   * @param {Object} customerData - Customer data
   * @param {string} customerData.fullName - Full name (required)
   * @param {string} customerData.email - Email (optional, must be unique)
   * @param {string} customerData.phone - Phone number (optional, 10-15 digits)
   * @param {string} customerData.address - Address (optional)
   * @param {string} customerData.dateOfBirth - Date of birth (optional, ISO date string)
   * @param {string} customerData.gender - Gender (optional: male/female/other)
   * @param {string} customerData.customerType - Customer type (optional: guest/retail/wholesale/vip, default: guest)
   * @param {boolean} customerData.isActive - Active status (optional, default: true)
   * @returns {Promise<Object>} Created customer data
   */
  createCustomer: async (customerData) => {
    try {
      const response = await api.post('/customers', customerData)
      return response.data
    } catch (error) {
      console.error('Error creating customer:', error)
      throw error
    }
  },

  /**
   * Update customer
   * @param {string} customerId - Customer ID
   * @param {Object} customerData - Updated customer data
   * @param {string} customerData.fullName - Full name (optional)
   * @param {string} customerData.email - Email (optional)
   * @param {string} customerData.phone - Phone number (optional)
   * @param {string} customerData.address - Address (optional)
   * @param {string} customerData.dateOfBirth - Date of birth (optional)
   * @param {string} customerData.gender - Gender (optional)
   * @param {string} customerData.customerType - Customer type (optional)
   * @param {number} customerData.totalSpent - Total spent (optional, normally updated by system)
   * @param {boolean} customerData.isActive - Active status (optional)
   * @returns {Promise<Object>} Updated customer data
   */
  updateCustomer: async (customerId, customerData) => {
    try {
      const response = await api.put(`/customers/${customerId}`, customerData)
      return response.data
    } catch (error) {
      console.error('Error updating customer:', error)
      throw error
    }
  },

  /**
   * Delete customer (soft delete)
   * @param {string} customerId - Customer ID
   * @returns {Promise<Object>} Success message
   * @note Cannot delete customer with active orders
   */
  deleteCustomer: async (customerId) => {
    try {
      const response = await api.delete(`/customers/${customerId}`)
      return response.data
    } catch (error) {
      console.error('Error deleting customer:', error)
      throw error
    }
  },

  // ========== CONVENIENCE METHODS ==========

  /**
   * Search customers by keyword
   * @param {string} keyword - Search keyword
   * @param {Object} options - Additional options (page, limit, etc.)
   * @returns {Promise<Object>} Search results
   */
  searchCustomers: async (keyword, options = {}) => {
    try {
      const params = {
        search: keyword,
        ...options
      }
      const response = await api.get('/customers', { params })
      return response.data
    } catch (error) {
      console.error('Error searching customers:', error)
      throw error
    }
  },

  /**
   * Get active customers
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Active customers
   */
  getActiveCustomers: async (params = {}) => {
    try {
      const response = await api.get('/customers', {
        params: {
          isActive: true,
          ...params
        }
      })
      return response.data
    } catch (error) {
      console.error('Error fetching active customers:', error)
      throw error
    }
  },

  /**
   * Get inactive customers
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Inactive customers
   */
  getInactiveCustomers: async (params = {}) => {
    try {
      const response = await api.get('/customers', {
        params: {
          isActive: false,
          ...params
        }
      })
      return response.data
    } catch (error) {
      console.error('Error fetching inactive customers:', error)
      throw error
    }
  },

  /**
   * Get customers by type
   * @param {string} type - Customer type (guest/retail/wholesale/vip)
   * @param {Object} params - Additional query parameters
   * @returns {Promise<Object>} Customers of specified type
   */
  getCustomersByType: async (type, params = {}) => {
    try {
      const response = await api.get('/customers', {
        params: {
          customerType: type,
          ...params
        }
      })
      return response.data
    } catch (error) {
      console.error('Error fetching customers by type:', error)
      throw error
    }
  },

  /**
   * Get VIP customers
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} VIP customers
   */
  getVIPCustomers: async (params = {}) => {
    return customerService.getCustomersByType('vip', params)
  },

  /**
   * Get guest customers
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Guest customers
   */
  getGuestCustomers: async (params = {}) => {
    return customerService.getCustomersByType('guest', params)
  },

  /**
   * Get retail customers
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Retail customers
   */
  getRetailCustomers: async (params = {}) => {
    return customerService.getCustomersByType('retail', params)
  },

  /**
   * Get wholesale customers
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Wholesale customers
   */
  getWholesaleCustomers: async (params = {}) => {
    return customerService.getCustomersByType('wholesale', params)
  },

  /**
   * Get customers by gender
   * @param {string} gender - Gender (male/female/other)
   * @param {Object} params - Additional query parameters
   * @returns {Promise<Object>} Customers of specified gender
   */
  getCustomersByGender: async (gender, params = {}) => {
    try {
      const response = await api.get('/customers', {
        params: {
          gender,
          ...params
        }
      })
      return response.data
    } catch (error) {
      console.error('Error fetching customers by gender:', error)
      throw error
    }
  },

  /**
   * Get high-value customers (by spending range)
   * @param {number} minSpent - Minimum spending amount
   * @param {number} maxSpent - Maximum spending amount (optional)
   * @param {Object} params - Additional query parameters
   * @returns {Promise<Object>} High-value customers
   */
  getHighValueCustomers: async (minSpent, maxSpent = null, params = {}) => {
    try {
      const queryParams = {
        minSpent,
        ...params
      }
      if (maxSpent !== null) {
        queryParams.maxSpent = maxSpent
      }
      const response = await api.get('/customers', { params: queryParams })
      return response.data
    } catch (error) {
      console.error('Error fetching high-value customers:', error)
      throw error
    }
  },

  /**
   * Get customers with email
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Customers with email
   */
  getCustomersWithEmail: async (params = {}) => {
    try {
      const response = await api.get('/customers', {
        params: {
          hasEmail: true,
          ...params
        }
      })
      return response.data
    } catch (error) {
      console.error('Error fetching customers with email:', error)
      throw error
    }
  },

  /**
   * Get customers with phone
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Customers with phone
   */
  getCustomersWithPhone: async (params = {}) => {
    try {
      const response = await api.get('/customers', {
        params: {
          hasPhone: true,
          ...params
        }
      })
      return response.data
    } catch (error) {
      console.error('Error fetching customers with phone:', error)
      throw error
    }
  },

  /**
   * Get customers with order history
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Customers with populated orders
   */
  getCustomersWithOrders: async (params = {}) => {
    try {
      const response = await api.get('/customers', {
        params: {
          withOrders: true,
          ...params
        }
      })
      return response.data
    } catch (error) {
      console.error('Error fetching customers with orders:', error)
      throw error
    }
  },

  /**
   * Activate customer
   * @param {string} customerId - Customer ID
   * @returns {Promise<Object>} Updated customer
   */
  activateCustomer: async (customerId) => {
    return customerService.updateCustomer(customerId, { isActive: true })
  },

  /**
   * Deactivate customer
   * @param {string} customerId - Customer ID
   * @returns {Promise<Object>} Updated customer
   */
  deactivateCustomer: async (customerId) => {
    return customerService.updateCustomer(customerId, { isActive: false })
  },

  /**
   * Toggle customer active status
   * @param {string} customerId - Customer ID
   * @param {boolean} isActive - New active status
   * @returns {Promise<Object>} Updated customer
   */
  toggleActive: async (customerId, isActive) => {
    return customerService.updateCustomer(customerId, { isActive })
  },

  /**
   * Update customer type
   * @param {string} customerId - Customer ID
   * @param {string} newType - New customer type (guest/retail/wholesale/vip)
   * @returns {Promise<Object>} Updated customer
   */
  updateCustomerType: async (customerId, newType) => {
    return customerService.updateCustomer(customerId, { customerType: newType })
  },

  /**
   * Update customer contact info
   * @param {string} customerId - Customer ID
   * @param {Object} contactData - Contact data (email, phone, address)
   * @returns {Promise<Object>} Updated customer
   */
  updateContact: async (customerId, contactData) => {
    return customerService.updateCustomer(customerId, contactData)
  },

  /**
   * Check if email exists
   * @param {string} email - Email to check
   * @returns {Promise<boolean>} True if email exists
   */
  checkEmailExists: async (email) => {
    try {
      const response = await api.get('/customers', {
        params: {
          search: email,
          limit: 1
        }
      })
      const customers = response.data?.data?.customers || []
      return customers.some(c => c.email?.toLowerCase() === email.toLowerCase())
    } catch (error) {
      console.error('Error checking email:', error)
      return false
    }
  },

  /**
   * Check if phone exists
   * @param {string} phone - Phone to check
   * @returns {Promise<boolean>} True if phone exists
   */
  checkPhoneExists: async (phone) => {
    try {
      const response = await api.get('/customers', {
        params: {
          search: phone,
          limit: 1
        }
      })
      const customers = response.data?.data?.customers || []
      return customers.some(c => c.phone === phone)
    } catch (error) {
      console.error('Error checking phone:', error)
      return false
    }
  },

  // ========== POS SPECIFIC METHODS ==========

  /**
   * Get default guest customer for POS
   * @returns {Promise<Object>} Default guest customer
   */
  getDefaultGuest: async () => {
    try {
      const response = await api.get('/customers/default-guest')
      return response.data
    } catch (error) {
      console.error('Error getting default guest:', error)
      throw error
    }
  },

  /**
   * Quick search customers for POS
   * Optimized for fast searching with minimal data
   * @param {string} query - Search query (name, phone, email)
   * @param {number} limit - Max results (default: 10)
   * @returns {Promise<Object>} Search results
   */
  searchForPOS: async (query, limit = 10) => {
    try {
      const response = await api.get('/customers', {
        params: {
          search: query,
          isActive: true,
          limit
        }
      })
      return response.data
    } catch (error) {
      console.error('Error searching customers for POS:', error)
      throw error
    }
  },

  /**
   * Create customer from POS (uses POS authentication)
   * @param {Object} customerData - Customer data
   * @param {string} customerData.fullName - Full name (required)
   * @param {string} customerData.email - Email (optional, must be unique)
   * @param {string} customerData.phone - Phone number (required, 10-15 digits)
   * @param {string} customerData.address - Address (optional)
   * @param {string} customerData.dateOfBirth - Date of birth (optional, ISO date string)
   * @param {string} customerData.gender - Gender (required: male/female/other)
   * @param {string} customerData.customerType - Customer type (optional: guest/retail/wholesale/vip, default: retail)
   * @returns {Promise<Object>} Created customer data
   */
  createCustomerFromPOS: async (customerData) => {
    try {
      // Get POS token from localStorage (not adminToken)
      const posToken = localStorage.getItem('posToken')

      if (!posToken) {
        throw new Error('POS token not found. Please login to POS.')
      }

      // Send request with POS token in Authorization header
      const response = await api.post('/pos-login/customer', customerData, {
        headers: {
          Authorization: `Bearer ${posToken}`
        }
      })

      return response.data
    } catch (error) {
      console.error('Error creating customer from POS:', error)
      throw error
    }
  },

  /**
   * Get all orders for a specific customer (optimized for speed)
   * @param {string} customerId - Customer ID
   * @param {Object} params - Query parameters
   * @param {boolean} params.withDetails - Include order details (default: false)
   * @param {number} params.limit - Items limit (default: 1000, max: 1000)
   * @returns {Promise<Object>} Response with orders array
   */
  getCustomerOrders: async (customerId, params = {}) => {
    try {
      const response = await api.get(`/customers/${customerId}/orders`, { params })
      return response.data
    } catch (error) {
      console.error('Error fetching customer orders:', error)
      throw error
    }
  }
}

export default customerService
