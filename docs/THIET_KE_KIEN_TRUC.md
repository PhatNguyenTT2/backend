# 3.1. Thiết Kế Kiến Trúc Hệ Thống

## Tổng Quan

Hệ thống Quản Lý Kho Hàng (Inventory Management System) được xây dựng theo mô hình **Client - Server** sử dụng công nghệ Web hiện đại:

- **Frontend**: React 19 + Vite (SPA - Single Page Application)
- **Backend**: Node.js + Express.js (RESTful API)
- **Database**: MongoDB (NoSQL Database)
- **Mô hình tổ chức**: RESTful API, kiến trúc nhiều lớp (Multi-layered Architecture)

---

## Sơ Đồ Kiến Trúc Tổng Thể

```
┌─────────────────────────────────────────────────────────────┐
│                     CLIENT LAYER                            │
│  ┌───────────────────────────────────────────────────────┐  │
│  │         React Application (SPA)                       │  │
│  │  - React Router DOM (Navigation)                      │  │
│  │  - Axios (HTTP Client)                                │  │
│  │  - Recharts (Data Visualization)                      │  │
│  │  - Tailwind CSS (UI Styling)                          │  │
│  │  - Lucide React (Icons)                               │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↕ HTTPS/REST API
┌─────────────────────────────────────────────────────────────┐
│                     SERVER LAYER                            │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Express.js Application                   │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │         MIDDLEWARE LAYER                        │  │  │
│  │  │  - CORS Handler                                 │  │  │
│  │  │  - JWT Authentication                           │  │  │
│  │  │  - Request Logger (Morgan)                      │  │  │
│  │  │  - Error Handler                                │  │  │
│  │  │  - Request Validator                            │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  │                                                         │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │         CONTROLLER LAYER (Routes)               │  │  │
│  │  │  - Products Controller                          │  │  │
│  │  │  - Orders Controller                            │  │  │
│  │  │  - Customers Controller                         │  │  │
│  │  │  - Suppliers Controller                         │  │  │
│  │  │  - Inventory Controller                         │  │  │
│  │  │  - User Accounts Controller                     │  │  │
│  │  │  - Employees Controller                         │  │  │
│  │  │  - Payments Controller                          │  │  │
│  │  │  - Purchase Orders Controller                   │  │  │
│  │  │  - Stock Out Orders Controller                  │  │  │
│  │  │  - ... (21 controllers total)                   │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  │                                                         │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │         MODEL LAYER (Business Logic)            │  │  │
│  │  │  - Mongoose Schemas & Models                    │  │  │
│  │  │  - Data Validation Rules                        │  │  │
│  │  │  - Business Logic Methods                       │  │  │
│  │  │  - Virtual Fields & Hooks                       │  │  │
│  │  │  - 21 Domain Models                             │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  │                                                         │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │         UTILITY LAYER                           │  │  │
│  │  │  - Authentication Utils (JWT, bcrypt)           │  │  │
│  │  │  - Configuration Management                     │  │  │
│  │  │  - Logger (Winston)                             │  │  │
│  │  │  - Middleware Helpers                           │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↕ MongoDB Driver
┌─────────────────────────────────────────────────────────────┐
│                   DATABASE LAYER                            │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              MongoDB Database                         │  │
│  │  - Collections (21 entities)                         │  │
│  │  - Indexes                                            │  │
│  │  - Aggregation Pipelines                             │  │
│  │  - Transaction Support                               │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Các Tầng Chính (Layers)

### 1. **Presentation Layer** - Giao diện người dùng

**Công nghệ**: React 19 + Vite (Single Page Application)

**Thành phần**:
- **Pages (Trang chính)**:
  - Dashboard (Tổng quan)
  - Products (Quản lý sản phẩm)
  - Categories (Danh mục)
  - Customers (Khách hàng)
  - Suppliers (Nhà cung cấp)
  - Orders (Đơn hàng)
  - Purchase Orders (Đơn mua hàng)
  - Inventories (Kho hàng)
  - Payments (Thanh toán)
  - Users (Quản lý người dùng)
  - Reports (Báo cáo)
  - Login/Signup (Đăng nhập/Đăng ký)

- **Components (Thành phần tái sử dụng)**:
  - Layout (Header, Footer, Sidebar)
  - ProductList, ProductDetail
  - CustomerList, SupplierList
  - OrderList, OrderModals
  - InventoryList, StockModals
  - SalesChart
  - FilterProduct
  - Breadcrumb
  - ProtectedRoute

- **Services (HTTP Client)**:
  - `api.js` - Axios instance với interceptors
  - `authService.js` - Xác thực người dùng
  - `employeeService.js` - Quản lý nhân viên
  - `roleService.js` - Quản lý vai trò
  - `userAccountService.js` - Quản lý tài khoản

- **Utils**:
  - Product routing helpers
  - Detail description templates

**Tính năng**:
- Single Page Application (SPA) với React Router DOM
- State management với React Hooks
- Protected routes với JWT authentication
- Responsive design với Tailwind CSS
- Data visualization với Recharts
- Form validation và error handling

---

### 2. **API Layer** - RESTful API Endpoints

**Công nghệ**: Express.js Framework

**Đặc điểm**:
- RESTful API design principles
- Resource-based routing
- Standard HTTP methods (GET, POST, PUT, PATCH, DELETE)
- JSON response format
- JWT-based authentication
- CORS enabled

**API Endpoints** (27 resource endpoints):

```
/api/products              - Quản lý sản phẩm
/api/categories            - Danh mục sản phẩm
/api/customers             - Khách hàng
/api/suppliers             - Nhà cung cấp
/api/orders                - Đơn hàng bán
/api/order-details         - Chi tiết đơn hàng
/api/purchase-orders       - Đơn mua hàng
/api/stock-out-orders      - Phiếu xuất kho
/api/inventories           - Tồn kho
/api/inventory-movements   - Biến động kho
/api/product-batches       - Lô hàng
/api/payments              - Thanh toán
/api/employees             - Nhân viên
/api/user-accounts         - Tài khoản người dùng
/api/roles                 - Vai trò/Quyền hạn
/api/departments           - Phòng ban
/api/detail-customers      - Thông tin chi tiết KH
/api/detail-products       - Thông tin chi tiết SP
/api/detail-suppliers      - Thông tin chi tiết NCC
/api/detail-purchase-orders - Chi tiết đơn mua hàng
/api/detail-stock-out-orders - Chi tiết phiếu xuất kho
```

**Middleware Stack**:
1. CORS Handler
2. Static File Serving (`dist/`)
3. JSON Body Parser
4. Request Logger (Morgan)
5. JWT Authentication
6. Error Handler
7. Unknown Endpoint Handler

---

### 3. **Business Logic Layer** - Xử lý nghiệp vụ

**Công nghệ**: Node.js + Express Controllers

**Thành phần**: 27 Controllers

Mỗi controller chịu trách nhiệm:
- Xử lý HTTP requests
- Validate input data
- Gọi Model layer để thao tác dữ liệu
- Xử lý business rules
- Format response data
- Error handling

**Ví dụ cấu trúc Controller**:
```javascript
// controllers/products.js
const productsRouter = require('express').Router()
const Product = require('../models/product')
const middleware = require('../utils/middleware')

