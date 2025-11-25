# 📋 Logic Nghiệp Vụ Bán Hàng - POS System

## 🎯 Tổng quan

Hệ thống POS có **2 loại sản phẩm** với logic bán hàng khác nhau:

---

## 🌿 Fresh Products (Hàng Tươi Sống)

### **Định nghĩa:**
- Sản phẩm có category name chứa từ `"fresh"` (không phân biệt hoa thường)
- Ví dụ: Fresh Vegetables, Fresh Fruits, Fresh Meat, etc.

### **Logic Bán Hàng:**

#### **Frontend (POS):**
1. ✅ **Scan/Click sản phẩm** → Hệ thống detect là fresh product
2. ✅ **Hiển thị POSBatchSelectModal** → Nhân viên chọn lô thủ công
3. ✅ **Hiển thị tất cả lô còn hàng** với thông tin:
   - Batch Code (BATCH2025000001)
   - Expiry Date và số ngày còn lại
   - Available Stock
   - Manufacturing Date
   - **Unit Price của từng lô** (có thể khác nhau do khuyến mãi)
4. ✅ **Urgency Badges:**
   - 🔥 Urgent (≤ 3 ngày): Màu đỏ
   - ⚠️ Warning (4-7 ngày): Màu cam
   - Bình thường (> 7 ngày): Không badge
5. ✅ **Nhân viên chọn lô và số lượng** → Add to cart

#### **Backend (Order Creation):**
- ✅ Nhận batch ID đã được chọn từ frontend
- ✅ Tạo OrderDetail với batch cụ thể đã chọn
- ✅ Sử dụng unit price của batch đã chọn

### **Lý do:**
- Giá có thể khác nhau giữa các lô (khuyến mãi hết hạn)
- Nhân viên cần linh hoạt chọn lô theo tình hình thực tế
- Khách có thể yêu cầu lô có HSD xa hơn

---

## 📦 Regular Products (Hàng Phổ Thông)

### **Định nghĩa:**
- Tất cả sản phẩm không phải fresh
- Ví dụ: Canned Food, Drink, Snacks, Dry Goods, etc.

### **Logic Bán Hàng:**

#### **Frontend (POS):**
1. ✅ **Scan/Click sản phẩm** → Hệ thống detect là regular product
2. ✅ **KHÔNG hiển thị BatchSelectModal**
3. ✅ **Thêm trực tiếp vào cart** với:
   - Quantity: 1 (hoặc tăng nếu đã có trong cart)
   - Price: Unit price từ Product master data
   - **Không lưu batch info cụ thể**
4. ✅ **Toast notification:** "Added [Product Name] to cart"

#### **Backend (Order Creation):**
- ✅ **FEFO (First Expired First Out) tự động:**
  1. Query tất cả batches của product (status: active, quantity > 0)
  2. Sort theo expiryDate ASC (gần hết hạn nhất lên đầu)
  3. Chọn batch đầu tiên (FEFO)
  4. Tạo OrderDetail với batch được chọn tự động
  5. Sử dụng unit price của batch FEFO

### **Lý do:**
- Giá đồng nhất giữa các lô
- Tối ưu tốc độ bán hàng (không cần chọn lô)
- Tự động xử lý FEFO để giảm hàng tồn kho sắp hết hạn
- Giảm sai sót của nhân viên

---

## 🔄 Implementation Status

### **✅ Frontend (POS) - Hoàn thành:**

#### **POSMain.jsx:**
```javascript
// Scan productCode handler
const handleProductScanned = async (productCode) => {
  const { product, batches } = await fetchProductData(productCode);
  
  // Check if FRESH
  const isFresh = product.category?.name?.toLowerCase().includes('fresh');
  
  if (isFresh) {
    // Show batch selection modal
    setShowBatchModal(true);
  } else {
    // Auto-add to cart (FEFO batch for display price)
    handleAddProductWithBatch(product, batches[0], 1);
  }
};

// Click product card handler
const addToCart = async (product) => {
  const isFresh = product.categoryName?.toLowerCase().includes('fresh');
  
  if (isFresh) {
    // Fetch batches and show modal
    const response = await fetchProductBatches(product);
    setShowBatchModal(true);
  } else {
    // Add directly to cart
    setCart([...cart, { ...product, quantity: 1 }]);
  }
};
```

#### **POSBatchSelectModal.jsx:**
- ✅ Header: "🌿 Select Batch - Fresh Product"
- ✅ Info box: Giải thích manual selection
- ✅ Urgency badges: 🔥 Urgent, ⚠️ Warning
- ✅ Hiển thị: Batch Code, Expiry, Stock, Mfg Date, Price

#### **POSSearchBar.jsx:**
- ✅ Scan detection với productCode format: `PROD\d{10}`
- ✅ Visual feedback: Scanning, Processing, Scanned
- ✅ Toast notifications

---

### **⚠️ Backend - Cần cập nhật:**

