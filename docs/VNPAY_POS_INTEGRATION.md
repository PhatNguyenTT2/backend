# Hướng Dẫn Tích Hợp VNPay Vào POS Frontend

## 📋 Tổng Quan

Tài liệu này hướng dẫn chi tiết cách tích hợp VNPay sandbox vào POS frontend để xử lý thanh toán bank_transfer.

### Hiện Trạng

**Backend (✅ Đã hoàn thành):**
- ✅ VNPay controller: `/api/vnpay/create-payment-url`, `/return`, `/ipn`, `/check-status`
- ✅ VNPay service: createPaymentUrl, verifyReturnUrl, verifyIpnCall
- ✅ VNPay model: lưu trữ transaction
- ✅ Test suite: 12 tests pass
- ✅ Config: Sandbox mode (`VNP_URL=https://sandbox.vnpayment.vn`, `VNP_TEST_MODE=true`)

**Frontend (❌ Cần implement):**
- ❌ Redirect đến VNPay sandbox khi chọn bank_transfer
- ❌ Return URL handler để nhận kết quả
- ❌ Polling/WebSocket để cập nhật trạng thái thanh toán real-time

---

## 🔄 Flow Thanh Toán POS (Unified Flow)

### ✨ Kiến Trúc Mới: 2-Step Flow Cho TẤT CẢ Payment Methods

**Triết lý:** Tất cả payment methods (cash/card/vnpay) đều sử dụng chung 1 flow nhất quán:
1. **Tạo draft order trước** (via `POST /order`)
2. **Xử lý payment sau** (via `POST /payment` hoặc VNPay redirect)

**Lợi ích:**
- ✅ Code đơn giản hơn (không có if/else branches)
- ✅ Logic nhất quán giữa các payment methods
- ✅ Dễ maintain và extend
- ✅ VNPay integration tự nhiên (không cần special case)

---

### 🎯 Core Endpoints

#### **1. POST `/api/pos-login/order`** (Tạo Draft Order)
**Mục đích:** Tạo order draft - chưa có payment

**Input:**
```json
{
  "customer": "virtual-guest" | ObjectId,
  "items": [{ "product", "batch?", "quantity", "unitPrice" }],
  "deliveryType": "pickup"
}
```

**Output:**
```json
{
  "success": true,
  "data": {
    "order": {
      "_id": "...",
      "orderNumber": "ORD...",
      "status": "draft",
      "paymentStatus": "pending",
      "total": 25000
    }
  }
}
```

---

#### **2. POST `/api/pos-login/payment`** (Tạo Payment)
**Mục đích:** Tạo payment cho order đã tồn tại

**Input:**
```json
{
  "orderId": "...",
  "paymentMethod": "cash" | "card" | "bank_transfer",
  "notes": "POS Payment - ORD..."
}
```

**Output:**
```json
{
  "success": true,
  "data": {
    "payment": {
      "paymentNumber": "PAY...",
      "status": "completed",
      "amount": 25000
    },
    "order": { /* order info */ }
  }
}
```

---

### 💰 Unified Payment Flow

#### **Flow 1: Cash/Card Payment**
```
User click "Checkout"
    ↓
handleCheckout() → Check existingOrder?
    ↓
NO → POST /api/pos-login/order
    → Tạo draft order
    → setExistingOrder(draftOrder)
    ↓
YES → Skip (already have draft order)
    ↓
Show Payment Modal
    ↓
User chọn Cash/Card
    ↓
handlePaymentMethodSelect()
    ↓
POST /api/pos-login/payment
    → Create payment (status: completed)
    ↓
PUT /api/orders/:orderId
    → Update: draft → delivered, pending → paid
    ↓
Show invoice + Clear cart
```

---

