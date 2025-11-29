# Tóm Tắt Luồng Hoạt Động POS Payment

## 📋 Tổng Quan

Hệ thống POS hiện hỗ trợ **2 luồng payment** khác nhau:

1. **FLOW 1**: Payment cho Held Order (Order đã tồn tại với status='draft')
2. **FLOW 2**: Payment cho New Order (Tạo order + payment cùng lúc - Atomic)

---

## 🔄 FLOW 1: Held Order Payment

### **Mô Tả**
Xử lý thanh toán cho các đơn hàng đã được tạo trước đó (held orders) với trạng thái `draft`.

### **Luồng Hoạt Động**

```
┌─────────────────────────────────────────────────────────────────────┐
│                    FLOW 1: HELD ORDER PAYMENT                        │
└─────────────────────────────────────────────────────────────────────┘

1️⃣ Load Held Order
   │
   ├─ User clicks "Held Orders" button
   │  └─ POSHeldOrdersModal opens
   │
   ├─ Fetch draft orders: GET /api/pos-login/orders?status=draft
   │  └─ Returns list of held orders
   │
   └─ User selects an order to load
      │
      └─ handleLoadHeldOrder(order) triggered
         ├─ Clear current cart
         ├─ Convert order.details → cart items
         ├─ Set customer from order.customer
         ├─ Set existingOrder = order ⭐
         └─ Close modal

2️⃣ Review Cart & Customer
   │
   ├─ Cart populated with held order items
   ├─ Customer auto-selected
   ├─ Totals calculated
   └─ existingOrder state is SET ⭐

3️⃣ Checkout
   │
   └─ User clicks "Checkout" button
      └─ POSPaymentModal opens
         ├─ Detect existingOrder !== null ⭐
         ├─ Show "Held Order" badge
         ├─ Display order number
         └─ List payment methods

4️⃣ Select Payment Method
   │
   └─ User selects payment method (cash/card/bank_transfer)
      │
      └─ handlePaymentMethodSelect(method) triggered
         │
         └─ Detect FLOW 1 (existingOrder exists) ⭐
            │
            ├─ Step A: Update Order Status
            │  └─ PUT /api/orders/:id
            │     {
            │       status: 'delivered',
            │       paymentStatus: 'paid'
            │     }
            │     │
            │     └─ Backend:
            │        ├─ Order.pre('save') middleware triggered
            │        ├─ Detect: draft → delivered ⭐
            │        ├─ Update DetailInventory:
            │        │  └─ quantityOnShelf -= quantity
            │        └─ Create InventoryMovementBatch:
            │           ├─ movementType: 'out'
            │           ├─ quantity: -X
            │           └─ reason: "POS direct sale - Order ORD..."
            │
            ├─ Step B: Create Payment Record
            │  └─ POST /api/payments
            │     {
            │       referenceType: 'Order',
            │       referenceId: order.id,
            │       amount: total,
            │       paymentMethod: method,
            │       status: 'completed'
            │     }
            │
            ├─ Step C: Fetch Full Order
            │  └─ GET /api/orders/:id
            │     └─ Returns order with details, customer, payment
            │
            └─ Step D: Show Invoice & Clean Up
               ├─ setInvoiceOrder(fullOrder)
               ├─ Close payment modal
               ├─ Open invoice modal
               ├─ Clear cart: setCart([])
               ├─ Clear customer: setSelectedCustomer(null)
               └─ Clear existingOrder: setExistingOrder(null) ⭐

5️⃣ Print Invoice & Complete
   │
   └─ POSInvoiceModal displays order
      ├─ Order details
      ├─ Customer info
      ├─ Payment info
      └─ Print button
```

### **API Calls Sequence**

| Step | Method | Endpoint | Purpose |
|------|--------|----------|---------|
| 1 | GET | `/api/pos-login/orders?status=draft` | Fetch held orders |
| 4A | PUT | `/api/orders/:id` | Update order status to delivered |
| 4B | POST | `/api/payments` | Create payment record |
| 4C | GET | `/api/orders/:id` | Fetch full order for invoice |

