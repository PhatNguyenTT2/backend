const mongoose = require('mongoose')

const userAccountSchema = new mongoose.Schema({
  userCode: {
    type: String,
    unique: true,
    uppercase: true,
    trim: true,
    match: [/^USER\d{3,}$/, 'User code must follow format USER001, USER002, etc.']
    // Auto-generated in pre-save hook, not required on input
  },

  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    minlength: [3, 'Username must be at least 3 characters long'],
    maxlength: [20, 'Username must be at most 20 characters long'],
    trim: true
  },

  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please enter a valid email address']
  },

  passwordHash: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters long']
  },

  role: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Role',
    required: [true, 'Role is required']
  },

  isActive: {
    type: Boolean,
    default: true
  },

  // Auth tokens
  tokens: [{
    token: {
      type: String,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 604800 // 7 days (7 * 24 * 60 * 60)
    }
  }],

  // Password Reset
  resetPasswordToken: String,
  resetPasswordExpire: Date,

  // Last Login
  lastLogin: Date

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
})

// Virtual for employee profile
userAccountSchema.virtual('employee', {
  ref: 'Employee',
  localField: '_id',
  foreignField: 'userAccount',
  justOne: true
})

// Indexes for better query performance
userAccountSchema.index({ userCode: 1 })
userAccountSchema.index({ username: 1 })
userAccountSchema.index({ email: 1 })
userAccountSchema.index({ isActive: 1 })
userAccountSchema.index({ role: 1 })

// Pre-save hook to generate user code
userAccountSchema.pre('save', async function (next) {
  if (this.isNew && !this.userCode) {
    const count = await mongoose.model('UserAccount').countDocuments()
    this.userCode = `USER${String(count + 1).padStart(3, '0')}`
  }
  next()
})

// Method to add token
userAccountSchema.methods.generateAuthToken = function (token) {
  this.tokens.push({ token })
  return this.save()
}

// Method to remove token (logout)
userAccountSchema.methods.removeToken = function (token) {
  this.tokens = this.tokens.filter(t => t.token !== token)
  return this.save()
}

// Method to clear all tokens (logout all devices)
userAccountSchema.methods.clearAllTokens = function () {
  this.tokens = []
  return this.save()
}

// Method to update last login
userAccountSchema.methods.updateLastLogin = function () {
  this.lastLogin = new Date()
  return this.save()
}

// Method to deactivate account
userAccountSchema.methods.deactivate = function () {
  this.isActive = false
  this.tokens = [] // Clear all tokens
  return this.save()
}

// Method to activate account
userAccountSchema.methods.activate = function () {
  this.isActive = true
  return this.save()
}

// Static method to find by username or email
userAccountSchema.statics.findByUsernameOrEmail = function (identifier) {
  return this.findOne({
    $or: [
      { username: identifier },
      { email: identifier.toLowerCase() }
    ]
  })
}

// Static method to find active users
userAccountSchema.statics.findActiveUsers = function (query = {}) {
  return this.find({ ...query, isActive: true })
    .populate('role', 'roleName permissions')
    .populate({
      path: 'employee',
      populate: {
        path: 'department',
        select: 'departmentName'
      }
    })
    .sort({ createdAt: -1 })
}

// Static method to get user statistics
userAccountSchema.statics.getStatistics = async function () {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        totalUsers: { $sum: 1 },
        activeUsers: {
          $sum: { $cond: ['$isActive', 1, 0] }
        },
        inactiveUsers: {
          $sum: { $cond: ['$isActive', 0, 1] }
        },
        usersWithTokens: {
          $sum: { $cond: [{ $gt: [{ $size: '$tokens' }, 0] }, 1, 0] }
        }
      }
    }
  ])

  return stats[0] || {
    totalUsers: 0,
    activeUsers: 0,
    inactiveUsers: 0,
    usersWithTokens: 0
  }
}

userAccountSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString()
    delete returnedObject._id
    delete returnedObject.__v
    delete returnedObject.passwordHash
    delete returnedObject.tokens
  }
})

module.exports = mongoose.model('UserAccount', userAccountSchema)
