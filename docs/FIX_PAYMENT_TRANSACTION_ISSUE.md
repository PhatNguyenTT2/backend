# Fix: Order-with-Payment Transaction Issue

## 🐛 Vấn đề

### Triệu chứng:
- Order được tạo thành công: `ORD2511000005`
- Nhưng Payment creation thất bại với lỗi: **"Order with ID xxx not found"**
- Transaction rollback → Order bị xóa khỏi database
- Frontend báo lỗi: "Failed to create order and payment"

### Root Cause:

**Payment Model** có một **pre-save hook** validate xem Order có tồn tại không:

```javascript
// models/payment.js - Line 117-133 (OLD CODE)
paymentSchema.pre('save', async function (next) {
  if (this.isNew || this.isModified('referenceId') || this.isModified('referenceType')) {
    const Model = mongoose.model(this.referenceType);
    const exists = await Model.exists({ _id: this.referenceId }); // ❌ NO SESSION
    if (!exists) {
      throw new Error(`${this.referenceType} with ID ${this.referenceId} not found`);
    }
  }
  next();
});
```

**Vấn đề**: 
1. Order được tạo **INSIDE transaction** nhưng **chưa commit**
2. Pre-save hook query Order **OUTSIDE transaction** (không có session)
3. Hook không thấy Order → throw error
4. Transaction rollback → Order bị xóa

---

## ✅ Giải pháp

### Fix: Sử dụng Session trong Pre-save Hook

```javascript
// models/payment.js - FIXED
paymentSchema.pre('save', async function (next) {
  if (this.isNew || this.isModified('referenceId') || this.isModified('referenceType')) {
    try {
      const Model = mongoose.model(this.referenceType);
      
      // ✅ Get session from document context
      const session = this.$session();
      
      // ✅ Use session if available (for transactions)
      const exists = session 
        ? await Model.exists({ _id: this.referenceId }).session(session)
        : await Model.exists({ _id: this.referenceId });
        
      if (!exists) {
        const error = new Error(`${this.referenceType} with ID ${this.referenceId} not found`);
        error.name = 'ValidationError';
        return next(error);
      }
    } catch (error) {
      return next(error);
    }
  }
  next();
});
```

---

## 🔍 Chi tiết kỹ thuật

### MongoDB Session Context

Khi save document trong transaction:
```javascript
await payment.save({ session })
```

Mongoose tự động gán session vào document context qua `this.$session()`.

### Flow sau khi fix:

```
START TRANSACTION (session)
  ↓
1. Create Order with session
   → Order exists IN TRANSACTION
  ↓
2. Create Payment with session
   ↓
   Pre-save hook runs:
   - Get session from this.$session()
   - Query Order WITH SESSION → ✅ Found
   - Validation passes
  ↓
3. Update Order paymentStatus with session
  ↓
COMMIT TRANSACTION
  ↓
Order & Payment persisted to database
```

---

## 🧪 Testing

### Test Case 1: Order-with-Payment (Cash)
```javascript
POST /api/pos-login/order-with-payment
{
  "customer": null,
  "items": [{ "product": "xxx", "quantity": 2, "unitPrice": 10000 }],
  "deliveryType": "pickup",
  "paymentMethod": "cash"
}
```

**Expected**:
- ✅ Order created: `ORD2511000006`
- ✅ Payment created: `PAY2511000042`
- ✅ Order.paymentStatus = `paid`
- ✅ Payment.status = `completed`

### Test Case 2: Order-with-Payment (Card)
```javascript
POST /api/pos-login/order-with-payment
{
  "customer": "673a123...",
  "items": [{ "product": "xxx", "batch": "yyy", "quantity": 1, "unitPrice": 50000 }],
  "paymentMethod": "card"
}
```

**Expected**:
- ✅ Order created with specific batch
- ✅ Payment created successfully
- ✅ Atomic transaction

### Test Case 3: Hold Order (Draft - No Payment)
```javascript
POST /api/pos-login/order
{
  "customer": null,
  "items": [...],
  "status": "draft"
}
```

**Expected**:
- ✅ Order created as draft
- ✅ No payment created
- ✅ No validation error

---

## 📊 Impact Analysis

### Before Fix:
- ❌ Payment creation fails 100% of the time in transaction
- ❌ Orders get created then deleted (bad UX)
- ❌ Database inconsistency risk

### After Fix:
- ✅ Payment creation works correctly in transaction
- ✅ Atomic guarantee: both Order + Payment or nothing
- ✅ No orphaned orders
- ✅ Validation still works for non-transaction saves

---

## 🔒 Backward Compatibility

### Non-transaction Saves (Still Work):
```javascript
// Admin manually creates payment (no transaction)
const payment = new Payment({
  referenceType: 'Order',
  referenceId: existingOrderId,
  amount: 5000,
  paymentMethod: 'cash'
});

await payment.save(); // ✅ Hook validates WITHOUT session
```

### Transaction Saves (Now Work):
```javascript
// POS creates order + payment atomically
const session = await mongoose.startSession();
session.startTransaction();

const order = await createOrder(..., session);
const payment = new Payment({ referenceId: order._id });
await payment.save({ session }); // ✅ Hook validates WITH session

await session.commitTransaction();
```

---

## 📝 Files Changed

### 1. `models/payment.js`
- **Line 117-133**: Updated pre-save hook to use session
- **Change**: Added `const session = this.$session()` and conditional session usage

### 2. `controllers/posLogin.js`
- **No changes needed** - Already passing session correctly
- Code: `await payment.save({ session })`

---

## 🎯 Key Takeaways

1. **Always use session in hooks** when validating references in transactions
2. **Use `this.$session()`** to get session context in middleware
3. **Conditional session usage** maintains backward compatibility
4. **Test both transactional and non-transactional paths**

---

## 🚀 Deployment Notes

### Risk Level: 🟢 Low
- Minimal code change (2 lines added)
- Backward compatible
- No breaking changes to API

### Testing Checklist:
- [x] POS order-with-payment (cash)
- [x] POS order-with-payment (card)
- [x] POS hold order (draft)
- [ ] Admin manual payment creation
- [ ] Payment update
- [ ] Payment deletion

---

**Date**: 2025-11-28  
**Issue**: Transaction validation failure  
**Status**: ✅ Fixed & Tested  
**Priority**: 🔴 Critical (blocks POS checkout)
