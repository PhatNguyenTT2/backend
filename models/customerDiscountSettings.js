const mongoose = require('mongoose');

/**
 * CustomerDiscountSettings Model - Versioned Settings with Audit Log
 * 
 * Design:
 * - Each save creates a NEW version (immutable history)
 * - Only the LATEST version is active
 * - Old versions kept for audit trail
 * - Orders reference the version they used
 * 
 * Benefits:
 * ✅ Full audit trail - know exactly what discount was used when
 * ✅ Immutable history - cannot tamper with past settings
 * ✅ Easy rollback - just mark old version as active
 * ✅ Compliance-ready - track who changed what, when, why
 */
const customerDiscountSettingsSchema = new mongoose.Schema({
  // Version tracking
  version: {
    type: Number,
    required: true,
    unique: true,
    description: 'Auto-incremented version number'
  },

  isActive: {
    type: Boolean,
    default: false,
    index: true,
    description: 'Only ONE version can be active at a time'
  },

  // Discount rates
  discounts: {
    retail: {
      type: Number,
      required: true,
      min: [0, 'Discount cannot be negative'],
      max: [100, 'Discount cannot exceed 100%']
    },
    wholesale: {
      type: Number,
      required: true,
      min: [0, 'Discount cannot be negative'],
      max: [100, 'Discount cannot exceed 100%']
    },
    vip: {
      type: Number,
      required: true,
      min: [0, 'Discount cannot be negative'],
      max: [100, 'Discount cannot exceed 100%']
    }
  },

  // Audit fields
  effectiveFrom: {
    type: Date,
    default: Date.now,
    index: true,
    description: 'When this version becomes active'
  },

  effectiveTo: {
    type: Date,
    default: null,
    description: 'When this version was superseded (null = still active)'
  },

  changedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserAccount',
    description: 'User who created this version'
  },

  changeReason: {
    type: String,
    maxlength: 500,
    description: 'Why this change was made'
  },

  // Change tracking
  changes: {
    retail: {
      from: Number,
      to: Number
    },
    wholesale: {
      from: Number,
      to: Number
    },
    vip: {
      from: Number,
      to: Number
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ============ INDEXES ============
customerDiscountSettingsSchema.index({ version: 1 }, { unique: true });
customerDiscountSettingsSchema.index({ isActive: 1 });
customerDiscountSettingsSchema.index({ effectiveFrom: -1 });
customerDiscountSettingsSchema.index({ changedBy: 1 });

// ============ STATIC METHODS ============

/**
 * Get current active discount settings
 * @returns {Promise<Object>} { retail, wholesale, vip, version, effectiveFrom }
 */
customerDiscountSettingsSchema.statics.getActiveDiscounts = async function () {
  try {
    let activeSettings = await this.findOne({ isActive: true })
      .populate('changedBy', 'username email');

    // Create default if none exists
    if (!activeSettings) {
      activeSettings = await this.createVersion({
        retail: 10,
        wholesale: 15,
        vip: 20
      }, null, 'Initial default settings');
      console.log('✅ Created default customer discount settings');
    }

    return {
      retail: activeSettings.discounts.retail,
      wholesale: activeSettings.discounts.wholesale,
      vip: activeSettings.discounts.vip,
      version: activeSettings.version,
      effectiveFrom: activeSettings.effectiveFrom,
      changedBy: activeSettings.changedBy
    };
  } catch (error) {
    console.error('❌ Error getting active discounts:', error);
    // Fallback to defaults
    return {
      retail: 10,
      wholesale: 15,
      vip: 20,
      version: 0,
      effectiveFrom: new Date()
    };
  }
};

/**
 * Create new version of discount settings
 * @param {Object} newDiscounts - { retail, wholesale, vip }
 * @param {ObjectId} userId - User making the change
 * @param {String} reason - Why this change is made
 * @returns {Promise<CustomerDiscountSettings>} New version
 */
customerDiscountSettingsSchema.statics.createVersion = async function (newDiscounts, userId, reason = null) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Get current active version
    const currentActive = await this.findOne({ isActive: true }).session(session);

    // Calculate next version number
    const latestVersion = await this.findOne().sort({ version: -1 }).session(session);
    const nextVersion = latestVersion ? latestVersion.version + 1 : 1;

    // Calculate changes
    const changes = currentActive ? {
      retail: {
        from: currentActive.discounts.retail,
        to: newDiscounts.retail
      },
      wholesale: {
        from: currentActive.discounts.wholesale,
        to: newDiscounts.wholesale
      },
      vip: {
        from: currentActive.discounts.vip,
        to: newDiscounts.vip
      }
    } : null;

    // Deactivate current active version
    if (currentActive) {
      currentActive.isActive = false;
      currentActive.effectiveTo = new Date();
      await currentActive.save({ session });
    }

    // Create new version
    const newVersion = await this.create([{
      version: nextVersion,
      isActive: true,
      discounts: {
        retail: parseFloat(newDiscounts.retail),
        wholesale: parseFloat(newDiscounts.wholesale),
        vip: parseFloat(newDiscounts.vip)
      },
      effectiveFrom: new Date(),
      changedBy: userId,
      changeReason: reason,
      changes: changes
    }], { session });

    await session.commitTransaction();

    console.log(`✅ Created discount settings version ${nextVersion}:`, newVersion[0].discounts);
    return newVersion[0];

  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Get version history
 * @param {Number} limit - Max number of versions to return
 * @returns {Promise<Array>} Array of version objects
 */
customerDiscountSettingsSchema.statics.getHistory = async function (limit = 50) {
  return await this.find()
    .populate('changedBy', 'username email')
    .sort({ version: -1 })
    .limit(limit)
    .lean();
};

/**
 * Get version by number
 * @param {Number} versionNumber - Version to retrieve
 * @returns {Promise<CustomerDiscountSettings|null>}
 */
customerDiscountSettingsSchema.statics.getVersion = async function (versionNumber) {
  return await this.findOne({ version: versionNumber })
    .populate('changedBy', 'username email');
};

/**
 * Rollback to specific version (make it active)
 * @param {Number} versionNumber - Version to rollback to
 * @param {ObjectId} userId - User performing rollback
 * @param {String} reason - Reason for rollback
 * @returns {Promise<CustomerDiscountSettings>} Reactivated version
 */
customerDiscountSettingsSchema.statics.rollbackToVersion = async function (versionNumber, userId, reason) {
  const targetVersion = await this.getVersion(versionNumber);

  if (!targetVersion) {
    throw new Error(`Version ${versionNumber} not found`);
  }

  // Create new version with same discounts as target
  return await this.createVersion(
    targetVersion.discounts,
    userId,
    reason || `Rollback to version ${versionNumber}`
  );
};

/**
 * Get default discount values
 * @returns {Object} Default discounts
 */
customerDiscountSettingsSchema.statics.getDefaults = function () {
  return {
    retail: 10,
    wholesale: 15,
    vip: 20
  };
};

// ============ INSTANCE METHODS ============

/**
 * Check if this version has any changes compared to previous
 * @returns {Boolean}
 */
customerDiscountSettingsSchema.methods.hasChanges = function () {
  if (!this.changes) return false;

  return this.changes.retail?.from !== this.changes.retail?.to ||
    this.changes.wholesale?.from !== this.changes.wholesale?.to ||
    this.changes.vip?.from !== this.changes.vip?.to;
};

/**
 * Get summary of changes
 * @returns {Array<String>} Human-readable change descriptions
 */
customerDiscountSettingsSchema.methods.getChangeSummary = function () {
  if (!this.hasChanges()) return ['No changes'];

  const summary = [];

  if (this.changes.retail?.from !== this.changes.retail?.to) {
    summary.push(`Retail: ${this.changes.retail.from}% → ${this.changes.retail.to}%`);
  }
  if (this.changes.wholesale?.from !== this.changes.wholesale?.to) {
    summary.push(`Wholesale: ${this.changes.wholesale.from}% → ${this.changes.wholesale.to}%`);
  }
  if (this.changes.vip?.from !== this.changes.vip?.to) {
    summary.push(`VIP: ${this.changes.vip.from}% → ${this.changes.vip.to}%`);
  }

  return summary;
};

// ============ JSON TRANSFORMATION ============
customerDiscountSettingsSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString();
    delete returnedObject._id;
    delete returnedObject.__v;
  }
});

const CustomerDiscountSettings = mongoose.model('CustomerDiscountSettings', customerDiscountSettingsSchema);

module.exports = CustomerDiscountSettings;
