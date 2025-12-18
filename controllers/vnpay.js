const vnpayRouter = require('express').Router();
const vnpayService = require('../services/vnpayService');
const VNPayModel = require('../models/vnpay');
const Order = require('../models/order');
const logger = require('../utils/logger');
const crypto = require('crypto');
const querystring = require('qs');

/**
 * Utility function to sort object keys
 */
function sortObject(obj) {
  const sorted = {};
  const keys = Object.keys(obj).sort();
  keys.forEach(key => {
    sorted[key] = obj[key];
  });
  return sorted;
}

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
      '127.0.0.1';

    // Create payment URL
    const result = await vnpayService.createPaymentUrl(
      orderId,
      amount,
      orderInfo || `Thanh toán đơn hàng ${orderId}`,
      ipAddr
    );

    logger.info('VNPay payment URL created', {
      orderId,
      amount,
      vnp_TxnRef: result.vnp_TxnRef
    });

    res.json({
      success: true,
      data: {
        paymentUrl: result.paymentUrl,
        qrData: result.paymentUrl, // Use this to generate QR code
        vnp_TxnRef: result.vnp_TxnRef
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
 * Chỉ verify và hiển thị kết quả cho user, KHÔNG update database
 */
vnpayRouter.get('/return', async (req, res) => {
  try {
    let vnpParams = req.query;
    const secureHash = vnpParams['vnp_SecureHash'];

    // Remove hash params before verification
    delete vnpParams['vnp_SecureHash'];
    delete vnpParams['vnp_SecureHashType'];

    // Sort parameters
    vnpParams = sortObject(vnpParams);

    logger.info('VNPay return callback', vnpParams);

    // Manual signature verification like VNPay template
    const secretKey = process.env.VNP_HASHSECRET;
    const signData = querystring.stringify(vnpParams, { encode: false });
    const hmac = crypto.createHmac('sha512', secretKey);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    if (secureHash === signed) {
      const vnp_ResponseCode = vnpParams['vnp_ResponseCode'];
      const vnp_TxnRef = vnpParams['vnp_TxnRef'];

      // Mark return URL as accessed (không update payment status)
      await VNPayModel.findOneAndUpdate(
        { vnp_TxnRef },
        { returnUrlAccessed: true }
      ).catch(err => logger.error('Mark return URL error:', err));

      if (vnp_ResponseCode === '00') {
        // Payment successful - chỉ hiển thị thông báo
        logger.info('VNPay payment successful (return URL)', {
          vnp_TxnRef,
          vnp_ResponseCode
        });
        res.redirect(`/pos?payment=success&ref=${vnp_TxnRef}`);
      } else {
        // Payment failed
        const errorMessage = vnpayService.getResponseMessage(vnp_ResponseCode);
        logger.warn('VNPay payment failed', {
          vnp_TxnRef,
          vnp_ResponseCode,
          errorMessage
        });
        res.redirect(`/pos?payment=failed&code=${vnp_ResponseCode}&message=${encodeURIComponent(errorMessage)}`);
      }
    } else {
      // Invalid signature
      logger.error('VNPay return URL: Invalid signature');
      res.redirect('/pos?payment=failed&reason=invalid_signature');
    }
  } catch (error) {
    logger.error('VNPay return error:', error);
    res.redirect('/pos?payment=error');
  }
});

/**
 * VNPay IPN (Instant Payment Notification)
 * This is the official callback where we UPDATE the database
 * GET /api/vnpay/ipn (VNPay uses GET for IPN)
 */
vnpayRouter.get('/ipn', async (req, res) => {
  try {
    let vnpParams = req.query;
    const secureHash = vnpParams['vnp_SecureHash'];

    // Remove hash params before verification
    delete vnpParams['vnp_SecureHash'];
    delete vnpParams['vnp_SecureHashType'];

    // Sort parameters
    vnpParams = sortObject(vnpParams);

    logger.info('VNPay IPN callback', vnpParams);

    // Manual signature verification like VNPay template
    const secretKey = process.env.VNP_HASHSECRET;
    const signData = querystring.stringify(vnpParams, { encode: false });
    const hmac = crypto.createHmac('sha512', secretKey);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    if (secureHash === signed) {
      const vnp_TxnRef = vnpParams['vnp_TxnRef'];
      const vnp_ResponseCode = vnpParams['vnp_ResponseCode'];

      // Kiểm tra dữ liệu có hợp lệ không
      const vnpayRecord = await VNPayModel.findOne({ vnp_TxnRef });
      if (!vnpayRecord) {
        logger.error('VNPay transaction not found', { vnp_TxnRef });
        return res.status(200).json({
          RspCode: '01',
          Message: 'Order not found'
        });
      }

      // Check if already processed
      if (vnpayRecord.ipnVerified) {
        logger.warn('IPN already processed', { vnp_TxnRef });
        return res.status(200).json({
          RspCode: '02',
          Message: 'Order already confirmed'
        });
      }

      // Cập nhật trạng thái đơn hàng và gửi kết quả cho VNPAY
      await vnpayService.updatePaymentStatus(vnp_TxnRef, {
        ...vnpParams,
        vnp_SecureHash: secureHash,
        vnp_ResponseCode
      });

      // Mark IPN as verified
      await VNPayModel.findOneAndUpdate(
        { vnp_TxnRef },
        { ipnVerified: true }
      );

      logger.info('IPN: Payment processed successfully', {
        vnp_TxnRef,
        vnp_ResponseCode,
        orderId: vnpayRecord.orderId
      });

      // Response theo đúng định dạng VNPay yêu cầu
      res.status(200).json({
        RspCode: '00',
        Message: 'success'
      });
    } else {
      // Checksum failed
      logger.error('VNPay IPN: Fail checksum');
      res.status(200).json({
        RspCode: '97',
        Message: 'Fail checksum'
      });
    }
  } catch (error) {
    logger.error('VNPay IPN error:', error);
    res.status(200).json({
      RspCode: '99',
      Message: 'Unknown error'
    });
  }
});

/**
 * Check payment status (for polling)
 * GET /api/vnpay/check-status/:vnpTxnRef
 */
vnpayRouter.get('/check-status/:vnpTxnRef', async (req, res) => {
  try {
    const { vnpTxnRef } = req.params;

    const vnpayRecord = await VNPayModel.findOne({
      vnp_TxnRef: vnpTxnRef
    }).populate('orderId');

    if (!vnpayRecord) {
      return res.status(404).json({
        success: false,
        error: { message: 'Payment not found' }
      });
    }

    res.json({
      success: true,
      data: {
        status: vnpayRecord.status,
        vnp_ResponseCode: vnpayRecord.vnp_ResponseCode,
        vnp_TransactionNo: vnpayRecord.vnp_TransactionNo,
        orderId: vnpayRecord.orderId,
        message: vnpayService.getResponseMessage(vnpayRecord.vnp_ResponseCode || '')
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
