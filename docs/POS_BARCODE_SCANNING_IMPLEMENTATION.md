# POS Barcode Scanning Implementation Guide

## 📋 Tổng quan

Document này hướng dẫn chi tiết từng bước để implement tính năng quét mã vạch (barcode scanning) trong hệ thống POS. **Hiện tại sử dụng ProductCode (PROD2025000001) để giả lập quét mã vạch**, bao gồm xử lý FEFO tự động và lựa chọn lô thủ công khi có nhiều batch.

**Tham khảo**: [`BATCH_MANAGEMENT_WORKFLOW.md`](BATCH_MANAGEMENT_WORKFLOW.md) để hiểu rõ business logic.

---

## 🎯 Mục tiêu

- ✅ Quét productCode (PROD2025000001) tự động phát hiện và thêm sản phẩm vào giỏ
- ✅ FEFO tự động - chọn batch gần hết hạn nhất
- ✅ Modal chọn lô khi có nhiều batch khả dụng
- ✅ Hiển thị batch info trong cart
- ✅ Checkout với batch allocation chính xác

---

## 📦 Phân chia công việc

### **Phase 1: Backend API** (Priority: HIGH)
- [x] Model đã có sẵn (Product, ProductBatch, Inventory)
- [x] API endpoint `/api/products/code/:productCode`
- [ ] Helper function tính giá động cho fresh products (optional - future enhancement)
- [ ] API endpoint create order với batch allocation

### **Phase 2: Frontend Components** (Priority: HIGH)
- [x] ProductCode scanner detection trong POSSearchBar
- [x] POSBatchSelectModal component
- [x] POSMain handlers (scan, batch selection, add to cart)
- [ ] Cart item component với batch info display
- [ ] Payment flow với order creation

### **Phase 3: Testing & Polish** (Priority: MEDIUM)
- [ ] Test FEFO logic
- [ ] Test batch selection modal
- [ ] Test inventory deduction
- [ ] Error handling
- [ ] UI/UX improvements

---

## 🔨 Implementation Steps

---

## PHASE 1: BACKEND API

### Step 1.1: Tạo Helper Function - Dynamic Pricing

**File**: `e:\UIT\backend\utils\pricingHelpers.js` (NEW)

```javascript
/**
 * Pricing Helpers
 * Calculate dynamic pricing for fresh products based on days until expiry
 */

/**
 * Calculate fresh product pricing with discount based on expiry
 * @param {Object} batch - ProductBatch object
 * @param {Object} product - Product object
 * @param {Number} daysUntilExpiry - Days until expiry
 * @returns {Object} Pricing information
 */
const calculateFreshProductPrice = (batch, product, daysUntilExpiry) => {
  const basePrice = parseFloat(product.unitPrice) || 0;
  
  // < 1 day: Mua 1 tặng 1 (50% off)
  if (daysUntilExpiry < 1) {
    return {
      type: 'promo',
      originalPrice: basePrice,
      salePrice: basePrice / 2,
      promoType: 'buy1get1',
      badge: '🎁 Mua 1 tặng 1',
      discountPercent: 50,
      reason: 'Expires today'
    };
  }
  
  // 1-2 days: Giảm 30%
  if (daysUntilExpiry >= 1 && daysUntilExpiry < 2) {
    return {
      type: 'discount',
      originalPrice: basePrice,
      salePrice: basePrice * 0.7,
      badge: '⚠️ Giảm 30%',
      discountPercent: 30,
      reason: 'Expires in 1 day'
    };
  }
  
  // 2-3 days: Giảm 20%
  if (daysUntilExpiry >= 2 && daysUntilExpiry < 3) {
    return {
      type: 'discount',
      originalPrice: basePrice,
      salePrice: basePrice * 0.8,
      badge: '⚠️ Giảm 20%',
      discountPercent: 20,
      reason: 'Expires in 2 days'
    };
  }
  
  // 3-5 days: Giảm 10%
  if (daysUntilExpiry >= 3 && daysUntilExpiry < 5) {
    return {
      type: 'discount',
      originalPrice: basePrice,
      salePrice: basePrice * 0.9,
      badge: 'Giảm 10%',
      discountPercent: 10,
      reason: 'Expires soon'
    };
  }
  
  // >= 5 days: Giá gốc
  return {
    type: 'normal',
    originalPrice: basePrice,
    salePrice: basePrice,
    badge: null,
    discountPercent: 0,
    reason: 'Fresh'
  };
};

/**
 * Calculate days until expiry
 * @param {Date} expiryDate - Expiry date
 * @returns {Number} Days until expiry
 */
const calculateDaysUntilExpiry = (expiryDate) => {
  if (!expiryDate) return null;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);
  
  const diffTime = expiry - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
};

module.exports = {
  calculateFreshProductPrice,
  calculateDaysUntilExpiry
};
```