### **Inventory Impact**

```javascript
// DetailInventory changes (for each OrderDetail batch):
BEFORE: { quantityOnShelf: 10, quantityReserved: 0, quantityOnHand: 50 }
AFTER:  { quantityOnShelf: 8,  quantityReserved: 0, quantityOnHand: 50 }
        // ↑ Decreased by order quantity (e.g., 2)

// InventoryMovementBatch created:
{
  movementNumber: "BATCHMOV2025000123",
  batchId: "batch_id",
  movementType: "out",
  quantity: -2,  // Negative = stock decrease
  reason: "POS direct sale - Order ORD2025000045",
  date: "2025-11-29T10:30:00Z",
  performedBy: "employee_id"
}
```

### **State Changes (Frontend)**

```javascript
// Before Load Held Order:
cart = []
selectedCustomer = null
existingOrder = null ⭐

// After Load Held Order:
cart = [{ product, quantity, batch, ... }, ...]
selectedCustomer = { id, fullName, customerType, ... }
existingOrder = { id, orderNumber, status: 'draft', ... } ⭐

// After Payment Complete:
cart = []
selectedCustomer = null
existingOrder = null ⭐
showInvoiceModal = true
```

---

## 🆕 FLOW 2: New Order Payment (Atomic)

### **Mô Tả**
Tạo order mới và payment trong một transaction duy nhất (atomic operation).

### **Luồng Hoạt Động**

```
┌─────────────────────────────────────────────────────────────────────┐
│                    FLOW 2: NEW ORDER PAYMENT                         │
└─────────────────────────────────────────────────────────────────────┘

1️⃣ Add Products to Cart
   │
   ├─ User scans/clicks products
   ├─ Regular products: Auto FEFO batch selection
   ├─ Fresh products: Manual batch selection (POSBatchSelectModal)
   └─ Cart updated with items

2️⃣ Select Customer
   │
   ├─ User clicks customer button
   ├─ POSCustomerSelectModal opens
   ├─ User selects customer OR uses "Virtual Guest"
   └─ selectedCustomer set
      └─ Discount applied based on customer type:
         ├─ guest: 0%
         ├─ retail: 10%
         ├─ wholesale: 15%
         └─ vip: 20%

3️⃣ Review Cart & Totals
   │
   ├─ Cart displayed in POSCart component
   ├─ Totals calculated:
   │  ├─ Subtotal = Σ(price × quantity)
   │  ├─ Discount = Subtotal × discountPercentage
   │  └─ Total = Subtotal - Discount
   └─ existingOrder = null ⭐

4️⃣ Checkout
   │
   └─ User clicks "Checkout" button
      └─ POSPaymentModal opens
         ├─ Detect existingOrder === null ⭐
         ├─ NO "Held Order" badge
         ├─ Show "Select Payment Method"
         └─ List payment methods

5️⃣ Select Payment Method
   │
   └─ User selects payment method (cash/card/bank_transfer)
      │
      └─ handlePaymentMethodSelect(method) triggered
         │
         └─ Detect FLOW 2 (existingOrder === null) ⭐
            │
            └─ Single Atomic Transaction ⚡
               │
               ├─ POST /api/pos-login/order-with-payment
               │  {
               │    customer: customerId,
               │    items: [
               │      { product, batch, quantity, unitPrice },
               │      ...
               │    ],
               │    deliveryType: 'pickup',
               │    paymentMethod: method
               │  }
               │  │
               │  └─ Backend (Transaction):
               │     │
               │     ├─ Step 1: Create Order (status='draft')
               │     │  └─ Order.save() → status='draft'
               │     │     ⭐ Order middleware SKIPPED (isNew=true)
               │     │
               │     ├─ Step 2: Create OrderDetails
               │     │  └─ FEFO batch allocation if batch=null
               │     │
               │     ├─ Step 3: Create Payment (status='completed')
               │     │  └─ Payment.save()
               │     │
               │     ├─ Step 4: Update Order Status
               │     │  ├─ Re-fetch order: Order.findById(orderId)
               │     │  ├─ Set _originalStatus = 'draft' ⭐
               │     │  ├─ Set status = 'delivered'
               │     │  ├─ Call markModified('status')
               │     │  └─ Order.save() → Triggers middleware
               │     │     │
               │     │     └─ Order.pre('save') middleware:
               │     │        ├─ Detect: draft → delivered ⭐
               │     │        ├─ Fetch OrderDetails (with session)
               │     │        ├─ For each detail:
               │     │        │  ├─ Update DetailInventory:
               │     │        │  │  └─ quantityOnShelf -= quantity
               │     │        │  └─ Create InventoryMovementBatch:
               │     │        │     ├─ movementType: 'out'
               │     │        │     ├─ quantity: -X
               │     │        │     └─ reason: "POS direct sale"
               │     │        └─ Complete successfully ✅
               │     │
               │     └─ Commit Transaction ✅
               │        └─ Returns: { order, payment }
               │
               └─ Frontend:
                  ├─ Receive { order, payment }
                  ├─ Add paymentMethod to order
                  ├─ setInvoiceOrder(order)
                  ├─ Close payment modal
                  ├─ Open invoice modal
                  ├─ Clear cart: setCart([])
                  └─ Clear customer: setSelectedCustomer(null)

6️⃣ Print Invoice & Complete
   │
   └─ POSInvoiceModal displays order
      ├─ Order details
      ├─ Customer info
      ├─ Payment info
      └─ Print button
```

