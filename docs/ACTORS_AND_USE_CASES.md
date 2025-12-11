# Actors và Use Cases - Hệ thống POS/Bán lẻ

**Ngày cập nhật:** 4 tháng 11, 2025

## Tổng quan

Hệ thống có **4 tác nhân chính** với phạm vi trách nhiệm và quyền truy cập riêng biệt:

---

## 1. Khách hàng (Customer)
**Đặc điểm:**
- Không đăng nhập vào hệ thống
- Tương tác trực tiếp với Sales tại điểm bán
- Có thể được tạo hồ sơ trong hệ thống bởi Sales để theo dõi lịch sử mua hàng

**Use Cases chính:**
- **Mua sắm tại cửa hàng**: Chọn sản phẩm, nhận tư vấn từ Sales
- **Thanh toán**: Thanh toán qua nhiều phương thức (tiền mặt, thẻ, chuyển khoản)
- **Nhận hóa đơn**: Nhận hóa đơn in hoặc điện tử
- **Yêu cầu đổi trả**: Đổi trả sản phẩm theo chính sách (được Sales xử lý)
- **Tích điểm/Ưu đãi**: Hưởng chương trình khách hàng thân thiết (nếu có)

**Dữ liệu liên quan:**
- Model: `Customer`, `Order`, `Payment`
- Thông tin: Tên, SĐT, Email, Địa chỉ, Lịch sử mua hàng, Công nợ

---

## 2. Sales Staff (Nhân viên bán hàng)
**Đặc điểm:**
- **Chỉ đăng nhập tại POS** bằng PIN ngắn (4-6 số) duy nhất
- **KHÔNG có quyền truy cập Admin Dashboard**
- Làm việc trực tiếp tại quầy/cửa hàng
- Token POS có thời hạn ngắn (8 giờ)

**Use Cases chính:**

### A. Xác thực và Phiên làm việc
- **Đăng nhập POS**: Chỉ nhập PIN (4-6 số)
  - Endpoint: `POST /api/pos/login`
  - Input: `{ pin }`
  - Output: `{ tokenPOS, employee, permissions }`
  - Lưu ý: PIN phải là duy nhất trong toàn hệ thống
- **Đổi PIN**: Thay đổi PIN định kỳ hoặc khi quên
  - Endpoint: `POST /api/pos/change-pin`
- **Logout POS**: Kết thúc phiên làm việc
  - Endpoint: `POST /api/pos/logout`

### B. Quản lý bán hàng
- **Tạo đơn hàng mới**: Quét/tìm sản phẩm, thêm vào giỏ
- **Thêm/Xóa sản phẩm**: Chỉnh sửa số lượng trong đơn
- **Áp dụng chiết khấu**: Giảm giá theo chính sách (có giới hạn %)
- **Tạm giữ đơn hàng**: Giữ đơn để phục vụ khách khác, tiếp tục sau
- **Tiếp tục đơn đã giữ**: Lấy lại đơn tạm giữ
- **Thanh toán**: Xử lý thanh toán (tiền mặt, thẻ, chuyển khoản)
- **In hóa đơn**: In hóa đơn cho khách

### C. Quản lý khách hàng
- **Tạo/Cập nhật thông tin khách**: Nhập thông tin khách hàng mới
- **Tìm kiếm khách hàng**: Tra cứu lịch sử mua hàng
- **Xem công nợ**: Kiểm tra công nợ khách hàng

### D. Đổi trả và hoàn tiền
- **Xử lý đổi trả**: Đổi/trả sản phẩm trong chính sách
  - Có giới hạn giá trị (VD: < 300K không cần phê duyệt)
  - Trên giới hạn cần Manager phê duyệt
- **Hoàn tiền**: Hoàn tiền theo chính sách

### E. Báo cáo ca làm việc
- **Bắt đầu ca**: Khai báo tiền đầu ca
- **Kết ca**: Tổng kết doanh thu, tiền mặt, thẻ
- **Xem báo cáo ca**: Xem doanh thu ca của mình

**Dữ liệu liên quan:**
- Model: `Employee`, `Order`, `OrderDetail`, `Customer`, `Payment`, `Product`
- Fields mới (thiết kế): `posPinHash` (unique), `pinFailedAttempts`, `pinLockedUntil`, `pinLastChanged`, `pinExpiresAt`, `posLastLogin`, `canAccessPOS`
- **Quan trọng**: `posPinHash` phải unique để đảm bảo không có 2 Sales trùng PIN

