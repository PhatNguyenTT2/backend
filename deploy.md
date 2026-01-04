Đoạn mã xác minh của Google cần dán vào phần <head> của trang chủ website (file HTML được load đầu tiên, thường là index.html hoặc layout chung của framework).
​

Dán mã ở đâu?
Mở file HTML gốc của website (vd: index.html, hoặc file layout như views/layout.ejs, layouts/main.hbs, resources/views/app.blade.php, v.v.).
​

Tìm cặp thẻ <head>...</head> và dán đoạn:

xml
<meta name="google-site-verification" content="MlobmyjoXTx_G-RrU9fQhDY19ywk3PWgYN2POysqZOM" />
ngay bên trong <head>, đặt ở trên hoặc dưới <title> đều được, miễn là vẫn nằm trong <head>.
​

Deploy / upload lại file lên hosting, truy cập thử trang chủ, bấm chuột phải “View page source” kiểm tra xem thẻ meta đã xuất hiện trong <head> chưa.
​

Quay lại Google Search Console và nhấn nút XÁC MINH / VERIFY để hoàn tất.
​

Nếu dùng CMS (WordPress, v.v.), thường có chỗ cấu hình riêng “Google Search Console / Google site verification” trong plugin SEO (Yoast, RankMath…) hoặc mục “Header code”; chỉ cần dán nguyên thẻ meta vào ô đó là xong.
​

