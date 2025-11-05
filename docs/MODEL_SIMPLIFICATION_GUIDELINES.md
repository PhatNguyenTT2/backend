# Nguyên Tắc Đơn Giản Hóa Model

## 📋 Mục Đích
Đơn giản hóa các Mongoose models để code dễ đọc, dễ maintain và tập trung business logic vào controller thay vì model.

## ✅ Nguyên Tắc Chính

### 1. **Schema Definition - Giữ Đơn Giản**
```javascript
const schema = new mongoose.Schema({
  fieldName: {
    type: String,
    required: [true, 'Message'],
    trim: true,
    maxlength: 100  // Số đơn giản, không cần array format
  }
}, {
  timestamps: true  // Chỉ cần timestamps
});
```

**✅ NÊN:**
- Sử dụng format ngắn gọn cho validators: `maxlength: 100` thay vì `maxlength: [100, 'Message']`
- Chỉ thêm message validation khi thực sự cần thiết
- Sử dụng `default: null` cho các trường optional
- Giữ schema clean và dễ đọc

**❌ KHÔNG NÊN:**
- Thêm quá nhiều validation message dài dòng
- Sử dụng `toJSON: { virtuals: true }, toObject: { virtuals: true }` trong schema options (chỉ cần khi dùng virtuals)

### 2. **Indexes - Chỉ Những Gì Cần Thiết**
```javascript
// Index cho các field thường xuyên query
schema.index({ fieldName: 1 });
schema.index({ email: 1 });
schema.index({ fullName: 'text' }); // Text search
```

**✅ NÊN:**
- Thêm index cho các field dùng trong query filter
- Thêm text index cho search functionality
- Giữ số lượng index hợp lý

### 3. **Virtual Fields - Chỉ Computed Properties**
```javascript
// Virtual cho calculated fields
schema.virtual('age').get(function () {
  if (!this.dateOfBirth) return null;
  // Calculation logic
  return age;
});
```

**✅ NÊN:**
- Chỉ dùng virtual cho các giá trị computed từ data có sẵn
- Không dùng virtual cho relationships phức tạp (dùng populate thay thế)

**❌ KHÔNG NÊN:**
- Tạo quá nhiều virtual fields
- Logic phức tạp trong virtual getter

### 4. **Pre/Post Hooks - Tối Thiểu**
```javascript
// Chỉ cho auto-generation
schema.pre('save', function (next) {
  if (this.isNew && !this.slug) {
    this.slug = generateSlug(this.name);
  }
  next();
});
```

**✅ NÊN:**
- Chỉ dùng cho auto-generation (slug, code, etc.)
- Logic đơn giản, không async nếu có thể

**❌ KHÔNG NÊN:**
- Business logic phức tạp trong hooks
- Gọi database queries trong hooks
- Nhiều hooks cascade

### 5. **Instance Methods - LOẠI BỎ**
❌ **KHÔNG TẠO instance methods như:**
```javascript
// ❌ BAD - Đừng làm thế này
schema.methods.updateProfile = function() { ... }
schema.methods.activate = function() { ... }
```

✅ **Thay vào đó - Xử lý trong controller:**
```javascript
// ✅ GOOD - Làm trong controller
const user = await User.findById(id);
user.fieldName = newValue;
await user.save();
```

### 6. **Static Methods - LOẠI BỎ**
❌ **KHÔNG TẠO static methods như:**
```javascript
// ❌ BAD
schema.statics.findActiveUsers = function() { ... }
schema.statics.getStatistics = function() { ... }
```

✅ **Thay vào đó - Query trực tiếp trong controller:**
```javascript
// ✅ GOOD
const users = await User.find({ isActive: true })
  .populate('role')
  .sort({ createdAt: -1 });
```

### 7. **toJSON Transform - Bắt Buộc**
```javascript
schema.set('toJSON', {
  virtuals: true,  // Nếu có virtual fields
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString();
    delete returnedObject._id;
    delete returnedObject.__v;
    delete returnedObject.passwordHash;  // Sensitive data
    delete returnedObject.tokens;
  }
});
```

**✅ NÊN:**
- Luôn convert `_id` thành `id`
- Xóa `__v`
- Xóa sensitive fields (password, tokens, etc.)

## 📐 Template Chuẩn

```javascript
const mongoose = require('mongoose');

const modelSchema = new mongoose.Schema({
  // Required fields
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: 100
  },

  // Optional fields
  description: {
    type: String,
    trim: true,
    maxlength: 500,
    default: null
  },

  // Reference
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Boolean with default
  isActive: {
    type: Boolean,
    default: true
  }

}, {
  timestamps: true
});

// Indexes
modelSchema.index({ name: 1 });
modelSchema.index({ user: 1 });
modelSchema.index({ isActive: 1 });

// Virtual (if needed)
modelSchema.virtual('computedField').get(function () {
  return this.field1 + this.field2;
});

// Pre-save hook (only for auto-generation)
modelSchema.pre('save', function (next) {
  if (this.isNew && !this.slug) {
    this.slug = this.name.toLowerCase().replace(/\s+/g, '-');
  }
  next();
});

// toJSON transform (required)
modelSchema.set('toJSON', {
  virtuals: true,  // Only if using virtuals
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString();
    delete returnedObject._id;
    delete returnedObject.__v;
  }
});

module.exports = mongoose.model('Model', modelSchema);
```

## 🎯 Lợi Ích

1. **Dễ đọc**: Code ngắn gọn, rõ ràng
2. **Dễ maintain**: Ít abstraction, ít magic
3. **Flexible**: Business logic trong controller dễ modify
4. **Testable**: Dễ test controller hơn model methods
5. **Consistent**: Tất cả models follow cùng pattern

## 📝 Checklist Khi Tạo/Refactor Model

- [ ] Schema fields đơn giản, validation hợp lý
- [ ] Indexes cho các field thường query
- [ ] Không có instance methods
- [ ] Không có static methods phức tạp
- [ ] Pre-save hook chỉ cho auto-generation (nếu cần)
- [ ] Virtual fields chỉ cho computed properties (nếu cần)
- [ ] toJSON transform đầy đủ
- [ ] Business logic được chuyển sang controller

## 🔄 Migration Strategy

Khi refactor existing model:

1. Xác định tất cả instance methods và static methods
2. Copy logic sang controller
3. Test controller với logic mới
4. Xóa methods khỏi model
5. Cleanup imports và unused code

---

**Lưu ý**: Nguyên tắc này áp dụng cho dự án hiện tại. Có thể điều chỉnh tùy theo requirements cụ thể.
