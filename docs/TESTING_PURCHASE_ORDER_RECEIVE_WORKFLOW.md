# Testing Purchase Order Receive Workflow

## 📋 Mục Đích
Tài liệu này hướng dẫn test workflow nhận hàng (Receive Goods) từ Purchase Order đã được tích hợp vào `PurchaseOrderList`.

---

## ✅ Prerequisites

### 1. Backend Running
```powershell
cd e:\UIT\github\backend
npm run dev
```

### 2. Frontend Running
```powershell
cd e:\UIT\github\backend\admin
npm run dev
```

### 3. Database
- MongoDB đang chạy
- Có ít nhất 1 supplier trong database
- Có ít nhất 2-3 products trong database

---

## 🧪 Test Cases

### Test Case 1: Tạo Purchase Order Mới

#### Steps:
1. Vào trang Purchase Orders
2. Click nút **"+ Add Purchase Order"**
3. Điền thông tin:
   - **Supplier**: Chọn nhà cung cấp
   - **Products**: Thêm 2-3 sản phẩm
   - **Quantity**: Mỗi sản phẩm nhập số lượng (ví dụ: 100 units)
   - **Unit Price**: Nhập giá (ví dụ: 25,000 đ)
   - **Expected Delivery Date**: Chọn ngày trong tương lai
   - **Shipping Fee**: 50,000 đ (optional)
   - **Notes**: "Test PO for receive workflow"

4. Click **"Create Purchase Order"**

#### Expected Results:
✅ PO được tạo với status = `pending`  
✅ Hiển thị trong danh sách PO  
✅ **KHÔNG có stock in** (inventory không thay đổi)  
✅ Total price = sum(quantity × unitPrice) + shippingFee

#### Verify:
```javascript
// Check trong MongoDB hoặc API
{
  status: 'pending',
  items: [...],
  totalPrice: calculated_correctly
}

// Check Inventory collection - quantity KHÔNG thay đổi
```

---

### Test Case 2: Approve Purchase Order

#### Steps:
1. Tìm PO vừa tạo (status = `pending`)
2. Click vào **Status dropdown** (màu vàng - Pending)
3. Chọn **"Approved"** (màu xanh dương)
4. Confirm dialog

#### Expected Results:
✅ Status chuyển từ `pending` → `approved`  
✅ Status badge đổi màu: Vàng → Xanh dương  
✅ **KHÔNG có stock in** (inventory không thay đổi)  
✅ Alert message: "Next step: Use 'Receive Goods' to create batches and stock in."

#### Verify:
```javascript
// PO status updated
{
  status: 'approved'
}

// Inventory vẫn KHÔNG thay đổi
// ProductBatch chưa được tạo
// DetailInventory chưa được tạo
```

---

### Test Case 3: Receive Goods (Main Test)

#### Steps:

##### 3.1. Mở Modal Receive Goods
1. Tìm PO có status = `approved`
2. Click **Actions (⋮)** dropdown
3. Click **"📦 Receive Goods"**
4. Modal "Receive Purchase Order" mở ra

##### 3.2. Verify Modal UI
✅ Header hiển thị: PO Number + Supplier Name  
✅ Progress bar: "0/3 items received" (giả sử có 3 items)  
✅ List tất cả products trong PO  
✅ Mỗi product hiển thị:
   - Product image (nếu có)
   - Product name
   - Quantity ordered
   - Unit price
   - Total value
   - Button **"Receive"** (màu xanh lá)

##### 3.3. Receive First Item
1. Click **"Receive"** button của item đầu tiên
2. Form nhập batch info hiển thị:

**Fill the form:**
```
Quantity Received: 100 (or partial, e.g., 80)
Manufacturing Date: 2024-01-15
Expiry Date: 2025-01-15
Warehouse Location: A1-B2-C3
Notes: Good condition, package intact
```

3. Click **"Receive Stock"**

#### Expected Results:
✅ Loading indicator hiển thị  
✅ Form submit successfully  
✅ Quay lại item list  
✅ Item vừa receive hiển thị checkmark ✓ + "Received" (màu xanh lá)  
✅ Progress bar cập nhật: "1/3 items received" (33%)

#### Backend Verify:
```javascript
// 1. ProductBatch được tạo
{
  product: product_id,
  quantity: 100,
  costPrice: 25000,
  unitPrice: 25000,
  mfgDate: "2024-01-15",
  expiryDate: "2025-01-15",
  status: 'active',
  notes: "Received from PO PO001"
}

// 2. DetailInventory được tạo
{
  batchId: batch_id,
  quantityOnHand: 100,
  quantityOnShelf: 0,
  quantityReserved: 0,
  location: "A1-B2-C3"
}

// 3. InventoryMovementBatch được tạo
{
  batchId: batch_id,
  inventoryDetail: detail_inventory_id,
  movementType: 'in',
  quantity: 100,
  reason: 'Purchase Order Receipt',
  purchaseOrderId: po_id,
  notes: "Received from PO PO001"
}

// 4. DetailPurchaseOrder updated với batch reference
{
  _id: detail_po_id,
  batch: batch_id  // ← NEW
}
```

