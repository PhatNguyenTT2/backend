# AddOrderModal Implementation Guide

## 📋 Tổng quan

Document này hướng dẫn chi tiết cách implement **AddOrderModal** - Component tạo đơn hàng mới với logic FEFO (First Expired First Out) tự động chọn batch.

**Đặc điểm chính:**
- User chỉ cần chọn **Product** và **Quantity**
- Backend tự động chọn **Batch** gần hết hạn nhất (FEFO)
- **UnitPrice** lấy từ Product master data
- Validate stock trước khi tạo order

---

## 🎯 Business Logic

### **Order Creation Flow**

```
1. User chọn Customer
2. User chọn Delivery Type (Delivery/Pickup)
3. User thêm Products vào order:
   - Chọn Product từ dropdown
   - Nhập Quantity
   - UnitPrice tự động điền từ Product
4. User nhập Shipping Fee & Discount (optional)
5. Click "Create Order"
6. Backend xử lý:
   - Validate stock availability
   - Auto-select Batch using FEFO
   - Create Order + OrderDetail
   - Deduct inventory
```

### **FEFO Logic (First Expired First Out)**

Backend tự động chọn batch theo thứ tự:
1. Batch có `status: 'active'`
2. Có `quantityOnShelf > 0`
3. Sắp xếp theo `expiryDate` tăng dần (gần hết hạn nhất được chọn trước)
4. Đảm bảo `quantityAvailable >= requestedQuantity`

---

## 🏗️ Cấu trúc Component

### **File Location**
```
admin/src/components/OrderList/AddOrderModal.jsx
```

### **Component State**

```javascript
const [formData, setFormData] = useState({
  customerId: '',           // ObjectId - Required
  deliveryType: 'delivery', // 'delivery' | 'pickup'
  shippingAddress: '',      // Required if deliveryType === 'delivery'
  shippingFee: 0,          // Number
  discount: 0,             // Number - discount amount (not percentage)
  notes: '',               // String - optional
  items: []                // Array of { productId, quantity, unitPrice }
});

const [customers, setCustomers] = useState([]);
const [products, setProducts] = useState([]);
const [loading, setLoading] = useState(false);
const [errors, setErrors] = useState({});
```

### **Item Structure**

```javascript
{
  productId: '',  // ObjectId - Required
  quantity: 1,    // Number - Required, min: 1
  unitPrice: 0    // Number - Auto-filled from Product.unitPrice
  // Note: batch will be auto-selected by backend
}
```

---

## 🔨 Implementation Steps

### **Step 1: Setup Component**

```jsx
import React, { useState, useEffect } from 'react';
import orderService from '../../services/orderService';
import customerService from '../../services/customerService';
import productService from '../../services/productService';

/**
 * AddOrderModal Component
 * 
 * Order Creation Flow:
 * 1. User selects customer
 * 2. User adds products with quantities (NO batch selection needed)
 * 3. Backend automatically selects batch using FEFO (First Expired First Out)
 * 4. System picks the batch on shelf with nearest expiry date
 * 5. OrderDetail is created with auto-selected batch
 * 
 * Price Logic:
 * - unitPrice comes from Product master data (reference price)
 * - unitPrice is saved in OrderDetail (price at transaction time)
 * - Batch selection is transparent to user
 */
export const AddOrderModal = ({ isOpen, onClose, onSuccess }) => {
  // ... state declarations
};
```

### **Step 2: Load Data (Customers & Products)**

```javascript
useEffect(() => {
  if (isOpen) {
    loadCustomers();
    loadProducts();
  }
}, [isOpen]);

const loadCustomers = async () => {
  try {
    const data = await customerService.getAllCustomers({ 
      limit: 100, 
      isActive: true 
    });
    const customersList = data.data?.customers || data.customers || [];
    setCustomers(customersList);
  } catch (error) {
    console.error('Failed to load customers:', error);
  }
};

const loadProducts = async () => {
  try {
    const data = await productService.getAllProducts({
      limit: 200,
      isActive: true,
      withInventory: true // IMPORTANT: Include inventory to show stock
    });
    const productsList = data.data?.products || data.products || [];
    console.log('Loaded products with inventory:', productsList);
    setProducts(productsList);
  } catch (error) {
    console.error('Failed to load products:', error);
  }
};
```