### **API Calls Sequence**

| Step | Method | Endpoint | Purpose |
|------|--------|----------|---------|
| 5 | POST | `/api/pos-login/order-with-payment` | Create order + payment (atomic) |

### **Inventory Impact**

```javascript
// DetailInventory changes (within transaction):
BEFORE: { quantityOnShelf: 10, quantityReserved: 0, quantityOnHand: 50 }
AFTER:  { quantityOnShelf: 8,  quantityReserved: 0, quantityOnHand: 50 }
        // ↑ Decreased by order quantity (e.g., 2)

// InventoryMovementBatch created (within transaction):
{
  movementNumber: "BATCHMOV2025000124",
  batchId: "batch_id",
  movementType: "out",
  quantity: -2,  // Negative = stock decrease
  reason: "POS direct sale - Order ORD2025000046",
  date: "2025-11-29T10:35:00Z",
  performedBy: "employee_id"
}
```

### **State Changes (Frontend)**

```javascript
// Before Checkout:
cart = [{ product, quantity, batch, ... }, ...]
selectedCustomer = { id, fullName, customerType, ... }
existingOrder = null ⭐

// After Payment Complete:
cart = []
selectedCustomer = null
existingOrder = null ⭐ (still null)
showInvoiceModal = true
```

---

## 🔑 Key Differences: Flow 1 vs Flow 2

| Feature | Flow 1: Held Order | Flow 2: New Order |
|---------|-------------------|-------------------|
| **Order Creation** | Already exists (draft) | Created on-the-fly |
| **existingOrder State** | SET (not null) ⭐ | null ⭐ |
| **API Calls** | 3 separate calls | 1 atomic call |
| **Transaction** | Not atomic ⚠️ | Atomic ✅ |
| **Inventory Update** | On status update (draft→delivered) | On status update (draft→delivered) |
| **Movement Logs** | 1 log (direct sale) | 1 log (direct sale) |
| **Payment Timing** | After order exists | Created with order |
| **Use Case** | Orders saved for later | Immediate checkout |
| **User Journey** | Load → Review → Pay | Add → Select → Pay |
| **Modal Badge** | "Held Order" shown ✅ | No badge |

---

## 🧩 Components Involved

### **POSMain.jsx**
- **State Management**: `cart`, `selectedCustomer`, `existingOrder` ⭐
- **Function**: `handlePaymentMethodSelect()` - Unified handler cho cả 2 flows
- **Flow Detection**: `if (existingOrder) { FLOW1 } else { FLOW2 }`

