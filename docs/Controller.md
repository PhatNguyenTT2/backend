# Backend API - UIT Project

## 📚 Tài Liệu Quan Trọng

- [API Design Principles](./API_DESIGN_PRINCIPLES.md) - Nguyên tắc thiết kế RESTful API
- [Employee List Test Guide](./EMPLOYEE_LIST_TEST_GUIDE.md) - Hướng dẫn test chức năng Employee
- [Database Schema](./database-schema.dbml) - Cấu trúc database

---

## 🏗️ Cấu Trúc Project

```
backend/
├── models/          # Mongoose models với các methods và statics
├── controllers/     # RESTful API controllers (tối giản)
├── utils/           # Utilities (auth, config, middleware, logger)
├── scripts/         # Setup scripts
└── admin/           # Frontend admin dashboard
```

---

## 📋 Nguyên Tắc Thiết Kế Controller

### ✅ **Controller Tối Giản - Minimal Controller Approach**

**Nguyên tắc:** Chỉ tạo 5 endpoints CRUD cơ bản. Custom endpoints chỉ thêm khi có yêu cầu thực tế từ frontend.

### Cấu Trúc Controller Chuẩn (CHỈ CRUD)

```javascript
// CRUD cơ bản - CHỈ CÓ 5 ENDPOINTS NÀY
exports.getAll = async (req, res) => { }      // GET /resource
exports.getById = async (req, res) => { }     // GET /resource/:id
exports.create = async (req, res) => { }      // POST /resource
exports.update = async (req, res) => { }      // PUT /resource/:id
exports.delete = async (req, res) => { }      // DELETE /resource/:id
```

**LƯU Ý:** 
- ❌ **KHÔNG** tạo custom endpoints từ đầu
- ✅ **CHỈ** thêm custom endpoints khi frontend yêu cầu cụ thể
- ✅ Sử dụng **query parameters** để filtering thay vì tạo endpoints mới

### Lý Do