#### **Flow 2: VNPay Payment**
```
User click "Checkout"
    ↓
handleCheckout() → Check existingOrder?
    ↓
NO → POST /api/pos-login/order
    → Tạo draft order
    → setExistingOrder(draftOrder)
    ↓
YES → Skip (already have draft order)
    ↓
Show Payment Modal
    ↓
User chọn Bank Transfer
    ↓
handlePaymentMethodSelect('bank_transfer')
    ↓
POST /api/vnpay/create-payment-url
    → Input: orderId, amount
    → Return: paymentUrl, vnp_TxnRef
    ↓
Redirect: window.location.href = paymentUrl
    ↓
VNPay Sandbox → User nhập thẻ test
    ↓
VNPay redirect: /pos?payment=success&ref=xxx
    ↓
VNPayReturnHandler → Poll GET /api/vnpay/check-status/:ref
    ↓
Status = success (IPN confirmed)
    ↓
POST /api/pos-login/payment
    → Create payment (status: completed)
    ↓
PUT /api/orders/:orderId
    → Update: draft → delivered, pending → paid
    ↓
Show invoice + Clear cart
```

---

### 🔍 Key Differences: New Order vs Held Order

| Aspect | New Order | Held Order |
|--------|-----------|------------|
| **Draft Order** | Created in `handleCheckout()` | Already exists (loaded from held orders) |
| **Flag** | `existingOrder.wasHeldOrder = false` | `existingOrder.wasHeldOrder = true` |
| **Payment Flow** | Same (POST /payment) | Same (POST /payment) |
| **Cancel Behavior** | Keep as held order | Keep as is |
| **Error Handling** | Optional: delete draft | Keep draft (can retry) |

**⭐ Điểm quan trọng:** Payment flow HOÀN TOÀN GIỐNG NHAU sau khi có draft order!

---

## 🛠️ Implementation Plan

### Step 1: Thêm API Service cho VNPay

**File: `admin/src/services/vnpayService.js`** (NEW FILE)

```javascript
import api from './api';

const vnpayService = {
  /**
   * Tạo payment URL để redirect đến VNPay
   * @param {string} orderId - MongoDB Order ID
   * @param {number} amount - Số tiền (VND)
   * @param {string} orderInfo - Mô tả đơn hàng
   * @returns {Promise<{paymentUrl: string, vnp_TxnRef: string}>}
   */
  createPaymentUrl: async (orderId, amount, orderInfo) => {
    const response = await api.post('/vnpay/create-payment-url', {
      orderId,
      amount,
      orderInfo: orderInfo || `Thanh toán đơn hàng ${orderId}`
    });
    return response.data.data;
  },

  /**
   * Kiểm tra trạng thái thanh toán
   * @param {string} vnpTxnRef - VNPay transaction reference
   * @returns {Promise<{status: string, vnp_ResponseCode: string, orderId: string}>}
   */
  checkPaymentStatus: async (vnpTxnRef) => {
    const response = await api.get(`/vnpay/check-status/${vnpTxnRef}`);
    return response.data.data;
  }
};

export default vnpayService;
```

---

### Step 2: Thêm Component VNPayReturnHandler

**File: `admin/src/components/VNPayReturnHandler.jsx`** (NEW FILE)

