import api from './api'

const employeeService = {
  // Get all employees with filters
  getAllEmployees: async (filters = {}) => {
    try {
      const params = {}

      if (filters.department) {
        params.department = filters.department
      }
      if (filters.search) {
        params.search = filters.search
      }
      if (filters.isActive !== undefined) {
        params.is_active = filters.isActive
      }
      if (filters.limit) {
        params.limit = filters.limit
      }

      const response = await api.get('/employees', { params })
      return {
        success: true,
        data: response.data.data.employees
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to fetch employees'
      }
    }
  },

  // Get single employee by ID
  getEmployeeById: async (id) => {
    try {
      const response = await api.get(`/employees/${id}`)
      return {
        success: true,
        data: response.data.data.employee
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to fetch employee'
      }
    }
  },

  // Get employee by user account ID
  getEmployeeByUserAccount: async (userAccountId) => {
    try {
      const response = await api.get(`/employees/user-account/${userAccountId}`)
      return {
        success: true,
        data: response.data.data.employee
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to fetch employee'
      }
    }
  },

  // Get employees by department
  getEmployeesByDepartment: async (departmentId) => {
    try {
      const response = await api.get(`/employees/department/${departmentId}`)
      return {
        success: true,
        data: response.data.data.employees
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to fetch employees'
      }
    }
  },

  // Get employee statistics
  getStatistics: async () => {
    try {
      const response = await api.get('/employees/stats/overview')
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

  // Search employees
  searchEmployees: async (searchTerm) => {
    try {
      const response = await api.get('/employees/search', {
        params: { q: searchTerm }
      })
      return {
        success: true,
        data: response.data.data.employees
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to search employees'
      }
    }
  },

  // Create new employee
  createEmployee: async (employeeData) => {
    try {
      const { userAccountId, fullName, phone, address, dateOfBirth, departmentId } = employeeData
      const response = await api.post('/employees', {
        userAccountId,
        fullName,
        phone,
        address,
        dateOfBirth,
        departmentId
      })

      return {
        success: true,
        data: response.data.data.employee,
        message: response.data.message
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to create employee'
      }
    }
  },

  // Update employee
  updateEmployee: async (id, employeeData) => {
    try {
      const { fullName, phone, address, dateOfBirth, departmentId } = employeeData
      const response = await api.put(`/employees/${id}`, {
        fullName,
        phone,
        address,
        dateOfBirth,
        departmentId
      })

      return {
        success: true,
        data: response.data.data.employee,
        message: response.data.message
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to update employee'
      }
    }
  },

  // Update employee profile (partial update)
  updateProfile: async (id, profileData) => {
    try {
      const response = await api.patch(`/employees/${id}/profile`, profileData)
      return {
        success: true,
        data: response.data.data.employee,
        message: response.data.message
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to update profile'
      }
    }
  },

  // Change department
  changeDepartment: async (id, departmentId) => {
    try {
      const response = await api.patch(`/employees/${id}/department`, {
        departmentId
      })

      return {
        success: true,
        data: response.data.data.employee,
        message: response.data.message
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to change department'
      }
    }
  },

  // Delete employee
  deleteEmployee: async (id) => {
    try {
      const response = await api.delete(`/employees/${id}`)
      return {
        success: true,
        message: response.data.message
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to delete employee'
      }
    }
  }
}

export default employeeService