1. **YAGNI Principle** (You Aren't Gonna Need It)
   - Chỉ implement những gì thực sự cần
   - Tránh code bloat và phức tạp không cần thiết

2. **Maintainability**
   - Code ít hơn = dễ maintain hơn
   - Giảm surface area cho bugs
   - Dễ đọc và hiểu

3. **Performance**
   - Ít endpoints = ít routes để resolve
   - Giảm memory footprint
   - Faster routing

4. **Security**
   - Ít endpoints = ít attack vectors
   - Dễ kiểm soát authorization
   - Dễ audit

### Ví Dụ: User Accounts Controller

```javascript
// ✅ ĐÚNG - Chỉ CRUD cơ bản
exports.getAll = async (req, res) => {
  // Sử dụng query parameters cho filtering
  const { isActive, search, role } = req.query
  const filter = {}
  
  if (isActive !== undefined) filter.isActive = isActive === 'true'
  if (role) filter.role = role
  if (search) {
    filter.$or = [
      { username: new RegExp(search, 'i') },
      { email: new RegExp(search, 'i') }
    ]
  }
  
  const users = await UserAccount.find(filter)
    .populate('role', 'roleName permissions')
  res.json({ success: true, data: users })
}

exports.getById = async (req, res) => {
  const user = await UserAccount.findById(req.params.id)
    .populate('role', 'roleName permissions')
  res.json({ success: true, data: user })
}

exports.create = async (req, res) => {
  // Create logic
}

exports.update = async (req, res) => {
  // Update logic (bao gồm cả activate/deactivate qua field isActive)
}

exports.delete = async (req, res) => {
  // Soft delete logic
}

// ❌ KHÔNG TẠO các custom endpoints như:
// - exports.getStatistics() → Tạo sau khi frontend yêu cầu
// - exports.activate() → Dùng update với isActive: true
// - exports.deactivate() → Dùng update với isActive: false
// - exports.findByUsernameOrEmail() → Dùng internal, không cần endpoint
```

---

## 🔄 Workflow: Model → Controller

### Model Methods Classification

Khi có một model với nhiều methods, phân loại chúng:

1. **Instance Methods** (trên document cụ thể)
   - `user.generateAuthToken()` → Internal use only
   - `user.updateLastLogin()` → Internal use only
   - `user.deactivate()` → Xử lý qua `update` endpoint với isActive: false
   - `user.activate()` → Xử lý qua `update` endpoint với isActive: true

2. **Static Methods** (trên Model class)
   - `UserAccount.findActiveUsers()` → Dùng trong `getAll` controller
   - `UserAccount.getStatistics()` → **KHÔNG TẠO**, đợi frontend yêu cầu
   - `UserAccount.findByUsernameOrEmail()` → Internal use only (login)

3. **Query Helpers**
   - Không cần endpoint riêng
   - Dùng thông qua query parameters trong getAll

### Decision Flow

```
┌─────────────────────────────────┐
│  Có method trong model?         │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│  Có thể xử lý bằng 5 CRUD?      │
└────────────┬────────────────────┘
             │
         ┌───┴───┐
         │  YES  │  → DÙNG CRUD endpoint (getAll/getById/create/update/delete)
         └───┬───┘
             │
             ▼
┌─────────────────────────────────┐
│  KHÔNG TẠO custom endpoint      │
│  Đợi frontend yêu cầu           │
└─────────────────────────────────┘
```

**Quy tắc vàng:** 
- Bắt đầu với **CHỈ 5 CRUD endpoints**
- Custom endpoints → **ĐỢI frontend yêu cầu**
- Methods trong model → **Dùng internal** hoặc **qua CRUD**

---

## 🎯 Best Practices

### 1. Start with ONLY 5 CRUD Endpoints
```javascript
// CHỈ CÓ 5 endpoints này - KHÔNG THÊM GÌ KHÁC
router.get('/', controller.getAll)           // GET /resource
router.get('/:id', controller.getById)       // GET /resource/:id
router.post('/', controller.create)          // POST /resource
router.put('/:id', controller.update)        // PUT /resource/:id
router.delete('/:id', controller.delete)     // DELETE /resource/:id
```

### 2. Use Query Parameters for Everything
```javascript
// Thay vì tạo nhiều endpoints, dùng query params
// GET /users?isActive=true
// GET /users?role=admin
// GET /users?search=john
exports.getAll = async (req, res) => {
  const { isActive, role, search } = req.query
  const filter = {}
  
  if (isActive !== undefined) filter.isActive = isActive
  if (role) filter.role = role
  if (search) {
    filter.$or = [
      { username: new RegExp(search, 'i') },
      { email: new RegExp(search, 'i') }
    ]
  }
  
  const users = await UserAccount.find(filter)
  res.json({ success: true, data: users })
}
```

### 3. Document Why Methods Are Not Endpoints
```javascript
/**
 * Methods NOT implemented as endpoints:
 * 
 * 1. generateAuthToken() - Internal use only, handled by auth middleware
 * 2. removeToken() - Internal use only, handled by logout endpoint in auth
 * 3. deactivate() - Use PUT /users/:id with { isActive: false }
 * 4. activate() - Use PUT /users/:id with { isActive: true }
 * 5. findByUsernameOrEmail() - Use GET /users?search=value
 * 6. getStatistics() - CHƯA TẠO, đợi frontend yêu cầu
 */
```

### 4. Only Add Custom Endpoints When Frontend Requests
```javascript
// ❌ ĐỪNG TẠO SẴN
router.get('/stats', controller.getStatistics)
router.post('/:id/activate', controller.activate)

// ✅ ĐỢI frontend dev nói: "Tôi cần endpoint để lấy statistics"
// → Lúc đó mới thêm vào
```

---

## 📦 Response Format Chuẩn

```javascript
// Success
{
  "success": true,
  "data": { ... },
  "message": "Optional success message"
}

// Error
{
  "success": false,
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE",
    "details": { ... }  // Optional
  }
}

// List with pagination
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "pages": 5
  }
}
```

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Setup Environment
```bash
cp .env.example .env
# Configure your environment variables
```

### 3. Setup Database
```bash
node scripts/setup-roles.js
node scripts/setup-departments.js
```

### 4. Run Development Server
```bash
npm run dev
```

---

## 📖 Related Documents

- **API Design:** [API_DESIGN_PRINCIPLES.md](./API_DESIGN_PRINCIPLES.md)
- **Testing:** [EMPLOYEE_LIST_TEST_GUIDE.md](./EMPLOYEE_LIST_TEST_GUIDE.md)

---

**Last Updated:** November 4, 2025