```javascript
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import vnpayService from '../services/vnpayService';
import orderService from '../services/orderService';
import paymentService from '../services/paymentService';

export const VNPayReturnHandler = ({ onPaymentComplete, onPaymentFailed }) => {
  const [searchParams] = useSearchParams();
  const [processing, setProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Đang xử lý thanh toán...');

  useEffect(() => {
    const handleVNPayReturn = async () => {
      const paymentStatus = searchParams.get('payment');
      const vnpTxnRef = searchParams.get('ref');
      const errorCode = searchParams.get('code');
      const errorMessage = searchParams.get('message');

      if (!paymentStatus) return; // Not a VNPay return

      setProcessing(true);

      try {
        if (paymentStatus === 'success' && vnpTxnRef) {
          // Payment success - poll for confirmation
          setStatusMessage('Thanh toán thành công! Đang xác nhận...');

          // Poll payment status (max 30 seconds)
          let attempts = 0;
          const maxAttempts = 15; // 15 attempts x 2s = 30s

          const pollStatus = async () => {
            if (attempts >= maxAttempts) {
              throw new Error('Timeout: Không thể xác nhận thanh toán');
            }

            attempts++;
            const status = await vnpayService.checkPaymentStatus(vnpTxnRef);

            if (status.status === 'success' && status.vnp_ResponseCode === '00') {
              // Payment confirmed by IPN
              const orderId = status.orderId._id || status.orderId;

              // Create payment record
              const paymentData = {
                order: orderId,
                amount: status.orderId.total,
                method: 'bank_transfer',
                status: 'completed',
                vnpayTransaction: vnpTxnRef
              };

              await paymentService.createPayment(paymentData);

              // Update order status
              await orderService.updateOrder(orderId, {
                status: 'delivered',
                paymentStatus: 'completed'
              });

              // Fetch complete order
              const completeOrder = await orderService.getOrderById(orderId);

              setStatusMessage('Thanh toán hoàn tất!');
              if (onPaymentComplete) {
                onPaymentComplete(completeOrder);
              }
            } else if (status.status === 'pending') {
              // Still pending, retry after 2s
              setTimeout(pollStatus, 2000);
            } else {
              throw new Error(`Thanh toán thất bại: ${status.message}`);
            }
          };

          await pollStatus();
        } else {
          // Payment failed
          const message = errorMessage 
            ? decodeURIComponent(errorMessage)
            : 'Thanh toán thất bại';

          setStatusMessage(message);
          if (onPaymentFailed) {
            onPaymentFailed({ code: errorCode, message });
          }
        }
      } catch (error) {
        console.error('VNPay return handler error:', error);
        setStatusMessage(error.message || 'Có lỗi xảy ra');
        if (onPaymentFailed) {
          onPaymentFailed({ message: error.message });
        }
      } finally {
        setProcessing(false);

        // Clear URL params after 3 seconds
        setTimeout(() => {
          window.history.replaceState({}, '', '/pos');
        }, 3000);
      }
    };

    handleVNPayReturn();
  }, [searchParams, onPaymentComplete, onPaymentFailed]);

  if (!processing && !searchParams.get('payment')) {
    return null; // Don't render if not processing VNPay return
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[10000]">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4">
        <div className="flex flex-col items-center">
          {processing ? (
            <>
              <svg className="animate-spin h-16 w-16 text-blue-600 mb-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Đang xử lý thanh toán</h3>
              <p className="text-gray-600 text-center">{statusMessage}</p>
            </>
          ) : (
            <>
              {searchParams.get('payment') === 'success' ? (
                <svg className="w-16 h-16 text-green-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-16 h-16 text-red-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                {searchParams.get('payment') === 'success' ? 'Hoàn tất!' : 'Thất bại'}
              </h3>
              <p className="text-gray-600 text-center">{statusMessage}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
```

---

### Step 3: Cập Nhật POSMain.jsx

**File: `admin/src/pages/pos/POSMain.jsx`**

#### 3.1: Import VNPayReturnHandler

```javascript
import { VNPayReturnHandler } from '../../components/VNPayReturnHandler';
import vnpayService from '../../services/vnpayService';
```

#### 3.2: Thêm State cho VNPay Processing

```javascript
// VNPay state
const [vnpayProcessing, setVnpayProcessing] = useState(false);
const [pendingVNPayOrder, setPendingVNPayOrder] = useState(null);
```

#### 3.3: Cập Nhật handleCheckout (Tạo Draft Order Trước)

**⭐ KEY CHANGE:** Draft order được tạo TRƯỚC KHI mở payment modal

