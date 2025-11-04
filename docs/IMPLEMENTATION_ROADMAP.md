# Roadmap Implementation: Sales Staff - POS Only Access

## 📋 Tổng quan

Mục tiêu: Triển khai hệ thống phân quyền rõ ràng:
- ✅ **Managers**: Admin Dashboard + POS
- ✅ **Sales Staff**: POS Only (NO Admin Dashboard)

---

## 🗓️ Timeline: 2-3 tuần

```
Week 1: Database & Backend (5-7 ngày)
├─ Phase 1: Role & Permission System (Day 1-2)
├─ Phase 2: POS PIN Authentication (Day 3-4)
└─ Phase 3: Middleware & Security (Day 5-7)

Week 2: Frontend (5-7 ngày)
├─ Phase 4: POS Interface (Day 8-10)
├─ Phase 5: Admin Dashboard Protection (Day 11-12)
└─ Phase 6: POS Mini-Report (Day 13-14)

Week 3: Testing & Deployment (3-5 ngày)
├─ Phase 7: Testing (Day 15-17)
└─ Phase 8: Training & Rollout (Day 18-21)
```

---

## 📦 PHASE 1: Role & Permission System (Day 1-2)

### ✅ Checklist Phase 1

- [ ] Update Role model với `canAccessAdmin` và `canAccessPOS`
- [ ] Update Employee model với POS PIN fields
- [ ] Create setup script cho roles mặc định
- [ ] Test role creation

---

### Step 1.1: Update Role Model

**File cần sửa: `models/role.js`**

```javascript
const mongoose = require('mongoose')

const roleSchema = new mongoose.Schema({
  roleCode: {
    type: String,
    unique: true,
    uppercase: true,
    trim: true,
    match: [/^ROLE\d{3,}$/, 'Role code must follow format ROLE001, ROLE002, etc.']
  },

  roleName: {
    type: String,
    required: [true, 'Role name is required'],
    unique: true,
    trim: true,
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
    max: 5,
    default: 1
  },

  description: {
    type: String,
    trim: true,
    maxlength: [200, 'Description must be at most 200 characters long']
  },

  // ══════════════════════════════════════════════════
  // 🆕 NEW: ACCESS CONTROL FIELDS
  // ══════════════════════════════════════════════════
  
  canAccessAdmin: {
    type: String,
    enum: ['full', 'limited', 'view_only', 'none'],
    default: 'none',
    required: true
  },

  canAccessPOS: {
    type: Boolean,
    default: false,
    required: true
  },

  // ══════════════════════════════════════════════════
  // 🆕 NEW: DETAILED PERMISSIONS
  // ══════════════════════════════════════════════════
  
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
  }]

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
})

// Indexes
roleSchema.index({ roleCode: 1 })
roleSchema.index({ roleName: 1 })
roleSchema.index({ canAccessAdmin: 1 })
roleSchema.index({ canAccessPOS: 1 })

// Virtual to get user count
roleSchema.virtual('userCount', {
  ref: 'UserAccount',
  localField: '_id',
  foreignField: 'role',
  count: true
})

// Pre-save hook to generate role code
roleSchema.pre('save', async function (next) {
  if (this.isNew && !this.roleCode) {
    const count = await mongoose.model('Role').countDocuments()
    this.roleCode = `ROLE${String(count + 1).padStart(3, '0')}`
  }
  next()
})

// 🆕 Method: Check if role can access admin
roleSchema.methods.hasAdminAccess = function() {
  return this.canAccessAdmin !== 'none'
}

// 🆕 Method: Check if role has specific permission
roleSchema.methods.hasPermission = function(permission) {
  return this.permissions.includes(permission) || this.permissions.includes('*')
}

// 🆕 Static: Find POS-accessible roles
roleSchema.statics.findPOSRoles = function() {
  return this.find({ canAccessPOS: true }).sort({ level: -1 })
}

// 🆕 Static: Find Admin-accessible roles
roleSchema.statics.findAdminRoles = function() {
  return this.find({ 
    canAccessAdmin: { $in: ['full', 'limited', 'view_only'] }
  }).sort({ level: -1 })
}

module.exports = mongoose.model('Role', roleSchema)
```

