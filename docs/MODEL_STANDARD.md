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
// 5. Middleware (pre-save hooks for auto-generation)
// 6. JSON transformation
// 7. Export

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

## 5. Middleware (Pre-save Hooks)

### 5.1 Khi nào dùng Pre-save Hooks?
- **Auto-generation codes**: Tự động sinh mã (productCode, customerCode, roleCode, etc.)
- **Data normalization**: Chuẩn hóa dữ liệu trước khi lưu
- **Validation phức tạp**: Validation cross-field hoặc async validation
- **Timestamps tùy chỉnh**: Nếu cần logic timestamps đặc biệt

### 5.2 Auto-generate Codes Pattern

#### Pattern 1: Simple Sequential Code (không theo năm)
```javascript
// Ví dụ: ROLE001, ROLE002, ROLE003
modelSchema.pre('save', async function (next) {
  if (this.isNew && !this.roleCode) {
    const count = await mongoose.model('Role').countDocuments();
    this.roleCode = `ROLE${String(count + 1).padStart(3, '0')}`;
  }
  next();
});
```

#### Pattern 2: Year-based Code (theo năm)
```javascript
// Ví dụ: PROD2025000001, CUST2025000001
modelSchema.pre('save', async function (next) {
  if (!this.productCode) {
    try {
      const currentYear = new Date().getFullYear();
      
      // Find the last code for current year
      const lastProduct = await this.constructor
        .findOne({ productCode: new RegExp(`^PROD${currentYear}`) })
        .sort({ productCode: -1 })
        .select('productCode')
        .lean();

      let sequenceNumber = 1;
      
      if (lastProduct && lastProduct.productCode) {
        // Extract sequence number from last code
        const match = lastProduct.productCode.match(/\d{6}$/);
        if (match) {
          sequenceNumber = parseInt(match[0]) + 1;
        }
      }

      // Generate new code with 6-digit padding
      this.productCode = `PROD${currentYear}${String(sequenceNumber).padStart(6, '0')}`;
    } catch (error) {
      return next(error);
    }
  }
  next();
});
```

### 5.3 Other Common Pre-save Hooks

#### Data Normalization
```javascript
// Chuẩn hóa email, phone trước khi lưu
modelSchema.pre('save', function (next) {
  if (this.email) {
    this.email = this.email.toLowerCase().trim();
  }
  if (this.phone) {
    this.phone = this.phone.replace(/\D/g, ''); // Remove non-digits
  }
  next();
});
```

#### Cross-field Validation
```javascript
// Validate expiry date phải sau mfg date
modelSchema.pre('save', function (next) {
  if (this.expiryDate && this.mfgDate) {
    if (this.expiryDate <= this.mfgDate) {
      return next(new Error('Expiry date must be after manufacturing date'));
    }
  }
  next();
});
```

#### Update Related Fields
```javascript
// Tự động update status based on quantity
modelSchema.pre('save', function (next) {
  if (this.quantity === 0) {
    this.status = 'out_of_stock';
  } else if (this.quantity < this.reorderPoint) {
    this.status = 'low_stock';
  } else {
    this.status = 'in_stock';
  }
  next();
});
```

### 5.4 Best Practices

```javascript
// ✅ GOOD: Use this.constructor instead of mongoose.model()
const lastDoc = await this.constructor.findOne({...});

// ✅ GOOD: Use .lean() for better performance
const lastDoc = await this.constructor.findOne({...}).lean();

// ✅ GOOD: Handle errors properly
try {
  // generation logic
} catch (error) {
  return next(error);
}

// ✅ GOOD: Check if code already exists
if (!this.productCode) {
  // generate code
}

// ❌ BAD: Heavy computation in pre-save
// ❌ BAD: Multiple async operations without error handling
// ❌ BAD: Modifying other documents in pre-save (use post-save)
```

### 5.5 Important Notes

```javascript
// ⚠️ Pre-save chỉ chạy khi .save() hoặc .create()
// ⚠️ KHÔNG chạy với .update(), .findByIdAndUpdate(), etc.
// ⚠️ Nếu có many operations, consider using transactions
// ⚠️ Always call next() hoặc return next(error)
```

---

## 6. JSON Transformation

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

## 7. Complete Example

