# System Settings Implementation Guide

## 📋 Overview

Hướng dẫn chi tiết để implement chức năng **System Settings** cho Admin, bao gồm cấu hình Customer Discounts và các settings khác.

---

## 🎯 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        ADMIN UI                              │
│  ┌─────────────┐  ┌──────────────────┐  ┌────────────────┐ │
│  │ Navigation  │  │ Settings Pages   │  │ Settings       │ │
│  │ Menu        │→ │ - Customer       │→ │ Service        │ │
│  │ (Sidebar)   │  │   Discounts      │  │ (API calls)    │ │
│  └─────────────┘  └──────────────────┘  └────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                     BACKEND API                              │
│  ┌──────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │ Settings     │→ │ SystemSettings   │→ │ MongoDB      │  │
│  │ Controller   │  │ Model            │  │ Collection   │  │
│  └──────────────┘  └──────────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                  INTEGRATION POINTS                          │
│  - Order Controller: Auto-apply discount from settings       │
│  - Customer Management: Display discount rates              │
│  - Reports: Use system configuration                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Implementation Roadmap

### Phase 1: Backend Foundation (60 phút)
- [ ] 1.1 Tạo SystemSettings Model
- [ ] 1.2 Tạo Settings Controller & Routes
- [ ] 1.3 Update Auth Middleware (requireAdmin)
- [ ] 1.4 Mount Settings Router trong app.js
- [ ] 1.5 Create Seed Data Script

### Phase 2: Frontend Service Layer (30 phút)
- [ ] 2.1 Tạo Settings Service
- [ ] 2.2 Test API Integration

### Phase 3: Frontend UI Components (90 phút)
- [ ] 3.1 Tạo CustomerDiscountSettings Component
- [ ] 3.2 Update Navigation với Settings Menu
- [ ] 3.3 Add Routes trong App.jsx
- [ ] 3.4 Create Settings Layout Wrapper

### Phase 4: Integration & Testing (45 phút)
- [ ] 4.1 Update Order Controller sử dụng SystemSettings
- [ ] 4.2 End-to-End Testing
- [ ] 4.3 Permission Testing

### Phase 5: Documentation & Polish (30 phút)
- [ ] 5.1 Add Comments & Documentation
- [ ] 5.2 UI/UX Polish
- [ ] 5.3 Error Handling Review

**Total Estimated Time: 4.5 hours**

---

## 📝 Phase 1: Backend Foundation

### Step 1.1: Create SystemSettings Model

**File: `models/systemSettings.js`**