```javascript
// ⭐ UNIFIED FLOW: Create draft order BEFORE showing payment modal
const handleCheckout = async () => {
  // Step 1: Validate
  if (!cart || cart.length === 0) {
    showToast('error', 'Cart is empty!');
    return;
  }

  if (!selectedCustomer) {
    showToast('error', 'Please select a customer!');
    return;
  }

  // Step 2: Check if order already exists (held order)
  if (existingOrder) {
    console.log('✅ Using existing held order:', existingOrder.orderNumber);
    setShowPaymentModal(true);
    return;
  }

  // Step 3: Create draft order for NEW order
  console.log('📝 Creating draft order...');

  try {
    setLoading(true);

    const orderData = {
      customer: selectedCustomer.id === 'virtual-guest' ? 'virtual-guest' : selectedCustomer.id,
      items: cart.map(item => ({
        product: item.productId || item.id,
        batch: item.batch?.id || null,
        quantity: item.quantity,
        unitPrice: item.price
      })),
      deliveryType: 'pickup'
    };

    const posToken = localStorage.getItem('posToken');
    const response = await fetch('/api/pos-login/order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${posToken}`
      },
      body: JSON.stringify(orderData)
    });

    const result = await response.json();
    if (!result.success) throw new Error(result.error?.message);

    const draftOrder = result.data.order;
    console.log('✅ Draft order created:', draftOrder.orderNumber);

    // ⭐ Mark as new draft (not held order)
    draftOrder.wasHeldOrder = false;
    setExistingOrder(draftOrder);

    // Now show payment modal
    setShowPaymentModal(true);

  } catch (error) {
    console.error('❌ Failed to create draft order:', error);
    showToast('error', error.message);
  } finally {
    setLoading(false);
  }
};
```

#### 3.4: Cập Nhật handlePaymentMethodSelect (Unified Handler)

**⭐ SIMPLIFIED:** Không còn if/else cho new vs held order

```javascript
// ⭐ UNIFIED PAYMENT HANDLER - All scenarios have existingOrder
const handlePaymentMethodSelect = async (paymentMethod) => {
  // At this point, existingOrder ALWAYS exists
  if (!existingOrder) {
    showToast('error', 'Order not found!');
    return;
  }

  const orderId = existingOrder._id || existingOrder.id;

  try {
    setShowPaymentModal(false);

    if (paymentMethod === 'bank_transfer') {
      // VNPay flow
      await handleVNPayPayment(orderId);
      return;
    }

    // Cash/Card flow
    await handleCashCardPayment(orderId, paymentMethod);

  } catch (error) {
    console.error('❌ Payment error:', error);
    showToast('error', error.message);
    setShowPaymentModal(true); // Re-open for retry
  }
};

// ========== VNPAY HANDLER (UNIFIED) ==========
const handleVNPayPayment = async (orderId) => {
  try {
    setVnpayProcessing(true);

    console.log('🏦 Creating VNPay payment URL for order:', existingOrder.orderNumber);

    // Create VNPay payment URL
    const { paymentUrl, vnp_TxnRef } = await vnpayService.createPaymentUrl(
      orderId,
      existingOrder.total,
      `Thanh toán ${existingOrder.orderNumber}`
    );

    console.log('✅ VNPay URL created:', vnp_TxnRef);
    showToast('success', 'Chuyển đến VNPay...');

    // Redirect to VNPay
    setTimeout(() => {
      window.location.href = paymentUrl;
    }, 1500);

  } catch (error) {
    console.error('❌ VNPay error:', error);
    setVnpayProcessing(false);
    throw error;
  }
};

// ========== CASH/CARD HANDLER (UNIFIED) ==========
const handleCashCardPayment = async (orderId, paymentMethod) => {
  try {
    console.log(`💳 Processing ${paymentMethod} payment for order:`, existingOrder.orderNumber);

    // Step 1: Create payment
    const paymentResponse = await posLoginService.createPaymentForOrder(
      orderId,
      paymentMethod,
      `POS Payment - ${existingOrder.orderNumber}`
    );

    if (!paymentResponse.success) {
      throw new Error(paymentResponse.error?.message || 'Failed to create payment');
    }

    console.log('✅ Payment created:', paymentResponse.data.payment.paymentNumber);

    // Step 2: Update order status
    const updateResponse = await orderService.updateOrder(orderId, {
      status: 'delivered',
      paymentStatus: 'paid'
    });

    if (!updateResponse.success) {
      console.warn('⚠️ Order update failed, but payment was created');
    }

    // Step 3: Fetch full order
    const fullOrderResponse = await orderService.getOrderById(orderId);
    if (!fullOrderResponse.success) {
      throw new Error('Failed to fetch order');
    }

    const fullOrder = fullOrderResponse.data.order;
    fullOrder.paymentMethod = paymentMethod;

    // Step 4: Show invoice
    setInvoiceOrder(fullOrder);
    setShowInvoiceModal(true);

    // Step 5: Clear cart
    setCart([]);
    setSelectedCustomer(null);
    setExistingOrder(null);

    showToast('success', `Payment completed! Order: ${existingOrder.orderNumber}`);

  } catch (error) {
    console.error('❌ Cash/Card error:', error);
    throw error;
  }
};

