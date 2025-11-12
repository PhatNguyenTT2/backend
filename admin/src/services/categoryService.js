import api from './api'

/**
 * Category Service
 * Handles all API calls related to categories
 */
const categoryService = {
  /**
   * Get all categories with optional filters
   * @param {Object} params - Query parameters
   * @param {boolean} params.isActive - Filter by active status
   * @param {string} params.search - Search by category name
   * @param {boolean} params.withProducts - Include product count
   * @param {number} params.page - Page number for pagination
   * @param {number} params.limit - Items per page
   * @returns {Promise<Object>} Response with categories array and pagination
   */
  getAllCategories: async (params = {}) => {
    try {
      const response = await api.get('/categories', { params })
      return response.data
    } catch (error) {
      console.error('Error fetching categories:', error)
      throw error
    }
  },

  /**
   * Get category by ID
   * @param {string} categoryId - Category ID
   * @returns {Promise<Object>} Category data with product count and recent products
   */
  getCategoryById: async (categoryId) => {
    try {
      const response = await api.get(`/categories/${categoryId}`)
      return response.data
    } catch (error) {
      console.error('Error fetching category:', error)
      throw error
    }
  },

  /**
   * Create new category
   * @param {Object} categoryData - Category data
   * @param {string} categoryData.name - Category name (required)
   * @param {string} categoryData.image - Category image URL (optional)
   * @param {string} categoryData.description - Category description (optional)
   * @param {boolean} categoryData.isActive - Active status (optional, default true)
   * @returns {Promise<Object>} Created category data
   */
  createCategory: async (categoryData) => {
    try {
      const response = await api.post('/categories', categoryData)
      return response.data
    } catch (error) {
      console.error('Error creating category:', error)
      throw error
    }
  },

  /**
   * Update category
   * @param {string} categoryId - Category ID
   * @param {Object} categoryData - Updated category data
   * @param {string} categoryData.name - Category name (optional)
   * @param {string} categoryData.image - Category image URL (optional)
   * @param {string} categoryData.description - Category description (optional)
   * @param {boolean} categoryData.isActive - Active status (optional)
   * @returns {Promise<Object>} Updated category data
   */
  updateCategory: async (categoryId, categoryData) => {
    try {
      const response = await api.put(`/categories/${categoryId}`, categoryData)
      return response.data
    } catch (error) {
      console.error('Error updating category:', error)
      throw error
    }
  },

  /**
   * Delete category (soft delete by setting isActive = false)
   * @param {string} categoryId - Category ID
   * @returns {Promise<Object>} Success message
   * @note Will fail if category has active products
   */
  deleteCategory: async (categoryId) => {
    try {
      const response = await api.delete(`/categories/${categoryId}`)
      return response.data
    } catch (error) {
      console.error('Error deleting category:', error)
      throw error
    }
  },

  /**
   * Search categories by name
   * @param {string} searchTerm - Search term
   * @returns {Promise<Object>} Search results
   */
  searchCategories: async (searchTerm) => {
    try {
      const response = await api.get('/categories', {
        params: { search: searchTerm }
      })
      return response.data
    } catch (error) {
      console.error('Error searching categories:', error)
      throw error
    }
  },

  /**
   * Get active categories only
   * @param {boolean} withProducts - Include product count
   * @returns {Promise<Object>} Active categories
   */
  getActiveCategories: async (withProducts = false) => {
    try {
      const response = await api.get('/categories', {
        params: {
          isActive: true,
          withProducts: withProducts
        }
      })
      return response.data
    } catch (error) {
      console.error('Error fetching active categories:', error)
      throw error
    }
  },

  /**
   * Get inactive categories only
   * @returns {Promise<Object>} Inactive categories
   */
  getInactiveCategories: async () => {
    try {
      const response = await api.get('/categories', {
        params: { isActive: false }
      })
      return response.data
    } catch (error) {
      console.error('Error fetching inactive categories:', error)
      throw error
    }
  },

  /**
   * Get categories with product count
   * @returns {Promise<Object>} Categories with product count
   */
  getCategoriesWithProductCount: async () => {
    try {
      const response = await api.get('/categories', {
        params: { withProducts: true }
      })
      return response.data
    } catch (error) {
      console.error('Error fetching categories with product count:', error)
      throw error
    }
  },

  /**
   * Toggle category active status
   * @param {string} categoryId - Category ID
   * @param {boolean} isActive - New active status
   * @returns {Promise<Object>} Updated category data
   */
  toggleActive: async (categoryId, isActive) => {
    try {
      const response = await api.put(`/categories/${categoryId}`, { isActive })
      return response.data
    } catch (error) {
      console.error('Error toggling category status:', error)
      throw error
    }
  },

  /**
   * Activate category
   * @param {string} categoryId - Category ID
   * @returns {Promise<Object>} Updated category data
   */
  activateCategory: async (categoryId) => {
    try {
      const response = await api.put(`/categories/${categoryId}`, { isActive: true })
      return response.data
    } catch (error) {
      console.error('Error activating category:', error)
      throw error
    }
  },

  /**
   * Deactivate category
   * @param {string} categoryId - Category ID
   * @returns {Promise<Object>} Updated category data
   */
  deactivateCategory: async (categoryId) => {
    try {
      const response = await api.put(`/categories/${categoryId}`, { isActive: false })
      return response.data
    } catch (error) {
      console.error('Error deactivating category:', error)
      throw error
    }
  },

  /**
   * Update category image
   * @param {string} categoryId - Category ID
   * @param {string} imageUrl - New image URL
   * @returns {Promise<Object>} Updated category data
   */
  updateImage: async (categoryId, imageUrl) => {
    try {
      const response = await api.put(`/categories/${categoryId}`, { image: imageUrl })
      return response.data
    } catch (error) {
      console.error('Error updating category image:', error)
      throw error
    }
  },

  /**
   * Get categories with pagination
   * @param {number} page - Page number
   * @param {number} limit - Items per page
   * @returns {Promise<Object>} Paginated categories
   */
  getCategoriesPaginated: async (page = 1, limit = 20) => {
    try {
      const response = await api.get('/categories', {
        params: { page, limit }
      })
      return response.data
    } catch (error) {
      console.error('Error fetching paginated categories:', error)
      throw error
    }
  },

  /**
   * Check if category name exists
   * @param {string} name - Category name to check
   * @param {string} excludeId - Category ID to exclude from check (for update)
   * @returns {Promise<boolean>} True if name exists
   */
  checkNameExists: async (name, excludeId = null) => {
    try {
      const response = await api.get('/categories', {
        params: { search: name }
      })

      const categories = response.data.data.categories

      // Check if exact match exists (case-insensitive)
      const exists = categories.some(cat =>
        cat.name.toLowerCase() === name.toLowerCase() &&
        (!excludeId || cat.id !== excludeId)
      )

      return exists
    } catch (error) {
      console.error('Error checking category name:', error)
      throw error
    }
  }
}

export default categoryService
