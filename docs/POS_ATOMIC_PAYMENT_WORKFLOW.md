# POS Atomic Payment Workflow

## 📋 Tổng quan

Workflow mới này cải tiến quy trình thanh toán POS bằng cách xử lý **Order + Payment trong một transaction duy nhất** (atomic transaction) thay vì 2 API calls riêng biệt.

## 🎯 Lợi ích

### ✅ So với workflow cũ:

| Aspect | Old (2 APIs) | New (1 API) |
|--------|--------------|-------------|
| **API Calls** | 2 (Order → Payment) | 1 (Atomic) |
| **Transaction Safety** | ❌ Not atomic | ✅ Atomic with rollback |
| **Amount Validation** | ❌ Frontend controls | ✅ Backend controls |
| **Status Management** | ❌ Manual | ✅ Automatic |
| **Error Handling** | ❌ Complex (2 steps) | ✅ Simple (1 step) |
| **Code Complexity** | ❌ Higher | ✅ Lower |
| **Security** | ❌ Vulnerable | ✅ Secure |

### 🔒 Security Improvements:
- Backend tự động tính toán `amount` → Frontend không thể manipulate
- Backend tự động set `status` → Frontend không can thiệp
- Payment luôn được tạo với status `completed` ngay lập tức
- Order `paymentStatus` tự động update sang `paid`

### ⚡ Performance Improvements:
- Giảm 50% network requests (2 → 1)
- Giảm latency
- Atomic transaction đảm bảo data consistency

## 🏗️ Kiến trúc

### Backend: `/api/pos-login/order-with-payment`

```javascript
POST /api/pos-login/order-with-payment
Authorization: Bearer <POS_TOKEN>

Request Body:
{
  "customer": "ObjectId" | null,  // null = virtual-guest
  "items": [
    {
      "product": "ObjectId",
      "batch": "ObjectId" | null,   // null = auto FEFO
      "quantity": Number,
      "unitPrice": Number
    }
  ],
  "deliveryType": "pickup",
  "paymentMethod": "cash" | "card" | "bank_transfer",
  "notes": "Optional notes"
}

Response (Success):
{
  "success": true,
  "data": {
    "order": { /* Order object with populated fields */ },
    "payment": { /* Payment object */ }
  },
  "message": "Order and payment created successfully"
}
```

### Transaction Flow:

```
START TRANSACTION
  ↓
1. Validate customer (create virtual-guest if needed)
  ↓
2. Process items with FEFO or manual batch
  ↓
3. Calculate totals (subtotal, discount, total)
  ↓
4. Create Order (status: 'pending', paymentStatus: 'pending')
  ↓
5. Create OrderDetails
  ↓
6. Create Payment (status: 'completed')
  ↓
7. Update Order (paymentStatus: 'paid')
  ↓
COMMIT TRANSACTION
  ↓
Return Order + Payment
```

**Nếu bất kỳ bước nào thất bại → ROLLBACK toàn bộ transaction**

## 💻 Frontend Implementation

### Service Layer: `posLoginService.js`

```javascript
async createOrderWithPayment(orderData) {
  const response = await api.post('/pos-login/order-with-payment', orderData, {
    headers: { Authorization: `Bearer ${token}` }
  });
  
  return {
    success: true,
    data: response.data.data  // { order, payment }
  };
}
```

### Component: `POSMain.jsx`

```javascript
const handlePaymentMethodSelect = async (paymentMethod) => {
  // Prepare items
  const items = cart.map(item => ({
    product: item.productId || item.id,
    batch: item.batch?.id || null,
    quantity: item.quantity,
    unitPrice: item.price
  }));

  // Single API call
  const response = await posLoginService.createOrderWithPayment({
    customer: selectedCustomer.id === 'virtual-guest' ? null : selectedCustomer.id,
    items: items,
    deliveryType: 'pickup',
    paymentMethod: paymentMethod,
    notes: `POS Payment - ${paymentMethod}`
  });

  // Show invoice directly
  const { order, payment } = response.data;
  setInvoiceOrder(order);
  setShowInvoiceModal(true);
};
```

## 🔄 Workflow Comparison

### Old Workflow (2 Steps):

```
User selects payment method
  ↓
Frontend: Create Order (POST /api/pos-login/order)
  ↓ (separate API call)
Frontend: Create Payment (POST /api/payments)
  ↓ (separate API call)
Frontend: Fetch Order again (GET /api/orders/:id)
  ↓
Show Invoice
```

**Issues:**
- ❌ 3 API calls
- ❌ If Payment fails, Order is orphaned
- ❌ Frontend calculates amount (security risk)
- ❌ Manual status management

### New Workflow (1 Step):

```
User selects payment method
  ↓
Frontend: Create Order+Payment (POST /api/pos-login/order-with-payment)
  ↓
Show Invoice
```

**Benefits:**
- ✅ 1 API call
- ✅ Atomic transaction (all-or-nothing)
- ✅ Backend calculates amount (secure)
- ✅ Automatic status management

## 📊 Data Flow

### Request Example:

```json
{
  "customer": "673a1234567890abcdef1234",
  "items": [
    {
      "product": "673b1234567890abcdef5678",
      "batch": null,
      "quantity": 2,
      "unitPrice": 50000
    },
    {
      "product": "673c1234567890abcdef9012",
      "batch": "673d1234567890abcdef3456",
      "quantity": 1,
      "unitPrice": 120000
    }
  ],
  "deliveryType": "pickup",
  "paymentMethod": "cash",
  "notes": "POS Payment - cash"
}
```

### Response Example:

