const mongoose = require('mongoose')

const supplierSchema = new mongoose.Schema({
  supplierCode: {
    type: String,
    unique: true,
    trim: true,
    // Auto-generate: SUP2025000001
  },

  companyName: {
    type: String,
    required: [true, 'Company name is required'],
    trim: true,
    maxlength: [200, 'Company name must be at most 200 characters']
  },

  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address']
  },

  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true,
    match: [/^[0-9]{10,15}$/, 'Please enter a valid phone number (10-15 digits)']
  },

  street: {
    type: String,
    trim: true,
    maxlength: [200, 'Street must be at most 200 characters']
  },

  city: {
    type: String,
    trim: true,
    maxlength: [100, 'City must be at most 100 characters']
  },

  bankName: {
    type: String,
    trim: true,
    maxlength: [100, 'Bank name must be at most 100 characters']
  },

  accountNumber: {
    type: String,
    trim: true,
    maxlength: [50, 'Account number must be at most 50 characters']
  },

  paymentTerms: {
    type: String,
    enum: {
      values: ['cod', 'net15', 'net30', 'net60', 'net90'],
      message: '{VALUE} is not a valid payment term'
    },
    default: 'net30'
  },

  creditLimit: {
    type: Number,
    default: 0,
    min: [0, 'Credit limit cannot be negative']
  },

  currentDebt: {
    type: Number,
    default: 0,
    min: [0, 'Current debt cannot be negative']
  },

  notes: {
    type: String,
    trim: true,
    maxlength: [1000, 'Notes must be at most 1000 characters']
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

// Virtual for purchase orders
supplierSchema.virtual('purchaseOrders', {
  ref: 'PurchaseOrder',
  localField: '_id',
  foreignField: 'supplier'
})

// Virtual for full address
supplierSchema.virtual('fullAddress').get(function () {
  const parts = []
  if (this.street) parts.push(this.street)
  if (this.city) parts.push(this.city)
  return parts.join(', ') || 'No address provided'
})

// Virtual for bank account info
supplierSchema.virtual('bankAccountInfo').get(function () {
  if (!this.bankName && !this.accountNumber) {
    return 'No bank account information'
  }
  return `${this.bankName || 'N/A'} - ${this.accountNumber || 'N/A'}`
})

// Virtual for available credit
supplierSchema.virtual('availableCredit').get(function () {
  return Math.max(0, this.creditLimit - this.currentDebt)
})

// Index for faster queries
supplierSchema.index({ supplierCode: 1 })
supplierSchema.index({ email: 1 })
supplierSchema.index({ companyName: 1 })
supplierSchema.index({ isActive: 1 })

// Pre-save hook to generate supplier code
supplierSchema.pre('save', async function (next) {
  if (this.isNew && !this.supplierCode) {
    const year = new Date().getFullYear()
    const count = await mongoose.model('Supplier').countDocuments()
    this.supplierCode = `SUP${year}${String(count + 1).padStart(6, '0')}`
  }
  next()
})

// Method to update profile
supplierSchema.methods.updateProfile = function (updates) {
  const allowedUpdates = ['companyName', 'phone', 'street', 'city', 'bankName', 'accountNumber', 'paymentTerms', 'notes']
  Object.keys(updates).forEach(key => {
    if (allowedUpdates.includes(key)) {
      this[key] = updates[key]
    }
  })
  return this.save()
}

// Method to add debt
supplierSchema.methods.addDebt = function (amount) {
  if (amount <= 0) {
    throw new Error('Debt amount must be positive')
  }
  this.currentDebt += amount
  if (this.currentDebt > this.creditLimit) {
    throw new Error(`Credit limit exceeded. Available credit: ${this.availableCredit}`)
  }
  return this.save()
}

// Method to pay debt
supplierSchema.methods.payDebt = function (amount) {
  if (amount <= 0) {
    throw new Error('Payment amount must be positive')
  }
  if (amount > this.currentDebt) {
    throw new Error(`Payment amount (${amount}) exceeds current debt (${this.currentDebt})`)
  }
  this.currentDebt -= amount
  return this.save()
}

// Method to update credit limit
supplierSchema.methods.updateCreditLimit = function (newLimit) {
  if (newLimit < 0) {
    throw new Error('Credit limit cannot be negative')
  }
  if (newLimit < this.currentDebt) {
    throw new Error('New credit limit cannot be less than current debt')
  }
  this.creditLimit = newLimit
  return this.save()
}

// Method to deactivate supplier
supplierSchema.methods.deactivate = function () {
  this.isActive = false
  return this.save()
}

// Method to activate supplier
supplierSchema.methods.activate = function () {
  this.isActive = true
  return this.save()
}

// Static method to find active suppliers
supplierSchema.statics.findActiveSuppliers = function () {
  return this.find({ isActive: true }).sort({ companyName: 1 })
}

// Static method to find suppliers with debt
supplierSchema.statics.findSuppliersWithDebt = function () {
  return this.find({
    currentDebt: { $gt: 0 },
    isActive: true
  })
    .sort({ currentDebt: -1 })
    .select('supplierCode companyName currentDebt creditLimit phone email')
}

// Static method to search suppliers
supplierSchema.statics.searchSuppliers = function (searchTerm) {
  const searchRegex = new RegExp(searchTerm, 'i')
  return this.find({
    $or: [
      { supplierCode: searchRegex },
      { companyName: searchRegex },
      { email: searchRegex },
      { phone: searchRegex }
    ]
  }).sort({ companyName: 1 })
}

// Static method to get statistics
supplierSchema.statics.getStatistics = async function () {
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
        },
        totalDebt: { $sum: '$currentDebt' },
        totalCreditLimit: { $sum: '$creditLimit' },
        suppliersWithDebt: {
          $sum: { $cond: [{ $gt: ['$currentDebt', 0] }, 1, 0] }
        }
      }
    }
  ])

  return stats.length > 0 ? stats[0] : {
    total: 0,
    active: 0,
    inactive: 0,
    totalDebt: 0,
    totalCreditLimit: 0,
    suppliersWithDebt: 0
  }
}

supplierSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString()
    delete returnedObject._id
    delete returnedObject.__v
  }
})

module.exports = mongoose.model('Supplier', supplierSchema)