### **POSPaymentModal.jsx**
- **Props**: `existingOrder` ⭐ - Để phát hiện held order
- **UI**: Hiển thị "Held Order" badge nếu `existingOrder` tồn tại
- **Callback**: `onPaymentMethodSelect(method)` - Single callback, no confirmation step

### **POSHeldOrdersModal.jsx**
- **Purpose**: Fetch và load draft orders
- **Action**: Set `existingOrder` state when order loaded ⭐

### **POSInvoiceModal.jsx**
- **Purpose**: Display final invoice
- **Data**: Receives complete order with payment info

---

## 📊 Backend Endpoints

### **FLOW 1 Endpoints**

#### 1. Get Held Orders
```javascript
GET /api/pos-login/orders?status=draft

Response:
{
  success: true,
  data: {
    orders: [
      {
        id: "order_id",
        orderNumber: "ORD2025000045",
        status: "draft",
        total: 240000,
        customer: { ... },
        details: [ ... ]
      }
    ]
  }
}
```

#### 2. Update Order Status
```javascript
PUT /api/orders/:id

Request:
{
  status: "delivered",
  paymentStatus: "paid"
}

Response:
{
  success: true,
  data: {
    order: { ... } // Updated order
  }
}

Backend Effect:
- Order.pre('save') middleware triggered
- Inventory updated (quantityOnShelf decreased)
- InventoryMovementBatch created
```

#### 3. Create Payment
```javascript
POST /api/payments

Request:
{
  referenceType: "Order",
  referenceId: "order_id",
  amount: 240000,
  paymentMethod: "cash",
  status: "completed"
}

Response:
{
  success: true,
  data: {
    payment: {
      id: "payment_id",
      paymentNumber: "PPAY2025000089",
      amount: 240000,
      status: "completed"
    }
  }
}
```

### **FLOW 2 Endpoint**

#### Create Order + Payment (Atomic)
```javascript
POST /api/pos-login/order-with-payment

Request:
{
  customer: "customer_id", // or null for virtual guest
  items: [
    {
      product: "product_id",
      batch: null, // null = auto FEFO
      quantity: 2,
      unitPrice: 12000
    }
  ],
  deliveryType: "pickup",
  paymentMethod: "cash"
}

Response:
{
  success: true,
  data: {
    order: {
      id: "order_id",
      orderNumber: "ORD2025000046",
      status: "delivered", // ⭐ Already delivered
      paymentStatus: "paid",
      total: 240000,
      customer: { ... },
      details: [ ... ]
    },
    payment: {
      id: "payment_id",
      paymentNumber: "PPAY2025000090",
      amount: 240000,
      status: "completed"
    }
  }
}

Backend Process (Transaction):
1. Create Order (status='draft')
2. Create OrderDetails (with FEFO batch allocation)
3. Create Payment (status='completed')
4. Update Order (status='delivered') → Triggers inventory update
5. Commit transaction
```

---

## 🔐 Security & Validation

### **Frontend Validation**
```javascript
// Both flows validate:
✅ Cart not empty
✅ Customer selected
✅ Payment method selected

// Flow 1 additional:
✅ existingOrder status = 'draft'
✅ existingOrder has valid items
```

### **Backend Validation**
```javascript
// Flow 1 (Update order):
✅ Order exists
✅ Order status can transition (draft → delivered)
✅ Inventory available

// Flow 2 (Create order):
✅ Items valid
✅ FEFO batch allocation successful
✅ Sufficient stock on shelf
✅ Transaction atomic
```

---

## 🚨 Error Handling

### **Common Errors**

| Error | Flow | Cause | Solution |
|-------|------|-------|----------|
| Cart is empty | Both | User didn't add items | Prompt to add items |
| Customer not selected | Both | User didn't select customer | Prompt to select |
| Insufficient stock | Both | Not enough inventory | Show error, suggest alternatives |
| Order update failed | Flow 1 | Network/server error | Retry or contact support |
| Payment creation failed | Flow 1 | Network/server error | Order still exists, can retry |
| Transaction failed | Flow 2 | Any error in atomic process | All rolled back, retry |

