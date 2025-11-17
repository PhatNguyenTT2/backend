# Purchase Order Receive Workflow - Testing Checklist

## 📅 Test Session
- **Date:** _____________
- **Tester:** _____________
- **Environment:** Development
- **Backend URL:** http://localhost:3001
- **Frontend URL:** http://localhost:5173

---

## ✅ Pre-Test Setup

- [ ] Backend server running (`npm run dev` in backend folder)
- [ ] Frontend server running (`npm run dev` in admin folder)
- [ ] MongoDB connected
- [ ] At least 1 supplier exists in database
- [ ] At least 2 products exist in database
- [ ] Browser console open for debugging
- [ ] Network tab open to monitor API calls

---

## 🧪 Test Case 1: Create Purchase Order

### Steps:
- [ ] Navigate to Purchase Orders page
- [ ] Click "Add Purchase Order" button
- [ ] Select a supplier from dropdown
- [ ] Add Product 1:
  - Product: _____________
  - Quantity: _____________
  - Unit Price: _____________
- [ ] Add Product 2:
  - Product: _____________
  - Quantity: _____________
  - Unit Price: _____________
- [ ] Set Expected Delivery Date: _____________
- [ ] Set Shipping Fee: _____________
- [ ] Add Notes: _____________
- [ ] Click "Create Purchase Order"

### Expected Results:
- [ ] Success message displayed
- [ ] PO appears in list with status "pending" (yellow badge)
- [ ] PO Number generated: _____________
- [ ] Total price calculated correctly: _____________
- [ ] Inventory quantities NOT changed ✅

### Notes:
_____________________________________________
_____________________________________________

**Status:** ⬜ Pass ⬜ Fail

---

## 🧪 Test Case 2: Approve Purchase Order

### Steps:
- [ ] Locate the PO created in Test Case 1
- [ ] Click on Status dropdown (yellow "Pending" badge)
- [ ] Select "Approved" option
- [ ] Confirm the action if prompted

### Expected Results:
- [ ] Status changes to "approved" (blue badge)
- [ ] Alert message mentions "Receive Goods"
- [ ] Inventory quantities still NOT changed ✅
- [ ] "Receive Goods" option appears in Actions dropdown

### Notes:
_____________________________________________
_____________________________________________

**Status:** ⬜ Pass ⬜ Fail

---

## 🧪 Test Case 3: Open Receive Goods Modal

### Steps:
- [ ] Click Actions (⋮) dropdown on approved PO
- [ ] Verify "Receive Goods" option is visible
- [ ] Click "Receive Goods"

### Expected Results:
- [ ] Modal opens with title "Receive Purchase Order"
- [ ] PO Number displayed: _____________
- [ ] Supplier name displayed: _____________
- [ ] Progress bar shows "0/X items received"
- [ ] All products listed with correct information
- [ ] Each product shows:
  - [ ] Product image (if available)
  - [ ] Product name
  - [ ] Ordered quantity
  - [ ] Unit price
  - [ ] Total value
  - [ ] Green "Receive" button

### Notes:
_____________________________________________
_____________________________________________

**Status:** ⬜ Pass ⬜ Fail

---

## 🧪 Test Case 4: Receive First Item

### Steps:
- [ ] Click "Receive" button on first product
- [ ] Batch info form appears
- [ ] Fill in:
  - Quantity Received: _____________
  - Manufacturing Date: _____________
  - Expiry Date: _____________
  - Warehouse Location: _____________
  - Notes: _____________
- [ ] Click "Receive Stock"

### Expected Results:
- [ ] Loading indicator appears
- [ ] Form submits successfully
- [ ] Returns to item list
- [ ] Item marked with ✓ checkmark and "Received" label
- [ ] Progress bar updates: "1/X items received"
- [ ] Progress percentage: _____________

### API Calls (check Network tab):
- [ ] POST `/api/product-batches` - Status 201
- [ ] POST `/api/detail-inventories` - Status 201
- [ ] POST `/api/inventory-movement-batches` - Status 201
- [ ] PUT `/api/detail-purchase-orders/:id` - Status 200

### Database Verification:
```javascript
// ProductBatch created
Batch ID: _____________
Quantity: _____________
Mfg Date: _____________
Exp Date: _____________

// DetailInventory created
ID: _____________
Location: _____________
Quantity On Hand: _____________

// InventoryMovementBatch created
ID: _____________
Movement Type: in
Quantity: _____________
```

### Notes:
_____________________________________________
_____________________________________________

**Status:** ⬜ Pass ⬜ Fail

---

## 🧪 Test Case 5: Receive Second Item

### Steps:
- [ ] Click "Receive" button on second product
- [ ] Fill batch info with DIFFERENT dates:
  - Quantity Received: _____________
  - Manufacturing Date: _____________
  - Expiry Date: _____________
  - Warehouse Location: _____________
  - Notes: _____________
- [ ] Click "Receive Stock"

### Expected Results:
- [ ] Second item marked as received
- [ ] Progress bar: "2/2 items received" (100%)
- [ ] Footer message: "✓ All items received! PO will be marked as received."

### Notes:
_____________________________________________
_____________________________________________

**Status:** ⬜ Pass ⬜ Fail

---

## 🧪 Test Case 6: PO Status Auto-Update

### Expected Results (after all items received):
- [ ] Modal automatically closes
- [ ] Success message: "Goods received successfully"
- [ ] PO list refreshes
- [ ] PO status changes to "received" (green badge)

### API Call:
- [ ] PUT `/api/purchase-orders/:id/status` - Status 200
  - Body: `{ status: "received" }`

### Notes:
_____________________________________________
_____________________________________________

**Status:** ⬜ Pass ⬜ Fail

---

## 🧪 Test Case 7: Inventory Verification