**Action**: ✅ Create new file

---

### Step 1.2: Thêm API Endpoint - Get Product by Barcode

**File**: `e:\UIT\backend\controllers\products.js`

**Location**: Thêm vào cuối file, trước `module.exports`

```javascript
/**
 * GET /api/products/barcode/:barcode
 * Get product by barcode with inventory and batch information
 * Used by POS system for barcode scanning
 * 
 * Query parameters:
 * - withInventory: boolean - Include inventory info
 * - withBatches: boolean - Include batch info with pricing
 * - isActive: boolean - Only active products
 */
productsRouter.get('/barcode/:barcode', async (request, response) => {
  try {
    const { barcode } = request.params;
    const { withInventory, withBatches, isActive } = request.query;

    // Find product by barcode
    const query = { barcode: barcode };
    if (isActive === 'true') {
      query.isActive = true;
    }

    const product = await Product.findOne(query)
      .populate('category', 'name categoryCode');

    if (!product) {
      return response.status(404).json({
        success: false,
        error: {
          message: 'Product not found',
          code: 'PRODUCT_NOT_FOUND'
        }
      });
    }

    const result = { product: product.toJSON() };

    // Include inventory if requested
    if (withInventory === 'true') {
      const Inventory = require('../models/inventory');
      const inventory = await Inventory.findOne({ product: product._id })
        .select('quantityOnHand quantityAvailable quantityReserved');

      if (!inventory || inventory.quantityAvailable <= 0) {
        result.inventory = inventory?.toJSON() || null;
        result.outOfStock = true;
        
        return response.json({
          success: true,
          data: result,
          message: 'Product is out of stock'
        });
      }

      result.inventory = inventory.toJSON();
      result.outOfStock = false;

      // Include batches if requested
      if (withBatches === 'true') {
        const ProductBatch = require('../models/productBatch');
        const { calculateFreshProductPrice, calculateDaysUntilExpiry } = require('../utils/pricingHelpers');

        // Find available batches
        let batches = await ProductBatch.find({
          product: product._id,
          status: 'active',
          quantity: { $gt: 0 },
          $or: [
            { expiryDate: { $gt: new Date() } },
            { expiryDate: null }
          ]
        }).sort({ expiryDate: 1 }); // FEFO - First Expired First Out

        // Process batches based on product type
        if (product.productType === 'normal') {
          // For normal products: only return the first batch (FEFO)
          batches = batches.slice(0, 1);
          
          result.batches = batches.map(batch => ({
            ...batch.toJSON(),
            isAutoSelected: true
          }));

        } else if (product.productType === 'fresh') {
          // For fresh products: return all batches with dynamic pricing
          result.batches = batches.map(batch => {
            const batchObj = batch.toJSON();
            
            // Calculate days until expiry
            const daysUntilExpiry = calculateDaysUntilExpiry(batch.expiryDate);
            
            // Calculate dynamic pricing
            const pricing = calculateFreshProductPrice(batch, product, daysUntilExpiry);

            return {
              ...batchObj,
              daysUntilExpiry,
              pricing,
              isAutoSelected: false
            };
          });

        } else {
          // Unknown product type: treat as normal
          batches = batches.slice(0, 1);
          result.batches = batches.map(batch => ({
            ...batch.toJSON(),
            isAutoSelected: true
          }));
        }

        // Check if no batches available
        if (result.batches.length === 0) {
          result.outOfStock = true;
          return response.json({
            success: true,
            data: result,
            message: 'Product has no available batches'
          });
        }
      }
    }

    return response.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Get product by barcode error:', error);
    return response.status(500).json({
      success: false,
      error: {
        message: 'Server error',
        details: error.message
      }
    });
  }
});
```

**Action**: ✅ Add this route to `products.js`