### **Step 3: Helper Functions**

```javascript
// Helper: Get product unit price (handle Decimal128)
const getProductPrice = (product) => {
  if (!product) return 0;
  if (typeof product.unitPrice === 'object' && product.unitPrice !== null) {
    return parseFloat(product.unitPrice.toString());
  }
  return parseFloat(product.unitPrice) || 0;
};

// Helper: Get available quantity on shelf
const getAvailableQuantity = (product) => {
  if (!product || !product.inventory) return 0;
  return product.inventory.quantityOnShelf ?? 
         product.inventory.quantityAvailable ?? 
         0;
};
```

### **Step 4: Item Management**

```javascript
// Add new item to order
const handleAddItem = () => {
  setFormData({
    ...formData,
    items: [
      ...formData.items,
      { productId: '', quantity: 1, unitPrice: 0 }
    ]
  });
};

// Remove item from order
const handleRemoveItem = (index) => {
  const newItems = formData.items.filter((_, i) => i !== index);
  setFormData({ ...formData, items: newItems });
};

// Update item (product selection or quantity change)
const handleItemChange = (index, field, value) => {
  const newItems = [...formData.items];
  newItems[index] = { ...newItems[index], [field]: value };

  // Auto-fill price when product is selected
  if (field === 'productId' && value) {
    const product = products.find(p => p._id === value);
    if (product) {
      newItems[index].unitPrice = getProductPrice(product);
    }
  }

  setFormData({ ...formData, items: newItems });
};
```

### **Step 5: Validation**

```javascript
const validateForm = () => {
  const newErrors = {};

  // Validate customer
  if (!formData.customerId) {
    newErrors.customerId = 'Please select a customer';
  }

  // Validate shipping address for delivery orders
  if (formData.deliveryType === 'delivery' && !formData.shippingAddress) {
    newErrors.shippingAddress = 'Shipping address is required for delivery orders';
  }

  // Validate items
  if (formData.items.length === 0) {
    newErrors.items = 'Please add at least one item';
  }

  formData.items.forEach((item, index) => {
    // Validate product selection
    if (!item.productId) {
      newErrors[`item_${index}_product`] = 'Please select a product';
    }
    
    // Validate quantity
    if (item.quantity <= 0) {
      newErrors[`item_${index}_quantity`] = 'Quantity must be greater than 0';
    }
    
    // Validate price
    if (item.unitPrice < 0) {
      newErrors[`item_${index}_price`] = 'Price cannot be negative';
    }

    // Validate stock availability
    if (item.productId) {
      const product = products.find(p => p._id === item.productId);
      const availableQty = getAvailableQuantity(product);
      
      if (availableQty > 0 && item.quantity > availableQty) {
        newErrors[`item_${index}_quantity`] = `Only ${availableQty} available`;
      }
    }
  });

  setErrors(newErrors);
  return Object.keys(newErrors).length === 0;
};
```

### **Step 6: Submit Handler**

```javascript
const handleSubmit = async (e) => {
  e.preventDefault();

  if (!validateForm()) {
    return;
  }

  setLoading(true);

  try {
    const orderData = {
      customer: formData.customerId,
      deliveryType: formData.deliveryType,
      shippingAddress: formData.deliveryType === 'delivery' 
        ? formData.shippingAddress 
        : undefined,
      shippingFee: Number(formData.shippingFee),
      discount: Number(formData.discount),
      notes: formData.notes || undefined,
      items: formData.items.map(item => ({
        product: item.productId,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice)
        // Backend will auto-select batch using FEFO
      }))
    };

    console.log('📤 Sending order data:', orderData);
    
    await orderService.createOrder(orderData);
    
    onSuccess && onSuccess();
    handleClose();
  } catch (error) {
    console.error('❌ Failed to create order:', error);
    setErrors({ 
      submit: error.response?.data?.error?.message || 
              error.response?.data?.message || 
              'Failed to create order' 
    });
  } finally {
    setLoading(false);
  }
};
```

