const mongoose = require('mongoose')

const employeeSchema = new mongoose.Schema({
  userAccount: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserAccount',
    required: [true, 'User account is required'],
    unique: true
  },

  fullName: {
    type: String,
    required: [true, 'Full name is required'],
    minlength: [3, 'Full name must be at least 3 characters long'],
    maxlength: [100, 'Full name must be at most 100 characters long'],
    trim: true
  },

  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department'
  },

  phone: {
    type: String,
    trim: true,
    match: [/^[0-9]{10,15}$/, 'Please enter a valid phone number (10-15 digits)']
  },

  address: {
    type: String,
    trim: true,
    maxlength: [200, 'Address must be at most 200 characters long']
  },

  dateOfBirth: {
    type: Date
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
})

// Virtual to calculate age
employeeSchema.virtual('age').get(function () {
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

// Indexes for faster queries
employeeSchema.index({ userAccount: 1 })
employeeSchema.index({ department: 1 })
employeeSchema.index({ fullName: 'text' })

// Method to update profile
employeeSchema.methods.updateProfile = function (profileData) {
  const allowedUpdates = ['fullName', 'phone', 'address', 'dateOfBirth', 'department']

  allowedUpdates.forEach(field => {
    if (profileData[field] !== undefined) {
      this[field] = profileData[field]
    }
  })

  return this.save()
}

// Method to change department
employeeSchema.methods.changeDepartment = function (newDepartmentId) {
  this.department = newDepartmentId
  return this.save()
}

// Static method to find by user account
employeeSchema.statics.findByUserAccount = function (userAccountId) {
  return this.findOne({ userAccount: userAccountId })
    .populate('userAccount', 'username email role isActive')
    .populate('department', 'departmentName departmentId')
}

// Static method to find employees by department
employeeSchema.statics.findByDepartment = function (departmentId) {
  return this.find({ department: departmentId })
    .populate({
      path: 'userAccount',
      match: { isActive: true },
      select: 'username email userCode isActive'
    })
    .sort({ fullName: 1 })
}

// Static method to get all employees with details
employeeSchema.statics.getAllWithDetails = function (query = {}) {
  return this.find(query)
    .populate({
      path: 'userAccount',
      select: 'username email userCode role isActive lastLogin',
      populate: {
        path: 'role',
        select: 'roleName'
      }
    })
    .populate('department', 'departmentName departmentId location')
    .sort({ createdAt: -1 })
}

// Static method to search employees
employeeSchema.statics.searchEmployees = function (searchTerm) {
  return this.find({
    $or: [
      { fullName: { $regex: searchTerm, $options: 'i' } },
      { phone: { $regex: searchTerm, $options: 'i' } }
    ]
  })
    .populate('userAccount', 'username email userCode')
    .populate('department', 'departmentName')
    .limit(20)
}

// Static method to get employee statistics by department
employeeSchema.statics.getStatisticsByDepartment = async function () {
  const stats = await this.aggregate([
    {
      $lookup: {
        from: 'departments',
        localField: 'department',
        foreignField: '_id',
        as: 'departmentInfo'
      }
    },
    {
      $unwind: {
        path: '$departmentInfo',
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $group: {
        _id: '$department',
        departmentName: { $first: '$departmentInfo.departmentName' },
        employeeCount: { $sum: 1 },
        employees: {
          $push: {
            id: '$_id',
            fullName: '$fullName',
            phone: '$phone'
          }
        }
      }
    },
    {
      $sort: { employeeCount: -1 }
    }
  ])

  return stats
}

// Static method to create employee with user account
employeeSchema.statics.createWithUserAccount = async function (userData, employeeData) {
  const UserAccount = mongoose.model('UserAccount')
  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    // Create user account
    const userAccount = new UserAccount(userData)
    await userAccount.save({ session })

    // Create employee profile
    const employee = new this({
      ...employeeData,
      userAccount: userAccount._id
    })
    await employee.save({ session })

    await session.commitTransaction()

    // Return populated employee
    return await this.findById(employee._id)
      .populate('userAccount', '-passwordHash -tokens')
      .populate('department')
  } catch (error) {
    await session.abortTransaction()
    throw error
  } finally {
    session.endSession()
  }
}

employeeSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString()
    delete returnedObject._id
    delete returnedObject.__v
  }
})

module.exports = mongoose.model('Employee', employeeSchema)