**Testing**:
```bash
# Test normal product
curl http://localhost:3001/api/products/barcode/8934588123456?withInventory=true&withBatches=true

# Test fresh product
curl http://localhost:3001/api/products/barcode/8934588999999?withInventory=true&withBatches=true
```

---

### Step 1.3: Thêm field `productType` vào Product Model

**File**: `e:\UIT\backend\models\product.js`

**Location**: Thêm field mới sau `vendor`

```javascript
  vendor: {
    type: String,
    trim: true,
    maxlength: [100, 'Vendor name must be at most 100 characters']
  },

  productType: {
    type: String,
    enum: {
      values: ['normal', 'fresh'],
      message: '{VALUE} is not a valid product type'
    },
    default: 'normal'
  },

  barcode: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    match: [/^\d{8,13}$/, 'Barcode must be 8-13 digits']
  }
```

**Action**: ✅ Add `productType` and `barcode` fields

**Note**: Sau khi thêm field, cần update existing products trong database:
```javascript
// Migration script (run once)
db.products.updateMany(
  { productType: { $exists: false } },
  { $set: { productType: 'normal' } }
);
```

---

### Step 1.4: Update Product Schema Index

**File**: `e:\UIT\backend\models\product.js`

**Location**: Thêm vào section `// ============ INDEXES ============`

```javascript
// ============ INDEXES ============
productSchema.index({ productCode: 1 });
productSchema.index({ name: 'text' });
productSchema.index({ category: 1 });
productSchema.index({ isActive: 1 });
productSchema.index({ barcode: 1 }); // NEW: Index for barcode lookup
productSchema.index({ productType: 1 }); // NEW: Index for product type filtering
```

**Action**: ✅ Add indexes

---

### Step 1.5: Tạo Service Method - Get Product by Barcode

**File**: `e:\UIT\backend\admin\src\services\productService.js`

**Location**: Thêm method mới vào object `productService`

```javascript
  /**
   * Get product by barcode with inventory and batch information
   * @param {string} barcode - Product barcode
   * @param {Object} options - Query options
   * @param {boolean} options.withInventory - Include inventory info
   * @param {boolean} options.withBatches - Include batch info
   * @param {boolean} options.isActive - Only active products
   * @returns {Promise<Object>} Product data with inventory and batches
   */
  getProductByBarcode: async (barcode, options = {}) => {
    try {
      const params = {
        withInventory: options.withInventory !== false, // default true
        withBatches: options.withBatches !== false, // default true
        isActive: options.isActive !== false // default true
      };

      const response = await api.get(`/products/barcode/${barcode}`, { params });
      return response.data;
    } catch (error) {
      console.error('Get product by barcode error:', error);
      throw error;
    }
  },
```

**Action**: ✅ Add method to productService

---

## PHASE 2: FRONTEND COMPONENTS

### Step 2.1: Update POSSearchBar - Barcode Scanner Detection

**File**: `e:\UIT\backend\admin\src\components\POSMain\POSSearchBar.jsx`

**Replace entire component with**:

