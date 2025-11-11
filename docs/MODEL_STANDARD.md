# Model Standard Guidelines

## Tổng quan
Document này định nghĩa cấu trúc chuẩn cho các Mongoose models trong project, đảm bảo tính nhất quán, hiệu suất và bảo mật.

## Cấu trúc Model Chuẩn

### 1. File Structure
```javascript
// 1. Import dependencies
const mongoose = require('mongoose');

// 2. Schema definition với JSDoc
/**
 * ModelName Model
 * Mô tả chức năng của model
 * Các mối quan hệ với model khác
 */
const modelNameSchema = new mongoose.Schema({
  // Field definitions
}, {
  timestamps: true  // Auto adds createdAt, updatedAt
});

// 3. Indexes
// 4. Virtuals (nếu có)
// 5. JSON transformation
// 6. Export

module.exports = mongoose.model('ModelName', modelNameSchema);
```

---

## 2. Schema Definition

### 2.1 Basic Structure
```javascript
const modelSchema = new mongoose.Schema({
  // Fields here
}, {
  timestamps: true  // Luôn bật để track createdAt/updatedAt
});
```

### 2.2 Field Definitions
```javascript
// String field với validation
fieldName: {
  type: String,
  required: [true, 'Error message'],
  unique: true,
  trim: true,
  lowercase: true,
  minlength: [3, 'Minimum length error'],
  maxlength: [100, 'Maximum length error'],
  enum: ['value1', 'value2'],
  default: 'defaultValue'
},

// Number field
price: {
  type: Number,
  required: true,
  min: [0, 'Cannot be negative'],
  max: [1000000, 'Max value error'],
  default: 0
},

// Boolean field
isActive: {
  type: Boolean,
  default: true
},

// Date field
expireDate: {
  type: Date,
  default: null
},

// Reference (ObjectId)
user: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'User',
  required: [true, 'User is required'],
  index: true  // Index cho foreign key
},

// Array of strings
tags: [{
  type: String,
  trim: true
}],

// Array of references
items: [{
  type: mongoose.Schema.Types.ObjectId,
  ref: 'Item'
}],

// Embedded subdocument
address: {
  street: { type: String, required: true },
  city: { type: String, required: true },
  zipCode: { type: String }
}
```

### 2.3 Sensitive Fields (Security)
```javascript
// Dùng select: false cho các field nhạy cảm
password: {
  type: String,
  required: true,
  select: false  // Không trả về mặc định trong queries
},

posPinHash: {
  type: String,
  required: true,
  select: false
}
```

---

## 3. Indexes

### 3.1 Khi nào cần Index?
- **Foreign keys** (references): Luôn index
- **Fields thường dùng trong queries**: email, username, status
- **Fields dùng cho sorting**: createdAt, price
- **Unique fields**: email, phoneNumber
- **Compound indexes**: Khi query nhiều fields cùng lúc

### 3.2 Cách khai báo
```javascript
// Single field index
modelSchema.index({ email: 1 });  // 1 = ascending, -1 = descending
modelSchema.index({ createdAt: -1 });

// Compound index
modelSchema.index({ userId: 1, status: 1 });

// Unique index (nên khai báo ở schema hoặc ở đây)
modelSchema.index({ email: 1 }, { unique: true });

// Text index (cho full-text search)
modelSchema.index({ name: 'text', description: 'text' });

// Sparse index (chỉ index documents có field này)
modelSchema.index({ optionalField: 1 }, { sparse: true });
```

### 3.3 Best Practices
```javascript
// ✅ GOOD: Index các fields quan trọng
modelSchema.index({ employee: 1 });
modelSchema.index({ canAccessPOS: 1 });
modelSchema.index({ posLastLogin: -1 });

// ❌ BAD: Quá nhiều indexes (giảm write performance)
// ❌ BAD: Index fields ít khi query
```

---

## 4. Virtuals

### 4.1 Khi nào dùng Virtuals?
- Tính toán dữ liệu từ các fields hiện có
- Không lưu vào database
- Chỉ dùng khi get data

### 4.2 Cú pháp
```javascript
// Virtual field - computed property
modelSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual with conditional logic
modelSchema.virtual('isPinLocked').get(function () {
  return this.pinLockedUntil && this.pinLockedUntil > Date.now();
});

// Virtual with calculation
modelSchema.virtual('minutesUntilUnlock').get(function () {
  if (!this.isPinLocked) return 0;
  return Math.ceil((this.pinLockedUntil - Date.now()) / 60000);
});

// Virtual - populate từ model khác
modelSchema.virtual('orders', {
  ref: 'Order',
  localField: '_id',
  foreignField: 'userId'
});
```

### 4.3 Important Notes
```javascript
// ⚠️ Virtuals KHÔNG được lưu vào DB
// ⚠️ Cần set toJSON/toObject: { virtuals: true } để include trong output
// ⚠️ Không thể query virtuals (không có trong DB)
```

---

## 5. JSON Transformation

