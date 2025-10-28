import api from './api'

const productService = {
  // Get all products with pagination and filters
  getProducts: async (params = {}) => {
    try {
      const response = await api.get('/products', { params })
      return response.data
    } catch (error) {
      console.error('Get products error:', error)
      throw error
    }
  },

  // Get single product by ID
  getProductById: async (id) => {
    try {
      const response = await api.get(`/products/${id}`)
      return response.data
    } catch (error) {
      console.error('Get product error:', error)
      throw error
    }
  },

  // Create new product (Admin only)
  createProduct: async (productData) => {
    try {
      const response = await api.post('/products', productData)
      return response.data
    } catch (error) {
      console.error('Create product error:', error)
      throw error
    }
  },

  // Update product (Admin only)
  updateProduct: async (id, productData) => {
    try {
      const response = await api.put(`/products/${id}`, productData)
      return response.data
    } catch (error) {
      console.error('Update product error:', error)
      throw error
    }
  },

  // Delete product (Admin only)
  deleteProduct: async (id) => {
    try {
      const response = await api.delete(`/products/${id}`)
      return response.data
    } catch (error) {
      console.error('Delete product error:', error)
      throw error
    }
  },

  // Update stock quantity (Admin only)
  updateStock: async (id, stock) => {
    try {
      const response = await api.patch(`/products/${id}/stock`, { stock })
      return response.data
    } catch (error) {
      console.error('Update stock error:', error)
      throw error
    }
  },

  // Helper: Calculate discount percentage
  getDiscountPercent: (price, originalPrice) => {
    if (!originalPrice || originalPrice <= price) return 0
    return Math.round(((originalPrice - price) / originalPrice) * 100)
  },

  // Helper: Calculate profit margin
  getProfitMargin: (costPrice, sellingPrice) => {
    if (!costPrice || !sellingPrice || sellingPrice <= 0) return 0
    return parseFloat((((sellingPrice - costPrice) / sellingPrice) * 100).toFixed(2))
  },

  // Helper: Calculate profit amount
  getProfitAmount: (costPrice, sellingPrice) => {
    if (!costPrice || !sellingPrice) return 0
    return parseFloat((sellingPrice - costPrice).toFixed(2))
  }
}

export default productService

