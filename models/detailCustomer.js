const mongoose = require('mongoose');

const detailCustomerSchema = new mongoose.Schema({
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: [true, 'Customer reference is required'],
    unique: true
  },

  customerType: {
    type: String,
    enum: {
      values: ['guest', 'retail', 'wholesale', 'vip'],
      message: '{VALUE} is not a valid customer type'
    },
    default: 'retail',
    lowercase: true
  },

  totalSpent: {
    type: mongoose.Schema.Types.Decimal128,
    default: 0,
    min: [0, 'Total spent cannot be negative'],
    get: function (value) {
      if (value) {
        return parseFloat(value.toString());
      }
      return 0;
    }
  },

  notes: {
    type: String,
    trim: true,
    maxlength: [1000, 'Notes must be at most 1000 characters']
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true, getters: true },
  toObject: { virtuals: true, getters: true }
});

// Indexes for faster queries
detailCustomerSchema.index({ customer: 1 });
detailCustomerSchema.index({ customerType: 1 });
detailCustomerSchema.index({ totalSpent: -1 });

// Method to update customer type
detailCustomerSchema.methods.updateCustomerType = function (newType) {
  const validTypes = ['guest', 'retail', 'wholesale', 'vip'];
  if (validTypes.includes(newType)) {
    this.customerType = newType;
    return this.save();
  }
  throw new Error('Invalid customer type');
};

// Method to add spending
detailCustomerSchema.methods.addSpending = function (amount) {
  if (amount < 0) {
    throw new Error('Amount cannot be negative');
  }

  const currentSpent = parseFloat(this.totalSpent.toString());
  this.totalSpent = currentSpent + amount;

  // Auto-upgrade customer type based on total spending
  this.autoUpgradeCustomerType();

  return this.save();
};

// Method to subtract spending (e.g., for refunds)
detailCustomerSchema.methods.subtractSpending = function (amount) {
  if (amount < 0) {
    throw new Error('Amount cannot be negative');
  }

  const currentSpent = parseFloat(this.totalSpent.toString());
  this.totalSpent = Math.max(0, currentSpent - amount);

  return this.save();
};

// Method to auto-upgrade customer type based on spending thresholds
detailCustomerSchema.methods.autoUpgradeCustomerType = function () {
  const spent = parseFloat(this.totalSpent.toString());

  // Define spending thresholds (can be configured)
  const thresholds = {
    vip: 50000000,      // 50 million
    wholesale: 20000000, // 20 million
    retail: 1000000      // 1 million
  };

  if (spent >= thresholds.vip) {
    this.customerType = 'vip';
  } else if (spent >= thresholds.wholesale) {
    this.customerType = 'wholesale';
  } else if (spent >= thresholds.retail) {
    this.customerType = 'retail';
  } else {
    this.customerType = 'guest';
  }
};

// Method to update notes
detailCustomerSchema.methods.updateNotes = function (notes) {
  this.notes = notes;
  return this.save();
};

// Static method to get statistics by customer type
detailCustomerSchema.statics.getStatisticsByType = async function () {
  const stats = await this.aggregate([
    {
      $group: {
        _id: '$customerType',
        count: { $sum: 1 },
        totalSpending: {
          $sum: { $toDouble: '$totalSpent' }
        },
        avgSpending: {
          $avg: { $toDouble: '$totalSpent' }
        }
      }
    },
    {
      $sort: { totalSpending: -1 }
    }
  ]);

  return stats;
};

// Static method to get overall statistics
detailCustomerSchema.statics.getOverallStatistics = async function () {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        totalCustomers: { $sum: 1 },
        totalRevenue: {
          $sum: { $toDouble: '$totalSpent' }
        },
        avgSpending: {
          $avg: { $toDouble: '$totalSpent' }
        },
        maxSpending: {
          $max: { $toDouble: '$totalSpent' }
        },
        minSpending: {
          $min: { $toDouble: '$totalSpent' }
        }
      }
    }
  ]);

  return stats[0] || {
    totalCustomers: 0,
    totalRevenue: 0,
    avgSpending: 0,
    maxSpending: 0,
    minSpending: 0
  };
};

// Static method to find customers by type
detailCustomerSchema.statics.findByType = function (customerType) {
  return this.find({ customerType }).populate('customer');
};

// Static method to get high-value customers
detailCustomerSchema.statics.getHighValueCustomers = function (minSpending = 10000000) {
  return this.find({
    totalSpent: { $gte: minSpending }
  })
    .sort({ totalSpent: -1 })
    .populate('customer');
};

// Static method to get customers with low spending (potential for engagement)
detailCustomerSchema.statics.getLowSpendingCustomers = function (maxSpending = 1000000) {
  return this.find({
    totalSpent: { $lte: maxSpending }
  })
    .sort({ totalSpent: 1 })
    .populate('customer');
};

detailCustomerSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString();
    delete returnedObject._id;
    delete returnedObject.__v;

    // Convert Decimal128 to number
    if (returnedObject.totalSpent) {
      returnedObject.totalSpent = parseFloat(returnedObject.totalSpent.toString());
    }
  }
});

module.exports = mongoose.model('DetailCustomer', detailCustomerSchema);
