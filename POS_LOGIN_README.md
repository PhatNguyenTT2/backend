# POS Login System Documentation

## Tổng quan

Hệ thống đăng nhập POS (Point of Sale) cho phép nhân viên đăng nhập vào hệ thống bán hàng bằng mã nhân viên và mã PIN.

## Các file đã tạo

### Backend

1. **Controller: `controllers/posLogin.js`**
   - `POST /api/pos-login` - Đăng nhập POS
   - `POST /api/pos-login/logout` - Đăng xuất POS
   - `GET /api/pos-login/verify` - Xác thực session POS

2. **Middleware: `middlewares/posAuthMiddleware.js`**
   - Middleware xác thực token POS cho các route được bảo vệ
   - Kiểm tra quyền truy cập POS
   - Kiểm tra trạng thái khóa tài khoản

3. **Service: `services/posAuthService.js`** (đã có sẵn)
   - Quản lý xác thực POS
   - Xác minh PIN
   - Quản lý khóa tài khoản

### Frontend

1. **Service: `admin/src/services/posLoginService.js`**
   - `login(employeeCode, pin)` - Đăng nhập
   - `logout()` - Đăng xuất
   - `verifySession()` - Kiểm tra session
   - `isLoggedIn()` - Kiểm tra trạng thái đăng nhập
   - `getCurrentEmployee()` - Lấy thông tin nhân viên hiện tại

2. **Component: `admin/src/pages/pos/POSLogin.jsx`** (đã có sẵn)
   - Giao diện đăng nhập POS
   - Number pad để nhập PIN
   - Xử lý lỗi và hiển thị thông báo

## Luồng hoạt động

### 1. Đăng nhập

```javascript
// Frontend
const response = await posLoginService.login('USER001', '1234');

if (response.success) {
  // Token và thông tin nhân viên được lưu vào localStorage
  // Tự động chuyển hướng đến /pos
  navigate('/pos');
}
```

**Backend xử lý:**
1. Tìm UserAccount theo employeeCode
2. Tìm Employee liên kết với UserAccount
3. Kiểm tra tài khoản active
4. Xác minh PIN qua `posAuthService.verifyPIN()`
5. Tạo JWT token với flag `isPOS: true`
6. Trả về token và thông tin nhân viên

### 2. Xác thực session

```javascript
// Frontend
const result = await posLoginService.verifySession();

if (!result.success) {
  // Session hết hạn, chuyển về trang login
  navigate('/pos-login');
}
```

### 3. Đăng xuất

```javascript
// Frontend
await posLoginService.logout();
// Xóa token và thông tin từ localStorage
navigate('/pos-login');
```

## API Endpoints

### POST /api/pos-login
Đăng nhập vào hệ thống POS

**Request Body:**
```json
{
  "employeeCode": "USER001",
  "pin": "1234"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "employee": {
      "id": "507f1f77bcf86cd799439011",
      "fullName": "John Doe",
      "userCode": "USER001",
      "email": "john@example.com",
      "phone": "0123456789",
      "role": "Sales",
      "permissions": ["pos.access", "pos.sale"],
      "lastLogin": "2025-11-08T10:30:00.000Z"
    }
  },
  "message": "Login successful"
}
```

**Error Responses:**

- **401 Invalid Credentials:**
```json
{
  "success": false,
  "error": {
    "message": "Invalid employee code or PIN",
    "code": "INVALID_CREDENTIALS"
  }
}
```

- **401 Invalid PIN:**
```json
{
  "success": false,
  "error": {
    "message": "Invalid PIN. 3 attempts remaining",
    "code": "INVALID_PIN",
    "attemptsRemaining": 3
  }
}
```

- **423 Account Locked:**
```json
{
  "success": false,
  "error": {
    "message": "Too many failed attempts. PIN locked for 15 minutes",
    "code": "PIN_LOCKED",
    "minutesLeft": 15
  }
}
```

- **403 Access Denied:**
```json
{
  "success": false,
  "error": {
    "message": "POS access is disabled for this employee",
    "code": "ACCESS_DENIED"
  }
}
```

### POST /api/pos-login/logout
Đăng xuất khỏi POS

**Headers:**
```
Authorization: Bearer <token>
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

### GET /api/pos-login/verify
Xác thực session hiện tại

**Headers:**
```
Authorization: Bearer <token>
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "employee": {
      "id": "507f1f77bcf86cd799439011",
      "fullName": "John Doe",
      "userCode": "USER001",
      "email": "john@example.com",
      "phone": "0123456789",
      "role": "Sales",
      "permissions": ["pos.access", "pos.sale"],
      "lastLogin": "2025-11-08T10:30:00.000Z"
    }
  }
}
```

**Error Responses:**
- 401: Token invalid/expired
- 403: Access revoked
- 423: Account locked

## Bảo mật

### Token POS
- Thời gian sống: 12 giờ
- Flag đặc biệt: `isPOS: true`
- Lưu trữ: localStorage (khóa: `posToken`, `posEmployee`)

### Khóa tài khoản
- Số lần thử sai tối đa: 5 lần
- Thời gian khóa: 15 phút
- Reset tự động sau khi đăng nhập thành công

### Quyền truy cập
- Chỉ nhân viên có role **Super Admin** hoặc **Sales** mới được cấp quyền POS
- Tài khoản phải ở trạng thái `isActive: true`
- Có thể tạm thời vô hiệu hóa qua `canAccessPOS: false`

## Sử dụng Middleware cho route POS

Để bảo vệ các route POS khác, sử dụng middleware:

```javascript
const { posAuthMiddleware } = require('../middlewares/posAuthMiddleware')

// Route được bảo vệ
posRouter.get('/sales', posAuthMiddleware, async (req, res) => {
  // req.employee chứa thông tin nhân viên
  // req.token chứa decoded token
  
  const employee = req.employee
  res.json({ success: true, data: { employee } })
})
```

## Testing

### Test đăng nhập thành công
```bash
curl -X POST http://localhost:3001/api/pos-login \
  -H "Content-Type: application/json" \
  -d '{"employeeCode":"USER001","pin":"1234"}'
```

### Test xác thực session
```bash
curl -X GET http://localhost:3001/api/pos-login/verify \
  -H "Authorization: Bearer <your-token>"
```

### Test đăng xuất
```bash
curl -X POST http://localhost:3001/api/pos-login/logout \
  -H "Authorization: Bearer <your-token>"
```

## LocalStorage Keys

Frontend lưu trữ 2 keys:
- `posToken` - JWT token
- `posEmployee` - Thông tin nhân viên (JSON)

## Lưu ý quan trọng

1. **PIN vs Password**: PIN chỉ có 4-6 chữ số, khác với password của tài khoản chính
2. **Session độc lập**: Token POS khác với token admin, không thể dùng lẫn
3. **Auto-redirect**: Component POSLogin tự động kiểm tra và chuyển hướng nếu đã login
4. **Error handling**: Tất cả lỗi đều được xử lý và hiển thị thân thiện với người dùng

## Roadmap

Các tính năng có thể mở rộng:
- [ ] Refresh token cho session dài hạn
- [ ] Ghi log hoạt động POS
- [ ] Thông báo real-time khi tài khoản bị khóa
- [ ] OTP 2FA cho bảo mật cao hơn
- [ ] Session management (xem các session đang active)
