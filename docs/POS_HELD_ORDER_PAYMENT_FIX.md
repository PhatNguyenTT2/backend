# POS Held Order Payment Fix

## 🐛 Bug Report

**Issue**: Held order payment workflow không hoạt động  
**Error**: `PUT /api/orders/undefined 400 - Cast to ObjectId failed for value "undefined"`  
**Root Cause**: Frontend code sử dụng `existingOrder.id` nhưng MongoDB trả về `existingOrder._id`

---

## ✅ Fix Implementation

### **1. POSMain.jsx - handlePaymentMethodSelect()**

**Lines: 820-895**

**Changes:**
```javascript
// ❌ BEFORE: Directly use existingOrder.id (undefined for MongoDB objects)
const updateResponse = await orderService.updateOrder(existingOrder.id, {
  status: 'delivered',
  paymentStatus: 'paid'
});

// ✅ AFTER: Extract orderId with fallback for both _id and id
const orderId = existingOrder._id || existingOrder.id;

if (!orderId) {
  throw new Error('Order ID is missing from existing order');
}

const updateResponse = await orderService.updateOrder(orderId, {
  status: 'delivered',
  paymentStatus: 'paid'
});
```

**Key Points:**
- ✅ Added orderId extraction with `_id` priority
- ✅ Added validation to throw error if orderId missing
- ✅ Enhanced logging to show both `_id` and `id` values
- ✅ Use extracted `orderId` consistently for all API calls

---

### **2. POSMain.jsx - handleLoadHeldOrder()**

**Lines: 1130-1133**

**Changes:**
```javascript
// ❌ BEFORE: Store order as-is (only has _id field)
setExistingOrder(order);

// ✅ AFTER: Add id alias for MongoDB _id compatibility
setExistingOrder({
  ...order,
  id: order._id || order.id
});
```

**Key Points:**
- ✅ Add `id` field as alias for `_id`
- ✅ Ensures compatibility with code expecting `.id` property
- ✅ Preserves all original order properties
- ✅ Added logging to show stored ID

---

### **3. POSMain.jsx - Error Handling**

**Lines: 952-965**

**Changes:**
```javascript
// ❌ BEFORE: Generic error message
catch (error) {
  console.error('❌ Payment error:', error);
  showToast('error', error.message || 'Failed to process payment');
}

// ✅ AFTER: Detailed error logging and extraction from API response
catch (error) {
  console.error('❌ Payment error:', error);
  console.error('❌ Error details:', {
    message: error.message,
    response: error.response?.data,
    stack: error.stack
  });
  
  const errorMessage = error.response?.data?.error?.message 
    || error.message 
    || 'Failed to process payment';
  
  showToast('error', errorMessage);
}
```

**Key Points:**
- ✅ Log full error object with response data
- ✅ Extract error message from backend response
- ✅ Show user-friendly error message with backend details

---

## 🔄 Complete Flow: Held Order Payment

### **User Actions:**
```
1. Click "Held Orders" button
   ↓
2. POSHeldOrdersModal opens
   - Fetch: GET /api/pos-login/orders?status=draft
   - Shows list of draft orders with details
   ↓
3. Click on an order
   - Calls: handleLoadHeldOrder(order)
   ↓
4. Order loaded to cart
   - Cart populated from order.details
   - Customer set from order.customer
   - existingOrder set with id alias: { ...order, id: order._id }
   ↓
5. Review cart (optional: modify quantities)
   ↓
6. Click "Checkout" (F9)
   - Opens POSPaymentModal
   - Shows "Held Order" badge
   - Shows order number
   ↓
7. Select payment method (Cash/Card/Bank Transfer)
   - Calls: handlePaymentMethodSelect(method)
   ↓
8. Processing FLOW 1:
   Step 1: Extract orderId = existingOrder._id || existingOrder.id
   Step 2: PUT /api/orders/:orderId { status: 'delivered', paymentStatus: 'paid' }
   Step 3: POST /api/payments { referenceId: orderId, amount, method }
   Step 4: GET /api/orders/:orderId (fetch full order for invoice)
   Step 5: Show invoice modal
   Step 6: Clear cart, customer, existingOrder
   ↓
9. Print/close invoice
```

---

## 🧪 Testing Checklist

### **Pre-Test Setup:**
```bash
# 1. Start backend
cd e:\UIT\backend
npm run dev

# 2. Start frontend (admin)
cd e:\UIT\backend\admin
npm run dev

# 3. Login to POS
# Navigate to: http://localhost:5173/pos/login
# Login with employee credentials
```

### **Test Case 1: Create Held Order**
- [ ] Add products to cart (scan barcode or click products)
- [ ] Select customer
- [ ] Press F8 or click "Hold" button
- [ ] Verify: Success toast "Order saved as draft"
- [ ] Verify: Cart cleared after hold

### **Test Case 2: Load Held Order**
- [ ] Click "Held Orders" button
- [ ] Verify: Modal shows list of draft orders
- [ ] Verify: Each order shows:
  - Order number (e.g., ORD25110000027)
  - Date and time
  - Customer name and code
  - Total amount
  - Discount percentage (if any)
  - Items list preview
- [ ] Click on an order
- [ ] Verify: Modal closes
- [ ] Verify: Cart populated with order items
- [ ] Verify: Customer auto-selected
- [ ] **IMPORTANT**: Open browser console
- [ ] Verify console log: `💾 Existing order stored with ID: <mongodb_id>`