```json
{
  "success": true,
  "data": {
    "order": {
      "id": "673e1234567890abcdef7890",
      "orderNumber": "ORD-20251128-00042",
      "customer": {
        "id": "673a1234567890abcdef1234",
        "customerCode": "CUST0000000123",
        "fullName": "Nguyen Van A",
        "phone": "0901234567",
        "customerType": "retail"
      },
      "createdBy": {
        "id": "673f1234567890abcdef1234",
        "fullName": "Tran Thi B"
      },
      "orderDate": "2025-11-28T10:30:00.000Z",
      "deliveryType": "pickup",
      "status": "pending",
      "paymentStatus": "paid",
      "shippingFee": 0,
      "discountPercentage": 10,
      "total": 198000,
      "details": [
        {
          "product": {
            "productCode": "PROD001",
            "name": "Product A",
            "image": "/images/prod-a.jpg"
          },
          "batch": {
            "batchCode": "BATCH-20251120-001",
            "expiryDate": "2025-12-31T00:00:00.000Z"
          },
          "quantity": 2,
          "unitPrice": 50000
        },
        {
          "product": {
            "productCode": "PROD002",
            "name": "Fresh Product B"
          },
          "batch": {
            "batchCode": "BATCH-20251125-003",
            "expiryDate": "2025-12-05T00:00:00.000Z"
          },
          "quantity": 1,
          "unitPrice": 120000
        }
      ]
    },
    "payment": {
      "id": "673g1234567890abcdef8901",
      "paymentNumber": "PAY-20251128-00098",
      "referenceType": "Order",
      "referenceId": "673e1234567890abcdef7890",
      "amount": 198000,
      "paymentMethod": "cash",
      "paymentDate": "2025-11-28T10:30:00.000Z",
      "status": "completed",
      "createdBy": {
        "id": "673f1234567890abcdef1234",
        "fullName": "Tran Thi B"
      },
      "notes": "POS Payment - ORD-20251128-00042"
    }
  },
  "message": "Order and payment created successfully"
}
```

## 🛡️ Error Handling

### Validation Errors:

```javascript
// Missing payment method
{
  "success": false,
  "error": {
    "message": "Valid payment method is required (cash/card/bank_transfer)",
    "code": "INVALID_PAYMENT_METHOD"
  }
}

// Insufficient stock
{
  "success": false,
  "error": {
    "message": "Insufficient stock in batch: BATCH-001",
    "code": "INSUFFICIENT_BATCH_STOCK"
  }
}

// Customer not found
{
  "success": false,
  "error": {
    "message": "Customer not found",
    "code": "CUSTOMER_NOT_FOUND"
  }
}
```

### Transaction Errors:

Nếu bất kỳ bước nào trong transaction fail, toàn bộ sẽ được rollback:

```javascript
try {
  // Create Order
  // Create OrderDetails
  // Create Payment
  // Update Order paymentStatus
  
  await session.commitTransaction();
} catch (error) {
  await session.abortTransaction(); // ✅ Rollback everything
  return error response;
}
```

## 🔍 Testing Checklist

### ✅ Happy Path:
- [ ] Create order with regular products (FEFO)
- [ ] Create order with fresh products (manual batch)
- [ ] Create order with mixed products
- [ ] Virtual guest customer
- [ ] Real customer (retail/wholesale/vip)
- [ ] Different payment methods (cash/card/bank_transfer)
- [ ] Customer discount calculation
- [ ] Invoice display

### ⚠️ Error Cases:
- [ ] Empty cart
- [ ] No customer selected
- [ ] Invalid payment method
- [ ] Insufficient stock
- [ ] Batch not found
- [ ] Product not found
- [ ] Transaction rollback on error
- [ ] Token expired/invalid

### 🔄 Edge Cases:
- [ ] Multiple batches for one product (FEFO)
- [ ] Fresh product with promotion
- [ ] VIP customer with high discount
- [ ] Network failure during transaction
- [ ] Database connection lost

## 📝 Migration Notes

### Backward Compatibility:

**Held Orders workflow** vẫn sử dụng 2-step process (legacy):
1. Load held order → Update status → Create payment manually
2. Giữ nguyên `handlePaymentConfirm` cho held orders

**New Orders workflow** sử dụng atomic transaction:
1. `handlePaymentMethodSelect` → Call `createOrderWithPayment` → Show invoice

### Code Changes Summary:

1. **Backend**: New endpoint `/api/pos-login/order-with-payment`
2. **Service**: New method `posLoginService.createOrderWithPayment()`
3. **Frontend**: Updated `handlePaymentMethodSelect` to use atomic endpoint
4. **Legacy**: Kept `handlePaymentConfirm` for held orders support

## 🚀 Performance Metrics

### Expected Improvements:

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| API Calls | 3 | 1 | -66% |
| Total Latency | ~600ms | ~250ms | -58% |
| Error Rate | Higher | Lower | Atomic rollback |
| Code LOC | 150+ | 80 | -47% |

## 🎓 Best Practices

### For Developers:

1. **Always use atomic endpoint for new orders**
2. **Keep legacy `createOrder` for held orders**
3. **Let backend calculate totals** (don't trust frontend)
4. **Handle errors gracefully** with user-friendly messages
5. **Test transaction rollback** scenarios

### For QA:

1. Test all payment methods
2. Test with different customer types
3. Test FEFO allocation with multiple batches
4. Test error scenarios (stock, validation, network)
5. Verify transaction rollback on failures

## 📚 References

- [FINAL_WORKFLOW.md](./FINAL_WORKFLOW.md) - Overall system workflow
- [POS_ORDER_WORKFLOW.md](./POS_ORDER_WORKFLOW.md) - Original POS workflow
- [MODEL_STANDARD.md](./MODEL_STANDARD.md) - Data model standards

---

**Last Updated**: 2025-11-28
**Version**: 2.0.0
**Author**: GitHub Copilot
