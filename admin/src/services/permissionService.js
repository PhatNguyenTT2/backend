import api from './api';

const permissionService = {
  // Get all available permissions from backend
  getPermissions: async () => {
    try {
      const response = await api.get('/permissions');
      return response.data;
    } catch (error) {
      console.error('Error fetching permissions:', error);
      throw error;
    }
  }
};

export default permissionService;
