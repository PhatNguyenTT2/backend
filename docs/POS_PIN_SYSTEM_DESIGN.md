# Thiết Kế Hệ Thống POS với PIN Authentication

## 📋 Mục Lục
1. [Tổng Quan](#1-tổng-quan)
2. [Phân Tích Khả Thi](#2-phân-tích-khả-thi)
3. [Thiết Kế Database](#3-thiết-kế-database)
4. [Thiết Kế API](#4-thiết-kế-api)
5. [Thiết Kế Frontend](#5-thiết-kế-frontend)
6. [Security & Best Practices](#6-security--best-practices)
7. [Migration Plan](#7-migration-plan)
8. [Testing Strategy](#8-testing-strategy)

---

## 1. Tổng Quan

### Mục tiêu
Chuyển đổi hệ thống authentication cho **POS Client** từ **Username/Password** sang **PIN Code** ngắn (4-6 số) để:
- ✅ Tăng tốc độ đăng nhập (3-5 giây → 1-2 giây)
- ✅ Cải thiện UX cho nhân viên bán hàng
- ✅ Phù hợp với luồng làm việc POS thực tế
- ✅ Giảm overhead cho API requests

### Phạm vi
- **CÓ thay đổi**: POS Frontend (React - Client)
- **CÓ thay đổi**: Employee Model (thêm PIN field)
- **CÓ thay đổi**: Authentication API (thêm PIN login endpoint)
- **KHÔNG thay đổi**: Admin Dashboard (vẫn dùng username/password)
- **KHÔNG thay đổi**: Core business logic

### Kiến trúc mới

```
┌─────────────────────────────────────────────────────────┐
│                    TWO-TIER AUTHENTICATION              │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────┐    ┌──────────────────────┐  │
│  │   ADMIN DASHBOARD   │    │    POS CLIENT        │  │
│  │   (Management)      │    │    (Sales)           │  │
│  ├─────────────────────┤    ├──────────────────────┤  │
│  │ Username + Password │    │  Employee ID + PIN   │  │
│  │ Full JWT Auth       │    │  Simplified Token    │  │
│  │ Role-based Access   │    │  Limited Permissions │  │
│  └─────────────────────┘    └──────────────────────┘  │
│           │                           │                │
│           └───────────┬───────────────┘                │
│                       ↓                                │
│              ┌─────────────────┐                       │
│              │   Backend API   │                       │
│              │  - /login       │ ← Admin              │
│              │  - /pos-login   │ ← POS (NEW)          │
│              └─────────────────┘                       │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Phân Tích Khả Thi

### ✅ Ưu điểm

#### A. Performance
```
Traditional Login (Username/Password):
├── Input username (3-10 chars, 2-4s)
├── Input password (8-20 chars, 3-6s)
├── Click Login
└── Total: ~5-10 giây

PIN Login:
├── Input Employee ID (hiển thị sẵn hoặc select)
├── Input PIN (4-6 số, 1-2s)
├── Auto submit hoặc Enter
└── Total: ~1-3 giây

→ Tiết kiệm: 4-7 giây/lần đăng nhập
→ Với 50 lần đổi ca/ngày = 200-350 giây = 3-6 phút/ngày
```

#### B. User Experience
- Dễ nhớ (4-6 số vs username + complex password)
- Nhanh hơn khi đổi ca
- Phù hợp với môi trường POS
- Giảm lỗi đăng nhập

#### C. Security (Đủ cho POS)
- PIN chỉ hoạt động trên máy POS cố định
- Rate limiting (5 lần sai → lock 15 phút)
- PIN expiry (đổi định kỳ)
- Audit log đầy đủ

#### D. Real-world Alignment
- Đúng với cách hoạt động của Starbucks, McDonald's, 7-Eleven
- Phù hợp với luồng làm việc ca xoay
- Không cần logout liên tục

### ⚠️ Nhược điểm & Giải pháp

| Nhược điểm | Mức độ | Giải pháp |
|-----------|--------|-----------|
| PIN dễ bị nhìn trộm | Trung bình | - Màn hình che PIN<br>- Camera giám sát<br>- Physical security |
| PIN yếu hơn password | Thấp | - Chỉ dùng cho POS<br>- Rate limiting<br>- PIN rotation |
| Shared device risk | Trung bình | - Auto timeout (5-10 phút idle)<br>- Manual logout button |

### ✅ KẾT LUẬN: **HOÀN TOÀN KHẢ THI**

---

## 3. Thiết Kế Database

### 3.1. Thay đổi Employee Model

**File: `models/employee.js`**

```javascript
const employeeSchema = new mongoose.Schema({
  // ... existing fields ...
  
  // NEW: POS Authentication Fields
  posPin: {
    type: String,
    required: false,  // Optional, chỉ cho nhân viên bán hàng
    select: false,    // Không trả về mặc định (security)
    minlength: [4, 'PIN must be at least 4 digits'],
    maxlength: [6, 'PIN must be at most 6 digits'],
    match: [/^\d{4,6}$/, 'PIN must be 4-6 digits only']
  },

  posPinHash: {
    type: String,
    select: false     // Store hashed PIN, not plain text
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

  // NEW: POS Session
  posLastLogin: {
    type: Date
  },

  posDeviceId: {
    type: String,     // Gắn với máy POS cụ thể (optional)
    trim: true
  },

  // NEW: Role flag
  canAccessPOS: {
    type: Boolean,
    default: false    // Chỉ nhân viên bán hàng mới có
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
})

// Method: Set PIN (hash before save)
employeeSchema.methods.setPosPin = async function(pin) {
  const bcrypt = require('bcrypt')
  
  // Validate PIN format
  if (!/^\d{4,6}$/.test(pin)) {
    throw new Error('PIN must be 4-6 digits only')
  }
  
  // Hash PIN (same as password)
  this.posPinHash = await bcrypt.hash(pin, 10)
  this.pinLastChanged = Date.now()
  this.pinExpiresAt = Date.now() + 90 * 24 * 60 * 60 * 1000
  this.pinFailedAttempts = 0
  this.pinLockedUntil = null
  
  await this.save()
}

// Method: Verify PIN
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

// Method: Check if PIN needs rotation
employeeSchema.methods.isPinExpired = function() {
  return this.pinExpiresAt && this.pinExpiresAt < Date.now()
}

// Static: Find by Employee Code
employeeSchema.statics.findByEmployeeCode = async function(employeeCode) {
  const UserAccount = require('./userAccount')
  
  // Find UserAccount by userCode
  const userAccount = await UserAccount.findOne({ userCode: employeeCode })
  if (!userAccount) return null
  
  // Find Employee by userAccount
  const employee = await this.findOne({ userAccount: userAccount._id })
    .populate('userAccount', 'userCode username role isActive')
    .populate('department', 'departmentName')
    .select('+posPinHash +pinFailedAttempts +pinLockedUntil +pinExpiresAt')
  
  return employee
}
```

### 3.2. Index mới

```javascript
// Indexes for POS lookup
employeeSchema.index({ canAccessPOS: 1 })
employeeSchema.index({ posDeviceId: 1 })
employeeSchema.index({ posLastLogin: -1 })
```

### 3.3. Migration Script

**File: `scripts/setup-pos-pins.js`**

```javascript
const mongoose = require('mongoose')
const Employee = require('../models/employee')
const UserAccount = require('../models/userAccount')
const config = require('../utils/config')

const setupPosPins = async () => {
  try {
    await mongoose.connect(config.MONGODB_URI)
    console.log('Connected to MongoDB')

    // Find all sales employees (by role or department)
    const salesRole = await mongoose.model('Role').findOne({ roleName: 'Sales' })
    
    const salesEmployees = await Employee.find()
      .populate({
        path: 'userAccount',
        match: { role: salesRole._id }
      })
    
    console.log(`Found ${salesEmployees.length} sales employees`)

    // Set default PIN: 1234 (MUST be changed on first POS login)
    for (const employee of salesEmployees) {
      if (employee.userAccount) {
        employee.canAccessPOS = true
        await employee.setPosPin('1234')  // Default PIN
        
        console.log(`✓ Set PIN for: ${employee.fullName} (${employee.userAccount.userCode})`)
      }
    }

    console.log('\n✅ POS PIN setup completed!')
    console.log('⚠️  Default PIN: 1234 - Employees MUST change on first login')

  } catch (error) {
    console.error('Error:', error.message)
  } finally {
    await mongoose.connection.close()
  }
}

setupPosPins()
```

---

## 4. Thiết Kế API

### 4.1. New Endpoint: POS Login

**File: `controllers/pos.js`** (NEW)

```javascript
const posRouter = require('express').Router()
const Employee = require('../models/employee')
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
        error: 'You do not have permission to access POS'
      })
    }

    // Check if user account is active
    if (!employee.userAccount.isActive) {
      return response.status(403).json({
        error: 'Account is inactive. Contact administrator'
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

    // Generate POS token (shorter expiry than admin token)
    const posToken = jwt.sign(
      {
        id: employee.userAccount._id,
        employeeId: employee._id,
        username: employee.userAccount.username,
        role: employee.userAccount.role,
        type: 'pos'  // Important: Mark as POS token
      },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }  // 8 hours for a work shift
    )

    // Check if PIN needs rotation
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
          posLastLogin: employee.posLastLogin
        },
        needsPinChange,  // Frontend will prompt to change
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

// POST /api/pos/change-pin - Change PIN (must be authenticated)
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

    // Set new PIN
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
      .populate('userAccount', 'userCode username isActive')
      .populate('department', 'departmentName')

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
          department: employee.department?.departmentName
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

### 4.2. Register Router

**File: `app.js`**

```javascript
// Add new POS router
const posRouter = require('./controllers/pos')

// ... existing code ...

// API Routes
app.use('/api/pos', posRouter)  // ← NEW: POS endpoints
app.use('/api/products', productsRouter)
// ... other routes ...
```

### 4.3. Admin Endpoints (quản lý PIN)

**File: `controllers/employees.js`** (thêm endpoints)

```javascript
// POST /api/employees/:id/reset-pin - Admin reset PIN
employeesRouter.post('/:id/reset-pin', userExtractor, isAdmin, async (request, response) => {
  try {
    const { newPin } = request.body
    
    const employee = await Employee.findById(request.params.id)
    if (!employee) {
      return response.status(404).json({ error: 'Employee not found' })
    }

    // Admin can set custom PIN or default '1234'
    await employee.setPosPin(newPin || '1234')

    response.status(200).json({
      success: true,
      message: 'PIN reset successfully',
      data: {
        employeeId: employee._id,
        fullName: employee.fullName
      }
    })

  } catch (error) {
    response.status(400).json({
      error: error.message
    })
  }
})

// PATCH /api/employees/:id/pos-access - Enable/Disable POS access
employeesRouter.patch('/:id/pos-access', userExtractor, isAdmin, async (request, response) => {
  try {
    const { canAccessPOS } = request.body
    
    const employee = await Employee.findById(request.params.id)
    if (!employee) {
      return response.status(404).json({ error: 'Employee not found' })
    }

    employee.canAccessPOS = canAccessPOS

    // If enabling POS access, set default PIN if not exists
    if (canAccessPOS && !employee.posPinHash) {
      await employee.setPosPin('1234')
    }

    await employee.save()

    response.status(200).json({
      success: true,
      data: {
        employeeId: employee._id,
        canAccessPOS: employee.canAccessPOS
      }
    })

  } catch (error) {
    response.status(400).json({
      error: error.message
    })
  }
})
```

---

## 5. Thiết Kế Frontend

### 5.1. POS Login Screen

**File: `admin/src/pages/PosLogin.jsx`** (NEW)

```jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'

const PosLogin = () => {
  const [employeeCode, setEmployeeCode] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  // Auto-focus on PIN input after employee code is entered
  useEffect(() => {
    if (employeeCode.length >= 8) {
      document.getElementById('pin-input')?.focus()
    }
  }, [employeeCode])

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Get device ID (from localStorage or generate)
      const deviceId = localStorage.getItem('pos-device-id') || 
                      `POS-${Math.random().toString(36).substr(2, 9)}`
      
      localStorage.setItem('pos-device-id', deviceId)

      // Call POS login API
      const response = await api.post('/pos/login', {
        employeeCode,
        pin,
        deviceId
      })

      const { token, employee, needsPinChange } = response.data.data

      // Store token
      localStorage.setItem('pos-token', token)
      localStorage.setItem('pos-employee', JSON.stringify(employee))

      // Redirect
      if (needsPinChange) {
        navigate('/pos/change-pin')
      } else {
        navigate('/pos/dashboard')
      }

    } catch (err) {
      setError(err.response?.data?.error || 'Login failed')
      setPin('')  // Clear PIN on error
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">POS System</h1>
          <p className="text-gray-500 mt-2">Enter your credentials to start</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-6">
          {/* Employee Code */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Employee Code
            </label>
            <input
              type="text"
              value={employeeCode}
              onChange={(e) => setEmployeeCode(e.target.value.toUpperCase())}
              placeholder="USER2025000001"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
              required
              autoComplete="off"
              autoFocus
            />
          </div>

          {/* PIN */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              PIN
            </label>
            <input
              id="pin-input"
              type="password"
              value={pin}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '').slice(0, 6)
                setPin(value)
                // Auto submit when PIN is 4-6 digits
                if (value.length >= 4 && value.length <= 6) {
                  // Auto submit after short delay
                  setTimeout(() => {
                    if (employeeCode && value.length >= 4) {
                      handleLogin(e)
                    }
                  }, 300)
                }
              }}
              placeholder="••••"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-2xl text-center tracking-widest"
              required
              maxLength={6}
              inputMode="numeric"
              pattern="[0-9]*"
            />
            <p className="text-xs text-gray-500 mt-1 text-center">
              Enter 4-6 digit PIN
            </p>
          </div>

          {/* Login Button */}
          <button
            type="submit"
            disabled={loading || !employeeCode || pin.length < 4}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-semibold py-3 rounded-lg transition-colors text-lg"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            Forgot PIN? Contact your supervisor
          </p>
        </div>

        {/* Quick Access (Development only) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <p className="text-xs text-yellow-800 font-semibold mb-2">DEV MODE - Quick Access:</p>
            <button
              onClick={() => {
                setEmployeeCode('USER2025000001')
                setPin('1234')
              }}
              className="text-xs text-yellow-700 underline"
            >
              Fill demo credentials
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default PosLogin
```

### 5.2. Change PIN Screen

**File: `admin/src/pages/PosChangePin.jsx`** (NEW)

```jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'

const PosChangePin = () => {
  const [oldPin, setOldPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleChangePin = async (e) => {
    e.preventDefault()
    setError('')

    // Validation
    if (newPin.length < 4 || newPin.length > 6) {
      setError('PIN must be 4-6 digits')
      return
    }

    if (newPin !== confirmPin) {
      setError('New PIN and confirmation do not match')
      return
    }

    if (newPin === oldPin) {
      setError('New PIN must be different from old PIN')
      return
    }

    if (newPin === '1234') {
      setError('PIN 1234 is not allowed. Choose a more secure PIN')
      return
    }

    setLoading(true)

    try {
      const token = localStorage.getItem('pos-token')
      
      await api.post('/pos/change-pin', 
        { oldPin, newPin },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      alert('PIN changed successfully!')
      navigate('/pos/dashboard')

    } catch (err) {
      setError(err.response?.data?.error || 'Failed to change PIN')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Change PIN</h2>
        
        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg mb-6">
          <p className="text-sm text-yellow-800">
            ⚠️ Your PIN has expired or you're using the default PIN. 
            Please change it to continue.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleChangePin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Old PIN
            </label>
            <input
              type="password"
              value={oldPin}
              onChange={(e) => setOldPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full px-4 py-2 border rounded-lg"
              required
              inputMode="numeric"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              New PIN (4-6 digits)
            </label>
            <input
              type="password"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full px-4 py-2 border rounded-lg"
              required
              inputMode="numeric"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Confirm New PIN
            </label>
            <input
              type="password"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full px-4 py-2 border rounded-lg"
              required
              inputMode="numeric"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg"
          >
            {loading ? 'Changing...' : 'Change PIN'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default PosChangePin
```

### 5.3. POS Service

**File: `admin/src/services/posService.js`** (NEW)

```javascript
import api from './api'

const posService = {
  // Login with PIN
  login: async (employeeCode, pin, deviceId) => {
    const response = await api.post('/pos/login', {
      employeeCode,
      pin,
      deviceId
    })
    return response.data
  },

  // Change PIN
  changePin: async (oldPin, newPin) => {
    const token = localStorage.getItem('pos-token')
    const response = await api.post('/pos/change-pin', 
      { oldPin, newPin },
      { headers: { Authorization: `Bearer ${token}` } }
    )
    return response.data
  },

  // Logout
  logout: async () => {
    const token = localStorage.getItem('pos-token')
    await api.post('/pos/logout', {}, {
      headers: { Authorization: `Bearer ${token}` }
    })
    localStorage.removeItem('pos-token')
    localStorage.removeItem('pos-employee')
  },

  // Get current session
  getSession: async () => {
    const token = localStorage.getItem('pos-token')
    const response = await api.get('/pos/session', {
      headers: { Authorization: `Bearer ${token}` }
    })
    return response.data
  },

  // Check if logged in
  isAuthenticated: () => {
    return !!localStorage.getItem('pos-token')
  },

  // Get current employee
  getCurrentEmployee: () => {
    const employee = localStorage.getItem('pos-employee')
    return employee ? JSON.parse(employee) : null
  }
}

export default posService
```

### 5.4. Router Configuration

**File: `admin/src/App.jsx`**

```jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import PosLogin from './pages/PosLogin'
import PosChangePin from './pages/PosChangePin'
import PosDashboard from './pages/PosDashboard'
import PosProtectedRoute from './components/PosProtectedRoute'

// Admin routes
import AdminLogin from './pages/LoginSignup'
import Dashboard from './pages/Dashboard'
// ... other admin pages

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* POS Routes */}
        <Route path="/pos/login" element={<PosLogin />} />
        <Route path="/pos/change-pin" element={<PosProtectedRoute><PosChangePin /></PosProtectedRoute>} />
        <Route path="/pos/dashboard" element={<PosProtectedRoute><PosDashboard /></PosProtectedRoute>} />
        
        {/* Admin Routes */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        
        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/pos/login" />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
```

---

## 6. Security & Best Practices

### 6.1. Security Measures

```javascript
// 1. Rate Limiting (express-rate-limit)
const rateLimit = require('express-rate-limit')

const posLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 10,  // 10 attempts per IP
  message: 'Too many login attempts. Please try again later'
})

app.use('/api/pos/login', posLoginLimiter)

// 2. PIN Complexity (optional)
const validatePin = (pin) => {
  // No sequential numbers
  if (/0123|1234|2345|3456|4567|5678|6789/.test(pin)) {
    return false
  }
  // No repeating numbers
  if (/(\d)\1{3,}/.test(pin)) {
    return false
  }
  return true
}

// 3. Audit Logging
const logPosAction = async (employeeId, action, details) => {
  await AuditLog.create({
    employeeId,
    action,  // 'pos_login', 'pos_logout', 'pin_change'
    details,
    timestamp: Date.now(),
    ipAddress: details.ip
  })
}

// 4. Device Binding (optional)
// Only allow login from registered POS devices
const verifyDevice = async (deviceId) => {
  const device = await PosDevice.findOne({ deviceId, isActive: true })
  return !!device
}
```

### 6.2. Best Practices

1. **PIN Rotation Policy**
   - Force PIN change every 90 days
   - Warn 7 days before expiry
   - Don't allow reuse of last 3 PINs

2. **Session Management**
   - Auto-logout after 8 hours
   - Auto-lock after 10 minutes idle
   - Manual logout button always visible

3. **Physical Security**
   - Mount POS device securely
   - Position screen away from customers
   - Install security cameras

4. **Training**
   - Train staff on PIN security
   - Never share PINs
   - Report suspicious activity

---

## 7. Migration Plan

### Phase 1: Preparation (Week 1)
- [ ] Update Employee model với PIN fields
- [ ] Create migration script
- [ ] Set up default PINs for existing employees
- [ ] Test on development environment

### Phase 2: Backend Development (Week 2)
- [ ] Implement `/api/pos/login` endpoint
- [ ] Implement `/api/pos/change-pin` endpoint
- [ ] Add admin endpoints for PIN management
- [ ] Add rate limiting
- [ ] Add audit logging

### Phase 3: Frontend Development (Week 3)
- [ ] Create POS Login screen
- [ ] Create Change PIN screen
- [ ] Update POS Protected Routes
- [ ] Add session management
- [ ] Add auto-timeout

### Phase 4: Testing (Week 4)
- [ ] Unit tests for PIN authentication
- [ ] Integration tests for POS flow
- [ ] Security testing (brute force, etc.)
- [ ] User acceptance testing with staff

### Phase 5: Deployment (Week 5)
- [ ] Deploy to staging
- [ ] Train staff
- [ ] Gradual rollout (1 POS first)
- [ ] Monitor for issues
- [ ] Full deployment

### Phase 6: Monitoring (Ongoing)
- [ ] Monitor login failures
- [ ] Track PIN changes
- [ ] Review audit logs
- [ ] Collect feedback

---

## 8. Testing Strategy

### 8.1. Unit Tests

```javascript
// tests/pos-auth.test.js
describe('POS Authentication', () => {
  test('should login with valid PIN', async () => {
    const response = await api.post('/pos/login')
      .send({ employeeCode: 'USER001', pin: '1234' })
    
    expect(response.status).toBe(200)
    expect(response.body.data).toHaveProperty('token')
  })

  test('should reject invalid PIN', async () => {
    const response = await api.post('/pos/login')
      .send({ employeeCode: 'USER001', pin: '9999' })
    
    expect(response.status).toBe(401)
  })

  test('should lock after 5 failed attempts', async () => {
    for (let i = 0; i < 5; i++) {
      await api.post('/pos/login')
        .send({ employeeCode: 'USER001', pin: '9999' })
    }
    
    const response = await api.post('/pos/login')
      .send({ employeeCode: 'USER001', pin: '1234' })
    
    expect(response.status).toBe(401)
    expect(response.body.error).toContain('locked')
  })
})
```

### 8.2. Integration Tests

```javascript
describe('POS Flow', () => {
  test('complete POS session flow', async () => {
    // Login
    const login = await posService.login('USER001', '1234', 'POS-001')
    expect(login.success).toBe(true)
    
    // Change PIN (if needed)
    if (login.data.needsPinChange) {
      await posService.changePin('1234', '5678')
    }
    
    // Create order
    const order = await createOrder(products)
    expect(order.success).toBe(true)
    
    // Logout
    await posService.logout()
  })
})
```

---

## 9. Kết Luận

### ✅ Tóm tắt thay đổi

| Component | Changes | Impact |
|-----------|---------|--------|
| **Database** | Add PIN fields to Employee model | Low - Migration script available |
| **Backend API** | New `/api/pos/*` endpoints | Medium - New code, no breaking changes |
| **Frontend** | New POS login screens | High - New UX flow |
| **Security** | Rate limiting, audit logs | Medium - Infrastructure changes |
| **Testing** | New test suites | Medium - QA effort |

### 🎯 Lợi ích

1. **Tốc độ**: Giảm 60-70% thời gian đăng nhập
2. **UX**: Phù hợp với workflow POS thực tế
3. **Bảo mật**: Đủ cho môi trường POS có giám sát
4. **Khả năng mở rộng**: Dễ thêm tính năng (biometrics, RFID card)

### ⚠️ Lưu ý

- Admin dashboard VẪN dùng username/password
- PIN chỉ dùng cho POS, không thay thế hoàn toàn authentication
- Cần training nhân viên về bảo mật PIN
- Monitor và review audit logs thường xuyên

---

## 📚 Tài liệu tham khảo

- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [POS Security Guidelines](https://www.pcisecuritystandards.org/)