```javascript
const mongoose = require('mongoose');

/**
 * SystemSettings Model
 * Stores system-wide configuration settings
 * 
 * Features:
 * - Customer discount rates by type (retail, wholesale, vip)
 * - Business information
 * - Other configurable parameters
 * 
 * Usage:
 * - Single document per setting category (using settingKey)
 * - Upsert pattern for updates
 * - Static methods for easy access
 */
const systemSettingsSchema = new mongoose.Schema({
  // Unique key for each setting category
  settingKey: {
    type: String,
    required: true,
    unique: true,
    enum: ['customer_discounts', 'business_info', 'general'],
    description: 'Unique identifier for setting category'
  },

  // Customer discount configuration
  customerDiscounts: {
    retail: {
      type: Number,
      default: 10,
      min: [0, 'Discount cannot be negative'],
      max: [100, 'Discount cannot exceed 100%'],
      description: 'Discount percentage for retail customers'
    },
    wholesale: {
      type: Number,
      default: 15,
      min: [0, 'Discount cannot be negative'],
      max: [100, 'Discount cannot exceed 100%'],
      description: 'Discount percentage for wholesale customers'
    },
    vip: {
      type: Number,
      default: 20,
      min: [0, 'Discount cannot be negative'],
      max: [100, 'Discount cannot exceed 100%'],
      description: 'Discount percentage for VIP customers'
    }
  },

  // Future: Business information
  businessInfo: {
    companyName: {
      type: String,
      trim: true
    },
    address: {
      type: String,
      trim: true
    },
    phone: {
      type: String,
      trim: true
    },
    email: {
      type: String,
      trim: true,
      lowercase: true
    },
    taxCode: {
      type: String,
      trim: true
    },
    website: {
      type: String,
      trim: true
    }
  },

  // Last updated tracking
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    description: 'Employee who last updated this setting'
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true, getters: true },
  toObject: { virtuals: true, getters: true }
});

// ============ INDEXES ============
systemSettingsSchema.index({ settingKey: 1 });
systemSettingsSchema.index({ updatedAt: -1 });

// ============ STATIC METHODS ============

/**
 * Get customer discount rates
 * Returns default values if not configured
 * @returns {Promise<Object>} { retail: Number, wholesale: Number, vip: Number }
 */
systemSettingsSchema.statics.getCustomerDiscounts = async function() {
  try {
    const settings = await this.findOne({ settingKey: 'customer_discounts' });
    
    if (!settings || !settings.customerDiscounts) {
      // Return default values if not configured
      console.log('⚠️ Using default customer discount rates');
      return {
        retail: 10,
        wholesale: 15,
        vip: 20
      };
    }

    return {
      retail: settings.customerDiscounts.retail,
      wholesale: settings.customerDiscounts.wholesale,
      vip: settings.customerDiscounts.vip
    };
  } catch (error) {
    console.error('❌ Error getting customer discounts:', error);
    // Return defaults on error
    return {
      retail: 10,
      wholesale: 15,
      vip: 20
    };
  }
};

/**
 * Update customer discount rates
 * @param {Object} discounts - { retail, wholesale, vip }
 * @param {ObjectId} employeeId - Employee making the update
 * @returns {Promise<SystemSettings>} Updated settings document
 */
systemSettingsSchema.statics.updateCustomerDiscounts = async function(discounts, employeeId) {
  const { retail, wholesale, vip } = discounts;

  // Validate values
  for (const [type, value] of Object.entries(discounts)) {
    if (value < 0 || value > 100) {
      throw new Error(`${type} discount must be between 0 and 100`);
    }
  }

  return await this.findOneAndUpdate(
    { settingKey: 'customer_discounts' },
    { 
      customerDiscounts: {
        retail: parseFloat(retail),
        wholesale: parseFloat(wholesale),
        vip: parseFloat(vip)
      },
      updatedBy: employeeId
    },
    { 
      new: true, 
      upsert: true, // Create if not exists
      runValidators: true 
    }
  );
};

/**
 * Get business information
 * @returns {Promise<Object>} Business info object
 */
systemSettingsSchema.statics.getBusinessInfo = async function() {
  const settings = await this.findOne({ settingKey: 'business_info' });
  return settings?.businessInfo || {};
};

/**
 * Update business information
 * @param {Object} businessInfo - Business information object
 * @param {ObjectId} employeeId - Employee making the update
 * @returns {Promise<SystemSettings>} Updated settings document
 */
systemSettingsSchema.statics.updateBusinessInfo = async function(businessInfo, employeeId) {
  return await this.findOneAndUpdate(
    { settingKey: 'business_info' },
    { 
      businessInfo,
      updatedBy: employeeId
    },
    { 
      new: true, 
      upsert: true,
      runValidators: true 
    }
  );
};

// ============ JSON TRANSFORMATION ============
systemSettingsSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString();
    delete returnedObject._id;
    delete returnedObject.__v;
  }
});

const SystemSettings = mongoose.model('SystemSettings', systemSettingsSchema);

module.exports = SystemSettings;
```

**✅ Checklist:**
- [ ] File created in `models/systemSettings.js`
- [ ] Schema validation added
- [ ] Static methods implemented
- [ ] Indexes defined
- [ ] Documentation comments added

---

### Step 1.2: Create Settings Controller & Routes

**File: `controllers/settings.js`**