**Action:**
```bash
# Backup file cũ
copy models\role.js models\role.js.backup

# Sau đó thay thế nội dung file models\role.js bằng code trên
```

---

### Step 1.2: Update Employee Model với POS PIN

**File cần sửa: `models/employee.js`**

Thêm các fields sau vào Employee schema (đã có trong file `database-schema.dbml`):

```javascript
// Thêm vào sau dateOfBirth field:

  // ══════════════════════════════════════════════════
  // 🆕 POS AUTHENTICATION FIELDS
  // ══════════════════════════════════════════════════
  
  posPinHash: {
    type: String,
    select: false  // Don't return by default
  },

  pinLastChanged: {
    type: Date,
    default: Date.now
  },

  pinExpiresAt: {
    type: Date,
    default: () => Date.now() + 90 * 24 * 60 * 60 * 1000  // 90 days
  },

  pinFailedAttempts: {
    type: Number,
    default: 0
  },

  pinLockedUntil: {
    type: Date,
    default: null
  },

  posLastLogin: {
    type: Date
  },

  posDeviceId: {
    type: String,
    trim: true
  },

  canAccessPOS: {
    type: Boolean,
    default: false
  }
```

Và thêm các methods:

```javascript
// 🆕 Method: Set POS PIN
employeeSchema.methods.setPosPin = async function(pin) {
  const bcrypt = require('bcrypt')
  
  // Validate PIN format
  if (!/^\d{4,6}$/.test(pin)) {
    throw new Error('PIN must be 4-6 digits only')
  }
  
  // Don't allow weak PINs
  const weakPins = ['1234', '0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999']
  if (weakPins.includes(pin)) {
    throw new Error('This PIN is too common. Please choose a more secure PIN')
  }
  
  // Hash PIN
  this.posPinHash = await bcrypt.hash(pin, 10)
  this.pinLastChanged = Date.now()
  this.pinExpiresAt = Date.now() + 90 * 24 * 60 * 60 * 1000
  this.pinFailedAttempts = 0
  this.pinLockedUntil = null
  
  await this.save()
}

// 🆕 Method: Verify POS PIN
employeeSchema.methods.verifyPosPin = async function(pin) {
  const bcrypt = require('bcrypt')
  
  // Check if PIN is locked
  if (this.pinLockedUntil && this.pinLockedUntil > Date.now()) {
    const minutesLeft = Math.ceil((this.pinLockedUntil - Date.now()) / 60000)
    throw new Error(`PIN locked. Try again in ${minutesLeft} minutes`)
  }
  
  // Check if PIN expired
  if (this.pinExpiresAt && this.pinExpiresAt < Date.now()) {
    throw new Error('PIN expired. Please contact admin to reset')
  }
  
  // Verify PIN
  const isValid = await bcrypt.compare(pin, this.posPinHash)
  
  if (!isValid) {
    // Increment failed attempts
    this.pinFailedAttempts += 1
    
    // Lock after 5 failed attempts
    if (this.pinFailedAttempts >= 5) {
      this.pinLockedUntil = Date.now() + 15 * 60 * 1000  // Lock 15 minutes
      await this.save()
      throw new Error('Too many failed attempts. PIN locked for 15 minutes')
    }
    
    await this.save()
    throw new Error(`Invalid PIN. ${5 - this.pinFailedAttempts} attempts remaining`)
  }
  
  // Reset failed attempts on success
  this.pinFailedAttempts = 0
  this.pinLockedUntil = null
  this.posLastLogin = Date.now()
  await this.save()
  
  return true
}

// 🆕 Method: Check if PIN expired
employeeSchema.methods.isPinExpired = function() {
  return this.pinExpiresAt && this.pinExpiresAt < Date.now()
}

// 🆕 Static: Find by Employee Code
employeeSchema.statics.findByEmployeeCode = async function(employeeCode) {
  const UserAccount = require('./userAccount')
  
  // Find UserAccount by userCode
  const userAccount = await UserAccount.findOne({ 
    userCode: employeeCode,
    isActive: true 
  })
  
  if (!userAccount) return null
  
  // Find Employee by userAccount
  const employee = await this.findOne({ userAccount: userAccount._id })
    .populate('userAccount', 'userCode username role isActive')
    .populate('department', 'departmentName')
    .select('+posPinHash +pinFailedAttempts +pinLockedUntil +pinExpiresAt')
  
  return employee
}
```

