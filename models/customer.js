const mongoose = require('mongoose')

const customerSchema = new mongoose.Schema({
  customerCode: {
    type: String,
    unique: true,
    // Auto-generate: CUST2025000001
  },

  fullName: {
    type: String,
    required: true,
    trim: true
  },

  email: {
    type: String,
    unique: true,
    sparse: true, // Allow null for walk-in customers
    lowercase: true,
    trim: true
  },

  phone: {
    type: String,
    required: true,
    trim: true
  },

  address: {
    street: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    zipCode: { type: String, trim: true },
    country: { type: String, default: 'Vietnam' }
  },

  dateOfBirth: {
    type: Date
  },

  gender: {
    type: String,
    enum: ['male', 'female', 'other'],
  },

  customerType: {
    type: String,
    enum: ['retail', 'wholesale', 'vip'],
    default: 'retail'
  },

  loyaltyPoints: {
    type: Number,
    default: 0,
    min: 0
  },

  totalPurchases: {
    type: Number,
    default: 0,
    min: 0
  },

  totalSpent: {
    type: Number,
    default: 0,
    min: 0
  },

  notes: {
    type: String,
    trim: true
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

// Virtual for orders
customerSchema.virtual('orders', {
  ref: 'Order',
  localField: '_id',
  foreignField: 'customer'
})

// Index for faster queries
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

// Method to add loyalty points
customerSchema.methods.addLoyaltyPoints = function (points) {
  this.loyaltyPoints += points
  return this.save()
}

// Method to redeem loyalty points
customerSchema.methods.redeemLoyaltyPoints = function (points) {
  if (this.loyaltyPoints >= points) {
    this.loyaltyPoints -= points
    return this.save()
  }
  throw new Error('Insufficient loyalty points')
}

// Method to update purchase stats
customerSchema.methods.updatePurchaseStats = function (orderTotal) {
  this.totalPurchases += 1
  this.totalSpent += orderTotal

  // Auto-upgrade customer type based on total spent
  if (this.totalSpent >= 50000000 && this.customerType !== 'vip') {
    this.customerType = 'vip'
  } else if (this.totalSpent >= 20000000 && this.customerType === 'retail') {
    this.customerType = 'wholesale'
  }

  return this.save()
}

customerSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString()
    delete returnedObject._id
    delete returnedObject.__v
  }
})

module.exports = mongoose.model('Customer', customerSchema)
