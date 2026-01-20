import api from './api'

/**
 * Product Service
 * Handles all API calls related to products
 */
const productService = {
  /**
   * Get all products with optional filters
   * @param {Object} params - Query parameters
   * @param {boolean} params.isActive - Filter by active status
   * @param {string} params.category - Filter by category ID
   * @param {string} params.search - Search by product name or code
   * @param {number} params.minPrice - Filter by minimum price
   * @param {number} params.maxPrice - Filter by maximum price
   * @param {boolean} params.withBatches - Include batches
   * @param {boolean} params.withInventory - Include inventory
   * @param {number} params.page - Page number for pagination
   * @param {number} params.limit - Items per page
   * @returns {Promise<Object>} Response with products array and pagination
   */
  getAllProducts: async (params = {}) => {
    try {
      const response = await api.get('/products', { params })
      return response.data
    } catch (error) {
      console.error('Error fetching products:', error)
      throw error
    }
  },

  /**
   * Get product by ID
   * @param {string} productId - Product ID
   * @returns {Promise<Object>} Product data with category, batches, and inventory
   */
  getProductById: async (productId) => {
    try {
      const response = await api.get(`/products/${productId}`)
      return response.data
    } catch (error) {
      console.error('Error fetching product:', error)
      throw error
    }
  },

  /**
   * Create new product
   * @param {Object} productData - Product data
   * @param {string} productData.name - Product name (required)
   * @param {string} productData.image - Product image URL (optional)
   * @param {string} productData.category - Category ID (required)
   * @param {number} productData.unitPrice - Unit price (required)
   * @param {boolean} productData.isActive - Active status (optional, default true)
   * @param {string} productData.vendor - Vendor name (optional)
   * @returns {Promise<Object>} Created product data
   */
  createProduct: async (productData) => {
    try {
      const response = await api.post('/products', productData)
      return response.data
    } catch (error) {
      console.error('Error creating product:', error)
      throw error
    }
  },

  /**
   * Update product
   * @param {string} productId - Product ID
   * @param {Object} productData - Updated product data
   * @param {string} productData.name - Product name (optional)
   * @param {string} productData.image - Product image URL (optional)
   * @param {string} productData.category - Category ID (optional)
   * @param {number} productData.unitPrice - Unit price (optional)
   * @param {boolean} productData.isActive - Active status (optional)
   * @param {string} productData.vendor - Vendor name (optional)
   * @returns {Promise<Object>} Updated product data
   */
  updateProduct: async (productId, productData) => {
    try {
      const response = await api.put(`/products/${productId}`, productData)
      return response.data
    } catch (error) {
      console.error('Error updating product:', error)
      throw error
    }
  },

  /**
   * Delete product (soft delete by setting isActive = false)
   * @param {string} productId - Product ID
   * @returns {Promise<Object>} Success message
   * @note Will fail if product has active batches or inventory
   */
  deleteProduct: async (productId) => {
    try {
      const response = await api.delete(`/products/${productId}`)
      return response.data
    } catch (error) {
      console.error('Error deleting product:', error)
      throw error
    }
  },

  /**
   * Search products by name or code
   * @param {string} searchTerm - Search term
   * @param {number} limit - Maximum results (optional, default 20)
   * @returns {Promise<Object>} Matching products
   */
  searchProducts: async (searchTerm, limit = 20) => {
    try {
      const response = await api.get('/products', {
        params: { search: searchTerm, limit }
      })
      return response.data
    } catch (error) {
      console.error('Error searching products:', error)
      throw error
    }
  },

  /**
   * Get products by category
   * @param {string} categoryId - Category ID
   * @param {Object} options - Additional options
   * @param {boolean} options.isActive - Filter by active status (optional)
   * @param {number} options.page - Page number (optional)
   * @param {number} options.limit - Items per page (optional)
   * @returns {Promise<Object>} Products in the category
   */
  getProductsByCategory: async (categoryId, options = {}) => {
    try {
      const response = await api.get('/products', {
        params: { category: categoryId, ...options }
      })
      return response.data
    } catch (error) {
      console.error('Error fetching products by category:', error)
      throw error
    }
  },

  /**
   * Get active products only
   * @param {Object} params - Additional query parameters (optional)
   * @returns {Promise<Object>} Active products
   */
  getActiveProducts: async (params = {}) => {
    try {
      const response = await api.get('/products', {
        params: { isActive: true, ...params }
      })
      return response.data
    } catch (error) {
      console.error('Error fetching active products:', error)
      throw error
    }
  },

  /**
   * Get products with batches
   * @param {Object} params - Query parameters (optional)
   * @returns {Promise<Object>} Products with batches populated
   */
  getProductsWithBatches: async (params = {}) => {
    try {
      const response = await api.get('/products', {
        params: { withBatches: true, ...params }
      })
      return response.data
    } catch (error) {
      console.error('Error fetching products with batches:', error)
      throw error
    }
  },

  /**
   * Get products with inventory
   * @param {Object} params - Query parameters (optional)
   * @returns {Promise<Object>} Products with inventory populated
   */
  getProductsWithInventory: async (params = {}) => {
    try {
      const response = await api.get('/products', {
        params: { withInventory: true, ...params }
      })
      return response.data
    } catch (error) {
      console.error('Error fetching products with inventory:', error)
      throw error
    }
  },

  /**
   * Toggle product active status
   * @param {string} productId - Product ID
   * @param {boolean} isActive - New active status
   * @returns {Promise<Object>} Updated product data
   */
  toggleProductActive: async (productId, isActive) => {
    try {
      const response = await api.put(`/products/${productId}`, { isActive })
      return response.data
    } catch (error) {
      console.error('Error toggling product active status:', error)
      throw error
    }
  },

  /**
   * Get product by productCode with inventory and batch information
   * Used for POS barcode scanning simulation
   * @param {string} productCode - Product code (e.g., PROD2025000001)
   * @param {Object} options - Query options
   * @param {boolean} options.withInventory - Include inventory info (default: true)
   * @param {boolean} options.withBatches - Include batch info (default: true)
   * @param {boolean} options.isActive - Only active products (default: true)
   * @returns {Promise<Object>} Product data with inventory and batches
   */
  getProductByCode: async (productCode, options = {}) => {
    try {
      const params = {
        withInventory: options.withInventory !== false, // default true
        withBatches: options.withBatches !== false, // default true
        isActive: options.isActive !== false // default true
      }

      const response = await api.get(`/products/code/${productCode}`, { params })
      return response.data
    } catch (error) {
      console.error('Get product by code error:', error)
      throw error
    }
  },
  /**
   * Get product price history
   * @param {string} productId - Product ID
   * @returns {Promise<Object>} Price history array
   */
  getProductPriceHistory: async (productId) => {
    try {
      const response = await api.get(`/products/${productId}/price-history`);
      return response.data;
    } catch (error) {
      console.error('Error fetching price history:', error);
      throw error;
    }
  },

  /**
   * Update product price (with history)
   * @param {string} productId - Product ID
   * @param {Object} data - { newPrice, reason }
   * @returns {Promise<Object>} Updated product and history entry
   */
  updateProductPrice: async (productId, data) => {
    try {
      const response = await api.put(`/products/${productId}/price`, data);
      return response.data;
    } catch (error) {
      console.error('Error updating product price:', error);
      throw error;
    }
  }
}

export default productService