```javascript
const settingsRouter = require('express').Router();
const SystemSettings = require('../models/systemSettings');
const { userExtractor } = require('../utils/auth');

/**
 * Settings Controller
 * 
 * Endpoints:
 * - GET /api/settings - Get all settings (Admin only)
 * - GET /api/settings/customer-discounts - Get customer discount rates
 * - PUT /api/settings/customer-discounts - Update customer discount rates (Admin only)
 * - GET /api/settings/business-info - Get business information
 * - PUT /api/settings/business-info - Update business information (Admin only)
 */

// ============ MIDDLEWARE ============

/**
 * Require admin role
 * Must be used after userExtractor middleware
 */
const requireAdmin = (request, response, next) => {
  if (!request.user) {
    return response.status(401).json({
      success: false,
      error: {
        message: 'Authentication required',
        code: 'UNAUTHORIZED'
      }
    });
  }

  // Check if user has admin role
  // Assuming user object has role or isAdmin field
  if (request.user.role !== 'admin' && !request.user.isAdmin) {
    return response.status(403).json({
      success: false,
      error: {
        message: 'Admin privileges required',
        code: 'FORBIDDEN'
      }
    });
  }

  next();
};

// ============ GET ALL SETTINGS (ADMIN ONLY) ============
/**
 * GET /api/settings
 * Get all system settings with metadata
 */
settingsRouter.get('/', userExtractor, requireAdmin, async (request, response) => {
  try {
    const settings = await SystemSettings.find()
      .populate('updatedBy', 'fullName email phone')
      .sort({ updatedAt: -1 });

    response.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('❌ Error fetching settings:', error);
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch settings',
        code: 'INTERNAL_ERROR',
        details: error.message
      }
    });
  }
});

// ============ CUSTOMER DISCOUNTS ============

/**
 * GET /api/settings/customer-discounts
 * Get customer discount rates
 * Available to all authenticated users
 */
settingsRouter.get('/customer-discounts', userExtractor, async (request, response) => {
  try {
    const discounts = await SystemSettings.getCustomerDiscounts();
    
    response.json({
      success: true,
      data: discounts,
      message: 'Customer discount rates retrieved successfully'
    });
  } catch (error) {
    console.error('❌ Error fetching customer discounts:', error);
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch customer discounts',
        code: 'INTERNAL_ERROR',
        details: error.message
      }
    });
  }
});

/**
 * PUT /api/settings/customer-discounts
 * Update customer discount rates (Admin only)
 * 
 * Body: { retail: Number, wholesale: Number, vip: Number }
 */
settingsRouter.put('/customer-discounts', userExtractor, requireAdmin, async (request, response) => {
  try {
    const { retail, wholesale, vip } = request.body;

    // Validation
    if (retail === undefined || retail === null) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Retail discount is required',
          code: 'MISSING_RETAIL_DISCOUNT'
        }
      });
    }

    if (wholesale === undefined || wholesale === null) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Wholesale discount is required',
          code: 'MISSING_WHOLESALE_DISCOUNT'
        }
      });
    }

    if (vip === undefined || vip === null) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'VIP discount is required',
          code: 'MISSING_VIP_DISCOUNT'
        }
      });
    }

    // Validate range
    const discounts = { retail, wholesale, vip };
    for (const [type, value] of Object.entries(discounts)) {
      const numValue = parseFloat(value);
      if (isNaN(numValue)) {
        return response.status(400).json({
          success: false,
          error: {
            message: `${type} discount must be a valid number`,
            code: 'INVALID_DISCOUNT_VALUE'
          }
        });
      }
      if (numValue < 0 || numValue > 100) {
        return response.status(400).json({
          success: false,
          error: {
            message: `${type} discount must be between 0 and 100`,
            code: 'DISCOUNT_OUT_OF_RANGE'
          }
        });
      }
    }

    // Get employee ID from authenticated user
    let employeeId = null;
    if (request.user.employeeId) {
      employeeId = request.user.employeeId;
    } else {
      // Try to find employee by userAccount
      const Employee = require('../models/employee');
      const employee = await Employee.findOne({ userAccount: request.user.id });
      if (employee) {
        employeeId = employee._id;
      }
    }

    // Update settings
    const settings = await SystemSettings.updateCustomerDiscounts(
      {
        retail: parseFloat(retail),
        wholesale: parseFloat(wholesale),
        vip: parseFloat(vip)
      },
      employeeId
    );

    console.log(`✅ Customer discounts updated by ${request.user.username || request.user.email}:`, {
      retail: settings.customerDiscounts.retail,
      wholesale: settings.customerDiscounts.wholesale,
      vip: settings.customerDiscounts.vip
    });

    response.json({
      success: true,
      message: 'Customer discounts updated successfully',
      data: settings.customerDiscounts
    });

  } catch (error) {
    console.error('❌ Error updating customer discounts:', error);
    response.status(500).json({
      success: false,
      error: {
        message: error.message || 'Failed to update customer discounts',
        code: 'INTERNAL_ERROR',
        details: error.message
      }
    });
  }
});

// ============ BUSINESS INFO ============

/**
 * GET /api/settings/business-info
 * Get business information
 */
settingsRouter.get('/business-info', userExtractor, async (request, response) => {
  try {
    const businessInfo = await SystemSettings.getBusinessInfo();
    
    response.json({
      success: true,
      data: businessInfo,
      message: 'Business information retrieved successfully'
    });
  } catch (error) {
    console.error('❌ Error fetching business info:', error);
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch business information',
        code: 'INTERNAL_ERROR',
        details: error.message
      }
    });
  }
});

/**
 * PUT /api/settings/business-info
 * Update business information (Admin only)
 */
settingsRouter.put('/business-info', userExtractor, requireAdmin, async (request, response) => {
  try {
    const businessInfo = request.body;

    // Get employee ID
    let employeeId = null;
    if (request.user.employeeId) {
      employeeId = request.user.employeeId;
    } else {
      const Employee = require('../models/employee');
      const employee = await Employee.findOne({ userAccount: request.user.id });
      if (employee) {
        employeeId = employee._id;
      }
    }

    // Update settings
    const settings = await SystemSettings.updateBusinessInfo(businessInfo, employeeId);

    console.log(`✅ Business info updated by ${request.user.username || request.user.email}`);

    response.json({
      success: true,
      message: 'Business information updated successfully',
      data: settings.businessInfo
    });

  } catch (error) {
    console.error('❌ Error updating business info:', error);
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to update business information',
        code: 'INTERNAL_ERROR',
        details: error.message
      }
    });
  }
});

module.exports = settingsRouter;
```

