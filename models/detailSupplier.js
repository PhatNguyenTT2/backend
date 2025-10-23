const mongoose = require('mongoose')

const detailSupplierSchema = new mongoose.Schema({
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier',
    required: [true, 'Supplier is required'],
    unique: true
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
    type: mongoose.Schema.Types.Decimal128,
    default: 0,
    min: [0, 'Credit limit cannot be negative'],
    get: function (value) {
      if (value) {
        return parseFloat(value.toString())
      }
      return 0
    }
  },

  currentDebt: {
    type: mongoose.Schema.Types.Decimal128,
    default: 0,
    min: [0, 'Current debt cannot be negative'],
    get: function (value) {
      if (value) {
        return parseFloat(value.toString())
      }
      return 0
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
})

// Virtual for bank account info
detailSupplierSchema.virtual('bankAccountInfo').get(function () {
  if (!this.bankName && !this.accountNumber) {
    return 'No bank account information'
  }
  return `${this.bankName || 'N/A'} - ${this.accountNumber || 'N/A'}`
})

// Virtual for available credit
detailSupplierSchema.virtual('availableCredit').get(function () {
  return Math.max(0, this.creditLimit - this.currentDebt)
})

// Index for faster queries
detailSupplierSchema.index({ supplier: 1 })

// Method to update financial details
detailSupplierSchema.methods.updateFinancialDetails = function (updates) {
  const allowedUpdates = ['bankName', 'accountNumber', 'paymentTerms', 'notes']
  Object.keys(updates).forEach(key => {
    if (allowedUpdates.includes(key)) {
      this[key] = updates[key]
    }
  })
  return this.save()
}

// Method to add debt
detailSupplierSchema.methods.addDebt = function (amount) {
  if (amount <= 0) {
    throw new Error('Debt amount must be positive')
  }
  const newDebt = this.currentDebt + amount
  if (newDebt > this.creditLimit) {
    throw new Error(`Credit limit exceeded. Available credit: ${this.availableCredit}`)
  }
  this.currentDebt = newDebt
  return this.save()
}

// Method to pay debt
detailSupplierSchema.methods.payDebt = function (amount) {
  if (amount <= 0) {
    throw new Error('Payment amount must be positive')
  }
  if (amount > this.currentDebt) {
    throw new Error(`Payment amount (${amount}) exceeds current debt (${this.currentDebt})`)
  }
  this.currentDebt = this.currentDebt - amount
  return this.save()
}

// Method to update credit limit
detailSupplierSchema.methods.updateCreditLimit = function (newLimit) {
  if (newLimit < 0) {
    throw new Error('Credit limit cannot be negative')
  }
  if (newLimit < this.currentDebt) {
    throw new Error('New credit limit cannot be less than current debt')
  }
  this.creditLimit = newLimit
  return this.save()
}

// Static method to create detail for supplier
detailSupplierSchema.statics.createForSupplier = async function (supplierId, detailData = {}) {
  const Supplier = mongoose.model('Supplier')
  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    // Verify supplier exists
    const supplier = await Supplier.findById(supplierId).session(session)
    if (!supplier) {
      throw new Error('Supplier not found')
    }

    // Check if detail already exists
    const existingDetail = await this.findOne({ supplier: supplierId }).session(session)
    if (existingDetail) {
      throw new Error('Detail supplier already exists for this supplier')
    }

    // Create detail
    const detail = new this({
      supplier: supplierId,
      ...detailData
    })
    await detail.save({ session })

    await session.commitTransaction()
    return detail
  } catch (error) {
    await session.abortTransaction()
    throw error
  } finally {
    session.endSession()
  }
}

// Static method to find suppliers with debt
detailSupplierSchema.statics.findSuppliersWithDebt = function () {
  return this.find({
    currentDebt: { $gt: 0 }
  })
    .populate({
      path: 'supplier',
      match: { isActive: true },
      select: 'supplierCode companyName phone email'
    })
    .sort({ currentDebt: -1 })
}

// Static method to get debt statistics
detailSupplierSchema.statics.getDebtStatistics = async function () {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        totalDebt: { $sum: { $toDouble: '$currentDebt' } },
        totalCreditLimit: { $sum: { $toDouble: '$creditLimit' } },
        suppliersWithDebt: {
          $sum: { $cond: [{ $gt: [{ $toDouble: '$currentDebt' }, 0] }, 1, 0] }
        },
        averageDebt: { $avg: { $toDouble: '$currentDebt' } },
        averageCreditLimit: { $avg: { $toDouble: '$creditLimit' } }
      }
    }
  ])

  return stats.length > 0 ? {
    totalDebt: stats[0].totalDebt || 0,
    totalCreditLimit: stats[0].totalCreditLimit || 0,
    suppliersWithDebt: stats[0].suppliersWithDebt || 0,
    averageDebt: stats[0].averageDebt || 0,
    averageCreditLimit: stats[0].averageCreditLimit || 0
  } : {
    totalDebt: 0,
    totalCreditLimit: 0,
    suppliersWithDebt: 0,
    averageDebt: 0,
    averageCreditLimit: 0
  }
}

// Static method to get supplier by detail id
detailSupplierSchema.statics.getWithSupplier = function (detailId) {
  return this.findById(detailId)
    .populate('supplier', 'supplierCode companyName email phone address isActive')
}

detailSupplierSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString()
    delete returnedObject._id
    delete returnedObject.__v

    // Convert Decimal128 to number
    if (returnedObject.creditLimit && typeof returnedObject.creditLimit === 'object') {
      returnedObject.creditLimit = parseFloat(returnedObject.creditLimit.toString())
    }
    if (returnedObject.currentDebt && typeof returnedObject.currentDebt === 'object') {
      returnedObject.currentDebt = parseFloat(returnedObject.currentDebt.toString())
    }
  }
})

module.exports = mongoose.model('DetailSupplier', detailSupplierSchema)
