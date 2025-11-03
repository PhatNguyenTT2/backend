import api from './api'

const departmentService = {
  // Get all departments with optional filters
  getAllDepartments: async (filters = {}) => {
    try {
      const params = {}

      if (filters.includeInactive) {
        params.include_inactive = 'true'
      }
      if (filters.withCount) {
        params.with_count = 'true'
      }

      const response = await api.get('/departments', { params })
      return {
        success: true,
        data: response.data.data.departments
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to fetch departments'
      }
    }
  },

  // Get single department by ID
  getDepartmentById: async (id) => {
    try {
      const response = await api.get(`/departments/${id}`)
      return {
        success: true,
        data: response.data.data.department
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to fetch department'
      }
    }
  },

  // Get department by code
  getDepartmentByCode: async (code) => {
    try {
      const response = await api.get(`/departments/code/${code}`)
      return {
        success: true,
        data: response.data.data.department
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to fetch department'
      }
    }
  },

  // Get department statistics (Admin only)
  getStatistics: async () => {
    try {
      const response = await api.get('/departments/stats/overview')
      return {
        success: true,
        data: response.data.data.statistics
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to fetch statistics'
      }
    }
  },

  // Get departments without manager (Admin only)
  getDepartmentsWithoutManager: async () => {
    try {
      const response = await api.get('/departments/without-manager')
      return {
        success: true,
        data: response.data.data.departments
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to fetch departments without manager'
      }
    }
  },

  // Create new department (Admin only)
  createDepartment: async (departmentData) => {
    try {
      const { departmentName, description, manager, location, phone, email } = departmentData
      const response = await api.post('/departments', {
        departmentName,
        description,
        manager,
        location,
        phone,
        email
      })

      return {
        success: true,
        data: response.data.data.department,
        message: response.data.message
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to create department'
      }
    }
  },

  // Update department (Admin only)
  updateDepartment: async (id, departmentData) => {
    try {
      const { departmentName, description, manager, location, phone, email } = departmentData
      const response = await api.put(`/departments/${id}`, {
        departmentName,
        description,
        manager,
        location,
        phone,
        email
      })

      return {
        success: true,
        data: response.data.data.department,
        message: response.data.message
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to update department'
      }
    }
  },

  // Assign manager to department (Admin only)
  assignManager: async (id, managerId) => {
    try {
      const response = await api.patch(`/departments/${id}/assign-manager`, {
        managerId
      })

      return {
        success: true,
        data: response.data.data.department,
        message: response.data.message
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to assign manager'
      }
    }
  },

  // Toggle department active status (Admin only)
  toggleStatus: async (id) => {
    try {
      const response = await api.patch(`/departments/${id}/toggle`)
      return {
        success: true,
        data: response.data.data.department,
        message: response.data.message
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to toggle department status'
      }
    }
  },

  // Delete department (Admin only)
  deleteDepartment: async (id) => {
    try {
      const response = await api.delete(`/departments/${id}`)
      return {
        success: true,
        message: response.data.message
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to delete department'
      }
    }
  },

  // Helper function to get active departments only
  getActiveDepartments: async () => {
    try {
      const response = await api.get('/departments', {
        params: { include_inactive: 'false' }
      })
      return {
        success: true,
        data: response.data.data.departments
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to fetch active departments'
      }
    }
  },

  // Helper function to get departments with employee count
  getDepartmentsWithEmployeeCount: async () => {
    try {
      const response = await api.get('/departments', {
        params: {
          with_count: 'true',
          include_inactive: 'true'
        }
      })
      return {
        success: true,
        data: response.data.data.departments
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to fetch departments with employee count'
      }
    }
  }
}

export default departmentService