### 5.1 Cấu trúc Chuẩn
```javascript
// LUÔN có JSON transformation để:
// 1. Transform _id -> id
// 2. Remove __v
// 3. Remove sensitive fields
// 4. Include virtuals nếu cần

modelSchema.set('toJSON', {
  virtuals: true,  // Include virtual fields
  transform: (document, returnedObject) => {
    // Transform _id thành id
    returnedObject.id = returnedObject._id.toString();
    delete returnedObject._id;
    
    // Remove version key
    delete returnedObject.__v;
    
    // Remove sensitive fields
    delete returnedObject.password;
    delete returnedObject.posPinHash;
    
    // Custom transformations
    if (returnedObject.createdAt) {
      returnedObject.createdAt = returnedObject.createdAt.toISOString();
    }
  }
});
```

### 5.2 toObject (optional)
```javascript
// Tương tự toJSON nhưng cho .toObject()
modelSchema.set('toObject', {
  virtuals: true,
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString();
    delete returnedObject._id;
    delete returnedObject.__v;
  }
});
```

---

## 6. Complete Example

```javascript
const mongoose = require('mongoose');

/**
 * User Model
 * Manages user authentication and profile
 * References: Role (many-to-one)
 */
const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Invalid email format']
  },

  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },

  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true
  },

  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true
  },

  role: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Role',
    required: true
  },

  isActive: {
    type: Boolean,
    default: true
  },

  lastLogin: {
    type: Date,
    default: null
  },

  failedLoginAttempts: {
    type: Number,
    default: 0,
    min: 0,
    max: 10
  },

  lockUntil: {
    type: Date,
    default: null
  }

}, {
  timestamps: true
});

// ============ INDEXES ============
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ lastLogin: -1 });

// ============ VIRTUALS ============
userSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

userSchema.virtual('isLocked').get(function () {
  return this.lockUntil && this.lockUntil > Date.now();
});

// ============ JSON TRANSFORMATION ============
userSchema.set('toJSON', {
  virtuals: true,
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString();
    delete returnedObject._id;
    delete returnedObject.__v;
    delete returnedObject.password;
  }
});

module.exports = mongoose.model('User', userSchema);
```

---

## 7. Checklist cho Refactoring

Khi refactor một model, kiểm tra các điểm sau:

### ✅ Schema
- [ ] Có JSDoc comment mô tả model
- [ ] Tất cả fields có validation phù hợp
- [ ] Required fields được đánh dấu
- [ ] Sensitive fields có `select: false`
- [ ] Có `timestamps: true`

### ✅ Indexes
- [ ] Index cho foreign keys (references)
- [ ] Index cho fields thường query
- [ ] Index cho unique fields
- [ ] Không quá nhiều indexes

### ✅ Virtuals
- [ ] Có virtual fields nếu cần computed properties
- [ ] Virtual logic đúng và hiệu quả

### ✅ JSON Transformation
- [ ] Có toJSON với virtuals: true (nếu có virtuals)
- [ ] Transform _id -> id
- [ ] Xóa __v
- [ ] Xóa sensitive fields (password, PIN, etc.)

### ✅ Security
- [ ] Password/PIN fields có select: false
- [ ] Validation đầy đủ
- [ ] Rate limiting cho authentication

---

## 8. Common Pitfalls

### ❌ Tránh những lỗi này:

```javascript
// BAD: Không có validation
field: String  // Nên có required, trim, etc.

// BAD: Quên select: false cho sensitive data
password: { type: String }  // Ai cũng thấy được!

// BAD: Không có indexes cho foreign keys
userId: { type: ObjectId, ref: 'User' }  // Chậm khi query!

// BAD: Không có toJSON transformation
// Client sẽ nhận _id thay vì id, và nhận cả __v

// BAD: Virtuals nhưng không set virtuals: true
// Virtual fields sẽ không xuất hiện trong response
```

---

## 9. Testing Models

```javascript
// Test example
describe('User Model', () => {
  it('should have fullName virtual', () => {
    const user = new User({ firstName: 'John', lastName: 'Doe' });
    expect(user.fullName).toBe('John Doe');
  });

  it('should transform JSON correctly', () => {
    const user = new User({ email: 'test@test.com' });
    const json = user.toJSON();
    expect(json.id).toBeDefined();
    expect(json._id).toBeUndefined();
    expect(json.__v).toBeUndefined();
  });
});
```

---

## 10. Performance Tips

1. **Index Strategy**: Chỉ index fields thực sự cần
2. **Select Fields**: Chỉ select fields cần thiết: `.select('name email')`
3. **Lean Queries**: Dùng `.lean()` khi không cần virtuals: `Model.find().lean()`
4. **Pagination**: Luôn paginate large datasets
5. **Populate**: Careful với nested populates (N+1 problem)

```javascript
// Good: Select only needed fields
User.find().select('name email').lean();

// Bad: Get everything
User.find(); // Returns all fields + virtuals overhead
```

---

## 11. References

- [Mongoose Documentation](https://mongoosejs.com/docs/guide.html)
- [MongoDB Indexing Best Practices](https://docs.mongodb.com/manual/indexes/)
- [Mongoose Virtuals](https://mongoosejs.com/docs/tutorials/virtuals.html)
- [Schema Validation](https://mongoosejs.com/docs/validation.html)

---

**Last Updated**: 2025-11-11
**Version**: 2.0 (Simplified - No Methods/Middleware)
**Maintainer**: Backend Team