**Action:**
```bash
# Backup
copy models\employee.js models\employee.js.backup

# Edit models\employee.js và thêm code trên
```

---

### Step 1.3: Create Setup Script

**File mới: `scripts/setup-complete-roles.js`**

```javascript
const mongoose = require('mongoose')
const Role = require('../models/role')
const config = require('../utils/config')
const logger = require('../utils/logger')

const roles = [
  {
    roleName: 'Admin',
    level: 5,
    canAccessAdmin: 'full',
    canAccessPOS: false,
    permissions: ['*'],  // All permissions
    description: 'System administrator - Head office'
  },
  
  {
    roleName: 'Store Manager',
    level: 4,
    canAccessAdmin: 'full',
    canAccessPOS: true,
    permissions: [
      'view_all_reports',
      'view_financial_reports',
      'view_staff_performance',
      'manage_staff',
      'manage_inventory',
      'manage_suppliers',
      'manage_promotions',
      'manage_categories',
      'approve_refunds',
      'end_of_day_closing',
      'manage_purchase_orders',
      'create_order',
      'process_payment',
      'view_products',
      'apply_custom_discounts'
    ],
    description: 'Store manager with full admin and POS access'
  },
  
  {
    roleName: 'Assistant Manager',
    level: 3,
    canAccessAdmin: 'limited',
    canAccessPOS: true,
    permissions: [
      'view_sales_reports',
      'manage_inventory',
      'approve_refunds_under_500k',
      'view_staff_performance',
      'create_order',
      'process_payment',
      'view_products',
      'apply_standard_discounts'
    ],
    description: 'Assistant manager with limited admin access'
  },
  
  {
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
    description: 'Shift supervisor with view-only admin and full POS access'
  },
  
  {
    roleName: 'Sales Staff',
    level: 1,
    canAccessAdmin: 'none',  // ← NO ADMIN ACCESS
    canAccessPOS: true,
    permissions: [
      'create_order',
      'process_payment',
      'view_products',
      'apply_standard_discounts',
      'view_my_sales',
      'basic_refund_under_100k'
    ],
    description: 'Sales staff with POS access only - NO admin dashboard'
  },
  
  {
    roleName: 'Cashier',
    level: 1,
    canAccessAdmin: 'none',  // ← NO ADMIN ACCESS
    canAccessPOS: true,
    permissions: [
      'create_order',
      'process_payment',
      'basic_refund_under_100k'
    ],
    description: 'Cashier with POS access only'
  }
]

const setupRoles = async () => {
  try {
    logger.info('Connecting to MongoDB...')
    await mongoose.connect(config.MONGODB_URI)
    logger.info('Connected to MongoDB')

    logger.info('Setting up roles...')

    for (const roleData of roles) {
      const existingRole = await Role.findOne({ roleName: roleData.roleName })
      
      if (existingRole) {
        // Update existing role
        Object.assign(existingRole, roleData)
        await existingRole.save()
        logger.info(`✓ Role updated: ${roleData.roleName}`)
      } else {
        // Create new role
        const role = new Role(roleData)
        await role.save()
        logger.info(`✓ Role created: ${roleData.roleName} (${role.roleCode})`)
      }
    }

    logger.info('\n✅ All roles setup completed!')
    logger.info('\nRoles summary:')
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    
    const allRoles = await Role.find().sort({ level: -1 })
    allRoles.forEach(role => {
      const adminAccess = role.canAccessAdmin === 'none' ? '❌ NO' : `✅ ${role.canAccessAdmin}`
      const posAccess = role.canAccessPOS ? '✅ YES' : '❌ NO'
      logger.info(`${role.roleName.padEnd(20)} | Admin: ${adminAccess.padEnd(15)} | POS: ${posAccess}`)
    })
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  } catch (error) {
    logger.error('Error setting up roles:', error.message)
  } finally {
    await mongoose.connection.close()
    logger.info('MongoDB connection closed')
  }
}

setupRoles()
```

