const mongoose = require('mongoose');

const userAccountSchema = new mongoose.Schema({
  userCode: {
    type: String,
    unique: true,
    uppercase: true,
    trim: true,
    match: [/^USER\d{3,}$/, 'User code must follow format USER001, USER002, etc.']
    // Auto-generated in pre-save hook
  },

  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 20
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
    minlength: 6
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

  // Auth tokens for session management
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

  // Password reset functionality
  resetPasswordToken: {
    type: String,
    default: null
  },

  resetPasswordExpire: {
    type: Date,
    default: null
  },

  // Last login timestamp
  lastLogin: {
    type: Date,
    default: null
  }

}, {
  timestamps: true
});

// Indexes for better query performance
userAccountSchema.index({ userCode: 1 });
userAccountSchema.index({ username: 1 });
userAccountSchema.index({ email: 1 });
userAccountSchema.index({ isActive: 1 });
userAccountSchema.index({ role: 1 });

// Virtual: Employee profile relationship
userAccountSchema.virtual('employee', {
  ref: 'Employee',
  localField: '_id',
  foreignField: 'userAccount',
  justOne: true
});

// Pre-save hook: Auto-generate user code
userAccountSchema.pre('save', async function (next) {
  if (this.isNew && !this.userCode) {
    try {
      // Find the highest existing userCode to avoid duplicates
      const lastUser = await mongoose.model('UserAccount')
        .findOne({}, { userCode: 1 })
        .sort({ userCode: -1 })
        .lean();

      let nextNumber = 1;
      if (lastUser && lastUser.userCode) {
        // Extract number from userCode (e.g., "USER004" -> 4)
        const match = lastUser.userCode.match(/^USER(\d+)$/);
        if (match) {
          nextNumber = parseInt(match[1], 10) + 1;
        }
      }

      this.userCode = `USER${String(nextNumber).padStart(3, '0')}`;
    } catch (error) {
      return next(error);
    }
  }
  next();
});

userAccountSchema.set('toJSON', {
  virtuals: true,
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString();
    delete returnedObject._id;
    delete returnedObject.__v;
    delete returnedObject.passwordHash;
    delete returnedObject.tokens;
    delete returnedObject.resetPasswordToken;
    delete returnedObject.resetPasswordExpire;
  }
});

module.exports = mongoose.model('UserAccount', userAccountSchema);