##### 3.4. Receive Remaining Items
1. Repeat steps 3.3 cho item thứ 2
2. Repeat steps 3.3 cho item thứ 3

#### Expected Results:
✅ Progress bar: "2/3" → "3/3" (100%)  
✅ Tất cả items đều có checkmark ✓  
✅ Footer message: "✓ All items received! PO will be marked as received."

##### 3.5. Verify PO Status Auto-Update
After receiving all items:

✅ Modal tự động đóng  
✅ PO status chuyển từ `approved` → `received`  
✅ Status badge: Xanh dương → Xanh lá  
✅ Alert: "Goods received successfully"  
✅ Danh sách PO refresh

---

### Test Case 4: Partial Receive (Edge Case)

#### Steps:
1. Tạo PO mới với 1 item: 100 units
2. Approve PO
3. Click "Receive Goods"
4. Nhập **Quantity Received = 80** (partial)
5. Fill batch info và submit

#### Expected Results:
✅ Batch created với quantity = 80  
✅ Stock in 80 units  
✅ Warning message: "⚠️ Receiving partial quantity. Remaining: 20 units"  
✅ PO status vẫn là `approved` (chưa receive hết)  
✅ Item hiển thị "Received" nhưng quantity chưa đủ

#### Business Rule:
- Hiện tại system chỉ cho receive 1 lần per item
- Nếu muốn partial receive nhiều lần → cần enhance logic

---

### Test Case 5: Validation Tests

#### 5.1. Invalid Quantity
Steps:
1. Receive Goods modal
2. Nhập **Quantity = 150** (> ordered 100)
3. Submit

Expected: ❌ Error: "Cannot receive more than ordered quantity (100)"

#### 5.2. Invalid Dates
Steps:
1. Manufacturing Date = 2025-12-31 (future)
2. Submit

Expected: ❌ Error: "Manufacturing date cannot be in the future"

Steps:
1. Manufacturing Date = 2024-01-15
2. Expiry Date = 2024-01-10 (before mfg)
3. Submit

Expected: ❌ Error: "Expiry date must be after manufacturing date"

#### 5.3. Missing Required Fields
Steps:
1. Leave Warehouse Location empty
2. Submit

Expected: ❌ Error: "Warehouse location is required"

---

### Test Case 6: Inventory Verification

#### Before Receive:
```sql
-- Check product inventory
SELECT * FROM inventories WHERE product = 'product_id';
-- quantity = 50 (example)
```

#### After Receive 100 units:
```sql
SELECT * FROM inventories WHERE product = 'product_id';
-- quantity = 150 (50 + 100) ✅
```

#### Check Batches:
```sql
SELECT * FROM product_batches 
WHERE product = 'product_id' 
ORDER BY expiryDate ASC;  -- FEFO order

-- Should show new batch at correct position
```

#### Check DetailInventories:
```sql
SELECT * FROM detail_inventories 
WHERE batchId = 'new_batch_id';

-- quantityOnHand = 100
-- quantityOnShelf = 0
-- location = "A1-B2-C3"
```

#### Check Movements:
```sql
SELECT * FROM inventory_movement_batches 
WHERE purchaseOrderId = 'po_id';

-- movementType = 'in'
-- quantity = 100
```

---

## 🎯 UI/UX Checklist

### Purchase Order List Page
- [ ] "Receive Goods" button chỉ hiện khi status = `approved`
- [ ] Button có icon 📦
- [ ] Hover state: màu tím nhạt

### Receive Modal
- [ ] Header hiển thị PO number + supplier
- [ ] Progress bar update real-time
- [ ] Item list responsive
- [ ] "Back to item list" button work
- [ ] Loading state khi submit
- [ ] Success animation khi receive

### Batch Info Form
- [ ] Product image hiển thị
- [ ] Ordered quantity, unit price, total value đúng
- [ ] Date inputs có min/max validation
- [ ] Quantity percentage display
- [ ] Shelf life calculation (days between mfg & exp)
- [ ] Character count cho notes (500 max)
- [ ] Error messages hiển thị đúng vị trí

---

## 🐛 Common Issues & Troubleshooting

### Issue 1: "Receive Goods" button không hiện
**Cause:** PO status không phải `approved`  
**Fix:** Approve PO trước

### Issue 2: Modal không mở
**Cause:** Import `ReceivePurchaseOrderModal` thiếu  
**Fix:** Check import statement trong `PurchaseOrderList.jsx`

### Issue 3: Batch không được tạo
**Cause:** API endpoint thiếu hoặc service lỗi  
**Fix:** 
```javascript
// Check console logs
console.error('Error creating batch:', error);

// Verify API endpoints exist:
POST /api/product-batches
POST /api/detail-inventories
POST /api/inventory-movement-batches
PUT /api/detail-purchase-orders/:id
```

### Issue 4: Inventory không tăng
**Cause:** Pre-save hook của DetailInventory không chạy  
**Fix:** Check `models/detailInventory.js` pre-save hook

### Issue 5: PO status không đổi thành "received"
**Cause:** Logic check "all items received" sai  
**Fix:** Check `receivedItems` Set trong `ReceivePurchaseOrderModal.jsx`

