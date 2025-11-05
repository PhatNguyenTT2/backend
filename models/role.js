const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema({
  roleCode: {
    type: String,
    unique: true,
    uppercase: true,
    trim: true,
    match: [/^ROLE\d{3,}$/, 'Role code must follow format ROLE001, ROLE002, etc.']
    // Auto-generated in pre-save hook
  },

  roleName: {
    type: String,
    required: [true, 'Role name is required'],
    trim: true,
    minlength: 2,
    maxlength: 50
  },

  description: {
    type: String,
    trim: true,
    maxlength: 200,
    default: null
  },

  permissions: [{
    type: String,
    trim: true
  }]

}, {
  timestamps: true
});

// Indexes for better query performance
roleSchema.index({ roleCode: 1 });
roleSchema.index({ roleName: 1 });

// Virtual: User count relationship
roleSchema.virtual('userCount', {
  ref: 'UserAccount',
  localField: '_id',
  foreignField: 'role',
  count: true
});

// Pre-save hook: Auto-generate role code
roleSchema.pre('save', async function (next) {
  if (this.isNew && !this.roleCode) {
    const count = await mongoose.model('Role').countDocuments();
    this.roleCode = `ROLE${String(count + 1).padStart(3, '0')}`;
  }
  next();
});

roleSchema.set('toJSON', {
  virtuals: true,
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString();
    delete returnedObject._id;
    delete returnedObject.__v;
  }
});

module.exports = mongoose.model('Role', roleSchema);
