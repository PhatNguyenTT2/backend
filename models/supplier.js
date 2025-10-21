const mongoose = require('mongoose')

const supplierSchema = new mongoose.Schema({
  supplierCode: {
    type: String,
    unique: true,
    // Auto-generate: SUP2025000001 (if not provided)
  },

  companyName: {
    type: String,
    required: true,
    trim: true
  },

  contactPerson: {
    name: { type: String, trim: true },
    position: { type: String, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true }
  },

  email: {
    type: String,
    required: true,
    unique: true,
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

  taxId: {
    type: String,
    unique: true,
    sparse: true,
    trim: true
  },

  bankAccount: {
    bankName: { type: String, trim: true },
    accountNumber: { type: String, trim: true },
    accountName: { type: String, trim: true },
    swiftCode: { type: String, trim: true }
  },

  paymentTerms: {
    type: String,
    enum: ['cod', 'net15', 'net30', 'net60', 'net90'],
    default: 'net30'
  },

  creditLimit: {
    type: Number,
    default: 0,
    min: 0
  },

  currentDebt: {
    type: Number,
    default: 0,
    min: 0
  },

  productsSupplied: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }],

  rating: {
    type: Number,
    min: 0,
    max: 5,
    default: 0
  },

  totalPurchaseOrders: {
    type: Number,
    default: 0,
    min: 0
  },

  totalPurchaseAmount: {
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

// Virtual for purchase orders
supplierSchema.virtual('purchaseOrders', {
  ref: 'PurchaseOrder',
  localField: '_id',
  foreignField: 'supplier'
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

// Method to update rating
supplierSchema.methods.updateRating = function (newRating) {
  if (newRating < 0 || newRating > 5) {
    throw new Error('Rating must be between 0 and 5')
  }
  this.rating = newRating
  return this.save()
}

// Method to update purchase stats
supplierSchema.methods.updatePurchaseStats = function (orderTotal) {
  this.totalPurchaseOrders += 1
  this.totalPurchaseAmount += orderTotal
  return this.save()
}

// Method to add debt
supplierSchema.methods.addDebt = function (amount) {
  this.currentDebt += amount
  if (this.currentDebt > this.creditLimit) {
    throw new Error('Credit limit exceeded')
  }
  return this.save()
}

// Method to pay debt
supplierSchema.methods.payDebt = function (amount) {
  if (amount > this.currentDebt) {
    throw new Error('Payment amount exceeds current debt')
  }
  this.currentDebt -= amount
  return this.save()
}

supplierSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString()
    delete returnedObject._id
    delete returnedObject.__v
  }
})

module.exports = mongoose.model('Supplier', supplierSchema)