**✅ Checklist:**
- [ ] File created in `controllers/settings.js`
- [ ] All endpoints implemented
- [ ] Admin middleware added
- [ ] Error handling implemented
- [ ] Logging added

---

### Step 1.3: Update app.js to Mount Settings Router

**File: `app.js`**

Find the section where other routers are mounted and add:

```javascript
// Import settings router
const settingsRouter = require('./controllers/settings');

// Mount settings router
app.use('/api/settings', settingsRouter);
```

**Example location in app.js:**

```javascript
// ... other imports ...
const ordersRouter = require('./controllers/orders');
const paymentsRouter = require('./controllers/payments');
const settingsRouter = require('./controllers/settings'); // ADD THIS

// ... middleware setup ...

// Mount routers
app.use('/api/orders', ordersRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/settings', settingsRouter); // ADD THIS
```

**✅ Checklist:**
- [ ] Import added
- [ ] Router mounted
- [ ] Server restarted

---

### Step 1.4: Create Seed Data Script

**File: `utils/seedSettings.js`**

```javascript
const mongoose = require('mongoose');
const SystemSettings = require('../models/systemSettings');
const config = require('./config');

/**
 * Seed initial system settings
 * Run this script once to initialize default settings
 */
const seedSettings = async () => {
  try {
    console.log('🌱 Seeding system settings...');

    // Connect to database
    await mongoose.connect(config.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Customer Discounts
    const customerDiscounts = await SystemSettings.findOneAndUpdate(
      { settingKey: 'customer_discounts' },
      {
        settingKey: 'customer_discounts',
        customerDiscounts: {
          retail: 10,
          wholesale: 15,
          vip: 20
        }
      },
      { upsert: true, new: true }
    );
    console.log('✅ Customer discounts seeded:', customerDiscounts.customerDiscounts);

    // Business Info (optional)
    const businessInfo = await SystemSettings.findOneAndUpdate(
      { settingKey: 'business_info' },
      {
        settingKey: 'business_info',
        businessInfo: {
          companyName: 'Nest Mart & Grocery',
          address: '123 Main Street, City, Country',
          phone: '+84 123 456 789',
          email: 'info@nestmart.com',
          taxCode: 'TAX123456',
          website: 'https://nestmart.com'
        }
      },
      { upsert: true, new: true }
    );
    console.log('✅ Business info seeded');

    console.log('🎉 Settings seeded successfully!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error seeding settings:', error);
    process.exit(1);
  }
};

// Run if called directly
if (require.main === module) {
  seedSettings();
}

module.exports = seedSettings;
```

**Run the script:**

```bash
node utils/seedSettings.js
```

**✅ Checklist:**
- [ ] Script created
- [ ] Script executed successfully
- [ ] Settings verified in MongoDB

---

## 📝 Phase 2: Frontend Service Layer

### Step 2.1: Create Settings Service

**File: `admin/src/services/settingsService.js`**

