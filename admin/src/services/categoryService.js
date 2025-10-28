import api from './api'

const categoryService = {
  // Get all categories
  getCategories: async (params = {}) => {
    try {
      const response = await api.get('/categories', { params })
      return response.data
    } catch (error) {
      console.error('Get categories error:', error)
      throw error
    }
  },

  // Get single category by ID
  getCategoryById: async (id) => {
    try {
      const response = await api.get(`/categories/${id}`)
      return response.data
    } catch (error) {
      console.error('Get category error:', error)
      throw error
    }
  },

  // Get category by slug
  getCategoryBySlug: async (slug) => {
    try {
      const response = await api.get(`/categories/slug/${slug}`)
      return response.data
    } catch (error) {
      console.error('Get category by slug error:', error)
      throw error
    }
  },

  // Create new category (Admin only)
  createCategory: async (categoryData) => {
    try {
      const response = await api.post('/categories', categoryData)
      return response.data
    } catch (error) {
      console.error('Create category error:', error)
      throw error
    }
  },

  // Update category (Admin only)
  updateCategory: async (id, categoryData) => {
    try {
      const response = await api.put(`/categories/${id}`, categoryData)
      return response.data
    } catch (error) {
      console.error('Update category error:', error)
      throw error
    }
  },

  // Delete category (Admin only)
  deleteCategory: async (id) => {
    try {
      const response = await api.delete(`/categories/${id}`)
      return response.data
    } catch (error) {
      console.error('Delete category error:', error)
      throw error
    }
  }
}

export default categoryService