**Giới hạn:**
- ❌ Không xem báo cáo tổng hợp
- ❌ Không quản lý nhân viên, kho hàng
- ❌ Không truy cập Admin Dashboard
- ❌ Không thay đổi giá sản phẩm
- ✅ Chỉ xem và xử lý đơn hàng của chính mình

---

## 3. Manager (Quản lý cửa hàng)
**Đặc điểm:**
- **Đăng nhập Admin Dashboard** bằng Username + Password
- **Có thể đăng nhập POS** bằng PIN (nếu cần hỗ trợ Sales)
- Quản lý hoạt động cửa hàng, nhân viên Sales
- Quản lý nhà cung cấp và kho hàng
- Không có khái niệm chi nhánh trong hệ thống

**Use Cases chính:**

### A. Xác thực
- **Đăng nhập Admin**: Username + Password
  - Endpoint: `POST /api/login`
  - Output: `{ token, user: { role: 'Manager', permissions: [...] } }`
- **Đăng nhập POS** (tùy chọn): Employee Code + PIN
- **Logout**: Kết thúc phiên
  - Endpoint: `POST /api/login/logout`

### B. Quản lý nhân viên
- **Xem danh sách Sales**: Danh sách nhân viên Sales
- **Thêm Sales mới**: Tạo tài khoản Sales (Employee + PIN)
- **Cập nhật thông tin Sales**: Sửa thông tin nhân viên
- **Khóa/Mở khóa tài khoản**: Tạm khóa Sales vi phạm
- **Reset PIN**: Reset PIN cho Sales quên mật khẩu
- **Xem lịch sử làm việc**: Theo dõi ca làm của Sales

### C. Quản lý nhà cung cấp
- **Xem danh sách nhà cung cấp**: Danh sách Supplier
  - Model: `Supplier`, `DetailSupplier`
  - Endpoints: `GET /api/suppliers`
- **Tạo nhà cung cấp mới**: Thêm Supplier
  - Endpoint: `POST /api/suppliers`
- **Cập nhật thông tin nhà cung cấp**: Sửa thông tin Supplier
  - Endpoint: `PUT /api/suppliers/:id`
- **Quản lý công nợ nhà cung cấp**: Theo dõi nợ và thanh toán
  - Model: `DetailSupplier`
  - Ghi nhận thanh toán, đối chiếu công nợ

### D. Quản lý kho hàng
- **Tạo đơn đặt hàng**: Tạo Purchase Order
  - Model: `PurchaseOrder`, `DetailPurchaseOrder`
  - Endpoint: `POST /api/purchase-orders`
- **Duyệt đơn đặt hàng**: Phê duyệt PO trước khi gửi Supplier
  - Endpoint: `PUT /api/purchase-orders/:id/approve`
- **Nhập kho**: Ghi nhận hàng về kho
  - Model: `Inventory`, `ProductBatch`
  - Endpoint: `POST /api/inventories/receive`
- **Kiểm kê tồn kho**: Nhập phiếu kiểm kê định kỳ
  - Endpoint: `POST /api/inventories/stocktake`
- **Xử lý hàng hết hạn/hư hỏng**: Ghi nhận hàng loại bỏ
  - Model: `ProductBatch` (status: 'disposed')
- **Xem báo cáo tồn kho**: Hàng tồn, hàng sắp hết, hàng bán chạm

### E. Quản lý sản phẩm (Hạn chế)
- **Xem danh sách sản phẩm**: Xem toàn bộ Product
  - Endpoint: `GET /api/products`
- **Cập nhật giá bán**: Điều chỉnh giá bán lẻ
  - Endpoint: `PUT /api/products/:id/price`
- **Tạm ngừng/Kích hoạt sản phẩm**: Đánh dấu hết hàng/ngừng bán
  - Endpoint: `PUT /api/products/:id/status`

### F. Quản lý khách hàng
- **Xem danh sách khách hàng**: Toàn bộ Customer
- **Quản lý công nợ khách hàng**: Theo dõi và duyệt thanh toán công nợ
- **Cập nhật thông tin khách**: Sửa thông tin liên hệ