```javascript
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

/**
 * Get authentication token from localStorage
 */
const getAuthHeader = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

/**
 * Get all system settings (Admin only)
 * @returns {Promise<Object>} { success: boolean, data: Array }
 */
export const getAllSettings = async () => {
  try {
    const response = await axios.get(`${API_URL}/settings`, {
      headers: getAuthHeader()
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching settings:', error);
    throw error.response?.data || error;
  }
};

/**
 * Get customer discount rates
 * @returns {Promise<Object>} { success: boolean, data: { retail, wholesale, vip } }
 */
export const getCustomerDiscounts = async () => {
  try {
    const response = await axios.get(`${API_URL}/settings/customer-discounts`, {
      headers: getAuthHeader()
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching customer discounts:', error);
    throw error.response?.data || error;
  }
};

/**
 * Update customer discount rates (Admin only)
 * @param {Object} discounts - { retail: Number, wholesale: Number, vip: Number }
 * @returns {Promise<Object>} { success: boolean, data: Object, message: string }
 */
export const updateCustomerDiscounts = async (discounts) => {
  try {
    const response = await axios.put(
      `${API_URL}/settings/customer-discounts`,
      discounts,
      {
        headers: getAuthHeader()
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error updating customer discounts:', error);
    throw error.response?.data || error;
  }
};

/**
 * Get business information
 * @returns {Promise<Object>} { success: boolean, data: Object }
 */
export const getBusinessInfo = async () => {
  try {
    const response = await axios.get(`${API_URL}/settings/business-info`, {
      headers: getAuthHeader()
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching business info:', error);
    throw error.response?.data || error;
  }
};

/**
 * Update business information (Admin only)
 * @param {Object} businessInfo - Business information object
 * @returns {Promise<Object>} { success: boolean, data: Object, message: string }
 */
export const updateBusinessInfo = async (businessInfo) => {
  try {
    const response = await axios.put(
      `${API_URL}/settings/business-info`,
      businessInfo,
      {
        headers: getAuthHeader()
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error updating business info:', error);
    throw error.response?.data || error;
  }
};

export default {
  getAllSettings,
  getCustomerDiscounts,
  updateCustomerDiscounts,
  getBusinessInfo,
  updateBusinessInfo
};
```

**✅ Checklist:**
- [ ] Service file created
- [ ] All API methods implemented
- [ ] Error handling added
- [ ] Auth headers configured

---

## 📝 Phase 3: Frontend UI Components

### Step 3.1: Create CustomerDiscountSettings Component

**File: `admin/src/components/Settings/CustomerDiscountSettings.jsx`**

