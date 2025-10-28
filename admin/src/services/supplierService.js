import api from './api'

/**
 * Supplier Service
 * Handles all supplier-related API calls
 */
const supplierService = {
  /**
   * Get all suppliers with pagination and filters
   * @param {Object} params - Query parameters (page, limit, paymentTerms, isActive, search)
   * @returns {Promise} Supplier list with pagination
   */
  getSuppliers: async (params = {}) => {
    try {
      // Map limit to limit (already correct, but ensure consistency)
      const response = await api.get('/suppliers', { params })
      return response.data
    } catch (error) {
      console.error('Error fetching suppliers:', error)
      throw error.response?.data || error
    }
  },

  /**
   * Get single supplier by ID
   * @param {string} id - Supplier ID
   * @returns {Promise} Supplier details
   */
  getSupplierById: async (id) => {
    try {
      const response = await api.get(`/suppliers/${id}`)
      return response.data
    } catch (error) {
      console.error(`Error fetching supplier ${id}:`, error)
      throw error.response?.data || error
    }
  },

  /**
   * Get supplier statistics
   * @returns {Promise} Supplier statistics
   */
  getSupplierStats: async () => {
    try {
      const response = await api.get('/suppliers/stats')
      return response.data
    } catch (error) {
      console.error('Error fetching supplier stats:', error)
      throw error.response?.data || error
    }
  },

  /**
   * Create new supplier
   * @param {Object} supplierData - Supplier data
   * @returns {Promise} Created supplier
   */
  createSupplier: async (supplierData) => {
    try {
      const response = await api.post('/suppliers', supplierData)
      return response.data
    } catch (error) {
      console.error('Error creating supplier:', error)
      throw error.response?.data || error
    }
  },

  /**
   * Update supplier
   * @param {string} id - Supplier ID
   * @param {Object} updates - Updated fields
   * @returns {Promise} Updated supplier
   */
  updateSupplier: async (id, updates) => {
    try {
      const response = await api.put(`/suppliers/${id}`, updates)
      return response.data
    } catch (error) {
      console.error(`Error updating supplier ${id}:`, error)
      throw error.response?.data || error
    }
  },

  /**
   * Delete supplier
   * @param {string} id - Supplier ID
   * @param {boolean} permanent - Permanent delete or soft delete
   * @returns {Promise} Delete confirmation
   */
  deleteSupplier: async (id, permanent = false) => {
    try {
      const response = await api.delete(`/suppliers/${id}`, {
        params: { permanent: permanent.toString() }
      })
      return response.data
    } catch (error) {
      console.error(`Error deleting supplier ${id}:`, error)
      throw error.response?.data || error
    }
  },

  /**
   * Update supplier rating
   * @param {string} id - Supplier ID
   * @param {number} rating - Rating (0-5)
   * @returns {Promise} Updated rating
   */
  updateRating: async (id, rating) => {
    try {
      const response = await api.put(`/suppliers/${id}/rating`, { rating })
      return response.data
    } catch (error) {
      console.error(`Error updating rating for supplier ${id}:`, error)
      throw error.response?.data || error
    }
  },

  /**
   * Add debt to supplier
   * @param {string} id - Supplier ID
   * @param {number} amount - Debt amount
   * @returns {Promise} Updated debt
   */
  addDebt: async (id, amount) => {
    try {
      const response = await api.put(`/suppliers/${id}/debt/add`, { amount })
      return response.data
    } catch (error) {
      console.error(`Error adding debt for supplier ${id}:`, error)
      throw error.response?.data || error
    }
  },

  /**
   * Pay debt for supplier
   * @param {string} id - Supplier ID
   * @param {number} amount - Payment amount
   * @returns {Promise} Updated debt
   */
  payDebt: async (id, amount) => {
    try {
      const response = await api.put(`/suppliers/${id}/debt/pay`, { amount })
      return response.data
    } catch (error) {
      console.error(`Error paying debt for supplier ${id}:`, error)
      throw error.response?.data || error
    }
  },

  /**
   * Format suppliers data for display in the table
   * @param {Array} suppliers - Raw suppliers from API
   * @returns {Array} Formatted suppliers
   */
  formatSuppliersForDisplay: (suppliers) => {
    return suppliers.map(supplier => ({
      id: supplier.id || supplier._id,
      supplierCode: supplier.supplierCode,
      companyName: supplier.companyName,
      contactPerson: supplier.contactPerson || null,
      email: supplier.email,
      phone: supplier.phone || null,
      // Preserve full address; also provide flattened fields for UI fallbacks
      address: supplier.address ? {
        street: supplier.address.street || '',
        city: supplier.address.city || ''
      } : null,
      addressStreet: supplier.address?.street || '',
      addressCity: supplier.address?.city || '',
      taxId: supplier.taxId || null,
      // Preserve full bankAccount object
      bankAccount: supplier.bankAccount ? {
        bankName: supplier.bankAccount.bankName || '',
        accountNumber: supplier.bankAccount.accountNumber || '',
        accountName: supplier.bankAccount.accountName || '',
        swiftCode: supplier.bankAccount.swiftCode || ''
      } : null,
      paymentTerms: supplier.paymentTerms || 'net30',
      creditLimit: supplier.creditLimit || 0,
      currentDebt: supplier.currentDebt || 0,
      totalPurchaseAmount: supplier.totalPurchaseAmount || 0,
      totalPurchaseOrders: supplier.totalPurchaseOrders || 0,
      rating: supplier.rating || 0,
      notes: supplier.notes || '',
      isActive: supplier.isActive !== undefined ? supplier.isActive : true,
      createdAt: supplier.createdAt,
      updatedAt: supplier.updatedAt
    }))
  }
}

export default supplierService
