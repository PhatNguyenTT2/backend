const mongoose = require('mongoose')

const roleSchema = new mongoose.Schema({
  roleId: {
    type: String,
    required: [true, 'Role ID is required'],
    unique: true,
    uppercase: true,
    trim: true,
    minlength: [2, 'Role ID must be at least 2 characters long'],
    maxlength: [20, 'Role ID must be at most 20 characters long']
  },
  roleName: {
    type: String,
    required: [true, 'Role name is required'],
    trim: true,
    minlength: [2, 'Role name must be at least 2 characters long'],
    maxlength: [50, 'Role name must be at most 50 characters long']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [200, 'Description must be at most 200 characters long']
  },
  permissions: [{
    type: String,
    trim: true
  }],
  isActive: {
    type: Boolean,
    default: true
  }
},
  {
    timestamps: true
  })

// Indexes for better query performance
// Note: roleId already has index from 'unique: true'
roleSchema.index({ isActive: 1 })

roleSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString()
    delete returnedObject._id
    delete returnedObject.__v
  }
})

module.exports = mongoose.model('Role', roleSchema)
