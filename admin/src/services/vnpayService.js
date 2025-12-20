import api from './api';

/**
 * VNPay Service
 * Handles VNPay payment gateway integration
 */
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