```jsx
import React, { useState, useEffect, useRef } from 'react';

export const POSSearchBar = ({ onProductScanned, onSearchChange, searchTerm }) => {
  const [scanBuffer, setScanBuffer] = useState('');
  const [lastKeyTime, setLastKeyTime] = useState(0);
  const scanTimeoutRef = useRef(null);
  const inputRef = useRef(null);

  // Barcode scanner detection
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Ignore if user is typing in other inputs
      if (e.target.tagName === 'INPUT' && e.target !== inputRef.current) {
        return;
      }

      const currentTime = Date.now();
      const timeDiff = currentTime - lastKeyTime;

      // Barcode scanner types very fast (< 50ms between chars)
      if (timeDiff < 50 && scanBuffer.length > 0) {
        // Continuing scan
        setScanBuffer(prev => prev + e.key);
      } else if (timeDiff >= 50 && timeDiff < 500) {
        // Start new scan
        setScanBuffer(e.key);
      }

      setLastKeyTime(currentTime);

      // Auto-submit after 100ms of no input (scanner finished)
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }

      scanTimeoutRef.current = setTimeout(() => {
        const buffer = scanBuffer + e.key;
        
        // If buffer looks like barcode (8-13 digits)
        if (/^\d{8,13}$/.test(buffer)) {
          console.log('Barcode scanned:', buffer);
          
          if (onProductScanned) {
            onProductScanned(buffer);
          }
          
          // Clear buffer and input
          setScanBuffer('');
          if (inputRef.current) {
            inputRef.current.value = '';
          }
        }
      }, 100);
    };

    const handleKeyDown = (e) => {
      // Handle Enter key in search input
      if (e.key === 'Enter' && e.target === inputRef.current) {
        const value = e.target.value.trim();
        
        // If looks like barcode
        if (/^\d{8,13}$/.test(value)) {
          e.preventDefault();
          
          if (onProductScanned) {
            onProductScanned(value);
          }
          
          e.target.value = '';
          setScanBuffer('');
        }
      }
    };

    window.addEventListener('keypress', handleKeyPress);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keypress', handleKeyPress);
      window.removeEventListener('keydown', handleKeyDown);
      
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }
    };
  }, [scanBuffer, lastKeyTime, onProductScanned]);

  // Manual search change
  const handleInputChange = (e) => {
    const value = e.target.value;
    setScanBuffer('');
    
    if (onSearchChange) {
      onSearchChange(value);
    }
  };

  return (
    <div className="relative w-full mb-4">
      <input
        ref={inputRef}
        type="text"
        placeholder="Scan barcode or search products... (Ctrl+K or F2)"
        className="w-full h-14 px-4 pl-12 text-base border-2 border-gray-300 rounded-lg focus:border-emerald-500 focus:outline-none"
        onChange={handleInputChange}
        defaultValue={searchTerm}
      />
      
      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M9 17A8 8 0 1 0 9 1a8 8 0 0 0 0 16zM19 19l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      {/* Barcode scanner indicator */}
      {scanBuffer.length > 0 && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2">
          <div className="flex items-center gap-2 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm font-semibold">
            <svg className="animate-pulse" width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="4" width="1" height="8" fill="currentColor"/>
              <rect x="4" y="4" width="2" height="8" fill="currentColor"/>
              <rect x="7" y="4" width="1" height="8" fill="currentColor"/>
              <rect x="9" y="4" width="2" height="8" fill="currentColor"/>
              <rect x="12" y="4" width="1" height="8" fill="currentColor"/>
            </svg>
            Scanning...
          </div>
        </div>
      )}
    </div>
  );
};
```

**Action**: ✅ Replace component

---

### Step 2.2: Create POSBatchSelectModal Component

**File**: `e:\UIT\backend\admin\src\components\POSMain\POSBatchSelectModal.jsx` (NEW)