---

## 📊 Test Data Template

### Suppliers:
```json
{
  "companyName": "ABC Supplier Co.",
  "supplierCode": "SUP001",
  "contactPerson": "John Doe",
  "phone": "0123456789",
  "email": "supplier@abc.com"
}
```

### Products:
```json
[
  {
    "name": "Widget A",
    "sku": "WID-A-001",
    "category": "Electronics",
    "description": "High quality widget"
  },
  {
    "name": "Gadget B",
    "sku": "GAD-B-002",
    "category": "Tools",
    "description": "Professional gadget"
  }
]
```

### Purchase Order:
```json
{
  "supplier": "supplier_id",
  "orderDate": "2024-01-20",
  "expectedDeliveryDate": "2024-02-01",
  "items": [
    {
      "product": "product_a_id",
      "quantity": 100,
      "unitPrice": 25000
    },
    {
      "product": "product_b_id",
      "quantity": 50,
      "unitPrice": 45000
    }
  ],
  "shippingFee": 50000,
  "status": "pending",
  "paymentStatus": "unpaid",
  "notes": "Test PO for workflow"
}
```

---

## 📝 Testing Checklist

### Functional Tests
- [ ] Create PO → status = pending ✅
- [ ] Approve PO → status = approved ✅
- [ ] Receive Goods modal opens ✅
- [ ] Batch info form validation works ✅
- [ ] Create batch + detail inventory + movement ✅
- [ ] Inventory quantity increases ✅
- [ ] PO status → received when all items done ✅
- [ ] Partial receive warning shows ✅

### Data Integrity Tests
- [ ] ProductBatch has correct data ✅
- [ ] DetailInventory linked to batch ✅
- [ ] InventoryMovementBatch has PO reference ✅
- [ ] DetailPurchaseOrder has batch reference ✅
- [ ] Inventory.quantity = sum of all batches ✅

### Edge Cases
- [ ] Receive 0 quantity → error ✅
- [ ] Receive > ordered → error ✅
- [ ] Future mfg date → error ✅
- [ ] Expiry before mfg → error ✅
- [ ] Missing location → error ✅
- [ ] Cancel during loading → no data corruption ✅

### UI/UX Tests
- [ ] Responsive design ✅
- [ ] Loading states ✅
- [ ] Error messages clear ✅
- [ ] Success feedback ✅
- [ ] Progress bar accurate ✅

---

## 🎬 Demo Script

```
1. Login to admin panel
2. Navigate to Purchase Orders
3. Click "+ Add Purchase Order"
4. Fill form:
   - Supplier: ABC Corp
   - Product 1: Widget A, qty: 100, price: 25,000
   - Product 2: Gadget B, qty: 50, price: 45,000
   - Shipping: 50,000
5. Submit → PO001 created (pending)

6. Click Status dropdown on PO001
7. Select "Approved" → Confirm
8. Status changes to approved (blue badge)

9. Click Actions (⋮) on PO001
10. Click "📦 Receive Goods"
11. Modal opens showing 2 items

12. Click "Receive" on Widget A
13. Fill batch info:
    - Qty: 100
    - Mfg: 2024-01-15
    - Exp: 2025-01-15
    - Location: A1-B2
14. Submit → Item marked received (1/2)

15. Click "Receive" on Gadget B
16. Fill batch info:
    - Qty: 50
    - Mfg: 2024-01-16
    - Exp: 2025-01-16
    - Location: C3-D4
17. Submit → Item marked received (2/2)

18. Modal auto-closes
19. PO001 status → received (green badge)
20. Alert: "Goods received successfully"

21. Navigate to Inventories page
22. Verify Widget A inventory increased by 100
23. Verify Gadget B inventory increased by 50

24. Navigate to Product Batches page
25. Verify 2 new batches created with correct info

✅ Workflow complete!
```

---

## 📚 Related Files

### Frontend:
- `admin/src/components/PurchaseOrderList/PurchaseOrderList.jsx`
- `admin/src/components/PurchaseOrderList/ReceivePurchaseOrderModal.jsx`
- `admin/src/components/PurchaseOrderList/ReceiveBatchInfoForm.jsx`
- `admin/src/services/purchaseOrderService.js`
- `admin/src/services/productBatchService.js`
- `admin/src/services/detailInventoryService.js`
- `admin/src/services/inventoryMovementBatchService.js`

### Backend:
- `controllers/purchaseOrders.js`
- `controllers/productBatches.js`
- `controllers/detailInventories.js`
- `controllers/inventoryMovementBatches.js`
- `models/purchaseOrder.js`
- `models/productBatch.js`
- `models/detailInventory.js`
- `models/inventoryMovementBatch.js`

---

## 🔗 References

- [PURCHASE_ORDER_WORKFLOW.md](./PURCHASE_ORDER_WORKFLOW.md) - Workflow documentation
- [BATCH_MANAGEMENT_WORKFLOW.md](./BATCH_MANAGEMENT_WORKFLOW.md) - Batch & FEFO logic

---

**Happy Testing! 🚀**
