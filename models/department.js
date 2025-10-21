const mongoose = require('mongoose')

const departmentSchema = new mongoose.Schema({
  departmentCode: {
    type: String,
    unique: true,
    uppercase: true,
    trim: true,
    match: [/^DEPT\d{3,}$/, 'Department code must follow format DEPT001, DEPT002, etc.']
    // Auto-generate: DEPT001, DEPT002, etc.
  },

  departmentName: {
    type: String,
    required: [true, 'Department name is required'],
    trim: true,
    minlength: [2, 'Department name must be at least 2 characters long'],
    maxlength: [100, 'Department name must be at most 100 characters long']
  },

  description: {
    type: String,
    trim: true,
    maxlength: [300, 'Description must be at most 300 characters long']
  },

  manager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  },

  location: {
    type: String,
    trim: true,
    maxlength: [100, 'Location must be at most 100 characters long']
  },

  phone: {
    type: String,
    trim: true,
    match: [/^[0-9]{10,15}$/, 'Please enter a valid phone number (10-15 digits)']
  },

  email: {
    type: String,
    lowercase: true,
    trim: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please enter a valid email address']
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

// Indexes for better query performance
departmentSchema.index({ departmentCode: 1 })
departmentSchema.index({ departmentName: 1 })
departmentSchema.index({ isActive: 1 })
departmentSchema.index({ manager: 1 })

// Virtual to get employee count
departmentSchema.virtual('employeeCount', {
  ref: 'Employee',
  localField: '_id',
  foreignField: 'department',
  count: true
})

// Pre-save hook to generate department code
departmentSchema.pre('save', async function (next) {
  if (this.isNew && !this.departmentCode) {
    const count = await mongoose.model('Department').countDocuments()
    this.departmentCode = `DEPT${String(count + 1).padStart(3, '0')}`
  }
  next()
})

// Method to update department information
departmentSchema.methods.updateDepartment = function (updateData) {
  const allowedUpdates = ['departmentName', 'description', 'manager', 'location', 'phone', 'email', 'isActive']
  Object.keys(updateData).forEach(key => {
    if (allowedUpdates.includes(key)) {
      this[key] = updateData[key]
    }
  })
  return this.save()
}

// Method to assign manager
departmentSchema.methods.assignManager = function (managerId) {
  this.manager = managerId
  return this.save()
}

// Method to toggle active status
departmentSchema.methods.toggleActive = function () {
  this.isActive = !this.isActive
  return this.save()
}

// Static method to find active departments
departmentSchema.statics.findActiveDepartments = function () {
  return this.find({ isActive: true })
    .populate('manager', 'fullName email')
    .sort({ departmentName: 1 })
}

// Static method to find department by code
departmentSchema.statics.findByCode = function (departmentCode) {
  return this.findOne({ departmentCode: departmentCode.toUpperCase() })
    .populate('manager', 'fullName email')
}

// Static method to get departments with employee count
departmentSchema.statics.getDepartmentsWithEmployeeCount = async function () {
  const Employee = mongoose.model('Employee')

  const departments = await this.find()
    .populate('manager', 'fullName email')
    .sort({ departmentName: 1 })

  const departmentsWithCount = await Promise.all(
    departments.map(async (dept) => {
      const count = await Employee.countDocuments({ department: dept._id })
      return {
        ...dept.toObject(),
        employeeCount: count
      }
    })
  )

  return departmentsWithCount
}

// Static method to get department statistics
departmentSchema.statics.getStatistics = async function () {
  const Employee = mongoose.model('Employee')

  const totalDepartments = await this.countDocuments()
  const activeDepartments = await this.countDocuments({ isActive: true })
  const inactiveDepartments = totalDepartments - activeDepartments
  const departmentsWithManager = await this.countDocuments({ manager: { $ne: null } })

  const departmentsWithEmployees = await this.aggregate([
    {
      $lookup: {
        from: 'employees',
        localField: '_id',
        foreignField: 'department',
        as: 'employees'
      }
    },
    {
      $project: {
        departmentName: 1,
        employeeCount: { $size: '$employees' }
      }
    },
    {
      $sort: { employeeCount: -1 }
    }
  ])

  return {
    totalDepartments,
    activeDepartments,
    inactiveDepartments,
    departmentsWithManager,
    departmentsWithEmployees
  }
}

// Static method to find departments without manager
departmentSchema.statics.findWithoutManager = function () {
  return this.find({ manager: null, isActive: true })
    .sort({ departmentName: 1 })
}

departmentSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString()
    delete returnedObject._id
    delete returnedObject.__v
  }
})

module.exports = mongoose.model('Department', departmentSchema)