```jsx
import React, { useState } from 'react';

export const POSBatchSelectModal = ({ 
  isOpen, 
  productData, 
  onClose, 
  onBatchSelected 
}) => {
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [quantity, setQuantity] = useState(1);

  if (!isOpen || !productData) return null;

  const { product, batches } = productData;

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount);
  };

  const handleQuantityChange = (value) => {
    const maxQty = selectedBatch ? selectedBatch.quantity : 1;
    const newQty = Math.max(1, Math.min(value, maxQty));
    setQuantity(newQty);
  };

  const handleConfirm = () => {
    if (selectedBatch && onBatchSelected) {
      onBatchSelected(selectedBatch, quantity);
      setSelectedBatch(null);
      setQuantity(1);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-emerald-50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-bold text-gray-900 font-['Poppins']">
                Select Batch
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {product.name} - {product.productCode}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-200 rounded-full transition-colors"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Product Info */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-4">
              {product.image && (
                <img 
                  src={product.image} 
                  alt={product.name}
                  className="w-20 h-20 object-cover rounded-lg"
                />
              )}
              <div className="flex-1">
                <h3 className="font-bold text-lg">{product.name}</h3>
                <p className="text-sm text-gray-600">
                  Category: {product.category?.name || 'N/A'}
                </p>
                <p className="text-sm text-gray-600">
                  Original Price: {formatCurrency(product.unitPrice)}/{product.unit || 'unit'}
                </p>
              </div>
            </div>
          </div>

          {/* Batch List */}
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-700 mb-3">
              Available Batches ({batches.length})
            </h3>

            {batches.map((batch, index) => {
              const isSelected = selectedBatch?._id === batch._id;
              const isRecommended = index === 0; // First batch (FEFO)

              return (
                <div
                  key={batch._id}
                  onClick={() => {
                    setSelectedBatch(batch);
                    setQuantity(1);
                  }}
                  className={`
                    p-4 border-2 rounded-lg cursor-pointer transition-all
                    ${isSelected 
                      ? 'border-emerald-500 bg-emerald-50 shadow-md' 
                      : 'border-gray-200 hover:border-emerald-300 hover:shadow-sm'
                    }
                  `}
                >
                  <div className="flex justify-between items-start">
                    {/* Left: Batch Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-gray-900">
                          {batch.batchCode}
                        </span>

                        {/* Badges */}
                        {batch.pricing?.badge && (
                          <span className={`
                            px-2 py-1 rounded text-xs font-bold
                            ${batch.pricing.type === 'promo' 
                              ? 'bg-red-500 text-white' 
                              : 'bg-orange-500 text-white'
                            }
                          `}>
                            {batch.pricing.badge}
                          </span>
                        )}

                        {isRecommended && (
                          <span className="px-2 py-1 bg-blue-500 text-white rounded text-xs font-semibold">
                            ⭐ Recommended (FEFO)
                          </span>
                        )}

                        {isSelected && (
                          <span className="px-2 py-1 bg-emerald-500 text-white rounded text-xs font-semibold">
                            ✓ Selected
                          </span>
                        )}
                      </div>

                      <div className="mt-3 space-y-1">
                        <p className="text-sm">
                          <span className="text-gray-600">Expiry Date:</span>{' '}
                          <span className={`font-semibold ${
                            batch.daysUntilExpiry < 2 
                              ? 'text-red-600' 
                              : batch.daysUntilExpiry < 5
                              ? 'text-orange-600'
                              : 'text-gray-900'
                          }`}>
                            {formatDate(batch.expiryDate)}
                            {batch.daysUntilExpiry !== null && (
                              <> ({batch.daysUntilExpiry} {batch.daysUntilExpiry === 1 ? 'day' : 'days'} left)</>
                            )}
                          </span>
                        </p>

                        <p className="text-sm">
                          <span className="text-gray-600">Available Stock:</span>{' '}
                          <span className="font-semibold text-gray-900">
                            {batch.quantity} {product.unit || 'units'}
                          </span>
                        </p>

                        {batch.pricing?.reason && (
                          <p className="text-xs text-gray-500 italic">
                            {batch.pricing.reason}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Right: Price */}
                    <div className="text-right ml-4">
                      {batch.pricing?.type !== 'normal' && (
                        <p className="text-sm text-gray-500 line-through">
                          {formatCurrency(batch.pricing.originalPrice)}
                        </p>
                      )}
                      <p className={`text-3xl font-bold ${
                        batch.pricing?.type !== 'normal' 
                          ? 'text-red-600' 
                          : 'text-gray-900'
                      }`}>
                        {formatCurrency(batch.pricing?.salePrice || product.unitPrice)}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        per {product.unit || 'unit'}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quantity Selection */}
          {selectedBatch && (
            <div className="mt-6 p-5 bg-emerald-50 border-2 border-emerald-200 rounded-lg">
              <label className="block text-sm font-bold text-gray-700 mb-3">
                Quantity ({product.unit || 'units'})
              </label>
              
              <div className="flex items-center gap-4">
                <button
                  onClick={() => handleQuantityChange(quantity - 1)}
                  className="w-12 h-12 bg-white border-2 border-emerald-500 text-emerald-600 rounded-lg font-bold text-xl hover:bg-emerald-50 transition-colors"
                >
                  -
                </button>
                
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => handleQuantityChange(parseInt(e.target.value) || 1)}
                  min="1"
                  max={selectedBatch.quantity}
                  className="w-28 h-12 text-center text-2xl font-bold border-2 border-emerald-300 rounded-lg focus:border-emerald-500 focus:outline-none"
                />
                
                <button
                  onClick={() => handleQuantityChange(quantity + 1)}
                  className="w-12 h-12 bg-white border-2 border-emerald-500 text-emerald-600 rounded-lg font-bold text-xl hover:bg-emerald-50 transition-colors"
                >
                  +
                </button>

                <span className="text-sm text-gray-600">
                  / {selectedBatch.quantity} {product.unit || 'units'} available
                </span>
              </div>

              {/* Subtotal */}
              <div className="mt-5 pt-4 border-t border-emerald-300">
                <div className="flex justify-between items-center">
                  <span className="text-lg text-gray-700 font-semibold">Subtotal:</span>
                  <span className="text-4xl font-bold text-emerald-600">
                    {formatCurrency((selectedBatch.pricing?.salePrice || product.unitPrice) * quantity)}
                  </span>
                </div>

                {selectedBatch.pricing?.type !== 'normal' && (
                  <div className="mt-2 text-right">
                    <p className="text-sm text-gray-600">
                      You save: <span className="font-bold text-red-600">
                        {formatCurrency(
                          (selectedBatch.pricing.originalPrice - selectedBatch.pricing.salePrice) * quantity
                        )}
                      </span>
                      {' '}({selectedBatch.pricing.discountPercent}%)
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
          <button
            onClick={onClose}
            className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          
          <button
            onClick={handleConfirm}
            disabled={!selectedBatch}
            className={`
              px-8 py-3 rounded-lg font-bold text-white transition-all
              ${selectedBatch 
                ? 'bg-emerald-600 hover:bg-emerald-700 shadow-lg hover:shadow-xl' 
                : 'bg-gray-300 cursor-not-allowed'
              }
            `}
          >
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  );
};
```