### G. Báo cáo và phân tích
- **Báo cáo doanh thu**: Theo ngày, tuần, tháng
- **Báo cáo hiệu suất Sales**: Doanh số từng nhân viên
- **Báo cáo tồn kho**: Hàng tồn, hàng bán chạy, hàng sắp hết
- **Báo cáo nhà cung cấp**: Công nợ, lịch sử nhập hàng
- **Báo cáo khách hàng**: Khách mới, khách quay lại, công nợ
- **Kết ca tổng**: Xem báo cáo kết ca của tất cả Sales

**Dữ liệu liên quan:**
- Model: `Employee`, `Supplier`, `DetailSupplier`, `PurchaseOrder`, `DetailPurchaseOrder`, `Inventory`, `ProductBatch`, `Product`, `Customer`, `Order`, `Payment`
- Quyền: `canAccessAdmin: 'limited'`, `canAccessPOS: true`

**Giới hạn:**
- ❌ Không tạo/xóa Category sản phẩm
- ❌ Không tạo/xóa Product (chỉ cập nhật giá và trạng thái)
- ❌ Không xóa nhà cung cấp (chỉ tạo và sửa)
- ❌ Không cấu hình hệ thống
- ❌ Không phân quyền Manager khác
- ✅ Quản lý nhân viên, nhà cung cấp, kho hàng, khách hàng

---

## 4. Admin (Quản trị hệ thống)
**Đặc điểm:**
- **Chỉ đăng nhập Admin Dashboard** bằng Username + Password
- Quản lý toàn hệ thống, nhiều chi nhánh
- Cấu hình chính sách, phân quyền
- Toàn quyền với mọi dữ liệu

**Use Cases chính:**

### A. Xác thực
- **Đăng nhập Admin**: Username + Password
  - Endpoint: `POST /api/login`
  - Output: `{ token, user: { role: 'Admin', permissions: ['all'] } }`
- **Đăng ký Admin đầu tiên**: Khởi tạo hệ thống
  - Endpoint: `POST /api/login/register`
- **Logout**: Kết thúc phiên
  - Endpoint: `POST /api/login/logout`

### B. Quản lý nhân viên và phân quyền
- **Quản lý Manager**: Tạo/sửa/xóa tài khoản Manager
- **Quản lý Sales**: Xem toàn bộ Sales, gán vào chi nhánh
- **Quản lý Role**: Tạo/sửa Role và Permission
  - Model: `Role`
  - Endpoints: `GET/POST/PUT/DELETE /api/roles`
- **Phân quyền**: Gán Role cho UserAccount
- **Quản lý Department**: Tạo/sửa phòng ban, chi nhánh
  - Model: `Department`

### C. Quản lý sản phẩm
- **Quản lý danh mục**: Tạo/sửa/xóa Category
  - Model: `Category`
  - Endpoints: `GET/POST/PUT/DELETE /api/categories`
- **Quản lý sản phẩm**: CRUD sản phẩm toàn hệ thống
  - Model: `Product`, `ProductBatch`
  - Endpoints: `GET/POST/PUT/DELETE /api/products`
- **Thiết lập giá**: Cập nhật giá bán, giá gốc
- **Quản lý lô hàng**: Theo dõi lô, hạn sử dụng
  - Model: `ProductBatch`

### D. Quản lý nhà cung cấp
- **Quản lý Supplier**: Xem toàn bộ nhà cung cấp
  - Model: `Supplier`, `DetailSupplier`
  - Endpoints: `GET /api/suppliers`
- **Tạo/Cập nhật Supplier**: Thêm và sửa thông tin nhà cung cấp (Admin có thể xóa)
  - Endpoints: `POST /api/suppliers`, `PUT /api/suppliers/:id`
- **Quản lý công nợ**: Theo dõi và xử lý công nợ nhà cung cấp
  - Model: `DetailSupplier`

### E. Quản lý kho
- **Đơn đặt hàng**: Tạo/duyệt Purchase Order
  - Model: `PurchaseOrder`, `DetailPurchaseOrder`
  - Endpoints: `GET/POST/PUT /api/purchase-orders`
- **Nhập kho**: Ghi nhận nhập hàng vào Inventory
  - Model: `Inventory`, `ProductBatch`
  - Endpoints: `POST /api/inventories/receive`