// GET all products
productsRouter.get('/', async (request, response) => {
  // Business logic
})

// POST new product
productsRouter.post('/', middleware.userExtractor, async (request, response) => {
  // Authentication required
  // Validation
  // Business logic
})
```

**Business Rules**:
- Mã tự động (Auto-generated codes):
  - `PROD2025000001` (Products)
  - `CUST2025000001` (Customers)
  - `USER2025000001` (User Accounts)
  - `ORD2025000001` (Orders)
  - `PO2025000001` (Purchase Orders)
  
- Tính toán tự động:
  - Tổng tiền đơn hàng
  - Tồn kho (available quantity)
  - Trạng thái thanh toán
  - Lợi nhuận

- Validation rules:
  - Email format
  - Phone number format
  - Quantity > 0
  - Price >= 0
  - Required fields

---

### 4. **Data Access Layer** - Tương tác cơ sở dữ liệu

**Công nghệ**: Mongoose ODM (Object Data Modeling)

**Thành phần**: 21 Mongoose Models

Mỗi model định nghĩa:
- Schema structure
- Data types
- Validation rules
- Indexes
- Virtual fields
- Instance methods
- Static methods
- Hooks (pre/post middleware)

**Domain Models**:

**User Management**:
- `UserAccount` - Tài khoản đăng nhập
- `Employee` - Nhân viên
- `Role` - Vai trò/Quyền hạn
- `Department` - Phòng ban

**Product Management**:
- `Product` - Sản phẩm
- `Category` - Danh mục
- `DetailProduct` - Thông tin chi tiết sản phẩm

**Inventory Management**:
- `Inventory` - Tồn kho
- `InventoryMovement` - Biến động kho
- `ProductBatch` - Lô hàng
- `PurchaseOrder` - Đơn mua hàng
- `DetailPurchaseOrder` - Chi tiết đơn mua
- `StockOutOrder` - Phiếu xuất kho
- `DetailStockOutOrder` - Chi tiết phiếu xuất

**Sales Management**:
- `Order` - Đơn hàng bán
- `OrderDetail` - Chi tiết đơn hàng
- `Customer` - Khách hàng
- `DetailCustomer` - Thông tin chi tiết KH
- `Payment` - Thanh toán

**Supplier Management**:
- `Supplier` - Nhà cung cấp
- `DetailSupplier` - Thông tin chi tiết NCC

**Ví dụ Model Structure**:
```javascript
// models/product.js
const productSchema = new mongoose.Schema({
  productCode: { type: String, unique: true, required: true },
  name: { type: String, required: true },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  unitPrice: { type: Number, required: true, min: 0 },
  unit: { type: String, default: 'piece' },
  isActive: { type: Boolean, default: true },
  // ... other fields
}, {
  timestamps: true,
  toJSON: { virtuals: true }
})