### **Step 7: Calculate Totals**

```javascript
const calculateSubtotal = () => {
  return formData.items.reduce((sum, item) => {
    return sum + (item.quantity * item.unitPrice);
  }, 0);
};

const calculateTotal = () => {
  const subtotal = calculateSubtotal();
  return subtotal + Number(formData.shippingFee) - Number(formData.discount);
};
```

---

## 🎨 UI Implementation

### **Key UI Elements**

1. **Customer Selection Dropdown**
   - Show: `fullName - phone`
   - Required field

2. **Delivery Type Radio Buttons**
   - 🚚 Delivery
   - 📦 Pickup

3. **Shipping Address (conditional)**
   - Only show when `deliveryType === 'delivery'`
   - Required for delivery orders

4. **Order Items Section**
   - FEFO info banner
   - Add Item button
   - Item list with:
     - Product dropdown (shows stock: `name (X in stock)`)
     - Quantity input (shows: `X available on shelf`)
     - Unit Price (read-only, auto-filled)
     - Remove button

5. **Fees & Discount Inputs**
   - Shipping Fee (number input)
   - Discount (number input - amount, not percentage)

6. **Order Summary Box**
   - Subtotal
   - Shipping Fee
   - Discount (red, with minus sign)
   - Total (bold, large)

### **FEFO Info Banner**

```jsx
<div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded-lg">
  <p className="text-[11px] text-blue-700 flex items-center gap-1">
    <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
    </svg>
    <span>System will automatically select batch using FEFO (First Expired First Out)</span>
  </p>
</div>
```

### **Item Row Template**

```jsx
<div className="flex gap-2 items-start p-3 bg-gray-50 rounded-lg">
  <div className="flex-1 grid grid-cols-3 gap-2">
    {/* Product Dropdown */}
    <div>
      <label className="block text-[11px] text-gray-600 mb-1">
        Product <span className="text-red-500">*</span>
      </label>
      <select
        value={item.productId}
        onChange={(e) => handleItemChange(index, 'productId', e.target.value)}
        className="w-full px-2 py-1.5 text-[12px] border rounded"
      >
        <option value="">Select product</option>
        {products.map((product) => {
          const onShelf = getAvailableQuantity(product);
          return (
            <option key={product._id} value={product._id}>
              {product.name} ({onShelf} in stock)
            </option>
          );
        })}
      </select>
    </div>

    {/* Quantity Input */}
    <div>
      <label className="block text-[11px] text-gray-600 mb-1">
        Quantity <span className="text-red-500">*</span>
      </label>
      <input
        type="number"
        value={item.quantity}
        onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
        min="1"
        className="w-full px-2 py-1.5 text-[12px] border rounded"
      />
      <p className="text-[10px] mt-0.5 text-gray-500">
        {getAvailableQuantity(product)} available on shelf
      </p>
    </div>

    {/* Unit Price (Read-only) */}
    <div>
      <label className="block text-[11px] text-gray-600 mb-1">Unit Price</label>
      <input
        type="text"
        value={new Intl.NumberFormat('vi-VN', { 
          style: 'currency', 
          currency: 'VND' 
        }).format(item.unitPrice)}
        readOnly
        className="w-full px-2 py-1.5 text-[12px] border rounded bg-gray-50 cursor-not-allowed"
        title="Price from product master data"
      />
      <p className="text-[10px] text-gray-500 mt-0.5">Auto FEFO batch</p>
    </div>
  </div>

  {/* Remove Button */}
  <button
    type="button"
    onClick={() => handleRemoveItem(index)}
    className="mt-6 p-1.5 text-red-600 hover:bg-red-50 rounded"
    title="Remove item"
  >
    {/* Trash icon SVG */}
  </button>
</div>
```

---

## 🔌 Backend Integration

### **API Endpoint: POST /api/orders**

**Request Body:**