- **Quản lý tồn kho**: Xem và điều chỉnh tồn kho
  - Endpoints: `GET /api/inventories`
- **Kiểm kê**: Kiểm kê định kỳ
  - Endpoint: `POST /api/inventories/stocktake`
- **Xử lý hàng loại bỏ**: Ghi nhận hàng hết hạn, hư hỏng
  - Model: `ProductBatch`

### F. Quản lý đơn hàng và thanh toán
- **Xem tất cả đơn hàng**: Theo dõi Order toàn hệ thống
  - Model: `Order`, `OrderDetail`
  - Endpoints: `GET /api/orders`
- **Quản lý Payment**: Xem tất cả thanh toán
  - Model: `Payment`
  - Endpoints: `GET /api/payments`
- **Hủy/Hoàn đơn**: Xử lý tranh chấp, hoàn tiền cao

### G. Báo cáo và phân tích tổng hợp
- **Dashboard tổng quan**: Doanh thu, tồn kho, khách hàng toàn hệ thống
- **Báo cáo tài chính**: Doanh thu, chi phí, lợi nhuận
- **Báo cáo hiệu suất**: Theo chi nhánh, Manager, Sales
- **Báo cáo hàng tồn**: Tồn kho, hàng chết, hàng bán chạy
- **Phân tích xu hướng**: Dự báo nhu cầu, mùa vụ

### H. Cấu hình hệ thống
- **Thiết lập chính sách**: Chính sách đổi trả, chiết khấu, bảo hành
- **Cấu hình POS**: Timeout phiên, PIN policy (độ dài, hết hạn, lockout)
- **Quản lý thiết bị**: Đăng ký/khóa thiết bị POS
- **Audit Log**: Xem log hệ thống, theo dõi hành vi

**Dữ liệu liên quan:**
- Toàn bộ models và endpoints
- Quyền: `canAccessAdmin: 'full'`, `canAccessPOS: false`

---

## So sánh quyền truy cập

| Chức năng | Customer | Sales | Manager | Admin |
|-----------|----------|-------|---------|-------|
| **Đăng nhập POS** | ❌ | ✅ (chỉ PIN) | ✅ (PIN hoặc Password) | ❌ |
| **Đăng nhập Admin Dashboard** | ❌ | ❌ | ✅ (Password) | ✅ (Password) |
| **Tạo đơn hàng** | ❌ | ✅ | ✅ | ✅ (xem) |
| **Xem tồn kho** | ❌ | ✅ (giới hạn) | ✅ | ✅ (tất cả) |
| **Quản lý nhân viên** | ❌ | ❌ | ✅ (Sales) | ✅ (tất cả) |
| **Quản lý sản phẩm** | ❌ | ❌ | ✅ (giá/trạng thái) | ✅ (CRUD) |
| **Quản lý Category** | ❌ | ❌ | ❌ | ✅ |
| **Quản lý Supplier** | ❌ | ❌ | ✅ (tạo/sửa) | ✅ (CRUD) |
| **Quản lý kho hàng** | ❌ | ❌ | ✅ (PO/nhập/kiểm kê) | ✅ (tất cả) |
| **Báo cáo doanh thu** | ❌ | ✅ (cá nhân) | ✅ (tổng hợp) | ✅ (tất cả) |
| **Phân quyền** | ❌ | ❌ | ❌ | ✅ |
| **Cấu hình hệ thống** | ❌ | ❌ | ❌ | ✅ |

---

## Luồng xác thực (Authentication Flow)

### Sales - POS Login
```
1. Sales nhập: Chỉ PIN (4-6 số)
   POST /api/pos/login
   { pin: "1234" }

2. Backend kiểm tra:
   - Tìm Employee duy nhất có PIN hash khớp (bcrypt)
   - canAccessPOS = true
   - PIN chưa hết hạn (< 90 ngày)
   - Tài khoản chưa bị khóa (pinFailedAttempts < 5)

3. Trả về:
   - Token POS (JWT, expires 8h)
   - Thông tin Employee (fullName, department, permissions)
   - Policy flags (pinExpiringSoon, mustChangePin)

4. Sales dùng token POS để gọi /api/pos/*

Lưu ý: PIN phải unique trong DB để tránh xung đột
```

