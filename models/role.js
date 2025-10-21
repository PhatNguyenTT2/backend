const mongoose = require('mongoose')

const roleSchema = new mongoose.Schema({
  roleCode: {
    type: String,
    unique: true,
    uppercase: true,
    trim: true,
    match: [/^ROLE\d{3,}$/, 'Role code must follow format ROLE001, ROLE002, etc.']
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
roleSchema.index({ roleCode: 1 })
roleSchema.index({ isActive: 1 })

// Pre-save hook to generate role code
roleSchema.pre('save', async function (next) {
  if (this.isNew && !this.roleCode) {
    const count = await mongoose.model('Role').countDocuments()
    this.roleCode = `ROLE${String(count + 1).padStart(3, '0')}`
  }
  next()
})

roleSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString()
    delete returnedObject._id
    delete returnedObject.__v
  }
})

module.exports = mongoose.model('Role', roleSchema)