### Product 1:
**Before Receive:**
- Inventory Quantity: _____________

**After Receive:**
- Inventory Quantity: _____________
- Expected Increase: _____________
- [ ] Quantity increased correctly ✅

### Product 2:
**Before Receive:**
- Inventory Quantity: _____________

**After Receive:**
- Inventory Quantity: _____________
- Expected Increase: _____________
- [ ] Quantity increased correctly ✅

### Notes:
_____________________________________________
_____________________________________________

**Status:** ⬜ Pass ⬜ Fail

---

## 🧪 Test Case 8: Form Validation Tests

### 8a. Invalid Quantity (exceeds ordered)
- [ ] Enter quantity > ordered quantity
- [ ] Try to submit
- [ ] Error message displayed: "Cannot receive more than ordered quantity"

**Status:** ⬜ Pass ⬜ Fail

### 8b. Future Manufacturing Date
- [ ] Enter mfg date in the future
- [ ] Try to submit
- [ ] Error message: "Manufacturing date cannot be in the future"

**Status:** ⬜ Pass ⬜ Fail

### 8c. Expiry Before Manufacturing
- [ ] Enter expiry date before mfg date
- [ ] Try to submit
- [ ] Error message: "Expiry date must be after manufacturing date"

**Status:** ⬜ Pass ⬜ Fail

### 8d. Missing Location
- [ ] Leave warehouse location empty
- [ ] Try to submit
- [ ] Error message: "Warehouse location is required"

**Status:** ⬜ Pass ⬜ Fail

### 8e. Expired Product
- [ ] Enter expiry date in the past
- [ ] Try to submit
- [ ] Error message: "Expiry date must be in the future"

**Status:** ⬜ Pass ⬜ Fail

---

## 🧪 Test Case 9: Partial Receive Warning

### Steps:
- [ ] Create new PO with 1 product, quantity 100
- [ ] Approve PO
- [ ] Receive Goods
- [ ] Enter quantity = 80 (partial)
- [ ] Check for warning message

### Expected Results:
- [ ] Warning message: "⚠️ Receiving partial quantity. Remaining: 20 units"
- [ ] Percentage shown: 80%
- [ ] Can still submit successfully
- [ ] Batch created with quantity 80

### Notes:
_____________________________________________
_____________________________________________

**Status:** ⬜ Pass ⬜ Fail

---

## 🧪 Test Case 10: UI/UX Elements

### Receive Modal UI:
- [ ] Modal responsive (resize browser window)
- [ ] Progress bar smooth animation
- [ ] Checkmark icons display correctly
- [ ] Colors match design:
  - Pending: Yellow (#f59e0b)
  - Approved: Blue (#3b82f6)
  - Received: Green (#10b981)

### Batch Form UI:
- [ ] Product image displays
- [ ] Shelf life calculation shows
- [ ] Character counter for notes works (max 500)
- [ ] Date inputs have proper min/max
- [ ] Loading spinner during submit
- [ ] Back button works

### Buttons & Actions:
- [ ] "Receive Goods" button only shows for approved POs
- [ ] Cannot edit received POs
- [ ] Can delete received POs
- [ ] Hover states work correctly

**Status:** ⬜ Pass ⬜ Fail

---

## 🧪 Test Case 11: Edge Cases

### 11a. Cancel During Receive
- [ ] Start receiving an item
- [ ] Click "Cancel" or "Back"
- [ ] Verify no data was created

**Status:** ⬜ Pass ⬜ Fail

### 11b. Network Error Handling
- [ ] Disconnect network (or stop backend)
- [ ] Try to receive item
- [ ] Error message displayed
- [ ] Form stays open for retry

**Status:** ⬜ Pass ⬜ Fail

### 11c. Duplicate Submit Prevention
- [ ] Submit form
- [ ] Quickly click submit again
- [ ] Only one batch created (no duplicates)

**Status:** ⬜ Pass ⬜ Fail

---

## 📊 Overall Test Results

### Summary:
- **Total Test Cases:** 11
- **Passed:** _____
- **Failed:** _____
- **Blocked:** _____
- **Not Tested:** _____

### Pass Rate: _____%

---

## 🐛 Issues Found

### Issue 1:
**Description:** _____________________________________________
**Severity:** ⬜ Critical ⬜ Major ⬜ Minor
**Steps to Reproduce:** _____________________________________________
**Expected:** _____________________________________________
**Actual:** _____________________________________________
**Status:** _____________________________________________

### Issue 2:
**Description:** _____________________________________________
**Severity:** ⬜ Critical ⬜ Major ⬜ Minor
**Steps to Reproduce:** _____________________________________________
**Expected:** _____________________________________________
**Actual:** _____________________________________________
**Status:** _____________________________________________

### Issue 3:
**Description:** _____________________________________________
**Severity:** ⬜ Critical ⬜ Major ⬜ Minor
**Steps to Reproduce:** _____________________________________________
**Expected:** _____________________________________________
**Actual:** _____________________________________________
**Status:** _____________________________________________

---

## 📝 Additional Notes

_____________________________________________
_____________________________________________
_____________________________________________
_____________________________________________
_____________________________________________

---

## ✅ Sign-off

**Tested By:** _____________  
**Date:** _____________  
**Signature:** _____________

**Reviewed By:** _____________  
**Date:** _____________  
**Signature:** _____________

---

## 📚 References
- [PURCHASE_ORDER_WORKFLOW.md](./PURCHASE_ORDER_WORKFLOW.md)
- [TESTING_PURCHASE_ORDER_RECEIVE_WORKFLOW.md](./TESTING_PURCHASE_ORDER_RECEIVE_WORKFLOW.md)
- [QUICK_TEST_RECEIVE_WORKFLOW.md](./QUICK_TEST_RECEIVE_WORKFLOW.md)