**Action:**
```bash
# Tạo file mới
# scripts/setup-complete-roles.js

# Run script
node scripts/setup-complete-roles.js
```

---

### Step 1.4: Update package.json scripts

**File: `package.json`**

Thêm scripts:

```json
"scripts": {
  "setup:complete-roles": "node scripts/setup-complete-roles.js",
  "setup:pos-pins": "node scripts/setup-pos-pins.js"
}
```

---

## 📦 PHASE 2: POS PIN Authentication (Day 3-4)

### ✅ Checklist Phase 2

- [ ] Create POS controller với login/logout/change-pin endpoints
- [ ] Test POS login với PIN
- [ ] Test PIN security (lock after 5 attempts, etc.)

---

### Step 2.1: Create POS Controller

**File mới: `controllers/pos.js`**

```javascript
const posRouter = require('express').Router()
const Employee = require('../models/employee')
const UserAccount = require('../models/userAccount')
const jwt = require('jsonwebtoken')

// POST /api/pos/login - POS PIN Authentication
posRouter.post('/login', async (request, response) => {
  try {
    const { employeeCode, pin, deviceId } = request.body

    // Validation
    if (!employeeCode || !pin) {
      return response.status(400).json({
        error: 'Employee code and PIN are required'
      })
    }

    // Find employee by code
    const employee = await Employee.findByEmployeeCode(employeeCode)
    
    if (!employee) {
      return response.status(401).json({
        error: 'Invalid employee code'
      })
    }

    // Check if employee can access POS
    if (!employee.canAccessPOS) {
      return response.status(403).json({
        error: 'You do not have permission to access POS system. Please contact your manager.'
      })
    }

    // Populate role to check permissions
    await employee.populate({
      path: 'userAccount',
      populate: { path: 'role' }
    })

    // Check if role allows POS access
    if (!employee.userAccount.role.canAccessPOS) {
      return response.status(403).json({
        error: 'Your role does not have POS access. Please contact administrator.'
      })
    }

    // Check if user account is active
    if (!employee.userAccount.isActive) {
      return response.status(403).json({
        error: 'Account is inactive. Please contact administrator.'
      })
    }

    // Verify PIN
    try {
      await employee.verifyPosPin(pin)
    } catch (error) {
      return response.status(401).json({
        error: error.message
      })
    }

    // Update device ID if provided
    if (deviceId) {
      employee.posDeviceId = deviceId
      await employee.save()
    }

    // Generate POS token (8 hours for work shift)
    const posToken = jwt.sign(
      {
        id: employee.userAccount._id,
        employeeId: employee._id,
        username: employee.userAccount.username,
        role: employee.userAccount.role._id,
        roleName: employee.userAccount.role.roleName,
        type: 'pos'  // Important: Mark as POS token
      },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    )

    // Check if PIN needs change
    const needsPinChange = employee.isPinExpired() || pin === '1234'

    // Response
    response.status(200).json({
      success: true,
      data: {
        token: posToken,
        employee: {
          id: employee._id,
          fullName: employee.fullName,
          employeeCode: employee.userAccount.userCode,
          department: employee.department?.departmentName,
          role: employee.userAccount.role.roleName,
          permissions: employee.userAccount.role.permissions,
          posLastLogin: employee.posLastLogin
        },
        needsPinChange,
        expiresIn: '8h'
      }
    })

  } catch (error) {
    console.error('POS login error:', error)
    response.status(500).json({
      error: 'Login failed. Please try again'
    })
  }
})

// POST /api/pos/change-pin
posRouter.post('/change-pin', async (request, response) => {
  try {
    const { oldPin, newPin } = request.body
    
    // Extract token
    const token = request.headers.authorization?.replace('Bearer ', '')
    if (!token) {
      return response.status(401).json({ error: 'Token required' })
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    if (decoded.type !== 'pos') {
      return response.status(403).json({ error: 'POS token required' })
    }

    // Find employee
    const employee = await Employee.findById(decoded.employeeId)
      .select('+posPinHash +pinFailedAttempts +pinLockedUntil')
    
    if (!employee) {
      return response.status(404).json({ error: 'Employee not found' })
    }

    // Verify old PIN
    await employee.verifyPosPin(oldPin)

    // Set new PIN (will validate and throw if weak)
    await employee.setPosPin(newPin)

    response.status(200).json({
      success: true,
      message: 'PIN changed successfully'
    })

  } catch (error) {
    response.status(400).json({
      error: error.message || 'Failed to change PIN'
    })
  }
})

// POST /api/pos/logout
posRouter.post('/logout', async (request, response) => {
  try {
    // Optional: Log logout event for audit
    response.status(200).json({
      success: true,
      message: 'Logged out successfully'
    })
  } catch (error) {
    response.status(500).json({
      error: 'Logout failed'
    })
  }
})

// GET /api/pos/session - Verify current session
posRouter.get('/session', async (request, response) => {
  try {
    const token = request.headers.authorization?.replace('Bearer ', '')
    if (!token) {
      return response.status(401).json({ error: 'Not authenticated' })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    
    if (decoded.type !== 'pos') {
      return response.status(403).json({ error: 'Invalid token type' })
    }

    const employee = await Employee.findById(decoded.employeeId)
      .populate('userAccount', 'userCode username isActive role')
      .populate('department', 'departmentName')
      .populate({
        path: 'userAccount',
        populate: { path: 'role', select: 'roleName permissions canAccessPOS' }
      })

    if (!employee || !employee.userAccount.isActive) {
      return response.status(403).json({ error: 'Session invalid' })
    }

    response.status(200).json({
      success: true,
      data: {
        employee: {
          id: employee._id,
          fullName: employee.fullName,
          employeeCode: employee.userAccount.userCode,
          department: employee.department?.departmentName,
          role: employee.userAccount.role.roleName,
          permissions: employee.userAccount.role.permissions
        }
      }
    })

  } catch (error) {
    response.status(401).json({
      error: 'Session expired or invalid'
    })
  }
})

module.exports = posRouter
```