```json
{
  "customer": "ObjectId",
  "deliveryType": "delivery",
  "shippingAddress": "123 Main St",
  "shippingFee": 30000,
  "discount": 5000,
  "notes": "Optional notes",
  "items": [
    {
      "product": "ObjectId",
      "quantity": 2,
      "unitPrice": 25000
    }
  ]
}
```

**Backend Processing:**

```javascript
// For each item:
1. Validate product exists
2. Call selectBatchFEFO(productId, quantity)
3. Check if batch has enough stock
4. Create OrderDetail with auto-selected batch
5. Deduct inventory (quantityOnShelf)
6. Calculate order total
```

**Response:**

```json
{
  "success": true,
  "data": {
    "order": {
      "_id": "ObjectId",
      "orderNumber": "ORD2025000001",
      "customer": { /* populated */ },
      "details": [
        {
          "product": { /* populated */ },
          "batch": { /* auto-selected */ },
          "quantity": 2,
          "unitPrice": 25000,
          "total": 50000
        }
      ],
      "total": 75000
    }
  },
  "message": "Order created successfully with FEFO batch allocation"
}
```

---

## 📝 Services Required

### **orderService.js**

```javascript
createOrder: async (orderData) => {
  try {
    const response = await api.post('/orders', orderData);
    return response.data;
  } catch (error) {
    console.error('Error creating order:', error);
    throw error;
  }
}
```

### **customerService.js**

```javascript
getAllCustomers: async (params = {}) => {
  try {
    const response = await api.get('/customers', { params });
    return response.data;
  } catch (error) {
    console.error('Error fetching customers:', error);
    throw error;
  }
}
```

### **productService.js**

```javascript
getAllProducts: async (params = {}) => {
  try {
    const response = await api.get('/products', { params });
    return response.data;
  } catch (error) {
    console.error('Error fetching products:', error);
    throw error;
  }
}
```

---

## ⚠️ Common Issues & Solutions

### **Issue 1: unitPrice shows 0**

**Problem:** Product.unitPrice is Decimal128 object

**Solution:**
```javascript
const getProductPrice = (product) => {
  if (typeof product.unitPrice === 'object') {
    return parseFloat(product.unitPrice.toString());
  }
  return parseFloat(product.unitPrice) || 0;
};
```

### **Issue 2: Quantity shows "0 available"**

**Problem:** Inventory not populated or wrong property name

**Solution:**
```javascript
// Make sure to request withInventory=true
const data = await productService.getAllProducts({
  withInventory: true
});

// Use fallback chain
const available = product.inventory?.quantityOnShelf ?? 
                 product.inventory?.quantityAvailable ?? 
                 0;
```

### **Issue 3: Backend returns "Insufficient stock"**

**Problem:** DetailInventory không có quantityOnShelf

**Solution:**
- Check DetailInventory records exist for product batches
- Verify `quantityOnShelf > 0` in database
- Run inventory recalculation if needed

### **Issue 4: Batch not found**

**Problem:** No active batches with stock on shelf

**Solution:**
- Ensure ProductBatch has `status: 'active'`
- Ensure DetailInventory has `quantityOnShelf > 0`
- Check expiryDate is not in the past

---

## 🧪 Testing Checklist

### **Frontend Tests**

- [ ] Modal opens and loads customers/products
- [ ] Add/remove items works correctly
- [ ] Product selection auto-fills unitPrice
- [ ] Quantity validation shows correct available stock
- [ ] Delivery type toggle shows/hides shipping address
- [ ] Subtotal and total calculate correctly
- [ ] Validation prevents submission with empty fields
- [ ] Error messages display correctly
- [ ] Success callback fires after order creation
- [ ] Modal closes and resets state

### **Backend Tests**

- [ ] FEFO selects earliest expiry batch
- [ ] Order creation with single item works
- [ ] Order creation with multiple items works
- [ ] Validation prevents order with insufficient stock
- [ ] Validation prevents order with invalid product
- [ ] OrderDetail created with correct batch
- [ ] Inventory deducted correctly
- [ ] Order total calculated correctly
- [ ] Transaction rollback on error

