# POS Order Inventory Fix - Implementation Summary

## Problem Statement

POS orders were not updating inventory correctly when creating orders with payments. The issue was:
- DetailInventory `quantityOnShelf` was not decreasing
- InventoryMovementBatch logs were not being created
- Stock remained unchanged after POS sales

## Root Cause Analysis

The problem occurred due to how Mongoose handles the `_originalStatus` property in transaction contexts:

1. **Transient Property Issue**: `_originalStatus` is not a database field, it's a transient property used to track status changes
2. **Transaction Context**: When re-fetching an order within a transaction, the `_originalStatus` was not being set by the controller
3. **Middleware Timing**: The pre-save middleware couldn't determine the original status to trigger inventory updates

## Solution Implemented

### 1. Enhanced Order Model Middleware (`models/order.js`)

**Key Changes:**
- Added automatic `_originalStatus` retrieval from database if not set by controller
- Made query transaction-aware using `this.$session()`
- Made OrderDetail query transaction-aware for proper batch processing
- Added comprehensive logging for debugging

```javascript
orderSchema.pre('save', async function (next) {
  // Check if status modified
  if (!this.isModified('status') || this.isNew) {
    return next();
  }

  // ⭐ Auto-fetch _originalStatus if not set
  if (!this._originalStatus) {
    const query = this.constructor.findById(this._id);
    
    // Use transaction session if available
    if (this.$session()) {
      query.session(this.$session());
    }
    
    const original = await query.lean();
    if (original && original.status) {
      this._originalStatus = original.status;
    }
  }

  const oldStatus = this._originalStatus;
  const newStatus = this.status;

  // Process inventory changes based on status transition
  // ...
});
```

### 2. Updated POS Controller (`controllers/posLogin.js`)

**Key Changes:**
- Added explicit `_originalStatus` tracking in `createPOSOrder()` helper
- Enhanced logging throughout order creation flow
- Proper status change handling: `draft → delivered`

```javascript
// In createPOSOrder helper:
order._originalStatus = 'draft'; // Explicitly set after creation

// In order-with-payment endpoint:
const orderToUpdate = await Order.findById(order._id).session(session);
orderToUpdate._originalStatus = orderToUpdate.status; // 'draft'
orderToUpdate.status = 'delivered';
orderToUpdate.markModified('status');
await orderToUpdate.save({ session });
```

### 3. Transaction-Aware Queries

All queries within the middleware now respect the transaction session:

```javascript
// OrderDetail query
const detailsQuery = OrderDetail.find({ order: this._id })
  .populate('batch')
  .populate('product');

if (this.$session()) {
  detailsQuery.session(this.$session());
}

const details = await detailsQuery;
```

## Test Results

### Before Fix:
```
Expected shelf decrease: 2
Actual shelf decrease: 0        ❌
Expected new movements: 1
Actual new movements: 0         ❌
```

### After Fix:
```
Expected shelf decrease: 2
Actual shelf decrease: 2        ✅
Expected new movements: 1
Actual new movements: 1         ✅

Movement Log:
- Movement Number: BATCHMOV2025000044
- Type: out
- Quantity: -2
- Reason: POS direct sale - Order ORD2511000025
- Notes: POS sale completed. Stock sold directly from shelf (no reservation).
```

## Flow Comparison

### Admin Order Flow (2 separate API calls):
```
1. POST /api/orders (status: draft)
   → No inventory movement
   
2. PUT /api/orders/:id (status: draft → delivered)
   → Middleware triggered
   → Inventory updated
   → Movement logged
```

### POS Order Flow (1 atomic transaction):
```
POST /api/pos-login/order-with-payment
  1. Create Order (status: draft)
  2. Create Payment (status: completed)
  3. Update Order (status: draft → delivered)
     → Middleware triggered ✅
     → Inventory updated ✅
     → Movement logged ✅
  4. Commit transaction
```

## Key Differences: Admin vs POS

| Aspect | Admin Order | POS Order |
|--------|-------------|-----------|
| **Flow** | draft → pending → delivered | draft → delivered (direct) |
| **Reservation** | Yes (pending reserves stock) | No (immediate sale) |
| **Movement Logs** | 2 logs (reserve + complete) | 1 log (direct sale) |
| **Payment** | Separate API call | Same transaction |
| **Use Case** | Online orders, delivery | In-store, immediate payment |

## Files Modified

1. **`controllers/posLogin.js`**
   - Enhanced logging in `order-with-payment` endpoint
   - Explicit `_originalStatus` tracking in `createPOSOrder()`
   - Added debug output for status transitions

2. **`models/order.js`**
   - Auto-fetch `_originalStatus` from DB if not set
   - Transaction-aware queries using `this.$session()`
   - Enhanced logging for debugging
   - Transaction-aware OrderDetail queries

3. **`test-pos-order.js`** (New)
   - Comprehensive test script for POS order creation
   - Verifies inventory updates and movement logs
   - Tests FEFO batch allocation

## Testing Instructions

### Run Test Script:
```bash
node test-pos-order.js
```

### Manual Testing via API:
```bash
# 1. Login to POS
POST /api/pos-login
{
  "employeeCode": "EMP001",
  "pin": "1234"
}

# 2. Create Order with Payment
POST /api/pos-login/order-with-payment
Authorization: Bearer <token>
{
  "customer": "virtual-guest",
  "items": [
    {
      "product": "PRODUCT_ID",
      "quantity": 2
    }
  ],
  "paymentMethod": "cash"
}

# 3. Verify inventory decreased
GET /api/detail-inventories?batchId=BATCH_ID

# 4. Verify movement log created
GET /api/inventory-movement-batches?batchId=BATCH_ID&movementType=out
```

## Debugging Tips

### Enable Detailed Logs:
The middleware now outputs comprehensive logs:

```
========== ORDER PRE-SAVE MIDDLEWARE ==========
Order ID: 692b0f0babebb898ff015c39
Order Number: ORD2511000025
isNew: false
isModified('status'): true
Current status: delivered
_originalStatus: draft ✅
Status change detected: draft → delivered ✅
✅ Processing status change: draft → delivered
Found 1 order detail(s)
✅ MATCHED CASE: draft → delivered (POS direct sale)
================================================
```

### Check for Issues:
1. If `_originalStatus: undefined` → Controller didn't set it, middleware will auto-fetch
2. If `Found 0 order detail(s)` → OrderDetails not visible in transaction (check session)
3. If `SKIP: Status not modified` → Status wasn't actually changed

## Future Improvements

1. **Performance**: Cache `_originalStatus` to avoid extra DB query
2. **Validation**: Add pre-flight stock validation before order creation
3. **Rollback**: Implement automatic rollback on inventory update failures
4. **Testing**: Add integration tests for all status transitions
5. **Logging**: Move to structured logging system (Winston/Bunyan)

## Conclusion

The fix ensures that:
- ✅ POS orders correctly update inventory in atomic transactions
- ✅ DetailInventory `quantityOnShelf` decreases properly
- ✅ InventoryMovementBatch logs are created for audit trail
- ✅ Transaction integrity is maintained throughout
- ✅ Both Admin and POS flows work correctly with different business logic

The solution is backward compatible and doesn't affect existing Admin order functionality.
