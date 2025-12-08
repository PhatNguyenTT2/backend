const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
  userAccount: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserAccount',
    required: [true, 'User account is required'],
    unique: true
  },

  fullName: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true,
    minlength: 3,
    maxlength: 100
  },

  phone: {
    type: String,
    trim: true,
    match: [/^[0-9]{10,15}$/, 'Please enter a valid phone number (10-15 digits)']
  },

  address: {
    type: String,
    trim: true,
    maxlength: 200
  },

  dateOfBirth: {
    type: Date,
    default: null
  }

}, {
  timestamps: true
});

// Index for faster queries
employeeSchema.index({ userAccount: 1 });
employeeSchema.index({ fullName: 'text' });

// Virtual: Calculate age from dateOfBirth
employeeSchema.virtual('age').get(function () {
  if (!this.dateOfBirth) return null;
  const today = new Date();
  const birthDate = new Date(this.dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
});

// 🔒 ORPHAN CHECK: Warn if UserAccount doesn't exist for this Employee
employeeSchema.post('save', async function (doc) {
  try {
    if (doc.userAccount) {
      const UserAccount = mongoose.model('UserAccount');
      const userExists = await UserAccount.findById(doc.userAccount);

      if (!userExists) {
        console.warn(`⚠️ ORPHAN WARNING: Employee ${doc._id} references non-existent UserAccount ${doc.userAccount}`);
      }
    }
  } catch (error) {
    console.error('❌ Error in orphan check:', error);
  }
});

employeeSchema.set('toJSON', {
  virtuals: true,
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString();
    delete returnedObject._id;
    delete returnedObject.__v;
  }
});

module.exports = mongoose.model('Employee', employeeSchema);