// Indexes
productSchema.index({ productCode: 1 })
productSchema.index({ category: 1 })
productSchema.index({ isActive: 1 })

// Virtual populate
productSchema.virtual('inventory', {
  ref: 'Inventory',
  localField: '_id',
  foreignField: 'product'
})

module.exports = mongoose.model('Product', productSchema)
```

---

### 5. **Database Layer** - Lưu trữ dữ liệu

**Công nghệ**: MongoDB (NoSQL Database)

**Đặc điểm**:
- Document-oriented database
- Flexible schema
- High performance
- Horizontal scalability
- ACID transactions support
- Rich query language
- Aggregation framework

**Database Structure**:
- **21 Collections** tương ứng với 21 domain models
- **Indexes** cho performance optimization
- **References** (ObjectId) thay vì embedding
- **Timestamps** (createdAt, updatedAt) tự động

**Quan hệ giữa các Collections**:
```
UserAccount ──→ Role (Many-to-One)
UserAccount ──→ Employee (One-to-One)
Employee ──→ Department (Many-to-One)

Product ──→ Category (Many-to-One)
Product ──→ DetailProduct (One-to-One)
Product ──→ Inventory (One-to-One)

Order ──→ Customer (Many-to-One)
Order ──→ OrderDetail (One-to-Many)
OrderDetail ──→ Product (Many-to-One)
OrderDetail ──→ ProductBatch (Many-to-One)

PurchaseOrder ──→ Supplier (Many-to-One)
PurchaseOrder ──→ DetailPurchaseOrder (One-to-Many)
DetailPurchaseOrder ──→ Product (Many-to-One)

Inventory ──→ Product (One-to-One)
InventoryMovement ──→ Product (Many-to-One)
ProductBatch ──→ Product (Many-to-One)
```

**Chiến lược Indexing**:
- Unique indexes: `productCode`, `customerCode`, `username`, `email`
- Compound indexes cho queries phức tạp
- Index cho foreign keys (ObjectId references)
- Index cho trạng thái (`isActive`, `status`)

---

## Utility Layer - Tiện ích hỗ trợ

**Thành phần**:

1. **Authentication & Authorization** (`utils/auth.js`):
   - JWT token generation
   - Password hashing với bcrypt
   - Token verification
   - User extraction middleware

2. **Configuration** (`utils/config.js`):
   - Environment variables
   - MongoDB connection string
   - JWT secret
   - Port configuration

3. **Logger** (`utils/logger.js`):
   - Request/Response logging
   - Error logging
   - Info logging
   - Development vs Production modes

4. **Middleware** (`utils/middleware.js`):
   - Request logger
   - Error handler
   - Unknown endpoint handler
   - User extractor (JWT verification)
   - Token extractor

---

## Luồng Dữ Liệu (Data Flow)

### Luồng Request (Ví dụ: Tạo đơn hàng mới)

```
1. CLIENT LAYER
   User clicks "Tạo đơn hàng" button
   ↓
   React Component gọi API service
   ↓
   axios.post('/api/orders', orderData, { headers: { Authorization: token } })
   ↓

2. API LAYER
   Express receives HTTP POST /api/orders
   ↓
   Middleware Stack:
   - CORS check ✓
   - JSON body parser ✓
   - Request logger ✓
   - JWT verification ✓
   ↓

3. BUSINESS LOGIC LAYER
   Orders Controller (controllers/orders.js)
   - Validate input data
   - Check customer exists
   - Check product availability
   - Calculate total amount
   ↓

4. DATA ACCESS LAYER
   Order Model (models/order.js)
   - Create new Order document
   - Create OrderDetail documents
   - Update Inventory quantities
   - Create InventoryMovement records
   ↓

5. DATABASE LAYER
   MongoDB
   - Insert into orders collection
   - Insert into orderDetails collection
   - Update inventories collection
   - Insert into inventoryMovements collection
   - Transaction commit
   ↓

6. Response Flow (ngược lại)
   Database → Model → Controller → Express → Client
   
   Success response:
   {
     "success": true,
     "data": {
       "order": { ...orderData }
     }
   }
