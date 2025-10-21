const mongoose = require('mongoose')

const departmentSchema = new mongoose.Schema({
  departmentCode: {
    type: String,
    unique: true,
    uppercase: true,
    trim: true,
    match: [/^DEPT\d{3,}$/, 'Department code must follow format DEPT001, DEPT002, etc.']
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
departmentSchema.index({ departmentCode: 1 })
departmentSchema.index({ isActive: 1 })
departmentSchema.index({ manager: 1 })

// Pre-save hook to generate department code
departmentSchema.pre('save', async function (next) {
  if (this.isNew && !this.departmentCode) {
    const count = await mongoose.model('Department').countDocuments()
    this.departmentCode = `DEPT${String(count + 1).padStart(3, '0')}`
  }
  next()
})

departmentSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString()
    delete returnedObject._id
    delete returnedObject.__v
  }
})

module.exports = mongoose.model('Department', departmentSchema)
