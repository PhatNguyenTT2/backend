import api from './api';

/**
 * Store Location Service
 * Manages batch positions on store shelves
 */
const storeLocationService = {
  /**
   * Get all store locations with batch info
   */
  getAllStoreLocations: async (params = {}) => {
    try {
      const response = await api.get('/store-locations', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching store locations:', error);
      throw error;
    }
  },

  /**
   * Get store location by ID
   */
  getStoreLocationById: async (id) => {
    try {
      const response = await api.get(`/store-locations/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching store location:', error);
      throw error;
    }
  },

  /**
   * Get batches on shelf (eligible for store location assignment)
   */
  getBatchesOnShelf: async () => {
    try {
      const response = await api.get('/store-locations/batches-on-shelf');
      return response.data;
    } catch (error) {
      console.error('Error fetching batches on shelf:', error);
      throw error;
    }
  },

  /**
   * Get unique store location names (for map building)
   */
  getUniqueNames: async () => {
    try {
      const response = await api.get('/store-locations/unique-names');
      return response.data;
    } catch (error) {
      console.error('Error fetching unique names:', error);
      throw error;
    }
  },

  /**
   * Create/assign store location for a batch
   */
  createStoreLocation: async (locationData) => {
    try {
      const response = await api.post('/store-locations', locationData);
      return response.data;
    } catch (error) {
      console.error('Error creating store location:', error);
      throw error;
    }
  },

  /**
   * Update store location
   */
  updateStoreLocation: async (id, locationData) => {
    try {
      const response = await api.put(`/store-locations/${id}`, locationData);
      return response.data;
    } catch (error) {
      console.error('Error updating store location:', error);
      throw error;
    }
  },

  /**
   * Bulk create store locations
   */
  bulkCreateStoreLocations: async (locations) => {
    try {
      const response = await api.post('/store-locations/bulk', { locations });
      return response.data;
    } catch (error) {
      console.error('Error bulk creating store locations:', error);
      throw error;
    }
  },

  /**
   * Delete store location assignment
   */
  deleteStoreLocation: async (id) => {
    try {
      const response = await api.delete(`/store-locations/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting store location:', error);
      throw error;
    }
  }
};

export default storeLocationService;