```

---

## Security Architecture

### 1. **Authentication**
- JWT (JSON Web Tokens)
- Token stored in localStorage/sessionStorage
- Token sent in Authorization header
- Token expiration handling

### 2. **Password Security**
- bcrypt hashing (salt rounds: 10)
- Password validation rules
- No plain text storage

### 3. **API Security**
- CORS configuration
- Rate limiting (optional)
- Input validation
- SQL injection prevention (MongoDB parameterized queries)
- XSS prevention

### 4. **Authorization**
- Role-based access control (RBAC)
- Protected routes
- User permissions check
- Resource ownership verification

---

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    PRODUCTION                           │
│                                                         │
│  ┌─────────────────┐         ┌────────────────────┐   │
│  │   Web Server    │         │   Application      │   │
│  │   (Nginx)       │────────→│   Server           │   │
│  │   - SSL/TLS     │         │   (Node.js/PM2)    │   │
│  │   - Static      │         │   - Backend API    │   │
│  │   - Proxy       │         │   - Express.js     │   │
│  └─────────────────┘         └────────────────────┘   │
│                                        │               │
│                                        ↓               │
│                              ┌────────────────────┐   │
│                              │   Database         │   │
│                              │   MongoDB          │   │
│                              │   - Replica Set    │   │
│                              └────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

**Deployment Strategy**:
1. Build React app: `npm run build` (in `/admin`)
2. Copy dist to backend: `npm run build:ui`
3. Express serves static files from `/dist`
4. Deploy to hosting (Heroku, AWS, DigitalOcean, etc.)
5. MongoDB hosted on MongoDB Atlas or self-hosted

---

## Development Tools & Scripts

**Backend Scripts** (`package.json`):
```json
{
  "start": "node index.js",              // Production
  "dev": "node --watch index.js",        // Development with hot reload
  "setup:roles": "Setup default roles",
  "setup:departments": "Setup departments",
  "seed:admin": "Create admin account",
  "seed:products": "Seed product data",
  "seed:customers": "Seed customer data",
  "lint": "ESLint code quality check"
}
```

**Frontend Scripts** (`admin/package.json`):
```json
{
  "dev": "vite",                         // Development server
  "build": "vite build",                 // Production build
  "preview": "vite preview",             // Preview build
  "lint": "eslint ."                     // Code quality
}
```

---

## Technology Stack Summary

| Layer | Technology | Version |
|-------|-----------|---------|
| **Frontend** | React | 19.1.1 |
| | Vite | 7.1.12 |
| | React Router DOM | 7.9.3 |
| | Axios | 1.12.2 |
| | Tailwind CSS | 4.1.13 |
| | Recharts | 3.2.1 |
| **Backend** | Node.js | Latest LTS |
| | Express.js | 5.1.0 |
| | Mongoose | 8.18.3 |
| | JWT | 9.0.2 |
| | bcrypt | 5.1.1 |
| | Morgan | 1.10.1 |
| **Database** | MongoDB | 6.20.0+ |
| **Dev Tools** | ESLint | 9.22.0 |
| | Vite | 7.1.12 |
| | dotenv | 17.2.3 |

---

## Design Principles

Dự án tuân theo các nguyên tắc thiết kế sau:

### 1. **RESTful API Design**
- Resource-based URLs
- Standard HTTP methods
- Stateless communication
- JSON data format
- Proper HTTP status codes

Chi tiết xem: [API_DESIGN_PRINCIPLES.md](./API_DESIGN_PRINCIPLES.md)

### 2. **Separation of Concerns**
- Tách biệt UI, Business Logic, và Data Access
- Mỗi layer có trách nhiệm riêng biệt
- Loose coupling, high cohesion

### 3. **DRY (Don't Repeat Yourself)**
- Reusable components (React)
- Shared middleware (Express)
- Common utilities
- Schema virtuals (Mongoose)

### 4. **Single Responsibility Principle**
- Mỗi controller xử lý một resource
- Mỗi model quản lý một entity
- Mỗi component có một mục đích

### 5. **Resource Reference Over Embedding**
- Sử dụng ObjectId references
- Không populate toàn bộ dữ liệu
- Client tự fetch related resources khi cần

---

## Scalability Considerations

### Horizontal Scaling
- Stateless API design
- JWT tokens (no server-side sessions)
- MongoDB sharding support
- Load balancing ready

### Performance Optimization
- Database indexing
- Query optimization
- Lazy loading (frontend)
- Response caching (optional)
- Image optimization
- Code splitting (Vite)

### Monitoring & Logging
- Request logging (Morgan)
- Error tracking
- Performance metrics
- Database query monitoring

---

## Kết Luận

Hệ thống được thiết kế theo kiến trúc **Multi-layered Architecture** với các lớp rõ ràng, độc lập và dễ bảo trì. Sử dụng công nghệ hiện đại (**React, Node.js, MongoDB**) đảm bảo hiệu suất cao và khả năng mở rộng tốt. Thiết kế RESTful API chuẩn giúp frontend và backend tách biệt hoàn toàn, dễ dàng phát triển song song và tích hợp với các hệ thống khác.