#### **Current Status:**
- ✅ GET /api/products/code/:productCode - Returns batches sorted FEFO
- ❌ POST /api/orders - Chưa implement auto FEFO selection

#### **TODO:**

**File:** `controllers/orders.js`

```javascript
// POST /api/orders
ordersRouter.post('/', async (request, response) => {
  const { customer, items, deliveryType, shippingAddress } = request.body;
  
  // Process each item
  for (const item of items) {
    let batchId = item.batchId;
    
    // If no batchId (regular product), auto-select FEFO
    if (!batchId) {
      const batches = await ProductBatch.find({
        product: item.productId,
        status: 'active',
        quantity: { $gt: 0 },
        $or: [
          { expiryDate: { $gt: new Date() } },
          { expiryDate: null }
        ]
      })
      .sort({ expiryDate: 1 }) // FEFO
      .limit(1);
      
      if (!batches || batches.length === 0) {
        throw new Error(`Product ${item.productId} is out of stock`);
      }
      
      batchId = batches[0]._id;
    }
    
    // Create OrderDetail with selected/auto batch
    await OrderDetail.create({
      order: orderId,
      product: item.productId,
      batch: batchId,
      quantity: item.quantity,
      unitPrice: batches[0].unitPrice
    });
  }
});
```

---

## 📊 Data Flow

### **Fresh Product Flow:**

```
User Action → Scan/Click Fresh Product
                ↓
Frontend → Detect isFresh = true
                ↓
Frontend → Fetch batches from backend
                ↓
Frontend → Show POSBatchSelectModal
                ↓
User → Select batch + quantity
                ↓
Frontend → Add to cart with batch info
                ↓
User → Checkout
                ↓
Backend → Create Order with selected batch
```

### **Regular Product Flow:**

```
User Action → Scan/Click Regular Product
                ↓
Frontend → Detect isFresh = false
                ↓
Frontend → Add to cart immediately (no batch)
                ↓
User → Checkout
                ↓
Backend → Auto-select FEFO batch
                ↓
Backend → Create Order with FEFO batch
```

---

## 🎨 UI/UX Differences

### **Fresh Products:**
- 🌿 Orange-colored modal header
- 📋 "Manual batch selection required" notice
- 🔥 Urgency badges (Red/Orange)
- 💰 Different prices per batch (visible)
- ⏱️ Slower checkout (requires selection)

### **Regular Products:**
- ⚡ Instant add to cart
- 🚀 Fast checkout flow
- 💵 Single price (from product master)
- 🤖 Automated backend handling
- ✅ Success toast notification

---

## 📈 Benefits

### **For Fresh Products:**
- ✅ Nhân viên chủ động chọn lô phù hợp
- ✅ Linh hoạt với giá khuyến mãi khác nhau
- ✅ Đáp ứng yêu cầu khách hàng về HSD
- ✅ Tối ưu doanh thu (bán lô khuyến mãi trước)

### **For Regular Products:**
- ✅ Tốc độ bán hàng nhanh
- ✅ Giảm thao tác của nhân viên
- ✅ Tự động FEFO giảm tồn kho
- ✅ Giảm sai sót (không cần chọn thủ công)

---

## 🔍 Testing Checklist

### **Fresh Products:**
- [ ] Scan fresh product → Modal hiển thị
- [ ] Urgency badges hiển thị đúng
- [ ] Chọn batch → Price cập nhật
- [ ] Add to cart → Batch info đầy đủ
- [ ] Multiple fresh products → Mỗi item có batch riêng

### **Regular Products:**
- [ ] Scan regular product → Thêm cart ngay
- [ ] Click regular product → Thêm cart ngay
- [ ] Không hiển thị modal
- [ ] Toast notification hiển thị
- [ ] Checkout → Backend auto-select FEFO

### **Backend FEFO:**
- [ ] Create order với regular product
- [ ] Verify batch được chọn là FEFO (expiryDate nhỏ nhất)
- [ ] Verify price lấy từ batch FEFO
- [ ] Verify stock deducted từ batch FEFO

---

## 📝 Notes

### **Category Naming Convention:**
- ✅ Fresh categories MUST contain "fresh" (case-insensitive)
- ✅ Examples: "Fresh Vegetables", "fresh-fruits", "FRESH MEAT"
- ❌ Avoid: "Veg", "Fruits" (sẽ bị xử lý như regular)

### **Price Consistency:**
- ✅ Fresh: Price from selected batch (có thể khác nhau)
- ✅ Regular: Price from Product master OR first batch (FEFO)

### **Stock Management:**
- ✅ Cả 2 loại đều reserve stock khi add to cart
- ✅ Release khi remove từ cart hoặc timeout
- ✅ Final deduct khi order confirmed

---

**Last Updated:** November 25, 2025  
**Version:** 2.0  
**Status:** ✅ Frontend Complete | ⚠️ Backend FEFO Pending
