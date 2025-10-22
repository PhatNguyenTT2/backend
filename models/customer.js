const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  customerCode: {
    type: String,
    required: [true, 'Customer code is required'],
    unique: true,
    uppercase: true,
    trim: true,
    match: [/^CUST\d{10}$/, 'Customer code must follow format CUST2025000001']
    // Auto-generate: CUST2025000001
  },

  fullName: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true,
    maxlength: [100, 'Full name must be at most 100 characters']
  },

  email: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
  },

  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true,
    match: [/^[0-9]{10,15}$/, 'Please provide a valid phone number']
  },

  address: {
    type: String,
    trim: true,
    maxlength: [200, 'Address must be at most 200 characters']
  },

  dateOfBirth: {
    type: Date,
    validate: {
      validator: function (value) {
        return !value || value < new Date();
      },
      message: 'Date of birth must be in the past'
    }
  },

  gender: {
    type: String,
    enum: {
      values: ['male', 'female', 'other'],
      message: '{VALUE} is not a valid gender'
    },
    lowercase: true
  },

  isActive: {
    type: Boolean,
    default: true
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual: Customer details
customerSchema.virtual('details', {
  ref: 'DetailCustomer',
  localField: '_id',
  foreignField: 'customer',
  justOne: true
});

// Virtual: Orders count
customerSchema.virtual('orderCount', {
  ref: 'Order',
  localField: '_id',
  foreignField: 'customer',
  count: true
});

// Indexes for faster queries
customerSchema.index({ customerCode: 1 });
customerSchema.index({ email: 1 });
customerSchema.index({ phone: 1 });
customerSchema.index({ isActive: 1 });

// Pre-save hook to generate customer code
customerSchema.pre('save', async function (next) {
  if (this.isNew && !this.customerCode) {
    const year = new Date().getFullYear();
    const count = await mongoose.model('Customer').countDocuments();
    this.customerCode = `CUST${year}${String(count + 1).padStart(6, '0')}`;
  }
  next();
});

// Method to update customer
customerSchema.methods.updateCustomer = function (updates) {
  const allowedUpdates = ['fullName', 'email', 'phone', 'address', 'dateOfBirth', 'gender'];
  Object.keys(updates).forEach(key => {
    if (allowedUpdates.includes(key)) {
      this[key] = updates[key];
    }
  });
  return this.save();
};

// Method to activate/deactivate
customerSchema.methods.toggleActive = function () {
  this.isActive = !this.isActive;
  return this.save();
};

// Method to get customer with details
customerSchema.methods.getWithDetails = function () {
  return this.populate('details');
};

// Static method to find active customers
customerSchema.statics.findActiveCustomers = function () {
  return this.find({ isActive: true }).sort({ createdAt: -1 });
};

// Static method to search customers
customerSchema.statics.searchCustomers = function (searchTerm) {
  const searchRegex = new RegExp(searchTerm, 'i');
  return this.find({
    $or: [
      { fullName: searchRegex },
      { email: searchRegex },
      { phone: searchRegex },
      { customerCode: searchRegex }
    ],
    isActive: true
  });
};

// Static method to get customers by type
customerSchema.statics.getCustomersByType = async function (customerType) {
  const DetailCustomer = mongoose.model('DetailCustomer');

  const detailCustomers = await DetailCustomer.find({ customerType }).select('customer');
  const customerIds = detailCustomers.map(dc => dc.customer);

  return this.find({ _id: { $in: customerIds }, isActive: true });
};

// Static method to get statistics
customerSchema.statics.getStatistics = async function () {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        active: {
          $sum: { $cond: ['$isActive', 1, 0] }
        },
        inactive: {
          $sum: { $cond: ['$isActive', 0, 1] }
        }
      }
    }
  ]);

  // Get gender distribution
  const genderStats = await this.aggregate([
    {
      $match: { isActive: true }
    },
    {
      $group: {
        _id: '$gender',
        count: { $sum: 1 }
      }
    }
  ]);

  return {
    ...(stats[0] || { total: 0, active: 0, inactive: 0 }),
    genderDistribution: genderStats
  };
};

// Static method to get top customers by spending
customerSchema.statics.getTopCustomers = async function (limit = 10) {
  const DetailCustomer = mongoose.model('DetailCustomer');

  const topDetails = await DetailCustomer.find()
    .sort({ totalSpent: -1 })
    .limit(limit)
    .populate('customer');

  return topDetails.map(detail => ({
    customer: detail.customer,
    totalSpent: detail.totalSpent,
    customerType: detail.customerType
  }));
};

customerSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString();
    delete returnedObject._id;
    delete returnedObject.__v;
  }
});

module.exports = mongoose.model('Customer', customerSchema);
