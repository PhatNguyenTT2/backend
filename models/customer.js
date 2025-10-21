const mongoose = require('mongoose')

const customerSchema = new mongoose.Schema({
  customerCode: {
    type: String,
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
    minlength: [2, 'Full name must be at least 2 characters long'],
    maxlength: [100, 'Full name must be at most 100 characters long']
  },

  email: {
    type: String,
    unique: true,
    sparse: true, // Allow null for walk-in customers
    lowercase: true,
    trim: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please enter a valid email address']
  },

  phone: {
    type: String,
    required: [true, 'Phone is required'],
    trim: true,
    match: [/^[0-9]{10,15}$/, 'Please enter a valid phone number (10-15 digits)']
  },

  street: {
    type: String,
    trim: true,
    maxlength: [200, 'Street must be at most 200 characters long']
  },

  city: {
    type: String,
    trim: true,
    maxlength: [100, 'City must be at most 100 characters long']
  },

  dateOfBirth: {
    type: Date
  },

  gender: {
    type: String,
    enum: {
      values: ['male', 'female', 'other'],
      message: '{VALUE} is not a valid gender'
    }
  },

  customerType: {
    type: String,
    enum: {
      values: ['retail', 'wholesale', 'vip'],
      message: '{VALUE} is not a valid customer type'
    },
    default: 'retail'
  },

  totalSpent: {
    type: Number,
    default: 0,
    min: [0, 'Total spent cannot be negative']
  },

  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Notes must be at most 500 characters long']
  },

  isActive: {
    type: Boolean,
    default: true
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
})

// Virtual to calculate age
customerSchema.virtual('age').get(function () {
  if (!this.dateOfBirth) return null
  const today = new Date()
  const birthDate = new Date(this.dateOfBirth)
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--
  }
  return age
})

// Virtual for full address
customerSchema.virtual('fullAddress').get(function () {
  const parts = []
  if (this.street) parts.push(this.street)
  if (this.city) parts.push(this.city)
  return parts.length > 0 ? parts.join(', ') : null
})

// Indexes for faster queries
customerSchema.index({ customerCode: 1 })
customerSchema.index({ email: 1 })
customerSchema.index({ phone: 1 })
customerSchema.index({ customerType: 1 })
customerSchema.index({ isActive: 1 })

// Pre-save hook to generate customer code
customerSchema.pre('save', async function (next) {
  if (this.isNew && !this.customerCode) {
    const year = new Date().getFullYear()
    const count = await mongoose.model('Customer').countDocuments()
    this.customerCode = `CUST${year}${String(count + 1).padStart(6, '0')}`
  }
  next()
})

// Method to update total spent
customerSchema.methods.updateTotalSpent = function (amount) {
  this.totalSpent += amount

  // Auto-upgrade customer type based on total spent
  if (this.totalSpent >= 50000000 && this.customerType !== 'vip') {
    this.customerType = 'vip'
  } else if (this.totalSpent >= 20000000 && this.customerType === 'retail') {
    this.customerType = 'wholesale'
  }

  return this.save()
}

// Method to update profile
customerSchema.methods.updateProfile = function (profileData) {
  const allowedUpdates = ['fullName', 'email', 'phone', 'street', 'city', 'dateOfBirth', 'gender', 'notes']

  allowedUpdates.forEach(field => {
    if (profileData[field] !== undefined) {
      this[field] = profileData[field]
    }
  })

  return this.save()
}

// Method to upgrade customer type
customerSchema.methods.upgradeCustomerType = function (newType) {
  const typeHierarchy = ['retail', 'wholesale', 'vip']
  const currentIndex = typeHierarchy.indexOf(this.customerType)
  const newIndex = typeHierarchy.indexOf(newType)

  if (newIndex > currentIndex) {
    this.customerType = newType
    return this.save()
  }
  throw new Error('Cannot downgrade customer type')
}

// Method to deactivate customer
customerSchema.methods.deactivate = function () {
  this.isActive = false
  return this.save()
}

// Method to activate customer
customerSchema.methods.activate = function () {
  this.isActive = true
  return this.save()
}

// Static method to find by phone or email
customerSchema.statics.findByPhoneOrEmail = function (identifier) {
  return this.findOne({
    $or: [
      { phone: identifier },
      { email: identifier.toLowerCase() }
    ]
  })
}

// Static method to find active customers
customerSchema.statics.findActiveCustomers = function (query = {}) {
  return this.find({ ...query, isActive: true })
    .sort({ createdAt: -1 })
}

// Static method to get customers by type
customerSchema.statics.findByType = function (customerType) {
  return this.find({ customerType, isActive: true })
    .sort({ totalSpent: -1 })
}

// Static method to get customer statistics
customerSchema.statics.getStatistics = async function () {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        totalCustomers: { $sum: 1 },
        activeCustomers: {
          $sum: { $cond: ['$isActive', 1, 0] }
        },
        retailCustomers: {
          $sum: { $cond: [{ $eq: ['$customerType', 'retail'] }, 1, 0] }
        },
        wholesaleCustomers: {
          $sum: { $cond: [{ $eq: ['$customerType', 'wholesale'] }, 1, 0] }
        },
        vipCustomers: {
          $sum: { $cond: [{ $eq: ['$customerType', 'vip'] }, 1, 0] }
        },
        totalRevenue: { $sum: '$totalSpent' },
        averageSpent: { $avg: '$totalSpent' }
      }
    }
  ])

  return stats[0] || {
    totalCustomers: 0,
    activeCustomers: 0,
    retailCustomers: 0,
    wholesaleCustomers: 0,
    vipCustomers: 0,
    totalRevenue: 0,
    averageSpent: 0
  }
}

// Static method to get top customers
customerSchema.statics.getTopCustomers = function (limit = 10) {
  return this.find({ isActive: true })
    .sort({ totalSpent: -1 })
    .limit(limit)
    .select('customerCode fullName email phone totalSpent customerType')
}

customerSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString()
    delete returnedObject._id
    delete returnedObject.__v
  }
})

module.exports = mongoose.model('Customer', customerSchema)
