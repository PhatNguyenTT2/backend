const mongoose = require('mongoose');

/**
 * SystemSettings Model - Refactored to Single Document Pattern
 * Stores ALL system-wide configuration in ONE document for simplicity
 * 
 * Features:
 * - Customer discount rates by type (retail, wholesale, vip)
 * - POS security configuration (PIN attempts, lock duration)
 * - Future: Business info, general settings, etc.
 * 
 * Design Benefits:
 * ✅ Single document = atomic updates, no race conditions
 * ✅ No confusion about which document stores which setting
 * ✅ Easy to extend with new setting categories
 * ✅ Simpler code - no settingKey enum to maintain
 * 
 * Usage:
 * - Only ONE document exists in the collection
 * - Auto-created with defaults on first access
 * - Static methods for easy access to specific sections
 */
const systemSettingsSchema = new mongoose.Schema({
  // POS Security configuration
  posSecurity: {
    maxFailedAttempts: {
      type: Number,
      default: 5,
      min: [1, 'Must allow at least 1 attempt'],
      max: [10, 'Cannot exceed 10 attempts'],
      description: 'Maximum failed PIN attempts before account lock'
    },
    lockDurationMinutes: {
      type: Number,
      default: 15,
      min: [1, 'Lock duration must be at least 1 minute'],
      max: [1440, 'Lock duration cannot exceed 24 hours (1440 minutes)'],
      description: 'Duration (in minutes) to lock account after max failed attempts'
    }
  },

  // Fresh Product Auto-Promotion configuration
  freshProductPromotion: {
    autoPromotionEnabled: {
      type: Boolean,
      default: false,
      description: 'Enable/disable automatic promotion for fresh products'
    },
    promotionStartTime: {
      type: String,
      default: '17:00',
      description: 'Time to start promotion each day (HH:MM format, 24-hour)'
    },
    discountPercentage: {
      type: Number,
      default: 20,
      min: [0, 'Discount cannot be negative'],
      max: [100, 'Discount cannot exceed 100%'],
      description: 'Discount percentage for fresh products'
    },
    applyToExpiringToday: {
      type: Boolean,
      default: true,
      description: 'Apply promotion to batches expiring within 24 hours'
    },
    applyToExpiringTomorrow: {
      type: Boolean,
      default: false,
      description: 'Apply promotion to batches expiring within 48 hours'
    }
  },
  // Last updated tracking
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    description: 'Employee who last updated any setting'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true, getters: true },
  toObject: { virtuals: true, getters: true }
});

// ============ INDEXES ============
systemSettingsSchema.index({ updatedAt: -1 });

// ============ STATIC METHODS ============

/**
 * Get or create the single settings document
 * Auto-creates with default values if not exists
 * @returns {Promise<SystemSettings>} The single settings document
 */
systemSettingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne();

  // Create default document if not exists
  if (!settings) {
    settings = await this.create({
      posSecurity: {
        maxFailedAttempts: 5,
        lockDurationMinutes: 15
      }
    });
    console.log('✅ Created default system settings document');
  }

  return settings;
};

/**
 * Get POS security settings
 * @returns {Promise<Object>} { maxFailedAttempts, lockDurationMinutes }
 */
systemSettingsSchema.statics.getPOSSecurity = async function () {
  try {
    const settings = await this.getSettings();
    return {
      maxFailedAttempts: settings.posSecurity.maxFailedAttempts,
      lockDurationMinutes: settings.posSecurity.lockDurationMinutes
    };
  } catch (error) {
    console.error('❌ Error getting POS security settings:', error);
    // Return defaults on error
    return {
      maxFailedAttempts: 5,
      lockDurationMinutes: 15
    };
  }
};

/**
 * Update POS security settings
 * @param {Object} security - { maxFailedAttempts, lockDurationMinutes }
 * @param {ObjectId} employeeId - Employee making the update
 * @returns {Promise<SystemSettings>} Updated settings document
 */
systemSettingsSchema.statics.updatePOSSecurity = async function (security, employeeId) {
  const { maxFailedAttempts, lockDurationMinutes } = security;

  // Validate values
  if (maxFailedAttempts !== undefined) {
    if (maxFailedAttempts < 1 || maxFailedAttempts > 10) {
      throw new Error('Max failed attempts must be between 1 and 10');
    }
  }

  if (lockDurationMinutes !== undefined) {
    if (lockDurationMinutes < 1 || lockDurationMinutes > 1440) {
      throw new Error('Lock duration must be between 1 and 1440 minutes (24 hours)');
    }
  }

  const settings = await this.getSettings();

  // Update only provided fields
  if (maxFailedAttempts !== undefined) {
    settings.posSecurity.maxFailedAttempts = parseInt(maxFailedAttempts);
  }
  if (lockDurationMinutes !== undefined) {
    settings.posSecurity.lockDurationMinutes = parseInt(lockDurationMinutes);
  }

  settings.updatedBy = employeeId;
  await settings.save();

  console.log('✅ POS security settings updated:', settings.posSecurity);
  return settings;
};

/**
 * Reset POS security to default values
 * @param {ObjectId} employeeId - Employee making the reset
 * @returns {Promise<SystemSettings>} Updated settings document
 */
systemSettingsSchema.statics.resetPOSSecurity = async function (employeeId) {
  const defaults = this.getDefaults();
  return await this.updatePOSSecurity(defaults.posSecurity, employeeId);
};

// ============ JSON TRANSFORMATION ============
systemSettingsSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString();
    delete returnedObject._id;
    delete returnedObject.__v;
  }
});

const SystemSettings = mongoose.model('SystemSettings', systemSettingsSchema);

module.exports = SystemSettings;