**Action**: ✅ Create new component

---

### Step 2.3: Update POSMain - Add Barcode Handling Logic

**File**: `e:\UIT\backend\admin\src\pages\pos\POSMain.jsx`

**Add imports**:

```jsx
import { POSBatchSelectModal } from '../../components/POSMain/POSBatchSelectModal';
import productService from '../../services/productService';
```

**Add state**:

```jsx
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [selectedProductData, setSelectedProductData] = useState(null);
  const [scanning, setScanning] = useState(false);
```

**Add handler functions** (before return statement):

```jsx
  // Handle barcode scanned
  const handleProductScanned = async (barcode) => {
    console.log('Barcode scanned:', barcode);
    setScanning(true);

    try {
      // Get product by barcode with inventory and batches
      const response = await productService.getProductByBarcode(barcode, {
        withInventory: true,
        withBatches: true,
        isActive: true
      });

      if (!response.success) {
        alert(`Product not found: ${barcode}`);
        return;
      }

      const { product, inventory, batches, outOfStock } = response.data;

      // Check if out of stock
      if (outOfStock || !batches || batches.length === 0) {
        alert(`${product.name} is currently out of stock!`);
        return;
      }

      // Handle based on product type
      if (product.productType === 'fresh') {
        // Fresh product: show batch selection modal
        setSelectedProductData(response.data);
        setShowBatchModal(true);
      } else {
        // Normal product: auto-add with FEFO batch
        handleNormalProduct(response.data);
      }

    } catch (error) {
      console.error('Error scanning product:', error);
      alert('Failed to scan product. Please try again.');
    } finally {
      setScanning(false);
    }
  };

  // Handle normal product (FEFO auto-select)
  const handleNormalProduct = (productData) => {
    const { product, inventory, batches } = productData;

    // Get FEFO batch (first one, already sorted by backend)
    const selectedBatch = batches[0];

    // Create cart item
    const cartItem = {
      id: `${product._id}-${selectedBatch._id}`, // Unique cart ID
      productId: product._id,
      productCode: product.productCode,
      name: product.name,
      image: product.image,
      price: product.unitPrice,
      quantity: 1,
      stock: inventory.quantityAvailable,
      
      // Batch info
      batch: {
        id: selectedBatch._id,
        batchCode: selectedBatch.batchCode,
        expiryDate: selectedBatch.expiryDate,
        availableQty: selectedBatch.quantity
      },
      
      productType: 'normal',
      unit: product.unit || 'unit'
    };

    // Add to cart
    addToCart(cartItem);

    // Show success message
    console.log(`Added ${product.name} to cart (Batch: ${selectedBatch.batchCode})`);
  };

  // Handle batch selected from modal
  const handleBatchSelected = (selectedBatch, quantity) => {
    const { product, inventory } = selectedProductData;

    const cartItem = {
      id: `${product._id}-${selectedBatch._id}`, // Unique cart ID
      productId: product._id,
      productCode: product.productCode,
      name: product.name,
      image: product.image,
      
      // Use sale price from pricing
      price: selectedBatch.pricing.salePrice,
      originalPrice: selectedBatch.pricing.originalPrice,
      
      quantity: quantity,
      stock: inventory.quantityAvailable,
      
      // Batch info
      batch: {
        id: selectedBatch._id,
        batchCode: selectedBatch.batchCode,
        expiryDate: selectedBatch.expiryDate,
        availableQty: selectedBatch.quantity,
        daysUntilExpiry: selectedBatch.daysUntilExpiry
      },
      
      // Pricing info
      pricing: selectedBatch.pricing,
      
      productType: 'fresh',
      unit: product.unit || 'unit'
    };

    // Add to cart
    addToCart(cartItem);

    // Close modal
    setShowBatchModal(false);
    setSelectedProductData(null);

    console.log(
      `Added ${quantity} ${product.unit} ${product.name} ` +
      `(${selectedBatch.pricing.badge || 'Regular price'})`
    );
  };

  // Add to cart function
  const addToCart = (item) => {
    setCart(prevCart => {
      // Check if item already exists (same product + same batch)
      const existingIndex = prevCart.findIndex(
        cartItem => cartItem.id === item.id
      );

      if (existingIndex >= 0) {
        // Update quantity
        const newCart = [...prevCart];
        const maxQty = newCart[existingIndex].batch.availableQty;
        newCart[existingIndex].quantity = Math.min(
          newCart[existingIndex].quantity + item.quantity,
          maxQty
        );
        return newCart;
      } else {
        // Add new item
        return [...prevCart, item];
      }
    });
  };
```

