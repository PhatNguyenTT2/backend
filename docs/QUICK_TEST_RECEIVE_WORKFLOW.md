# Quick Test: Receive Purchase Order Workflow

## 🚀 Quick Start (5 phút)

### 1. Preparation
```powershell
# Terminal 1 - Backend
cd e:\UIT\github\backend
npm run dev

# Terminal 2 - Frontend
cd e:\UIT\github\backend\admin
npm run dev
```

### 2. Create & Approve PO
1. Login → Purchase Orders
2. **"+ Add Purchase Order"**
3. Select supplier + add 2 products
4. Submit → Status = `pending` ✅
5. Click Status dropdown → **"Approved"** ✅
6. Verify: Status = `approved` (blue badge)

### 3. Receive Goods (Main Test)
1. Click **Actions (⋮)** → **"📦 Receive Goods"**
2. Modal opens with item list ✅
3. Click **"Receive"** on first item
4. Fill form:
   ```
   Quantity: 100
   Mfg Date: 2024-01-15
   Exp Date: 2025-01-15
   Location: A1-B2
   Notes: Good condition
   ```
5. Click **"Receive Stock"** ✅
6. Item marked as received (1/2) ✅
7. Repeat for second item ✅
8. Progress: 2/2 (100%) ✅
9. Modal auto-closes ✅
10. PO Status → `received` (green badge) ✅

### 4. Verify Results

#### Database Check:
```javascript
// ProductBatch created
db.product_batches.find({ purchaseOrder: po_id })

// DetailInventory created
db.detail_inventories.find({ batchId: batch_id })

// InventoryMovementBatch created
db.inventory_movement_batches.find({ purchaseOrderId: po_id })

// Inventory quantity increased
db.inventories.findOne({ product: product_id })
// quantity should be OLD + 100
```

#### UI Check:
- [ ] PO status badge = green "RECEIVED"
- [ ] Inventory page shows increased stock
- [ ] Product Batches page shows new batches
- [ ] Detail Inventories show new records

---

## ✅ Success Criteria

| Step | Expected | Status |
|------|----------|--------|
| Create PO | Status = `pending` | ⬜ |
| Approve PO | Status = `approved` | ⬜ |
| Receive button visible | Only for approved POs | ⬜ |
| Modal opens | Shows all items | ⬜ |
| Form validation | Errors on invalid input | ⬜ |
| Batch created | With mfg/exp dates | ⬜ |
| DetailInventory created | Linked to batch | ⬜ |
| Movement created | Type = 'in' | ⬜ |
| Inventory updated | Quantity increased | ⬜ |
| PO status updated | Status = `received` | ⬜ |

---

## 🐛 Quick Troubleshooting

### Modal not opening?
→ Check PO status = `approved`

### Batch not created?
→ Check console for API errors

### Inventory not increased?
→ Check DetailInventory pre-save hook

### Form validation not working?
→ Check browser console for errors

---

## 📊 Expected Data Flow

```
Create PO (pending)
    ↓
Approve PO (approved) 
    ↓
Click "Receive Goods"
    ↓
Fill batch info for each item
    ↓
Submit → Creates:
    1. ProductBatch (mfg, exp dates)
    2. DetailInventory (location, quantity)
    3. InventoryMovementBatch (stock in record)
    4. Update DetailPurchaseOrder (batch reference)
    5. Update Inventory.quantity (auto via hook)
    ↓
All items received → PO status = received
```

---

## 🎯 Test Commands

```javascript
// Frontend Console - Check state
console.log('Receiving PO:', receivingPO);
console.log('Received items:', receivedItems);

// Check API calls
// Network tab → Filter XHR
// Should see:
// POST /api/product-batches
// POST /api/detail-inventories
// POST /api/inventory-movement-batches
// PUT /api/detail-purchase-orders/:id
// PUT /api/purchase-orders/:id/status
```

---

**Time to test: ~5 minutes**  
**Full test guide:** [TESTING_PURCHASE_ORDER_RECEIVE_WORKFLOW.md](./TESTING_PURCHASE_ORDER_RECEIVE_WORKFLOW.md)
