const mongoose = require('mongoose');

const vnpaySchema = new mongoose.Schema({
  // Order reference
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },

  // VNPay transaction reference
  vnp_TxnRef: {
    type: String,
    required: true,
    unique: true
  },

  // VNPay transaction details
  vnp_Amount: {
    type: Number,
    required: true
  },

  vnp_OrderInfo: String,

  vnp_TransactionNo: String,        // VNPay's transaction ID
  vnp_ResponseCode: String,         // 00 = success
  vnp_BankCode: String,             // Bank used for payment
  vnp_BankTranNo: String,           // Bank's transaction number
  vnp_CardType: String,             // ATM/QRCODE
  vnp_PayDate: String,              // Format: YYYYMMDDHHmmss
  vnp_TransactionStatus: String,    // 00 = success

  // Request details
  vnp_IpAddr: String,
  vnp_Locale: String,

  // Security
  vnp_SecureHash: String,

  // Status tracking
  status: {
    type: String,
    enum: ['pending', 'success', 'failed', 'expired'],
    default: 'pending'
  },

  // Payment URL
  paymentUrl: String,

  // IPN verified
  ipnVerified: {
    type: Boolean,
    default: false
  },

  // Return URL accessed
  returnUrlAccessed: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Index for quick lookups
vnpaySchema.index({ vnp_TxnRef: 1 });
vnpaySchema.index({ orderId: 1 });
vnpaySchema.index({ status: 1 });

module.exports = mongoose.model('VNPay', vnpaySchema);