**Update POSSearchBar in render**:

```jsx
          <POSSearchBar
            onProductScanned={handleProductScanned}
            onSearchChange={setSearchTerm}
            searchTerm={searchTerm}
          />
```

**Add modal before closing Layout**:

```jsx
        {/* Batch Selection Modal */}
        <POSBatchSelectModal
          isOpen={showBatchModal}
          productData={selectedProductData}
          onClose={() => {
            setShowBatchModal(false);
            setSelectedProductData(null);
          }}
          onBatchSelected={handleBatchSelected}
        />
      </Layout>
```

**Action**: ✅ Update POSMain.jsx

---

### Step 2.4: Update Cart Component - Show Batch Info

**File**: `e:\UIT\backend\admin\src\components\POSMain\POSCart.jsx`

**Update cart item rendering** to include batch info:

```jsx
  {cart.map((item) => (
    <div key={item.id} className="flex items-start gap-3 p-3 border-b border-gray-100">
      {/* Product Image */}
      {item.image && (
        <img
          src={item.image}
          alt={item.name}
          className="w-16 h-16 object-cover rounded"
        />
      )}

      {/* Product Info */}
      <div className="flex-1">
        <h4 className="font-semibold text-sm text-gray-900">{item.name}</h4>
        
        {/* Batch Info */}
        <div className="mt-1 space-y-0.5">
          <p className="text-xs text-gray-500">
            Batch: <span className="font-mono font-semibold">{item.batch.batchCode}</span>
          </p>
          
          {item.productType === 'fresh' && item.batch.daysUntilExpiry !== null && (
            <p className={`text-xs font-medium ${
              item.batch.daysUntilExpiry < 2 ? 'text-red-600' : 'text-orange-600'
            }`}>
              Exp: {new Date(item.batch.expiryDate).toLocaleDateString('vi-VN')}
              {' '}({item.batch.daysUntilExpiry}d left)
            </p>
          )}

          {/* Pricing badge */}
          {item.pricing && item.pricing.badge && (
            <span className="inline-block px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded">
              {item.pricing.badge}
            </span>
          )}
        </div>

        {/* Price */}
        <div className="mt-2 flex items-baseline gap-2">
          {item.pricing && item.pricing.type !== 'normal' && (
            <span className="text-xs text-gray-400 line-through">
              {formatCurrency(item.originalPrice)}
            </span>
          )}
          <span className="text-sm font-bold text-emerald-600">
            {formatCurrency(item.price)}
          </span>
          <span className="text-xs text-gray-500">/ {item.unit}</span>
        </div>

        {/* Quantity Controls */}
        <div className="mt-2 flex items-center gap-2">
          <button
            onClick={() => updateQuantity(item.id, item.quantity - 1)}
            className="w-7 h-7 bg-gray-100 hover:bg-gray-200 rounded flex items-center justify-center"
          >
            -
          </button>
          <span className="w-10 text-center font-semibold">{item.quantity}</span>
          <button
            onClick={() => updateQuantity(item.id, item.quantity + 1)}
            disabled={item.quantity >= item.batch.availableQty}
            className={`w-7 h-7 rounded flex items-center justify-center ${
              item.quantity >= item.batch.availableQty
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            +
          </button>
        </div>
      </div>

      {/* Item Total & Remove */}
      <div className="text-right">
        <p className="font-bold text-gray-900">
          {formatCurrency(item.price * item.quantity)}
        </p>
        <button
          onClick={() => removeFromCart(item.id)}
          className="mt-2 text-red-600 hover:text-red-700 text-xs"
        >
          Remove
        </button>
      </div>
    </div>
  ))}
