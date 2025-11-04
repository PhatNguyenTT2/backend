# Phân Quyền Admin Dashboard vs POS System

## 📋 Mục lục
1. [Thực tế tại các chuỗi cửa hàng lớn](#1-thực-tế-tại-các-chuỗi-cửa-hàng-lớn)
2. [Mô hình phân quyền (Best Practice)](#2-mô-hình-phân-quyền-best-practice)
3. [Case Study: Starbucks](#3-case-study-starbucks)
4. [Giải pháp cho project](#4-giải-pháp-cho-project)
5. [Implementation chi tiết](#5-implementation-chi-tiết)
6. [Trường hợp đặc biệt](#6-trường-hợp-đặc-biệt)

---

## 1. Thực tế tại các chuỗi cửa hàng lớn

### Starbucks, McDonald's, 7-Eleven

```
┌─────────────────────────────────────────────────────────┐
│         PHÂN CẤP QUYỀN HẠN (HIERARCHY)                  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  👔 ADMIN DASHBOARD                                     │
│  ├─ Store Manager (Quản lý cửa hàng)     ✅ Full access│
│  ├─ Assistant Manager                    ✅ Limited    │
│  └─ Head Office / Regional Manager       ✅ Full access│
│                                                         │
│  💰 POS SYSTEM                                          │
│  ├─ Cashier/Barista (Thu ngân)          ❌ NO admin   │
│  ├─ Sales Staff                          ❌ NO admin   │
│  └─ Shift Supervisor                     ⚠️  View only │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### ❌ **Trả lời: Sales KHÔNG có quyền Admin Dashboard**

**Lý do:**
1. ❌ **Không cần thiết** cho công việc hàng ngày
2. ❌ **Rủi ro bảo mật cao** (thay đổi giá, xóa đơn hàng, xem doanh thu)
3. ❌ **Quá nhiều tính năng** gây confusion, chậm trễ
4. ❌ **Audit trail phức tạp** - khó tracking khi nhiều người có quyền admin
5. ✅ **Chỉ cần POS** để thực hiện công việc bán hàng

---

## 2. Mô hình phân quyền (Best Practice)

### A. Phân quyền theo vai trò

```javascript
const ROLES_HIERARCHY = {
  
  // ═══════════════════════════════════════════════════════
  // 👔 ADMIN ROLES - Có quyền Admin Dashboard
  // ═══════════════════════════════════════════════════════
  
  ADMIN: {
    name: 'System Administrator',
    level: 5,
    canAccessAdmin: true,       // ✅ Full admin access
    canAccessPOS: false,        // ❌ Không cần POS
    permissions: ['*'],         // All permissions
    description: 'Head office, IT team'
  },
  
  STORE_MANAGER: {
    name: 'Store Manager',
    level: 4,
    canAccessAdmin: true,       // ✅ Full admin access
    canAccessPOS: true,         // ✅ Có thể bán hàng khi cần
    permissions: [
      'view_all_reports',
      'manage_staff',
      'manage_inventory',
      'manage_promotions',
      'approve_refunds',
      'end_of_day_closing',
      'manage_suppliers',
      'manage_purchase_orders',
      'view_financial_reports'
    ],
    description: 'Quản lý toàn bộ cửa hàng'
  },
  
  ASSISTANT_MANAGER: {
    name: 'Assistant Manager',
    level: 3,
    canAccessAdmin: true,       // ✅ Limited admin access
    canAccessPOS: true,
    permissions: [
      'view_sales_reports',
      'manage_inventory',
      'approve_refunds_under_500k',
      'view_staff_performance'
    ],
    description: 'Trợ lý quản lý, thay thế manager khi cần'
  },
  
  // ═══════════════════════════════════════════════════════
  // 💰 SALES ROLES - CHỈ POS, KHÔNG Admin Dashboard
  // ═══════════════════════════════════════════════════════
  
  SHIFT_SUPERVISOR: {
    name: 'Shift Supervisor',
    level: 2,
    canAccessAdmin: 'view_only', // ⚠️ Chỉ xem report (optional)
    canAccessPOS: true,
    permissions: [
      'view_shift_reports',      // Chỉ xem báo cáo ca mình
      'approve_refunds_under_300k',
      'manage_shift_staff',
      'override_discounts_under_10percent'
    ],
    description: 'Giám sát ca làm việc'
  },
  
  SALES_STAFF: {
    name: 'Sales Staff',
    level: 1,
    canAccessAdmin: false,      // ❌ NO admin access
    canAccessPOS: true,         // ✅ Chỉ POS
    permissions: [
      'create_order',
      'process_payment',
      'view_products',
      'apply_standard_discounts',
      'view_my_sales'            // Chỉ xem doanh số của mình
    ],
    description: 'Nhân viên bán hàng'
  },
  
  CASHIER: {
    name: 'Cashier',
    level: 1,
    canAccessAdmin: false,      // ❌ NO admin access
    canAccessPOS: true,
    permissions: [
      'create_order',
      'process_payment',
      'basic_refund_under_100k'
    ],
    description: 'Thu ngân'
  }
}
```

### B. Bảng so sánh quyền truy cập

| Vai trò | Level | Admin Dashboard | POS System | Số lượng/cửa hàng | Mức lương (VND/tháng) |
|---------|-------|-----------------|------------|-------------------|-----------------------|
| **System Admin** | 5 | ✅ Full | ❌ No | 1-2 (toàn hệ thống) | 20-30M |
| **Store Manager** | 4 | ✅ Full | ✅ Yes | 1 | 15-25M |
| **Assistant Manager** | 3 | ✅ Limited | ✅ Yes | 1-2 | 10-15M |
| **Shift Supervisor** | 2 | ⚠️ View only | ✅ Yes | 2-3 | 8-12M |
| **Sales Staff** | 1 | ❌ **NO** | ✅ **YES** | 5-10 | 5-8M |
| **Cashier** | 1 | ❌ **NO** | ✅ **YES** | 3-5 | 5-7M |

---

## 3. Case Study: Starbucks

### Cấu trúc nhân sự Store #1234 - Nguyễn Huệ, Q1

```
🏪 Starbucks Store #1234
│
├─ 👔 Store Manager: Sarah Nguyen
│  │  Username: sarah.nguyen
│  │  Password: SecurePass123!
│  │  Employee Code: USER2025000001
│  │  PIN: 5678
│  │
│  ├─ Login Admin Dashboard:
│  │  └─ username + password → Laptop/Desktop
│  │     ├─ View all reports
│  │     ├─ Manage 12 staff members
│  │     ├─ Approve refunds
│  │     ├─ Manage inventory
│  │     └─ End of day closing
│  │
│  └─ Login POS (when needed):
│     └─ Employee Code + PIN → Touch screen
│        └─ Help during rush hour
│
├─ 👔 Assistant Manager: John Le
│  │  Username: john.le
│  │  Employee Code: USER2025000002
│  │  PIN: 1357
│  │
│  ├─ Login Admin Dashboard:
│  │  └─ Limited access to reports & inventory
│  │
│  └─ Login POS (primary):
│     └─ Create orders, manage shift
│
├─ ⚠️ Shift Supervisor: Mike Tran
│  │  NO Admin username/password
│  │  Employee Code: USER2025000003
│  │  PIN: 2468
│  │
│  ├─ NO Admin Dashboard access
│  │  (hoặc view-only qua tablet - optional)
│  │
│  └─ Login POS only:
│     ├─ Create orders
│     ├─ Approve refunds < 300k
│     └─ Manage shift team
│
└─ 💰 8 Baristas (Sales Staff)
   │  Alice, Bob, Carol, David, Emma, Frank, Grace, Henry
   │
   ├─ Alice: USER2025000004, PIN: 1111
   ├─ Bob:   USER2025000005, PIN: 2222
   ├─ Carol: USER2025000006, PIN: 3333
   └─ ...
   
   └─ ALL:
      ├─ ❌ NO Admin Dashboard access
      └─ ✅ POS only:
         ├─ Take orders
         ├─ Process payments
         └─ View menu/products
```

### Luồng làm việc trong 1 ngày

#### **7:00 AM - Mở cửa hàng**

```
1. Store Manager Sarah arrives:
   ┌─────────────────────────────────────┐
   │ Login Admin Dashboard (Laptop)      │
   │ username: sarah.nguyen              │
   │ password: ••••••••                  │
   └─────────────────────────────────────┘
   
   Tasks:
   ✓ Kiểm tra báo cáo hôm qua
   ✓ Review inventory levels
   ✓ Setup promotions: "Buy 2 Get 1 Free"
   ✓ Assign shifts cho 12 nhân viên
   ✓ Approve purchase orders
   
2. Barista Alice arrives (7:15 AM):
   ┌─────────────────────────────────────┐
   │ Login POS Terminal #1               │
   │ Employee Code: USER2025000004       │
   │ PIN: ••••                           │
   └─────────────────────────────────────┘
   
   ✓ Start taking orders
   ❌ KHÔNG có/KHÔNG cần Admin Dashboard
```

#### **8:00 AM - Giờ cao điểm**

```
3 Baristas working on 3 POS terminals:

POS #1: Alice (PIN: 1111)
  ├─ Order #001: Latte + Croissant → 85,000 VND ✓
  ├─ Order #002: Cappuccino → 70,000 VND ✓
  └─ Order #003: Americano x2 → 110,000 VND ✓

POS #2: Bob (PIN: 2222)
  ├─ Order #004: Frappuccino → 95,000 VND ✓
  └─ Order #005: Espresso + Cake → 105,000 VND ✓

POS #3: Carol (PIN: 3333)
  ├─ Order #006: Cold Brew → 75,000 VND ✓
  └─ Order #007: Flat White → 80,000 VND ✓

👉 Tất cả chỉ có quyền:
   ✅ Create orders
   ✅ Process payments (cash, card, e-wallet)
   ✅ View menu
   ✅ Apply standard discounts (member card)
   ❌ KHÔNG thay đổi giá
   ❌ KHÔNG xóa orders
   ❌ KHÔNG xem báo cáo tổng
```

#### **10:30 AM - Khách hàng yêu cầu refund**

```
Customer: "Cà phê này không đúng vị, tôi muốn đổi"

Barista Alice:
  └─ Check POS permissions:
     ❌ Cannot process refund > 100,000 VND
     ❌ This order is 95,000 VND (under limit but need supervisor approval)

Barista Alice calls: "Mike, I need supervisor override"

Shift Supervisor Mike:
  ┌─────────────────────────────────────┐
  │ Mike login to POS #1                │
  │ Employee Code: USER2025000003       │
  │ PIN: ••••                           │
  └─────────────────────────────────────┘
  
  ✓ Review order #004
  ✓ Approve refund: 95,000 VND
  ✓ Create new order (replacement)
  ✓ Logout

Barista Alice continues working on POS #1
```

#### **3:00 PM - Customer yêu cầu refund lớn**

```
Customer: "Tôi mua nhầm 10 vouchers, muốn hoàn tiền 2,500,000 VND"

Shift Supervisor Mike:
  └─ Check permissions:
     ❌ Cannot approve refund > 300,000 VND
     
Mike calls Store Manager Sarah:
  
Store Manager Sarah:
  └─ Option 1: Login Admin Dashboard
     ├─ Review transaction history
     ├─ Approve refund request
     └─ Process refund

  └─ Option 2: Come to POS
     ├─ Login POS with her PIN
     ├─ Override and approve
     └─ Done
```

#### **10:00 PM - Đóng cửa hàng**

```
Store Manager Sarah:
  ┌─────────────────────────────────────┐
  │ Login Admin Dashboard               │
  └─────────────────────────────────────┘
  
  End of Day Tasks:
  ✓ Lock all POS terminals
  ✓ End-of-day closing report:
    ├─ Total sales: 45,000,000 VND
    ├─ Cash: 15,000,000 VND
    ├─ Card: 20,000,000 VND
    └─ E-wallet: 10,000,000 VND
  ✓ Reconcile cash drawer
  ✓ Print Z-report
  ✓ Review staff performance
  ✓ Schedule tomorrow's shifts
  ✓ Lock safe
```

---

## 4. Giải pháp cho project

### Option 1: Strict Separation (Khuyến nghị) ⭐

```
┌─────────────────────────────────────────────────────┐
│  MANAGERS ONLY (2-3 người)                         │
│  ✅ Username + Password → Admin Dashboard          │
│  ✅ Employee Code + PIN → POS (optional)           │
│  ✅ Full permissions                                │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  SALES STAFF (8-12 người)                          │
│  ❌ NO Admin Dashboard                              │
│  ✅ Employee Code + PIN → POS ONLY                 │
│  ✅ Limited permissions                             │
└─────────────────────────────────────────────────────┘
```

**Ưu điểm:**
- ✅ Bảo mật cao
- ✅ Đơn giản, dễ training
- ✅ Phù hợp với thực tế
- ✅ Audit trail rõ ràng

**Nhược điểm:**
- ⚠️ Sales không thể xem report (giải quyết bằng POS mini-report)

---

### Option 2: Tiered Access (Phức tạp hơn)

```
┌─────────────────────────────────────────────────────┐
│  Level 4-5: Store Manager, Admin                   │
│  ✅ Full Admin Dashboard                            │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  Level 3: Assistant Manager                        │
│  ✅ Limited Admin Dashboard                         │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  Level 2: Shift Supervisor                         │
│  ⚠️ View-only Admin Dashboard (reports only)       │
│  ✅ Full POS access                                 │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  Level 1: Sales Staff, Cashier                     │
│  ❌ NO Admin Dashboard                              │
│  ✅ POS only                                        │
└─────────────────────────────────────────────────────┘
```

---

## 5. Implementation chi tiết

### A. Database Schema

```javascript
// models/role.js
const roleSchema = new mongoose.Schema({
  roleCode: {
    type: String,
    unique: true,
    uppercase: true
  },
  
  roleName: {
    type: String,
    required: true,
    unique: true,
    enum: [
      'Admin',
      'Store Manager',
      'Assistant Manager',
      'Shift Supervisor',
      'Sales Staff',
      'Cashier'
    ]
  },
  
  level: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  
  // ═══════════════════════════════════════
  // ACCESS CONTROL
  // ═══════════════════════════════════════
  
  canAccessAdmin: {
    type: String,  // 'full', 'limited', 'view_only', 'none'
    enum: ['full', 'limited', 'view_only', 'none'],
    default: 'none'
  },
  
  canAccessPOS: {
    type: Boolean,
    default: false
  },
  
  // ═══════════════════════════════════════
  // DETAILED PERMISSIONS
  // ═══════════════════════════════════════
  
  permissions: [{
    type: String,
    enum: [
      // Admin Dashboard Permissions
      'view_all_reports',
      'view_sales_reports',
      'view_financial_reports',
      'view_staff_performance',
      
      'manage_staff',
      'manage_inventory',
      'manage_suppliers',
      'manage_promotions',
      'manage_categories',
      
      'approve_refunds',
      'approve_refunds_under_300k',
      'approve_refunds_under_500k',
      
      'end_of_day_closing',
      'manage_purchase_orders',
      
      // POS Permissions
      'create_order',
      'process_payment',
      'view_products',
      'view_my_sales',
      'apply_standard_discounts',
      'apply_custom_discounts',
      'override_discounts_under_10percent',
      'basic_refund_under_100k'
    ]
  }],
  
  description: String,
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
})

module.exports = mongoose.model('Role', roleSchema)
```

### B. Backend Middleware

```javascript
// utils/auth.js

/**
 * Middleware: Require Admin Dashboard Access
 * Blocks Sales Staff from accessing admin endpoints
 */
const requireAdminAccess = async (request, response, next) => {
  try {
    const user = request.user  // From JWT token
    
    // Populate role
    const userAccount = await UserAccount.findById(user.id)
      .populate('role')
    
    if (!userAccount) {
      return response.status(401).json({
        error: 'User not found'
      })
    }
    
    // Check admin access level
    const { canAccessAdmin } = userAccount.role
    
    if (canAccessAdmin === 'none') {
      return response.status(403).json({
        error: 'Access denied. Admin dashboard is only available for managers.',
        message: 'Please use POS system for your daily tasks.'
      })
    }
    
    // Attach role info to request
    request.role = userAccount.role
    request.adminAccessLevel = canAccessAdmin
    
    next()
    
  } catch (error) {
    response.status(403).json({
      error: 'Forbidden',
      message: error.message
    })
  }
}

/**
 * Middleware: Require Full Admin Access
 * Only Store Manager and above
 */
const requireFullAdminAccess = async (request, response, next) => {
  try {
    await requireAdminAccess(request, response, () => {})
    
    if (request.adminAccessLevel !== 'full') {
      return response.status(403).json({
        error: 'Insufficient permissions. This action requires Store Manager role or above.'
      })
    }
    
    next()
    
  } catch (error) {
    response.status(403).json({ error: 'Forbidden' })
  }
}

/**
 * Middleware: Require POS Access
 */
const requirePOSAccess = async (request, response, next) => {
  try {
    const token = request.headers.authorization?.replace('Bearer ', '')
    
    if (!token) {
      return response.status(401).json({ error: 'Token required' })
    }
    
    // Verify POS token
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    
    if (decoded.type !== 'pos') {
      return response.status(403).json({
        error: 'POS token required'
      })
    }
    
    // Find employee
    const employee = await Employee.findById(decoded.employeeId)
      .populate({
        path: 'userAccount',
        populate: { path: 'role' }
      })
    
    if (!employee) {
      return response.status(404).json({ error: 'Employee not found' })
    }
    
    // Check POS permission
    if (!employee.canAccessPOS || !employee.userAccount.role.canAccessPOS) {
      return response.status(403).json({
        error: 'You do not have permission to access POS system'
      })
    }
    
    // Attach to request
    request.employee = employee
    request.role = employee.userAccount.role
    
    next()
    
  } catch (error) {
    response.status(403).json({
      error: 'Forbidden',
      message: error.message
    })
  }
}

/**
 * Middleware: Check specific permission
 */
const hasPermission = (permission) => {
  return (request, response, next) => {
    const role = request.role
    
    if (!role) {
      return response.status(403).json({
        error: 'Role information not found'
      })
    }
    
    // Check if role has permission
    if (!role.permissions.includes(permission) && !role.permissions.includes('*')) {
      return response.status(403).json({
        error: `Permission denied. Required: ${permission}`,
        yourPermissions: role.permissions
      })
    }
    
    next()
  }
}

module.exports = {
  requireAdminAccess,
  requireFullAdminAccess,
  requirePOSAccess,
  hasPermission
}
```

### C. Apply Middleware to Routes

```javascript
// app.js
const { 
  requireAdminAccess, 
  requireFullAdminAccess,
  requirePOSAccess,
  hasPermission 
} = require('./utils/auth')

// ═══════════════════════════════════════════════════════
// ADMIN ROUTES - Require Admin Access
// ═══════════════════════════════════════════════════════

// View reports (any admin level)
app.use('/api/reports', requireAdminAccess, reportsRouter)

// Manage staff (full admin only)
app.use('/api/employees', requireFullAdminAccess, employeesRouter)

// Manage inventory (limited admin can access)
app.use('/api/inventories', requireAdminAccess, hasPermission('manage_inventory'), inventoriesRouter)

// Manage suppliers (full admin only)
app.use('/api/suppliers', requireFullAdminAccess, suppliersRouter)

// View products (all roles can access)
app.use('/api/products', productsRouter)

// ═══════════════════════════════════════════════════════
// POS ROUTES - Require POS Access
// ═══════════════════════════════════════════════════════

// POS authentication
app.use('/api/pos', posRouter)

// Create orders (POS only)
app.use('/api/orders', requirePOSAccess, ordersRouter)

// Process payments (POS only)
app.use('/api/payments', requirePOSAccess, paymentsRouter)

// ═══════════════════════════════════════════════════════
// USER ACCOUNT ROUTES - Different auth
// ═══════════════════════════════════════════════════════

// Login (no auth required)
app.post('/api/user-accounts/login', userAccountsRouter)

// Manage users (full admin only)
app.use('/api/user-accounts', requireFullAdminAccess, userAccountsRouter)
```

### D. Frontend Route Protection

```jsx
// components/RequireAdminAccess.jsx
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const RequireAdminAccess = ({ children, level = 'any' }) => {
  const { user, loading } = useAuth()
  
  if (loading) {
    return <div>Loading...</div>
  }
  
  if (!user) {
    return <Navigate to="/admin/login" />
  }
  
  // Check admin access
  const canAccessAdmin = user.role?.canAccessAdmin
  
  if (canAccessAdmin === 'none') {
    return (
      <div className="access-denied">
        <h1>Access Denied</h1>
        <p>Admin Dashboard is only available for managers.</p>
        <p>Please use the POS system for your daily tasks.</p>
        <a href="/pos">Go to POS</a>
      </div>
    )
  }
  
  // Check specific level
  if (level === 'full' && canAccessAdmin !== 'full') {
    return (
      <div className="access-denied">
        <h1>Insufficient Permissions</h1>
        <p>This page requires Store Manager role or above.</p>
      </div>
    )
  }
  
  return children
}

export default RequireAdminAccess
```

```jsx
// components/RequirePOSAccess.jsx
import { Navigate } from 'react-router-dom'
import { usePOSAuth } from '../hooks/usePOSAuth'

const RequirePOSAccess = ({ children }) => {
  const { employee, loading } = usePOSAuth()
  
  if (loading) {
    return <div>Loading...</div>
  }
  
  if (!employee) {
    return <Navigate to="/pos/login" />
  }
  
  // Check POS permission
  if (!employee.canAccessPOS) {
    return (
      <div className="access-denied">
        <h1>Access Denied</h1>
        <p>You do not have permission to access POS system.</p>
        <p>Please contact your manager.</p>
      </div>
    )
  }
  
  return children
}

export default RequirePOSAccess
```

```jsx
// App.jsx
import RequireAdminAccess from './components/RequireAdminAccess'
import RequirePOSAccess from './components/RequirePOSAccess'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ═══════════════════════════════════════ */}
        {/* POS ROUTES - Sales Staff              */}
        {/* ═══════════════════════════════════════ */}
        <Route path="/pos/login" element={<PosLogin />} />
        <Route path="/pos/*" element={
          <RequirePOSAccess>
            <POSApp />
          </RequirePOSAccess>
        } />
        
        {/* ═══════════════════════════════════════ */}
        {/* ADMIN ROUTES - Managers Only          */}
        {/* ═══════════════════════════════════════ */}
        <Route path="/admin/login" element={<AdminLogin />} />
        
        {/* Any admin level can access */}
        <Route path="/admin/dashboard" element={
          <RequireAdminAccess>
            <Dashboard />
          </RequireAdminAccess>
        } />
        
        <Route path="/admin/reports" element={
          <RequireAdminAccess>
            <Reports />
          </RequireAdminAccess>
        } />
        
        {/* Only full admin (Store Manager) */}
        <Route path="/admin/staff" element={
          <RequireAdminAccess level="full">
            <StaffManagement />
          </RequireAdminAccess>
        } />
        
        <Route path="/admin/settings" element={
          <RequireAdminAccess level="full">
            <Settings />
          </RequireAdminAccess>
        } />
        
        {/* ═══════════════════════════════════════ */}
        {/* DEFAULT                                */}
        {/* ═══════════════════════════════════════ */}
        <Route path="/" element={<Navigate to="/pos/login" />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
```

---

## 6. Trường hợp đặc biệt

### A. Sales Staff muốn xem doanh số của mình?

**Giải pháp: POS Mini-Report**

Thay vì cho phép truy cập Admin Dashboard, tạo tính năng report ngay trong POS:

```jsx
// POS Menu Structure
POS System
├─ 🛒 Create Order          ✅ All sales staff
├─ 💳 Process Payment       ✅ All sales staff
├─ 📦 View Products         ✅ All sales staff
├─ 📊 My Performance        ✅ NEW - View own stats
│  ├─ Today's Sales
│  │  ├─ Orders: 45
│  │  ├─ Revenue: 12,500,000 VND
│  │  └─ Average order: 277,777 VND
│  │
│  ├─ This Week
│  │  ├─ Orders: 230
│  │  ├─ Revenue: 65,000,000 VND
│  │  └─ Commission: 1,300,000 VND
│  │
│  ├─ Top Products Sold
│  │  ├─ Cappuccino: 89 cups
│  │  ├─ Latte: 67 cups
│  │  └─ Americano: 52 cups
│  │
│  └─ Performance Ranking
│     └─ You are #3 out of 8 staff
│
└─ ⚙️ Settings
   ├─ Change PIN
   └─ Logout
```

**API Endpoint:**

```javascript
// controllers/pos.js

// GET /api/pos/my-performance
posRouter.get('/my-performance', requirePOSAccess, async (request, response) => {
  try {
    const employee = request.employee
    const { period } = request.query  // 'today', 'week', 'month'
    
    // Calculate date range
    const dateRange = getDateRange(period)
    
    // Query orders created by this employee
    const orders = await Order.find({
      createdBy: employee._id,
      orderDate: {
        $gte: dateRange.start,
        $lte: dateRange.end
      },
      status: { $ne: 'cancelled' }
    }).populate('orderDetails')
    
    // Calculate stats
    const stats = {
      totalOrders: orders.length,
      totalRevenue: orders.reduce((sum, order) => sum + order.total, 0),
      averageOrder: orders.length > 0 
        ? orders.reduce((sum, order) => sum + order.total, 0) / orders.length 
        : 0,
      
      // Top products
      topProducts: calculateTopProducts(orders),
      
      // Commission (if applicable)
      commission: calculateCommission(orders, employee.commissionRate)
    }
    
    // ❌ KHÔNG trả về dữ liệu của nhân viên khác
    // ❌ KHÔNG trả về dữ liệu tài chính tổng thể
    
    response.json({
      success: true,
      data: {
        employee: {
          id: employee._id,
          fullName: employee.fullName
        },
        period,
        stats
      }
    })
    
  } catch (error) {
    response.status(500).json({ error: 'Failed to fetch performance data' })
  }
})
```

### B. Shift Supervisor cần approve refund lớn?

**Giải pháp: Escalation System**

```javascript
// POS Flow
Employee tries to refund 500,000 VND:
  
  1. Check permission: 'approve_refunds_under_300k'
     → Cannot approve (too large)
  
  2. POS shows:
     ┌─────────────────────────────────────────┐
     │ ⚠️ Approval Required                    │
     │                                         │
     │ Refund amount: 500,000 VND              │
     │ Your limit: 300,000 VND                 │
     │                                         │
     │ Please request approval from:           │
     │ - Store Manager Sarah                   │
     │ - Assistant Manager John                │
     │                                         │
     │ [Send Notification] [Cancel]            │
     └─────────────────────────────────────────┘
  
  3. Notification sent to manager's phone/email
  
  4. Manager can approve via:
     - Admin Dashboard
     - Mobile app
     - Come to POS and login with their PIN
```

### C. Emergency: Manager không có mặt?

**Giải pháp: Temporary Access Code**

```javascript
// Admin Dashboard (Manager's phone)
Manager receives alert:
  "Refund approval needed: 500,000 VND at Store #1234"

Manager generates temporary code:
  ┌─────────────────────────────────────────┐
  │ Generate Temporary Approval Code        │
  │                                         │
  │ Code: 8 7 3 5 2 9                       │
  │ Valid for: 5 minutes                    │
  │ Max amount: 500,000 VND                 │
  │                                         │
  │ [Send to Store] [Copy]                  │
  └─────────────────────────────────────────┘

Shift Supervisor enters code on POS:
  → Approval granted
  → Refund processed
  → Code expires immediately
```

---

## 7. Setup Script

```javascript
// scripts/setup-roles.js
const mongoose = require('mongoose')
const Role = require('../models/role')

const setupRoles = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI)
    
    const roles = [
      {
        roleCode: 'ADMIN',
        roleName: 'Admin',
        level: 5,
        canAccessAdmin: 'full',
        canAccessPOS: false,
        permissions: ['*'],
        description: 'System administrator'
      },
      {
        roleCode: 'MANAGER',
        roleName: 'Store Manager',
        level: 4,
        canAccessAdmin: 'full',
        canAccessPOS: true,
        permissions: [
          'view_all_reports',
          'view_financial_reports',
          'manage_staff',
          'manage_inventory',
          'manage_suppliers',
          'manage_promotions',
          'approve_refunds',
          'end_of_day_closing',
          'manage_purchase_orders',
          'create_order',
          'process_payment',
          'view_products'
        ],
        description: 'Store manager with full access'
      },
      {
        roleCode: 'ASSTMGR',
        roleName: 'Assistant Manager',
        level: 3,
        canAccessAdmin: 'limited',
        canAccessPOS: true,
        permissions: [
          'view_sales_reports',
          'manage_inventory',
          'approve_refunds_under_500k',
          'create_order',
          'process_payment',
          'view_products'
        ],
        description: 'Assistant manager with limited admin access'
      },
      {
        roleCode: 'SUPERVISOR',
        roleName: 'Shift Supervisor',
        level: 2,
        canAccessAdmin: 'view_only',
        canAccessPOS: true,
        permissions: [
          'view_sales_reports',
          'approve_refunds_under_300k',
          'override_discounts_under_10percent',
          'create_order',
          'process_payment',
          'view_products',
          'view_my_sales'
        ],
        description: 'Shift supervisor with view-only admin access'
      },
      {
        roleCode: 'SALES',
        roleName: 'Sales Staff',
        level: 1,
        canAccessAdmin: 'none',
        canAccessPOS: true,
        permissions: [
          'create_order',
          'process_payment',
          'view_products',
          'apply_standard_discounts',
          'view_my_sales',
          'basic_refund_under_100k'
        ],
        description: 'Sales staff with POS access only'
      },
      {
        roleCode: 'CASHIER',
        roleName: 'Cashier',
        level: 1,
        canAccessAdmin: 'none',
        canAccessPOS: true,
        permissions: [
          'create_order',
          'process_payment',
          'basic_refund_under_100k'
        ],
        description: 'Cashier with POS access only'
      }
    ]
    
    for (const roleData of roles) {
      await Role.findOneAndUpdate(
        { roleCode: roleData.roleCode },
        roleData,
        { upsert: true, new: true }
      )
      console.log(`✓ Role created/updated: ${roleData.roleName}`)
    }
    
    console.log('\n✅ All roles setup completed!')
    
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await mongoose.connection.close()
  }
}

setupRoles()
```

**Run:**
```bash
npm run setup:roles
```

---

## 8. Kết luận

### ✅ Khuyến nghị cho project:

```
┌─────────────────────────────────────────────────────────┐
│  RECOMMENDED APPROACH                                   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  👔 MANAGERS (Store Manager, Assistant Manager)        │
│     ✅ Username/Password → Admin Dashboard             │
│     ✅ Employee PIN → POS (optional)                   │
│                                                         │
│  💰 SALES STAFF (Sales, Cashier)                       │
│     ❌ NO Admin Dashboard access                        │
│     ✅ Employee PIN → POS ONLY                         │
│     ✅ View own performance on POS                     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 📊 Lợi ích:

1. **Bảo mật** ✅
   - Giảm rủi ro thay đổi giá, xóa order
   - Audit trail rõ ràng
   - Dễ tracking hành vi

2. **Đơn giản** ✅
   - Sales chỉ cần học POS
   - Không overwhelm với quá nhiều tính năng
   - Training nhanh hơn

3. **Hiệu suất** ✅
   - Sales focus vào bán hàng
   - Không lãng phí thời gian với admin tasks
   - Tốc độ phục vụ nhanh hơn

4. **Phù hợp thực tế** ✅
   - Đúng với mô hình Starbucks, McDonald's
   - Phân cấp quyền hạn rõ ràng
   - Dễ scale khi mở nhiều cửa hàng

### 🎯 Next Steps:

1. ✅ Implement Role-based access control
2. ✅ Create POS mini-report for sales staff
3. ✅ Add escalation system for large refunds
4. ✅ Training materials for different roles
5. ✅ Audit logging for all admin actions

---

**Bạn có câu hỏi gì về phân quyền này không?**
