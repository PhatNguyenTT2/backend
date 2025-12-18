const { VNPay } = require('vnpay');

/**
 * Initialize VNPay instance with configuration
 */
const vnpay = new VNPay({
  tmnCode: process.env.VNP_TMNCODE,
  secureSecret: process.env.VNP_HASHSECRET,
  vnpayHost: process.env.VNP_URL || 'https://sandbox.vnpayment.vn',
  testMode: process.env.VNP_TEST_MODE === 'true',
  /**
   * Hash algorithm: SHA256 or SHA512
   * Defaults to SHA512 if not specified
   */
  hashAlgorithm: 'SHA512',
});

module.exports = vnpay;
