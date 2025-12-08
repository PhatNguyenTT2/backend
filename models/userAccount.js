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

  // Protection flag for critical accounts (Super Admin)
  isProtected: {
    type: Boolean,
    default: false,
    index: true
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

// 🔒 Pre-delete middleware: Prevent deletion of protected accounts
userAccountSchema.pre('deleteOne', { document: true, query: false }, async function (next) {
  try {
    if (this.isProtected) {
      throw new Error('Cannot delete protected super admin account');
    }

    // Check if this is a super admin by checking role permissions
    const populatedUser = await this.populate('role');
    const isSuperAdmin = populatedUser.role &&
      populatedUser.role.permissions &&
      populatedUser.role.permissions.includes('all');

    if (isSuperAdmin) {
      // Count remaining active super admins
      const Role = mongoose.model('Role');
      const superAdminRole = await Role.findOne({ permissions: 'all' });

      if (superAdminRole) {
        const superAdminCount = await this.constructor.countDocuments({
          role: superAdminRole._id,
          isActive: true,
          _id: { $ne: this._id }
        });

        if (superAdminCount === 0) {
          throw new Error('Cannot delete the last active super admin account. System must have at least one super admin.');
        }
      }
    }

    next();
  } catch (error) {
    next(error);
  }
});

// 🔒 Pre-findOneAndDelete middleware
userAccountSchema.pre('findOneAndDelete', async function (next) {
  try {
    const docToDelete = await this.model.findOne(this.getFilter()).populate('role');

    if (!docToDelete) {
      return next();
    }

    if (docToDelete.isProtected) {
      throw new Error('Cannot delete protected super admin account');
    }

    const isSuperAdmin = docToDelete.role &&
      docToDelete.role.permissions &&
      docToDelete.role.permissions.includes('all');

    if (isSuperAdmin) {
      const Role = mongoose.model('Role');
      const superAdminRole = await Role.findOne({ permissions: 'all' });

      if (superAdminRole) {
        const superAdminCount = await this.model.countDocuments({
          role: superAdminRole._id,
          isActive: true,
          _id: { $ne: docToDelete._id }
        });

        if (superAdminCount === 0) {
          throw new Error('Cannot delete the last active super admin account. System must have at least one super admin.');
        }
      }
    }

    next();
  } catch (error) {
    next(error);
  }
});

// 🔒 Pre-update middleware: Prevent deactivating last super admin or removing protection
userAccountSchema.pre('findOneAndUpdate', async function (next) {
  try {
    const update = this.getUpdate();
    const docToUpdate = await this.model.findOne(this.getFilter()).populate('role');

    if (!docToUpdate) {
      return next();
    }

    // Prevent removing protection from protected accounts
    if (docToUpdate.isProtected && update.$set && update.$set.isProtected === false) {
      throw new Error('Cannot remove protection from super admin account');
    }

    const isSuperAdmin = docToUpdate.role &&
      docToUpdate.role.permissions &&
      docToUpdate.role.permissions.includes('all');

    if (isSuperAdmin) {
      // Check if trying to deactivate
      if (update.$set && update.$set.isActive === false) {
        const Role = mongoose.model('Role');
        const superAdminRole = await Role.findOne({ permissions: 'all' });

        if (superAdminRole) {
          const activeSuperAdminCount = await this.model.countDocuments({
            role: superAdminRole._id,
            isActive: true,
            _id: { $ne: docToUpdate._id }
          });

          if (activeSuperAdminCount === 0) {
            throw new Error('Cannot deactivate the last active super admin account');
          }
        }
      }

      // Check if trying to change role
      if (update.$set && update.$set.role) {
        const Role = mongoose.model('Role');
        const newRole = await Role.findById(update.$set.role);
        const isChangingFromSuperAdmin = !(newRole && newRole.permissions && newRole.permissions.includes('all'));

        if (isChangingFromSuperAdmin) {
          const superAdminRole = await Role.findOne({ permissions: 'all' });

          if (superAdminRole) {
            const superAdminCount = await this.model.countDocuments({
              role: superAdminRole._id,
              isActive: true,
              _id: { $ne: docToUpdate._id }
            });

            if (superAdminCount === 0) {
              throw new Error('Cannot change role of the last super admin account');
            }
          }
        }
      }
    }

    next();
  } catch (error) {
    next(error);
  }
});

// 🔒 PREVENT DELETE if Employee still references this UserAccount
// This prevents orphaned Employee records
userAccountSchema.pre('findOneAndDelete', async function (next) {
  try {
    const userAccountId = this.getQuery()._id;

    if (!userAccountId) {
      return next();
    }

    // Check if any Employee references this UserAccount
    const Employee = mongoose.model('Employee');
    const linkedEmployee = await Employee.findOne({ userAccount: userAccountId });

    if (linkedEmployee) {
      const error = new Error(
        `Cannot delete UserAccount - Employee "${linkedEmployee.fullName}" (ID: ${linkedEmployee._id}) still references it. ` +
        `Please delete or deactivate the Employee first.`
      );
      error.name = 'ReferenceConstraintError';
      error.code = 'EMPLOYEE_REFERENCE_EXISTS';
      error.employeeId = linkedEmployee._id;
      error.employeeName = linkedEmployee.fullName;
      throw error;
    }

    console.log(`✅ UserAccount ${userAccountId} can be safely deleted (no Employee references)`);
    next();
  } catch (error) {
    next(error);
  }
});

// 🔒 PREVENT DELETE (document method) if Employee still references this UserAccount
userAccountSchema.pre('deleteOne', { document: true, query: false }, async function (next) {
  try {
    // Check if any Employee references this UserAccount
    const Employee = mongoose.model('Employee');
    const linkedEmployee = await Employee.findOne({ userAccount: this._id });

    if (linkedEmployee) {
      const error = new Error(
        `Cannot delete UserAccount - Employee "${linkedEmployee.fullName}" (ID: ${linkedEmployee._id}) still references it. ` +
        `Please delete or deactivate the Employee first.`
      );
      error.name = 'ReferenceConstraintError';
      error.code = 'EMPLOYEE_REFERENCE_EXISTS';
      error.employeeId = linkedEmployee._id;
      error.employeeName = linkedEmployee.fullName;
      throw error;
    }

    console.log(`✅ UserAccount ${this._id} can be safely deleted (no Employee references)`);
    next();
  } catch (error) {
    next(error);
  }
});

// 🔒 PREVENT HARD DELETE via deleteMany
userAccountSchema.pre('deleteMany', async function (next) {
  try {
    const filter = this.getFilter();

    // Get all UserAccounts that would be deleted
    const userAccountsToDelete = await this.model.find(filter).select('_id');

    if (userAccountsToDelete.length === 0) {
      return next();
    }

    const userAccountIds = userAccountsToDelete.map(u => u._id);

    // Check if any Employee references these UserAccounts
    const Employee = mongoose.model('Employee');
    const linkedEmployees = await Employee.find({
      userAccount: { $in: userAccountIds }
    });

    if (linkedEmployees.length > 0) {
      const employeeNames = linkedEmployees.map(e => e.fullName).join(', ');
      const error = new Error(
        `Cannot delete ${userAccountIds.length} UserAccount(s) - ${linkedEmployees.length} Employee(s) still reference them: ${employeeNames}. ` +
        `Please delete or deactivate the Employees first.`
      );
      error.name = 'ReferenceConstraintError';
      error.code = 'EMPLOYEE_REFERENCES_EXIST';
      error.affectedCount = linkedEmployees.length;
      error.employeeIds = linkedEmployees.map(e => e._id);
      throw error;
    }

    console.log(`✅ ${userAccountIds.length} UserAccount(s) can be safely deleted (no Employee references)`);
    next();
  } catch (error) {
    next(error);
  }
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
