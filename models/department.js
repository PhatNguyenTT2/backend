const mongoose = require('mongoose')

const departmentSchema = new mongoose.Schema({
  departmentId: {
    type: String,
    required: [true, 'Department ID is required'],
    unique: true,
    uppercase: true,
    trim: true,
    minlength: [2, 'Department ID must be at least 2 characters long'],
    maxlength: [20, 'Department ID must be at most 20 characters long']
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
    ref: 'User'
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
},
  {
    timestamps: true
  })

// Indexes for better query performance
// Note: departmentId already has index from 'unique: true'
departmentSchema.index({ isActive: 1 })
departmentSchema.index({ manager: 1 })

departmentSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString()
    delete returnedObject._id
    delete returnedObject.__v
  }
})

module.exports = mongoose.model('Department', departmentSchema)