### **Error Recovery**

#### Flow 1 (Held Order):
```javascript
// If order update succeeds but payment fails:
1. Order is now "delivered" ✅
2. Payment creation failed ❌
3. User can retry payment creation
4. Order already has inventory deducted

⚠️ Need to handle: Partial completion scenario
```

#### Flow 2 (New Order):
```javascript
// If any step fails:
1. Entire transaction rolled back ✅
2. No order created
3. No payment created
4. No inventory changed
5. User can retry from scratch

✅ Atomic = Clean state always
```

---

## 📈 Monitoring & Logging

### **Console Logs**

```javascript
// Flow Detection:
"💳 Payment method selected: cash"
"📦 Existing order: ORD2025000045" (Flow 1)
"📦 Existing order: None" (Flow 2)

// Flow 1 Logs:
"📋 FLOW 1: Processing payment for existing held order"
"🔄 Updating order status: draft → delivered..."
"✅ Order status updated to delivered"
"💰 Creating payment record..."
"✅ Payment created: PPAY2025000089"
"✅ FLOW 1 completed successfully!"

// Flow 2 Logs:
"📝 FLOW 2: Creating new order with payment (atomic)"
"🌐 Calling /api/pos-login/order-with-payment..."
"✅ Order created: ORD2025000046"
"✅ Payment created: PPAY2025000090"
"✅ FLOW 2 completed successfully!"
```

---

## ✅ Testing Checklist

### **Flow 1: Held Order Payment**
- [ ] Create held order (Hold button)
- [ ] Verify order in held orders list
- [ ] Load order to cart
- [ ] Verify cart populated correctly
- [ ] Verify customer auto-selected
- [ ] Verify existingOrder state set ⭐
- [ ] Click Checkout
- [ ] Verify "Held Order" badge visible
- [ ] Select payment method
- [ ] Verify order status updated (draft→delivered)
- [ ] Verify payment created
- [ ] Verify inventory decreased
- [ ] Verify movement log created
- [ ] Verify invoice displays correctly
- [ ] Verify cart cleared
- [ ] Verify existingOrder cleared

### **Flow 2: New Order Payment**
- [ ] Add products to cart
- [ ] Select customer
- [ ] Verify existingOrder = null ⭐
- [ ] Click Checkout
- [ ] Verify NO "Held Order" badge
- [ ] Select payment method
- [ ] Verify atomic transaction succeeds
- [ ] Verify order created (status=delivered)
- [ ] Verify payment created
- [ ] Verify inventory decreased
- [ ] Verify movement log created
- [ ] Verify invoice displays correctly
- [ ] Verify cart cleared

### **Edge Cases**
- [ ] Load held order with insufficient stock
- [ ] Load held order, modify cart, then checkout
- [ ] Cancel payment modal (both flows)
- [ ] Network error during Flow 1 payment
- [ ] Transaction rollback in Flow 2
- [ ] Load held order with fresh products
- [ ] Multiple batch allocation (FEFO)

---

## 🎯 Summary

### **Key Points**

1. **2 Flows, 1 Handler**: `handlePaymentMethodSelect()` xử lý cả 2 flows
2. **State Detection**: `existingOrder` state quyết định flow nào ⭐
3. **Atomic Transaction**: Flow 2 đảm bảo consistency
4. **Inventory Update**: Cả 2 flows đều update inventory chính xác
5. **User Experience**: Seamless cho cả held orders và new orders

### **Best Practices**

✅ Always check `existingOrder` state
✅ Validate inventory before payment
✅ Use atomic transactions for new orders
✅ Clear state after successful payment
✅ Log extensively for debugging
✅ Handle errors gracefully
✅ Show clear UI indicators (badges)

---

**Document Version**: 1.0  
**Last Updated**: 2025-11-29  
**Author**: Backend Team