---

### Step 2.2: Register POS Router

**File: `app.js`**

Thêm vào phần routes:

```javascript
// Import POS router
const posRouter = require('./controllers/pos')

// ... existing imports ...

// API Routes
app.use('/api/pos', posRouter)  // ← NEW: POS endpoints
app.use('/api/products', productsRouter)
app.use('/api/roles', rolesRouter)
// ... other routes ...
```

---

## 📦 PHASE 3: Middleware & Security (Day 5-7)

### Step 3.1: Create Auth Middleware

**File: `utils/auth.js`** (update existing file)

Thêm các middleware mới:

```javascript
// 🆕 Middleware: Require Admin Dashboard Access
const requireAdminAccess = async (request, response, next) => {
  try {
    const user = request.user  // From userExtractor
    
    if (!user) {
      return response.status(401).json({
        error: 'Authentication required'
      })
    }

    // Populate role
    const UserAccount = require('../models/userAccount')
    const userAccount = await UserAccount.findById(user.id).populate('role')
    
    if (!userAccount) {
      return response.status(401).json({
        error: 'User not found'
      })
    }

    // Check admin access
    const { canAccessAdmin } = userAccount.role
    
    if (canAccessAdmin === 'none') {
      return response.status(403).json({
        error: 'Access denied',
        message: 'Admin dashboard is only available for managers. Please use POS system for your daily tasks.'
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

// 🆕 Middleware: Require Full Admin Access
const requireFullAdminAccess = async (request, response, next) => {
  try {
    // First check if user has any admin access
    await requireAdminAccess(request, response, () => {})
    
    if (request.adminAccessLevel !== 'full') {
      return response.status(403).json({
        error: 'Insufficient permissions',
        message: 'This action requires Store Manager role or above.'
      })
    }
    
    next()
    
  } catch (error) {
    response.status(403).json({ error: 'Forbidden' })
  }
}

// Export new middlewares
module.exports = {
  // ... existing exports ...
  requireAdminAccess,
  requireFullAdminAccess
}
```

