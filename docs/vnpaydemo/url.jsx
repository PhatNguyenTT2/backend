//https://{domain}/ReturnUrl?vnp_Amount=1000000&vnp_BankCode=NCB&vnp_BankTranNo=VNP14226112&vnp_CardType=ATM&vnp_OrderInfo=Thanh+toan+don+hang+thoi+gian%3A+2023-12-07+17%3A00%3A44&vnp_PayDate=20231207170112&vnp_ResponseCode=00&vnp_TmnCode=CTTVNP01&vnp_TransactionNo=14226112&vnp_TransactionStatus=00&vnp_TxnRef=166117&vnp_SecureHash=b6dababca5e07a2d8e32fdd3cf05c29cb426c721ae18e9589f7ad0e2db4b657c6e0e5cc8e271cf745162bcb100fdf2f64520554a6f5275bc4c5b5b3e57dc4b4b

router.get('/vnpay_return', function (req, res, next) {
  var vnp_Params = req.query;

  var secureHash = vnp_Params['vnp_SecureHash'];

  delete vnp_Params['vnp_SecureHash'];
  delete vnp_Params['vnp_SecureHashType'];

  vnp_Params = sortObject(vnp_Params);

  var config = require('config');
  var tmnCode = config.get('vnp_TmnCode');
  var secretKey = config.get('vnp_HashSecret');

  var querystring = require('qs');
  var signData = querystring.stringify(vnp_Params, { encode: false });
  var crypto = require("crypto");
  var hmac = crypto.createHmac("sha512", secretKey);
  var signed = hmac.update(new Buffer(signData, 'utf-8')).digest("hex");

  if (secureHash === signed) {
    //Kiem tra xem du lieu trong db co hop le hay khong va thong bao ket qua

    res.render('success', { code: vnp_Params['vnp_ResponseCode'] })
  } else {
    res.render('success', { code: '97' })
  }
});