// ⭐ Handle VNPay payment complete
const handleVNPayComplete = async (order) => {
  setVnpayProcessing(false);
  
  try {
    const orderId = order._id || order.id;

    // Step 1: Create payment
    console.log('💳 Creating payment...');
    const paymentResponse = await posLoginService.createPaymentForOrder(
      orderId,
      'bank_transfer',
      `POS Payment - ${order.orderNumber}`
    );

    if (!paymentResponse.success) {
      throw new Error(paymentResponse.error?.message);
    }

    console.log('✅ Payment created');

    // Step 2: Update order
    console.log('🔄 Updating order...');
    await orderService.updateOrder(orderId, {
      status: 'delivered',
      paymentStatus: 'paid'
    });

    console.log('✅ Order updated');

    // Step 3: Fetch full order
    const fullOrderResponse = await orderService.getOrderById(orderId);
    const completeOrder = fullOrderResponse.data.order;
    completeOrder.paymentMethod = 'bank_transfer';

    // Step 4: Show invoice
    setInvoiceOrder(completeOrder);
    setShowInvoiceModal(true);

    // Step 5: Clear
    setCart([]);
    setSelectedCustomer(null);
    setExistingOrder(null);

    showToast('success', 'Thanh toán VNPay thành công!');

  } catch (error) {
    console.error('❌ VNPay complete error:', error);
    showToast('error', 'Không thể hoàn tất thanh toán');
  }
};

