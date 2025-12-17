# VNPay QR Integration Guide

**Document Version:** 1.0  
**Last Updated:** December 17, 2025  
**Author:** Development Team

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [Backend Implementation](#backend-implementation)
5. [Frontend Implementation](#frontend-implementation)
6. [Testing Guide](#testing-guide)
7. [Deployment](#deployment)
8. [Troubleshooting](#troubleshooting)

---

## 🎯 Overview

### What is VNPayQR?

VNPayQR is a payment gateway service that allows customers to pay using QR codes through their banking apps. This integration enables the POS system to accept electronic payments without requiring physical card readers.

### Benefits

- ✅ No hardware required (software-only POS)
- ✅ Real-time payment verification
- ✅ Support all major Vietnamese banks
- ✅ Secure payment with VNPay gateway
- ✅ Lower transaction fees than card payments
- ✅ Automatic payment reconciliation

### Payment Flow

```
1. Cashier selects "VNPay QR" payment method
   ↓
2. System generates payment URL
   ↓
3. QR code displayed on screen
   ↓
4. Customer scans QR with banking app
   ↓
5. Customer confirms payment in app
   ↓
6. VNPay sends callback to backend
   ↓
7. System updates order status
   ↓
8. Invoice displayed automatically
```

---

## 🏗️ Architecture

### System Components

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   POS UI    │ ─────→  │   Backend   │ ─────→  │   VNPay     │
│ (Frontend)  │ ←─────  │   (API)     │ ←─────  │  Gateway    │
└─────────────┘         └─────────────┘         └─────────────┘
      │                        │                        │
      │                        │                        │
   QR Code               WebSocket/              Payment
   Display               Polling                 Callback
```

### Data Flow

1. **Create Payment Request**
   - Frontend → Backend: `POST /api/vnpay/create-payment-url`
   - Backend → VNPay: Generate signed payment URL
   - Response: Payment URL for QR generation

2. **Payment Verification**
   - Customer → VNPay: Scan QR & confirm payment
   - VNPay → Backend: `GET /api/vnpay/return` (callback)
   - Backend → Database: Update payment & order status

3. **Status Polling** (Frontend)
   - Frontend → Backend: `GET /api/payments/check-status/:orderId` (every 3s)
   - Backend → Frontend: Return payment status
   - When status = 'completed' → Show invoice

---

## 📦 Prerequisites

### 1. VNPay Account

**Register for VNPay Merchant Account:**
- Website: https://vnpay.vn
- Contact: hotro@vnpay.vn
- Required documents:
  - Business license
  - Bank account information
  - ID card of legal representative

**Receive credentials:**
```
TMN_CODE:      Your merchant code (e.g., "DEMO12345")
HASH_SECRET:   Secret key for signing requests
```

### 2. Node.js Dependencies

```bash
npm install crypto moment qs qrcode.react
```

### 3. Database Schema Updates

```javascript
// models/payment.js - Add VNPay fields
const paymentSchema = new mongoose.Schema({
  // ... existing fields
  
  // VNPay specific fields
  vnpayTransactionNo: String,        // Transaction ID from VNPay
  vnpayResponseCode: String,         // Response code (00 = success)
  vnpayBankCode: String,             // Bank code used
  vnpayCardType: String,             // Card type (ATM/QRCODE)
  vnpayPayDate: Date,                // Payment timestamp
  vnpaySecureHash: String            // Hash for verification
});
```

Run migration:
```bash
npm run migrate:vnpay
```

---

## 🔧 Backend Implementation

### Step 1: Environment Configuration

**File:** `.env`

```bash
# VNPay Configuration
VNPAY_TMN_CODE=YOUR_MERCHANT_CODE
VNPAY_HASH_SECRET=YOUR_HASH_SECRET

# Development (Sandbox)
VNPAY_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
VNPAY_RETURN_URL=http://localhost:3001/api/vnpay/return
VNPAY_IPN_URL=http://localhost:3001/api/vnpay/ipn

# Production
# VNPAY_URL=https://vnpayment.vn/paymentv2/vpcpay.html
# VNPAY_RETURN_URL=https://yourdomain.com/api/vnpay/return
# VNPAY_IPN_URL=https://yourdomain.com/api/vnpay/ipn

# Mock Mode (Development)
VNPAY_MOCK_MODE=true
```

### Step 2: VNPay Service

**File:** `services/vnpayService.js`

```javascript
const crypto = require('crypto');
const querystring = require('qs');
const moment = require('moment');

class VNPayService {
  constructor() {
    this.tmnCode = process.env.VNPAY_TMN_CODE;
    this.hashSecret = process.env.VNPAY_HASH_SECRET;
    this.vnpUrl = process.env.VNPAY_URL;
    this.returnUrl = process.env.VNPAY_RETURN_URL;
    this.mockMode = process.env.VNPAY_MOCK_MODE === 'true';
  }

  /**
   * Create VNPay payment URL
   * @param {string} orderId - Order ID or order number
   * @param {number} amount - Amount in VND
   * @param {string} orderInfo - Order description
   * @param {string} ipAddr - Customer IP address
   * @returns {string} Payment URL
   */
  createPaymentUrl(orderId, amount, orderInfo, ipAddr) {
    // Mock mode for development
    if (this.mockMode) {
      return `MOCK_PAYMENT_URL?order=${orderId}&amount=${amount}&ts=${Date.now()}`;
    }

    const date = new Date();
    const createDate = moment(date).format('YYYYMMDDHHmmss');
    const expireDate = moment(date).add(15, 'minutes').format('YYYYMMDDHHmmss');

    let vnpParams = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: this.tmnCode,
      vnp_Locale: 'vn',
      vnp_CurrCode: 'VND',
      vnp_TxnRef: orderId,
      vnp_OrderInfo: orderInfo,
      vnp_OrderType: 'other',
      vnp_Amount: amount * 100, // VNPay requires amount in cents (VND * 100)
      vnp_ReturnUrl: this.returnUrl,
      vnp_IpAddr: ipAddr,
      vnp_CreateDate: createDate,
      vnp_ExpireDate: expireDate
    };

    // Sort parameters alphabetically
    vnpParams = this.sortObject(vnpParams);

    // Create secure hash
    const signData = querystring.stringify(vnpParams, { encode: false });
    const hmac = crypto.createHmac('sha512', this.hashSecret);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');
    vnpParams['vnp_SecureHash'] = signed;

    // Create payment URL
    const paymentUrl = this.vnpUrl + '?' + querystring.stringify(vnpParams, { encode: false });

    return paymentUrl;
  }

  /**
   * Verify return URL from VNPay
   * @param {Object} vnpParams - Query parameters from VNPay
   * @returns {boolean} True if signature is valid
   */
  verifyReturnUrl(vnpParams) {
    const secureHash = vnpParams['vnp_SecureHash'];
    
    // Remove hash params before verification
    delete vnpParams['vnp_SecureHash'];
    delete vnpParams['vnp_SecureHashType'];

    // Sort parameters
    vnpParams = this.sortObject(vnpParams);

    // Create signature
    const signData = querystring.stringify(vnpParams, { encode: false });
    const hmac = crypto.createHmac('sha512', this.hashSecret);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    return secureHash === signed;
  }

  /**
   * Sort object keys alphabetically
   * @param {Object} obj - Object to sort
   * @returns {Object} Sorted object
   */
  sortObject(obj) {
    const sorted = {};
    const keys = Object.keys(obj).sort();
    keys.forEach(key => {
      sorted[key] = obj[key];
    });
    return sorted;
  }

  /**
   * Get response message from response code
   * @param {string} code - VNPay response code
   * @returns {string} Message
   */
  getResponseMessage(code) {
    const messages = {
      '00': 'Giao dịch thành công',
      '07': 'Trừ tiền thành công. Giao dịch bị nghi ngờ (liên quan tới lừa đảo, giao dịch bất thường).',
      '09': 'Giao dịch không thành công do: Thẻ/Tài khoản của khách hàng chưa đăng ký dịch vụ InternetBanking tại ngân hàng.',
      '10': 'Giao dịch không thành công do: Khách hàng xác thực thông tin thẻ/tài khoản không đúng quá 3 lần',
      '11': 'Giao dịch không thành công do: Đã hết hạn chờ thanh toán. Xin quý khách vui lòng thực hiện lại giao dịch.',
      '12': 'Giao dịch không thành công do: Thẻ/Tài khoản của khách hàng bị khóa.',
      '13': 'Giao dịch không thành công do Quý khách nhập sai mật khẩu xác thực giao dịch (OTP). Xin quý khách vui lòng thực hiện lại giao dịch.',
      '24': 'Giao dịch không thành công do: Khách hàng hủy giao dịch',
      '51': 'Giao dịch không thành công do: Tài khoản của quý khách không đủ số dư để thực hiện giao dịch.',
      '65': 'Giao dịch không thành công do: Tài khoản của Quý khách đã vượt quá hạn mức giao dịch trong ngày.',
      '75': 'Ngân hàng thanh toán đang bảo trì.',
      '79': 'Giao dịch không thành công do: KH nhập sai mật khẩu thanh toán quá số lần quy định. Xin quý khách vui lòng thực hiện lại giao dịch',
      '99': 'Các lỗi khác (lỗi còn lại, không có trong danh sách mã lỗi đã liệt kê)'
    };

    return messages[code] || 'Unknown error';
  }
}

module.exports = new VNPayService();
```

### Step 3: VNPay Controller

**File:** `controllers/vnpay.js`

```javascript
const vnpayRouter = require('express').Router();
const vnpayService = require('../services/vnpayService');
const Payment = require('../models/payment');
const Order = require('../models/order');
const logger = require('../utils/logger');

/**
 * Create VNPay payment URL
 * POST /api/vnpay/create-payment-url
 */
vnpayRouter.post('/create-payment-url', async (req, res) => {
  try {
    const { orderId, amount, orderInfo } = req.body;

    // Validation
    if (!orderId || !amount) {
      return res.status(400).json({
        success: false,
        error: { message: 'Missing required fields: orderId, amount' }
      });
    }

    // Get client IP
    const ipAddr = req.headers['x-forwarded-for'] ||
                   req.connection.remoteAddress ||
                   req.socket.remoteAddress ||
                   req.connection.socket.remoteAddress;

    // Create payment URL
    const paymentUrl = vnpayService.createPaymentUrl(
      orderId,
      amount,
      orderInfo || `Payment for order ${orderId}`,
      ipAddr
    );

    logger.info('VNPay payment URL created', { orderId, amount });

    res.json({
      success: true,
      data: {
        paymentUrl,
        qrData: paymentUrl // Use this to generate QR code
      }
    });
  } catch (error) {
    logger.error('VNPay create payment URL error:', error);
    res.status(500).json({
      success: false,
      error: { message: error.message }
    });
  }
});

/**
 * VNPay return URL (after payment)
 * GET /api/vnpay/return
 */
vnpayRouter.get('/return', async (req, res) => {
  try {
    const vnpParams = req.query;

    logger.info('VNPay return callback', vnpParams);

    // Verify signature
    const isValid = vnpayService.verifyReturnUrl({ ...vnpParams });
    if (!isValid) {
      logger.error('VNPay signature verification failed');
      return res.redirect('/pos?payment=failed&reason=invalid_signature');
    }

    const orderId = vnpParams['vnp_TxnRef'];
    const responseCode = vnpParams['vnp_ResponseCode'];
    const transactionNo = vnpParams['vnp_TransactionNo'];
    const bankCode = vnpParams['vnp_BankCode'];
    const cardType = vnpParams['vnp_CardType'];
    const payDate = vnpParams['vnp_PayDate'];

    if (responseCode === '00') {
      // Payment successful
      logger.info('VNPay payment successful', { orderId, transactionNo });

      // Update payment record
      const payment = await Payment.findOneAndUpdate(
        { order: orderId },
        {
          status: 'completed',
          transactionId: transactionNo,
          vnpayTransactionNo: transactionNo,
          vnpayResponseCode: responseCode,
          vnpayBankCode: bankCode,
          vnpayCardType: cardType,
          vnpayPayDate: payDate ? moment(payDate, 'YYYYMMDDHHmmss').toDate() : new Date()
        },
        { new: true }
      );

      // Update order status
      const order = await Order.findByIdAndUpdate(
        orderId,
        {
          paymentStatus: 'paid',
          status: 'delivered'
        },
        { new: true }
      );

      logger.info('Order and payment updated', { orderId, paymentId: payment._id });

      // Redirect to POS with success
      res.redirect(`/pos?payment=success&order=${orderId}`);
    } else {
      // Payment failed
      const errorMessage = vnpayService.getResponseMessage(responseCode);
      logger.error('VNPay payment failed', { orderId, responseCode, errorMessage });

      // Update payment status to failed
      await Payment.findOneAndUpdate(
        { order: orderId },
        {
          status: 'failed',
          vnpayResponseCode: responseCode,
          failureReason: errorMessage
        }
      );

      res.redirect(`/pos?payment=failed&code=${responseCode}&message=${encodeURIComponent(errorMessage)}`);
    }
  } catch (error) {
    logger.error('VNPay return error:', error);
    res.redirect('/pos?payment=error');
  }
});

/**
 * VNPay IPN (Instant Payment Notification)
 * POST /api/vnpay/ipn
 */
vnpayRouter.post('/ipn', async (req, res) => {
  try {
    const vnpParams = req.query;

    logger.info('VNPay IPN received', vnpParams);

    // Verify signature
    const isValid = vnpayService.verifyReturnUrl({ ...vnpParams });
    if (!isValid) {
      logger.error('VNPay IPN signature verification failed');
      return res.json({ RspCode: '97', Message: 'Invalid signature' });
    }

    const orderId = vnpParams['vnp_TxnRef'];
    const responseCode = vnpParams['vnp_ResponseCode'];
    const transactionNo = vnpParams['vnp_TransactionNo'];

    // Check if order exists
    const order = await Order.findById(orderId);
    if (!order) {
      logger.error('Order not found', { orderId });
      return res.json({ RspCode: '01', Message: 'Order not found' });
    }

    // Check if payment already processed
    const payment = await Payment.findOne({ order: orderId });
    if (payment && payment.status === 'completed') {
      logger.warn('Payment already processed', { orderId });
      return res.json({ RspCode: '02', Message: 'Order already confirmed' });
    }

    if (responseCode === '00') {
      // Update payment & order
      await Payment.findOneAndUpdate(
        { order: orderId },
        {
          status: 'completed',
          transactionId: transactionNo,
          vnpayTransactionNo: transactionNo,
          vnpayResponseCode: responseCode
        }
      );

      await Order.findByIdAndUpdate(orderId, {
        paymentStatus: 'paid',
        status: 'delivered'
      });

      logger.info('IPN: Payment confirmed', { orderId, transactionNo });
      res.json({ RspCode: '00', Message: 'Success' });
    } else {
      logger.error('IPN: Payment failed', { orderId, responseCode });
      res.json({ RspCode: responseCode, Message: 'Payment failed' });
    }
  } catch (error) {
    logger.error('VNPay IPN error:', error);
    res.json({ RspCode: '99', Message: 'Unknown error' });
  }
});

/**
 * Check payment status (for polling)
 * GET /api/payments/check-status/:orderId
 */
vnpayRouter.get('/check-status/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;

    const payment = await Payment.findOne({ order: orderId });
    if (!payment) {
      return res.status(404).json({
        success: false,
        error: { message: 'Payment not found' }
      });
    }

    res.json({
      success: true,
      data: {
        status: payment.status,
        transactionId: payment.vnpayTransactionNo,
        responseCode: payment.vnpayResponseCode
      }
    });
  } catch (error) {
    logger.error('Check payment status error:', error);
    res.status(500).json({
      success: false,
      error: { message: error.message }
    });
  }
});

module.exports = vnpayRouter;
```

### Step 4: Register Routes

**File:** `app.js`

```javascript
const vnpayRouter = require('./controllers/vnpay');

// ... other routes

app.use('/api/vnpay', vnpayRouter);
```

---

## 💻 Frontend Implementation

### Step 1: Install QR Code Library

```bash
cd admin
npm install qrcode.react
```

### Step 2: Create VNPay Payment Component

**File:** `admin/src/components/POSMain/VNPayPaymentModal.jsx`

```javascript
import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode.react';

export const VNPayPaymentModal = ({ 
  isOpen, 
  orderId, 
  amount, 
  orderInfo,
  onPaymentSuccess, 
  onPaymentFailed,
  onClose 
}) => {
  const [qrData, setQrData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(900); // 15 minutes

  useEffect(() => {
    if (isOpen) {
      createPaymentQR();
    } else {
      // Cleanup
      setQrData(null);
      setPolling(false);
      setTimeRemaining(900);
    }
  }, [isOpen]);

  // Create VNPay QR code
  const createPaymentQR = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/vnpay/create-payment-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          amount,
          orderInfo: orderInfo || `Payment for order ${orderId}`
        })
      });

      const result = await response.json();
      if (result.success) {
        setQrData(result.data.paymentUrl);
        startPaymentPolling();
        startCountdown();
      } else {
        throw new Error(result.error?.message || 'Failed to create payment QR');
      }
    } catch (error) {
      console.error('VNPay QR creation error:', error);
      alert('Failed to generate payment QR code');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  // Poll payment status every 3 seconds
  const startPaymentPolling = () => {
    setPolling(true);
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/vnpay/check-status/${orderId}`);
        const result = await response.json();

        if (result.success && result.data.status === 'completed') {
          clearInterval(interval);
          setPolling(false);
          onPaymentSuccess({
            orderId,
            transactionNo: result.data.transactionId
          });
        }
      } catch (error) {
        console.error('Payment status check error:', error);
      }
    }, 3000);

    // Stop polling after 15 minutes
    setTimeout(() => {
      clearInterval(interval);
      setPolling(false);
      if (onPaymentFailed) {
        onPaymentFailed({ reason: 'timeout' });
      }
    }, 15 * 60 * 1000);

    return () => clearInterval(interval);
  };

  // Countdown timer
  const startCountdown = () => {
    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 0) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-md w-full">
        <h2 className="text-2xl font-bold mb-4">VNPay Payment</h2>

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-4 text-gray-600">Generating QR code...</p>
          </div>
        ) : qrData ? (
          <div className="text-center">
            {/* QR Code */}
            <div className="bg-white p-4 rounded-lg inline-block border-2 border-gray-200">
              <QRCode 
                value={qrData} 
                size={256}
                level="H"
                includeMargin={true}
              />
            </div>

            {/* Instructions */}
            <div className="mt-6 space-y-3">
              <h3 className="font-semibold text-lg">Scan to Pay</h3>
              <p className="text-gray-600">
                Open your banking app and scan this QR code
              </p>

              {/* Amount */}
              <div className="bg-blue-50 p-3 rounded">
                <p className="text-sm text-gray-600">Amount</p>
                <p className="text-2xl font-bold text-blue-600">
                  {amount.toLocaleString('vi-VN')} ₫
                </p>
              </div>

              {/* Status */}
              {polling && (
                <div className="flex items-center justify-center text-yellow-600">
                  <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Waiting for payment...</span>
                </div>
              )}

              {/* Timer */}
              <p className="text-sm text-gray-500">
                Time remaining: {formatTime(timeRemaining)}
              </p>
            </div>
          </div>
        ) : null}

        {/* Cancel button */}
        <button
          onClick={onClose}
          className="mt-6 w-full px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};
```

### Step 3: Update POSPaymentModal

**File:** `admin/src/components/POSMain/POSPaymentModal.jsx`

```javascript
import { VNPayPaymentModal } from './VNPayPaymentModal';

export const POSPaymentModal = ({ isOpen, totals, onClose, onPaymentMethodSelect, existingOrder }) => {
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [showVNPayModal, setShowVNPayModal] = useState(false);

  const handleVNPaySelect = () => {
    setShowVNPayModal(true);
  };

  const handleVNPaySuccess = ({ orderId, transactionNo }) => {
    console.log('VNPay payment successful:', { orderId, transactionNo });
    setShowVNPayModal(false);
    onPaymentMethodSelect('vnpay_qr');
  };

  const handleVNPayFailed = ({ reason }) => {
    console.error('VNPay payment failed:', reason);
    setShowVNPayModal(false);
    alert('Payment failed or timed out. Please try again.');
  };

  return (
    <>
      <div className="payment-modal">
        {/* Cash button */}
        <button onClick={() => onPaymentMethodSelect('cash')}>
          Cash
        </button>

        {/* VNPay QR button */}
        <button onClick={handleVNPaySelect}>
          <svg>...</svg>
          VNPay QR
        </button>
      </div>

      {/* VNPay QR Modal */}
      <VNPayPaymentModal
        isOpen={showVNPayModal}
        orderId={existingOrder?.id || 'NEW'}
        amount={totals.total}
        orderInfo={`POS Order ${existingOrder?.orderNumber || 'New'}`}
        onPaymentSuccess={handleVNPaySuccess}
        onPaymentFailed={handleVNPayFailed}
        onClose={() => setShowVNPayModal(false)}
      />
    </>
  );
};
```

### Step 4: Mock Simulator (Development Only)

**File:** `admin/src/components/POSMain/VNPaySimulator.jsx`

```javascript
import React from 'react';

export const VNPaySimulator = ({ qrData, onSimulateSuccess, onSimulateFailure }) => {
  if (!qrData || !qrData.startsWith('MOCK_')) return null;

  // Extract order ID from mock URL
  const params = new URLSearchParams(qrData.split('?')[1]);
  const orderId = params.get('order');
  const amount = params.get('amount');

  const handleSuccess = () => {
    onSimulateSuccess({
      orderId,
      transactionNo: `MOCK_TXN_${Date.now()}`,
      responseCode: '00'
    });
  };

  const handleFailure = (code) => {
    onSimulateFailure({
      orderId,
      responseCode: code,
      reason: 'Simulated failure'
    });
  };

  return (
    <div className="fixed bottom-4 right-4 bg-yellow-100 border-2 border-yellow-500 rounded-lg p-4 shadow-lg z-50">
      <h3 className="font-bold text-yellow-800 mb-2">🧪 VNPay Simulator</h3>
      <p className="text-sm text-gray-700 mb-3">Development Mode</p>
      
      <div className="space-y-2">
        <button
          onClick={handleSuccess}
          className="w-full px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600"
        >
          ✓ Simulate Success
        </button>
        
        <button
          onClick={() => handleFailure('24')}
          className="w-full px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600"
        >
          ✗ Simulate Cancel
        </button>

        <button
          onClick={() => handleFailure('51')}
          className="w-full px-3 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
        >
          ⚠ Insufficient Balance
        </button>
      </div>

      <p className="text-xs text-gray-600 mt-3">
        Order: {orderId}<br/>
        Amount: {parseInt(amount).toLocaleString()} ₫
      </p>
    </div>
  );
};
```

---

## 🧪 Testing Guide

### Development Testing (Mock Mode)

**Step 1: Enable Mock Mode**

```bash
# .env
VNPAY_MOCK_MODE=true
```

**Step 2: Test Flow**

1. Add products to cart
2. Select "VNPay QR" payment
3. QR code displays with `MOCK_PAYMENT_URL`
4. Use VNPaySimulator to simulate success/failure
5. Verify order status updates

### Sandbox Testing

**Step 1: Get Sandbox Credentials**

Contact VNPay support for sandbox credentials:
- Email: hotro@vnpay.vn
- Provide: Business name, contact info

**Step 2: Configure Sandbox**

```bash
# .env
VNPAY_MOCK_MODE=false
VNPAY_TMN_CODE=DEMO12345
VNPAY_HASH_SECRET=SANDBOXSECRET
VNPAY_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
```

**Step 3: Test with Test Cards**

```
Card Number:  9704198526191432198
Card Holder:  NGUYEN VAN A
Expiry Date:  07/15
CVV:          123
OTP:          123456
```

**Step 4: Test Scenarios**

| Scenario | Steps | Expected Result |
|----------|-------|-----------------|
| Success | Scan QR → Enter OTP → Confirm | Payment successful, order delivered |
| Cancel | Scan QR → Cancel | Payment failed, order remains draft |
| Timeout | Scan QR → Wait 15 min | Payment expired, show timeout |
| Insufficient | Use test card with low balance | Payment failed with error code |

### Production Testing

**Step 1: Small Amount Test**

```javascript
// Test with 1,000 VND first
const testAmount = 1000;
```

**Step 2: Monitor Logs**

```bash
# Watch logs in real-time
tail -f logs/vnpay.log
```

**Step 3: Verify Webhooks**

```bash
# Check IPN endpoint
curl -X POST http://yourdomain.com/api/vnpay/ipn
```

---

## 🚀 Deployment

### Step 1: Environment Setup

**Production `.env`:**

```bash
VNPAY_MOCK_MODE=false
VNPAY_TMN_CODE=YOUR_PROD_TMN_CODE
VNPAY_HASH_SECRET=YOUR_PROD_SECRET
VNPAY_URL=https://vnpayment.vn/paymentv2/vpcpay.html
VNPAY_RETURN_URL=https://yourdomain.com/api/vnpay/return
VNPAY_IPN_URL=https://yourdomain.com/api/vnpay/ipn
```

### Step 2: VNPay Portal Configuration

Login to VNPay Merchant Portal:
1. Navigate to **Settings** → **Webhook URLs**
2. Set Return URL: `https://yourdomain.com/api/vnpay/return`
3. Set IPN URL: `https://yourdomain.com/api/vnpay/ipn`
4. Save configuration

### Step 3: SSL Certificate

VNPay requires HTTPS for production:

```bash
# Install SSL with Let's Encrypt
sudo certbot --nginx -d yourdomain.com
```

### Step 4: Deploy Application

```bash
# Build frontend
cd admin
npm run build

# Start backend
cd ..
npm start
```

### Step 5: Test Production

1. Create small test order (1,000 VND)
2. Generate QR code
3. Scan with real banking app
4. Complete payment
5. Verify order status updates

---

## 🔍 Troubleshooting

### Issue 1: Invalid Signature Error

**Symptom:** VNPay returns "Invalid signature"

**Causes:**
- Wrong hash secret
- Parameter sorting issue
- URL encoding problem

**Solution:**
```javascript
// Check hash secret matches VNPay portal
console.log('Hash Secret:', process.env.VNPAY_HASH_SECRET);

// Verify parameter sorting
console.log('Sorted params:', vnpayService.sortObject(params));

// Use querystring with encode: false
const signData = querystring.stringify(vnpParams, { encode: false });
```

### Issue 2: Payment Not Updating

**Symptom:** Payment successful in VNPay but order still pending

**Causes:**
- IPN callback not received
- Database connection issue
- Order ID mismatch

**Solution:**
```javascript
// Check IPN endpoint is accessible
curl -X POST https://yourdomain.com/api/vnpay/ipn

// Check order ID format
console.log('Order ID sent:', orderId);
console.log('Order ID received:', vnpParams.vnp_TxnRef);

// Enable IPN logging
logger.info('IPN received', { vnpParams });
```

### Issue 3: QR Code Not Scanning

**Symptom:** Banking app can't scan QR code

**Causes:**
- QR code too small
- Low quality rendering
- Wrong URL format

**Solution:**
```javascript
// Increase QR code size
<QRCode value={qrData} size={300} level="H" />

// Use high error correction
level="H"

// Verify URL format
console.log('Payment URL:', paymentUrl);
```

### Issue 4: Timeout Issues

**Symptom:** Payment successful but frontend times out

**Causes:**
- Polling interval too long
- Network latency
- Backend processing slow

**Solution:**
```javascript
// Reduce polling interval
const interval = setInterval(checkStatus, 2000); // 2s instead of 3s

// Increase timeout
setTimeout(() => clearInterval(interval), 20 * 60 * 1000); // 20min

// Add retry logic
let retryCount = 0;
const checkStatus = async () => {
  try {
    const response = await fetch(`/api/vnpay/check-status/${orderId}`);
    retryCount = 0; // Reset on success
  } catch (error) {
    retryCount++;
    if (retryCount > 3) {
      console.error('Max retries reached');
      clearInterval(interval);
    }
  }
};
```

### Issue 5: Multiple Payment Attempts

**Symptom:** Customer scans QR multiple times, creates duplicate payments

**Causes:**
- No idempotency check
- Payment already processed

**Solution:**
```javascript
// Check if payment exists before creating
const existingPayment = await Payment.findOne({ 
  order: orderId,
  status: { $in: ['completed', 'pending'] }
});

if (existingPayment) {
  return res.json({
    success: false,
    error: { message: 'Payment already in progress' }
  });
}
```

---

## 📊 Monitoring & Analytics

### Key Metrics to Track

1. **Payment Success Rate**
   ```javascript
   const successRate = (successfulPayments / totalPayments) * 100;
   ```

2. **Average Payment Time**
   ```javascript
   const avgTime = totalTime / completedPayments;
   ```

3. **Timeout Rate**
   ```javascript
   const timeoutRate = (timedOutPayments / totalPayments) * 100;
   ```

### Logging Best Practices

```javascript
// Log payment creation
logger.info('VNPay payment created', {
  orderId,
  amount,
  timestamp: new Date()
});

// Log payment status changes
logger.info('Payment status changed', {
  orderId,
  oldStatus: 'pending',
  newStatus: 'completed',
  transactionNo
});

// Log errors with context
logger.error('VNPay payment error', {
  orderId,
  error: error.message,
  stack: error.stack
});
```

---

## 📚 Additional Resources

### Official Documentation
- VNPay API Docs: https://sandbox.vnpayment.vn/apis/docs
- Integration Guide: https://vnpay.vn/huong-dan-tich-hop

### Support Contacts
- Email: hotro@vnpay.vn
- Phone: 1900 5555 77
- Website: https://vnpay.vn

### Code Repositories
- Backend: `/services/vnpayService.js`
- Frontend: `/admin/src/components/POSMain/VNPayPaymentModal.jsx`
- Testing: `/test/vnpay.test.js`

---

## ✅ Implementation Checklist

### Backend
- [ ] Install dependencies (crypto, moment, qs)
- [ ] Create `.env` configuration
- [ ] Implement VNPayService
- [ ] Create VNPay controller
- [ ] Add routes to app.js
- [ ] Update Payment model schema
- [ ] Test with mock mode

### Frontend
- [ ] Install qrcode.react
- [ ] Create VNPayPaymentModal component
- [ ] Update POSPaymentModal
- [ ] Implement payment polling
- [ ] Add timeout handling
- [ ] Create mock simulator (dev)

### Testing
- [ ] Test mock mode flow
- [ ] Test with sandbox credentials
- [ ] Test all error scenarios
- [ ] Verify callback handling
- [ ] Load test (100+ concurrent users)

### Deployment
- [ ] Configure production environment
- [ ] Set up VNPay portal webhooks
- [ ] Install SSL certificate
- [ ] Deploy to production
- [ ] Test with real payments (small amounts)
- [ ] Monitor logs for 24 hours

### Documentation
- [ ] Update API documentation
- [ ] Create user guide for cashiers
- [ ] Document troubleshooting steps
- [ ] Record demo video

---

**Last Updated:** December 17, 2025  
**Next Review:** January 17, 2026
