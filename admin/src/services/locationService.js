const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

import api from './api';

const locationService = {
  /**
   * Get all locations
   */
  getAllLocations: async () => {
    try {
      const response = await api.get(`${API_BASE_URL}/api/location-masters`);
      return response.data;
    } catch (error) {
      console.error('Error fetching locations:', error);
      throw error;
    }
  },

  /**
   * Get location by ID
   */
  getLocationById: async (id) => {
    try {
      const response = await api.get(`${API_BASE_URL}/api/location-masters/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching location:', error);
      throw error;
    }
  },

  /**
   * Get available locations (not occupied)
   */
  getAvailableLocations: async () => {
    try {
      const response = await api.get(`${API_BASE_URL}/api/location-masters/available`);
      return response.data;
    } catch (error) {
      console.error('Error fetching available locations:', error);
      throw error;
    }
  },

  /**
   * Get occupied locations
   */
  getOccupiedLocations: async () => {
    try {
      const response = await api.get(`${API_BASE_URL}/api/location-masters/occupied`);
      return response.data;
    } catch (error) {
      console.error('Error fetching occupied locations:', error);
      throw error;
    }
  },

  /**
   * Create new location
   */
  createLocation: async (locationData) => {
    try {
      const response = await api.post(`${API_BASE_URL}/api/location-masters`, locationData);
      return response.data;
    } catch (error) {
      console.error('Error creating location:', error);
      throw error;
    }
  },

  /**
   * Update location
   */
  updateLocation: async (id, locationData) => {
    try {
      const response = await api.put(`${API_BASE_URL}/api/location-masters/${id}`, locationData);
      return response.data;
    } catch (error) {
      console.error('Error updating location:', error);
      throw error;
    }
  },

  /**
   * Delete location
   */
  deleteLocation: async (id) => {
    try {
      const response = await api.delete(`${API_BASE_URL}/api/location-masters/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting location:', error);
      throw error;
    }
  }
};

export default locationService;