// ⭐ Handle VNPay payment failed
const handleVNPayFailed = async (error) => {
  setVnpayProcessing(false);
  
  // Delete draft order if NEW order (not held)
  if (existingOrder && !existingOrder.wasHeldOrder) {
    console.log('❌ Deleting new draft order...');
    try {
      await orderService.deleteOrder(existingOrder._id);
      console.log('✅ Draft order deleted');
      setExistingOrder(null);
    } catch (deleteError) {
      console.error('Failed to delete draft:', deleteError);
    }
  } else {
    console.log('ℹ️ Keeping held order (can retry payment)');
  }

  showToast('error', error.message || 'Thanh toán VNPay thất bại');
};
```

#### 3.4: Thêm VNPayReturnHandler vào JSX

```javascript
return (
  <div className="h-screen flex flex-col bg-gray-100">
    {/* ... existing components ... */}

    {/* ⭐ NEW: VNPay Return Handler */}
    <VNPayReturnHandler
      onPaymentComplete={handleVNPayComplete}
      onPaymentFailed={handleVNPayFailed}
    />

    {/* ... rest of JSX ... */}
  </div>
);
```

---

## 🧪 Testing Guide

### Bước 1: Chuẩn Bị

1. Đảm bảo backend đang chạy: `npm run dev`
2. Đảm bảo frontend đang chạy: `cd admin && npm run dev`
3. Mở file `docs/vnpaydemo/test.md` để xem thông tin thẻ test

### Bước 2: Test Flow Thanh Toán VNPay

#### Test Case 1A: New Order + VNPay Thành Công ✅

**Scenario:** Giỏ hàng mới (Unified Flow)

1. Thêm sản phẩm vào giỏ hàng
2. Click **Checkout**
   - ⚙️ `handleCheckout()` tạo draft order qua `POST /order`
   - ⚙️ `setExistingOrder(draftOrder)` với flag `wasHeldOrder = false`
   - 🎯 Payment modal mở (draft order đã tồn tại)
3. Chọn **Bank Transfer**
   - ⚙️ `handlePaymentMethodSelect('bank_transfer')`
   - ⚙️ `handleVNPayPayment(orderId)` tạo VNPay URL
4. 🌐 Redirect đến VNPay Sandbox
5. Nhập thông tin thẻ **TEST 1** (thành công):
   ```
   Ngân hàng: NCB
   Số thẻ: 9704198526191432198
   Tên chủ thẻ: NGUYEN VAN A
   Ngày phát hành: 07/15
   Mật khẩu OTP: 123456
   ```
8. Click **Thanh toán**
9. 🌐 VNPay redirect về `/pos?payment=success&ref=ORDER_xxx`
10. ⚙️ Frontend: Poll `/api/vnpay/check-status/:ref`
11. ⚙️ Backend IPN confirmed → status = success
12. ⚙️ Frontend: Tạo payment qua `/api/pos-login/payment`
13. ⚙️ Frontend: Update order qua `/api/orders/:id`
14. ✅ Hiển thị invoice

**Kiểm tra:**
- ✅ Order: status = `delivered`, paymentStatus = `paid`
- ✅ Payment: method = `bank_transfer`, status = `completed`
- ✅ VNPay record: status = `success`, vnp_ResponseCode = `00`
- ✅ Cart: đã clear

---

#### Test Case 1B: Held Order + VNPay Thành Công ✅

**Scenario:** Order đã hold trước đó (Unified Flow)

1. Click **Load Held Orders**
2. Chọn 1 held order (status = draft)
   - ⚙️ `handleLoadHeldOrder(order)` load order vào cart
   - ⚙️ `setExistingOrder(order)` với flag `wasHeldOrder = true`
3. Click **Checkout**
   - ⚙️ `handleCheckout()` phát hiện `existingOrder` đã tồn tại
   - 🎯 Skip tạo order mới, mở payment modal ngay
4. Chọn **Bank Transfer**
   - ⚙️ `handleVNPayPayment(orderId)` - GIỐNG TEST 1A
5. 🌐 Redirect đến VNPay Sandbox
6. Nhập thông tin thẻ **TEST 1**
9. Click **Thanh toán**
10. 🌐 VNPay redirect về `/pos?payment=success&ref=ORDER_xxx`
11. ⚙️ Frontend: Poll status → success
12. ⚙️ Frontend: Tạo payment + Update order
13. ✅ Hiển thị invoice

**Kiểm tra:**
- ✅ Held order đã được update: delivered + paid
- ✅ Payment created với vnpay reference
- ✅ Order không còn trong held orders list

---

#### Test Case 2: VNPay Thất Bại (Không Đủ Số Dư) ❌

1. Thêm sản phẩm vào giỏ hàng
2. Click **Checkout**
3. Chọn **Bank Transfer**
4. Tại VNPay, nhập thẻ **TEST 2** (không đủ số dư):
   ```
   Ngân hàng: NCB
   Số thẻ: 9704195798459170488
   Tên chủ thẻ: NGUYEN VAN A
   Ngày phát hành: 07/15
   ```
5. Click **Thanh toán**
6. 🌐 VNPay redirect về `/pos?payment=failed&code=51`
7. ⚠️ POS hiển thị: "Tài khoản không đủ số dư"

**Kiểm tra:**
- ❌ Order: bị xóa (soft delete) nếu là new order
- ❌ Order: vẫn draft nếu là held order (có thể retry)
- ❌ Payment: không tạo
- ❌ VNPay record: status = `failed`
- ℹ️ Cart: vẫn còn (có thể thử lại)

---

#### Test Case 3: User Hủy Thanh Toán ❌

1. Thêm sản phẩm vào giỏ hàng
2. Click **Checkout**
3. Chọn **Bank Transfer**
4. Tại VNPay, click **Hủy giao dịch**
5. 🌐 VNPay redirect về `/pos?payment=failed&code=24`
6. ⚠️ POS hiển thị: "Khách hàng hủy giao dịch"

**Kiểm tra:**
- ❌ Giống Test Case 2 (order deleted/unchanged, no payment)

---

#### Test Case 4: Cash/Card + New Order ✅

**Mục đích:** Verify Unified Flow với Cash/Card

1. Thêm sản phẩm vào giỏ hàng
2. Click **Checkout**
   - ⚙️ Draft order tạo qua `POST /order`
3. Chọn **Cash Payment** hoặc **Card Payment**
   - ⚙️ `handleCashCardPayment()` tạo payment
   - ⚙️ Update order: draft → delivered
4. ✅ Invoice hiển thị

**Kiểm tra:**
- ✅ Draft order tạo trước (draft status)
- ✅ Payment created sau (completed)
- ✅ Order updated: delivered + paid
- ✅ Flow giống VNPay (nhưng không redirect)

---

#### Test Case 5: Cash/Card + Held Order ✅

**Mục đích:** Verify held order flow

1. Load held order
   - ⚙️ Order đã tồn tại với `wasHeldOrder = true`
2. Click **Checkout**
   - ⚙️ Skip tạo order mới
3. Chọn **Cash Payment**
   - ⚙️ `handleCashCardPayment()` - GIỐNG TEST 4
4. ✅ Invoice hiển thị

**Kiểm tra:**
- ✅ Payment flow HOÀN TOÀN GIỐNG new order
- ✅ Không có logic đặc biệt cho held order

---

## 🔍 Debug & Troubleshooting

### Issue 1: Không redirect đến VNPay

**Nguyên nhân:**
- API `/api/vnpay/create-payment-url` trả về lỗi
- CORS policy block

**Giải pháp:**
```javascript
// Check console logs
console.log('Payment URL:', paymentUrl);
console.log('VNP TxnRef:', vnp_TxnRef);