---

### Step 3.2: Apply Middleware to Admin Routes

**File: `app.js`**

Update các routes cần bảo vệ:

```javascript
const { 
  userExtractor, 
  isAdmin,
  requireAdminAccess,
  requireFullAdminAccess 
} = require('./utils/auth')

// ═══════════════════════════════════════════════════════
// ADMIN ROUTES - Require Admin Access
// ═══════════════════════════════════════════════════════

// Reports - Any admin level can view
app.use('/api/reports', userExtractor, requireAdminAccess, reportsRouter)

// Employee management - Full admin only
app.use('/api/employees', userExtractor, requireFullAdminAccess, employeesRouter)

// User accounts - Full admin only
app.use('/api/user-accounts', userExtractor, requireFullAdminAccess, userAccountsRouter)

// Inventory - Limited admin can access
app.use('/api/inventories', userExtractor, requireAdminAccess, inventoriesRouter)

// Categories - Limited admin can access
app.use('/api/categories', userExtractor, requireAdminAccess, categoriesRouter)

// Suppliers - Full admin only
app.use('/api/suppliers', userExtractor, requireFullAdminAccess, suppliersRouter)

// Purchase orders - Full admin only
app.use('/api/purchase-orders', userExtractor, requireFullAdminAccess, purchaseOrdersRouter)

// ═══════════════════════════════════════════════════════
// POS ROUTES - No admin check needed
// ═══════════════════════════════════════════════════════

// POS auth
app.use('/api/pos', posRouter)

// Orders - POS only (will be protected by POS token)
app.use('/api/orders', ordersRouter)

// Payments - POS only
app.use('/api/payments', paymentsRouter)
```

---

## 📦 PHASE 4: POS Frontend (Day 8-10)

*(Tôi sẽ tiếp tục với Phase 4-8 trong response tiếp theo vì đã dài)*

---

## 🎯 SUMMARY - Những gì cần làm NGAY BÂY GIỜ:

### 1. **Update Models** ⚡ (Quan trọng nhất)
```bash
# Step 1: Backup
copy models\role.js models\role.js.backup
copy models\employee.js models\employee.js.backup

# Step 2: Update theo code trên
# - models/role.js: Thêm canAccessAdmin, canAccessPOS, level, permissions
# - models/employee.js: Thêm PIN fields và methods
```

### 2. **Create Setup Script**
```bash
# Create file: scripts/setup-complete-roles.js
# Copy code từ Step 1.3

# Run script
node scripts/setup-complete-roles.js
```

### 3. **Create POS Controller**
```bash
# Create file: controllers/pos.js
# Copy code từ Step 2.1
```

### 4. **Update app.js**
```javascript
// Add POS router
const posRouter = require('./controllers/pos')
app.use('/api/pos', posRouter)
```

### 5. **Update Auth Middleware**
```bash
# Edit utils/auth.js
# Thêm requireAdminAccess và requireFullAdminAccess
```

---

## ❓ Bạn muốn tôi:

1. ✅ **Tiếp tục với Phase 4-8** (Frontend, Testing, Deployment)?
2. ✅ **Tạo từng file cụ thể** cho bạn copy-paste?
3. ✅ **Giải thích chi tiết hơn** về phần nào?
4. ✅ **Bắt đầu implement** ngay từng phần?

Cho tôi biết bạn muốn làm gì tiếp theo! 🚀
