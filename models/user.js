const mongoose = require('mongoose')

const userSchema = new mongoose.Schema({
  userCode: {
    type: String,
    required: [true, 'User code is required'],
    unique: true,
    uppercase: true,
    trim: true,
    match: [/^USER\d{3,}$/, 'User code must follow format USER001, USER002, etc.']
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
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please enter a valid email address']
  },
  fullName: {
    type: String,
    required: [true, 'Full name is required'],
    minlength: [3, 'Full name must be at least 3 characters long'],
    maxlength: [50, 'Full name must be at most 50 characters long'],
    trim: true
  },
  passwordHash: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters long']
  },
  // Role & Department References
  role: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Role',
    required: [true, 'Role is required']
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department'
  },
  // Status
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

  // Timestamps
  lastLogin: Date
},
  {
    timestamps: true
  }
)

// Indexes for better query performance
// Note: userCode, username, email already have indexes from 'unique: true'
userSchema.index({ isActive: 1 })
userSchema.index({ role: 1 })
userSchema.index({ department: 1 })

userSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString()
    delete returnedObject._id
    delete returnedObject.__v
    delete returnedObject.passwordHash
    delete returnedObject.tokens
  }
})

module.exports = mongoose.model('User', userSchema)
