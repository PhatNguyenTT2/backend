const vnpay = require('../config/vnpay');
const VNPayModel = require('../models/vnpay');
const Order = require('../models/order');
const logger = require('../utils/logger');

class VNPayService {
  /**
   * Create VNPay payment URL
   * @param {string} orderId - MongoDB Order ID
   * @param {number} amount - Amount in VND
   * @param {string} orderInfo - Order description
   * @param {string} ipAddr - Customer IP address
   * @returns {Object} Payment URL and transaction reference
   */
  async createPaymentUrl(orderId, amount, orderInfo, ipAddr) {
    try {
      // Generate unique transaction reference
      const vnp_TxnRef = `ORDER_${Date.now()}`;

      // Build payment URL using vnpay library
      // NOTE: vnpay library AUTOMATICALLY multiplies amount by 100 internally
      // So we pass the original VND amount here
      const paymentUrl = vnpay.buildPaymentUrl({
        vnp_Amount: amount, // Library will multiply by 100 internally
        vnp_TxnRef: vnp_TxnRef,
        vnp_OrderInfo: orderInfo || `Thanh toán đơn hàng ${orderId}`,
        vnp_OrderType: 'billpayment',
        vnp_IpAddr: ipAddr || '127.0.0.1',
        vnp_ReturnUrl: `${(process.env.APP_URL || '').replace(/\/$/, '')}/api/vnpay/return`,
        vnp_Locale: 'vn',
        vnp_CurrCode: 'VND',
      });

      // Save to database
      const vnpayRecord = new VNPayModel({
        orderId: orderId,
        vnp_TxnRef: vnp_TxnRef,
        vnp_Amount: amount,
        vnp_OrderInfo: orderInfo,
        vnp_IpAddr: ipAddr,
        vnp_Locale: 'vn',
        paymentUrl: paymentUrl,
        status: 'pending'
      });

      await vnpayRecord.save();

      logger.info('VNPay payment URL created', {
        orderId,
        vnp_TxnRef,
        amount
      });

      return {
        paymentUrl,
        vnp_TxnRef
      };
    } catch (error) {
      logger.error('Create VNPay payment URL error:', error);
      throw error;
    }
  }

  /**
   * Verify return URL from VNPay
   * @param {Object} query - Query parameters from VNPay
   * @returns {Object} Verification result
   */
  verifyReturnUrl(query) {
    try {
      const verification = vnpay.verifyReturnUrl(query);

      return {
        isValid: verification.isSuccess,
        isVerified: verification.isVerified,
        vnp_ResponseCode: verification.vnp_ResponseCode,
        vnp_TxnRef: verification.vnp_TxnRef,
        message: verification.message
      };
    } catch (error) {
      logger.error('Verify return URL error:', error);
      return {
        isValid: false,
        message: error.message
      };
    }
  }

  /**
   * Verify IPN call from VNPay
   * @param {Object} query - Query parameters from VNPay IPN
   * @returns {Object} Verification result
   */
  verifyIpnCall(query) {
    try {
      const verification = vnpay.verifyIpnCall(query);

      return {
        isValid: verification.isSuccess,
        isVerified: verification.isVerified,
        vnp_ResponseCode: verification.vnp_ResponseCode,
        vnp_TxnRef: verification.vnp_TxnRef,
        vnp_Amount: verification.vnp_Amount,
        vnp_TransactionNo: verification.vnp_TransactionNo,
        vnp_BankCode: verification.vnp_BankCode,
        vnp_PayDate: verification.vnp_PayDate,
        message: verification.message
      };
    } catch (error) {
      logger.error('Verify IPN call error:', error);
      return {
        isValid: false,
        message: error.message
      };
    }
  }

  /**
   * Update payment status after verification
   * @param {string} vnp_TxnRef - Transaction reference
   * @param {Object} vnpParams - VNPay parameters
   * @returns {Object} Updated record
   */
  async updatePaymentStatus(vnp_TxnRef, vnpParams) {
    try {
      const vnpayRecord = await VNPayModel.findOne({ vnp_TxnRef });

      if (!vnpayRecord) {
        throw new Error('VNPay transaction not found');
      }

      // Update VNPay record
      vnpayRecord.vnp_ResponseCode = vnpParams.vnp_ResponseCode;
      vnpayRecord.vnp_TransactionNo = vnpParams.vnp_TransactionNo;
      vnpayRecord.vnp_BankCode = vnpParams.vnp_BankCode;
      vnpayRecord.vnp_BankTranNo = vnpParams.vnp_BankTranNo;
      vnpayRecord.vnp_CardType = vnpParams.vnp_CardType;
      vnpayRecord.vnp_PayDate = vnpParams.vnp_PayDate;
      vnpayRecord.vnp_TransactionStatus = vnpParams.vnp_TransactionStatus;
      vnpayRecord.vnp_SecureHash = vnpParams.vnp_SecureHash;

      // Update status based on response code
      if (vnpParams.vnp_ResponseCode === '00') {
        vnpayRecord.status = 'success';
      } else {
        vnpayRecord.status = 'failed';
      }

      await vnpayRecord.save();

      // Update order status
      await Order.findByIdAndUpdate(vnpayRecord.orderId, {
        paymentStatus: vnpParams.vnp_ResponseCode === '00' ? 'completed' : 'failed'
      });

      logger.info('VNPay payment status updated', {
        vnp_TxnRef,
        status: vnpayRecord.status,
        orderId: vnpayRecord.orderId
      });

      return vnpayRecord;
    } catch (error) {
      logger.error('Update payment status error:', error);
      throw error;
    }
  }

  /**
   * Get response message from response code
   * @param {string} code - VNPay response code
   * @returns {string} Message in Vietnamese
   */
  getResponseMessage(code) {
    const messages = {
      '00': 'Giao dịch thành công',
      '07': 'Trừ tiền thành công. Giao dịch bị nghi ngờ (liên quan tới lừa đảo, giao dịch bất thường)',
      '09': 'Giao dịch không thành công do: Thẻ/Tài khoản của khách hàng chưa đăng ký dịch vụ InternetBanking tại ngân hàng',
      '10': 'Giao dịch không thành công do: Khách hàng xác thực thông tin thẻ/tài khoản không đúng quá 3 lần',
      '11': 'Giao dịch không thành công do: Đã hết hạn chờ thanh toán. Xin quý khách vui lòng thực hiện lại giao dịch',
      '12': 'Giao dịch không thành công do: Thẻ/Tài khoản của khách hàng bị khóa',
      '13': 'Giao dịch không thành công do Quý khách nhập sai mật khẩu xác thực giao dịch (OTP)',
      '24': 'Giao dịch không thành công do: Khách hàng hủy giao dịch',
      '51': 'Giao dịch không thành công do: Tài khoản của quý khách không đủ số dư để thực hiện giao dịch',
      '65': 'Giao dịch không thành công do: Tài khoản của Quý khách đã vượt quá hạn mức giao dịch trong ngày',
      '75': 'Ngân hàng thanh toán đang bảo trì',
      '79': 'Giao dịch không thành công do: KH nhập sai mật khẩu thanh toán quá số lần quy định',
      '99': 'Các lỗi khác (lỗi còn lại, không có trong danh sách mã lỗi đã liệt kê)'
    };

    return messages[code] || 'Lỗi không xác định';
  }
}

module.exports = new VNPayService();