### **Integration Tests**

- [ ] Create order with in-stock product succeeds
- [ ] Create order with out-of-stock product fails
- [ ] Create order with multiple products from different batches
- [ ] Order details show correct batch information
- [ ] Inventory updated after order creation

---

## 📊 Data Flow Diagram

```
┌─────────────┐
│   User      │
└──────┬──────┘
       │ 1. Select Customer, Products, Quantity
       ▼
┌─────────────────┐
│  AddOrderModal  │
└──────┬──────────┘
       │ 2. Submit { customer, items: [{ product, quantity, unitPrice }] }
       ▼
┌─────────────────┐
│ orderService.   │
│ createOrder()   │
└──────┬──────────┘
       │ 3. POST /api/orders
       ▼
┌─────────────────────┐
│  Orders Controller  │
└──────┬──────────────┘
       │ 4. For each item:
       │    - selectBatchFEFO(product, quantity)
       │    - Validate stock
       ▼
┌─────────────────────┐
│   batchHelpers.js   │
│  selectBatchFEFO()  │
└──────┬──────────────┘
       │ 5. Query DetailInventory
       │    - Filter: quantityOnShelf > 0
       │    - Sort: expiryDate ASC (FEFO)
       │    - Return first batch with enough stock
       ▼
┌─────────────────────┐
│  Create Order +     │
│  OrderDetail        │
└──────┬──────────────┘
       │ 6. Deduct inventory
       │    - Update DetailInventory.quantityOnShelf
       │    - Recalculate parent Inventory
       ▼
┌─────────────────────┐
│  Return Order with  │
│  populated details  │
└──────┬──────────────┘
       │ 7. Response
       ▼
┌─────────────────┐
│  Show success   │
│  Close modal    │
└─────────────────┘
```

---

## 🚀 Quick Start Code

### **Minimal Working Example**

```jsx
import React, { useState, useEffect } from 'react';
import orderService from '../../services/orderService';
import customerService from '../../services/customerService';
import productService from '../../services/productService';

export const AddOrderModal = ({ isOpen, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    customerId: '',
    items: []
  });
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);

  useEffect(() => {
    if (isOpen) {
      customerService.getAllCustomers({ limit: 100 })
        .then(data => setCustomers(data.data?.customers || []));
      productService.getAllProducts({ limit: 200, withInventory: true })
        .then(data => setProducts(data.data?.products || []));
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    const orderData = {
      customer: formData.customerId,
      items: formData.items.map(item => ({
        product: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice
      }))
    };
    
    await orderService.createOrder(orderData);
    onSuccess();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal">
      {/* Customer selection */}
      {/* Items management */}
      {/* Submit button */}
    </div>
  );
};
```

---

## 📚 Related Documentation

- [`BATCH_MANAGEMENT_WORKFLOW.md`](./BATCH_MANAGEMENT_WORKFLOW.md) - Batch management business logic
- [`POS_BARCODE_SCANNING_IMPLEMENTATION.md`](./POS_BARCODE_SCANNING_IMPLEMENTATION.md) - POS FEFO implementation
- [`FINAL_WORKFLOW.md`](./FINAL_WORKFLOW.md) - Complete system workflow
- [`MODEL_STANDARD.md`](./MODEL_STANDARD.md) - Database models documentation

---

## ✅ Completion Checklist

- [ ] Component structure implemented
- [ ] Load customers and products with inventory
- [ ] Add/remove items functionality
- [ ] Auto-fill unitPrice from Product
- [ ] Show available quantity on shelf
- [ ] Validate stock availability
- [ ] Submit order to backend
- [ ] Handle success/error responses
- [ ] UI matches design requirements
- [ ] FEFO info banner displayed
- [ ] All console.logs for debugging
- [ ] Error handling and user feedback
- [ ] Modal close and reset state
- [ ] Integration with backend tested

---

**Last Updated:** November 21, 2025  
**Version:** 1.0  
**Author:** Development Team
