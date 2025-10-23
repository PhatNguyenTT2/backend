const mongoose = require('mongoose')

const supplierSchema = new mongoose.Schema({
  supplierCode: {
    type: String,
    unique: true,
    required: [true, 'Supplier code is required'],
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

  address: {
    type: String,
    trim: true,
    maxlength: [500, 'Address must be at most 500 characters']
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

// Virtual for detail supplier (1-1 relationship)
supplierSchema.virtual('detailSupplier', {
  ref: 'DetailSupplier',
  localField: '_id',
  foreignField: 'supplier',
  justOne: true
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
  const allowedUpdates = ['companyName', 'phone', 'address']
  Object.keys(updates).forEach(key => {
    if (allowedUpdates.includes(key)) {
      this[key] = updates[key]
    }
  })
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
  return this.find({ isActive: true })
    .populate('detailSupplier')
    .sort({ companyName: 1 })
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
  })
    .populate('detailSupplier')
    .sort({ companyName: 1 })
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
        }
      }
    }
  ])

  if (stats.length === 0) {
    return {
      total: 0,
      active: 0,
      inactive: 0
    }
  }

  // Get debt statistics from DetailSupplier
  const DetailSupplier = mongoose.model('DetailSupplier')
  const debtStats = await DetailSupplier.getDebtStatistics()

  return {
    ...stats[0],
    ...debtStats
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