### **Test Case 3: Complete Payment for Held Order**
- [ ] After loading held order (Test Case 2)
- [ ] Click "Checkout" (F9)
- [ ] Verify: Payment modal shows "Held Order" badge
- [ ] Verify: Order number displayed in amber box
- [ ] Verify: Message "Payment will be created for this existing order"
- [ ] Open browser console BEFORE selecting payment
- [ ] Select payment method (Cash)
- [ ] **IMPORTANT**: Monitor console logs:
  ```
  ✅ Expected logs:
  📋 FLOW 1: Processing payment for existing held order
     Order: ORD25110000027
     Order ID: <valid_mongodb_id>  ← NOT undefined!
     Current status: draft
  🔄 Updating order status: draft → delivered...
     Using order ID: <valid_mongodb_id>
  ✅ Order status updated to delivered
  💰 Creating payment record...
  ✅ Payment created: PAY...
  📄 Fetching full order for invoice...
  ✅ FLOW 1 completed successfully!
  ```
  
  ```
  ❌ If you see this, bug NOT fixed:
  📋 FLOW 1: Processing payment for existing held order
     Order ID: undefined  ← BAD!
  PUT /api/orders/undefined 400
  ```

- [ ] Verify: No errors in console
- [ ] Verify: Invoice modal appears
- [ ] Verify: Invoice shows correct items and totals
- [ ] **Backend Verification**:
  - [ ] Check backend console for inventory update logs
  - [ ] Verify: Movement log created with `movementType: 'out'`
  - [ ] Verify: `quantityOnShelf` decreased

### **Test Case 4: Inventory Verification**
After completing held order payment:

```bash
# Open MongoDB Compass or use mongo shell
# Check DetailInventory for the product batch

# Expected result:
# quantityOnShelf DECREASED by order quantity
# Example: 10 → 8 (if order had 2 items)
```

Or check via Admin panel:
- [ ] Navigate to Inventory Management
- [ ] Find the product
- [ ] Verify: Quantity on Shelf decreased
- [ ] Navigate to Inventory Movements
- [ ] Verify: Movement log exists with:
  - Type: "Stock Out"
  - Reason: "Sales"
  - Quantity: negative (e.g., -2)
  - Reference: Order number

### **Test Case 5: Error Handling**
- [ ] Load held order
- [ ] In another browser tab, manually delete the order from DB (simulate race condition)
- [ ] Try to complete payment
- [ ] Verify: User-friendly error message shown
- [ ] Verify: Error logged in console with full details

---

## 📊 Backend Verification

### **Check Order Status Update:**
```javascript
// MongoDB query
db.orders.findOne({ orderNumber: 'ORD25110000027' })

// Expected fields after payment:
{
  _id: ObjectId("..."),
  orderNumber: "ORD25110000027",
  status: "delivered",  // ✅ Changed from "draft"
  paymentStatus: "paid", // ✅ Changed from "pending"
  total: 125670,
  // ... other fields
}
```

### **Check Payment Created:**
```javascript
db.payments.findOne({ referenceId: ObjectId("...") })

// Expected:
{
  paymentNumber: "PAY...",
  referenceType: "Order",
  referenceId: ObjectId("..."), // ✅ Matches order _id
  amount: 125670,
  paymentMethod: "cash",
  status: "completed",
  // ... other fields
}
```

### **Check Inventory Decreased:**
```javascript
// Find DetailInventory for the batch
db.detailinventories.findOne({ batchId: ObjectId("...") })

// Expected:
{
  quantityOnShelf: 8, // ✅ Decreased from 10
  // ... other fields
}
```

### **Check Movement Log:**
```javascript
db.inventorymovementbatches.findOne({ 
  referenceType: "Order",
  referenceId: ObjectId("...")
})

// Expected:
{
  movementType: "out",
  quantity: -2, // ✅ Negative for stock out
  reason: "Sales",
  referenceType: "Order",
  referenceId: ObjectId("..."),
  // ... other fields
}
```

---

## 🎯 Success Criteria

✅ **FLOW 1 (Held Order Payment) works correctly:**
1. Order status updates from "draft" → "delivered"
2. Payment record created with correct referenceId
3. Inventory quantityOnShelf decreases
4. Movement log created with movementType="out"
5. Invoice displays correctly
6. No console errors
7. User sees success message

✅ **FLOW 2 (New Order Payment) still works:**
- Atomic order+payment creation
- Inventory updates correctly
- No regression from FLOW 1 fix

---

## 🚨 Common Issues & Solutions

### **Issue 1: orderId still undefined**
**Symptom**: Error `PUT /api/orders/undefined 400`  
**Cause**: Backend not returning `_id` field  
**Solution**: Check `/api/pos-login/orders` endpoint - ensure `.lean()` is used to preserve `_id`

### **Issue 2: Order status not updating**
**Symptom**: Order stays "draft" after payment  
**Cause**: Backend middleware not triggered  
**Solution**: Check backend `Order.pre('save')` has `_originalStatus` auto-fetch logic

### **Issue 3: Inventory not decreasing**
**Symptom**: quantityOnShelf unchanged  
**Cause**: Status change not detected by middleware  
**Solution**: Verify `_originalStatus` is set before save - see `POS_ORDER_INVENTORY_FIX.md`

### **Issue 4: Payment referenceId wrong**
**Symptom**: Payment created but referenceId is null/undefined  
**Cause**: Using wrong variable in payment creation  
**Solution**: Ensure using extracted `orderId` variable, not `existingOrder.id` directly

---

## 📝 Related Documentation

- **POS_ORDER_INVENTORY_FIX.md** - Original inventory update bug fix
- **POS_PAYMENT_FLOWS.md** - Complete payment flow documentation
- **POS_PAYMENT_IMPLEMENTATION.md** - Implementation summary (Vietnamese)
- **POS_ORDER_WORKFLOW.md** - Overall POS workflow

---

**Fix Version**: 1.1  
**Date**: 2025-11-29  
**Status**: ✅ Implemented & Ready for Testing
