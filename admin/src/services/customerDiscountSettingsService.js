import api from './api'

/**
 * Customer Discount Settings Service
 * Handles all API calls related to versioned customer discount settings with audit trail
 */
const customerDiscountSettingsService = {
  /**
   * Get currently active customer discount rates
   * Available to all authenticated users (used by POS and order creation)
   * @returns {Promise<Object>} Current active discount rates
   * @example
   * const response = await customerDiscountSettingsService.getActiveDiscounts()
   * // { success: true, data: { retail: 10, wholesale: 15, vip: 20 } }
   */
  getActiveDiscounts: async () => {
    try {
      const response = await api.get('/customer-discount-settings')
      return response.data
    } catch (error) {
      console.error('Error fetching active customer discounts:', error)
      throw error
    }
  },

  /**
   * Get version history of customer discount changes
   * Shows all past versions with who changed, when, why, and what changed
   * @param {number} limit - Number of versions to return (default: 50, max: 200)
   * @returns {Promise<Object>} Array of version history
   * @example
   * const response = await customerDiscountSettingsService.getHistory(20)
   * // { success: true, data: [
   * //   { version: 3, discounts: {...}, effectiveFrom: '...', changedBy: {...}, changeReason: '...', changes: {...} },
   * //   { version: 2, ... },
   * //   { version: 1, ... }
   * // ]}
   */
  getHistory: async (limit = 50) => {
    try {
      const response = await api.get(`/customer-discount-settings/history?limit=${limit}`)
      return response.data
    } catch (error) {
      console.error('Error fetching customer discount history:', error)
      throw error
    }
  },

  /**
   * Get a specific version of customer discount settings
   * @param {number} versionNumber - Version number to retrieve
   * @returns {Promise<Object>} Specific version details
   * @example
   * const response = await customerDiscountSettingsService.getVersion(2)
   * // { success: true, data: { version: 2, discounts: {...}, effectiveFrom: '...', changedBy: {...}, ... } }
   */
  getVersion: async (versionNumber) => {
    try {
      const response = await api.get(`/customer-discount-settings/version/${versionNumber}`)
      return response.data
    } catch (error) {
      console.error(`Error fetching version ${versionNumber}:`, error)
      throw error
    }
  },

  /**
   * Update customer discount rates (creates new version)
   * This creates a new immutable version in the history
   * Note: Changes only apply to NEW orders created after this update
   * @param {Object} params - Update parameters
   * @param {number} params.retail - Retail customer discount (0-100)
   * @param {number} params.wholesale - Wholesale customer discount (0-100)
   * @param {number} params.vip - VIP customer discount (0-100)
   * @param {string} params.reason - Reason for the change (for audit trail)
   * @param {string} params.employeeId - ID of employee making the change
   * @returns {Promise<Object>} New version details
   * @example
   * const response = await customerDiscountSettingsService.updateDiscounts({
   *   retail: 12,
   *   wholesale: 18,
   *   vip: 25,
   *   reason: 'Seasonal promotion adjustment',
   *   employeeId: '507f1f77bcf86cd799439011'
   * })
   * // { success: true, message: '...', data: { version: 4, discounts: {...}, ... } }
   */
  updateDiscounts: async ({ retail, wholesale, vip, reason, employeeId }) => {
    try {
      const response = await api.post('/customer-discount-settings', {
        retail,
        wholesale,
        vip,
        reason,
        employeeId
      })
      return response.data
    } catch (error) {
      console.error('Error updating customer discounts:', error)
      throw error
    }
  },

  /**
   * Rollback to a previous version of discount settings
   * This creates a new version with the same values as the target version
   * @param {Object} params - Rollback parameters
   * @param {number} params.versionNumber - Version number to rollback to
   * @param {string} params.reason - Reason for the rollback
   * @param {string} params.employeeId - ID of employee performing rollback
   * @returns {Promise<Object>} New version (rollback) details
   * @example
   * const response = await customerDiscountSettingsService.rollbackToVersion({
   *   versionNumber: 2,
   *   reason: 'Reverting due to customer complaints',
   *   employeeId: '507f1f77bcf86cd799439011'
   * })
   * // { success: true, message: 'Successfully rolled back to version 2', data: { version: 5, ... } }
   */
  rollbackToVersion: async ({ versionNumber, reason, employeeId }) => {
    try {
      const response = await api.post('/customer-discount-settings/rollback', {
        versionNumber,
        reason,
        employeeId
      })
      return response.data
    } catch (error) {
      console.error('Error rolling back customer discounts:', error)
      throw error
    }
  },

  /**
   * Reset discount settings to default values
   * Creates new version with default values (retail: 10%, wholesale: 15%, vip: 20%)
   * @param {Object} params - Reset parameters
   * @param {string} params.reason - Reason for resetting to defaults
   * @param {string} params.employeeId - ID of employee performing reset
   * @returns {Promise<Object>} New version (reset) details
   * @example
   * const response = await customerDiscountSettingsService.resetToDefaults({
   *   reason: 'End of promotional period',
   *   employeeId: '507f1f77bcf86cd799439011'
   * })
   * // { success: true, message: 'Customer discount settings reset to defaults', data: { version: 6, ... } }
   */
  resetToDefaults: async ({ reason, employeeId }) => {
    try {
      const response = await api.post('/customer-discount-settings/reset', {
        reason,
        employeeId
      })
      return response.data
    } catch (error) {
      console.error('Error resetting customer discounts:', error)
      throw error
    }
  }
}

export default customerDiscountSettingsService