```javascript
import React, { useState, useEffect } from 'react';
import { getCustomerDiscounts, updateCustomerDiscounts } from '../../services/settingsService';

export const CustomerDiscountSettings = () => {
  const [discounts, setDiscounts] = useState({
    retail: 10,
    wholesale: 15,
    vip: 20
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Load current settings on mount
  useEffect(() => {
    loadDiscounts();
  }, []);

  const loadDiscounts = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getCustomerDiscounts();
      setDiscounts(response.data);
    } catch (err) {
      setError(err.error?.message || 'Failed to load discount settings');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (type, value) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= 0 && numValue <= 100) {
      setDiscounts(prev => ({
        ...prev,
        [type]: numValue
      }));
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      await updateCustomerDiscounts(discounts);
      
      setSuccess('✅ Discount settings updated successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.error?.message || 'Failed to update settings');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    loadDiscounts();
    setError(null);
    setSuccess(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center space-y-3">
          <svg className="animate-spin h-8 w-8 text-blue-600" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-gray-500 text-sm">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800 font-['Poppins',sans-serif]">
            Customer Discount Configuration
          </h2>
          <p className="text-sm text-gray-600 mt-1 font-['Poppins',sans-serif]">
            Set default discount percentages for different customer types
          </p>
        </div>

        {/* Alert Messages */}
        {error && (
          <div className="mx-6 mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span className="font-['Poppins',sans-serif]">{error}</span>
            </div>
          </div>
        )}
        {success && (
          <div className="mx-6 mt-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="font-['Poppins',sans-serif]">{success}</span>
            </div>
          </div>
        )}

        {/* Settings Form */}
        <div className="p-6 space-y-6">
          {/* Retail Discount */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-gray-800 mb-1 font-['Poppins',sans-serif]">
                🛒 Retail Customers
              </label>
              <p className="text-xs text-gray-600 font-['Poppins',sans-serif]">
                Default discount for individual/retail customers
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={discounts.retail}
                onChange={(e) => handleChange('retail', e.target.value)}
                className="w-24 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center font-semibold font-['Poppins',sans-serif]"
              />
              <span className="text-gray-700 font-semibold text-lg">%</span>
            </div>
          </div>

          {/* Wholesale Discount */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-gray-800 mb-1 font-['Poppins',sans-serif]">
                📦 Wholesale Customers
              </label>
              <p className="text-xs text-gray-600 font-['Poppins',sans-serif]">
                Default discount for wholesale/bulk buyers
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={discounts.wholesale}
                onChange={(e) => handleChange('wholesale', e.target.value)}
                className="w-24 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center font-semibold font-['Poppins',sans-serif]"
              />
              <span className="text-gray-700 font-semibold text-lg">%</span>
            </div>
          </div>

          {/* VIP Discount */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-gray-800 mb-1 font-['Poppins',sans-serif]">
                ⭐ VIP Customers
              </label>
              <p className="text-xs text-gray-600 font-['Poppins',sans-serif]">
                Default discount for VIP/premium customers
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={discounts.vip}
                onChange={(e) => handleChange('vip', e.target.value)}
                className="w-24 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center font-semibold font-['Poppins',sans-serif]"
              />
              <span className="text-gray-700 font-semibold text-lg">%</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end space-x-3">
          <button
            onClick={handleReset}
            disabled={saving}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 disabled:opacity-50 transition-colors font-['Poppins',sans-serif] text-sm font-medium"
          >
            Reset
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center space-x-2 font-['Poppins',sans-serif] text-sm font-medium"
          >
            {saving ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Saving...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Info Box */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-blue-900 font-['Poppins',sans-serif]">
              How it works
            </h4>
            <p className="text-sm text-blue-700 mt-1 font-['Poppins',sans-serif]">
              These discount rates will be automatically applied when creating new orders based on the customer type. 
              You can still override the discount for individual orders if needed.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerDiscountSettings;
```

**✅ Checklist:**
- [ ] Component created
- [ ] State management implemented
- [ ] API integration completed
- [ ] Loading states added
- [ ] Error handling implemented
- [ ] Success feedback added

---

### Step 3.2: Update Navigation with Settings Menu

**Find your navigation/sidebar component and add Settings submenu:**

```javascript
// Add to navigation items
{
  id: 'settings',
  label: 'Settings',
  icon: <SettingsIcon />, // or '⚙️'
  path: '/settings',
  role: 'admin', // Only for admin
  submenu: [
    {
      id: 'customer-discounts',
      label: 'Customer Discounts',
      path: '/settings/customer-discounts'
    },
    // Future: Add more settings pages
    // {
    //   id: 'business-info',
    //   label: 'Business Info',
    //   path: '/settings/business-info'
    // }
  ]
}
```

**✅ Checklist:**
- [ ] Settings menu item added
- [ ] Submenu configured
- [ ] Admin role restriction applied
- [ ] Icons added

---

### Step 3.3: Add Routes in App.jsx

```javascript
import { CustomerDiscountSettings } from './components/Settings/CustomerDiscountSettings';

// Add route
<Route path="/settings/customer-discounts" element={<CustomerDiscountSettings />} />
```

**✅ Checklist:**
- [ ] Route imported
- [ ] Route configured
- [ ] Protected with admin check (if needed)

---

## 📝 Phase 4: Integration & Testing

### Step 4.1: Update Order Controller to Use SystemSettings

**File: `controllers/orders.js`**

Find where customer discount is calculated and update:

```javascript
const SystemSettings = require('../models/systemSettings');

// In POST /api/orders endpoint
// Replace hardcoded discount logic with:

// Get customer
const customer = await Customer.findById(request.body.customer);
if (!customer) {
  return response.status(404).json({
    success: false,
    error: { message: 'Customer not found' }
  });
}

// Get discount from system settings
const discountRates = await SystemSettings.getCustomerDiscounts();
const autoDiscountPercentage = discountRates[customer.customerType] || 0;

console.log(`📊 Auto-discount for ${customer.customerType}: ${autoDiscountPercentage}%`);
```

**✅ Checklist:**
- [ ] SystemSettings imported
- [ ] getCustomerDiscounts() called
- [ ] Discount applied from settings
- [ ] Logging added

