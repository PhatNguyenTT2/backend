Hướng Dẫn Tích Hợp VNPAY Với Node.js
VNPay cung cấp hướng dẫn tích hợp thanh toán qua 3 bước chính: tạo URL thanh toán, xử lý Return URL, và IPN URL để cập nhật kết quả server-to-server.​

Cài Đặt Và Cấu Hình
Cài đặt thư viện vnpay (open-source, hỗ trợ đầy đủ API VNPay) qua npm: npm install vnpay.

Tạo file .env với thông tin sandbox từ VNPay (đăng ký tại sandbox.vnpayment.vn/devreg):​

text
VNP_TMNCODE=your_tmncode
VNP_SECRET=your_hash_secret
APP_URL=https://yourdomain.com
Khởi tạo VNPay instance trong file config/vnpay.js:

javascript
import { VNPay } from 'vnpay';

export const vnpay = new VNPay({
  tmnCode: process.env.VNP_TMNCODE,
  secureSecret: process.env.VNP_SECRET,
  vnpayHost: 'https://sandbox.vnpayment.vn',
  testMode: true,
});
Tạo URL Thanh Toán
Endpoint POST /api/payments/create để build URL (số tiền nhân 100, thời gian GMT+7).​

javascript
import express from 'express';
const app = express();
app.use(express.urlencoded({ extended: true }));

app.post('/api/payments/create', (req, res) => {
  try {
    const { amount, orderInfo } = req.body; // amount: 10000 (1k VND -> 1000000)
    const paymentUrl = vnpay.buildPaymentUrl({
      vnp_Amount: amount * 100,
      vnp_OrderInfo: orderInfo,
      vnp_OrderType: 'billpayment',
      vnp_IpAddr: req.ip || '127.0.0.1',
      vnp_TxnRef: `ORDER_${Date.now()}`,
      vnp_ReturnUrl: `${process.env.APP_URL}/payment/return`,
      vnp_Locale: 'vn',
      vnp_CurrCode: 'VND',
    });
    res.json({ success: true, paymentUrl });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
Frontend: window.location.href = paymentUrl.

Xử Lý Return URL
Endpoint GET /payment/return chỉ verify checksum và hiển thị kết quả (không update DB).​

javascript
app.get('/payment/return', (req, res) => {
  const verification = vnpay.verifyReturnUrl(req.query);
  if (verification.isSuccess && verification.vnp_ResponseCode === '00') {
    res.send(`Thanh toán thành công! Mã GD: ${verification.vnp_TxnRef}`);
  } else {
    res.send(`Thanh toán thất bại: ${verification.message}`);
  }
});
Xử Lý IPN URL (Server-to-Server)
Endpoint POST /api/payment/ipn (cần SSL) nhận kết quả chính thức, verify và update DB.​

javascript
app.post('/api/payment/ipn', (req, res) => {
  try {
    const verification = vnpay.verifyIpnCall(req.body);
    if (verification.isSuccess && verification.vnp_ResponseCode === '00') {
      // Update DB: order status = 'PAID'
      console.log(`Payment success: ${verification.vnp_TxnRef}`);
      res.json({ RspCode: '00', Message: 'success' });
    } else {
      res.json({ RspCode: '01', Message: 'fail' });
    }
  } catch (error) {
    res.status(500).json({ RspCode: '99', Message: 'error' });
  }
});
Bảng Mã Lỗi Thường Gặp
Mã	Mô tả ​
00	Thành công
07	Nghi ngờ gian lận
09	Chưa đăng ký Internet Banking
24	Khách hủy
51	Không đủ số dư
Chuyển Production
Thay vnpayHost: 'https://pay.vnpay.vn' và testMode: false. Demo đầy đủ: github.com/lehuygiang28/vnpay.​