### Manager/Admin - Admin Dashboard Login
```
1. User nhập: Username + Password
   POST /api/login
   { username: "manager01", password: "********" }

2. Backend kiểm tra:
   - UserAccount tồn tại
   - Password hash khớp (bcrypt)
   - isActive = true
   - Role có canAccessAdmin = 'full' hoặc 'limited'

3. Trả về:
   - Token Admin (JWT, expires 7d)
   - Thông tin User (username, email, role, permissions)
   - Employee profile (fullName, department)

4. User dùng token Admin để gọi /api/* (trừ /api/pos/*)
```

---

## Models liên quan

### Hiện có trong code:
- `UserAccount`: username, passwordHash, role, tokens, isActive, lastLogin
- `Employee`: fullName, department, phone, address, dateOfBirth, userAccount (1-1)
- `Role`: roleName, permissions, roleCode
- `Customer`, `Order`, `OrderDetail`, `Payment`
- `Product`, `ProductBatch`, `Category`
- `Supplier`, `PurchaseOrder`, `Inventory`

### Cần bổ sung (theo thiết kế PIN):
**Employee model:**
```javascript
{
  // ... existing fields
  
  // POS PIN Authentication
  posPinHash: {
    type: String,
    unique: true,  // QUAN TRỌNG: PIN phải unique
    sparse: true   // Cho phép null nếu không phải Sales
  },
  pinLastChanged: Date,
  pinExpiresAt: Date,
  pinFailedAttempts: { type: Number, default: 0 },
  pinLockedUntil: Date,
  posLastLogin: Date,
  posDeviceId: String,
  canAccessPOS: { type: Boolean, default: false }
}
```

**Role model:**
```javascript
{
  // ... existing fields
  
  // Access Control
  canAccessAdmin: {
    type: String,
    enum: ['none', 'view_only', 'limited', 'full'],
    default: 'none'
  },
  canAccessPOS: { type: Boolean, default: false }
}
```

---

## Endpoints theo Actor

### Sales (POS only)
```
POST   /api/pos/login              # Đăng nhập PIN
POST   /api/pos/logout             # Logout
GET    /api/pos/me                 # Xem thông tin phiên
POST   /api/pos/change-pin         # Đổi PIN
GET    /api/pos/orders             # Xem đơn của mình
POST   /api/pos/orders             # Tạo đơn mới
PUT    /api/pos/orders/:id         # Sửa đơn
POST   /api/pos/orders/:id/pay     # Thanh toán
GET    /api/pos/customers          # Tìm khách hàng
POST   /api/pos/customers          # Tạo khách hàng
```

### Manager (Admin Dashboard + POS)
```
# Admin Dashboard
POST   /api/login                  # Đăng nhập username/password
GET    /api/login/me               # Thông tin phiên
POST   /api/login/logout           # Logout

# Quản lý nhân viên
GET    /api/employees              # Danh sách Sales
POST   /api/employees              # Tạo Sales
PUT    /api/employees/:id          # Sửa Sales
POST   /api/employees/:id/reset-pin # Reset PIN

# Quản lý nhà cung cấp
GET    /api/suppliers              # Danh sách Supplier
POST   /api/suppliers              # Tạo Supplier
PUT    /api/suppliers/:id          # Sửa Supplier

# Quản lý kho hàng
GET    /api/purchase-orders        # Danh sách PO
POST   /api/purchase-orders        # Tạo PO
PUT    /api/purchase-orders/:id    # Sửa PO
PUT    /api/purchase-orders/:id/approve # Duyệt PO
POST   /api/inventories/receive    # Nhập kho
GET    /api/inventories            # Xem tồn kho
POST   /api/inventories/stocktake  # Kiểm kê

# Quản lý sản phẩm (hạn chế)
GET    /api/products               # Xem sản phẩm
PUT    /api/products/:id/price     # Cập nhật giá
PUT    /api/products/:id/status    # Cập nhật trạng thái

# Báo cáo
GET    /api/reports/sales          # Báo cáo doanh thu
GET    /api/reports/staff          # Báo cáo hiệu suất
GET    /api/reports/inventory      # Báo cáo tồn kho
GET    /api/reports/suppliers      # Báo cáo nhà cung cấp

# POS (optional)
POST   /api/pos/login              # Đăng nhập PIN (nếu cần hỗ trợ)
```

