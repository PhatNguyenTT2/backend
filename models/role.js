const mongoose = require('mongoose')

const roleSchema = new mongoose.Schema({
  roleCode: {
    type: String,
    unique: true,
    uppercase: true,
    trim: true,
    match: [/^ROLE\d{3,}$/, 'Role code must follow format ROLE001, ROLE002, etc.']
    // Auto-generate: ROLE001, ROLE002, etc.
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
  }]

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
})

// Indexes for better query performance
roleSchema.index({ roleCode: 1 })
roleSchema.index({ roleName: 1 })

// Virtual to get user count
roleSchema.virtual('userCount', {
  ref: 'Employee',
  localField: '_id',
  foreignField: 'role',
  count: true
})

// Pre-save hook to generate role code
roleSchema.pre('save', async function (next) {
  if (this.isNew && !this.roleCode) {
    const count = await mongoose.model('Role').countDocuments()
    this.roleCode = `ROLE${String(count + 1).padStart(3, '0')}`
  }
  next()
})

// Method to update role information
roleSchema.methods.updateRole = function (updateData) {
  const allowedUpdates = ['roleName', 'description', 'permissions']
  Object.keys(updateData).forEach(key => {
    if (allowedUpdates.includes(key)) {
      this[key] = updateData[key]
    }
  })
  return this.save()
}

// Method to add permission
roleSchema.methods.addPermission = function (permission) {
  if (!this.permissions.includes(permission)) {
    this.permissions.push(permission)
    return this.save()
  }
  return this
}

// Method to remove permission
roleSchema.methods.removePermission = function (permission) {
  const index = this.permissions.indexOf(permission)
  if (index > -1) {
    this.permissions.splice(index, 1)
    return this.save()
  }
  return this
}

// Static method to find all roles
roleSchema.statics.findAllRoles = function () {
  return this.find().sort({ roleName: 1 })
}

// Static method to find role by code
roleSchema.statics.findByCode = function (roleCode) {
  return this.findOne({ roleCode: roleCode.toUpperCase() })
}

// Static method to get roles with user count
roleSchema.statics.getRolesWithUserCount = async function () {
  const Employee = mongoose.model('Employee')

  const roles = await this.find().sort({ roleName: 1 })

  const rolesWithCount = await Promise.all(
    roles.map(async (role) => {
      const count = await Employee.countDocuments({ role: role._id })
      return {
        ...role.toObject(),
        userCount: count
      }
    })
  )

  return rolesWithCount
}

// Static method to get statistics
roleSchema.statics.getStatistics = async function () {
  const Employee = mongoose.model('Employee')

  const totalRoles = await this.countDocuments()

  const rolesWithUsers = await this.aggregate([
    {
      $lookup: {
        from: 'employees',
        localField: '_id',
        foreignField: 'role',
        as: 'users'
      }
    },
    {
      $project: {
        roleName: 1,
        userCount: { $size: '$users' }
      }
    },
    {
      $sort: { userCount: -1 }
    }
  ])

  return {
    totalRoles,
    rolesWithUsers
  }
}

roleSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString()
    delete returnedObject._id
    delete returnedObject.__v
  }
})

module.exports = mongoose.model('Role', roleSchema)