```javascript
const mongoose = require('mongoose');

/**
 * Product Model
 * Manages product information with auto-generated codes
 * References: Category (many-to-one)
 */
const productSchema = new mongoose.Schema({
  productCode: {
    type: String,
    unique: true,
    uppercase: true,
    trim: true,
    match: [/^PROD\d{10}$/, 'Product code must follow format PROD2025000001']
  },

  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    maxlength: [255, 'Product name must be at most 255 characters']
  },

  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Category is required']
  },

  unitPrice: {
    type: mongoose.Schema.Types.Decimal128,
    required: [true, 'Unit price is required'],
    min: [0, 'Unit price cannot be negative'],
    get: function (value) {
      if (value) return parseFloat(value.toString());
      return 0;
    }
  },

  isActive: {
    type: Boolean,
    default: true
  },

  vendor: {
    type: String,
    trim: true,
    maxlength: [100, 'Vendor name must be at most 100 characters']
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true, getters: true },
  toObject: { virtuals: true, getters: true }
});

// ============ INDEXES ============
productSchema.index({ productCode: 1 });
productSchema.index({ name: 'text' });
productSchema.index({ category: 1 });
productSchema.index({ isActive: 1 });

// ============ VIRTUALS ============
productSchema.virtual('batches', {
  ref: 'ProductBatch',
  localField: '_id',
  foreignField: 'product'
});

productSchema.virtual('inventory', {
  ref: 'Inventory',
  localField: '_id',
  foreignField: 'product',
  justOne: true
});

// ============ MIDDLEWARE ============
// Auto-generate product code before saving
productSchema.pre('save', async function (next) {
  if (!this.productCode) {
    try {
      const currentYear = new Date().getFullYear();
      
      const lastProduct = await this.constructor
        .findOne({ productCode: new RegExp(`^PROD${currentYear}`) })
        .sort({ productCode: -1 })
        .select('productCode')
        .lean();

      let sequenceNumber = 1;
      
      if (lastProduct && lastProduct.productCode) {
        const match = lastProduct.productCode.match(/\d{6}$/);
        if (match) {
          sequenceNumber = parseInt(match[0]) + 1;
        }
      }

      this.productCode = `PROD${currentYear}${String(sequenceNumber).padStart(6, '0')}`;
    } catch (error) {
      return next(error);
    }
  }
  next();
});

// ============ JSON TRANSFORMATION ============
productSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString();
    delete returnedObject._id;
    delete returnedObject.__v;

    // Convert Decimal128 to number
    if (returnedObject.unitPrice && typeof returnedObject.unitPrice === 'object') {
      returnedObject.unitPrice = parseFloat(returnedObject.unitPrice.toString());
    }
  }
});

module.exports = mongoose.model('Product', productSchema);
```

---

## 8. Checklist cho Refactoring

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

### ✅ Middleware
- [ ] Pre-save hook cho auto-generate codes (nếu cần)
- [ ] Handle errors properly với try-catch
- [ ] Use this.constructor thay vì mongoose.model()
- [ ] Always call next() hoặc return next(error)

### ✅ JSON Transformation
- [ ] Có toJSON với virtuals: true (nếu có virtuals)
- [ ] Transform _id -> id
- [ ] Xóa __v
- [ ] Xóa sensitive fields (password, PIN, etc.)
- [ ] Convert Decimal128 to number (nếu có)

### ✅ Security
- [ ] Password/PIN fields có select: false
- [ ] Validation đầy đủ
- [ ] Rate limiting cho authentication

---

## 9. Common Pitfalls

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

## 10. Testing Models

```javascript
// Test example
describe('Product Model', () => {
  it('should auto-generate product code on save', async () => {
    const product = new Product({ 
      name: 'Test Product',
      category: categoryId,
      unitPrice: 10000
    });
    await product.save();
    
    expect(product.productCode).toMatch(/^PROD\d{10}$/);
    expect(product.productCode).toContain(new Date().getFullYear().toString());
  });

  it('should have batches virtual', () => {
    const product = new Product({ name: 'Test' });
    expect(product.batches).toBeDefined();
  });

  it('should transform JSON correctly', () => {
    const product = new Product({ name: 'Test', unitPrice: 10000 });
    const json = product.toJSON();
    
    expect(json.id).toBeDefined();
    expect(json._id).toBeUndefined();
    expect(json.__v).toBeUndefined();
    expect(typeof json.unitPrice).toBe('number');
  });
});
```

---

## 11. Performance Tips

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

**Last Updated**: 2025-11-13
**Version**: 2.1 (Added Pre-save Middleware for Auto-generation)
**Maintainer**: Backend Team