### Admin (Admin Dashboard only)
```
POST   /api/login                  # Đăng nhập
POST   /api/login/register         # Đăng ký admin đầu

# Quản lý nhân viên và phân quyền
GET    /api/user-accounts          # Tất cả tài khoản
POST   /api/user-accounts          # Tạo tài khoản
PUT    /api/user-accounts/:id      # Sửa tài khoản
DELETE /api/user-accounts/:id      # Xóa tài khoản

GET    /api/roles                  # Danh sách Role
POST   /api/roles                  # Tạo Role
PUT    /api/roles/:id              # Sửa Role
DELETE /api/roles/:id              # Xóa Role

GET    /api/departments            # Danh sách phòng ban
POST   /api/departments            # Tạo phòng ban
PUT    /api/departments/:id        # Sửa phòng ban
DELETE /api/departments/:id        # Xóa phòng ban

# Quản lý sản phẩm (CRUD đầy đủ)
GET    /api/categories             # Danh mục
POST   /api/categories             # Tạo danh mục
PUT    /api/categories/:id         # Sửa danh mục
DELETE /api/categories/:id         # Xóa danh mục

GET    /api/products               # Sản phẩm
POST   /api/products               # Tạo sản phẩm
PUT    /api/products/:id           # Sửa sản phẩm
DELETE /api/products/:id           # Xóa sản phẩm

# Quản lý nhà cung cấp (CRUD đầy đủ)
GET    /api/suppliers              # Nhà cung cấp
POST   /api/suppliers              # Tạo Supplier
PUT    /api/suppliers/:id          # Sửa Supplier
DELETE /api/suppliers/:id          # Xóa Supplier

# Quản lý kho hàng (CRUD đầy đủ)
GET    /api/purchase-orders        # Đơn đặt hàng
POST   /api/purchase-orders        # Tạo PO
PUT    /api/purchase-orders/:id    # Sửa PO
DELETE /api/purchase-orders/:id    # Xóa PO

GET    /api/inventories            # Tồn kho
POST   /api/inventories            # Tạo Inventory
PUT    /api/inventories/:id        # Sửa Inventory
DELETE /api/inventories/:id        # Xóa Inventory

# Quản lý đơn hàng
GET    /api/orders                 # Tất cả đơn
GET    /api/payments               # Tất cả thanh toán

# Báo cáo tổng hợp
GET    /api/reports/dashboard      # Dashboard tổng
GET    /api/reports/finance        # Báo cáo tài chính
GET    /api/reports/inventory      # Báo cáo tồn kho
GET    /api/reports/sales          # Báo cáo doanh thu
GET    /api/reports/suppliers      # Báo cáo nhà cung cấp
```

---

## Ghi chú triển khai

### Ưu tiên
1. **Phase 1 - Auth cơ bản:**
   - Bổ sung fields PIN vào `Employee` model
   - Tạo `controllers/pos.js` với login/logout/change-pin
   - Middleware kiểm tra token POS vs Admin

2. **Phase 2 - Phân quyền:**
   - Cập nhật `Role` model với `canAccessAdmin`, `canAccessPOS`
   - Setup roles: Admin, Manager, Sales (script)
   - Middleware phân quyền theo role

3. **Phase 3 - Use cases nghiệp vụ:**
   - Hoàn thiện POS flows (order, payment, customer)
   - Manager approval flows
   - Admin management screens

### Bảo mật
- **Sales PIN: CHỈ PIN (4-6 số), PHẢI DUY NHẤT**
  - Hết hạn 90 ngày
  - Khóa sau 5 lần sai
  - Kiểm tra unique khi tạo/đổi PIN
- Token POS: Expires 8h, refresh không tự động
- Token Admin: Expires 7 ngày, có thể thu hồi
- Rate limiting: 5 login attempts / 15 phút / IP
- Audit log: Ghi lại mọi hành động nhạy cảm

---

**Kết luận:**
Thiết kế trên đảm bảo:
- ✅ Khách hàng tương tác qua Sales, không cần đăng nhập
- ✅ Sales chỉ dùng POS, không truy cập Admin
- ✅ Manager quản lý cửa hàng qua Admin Dashboard, có thể hỗ trợ POS
- ✅ Admin toàn quyền hệ thống qua Admin Dashboard
- ✅ Tách biệt rõ ràng quyền hạn, bảo mật cao