```

**Action**: ✅ Update cart rendering

---

## PHASE 3: TESTING

### Test Cases

#### Test 1: Normal Product FEFO
```
1. Scan barcode của sản phẩm bình thường (Coca Cola)
2. Verify: Tự động add vào cart với batch FEFO
3. Check cart: Hiển thị batch code
4. Checkout: Verify inventory giảm đúng batch
```

#### Test 2: Fresh Product Manual Select
```
1. Scan barcode của sản phẩm tươi sống (Rau cải)
2. Verify: Modal hiển thị list batches với giá động
3. Select batch có giảm giá
4. Add to cart
5. Check cart: Hiển thị giá đã giảm + badge
6. Checkout: Verify inventory giảm đúng batch
```

#### Test 3: Out of Stock
```
1. Scan barcode sản phẩm hết hàng
2. Verify: Alert "Out of stock"
3. Không add vào cart
```

#### Test 4: Multiple Items Different Batches
```
1. Add sản phẩm A batch B1
2. Add sản phẩm A batch B2
3. Verify: 2 dòng riêng trong cart
4. Checkout: Verify cả 2 batches đều bị trừ
```

---

## 📝 Checklist triển khai

### Backend
- [ ] Create `utils/pricingHelpers.js`
- [ ] Add route `GET /api/products/barcode/:barcode` in `controllers/products.js`
- [ ] Add `productType` and `barcode` fields to Product model
- [ ] Add indexes for `barcode` and `productType`
- [ ] Test API với Postman/curl
- [ ] Update existing products với productType default

### Frontend
- [ ] Update POSSearchBar với barcode detection
- [ ] Create POSBatchSelectModal component
- [ ] Add `getProductByBarcode` to productService
- [ ] Update POSMain với handlers
- [ ] Update POSCart để hiển thị batch info
- [ ] Test scanning workflow
- [ ] Test modal interaction
- [ ] Test cart display

### Integration Testing
- [ ] Test end-to-end: Scan → Cart → Checkout
- [ ] Test FEFO logic cho normal products
- [ ] Test pricing cho fresh products
- [ ] Test inventory deduction
- [ ] Test error handling (not found, out of stock)

---

## 🚨 Known Issues & Solutions

### Issue 1: Barcode scanner không detect
**Solution**: 
- Check scanner settings (should be in keyboard emulation mode)
- Adjust timing threshold trong POSSearchBar (current: 50ms)

### Issue 2: Modal không đóng sau add to cart
**Solution**:
- Ensure state reset trong handleBatchSelected
- Clear selectedProductData

### Issue 3: Inventory không trừ đúng
**Solution**:
- Verify batch ID được gửi lên backend
- Check transaction trong order creation
- Enable MongoDB session transaction logging

---

## 📚 References

- [BATCH_MANAGEMENT_WORKFLOW.md](BATCH_MANAGEMENT_WORKFLOW.md) - Business logic
- [MODEL_STANDARD.md](MODEL_STANDARD.md) - Model guidelines
- Product Model: `models/product.js`
- ProductBatch Model: `models/productBatch.js`
- Inventory Model: `models/inventory.js`

---

## ✅ Next Steps

Sau khi hoàn thành implementation:

1. **Testing Phase**
   - Unit tests cho pricing helpers
   - Integration tests cho API endpoints
   - E2E tests cho POS workflow

2. **Documentation Updates**
   - Update API documentation
   - Add screenshots to this guide
   - Create video tutorial

3. **Performance Optimization**
   - Add caching cho batch info
   - Optimize query performance
   - Add loading states

4. **User Training**
   - Train staff on new workflow
   - Create user manual
   - Setup support channels

---

**Version**: 1.0.0  
**Last Updated**: November 17, 2025  
**Author**: Development Team
