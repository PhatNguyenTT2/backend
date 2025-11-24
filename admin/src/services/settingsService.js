import api from './api'

/**
 * Settings Service
 * Handles all API calls related to system settings
 */
const settingsService = {
  /**
   * Get all system settings (Admin only)
   * Returns all settings categories with metadata
   * @returns {Promise<Object>} Response with all settings array
   * @example
   * const response = await settingsService.getAllSettings()
   * // { success: true, data: [{ settingKey: 'customer_discounts', ... }] }
   */
  getAllSettings: async () => {
    try {
      const response = await api.get('/settings')
      return response.data
    } catch (error) {
      console.error('Error fetching all settings:', error)
      throw error
    }
  },

  /**
   * Get system settings (shorthand for getAllSettings)
   * @returns {Promise<Object>} Response with settings object
   * @example
   * const response = await settingsService.getSettings()
   * // { success: true, data: { customerDiscounts: {...}, posSecurity: {...}, freshProductPromotion: {...} } }
   */
  getSettings: async () => {
    try {
      const response = await api.get('/settings')
      return response.data
    } catch (error) {
      console.error('Error fetching settings:', error)
      throw error
    }
  },

  /**
   * Update system settings
   * @param {Object} settings - Settings object to update
   * @returns {Promise<Object>} Updated settings
   * @example
   * const response = await settingsService.updateSettings({
   *   freshProductPromotion: { autoPromotionEnabled: true, discountPercentage: 20 }
   * })
   * // { success: true, data: {...}, message: 'Settings updated successfully' }
   */
  updateSettings: async (settings) => {
    try {
      const response = await api.put('/settings', settings)
      return response.data
    } catch (error) {
      console.error('Error updating settings:', error)
      throw error
    }
  },

  // ========== CUSTOMER DISCOUNTS ==========

  /**
   * Get customer discount rates
   * Available to all authenticated users
   * @returns {Promise<Object>} Discount rates by customer type
   * @example
   * const response = await settingsService.getCustomerDiscounts()
   * // { success: true, data: { retail: 10, wholesale: 15, vip: 20 } }
   */
  getCustomerDiscounts: async () => {
    try {
      const response = await api.get('/settings/customer-discounts')
      return response.data
    } catch (error) {
      console.error('Error fetching customer discounts:', error)
      throw error
    }
  },

  /**
   * Update customer discount rates (Admin only)
   * @param {Object} discounts - Discount percentages
   * @param {number} discounts.retail - Retail customer discount (0-100)
   * @param {number} discounts.wholesale - Wholesale customer discount (0-100)
   * @param {number} discounts.vip - VIP customer discount (0-100)
   * @returns {Promise<Object>} Updated discount data
   * @example
   * const response = await settingsService.updateCustomerDiscounts({
   *   retail: 12,
   *   wholesale: 18,
   *   vip: 25
   * })
   * // { success: true, message: '...', data: { retail: 12, wholesale: 18, vip: 25 } }
   */
  updateCustomerDiscounts: async (discounts) => {
    try {
      const response = await api.put('/settings/customer-discounts', discounts)
      return response.data
    } catch (error) {
      console.error('Error updating customer discounts:', error)
      throw error
    }
  },

  // ========== POS SECURITY ==========

  /**
   * Get POS security configuration
   * Available to all authenticated users (needed for POS auth)
   * @returns {Promise<Object>} POS security settings
   * @example
   * const response = await settingsService.getPOSSecurity()
   * // { success: true, data: { maxFailedAttempts: 5, lockDurationMinutes: 15, pinLength: 6 } }
   */
  getPOSSecurity: async () => {
    try {
      const response = await api.get('/settings/pos-security')
      return response.data
    } catch (error) {
      console.error('Error fetching POS security:', error)
      throw error
    }
  },

  /**
   * Update POS security configuration (Admin only)
   * @param {Object} security - POS security settings
   * @param {number} security.maxFailedAttempts - Max failed PIN attempts (1-10)
   * @param {number} security.lockDurationMinutes - Lock duration in minutes (1-1440)
   * @param {number} security.pinLength - Required PIN length (4-8)
   * @returns {Promise<Object>} Updated security configuration
   * @example
   * const response = await settingsService.updatePOSSecurity({
   *   maxFailedAttempts: 3,
   *   lockDurationMinutes: 30,
   *   pinLength: 6
   * })
   * // { success: true, message: '...', data: { maxFailedAttempts: 3, ... } }
   */
  updatePOSSecurity: async (security) => {
    try {
      const response = await api.put('/settings/pos-security', security)
      return response.data
    } catch (error) {
      console.error('Error updating POS security:', error)
      throw error
    }
  },

  /**
   * Reset customer discounts to default values
   * @returns {Promise<Object>} Reset discount data
   * @example
   * const response = await settingsService.resetCustomerDiscounts()
   * // { success: true, message: '...', data: { retail: 10, wholesale: 15, vip: 20 } }
   */
  resetCustomerDiscounts: async () => {
    try {
      const response = await api.post('/settings/customer-discounts/reset')
      return response.data
    } catch (error) {
      console.error('Error resetting customer discounts:', error)
      throw error
    }
  },

  /**
   * Reset POS security to default values
   * @returns {Promise<Object>} Reset security configuration
   * @example
   * const response = await settingsService.resetPOSSecurity()
   * // { success: true, message: '...', data: { maxFailedAttempts: 5, lockDurationMinutes: 15 } }
   */
  resetPOSSecurity: async () => {
    try {
      const response = await api.post('/settings/pos-security/reset')
      return response.data
    } catch (error) {
      console.error('Error resetting POS security:', error)
      throw error
    }
  },

  // ========== CONVENIENCE METHODS ==========

  /**
   * Get discount percentage for specific customer type
   * @param {string} customerType - Customer type (retail/wholesale/vip)
   * @returns {Promise<number>} Discount percentage for that type
   * @example
   * const discount = await settingsService.getDiscountByType('vip')
   * // 20
   */
  getDiscountByType: async (customerType) => {
    try {
      const response = await settingsService.getCustomerDiscounts()
      const discounts = response.data || {}
      return discounts[customerType] || 0
    } catch (error) {
      console.error('Error fetching discount by type:', error)
      return 0 // Return 0 if error
    }
  },

  /**
   * Update single discount rate (Admin only)
   * @param {string} customerType - Customer type (retail/wholesale/vip)
   * @param {number} percentage - Discount percentage (0-100)
   * @returns {Promise<Object>} Updated discounts
   * @example
   * await settingsService.updateSingleDiscount('retail', 15)
   */
  updateSingleDiscount: async (customerType, percentage) => {
    try {
      // Get current discounts
      const response = await settingsService.getCustomerDiscounts()
      const currentDiscounts = response.data || { retail: 10, wholesale: 15, vip: 20 }

      // Update specific type
      const updatedDiscounts = {
        ...currentDiscounts,
        [customerType]: parseFloat(percentage)
      }

      // Save updated discounts
      return await settingsService.updateCustomerDiscounts(updatedDiscounts)
    } catch (error) {
      console.error('Error updating single discount:', error)
      throw error
    }
  },

  /**
   * Reset discounts to defaults (Admin only)
   * @returns {Promise<Object>} Reset discounts
   * @example
   * await settingsService.resetDiscountsToDefaults()
   */
  resetDiscountsToDefaults: async () => {
    try {
      const defaultDiscounts = {
        retail: 10,
        wholesale: 15,
        vip: 20
      }
      return await settingsService.updateCustomerDiscounts(defaultDiscounts)
    } catch (error) {
      console.error('Error resetting discounts:', error)
      throw error
    }
  },

  /**
   * Update single POS security setting (Admin only)
   * @param {string} settingKey - Setting key (maxFailedAttempts/lockDurationMinutes/pinLength)
   * @param {number} value - Setting value
   * @returns {Promise<Object>} Updated POS security config
   * @example
   * await settingsService.updatePOSSecuritySetting('maxFailedAttempts', 5)
   */
  updatePOSSecuritySetting: async (settingKey, value) => {
    try {
      // Get current settings
      const response = await settingsService.getPOSSecurity()
      const currentSettings = response.data || { maxFailedAttempts: 5, lockDurationMinutes: 15 }

      // Update specific setting
      const updatedSettings = {
        ...currentSettings,
        [settingKey]: parseInt(value)
      }

      // Save updated settings
      return await settingsService.updatePOSSecurity(updatedSettings)
    } catch (error) {
      console.error('Error updating POS security setting:', error)
      throw error
    }
  },

  /**
   * Reset POS security to defaults (Admin only)
   * @returns {Promise<Object>} Reset POS security config
   * @example
   * await settingsService.resetPOSSecurityToDefaults()
   */
  resetPOSSecurityToDefaults: async () => {
    try {
      const defaultSettings = {
        maxFailedAttempts: 5,
        lockDurationMinutes: 15
      }
      return await settingsService.updatePOSSecurity(defaultSettings)
    } catch (error) {
      console.error('Error resetting POS security:', error)
      throw error
    }
  },

  /**
   * Validate discount values
   * @param {Object} discounts - Discount object to validate
   * @returns {Object} Validation result { valid: boolean, errors: Array }
   */
  validateDiscounts: (discounts) => {
    const errors = []
    const types = ['retail', 'wholesale', 'vip']

    types.forEach(type => {
      const value = discounts[type]

      if (value === undefined || value === null) {
        errors.push(`${type} discount is required`)
        return
      }

      const numValue = parseFloat(value)
      if (isNaN(numValue)) {
        errors.push(`${type} discount must be a number`)
        return
      }

      if (numValue < 0 || numValue > 100) {
        errors.push(`${type} discount must be between 0 and 100`)
      }
    })

    return {
      valid: errors.length === 0,
      errors
    }
  },

  /**
   * Validate POS security settings
   * @param {Object} security - Security object to validate
   * @returns {Object} Validation result { valid: boolean, errors: Array }
   */
  validatePOSSecurity: (security) => {
    const errors = []

    // Validate maxFailedAttempts
    if (security.maxFailedAttempts !== undefined && security.maxFailedAttempts !== null) {
      const attempts = parseInt(security.maxFailedAttempts)
      if (isNaN(attempts) || attempts < 1 || attempts > 10) {
        errors.push('Max failed attempts must be between 1 and 10')
      }
    }

    // Validate lockDurationMinutes
    if (security.lockDurationMinutes !== undefined && security.lockDurationMinutes !== null) {
      const duration = parseInt(security.lockDurationMinutes)
      if (isNaN(duration) || duration < 1 || duration > 1440) {
        errors.push('Lock duration must be between 1 and 1440 minutes (24 hours)')
      }
    }

    return {
      valid: errors.length === 0,
      errors
    }
  },

  /**
   * Format discount percentage for display
   * @param {number} value - Discount value
   * @returns {string} Formatted percentage
   * @example
   * settingsService.formatDiscount(15.5) // "15.5%"
   */
  formatDiscount: (value) => {
    const num = parseFloat(value)
    return isNaN(num) ? '0%' : `${num}%`
  },

  /**
   * Format lock duration for display
   * @param {number} minutes - Duration in minutes
   * @returns {string} Formatted duration
   * @example
   * settingsService.formatLockDuration(90) // "1h 30m"
   */
  formatLockDuration: (minutes) => {
    const mins = parseInt(minutes)
    if (isNaN(mins)) return '0m'

    if (mins < 60) {
      return `${mins}m`
    }

    const hours = Math.floor(mins / 60)
    const remainingMins = mins % 60

    if (remainingMins === 0) {
      return `${hours}h`
    }

    return `${hours}h ${remainingMins}m`
  },

  // ========== FRESH PRODUCT PROMOTION ==========

  /**
   * Run fresh product promotion immediately (manual trigger)
   * @returns {Promise<Object>} Result of promotion run
   * @example
   * const response = await settingsService.runPromotionNow()
   * // { success: true, data: { applied: 5, removed: 2, timestamp: ... } }
   */
  runPromotionNow: async () => {
    try {
      const response = await api.post('/settings/fresh-promotion/run')
      return response.data
    } catch (error) {
      console.error('Error running promotion:', error)
      throw error
    }
  },

  /**
   * Get promotion statistics
   * @returns {Promise<Object>} Promotion stats
   * @example
   * const response = await settingsService.getPromotionStats()
   * // { success: true, data: { totalFreshProducts: 10, activeBatchesWithPromotion: 5, ... } }
   */
  getPromotionStats: async () => {
    try {
      const response = await api.get('/settings/fresh-promotion/stats')
      return response.data
    } catch (error) {
      console.error('Error getting promotion stats:', error)
      throw error
    }
  },

  /**
   * Get scheduler status
   * @returns {Promise<Object>} Scheduler status
   * @example
   * const response = await settingsService.getSchedulerStatus()
   * // { success: true, data: { isRunning: true, currentSchedule: "0 17 * * *", ... } }
   */
  getSchedulerStatus: async () => {
    try {
      const response = await api.get('/settings/fresh-promotion/scheduler-status')
      return response.data
    } catch (error) {
      console.error('Error getting scheduler status:', error)
      throw error
    }
  },

  /**
   * Restart promotion scheduler with new settings
   * @returns {Promise<Object>} Updated scheduler status
   * @example
   * const response = await settingsService.restartPromotionScheduler()
   * // { success: true, message: '...', data: { isRunning: true, ... } }
   */
  restartPromotionScheduler: async () => {
    try {
      const response = await api.post('/settings/fresh-promotion/restart-scheduler')
      return response.data
    } catch (error) {
      console.error('Error restarting scheduler:', error)
      throw error
    }
  }
}

export default settingsService