// Check backend logs
// Tìm: "VNPay payment URL created"
```

### Issue 2: Return URL không được xử lý

**Nguyên nhân:**
- `APP_URL` trong `.env` không đúng
- Return URL format sai

**Giải pháp:**
```bash
# Backend .env
APP_URL=http://localhost:3001

# Return URL sẽ là:
# http://localhost:3001/api/vnpay/return
```

### Issue 3: IPN không được gọi (trong sandbox)

**Lưu ý:**
- VNPay Sandbox **KHÔNG gọi IPN** trong môi trường development
- IPN chỉ hoạt động khi deploy lên server có SSL (https)
- Trong dev, dùng polling `/check-status` thay thế

### Issue 4: Payment status không update

**Nguyên nhân:**
- Poll timeout (>30s)
- IPN chưa được gọi

**Giải pháp:**
```javascript
// Tăng timeout
const maxAttempts = 30; // 30 x 2s = 60s

// Hoặc manual check
GET /api/vnpay/check-status/:vnpTxnRef
```

---

## 📝 Checklist Hoàn Thành

### Backend
- [x] VNPay controller implemented (4 endpoints)
- [x] VNPay service implemented
- [x] VNPay model created
- [x] Environment variables configured (sandbox mode)
- [x] Tests written and passing (12/12)
- [x] **Unified Flow endpoints:**
  - [x] `POST /api/pos-login/order` - Create draft order (TẤT CẢ payment methods)
  - [x] `POST /api/pos-login/payment` - Create payment for existing order
  - [x] ~~`/order-with-payment`~~ - **REMOVED** (replaced by 2-step flow)

### Frontend
- [ ] **Step 1:** `vnpayService.js` created
  - [ ] createPaymentUrl function
  - [ ] checkPaymentStatus function
- [ ] **Step 2:** `VNPayReturnHandler.jsx` created
  - [ ] Parse URL params (payment, ref, code)
  - [ ] Poll check-status endpoint
  - [ ] Create payment via `/pos-login/payment`
  - [ ] Update order status
  - [ ] Show success/error UI
- [x] **Step 3:** `POSMain.jsx` updated (Unified Flow)
  - [x] Add `handleCheckout()` - tạo draft order TRƯỚC payment modal
  - [x] Update `handlePaymentMethodSelect()` - unified handler
  - [x] Add `handleVNPayPayment()` - VNPay flow
  - [x] Add `handleCashCardPayment()` - Cash/Card flow
  - [x] Add `handleVNPayComplete()` - create payment + update order
  - [x] Add `handleVNPayFailed()` - delete draft if new order
  - [x] Add `handlePaymentModalClose()` - handle cancel
  - [x] Render VNPayReturnHandler component
  - [x] Update `onCheckout` prop: `() => setShowPaymentModal(true)` → `handleCheckout`

### Testing - New Order Scenarios
- [ ] **Test 1A:** New Order + VNPay Success ✅
  - [ ] Order created (draft)
  - [ ] VNPay redirect works
  - [ ] Payment created after return
  - [ ] Order updated (delivered)
  - [ ] Invoice displayed
- [ ] **Test 2:** New Order + VNPay Failed (balance) ❌
  - [ ] Order created (draft)
  - [ ] VNPay failed redirect
  - [ ] Order deleted
  - [ ] Cart preserved
- [ ] **Test 3:** New Order + User Cancel ❌
  - [ ] Order deleted
  - [ ] Error message shown

### Testing - Held Order Scenarios
- [ ] **Test 1B:** Held Order + VNPay Success ✅
  - [ ] Load held order
  - [ ] VNPay redirect works
  - [ ] Payment created
  - [ ] Order updated (delivered)
  - [ ] Removed from held orders list
- [ ] **Test 2B:** Held Order + VNPay Failed ❌
  - [ ] Order unchanged (still draft)
  - [ ] Can retry payment

### Testing - Baseline (Cash/Card)
- [ ] **Test 4:** New Order + Cash/Card ✅
  - [ ] Atomic transaction works
  - [ ] Order + Payment created instantly
- [ ] **Test 5:** Held Order + Cash/Card ✅
  - [ ] Payment created for held order
  - [ ] Order updated

### Database Verification
- [ ] Order collection: status transitions logged
- [ ] Payment collection: vnpay payments recorded
- [ ] VNPay collection: transactions tracked
- [ ] Inventory: stock reduced correctly

---

## 🚀 Production Deployment

Khi deploy production:

1. **Update `.env`:**
   ```bash
   VNP_URL=https://pay.vnpay.vn
   VNP_TEST_MODE=false
   APP_URL=https://yourdomain.com
   ```

2. **Đảm bảo HTTPS:**
   - IPN chỉ hoạt động với SSL
   - Return URL phải là HTTPS

3. **Đăng ký tài khoản VNPay thật:**
   - Đăng ký tại: https://vnpay.vn
   - Lấy TMN Code và Hash Secret thật
   - Update vào `.env`

4. **Test với thẻ thật:**
   - Không dùng thẻ test từ `test.md`
   - Dùng thẻ ngân hàng thật

---

## 📚 Tài Liệu Tham Khảo

- VNPay API Documentation: https://sandbox.vnpayment.vn/apis/docs
- VNPay Sandbox Registration: https://sandbox.vnpayment.vn/devreg
- VNPay Demo: https://github.com/lehuygiang28/vnpay
- Test Card Info: `docs/vnpaydemo/test.md`

---

## ✅ Summary

**What We're Building:**
- VNPay integration cho payment method "Bank Transfer"
- Redirect user đến VNPay Sandbox để nhập thẻ test
- Return handler để xử lý kết quả thanh toán
- Polling để check payment status
- Update order + tạo payment record sau khi success

**Key Points:**
- ✅ Backend đã sẵn sàng
- ✅ Sandbox mode enabled
- ✅ Test cards available
- 🔄 Frontend cần implement theo guide này

Sau khi complete checklist, POS sẽ hỗ trợ đầy đủ 3 payment methods:
1. Cash (instant)
2. Card (instant)
3. Bank Transfer (VNPay redirect + confirm)
