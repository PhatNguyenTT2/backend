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

## 🔄 Flow Thanh Toán VNPay

### Flow Hiện Tại (Cash/Card)
```
User chọn payment method
    ↓
Call handlePaymentMethodSelect(method)
    ↓
Tạo order (status: delivered) + payment (status: completed)
    ↓
Hiển thị invoice
```

### Flow Mới (Bank Transfer với VNPay)
```
User chọn bank_transfer
    ↓
Tạo order tạm (status: pending) - KHÔNG tạo payment
    ↓
Call POST /api/vnpay/create-payment-url
    ↓
Nhận paymentUrl + vnp_TxnRef
    ↓
Redirect đến VNPay Sandbox (window.location.href = paymentUrl)
    ↓
User nhập thông tin thẻ test (từ test.md)
    ↓
VNPay redirect về return URL (/pos?payment=success&ref=xxx)
    ↓
Frontend check URL params
    ↓
Poll GET /api/vnpay/check-status/:vnpTxnRef (mỗi 2s)
    ↓
Nếu status = success → Tạo payment record
    ↓
Update order status: pending → delivered
    ↓
Hiển thị invoice
```

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

#### 3.3: Cập Nhật handlePaymentMethodSelect

```javascript
// Handle payment - UPDATED FOR VNPAY
const handlePaymentMethodSelect = async (paymentMethod) => {
  try {
    // Close payment modal immediately
    setShowPaymentModal(false);

    // ⭐ NEW: Handle bank_transfer with VNPay
    if (paymentMethod === 'bank_transfer') {
      await handleVNPayPayment();
      return;
    }

    // Original logic for cash/card...
    // (giữ nguyên logic cũ cho cash và card)
  } catch (error) {
    console.error('Payment error:', error);
    showToast('error', error.message || 'Payment failed');
  }
};

// ⭐ NEW: Handle VNPay payment flow
const handleVNPayPayment = async () => {
  try {
    setVnpayProcessing(true);

    // Step 1: Create pending order (WITHOUT payment)
    const orderData = {
      customer: selectedCustomer?.id === 'virtual-guest' 
        ? undefined 
        : selectedCustomer?.id,
      createdBy: currentEmployee._id,
      items: cart.map(item => ({
        product: item.productId,
        quantity: item.quantity,
        unitPrice: item.price,
        subtotal: item.price * item.quantity,
        batch: item.batch?.id
      })),
      subtotal: totals.subtotal,
      discount: totals.discount,
      total: totals.total,
      status: 'pending', // ⭐ PENDING until payment confirmed
      paymentStatus: 'pending',
      paymentMethod: 'bank_transfer',
      notes: `VNPay payment - Customer: ${selectedCustomer?.fullName || 'Guest'}`
    };

    const createdOrder = await orderService.createOrder(orderData);
    setPendingVNPayOrder(createdOrder);

    // Step 2: Create VNPay payment URL
    const { paymentUrl, vnp_TxnRef } = await vnpayService.createPaymentUrl(
      createdOrder._id,
      totals.total,
      `Thanh toán đơn hàng ${createdOrder.orderNumber}`
    );

    showToast('success', `Đang chuyển đến VNPay... (Ref: ${vnp_TxnRef})`);

    // Step 3: Redirect to VNPay sandbox
    setTimeout(() => {
      window.location.href = paymentUrl;
    }, 1500);

  } catch (error) {
    console.error('VNPay payment error:', error);
    setVnpayProcessing(false);
    showToast('error', error.message || 'Không thể tạo thanh toán VNPay');
  }
};

// ⭐ NEW: Handle VNPay payment complete
const handleVNPayComplete = (order) => {
  setVnpayProcessing(false);
  setPendingVNPayOrder(null);
  
  // Clear cart
  clearCart();
  setSelectedCustomer(null);
  setExistingOrder(null);

  // Show invoice
  setInvoiceOrder(order);
  setShowInvoiceModal(true);

  showToast('success', 'Thanh toán VNPay thành công!');
};

// ⭐ NEW: Handle VNPay payment failed
const handleVNPayFailed = (error) => {
  setVnpayProcessing(false);
  
  // Delete pending order if payment failed
  if (pendingVNPayOrder) {
    orderService.deleteOrder(pendingVNPayOrder._id, { hardDelete: false })
      .catch(err => console.error('Failed to delete pending order:', err));
    setPendingVNPayOrder(null);
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

#### Test Case 1: Thanh Toán Thành Công ✅

1. Thêm sản phẩm vào giỏ hàng
2. Click **Checkout**
3. Chọn **Bank Transfer** (icon ngân hàng màu tím)
4. Đợi redirect đến VNPay Sandbox
5. Tại trang VNPay, nhập thông tin thẻ **TEST 1** (thành công):
   ```
   Ngân hàng: NCB
   Số thẻ: 9704198526191432198
   Tên chủ thẻ: NGUYEN VAN A
   Ngày phát hành: 07/15
   Mật khẩu OTP: 123456
   ```
6. Click **Thanh toán**
7. VNPay redirect về `/pos?payment=success&ref=ORDER_xxx`
8. POS hiển thị "Đang xử lý thanh toán..."
9. Sau vài giây, hiển thị invoice
10. ✅ Kiểm tra:
    - Order status = `delivered`
    - Payment status = `completed`
    - Payment method = `bank_transfer`
    - VNPay record có trong database

#### Test Case 2: Thanh Toán Thất Bại (Không Đủ Số Dư) ❌

1. Thêm sản phẩm vào giỏ hàng
2. Click **Checkout**
3. Chọn **Bank Transfer**
4. Tại VNPay, nhập thông tin thẻ **TEST 2** (không đủ số dư):
   ```
   Ngân hàng: NCB
   Số thẻ: 9704195798459170488
   Tên chủ thẻ: NGUYEN VAN A
   Ngày phát hành: 07/15
   ```
5. Click **Thanh toán**
6. VNPay redirect về `/pos?payment=failed&code=51`
7. POS hiển thị lỗi "Tài khoản không đủ số dư"
8. ✅ Kiểm tra:
    - Order bị xóa (soft delete)
    - Không có payment record
    - Cart vẫn còn (có thể thử lại)

#### Test Case 3: User Hủy Thanh Toán ❌

1. Thêm sản phẩm vào giỏ hàng
2. Click **Checkout**
3. Chọn **Bank Transfer**
4. Tại VNPay, click **Hủy giao dịch**
5. VNPay redirect về `/pos?payment=failed&code=24`
6. POS hiển thị "Khách hàng hủy giao dịch"

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
- [x] VNPay controller implemented
- [x] VNPay service implemented
- [x] VNPay model created
- [x] Environment variables configured
- [x] Tests written and passing

### Frontend
- [ ] `vnpayService.js` created
- [ ] `VNPayReturnHandler.jsx` created
- [ ] `POSMain.jsx` updated with VNPay logic
- [ ] Bank Transfer button triggers VNPay flow
- [ ] Return URL handler processes payment result
- [ ] Polling implemented for status check
- [ ] Error handling for failed payments
- [ ] Toast notifications for all states

### Testing
- [ ] Test Case 1: Successful payment ✅
- [ ] Test Case 2: Failed payment (insufficient balance) ❌
- [ ] Test Case 3: User cancelled payment ❌
- [ ] Manual check: Order status updated correctly
- [ ] Manual check: Payment record created
- [ ] Manual check: VNPay record in database

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