---

### Step 4.2: End-to-End Testing

**Test Checklist:**

1. **Backend API Testing:**
   - [ ] GET /api/settings/customer-discounts returns data
   - [ ] PUT /api/settings/customer-discounts updates successfully
   - [ ] Admin authentication works
   - [ ] Non-admin users cannot update
   - [ ] Validation works (0-100 range)

2. **Frontend UI Testing:**
   - [ ] Settings page loads
   - [ ] Current discounts display correctly
   - [ ] Input changes work
   - [ ] Save button updates backend
   - [ ] Reset button reloads data
   - [ ] Success/error messages show
   - [ ] Loading states work

3. **Integration Testing:**
   - [ ] Update discount in settings
   - [ ] Create new order with retail customer
   - [ ] Verify discount applied automatically
   - [ ] Repeat for wholesale and VIP
   - [ ] Verify invoice shows correct discount

**Test Script:**

```bash
# 1. Update discounts
curl -X PUT http://localhost:3001/api/settings/customer-discounts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"retail": 12, "wholesale": 18, "vip": 25}'

# 2. Create order and verify discount
curl -X POST http://localhost:3001/api/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"customer": "CUSTOMER_ID", "items": [...]}'

# 3. Check order discount percentage
```

---

## 📝 Phase 5: Documentation & Polish

### Step 5.1: Add Comments & Documentation

**Ensure all files have:**
- [ ] File header comments
- [ ] Function documentation
- [ ] Parameter descriptions
- [ ] Return value descriptions
- [ ] Usage examples

### Step 5.2: UI/UX Polish

- [ ] Consistent spacing and padding
- [ ] Proper color scheme
- [ ] Loading states smooth
- [ ] Error messages clear
- [ ] Success feedback visible
- [ ] Mobile responsive

### Step 5.3: Error Handling Review

- [ ] All API errors caught
- [ ] User-friendly error messages
- [ ] Console errors logged
- [ ] Validation errors clear
- [ ] Network errors handled

---

## 🚀 Deployment Checklist

### Pre-deployment:
- [ ] All tests passing
- [ ] No console errors
- [ ] Environment variables configured
- [ ] Database migrations (if needed)
- [ ] Seed data ready

### Deployment:
- [ ] Backend deployed
- [ ] Frontend deployed
- [ ] Environment variables set
- [ ] Database connected
- [ ] Seed data executed

### Post-deployment:
- [ ] Smoke tests passed
- [ ] Admin can access settings
- [ ] Settings update works
- [ ] Orders use new discounts
- [ ] Monitoring in place

---

## 📚 Future Enhancements

### Phase 6: Additional Settings (Future)

1. **Business Information:**
   - Company name, address, contact
   - Tax information
   - Logo upload

2. **Email/SMS Templates:**
   - Order confirmation template
   - Payment receipt template
   - Shipping notification template

3. **General Settings:**
   - Currency settings
   - Time zone
   - Date format
   - Language preferences

4. **Tax Configuration:**
   - Tax rates by region
   - Tax exemptions
   - VAT settings

5. **Notification Settings:**
   - Email notifications
   - SMS alerts
   - Push notifications

---

## 🐛 Troubleshooting

### Common Issues:

**1. "Settings not found" error:**
- Run seed script: `node utils/seedSettings.js`
- Check MongoDB connection
- Verify collection exists

**2. "Admin privileges required":**
- Check user role in database
- Verify JWT token includes role
- Update auth middleware

**3. Discounts not applying to orders:**
- Verify SystemSettings.getCustomerDiscounts() is called
- Check customer type mapping
- Review order controller logic
- Check console logs

**4. Frontend not loading settings:**
- Check API URL in service
- Verify CORS settings
- Check network tab for errors
- Verify authentication token

---

## 📝 Notes

- Always backup database before running migrations
- Test in development environment first
- Keep seed data script for easy reset
- Document any custom configurations
- Monitor performance impact
- Consider caching for frequently accessed settings

---

## ✅ Final Verification

Before marking complete:
- [ ] All phases completed
- [ ] All tests passing
- [ ] Documentation updated
- [ ] Code reviewed
- [ ] Deployed to staging
- [ ] User acceptance testing done
- [ ] Production deployment ready

---

**Document Version:** 1.0  
**Last Updated:** 2025-11-24  
**Author:** System  
**Status:** Complete
