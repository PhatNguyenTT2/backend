# POS Order Workflow Documentation

**Ngày tạo:** 2025-11-25  
**Phiên bản:** 1.0  
**Mục đích:** Tài liệu chi tiết workflow bán hàng tại POS với tính năng Hold Order

---

## 📌 Tổng quan

POS và Admin Order Management sử dụng **CHUNG** API endpoints và workflow.  
Không cần tạo endpoint riêng cho POS.

### Đặc điểm chính:
- ✅ Hold Order: Lưu draft orders cho khách hàng đang chờ
- ✅ FEFO tự động cho sản phẩm phổ thông
- ✅ Batch selection thủ công cho sản phẩm Fresh
- ✅ Discount tự động theo customerType
- ✅ Multiple payment methods (cash, card, transfer)

---

## 🔄 1. Order Status Flow

### **Draft → Pending → Delivered**

```
┌─────────┐     ┌─────────┐     ┌───────────┐
│  DRAFT  │────→│ PENDING │────→│ DELIVERED │
└─────────┘     └─────────┘     └───────────┘
     │               │                 │
     │               │                 ▼
     │               │          (Stock deducted)
     │               ▼
     │        (Stock reserved)
     ▼
(No stock change)
```

### **Status Definitions:**

| Status | Description | Stock Impact | Use Case |
|--------|-------------|--------------|----------|
| `draft` | Order nháp, chưa xác nhận | Không trừ kho | Hold order, khách chưa quyết định |
| `pending` | Order đã xác nhận, chờ xử lý | Reserve stock (shelf → reserved) | Khách đã thanh toán, chờ giao hàng |
| `shipping` | Đang giao hàng | Vẫn ở reserved | Admin tracking (không dùng trong POS) |
| `delivered` | Đã giao hàng/khách đã nhận | Trừ từ reserved | Hoàn thành bán hàng |
| `cancelled` | Hủy đơn | Return stock to shelf | Khách hủy, hết hàng |
| `refunded` | Hoàn trả | Return stock to shelf | Khách trả hàng |

---

## 🛒 2. POS Workflow Chi Tiết

### **2.1. Tạo Order Mới (Draft)**

#### **Bước 1: Chọn khách hàng**

**POS có 3 options:**

1. **Khách vãng lai** (Default - KHUYẾN NGHỊ):
   ```javascript
   // Auto-load default guest customer on POS open
   GET /api/customers/default-guest
   
   // Response
   {
     success: true,
     data: {
       customer: {
         id: "...",
         customerCode: "GUEST001",
         fullName: "Khách vãng lai",
         phone: "0000000000",
         email: "guest@store.local",
         customerType: "guest",
         isDefaultGuest: true,
         isActive: true
       }
     }
   }
   
   // Usage:
   // - Click "Khách vãng lai" button
   // - Auto-selected when POS opens
   // - Discount: 0%
   // - Không cần nhập thông tin
   ```

2. **Tìm khách hàng hiện có:**
   ```javascript
   // Search by name/phone with debounce
   GET /api/customers?search=nguyen&isActive=true&limit=10
   
   // Response
   {
     success: true,
     data: {
       customers: [
         {
           id: "...",
           fullName: "Nguyen Van A",
           customerType: "retail", // guest, retail, wholesale, vip
           phone: "0901234567",
           customerCode: "CUST2025000001"
         }
       ],
       pagination: { ... }
     }
   }
   
   // Usage:
   // - Type in search box (name, phone, email)
   // - Select from dropdown
   // - Discount tự động theo customerType
   ```

3. **Tạo khách hàng mới:**
   ```javascript
   // Quick create customer
   POST /api/customers
   
   // Request Body (Minimal)
   {
     fullName: "Nguyen Van B",
     phone: "0912345678",
     customerType: "retail" // Optional, default: guest
   }
   
   // Response
   {
     success: true,
     data: {
       customer: {
         id: "...",
         customerCode: "CUST2025000002", // Auto-generated
         fullName: "Nguyen Van B",
         phone: "0912345678",
         customerType: "retail"
       }
     }
   }
   
   // Usage:
   // - Click "Khách mới" button
   // - Fill in minimal info (name, phone)
   // - Sử dụng ngay cho order
   ```

**Component UI:**
```jsx
<POSCustomerSelector
  selectedCustomer={selectedCustomer}
  onCustomerChange={setSelectedCustomer}
  customerDiscounts={customerDiscounts}
/>
```

#### **Bước 2: Thêm sản phẩm vào giỏ**

##### **2.2.1. Sản phẩm phổ thông (Regular Products)**
```javascript
// Scan barcode hoặc search
GET /api/products?barcode=8934680034050
// OR
GET /api/products?search=Sua tuoi

// Add to cart - KHÔNG CẦN chọn batch
const cartItem = {
  product: productId,
  quantity: 2,
  unitPrice: product.unitPrice,
  // NO batch field - Backend sẽ tự động FEFO
};
```

**Backend xử lý tự động:**
```javascript
// Backend sẽ gọi allocateQuantityFEFO()
const allocation = await allocateQuantityFEFO(productId, quantity);
// Returns: [
//   { batch: "BATCH001", quantity: 1, expiryDate: "2025-12-01" },
//   { batch: "BATCH002", quantity: 1, expiryDate: "2025-12-15" }
// ]
```

##### **2.2.2. Sản phẩm Fresh (Fresh Products)**
```javascript
// Kiểm tra nếu product.category.name === 'fresh'
if (product.category?.name?.toLowerCase() === 'fresh') {
  // Hiển thị modal chọn batch
  GET /api/product-batches?product=${productId}&status=active&hasStock=true
  
  // User chọn batch thủ công
  const cartItem = {
    product: productId,
    quantity: 2,
    unitPrice: product.unitPrice,
    batch: selectedBatchId, // REQUIRED for fresh products
    batchCode: selectedBatch.batchCode, // For display
    expiryDate: selectedBatch.expiryDate
  };
}
```

**UI cần hiển thị:**
```
╔════════════════════════════════════════╗
║ 🌿 Fresh Product - Select Batch       ║
╠════════════════════════════════════════╣
║ Product: Cá Hồi Nauy                   ║
║ Quantity needed: 2 kg                  ║
╠════════════════════════════════════════╣
║ Available Batches:                     ║
║                                        ║
║ ○ BATCH001 - Exp: 2025-11-26 (1 day)  ║
║   Stock: 5 kg                          ║
║                                        ║
║ ○ BATCH002 - Exp: 2025-11-28 (3 days) ║
║   Stock: 10 kg                         ║
║                                        ║
║        [Cancel]  [Select Batch]        ║
╚════════════════════════════════════════╝
```

#### **Bước 3: Tính toán giá**

```javascript
// Auto-calculated by frontend
const subtotal = cart.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

// Discount based on customerType (from systemSettings)
const discountMap = {
  guest: 0,
  retail: 10,    // 10%
  wholesale: 15, // 15%
  vip: 20        // 20%
};
const discountPercentage = discountMap[customer.customerType];
const discountAmount = subtotal * (discountPercentage / 100);

const shippingFee = 0; // POS always pickup = no shipping

const total = subtotal - discountAmount + shippingFee;
```

#### **Bước 4: Hold Order (Save as Draft)**

```javascript
// API Call
POST /api/orders

// Request Body
{
  customer: customerId,
  createdBy: currentEmployeeId,
  deliveryType: "pickup",
  status: "draft", // ⭐ IMPORTANT: draft = no stock impact
  paymentStatus: "pending",
  items: [
    {
      product: productId1,
      quantity: 2,
      unitPrice: 25000
      // No batch for regular products
    },
    {
      product: productId2,
      quantity: 1,
      unitPrice: 150000,
      batch: batchId // Only for fresh products
    }
  ]
}

// Response
{
  success: true,
  data: {
    order: {
      id: "...",
      orderNumber: "ORD2511000123",
      status: "draft",
      total: 185000
    }
  }
}
```

**Lưu ý:**
- ⚠️ Order `draft` **KHÔNG** trừ kho
- ⚠️ Có thể có nhiều draft orders cùng lúc
- ⚠️ Draft orders chỉ visible cho employee tạo ra (filter by `createdBy`)

---

### **2.3. Quản lý Hold Orders**

#### **Lấy danh sách Hold Orders của nhân viên**

```javascript
// API Call
GET /api/orders?status=draft&createdBy=${currentEmployeeId}&sortBy=createdAt&sortOrder=desc

// Response
{
  success: true,
  data: {
    orders: [
      {
        id: "...",
        orderNumber: "ORD2511000123",
        customer: {
          fullName: "Nguyen Van A",
          phone: "0901234567"
        },
        total: 185000,
        status: "draft",
        createdAt: "2025-11-25T10:30:00Z"
      }
    ]
  }
}
```

#### **UI Hold Orders List**

```
╔══════════════════════════════════════════════════════╗
║ 📋 Hold Orders (3)                                   ║
╠══════════════════════════════════════════════════════╣
║                                                      ║
║ #ORD2511000123 - Nguyen Van A - 185,000₫           ║
║ 10:30 AM - 3 items                [Resume] [Delete] ║
║ ─────────────────────────────────────────────────── ║
║ #ORD2511000124 - Tran Thi B - 520,000₫             ║
║ 10:45 AM - 7 items                [Resume] [Delete] ║
║ ─────────────────────────────────────────────────── ║
║ #ORD2511000125 - Le Van C - 75,000₫                ║
║ 11:00 AM - 2 items                [Resume] [Delete] ║
║                                                      ║
╚══════════════════════════════════════════════════════╝
```

#### **Resume Hold Order**

```javascript
// Lấy chi tiết order
GET /api/orders/${orderId}

// Load order vào POS cart
const cart = order.details.map(detail => ({
  product: detail.product.id,
  productName: detail.product.name,
  quantity: detail.quantity,
  unitPrice: detail.unitPrice,
  batch: detail.batch?.id,
  batchCode: detail.batch?.batchCode
}));

// User có thể:
// - Thêm/xóa sản phẩm
// - Thay đổi quantity
// - Update và save lại draft
// - Hoặc proceed to checkout
```

#### **Delete Hold Order**

```javascript
// API Call
DELETE /api/orders/${orderId}

// Note: Chỉ delete được draft orders
// Backend sẽ check: order.status === 'draft' && order.paymentStatus === 'pending'
```

---

### **2.4. Checkout Process**

#### **Bước 1: Confirm Order → Reserve Stock**

```javascript
// Update order status từ draft → pending
PUT /api/orders/${orderId}

// Request Body
{
  status: "pending"
}

// ⭐ Backend middleware sẽ tự động:
// 1. Validate stock availability
// 2. Reserve stock (shelf → reserved)
// 3. Tạo InventoryMovementBatch với type='reserved'
```

**Xử lý lỗi khi hết hàng:**
```javascript
// Response (Error)
{
  success: false,
  error: {
    message: "Insufficient stock for product X",
    details: "Available: 5, Required: 10"
  }
}

// UI Action:
// - Hiển thị thông báo lỗi
// - Cho phép user điều chỉnh quantity
// - Hoặc xóa item khỏi order
```

#### **Bước 2: Payment**

```javascript
// Tạo payment
POST /api/payments

// Request Body
{
  referenceType: "Order",
  referenceId: orderId,
  amount: order.total,
  paymentMethod: "cash", // cash, card, transfer
  status: "completed"
}

// Response
{
  success: true,
  data: {
    payment: {
      id: "...",
      paymentNumber: "PAY2511000001",
      amount: 185000,
      status: "completed"
    }
  }
}
```

**Payment Methods:**
- **Cash:** Status = `completed` ngay
- **Card:** Status = `completed` sau khi swipe thành công
- **Transfer:** Status = `pending`, admin confirm sau

#### **Bước 3: Complete Order → Deduct Stock**

```javascript
// Update order status từ pending → delivered
PUT /api/orders/${orderId}

// Request Body
{
  status: "delivered",
  paymentStatus: "paid"
}

// ⭐ Backend middleware sẽ tự động:
// 1. Trừ stock từ reserved
// 2. Tạo InventoryMovementBatch với type='sale'
// 3. Update product.quantitySold
```

#### **Bước 4: Print Receipt**

```javascript
// Get complete order data
GET /api/orders/${orderId}?withDetails=true

// Print receipt with:
// - Store info
// - Order number
// - Customer info
// - Items (with batch info for fresh products)
// - Subtotal, discount, total
// - Payment info
// - Employee name
// - Timestamp
```

---

## 📊 3. Stock Management Logic

### **3.1. Batch Selection (FEFO)**

#### **Regular Products - Automatic FEFO**
```javascript
// Backend: utils/batchHelpers.js
const allocateQuantityFEFO = async (productId, quantityNeeded) => {
  // 1. Lấy tất cả batches có stock trên kệ
  const batches = await ProductBatch.find({
    product: productId,
    status: 'active'
  }).sort({ expiryDate: 1 }); // Sort by expiry date ASC

  // 2. Filter batches có stock trên shelf
  const availableBatches = [];
  for (const batch of batches) {
    const detailInv = await DetailInventory.findOne({
      productBatch: batch._id,
      quantityOnShelf: { $gt: 0 }
    });
    if (detailInv) {
      availableBatches.push({
        batch: batch._id,
        available: detailInv.quantityOnShelf,
        expiryDate: batch.expiryDate
      });
    }
  }

  // 3. Allocate theo FEFO
  const allocation = [];
  let remaining = quantityNeeded;

  for (const batch of availableBatches) {
    if (remaining <= 0) break;

    const allocate = Math.min(remaining, batch.available);
    allocation.push({
      batch: batch.batch,
      quantity: allocate,
      expiryDate: batch.expiryDate
    });
    remaining -= allocate;
  }

  // 4. Check if có đủ hàng
  if (remaining > 0) {
    throw new Error(`Insufficient stock. Need ${remaining} more units.`);
  }

  return allocation;
};
```

#### **Fresh Products - Manual Selection**
```javascript
// Frontend validation
const validateFreshProductBatch = (batch, quantity) => {
  // 1. Check stock availability
  if (batch.quantityOnShelf < quantity) {
    throw new Error('Insufficient stock in selected batch');
  }

  // 2. Check expiry date (warn if < 2 days)
  const daysToExpiry = getDaysUntilExpiry(batch.expiryDate);
  if (daysToExpiry < 2) {
    return {
      warning: `Batch expires in ${daysToExpiry} day(s)`,
      requireConfirm: true
    };
  }

  return { valid: true };
};
```

### **3.2. Stock Reservation Flow**

```
Order Status Change: draft → pending

┌────────────────────────────────────────────────────┐
│ FOR EACH OrderDetail:                              │
│                                                    │
│  1. Get ProductBatch from OrderDetail.batch       │
│                                                    │
│  2. Find DetailInventory for this batch           │
│                                                    │
│  3. Check quantityOnShelf >= quantity             │
│     ├─ YES: Continue                              │
│     └─ NO:  Throw error "Insufficient stock"      │
│                                                    │
│  4. Update DetailInventory:                       │
│     - quantityOnShelf -= quantity                 │
│     - quantityReserved += quantity                │
│                                                    │
│  5. Create InventoryMovementBatch:                │
│     - type: 'reserved'                            │
│     - quantity: quantity                          │
│     - from: 'shelf'                               │
│     - to: 'reserved'                              │
│                                                    │
└────────────────────────────────────────────────────┘
```

### **3.3. Stock Deduction Flow**

```
Order Status Change: pending → delivered

┌────────────────────────────────────────────────────┐
│ FOR EACH OrderDetail:                              │
│                                                    │
│  1. Get ProductBatch from OrderDetail.batch       │
│                                                    │
│  2. Find DetailInventory for this batch           │
│                                                    │
│  3. Update DetailInventory:                       │
│     - quantityReserved -= quantity                │
│     (quantityOnShelf already deducted)            │
│                                                    │
│  4. Update Product:                               │
│     - quantitySold += quantity                    │
│                                                    │
│  5. Create InventoryMovementBatch:                │
│     - type: 'sale'                                │
│     - quantity: quantity                          │
│     - from: 'reserved'                            │
│     - to: 'sold'                                  │
│     - referenceType: 'Order'                      │
│     - referenceId: orderId                        │
│                                                    │
└────────────────────────────────────────────────────┘
```

---

## 🎨 4. UI/UX Requirements

### **4.1. POS Main Screen**

```
╔═══════════════════════════════════════════════════════════════════╗
║ 🏪 POS System                    Employee: Nguyen Van A          ║
╠═══════════════════════════════════════════════════════════════════╣
║                                                                   ║
║ ┌─────────────────────────┐  ┌─────────────────────────────────┐ ║
║ │ Customer                │  │ Current Cart                    │ ║
║ │                         │  │                                 │ ║
║ │ [Search Customer...]    │  │ #1 Sua tuoi          x2  50,000│ ║
║ │                         │  │    Auto FEFO ✓                 │ ║
║ │ Selected:               │  │                                 │ ║
║ │ Nguyen Van A            │  │ #2 Ca hoi Nauy 🌿    x1 150,000│ ║
║ │ Type: Retail (10% off)  │  │    BATCH001 (Exp: 11/26)       │ ║
║ │                         │  │                                 │ ║
║ └─────────────────────────┘  │ ─────────────────────────────── │ ║
║                              │ Subtotal:           200,000₫   │ ║
║ ┌─────────────────────────┐  │ Discount (10%):     -20,000₫  │ ║
║ │ Add Product             │  │ Shipping:                  0₫  │ ║
║ │                         │  │ ─────────────────────────────── │ ║
║ │ [Scan/Search...]        │  │ TOTAL:              180,000₫   │ ║
║ │                         │  │                                 │ ║
║ │ Quick Access:           │  │ [Hold]  [Clear]  [Checkout] ▶  │ ║
║ │ ○ Bestsellers           │  └─────────────────────────────────┘ ║
║ │ ○ Fresh Products 🌿      │                                     ║
║ │ ○ Promotions            │  ┌──────────────────────────────┐  ║
║ └─────────────────────────┘  │ 📋 Hold Orders (3)           │  ║
║                              │ [View All Hold Orders]       │  ║
║                              └──────────────────────────────┘  ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝
```

### **4.2. Product Badge System**

```javascript
// Visual indicators
const ProductBadge = ({ product }) => {
  const badges = [];

  // Fresh product badge
  if (product.category?.name?.toLowerCase() === 'fresh') {
    badges.push(
      <Badge color="green" icon={<LeafIcon />}>
        Fresh - Manual Batch
      </Badge>
    );
  } else {
    badges.push(
      <Badge color="blue" icon={<AutoIcon />}>
        Auto FEFO
      </Badge>
    );
  }

  // Low stock warning
  if (product.quantityOnShelf < 10) {
    badges.push(
      <Badge color="red" icon={<WarningIcon />}>
        Low Stock: {product.quantityOnShelf}
      </Badge>
    );
  }

  // Near expiry warning (for fresh)
  if (product.nearestExpiryDate) {
    const days = getDaysUntilExpiry(product.nearestExpiryDate);
    if (days < 3) {
      badges.push(
        <Badge color="orange" icon={<ClockIcon />}>
          Expires in {days} day(s)
        </Badge>
      );
    }
  }

  return <div>{badges}</div>;
};
```

### **4.3. Checkout Modal**

```
╔═══════════════════════════════════════════════════════════╗
║ 💳 Checkout                                               ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║ Order: #ORD2511000123                                     ║
║ Customer: Nguyen Van A (Retail)                           ║
║                                                           ║
║ ┌───────────────────────────────────────────────────────┐ ║
║ │ Items:                                                │ ║
║ │ • Sua tuoi                    x2         50,000₫     │ ║
║ │   BATCH001, BATCH002 (Auto)                          │ ║
║ │                                                       │ ║
║ │ • Ca hoi Nauy 🌿              x1        150,000₫     │ ║
║ │   BATCH003 (Exp: 2025-11-26)                         │ ║
║ └───────────────────────────────────────────────────────┘ ║
║                                                           ║
║ Subtotal:                                    200,000₫    ║
║ Discount (10%):                              -20,000₫    ║
║ ──────────────────────────────────────────────────────    ║
║ TOTAL:                                       180,000₫    ║
║                                                           ║
║ ┌───────────────────────────────────────────────────────┐ ║
║ │ Payment Method:                                       │ ║
║ │ ○ Cash          ○ Card          ○ Transfer           │ ║
║ │                                                       │ ║
║ │ Amount Received:  [___________] ₫                    │ ║
║ │ Change:           0₫                                  │ ║
║ └───────────────────────────────────────────────────────┘ ║
║                                                           ║
║              [Cancel]           [Complete Payment]       ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
```

---

## 🔧 5. Implementation Checklist

### **Phase 1: Backend**
- [x] Order CRUD endpoints
- [x] FEFO batch allocation logic
- [x] Stock reservation middleware
- [x] Payment processing
- [x] Inventory movement tracking
- [x] GET /api/customers/default-guest endpoint (returns virtual guest)
- [ ] Order creation logic to handle virtual guest customer (TODO)

### **Phase 2: Frontend Components**

#### **5.1. Customer Selection**
- [x] POSCustomerSelector component
- [x] Auto-load default guest customer
- [x] Customer search with debounce
- [x] Display customer type and discount
- [x] Quick select guest customer button
- [ ] Quick create new customer modal (TODO)

#### **5.2. Product Selection**
- [ ] Barcode scanner integration
- [ ] Product search with autocomplete
- [ ] Quick access categories (Fresh, Bestsellers, etc.)
- [ ] Product card with badges (Fresh, Low Stock, etc.)

#### **5.3. Batch Selection (Fresh Products)**
- [ ] Modal hiển thị danh sách batches
- [ ] Show expiry date và remaining days
- [ ] Show available quantity per batch
- [ ] Warning cho batches gần hết hạn
- [ ] Validate quantity vs available stock

#### **5.4. Cart Management**
- [ ] Add/remove items
- [ ] Update quantity
- [ ] Display batch info (Fresh products)
- [ ] Display "Auto FEFO" badge (Regular products)
- [ ] Real-time total calculation
- [ ] Clear cart confirmation

#### **5.5. Hold Order Management**
- [ ] "Hold Order" button → Save as draft
- [ ] Hold orders list (filter by current employee)
- [ ] Resume hold order → Load into cart
- [ ] Delete hold order
- [ ] Show hold time and customer info

#### **5.6. Checkout Process**
- [ ] Checkout modal
- [ ] Order summary with batch details
- [ ] Payment method selection (Cash, Card, Transfer)
- [ ] Amount received calculator (for cash)
- [ ] Change calculation
- [ ] Confirm button → Reserve stock (draft → pending)
- [ ] Error handling (insufficient stock)
- [ ] Complete payment → Create payment record
- [ ] Complete order → Deduct stock (pending → delivered)

#### **5.7. Receipt Printing**
- [ ] Receipt template design
- [ ] Include batch info for fresh products
- [ ] Include employee and timestamp
- [ ] Print via browser or thermal printer API
- [ ] Email receipt option

### **Phase 3: Error Handling**

#### **5.8. Stock Validation**
- [ ] Check stock before adding to cart
- [ ] Real-time stock check on checkout
- [ ] Handle concurrent orders (race conditions)
- [ ] Display clear error messages
- [ ] Suggest alternatives (other batches/products)

#### **5.9. Network Errors**
- [ ] Offline detection
- [ ] Retry failed requests
- [ ] Queue draft orders locally
- [ ] Sync when back online

### **Phase 4: Additional Features**

#### **5.10. Reporting**
- [ ] Daily sales summary
- [ ] Employee sales performance
- [ ] Fast-moving products
- [ ] Slow-moving products (near expiry)

#### **5.11. Security**
- [ ] POS login/authentication
- [ ] Employee permissions check
- [ ] Sensitive action confirmation (Delete hold order, etc.)
- [ ] Session timeout

---

## 📝 6. API Endpoints Summary

### **6.1. Orders**
```
GET    /api/orders                    # List orders (with filters)
GET    /api/orders/:id                # Get order details
POST   /api/orders                    # Create order (draft)
PUT    /api/orders/:id                # Update order (status change)
DELETE /api/orders/:id                # Delete draft order
```

### **6.2. Customers**
```
GET    /api/customers                 # List customers
GET    /api/customers/:id             # Get customer details
POST   /api/customers                 # Create new customer
```

### **6.3. Products**
```
GET    /api/products                  # List products
GET    /api/products/:id              # Get product details
GET    /api/products?barcode=...      # Search by barcode
```

### **6.4. Product Batches**
```
GET    /api/product-batches           # List batches
GET    /api/product-batches/:id       # Get batch details
GET    /api/product-batches?product=...&status=active&hasStock=true
                                      # Get available batches for product
```

### **6.5. Payments**
```
GET    /api/payments                  # List payments
POST   /api/payments                  # Create payment
```

### **6.6. Detail Inventories**
```
GET    /api/detail-inventories?productBatch=...
                                      # Get stock for batch
```

---

## 🧪 7. Testing Scenarios

### **7.1. Happy Path**
```
1. ✅ Scan product → Add to cart
2. ✅ Add fresh product → Select batch
3. ✅ Hold order → Save as draft
4. ✅ Resume hold order → Load cart
5. ✅ Checkout → Reserve stock
6. ✅ Payment → Complete order
7. ✅ Print receipt
```

### **7.2. Edge Cases**
```
1. ⚠️ Add product with insufficient stock
2. ⚠️ Select expired batch (fresh product)
3. ⚠️ Concurrent orders for same batch
4. ⚠️ Hold order → Stock depleted → Resume order
5. ⚠️ Payment failed → Rollback reservation
6. ⚠️ Network error during checkout
```

### **7.3. Error Scenarios**
```
1. ❌ Add product with 0 stock
2. ❌ Select batch with insufficient quantity
3. ❌ Checkout without customer
4. ❌ Checkout with empty cart
5. ❌ Delete order with status != draft
6. ❌ Update completed order
```

---

## 📊 8. Database Queries

### **8.1. Get Hold Orders for Employee**
```javascript
const holdOrders = await Order.find({
  createdBy: employeeId,
  status: 'draft'
})
.populate('customer', 'fullName phone customerType')
.sort({ createdAt: -1 })
.limit(20);
```

### **8.2. Get Available Batches for Product**
```javascript
const batches = await ProductBatch.aggregate([
  { $match: { product: productId, status: 'active' } },
  {
    $lookup: {
      from: 'detailinventories',
      localField: '_id',
      foreignField: 'productBatch',
      as: 'inventory'
    }
  },
  { $unwind: '$inventory' },
  { $match: { 'inventory.quantityOnShelf': { $gt: 0 } } },
  {
    $project: {
      batchCode: 1,
      expiryDate: 1,
      manufacturingDate: 1,
      quantityOnShelf: '$inventory.quantityOnShelf'
    }
  },
  { $sort: { expiryDate: 1 } } // FEFO order
]);
```

### **8.3. Validate Stock Before Checkout**
```javascript
// For each order detail
const detailInv = await DetailInventory.findOne({
  productBatch: orderDetail.batch
});

if (!detailInv || detailInv.quantityOnShelf < orderDetail.quantity) {
  throw new Error(`Insufficient stock for ${orderDetail.product.name}`);
}
```

---

## 🚀 9. Performance Optimization

### **9.1. Caching Strategy**
```javascript
// Cache product list for quick search
const productCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const getProducts = async (refresh = false) => {
  const cacheKey = 'products_all';
  const cached = productCache.get(cacheKey);

  if (!refresh && cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const products = await fetchProducts();
  productCache.set(cacheKey, {
    data: products,
    timestamp: Date.now()
  });

  return products;
};
```

### **9.2. Debouncing Search**
```javascript
// Debounce search input
const debouncedSearch = debounce(async (query) => {
  const results = await searchProducts(query);
  setSearchResults(results);
}, 300);
```

### **9.3. Lazy Loading**
```javascript
// Load batches only when needed (fresh products)
const loadBatchesOnDemand = async (productId) => {
  if (batchCache.has(productId)) {
    return batchCache.get(productId);
  }

  const batches = await fetchBatches(productId);
  batchCache.set(productId, batches);
  return batches;
};
```

---

## 🔐 10. Security Considerations

### **10.1. Employee Authentication**
```javascript
// POS must authenticate employee
const posLogin = async (username, password) => {
  const response = await fetch('/api/pos-login', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  });

  const { token, employee } = await response.json();

  // Store token in localStorage or sessionStorage
  localStorage.setItem('posToken', token);
  localStorage.setItem('currentEmployee', JSON.stringify(employee));
};
```

### **10.2. Order Ownership Validation**
```javascript
// Backend: Only allow employee to access their own draft orders
const getHoldOrders = async (req, res) => {
  const employeeId = req.user.employeeId; // From auth middleware

  const orders = await Order.find({
    createdBy: employeeId,
    status: 'draft'
  });

  res.json({ orders });
};
```

### **10.3. Action Confirmation**
```javascript
// Confirm critical actions
const confirmDeleteHoldOrder = (orderId) => {
  if (window.confirm('Delete this hold order? This cannot be undone.')) {
    deleteOrder(orderId);
  }
};
```

---

## 📱 11. Mobile Responsive Design

### **11.1. Tablet Layout (Recommended)**
- Split screen: Product selection (left) + Cart (right)
- Large touch-friendly buttons
- Virtual keyboard support
- Barcode scanner integration

### **11.2. Phone Layout (Fallback)**
- Single column view
- Swipe between Product/Cart screens
- Bottom navigation bar
- Simplified batch selection

---

## 🎯 12. Key Takeaways

### **✅ DO:**
1. ✅ Sử dụng draft status cho hold orders
2. ✅ Tự động FEFO cho regular products
3. ✅ Manual batch selection cho fresh products
4. ✅ Validate stock trước khi checkout
5. ✅ Reserve stock khi chuyển draft → pending
6. ✅ Deduct stock khi chuyển pending → delivered
7. ✅ Display batch info cho fresh products
8. ✅ Cache products cho performance
9. ✅ Error handling rõ ràng

### **❌ DON'T:**
1. ❌ Không trừ kho khi order ở draft status
2. ❌ Không cho phép edit order sau khi delivered
3. ❌ Không skip stock validation
4. ❌ Không hard-code discount percentages (lấy từ systemSettings)
5. ❌ Không delete order nếu paymentStatus !== 'pending'
6. ❌ Không cho phép concurrent batch selection cho cùng stock

---

## 📞 Support & Documentation

**Backend API Documentation:** `/docs/API.md` (if exists)  
**Batch Management:** `/docs/BATCH_MANAGEMENT_WORKFLOW.md`  
**System Settings:** `/docs/SYSTEM_SETTINGS_IMPLEMENTATION.md`  

**Questions?** Contact backend team or check existing docs.

---

## 💡 13. Khách Vãng Lai Strategy

### **13.1. Virtual Guest Customer (Abstract Object)**

**Chiến lược:**
- **KHÔNG** lưu khách vãng lai cụ thể vào database
- Sử dụng **đối tượng trừu tượng** (virtual object) đại diện cho tất cả khách vãng lai
- Bất kỳ customer nào có `customerType: 'guest'` đều được coi là khách vãng lai
- Không cần field `isDefaultGuest` hay migration script

**✅ Ưu điểm:**
1. ✅ Đơn giản, không phức tạp hóa database schema
2. ✅ Không cần migration hay seeding data
3. ✅ Linh hoạt - mọi order có thể tạo guest customer riêng nếu cần
4. ✅ Database sạch hơn - không có customer "đặc biệt"
5. ✅ Logic đơn giản: `customerType === 'guest'` = walk-in customer

### **13.2. Implementation Details**

**Virtual Guest Object:**
```javascript
// GET /api/customers/default-guest
// Returns virtual object (not from database)
{
  id: "virtual-guest",
  customerCode: "GUEST",
  fullName: "Khách vãng lai",
  phone: null,
  email: null,
  customerType: "guest",
  address: null,
  gender: "other",
  totalSpent: 0,
  isActive: true,
  isVirtual: true, // Flag indicating virtual object
  createdAt: new Date(),
  updatedAt: new Date()
}
```

**Frontend Usage:**
- POS auto-load virtual guest khi mở
- Frontend auto-select guest nếu chưa có customer nào
- Khi tạo order, backend sẽ xử lý logic tạo customer nếu cần

### **13.3. Backend Order Creation Logic** ✅ IMPLEMENTED

**Frontend → Backend Flow:**
```javascript
// Frontend sends (POS)
POST /api/orders
{
  customer: "virtual-guest", // or null
  items: [...],
  status: "draft"
}

// Backend xử lý (IMPLEMENTED):
ordersRouter.post('/', async (request, response) => {
  let customerId = customer;
  let customerDoc = null;

  // ⭐ If customer is virtual-guest or null, create new guest customer
  if (!customer || customer === 'virtual-guest') {
    console.log('[Order] Creating new guest customer...');
    
    const guestCustomer = await Customer.create({
      fullName: 'Khách vãng lai',
      customerType: 'guest'
      // Auto-generate customerCode: CUST2025000001, CUST2025000002, etc.
    });
    
    customerId = guestCustomer._id;
    customerDoc = guestCustomer;
    
    console.log(`[Order] ✅ Created guest ${guestCustomer.customerCode}`);
  } else {
    // Validate existing customer
    customerDoc = await Customer.findById(customer);
    if (!customerDoc) {
      return response.status(404).json({
        error: { message: 'Customer not found' }
      });
    }
  }

  // Create order with validated/created customer
  const order = await Order.create({
    customer: customerId, // ← Real customer ID (guest or existing)
    items: [...],
    status: 'draft'
  });

  response.status(201).json({ success: true, data: { order } });
});
```

**✅ Kết quả:**
- Mỗi order có customer riêng (guest customers: CUST2025000001, CUST2025000002, ...)
- Tracking đầy đủ
- Có thể upgrade guest → retail về sau
- Không cần logic đặc biệt

### **13.4. Báo cáo với khách vãng lai**

```javascript
// Query: Tổng doanh số theo loại khách hàng
const salesByCustomerType = await Order.aggregate([
  {
    $lookup: {
      from: 'customers',
      localField: 'customer',
      foreignField: '_id',
      as: 'customerInfo'
    }
  },
  { $unwind: '$customerInfo' },
  {
    $group: {
      _id: '$customerInfo.customerType',
      totalSales: { $sum: '$total' },
      orderCount: { $sum: 1 }
    }
  }
]);

// Result:
// {
//   guest: { totalSales: 50000000, orderCount: 1500 }, // All walk-in customers
//   retail: { totalSales: 120000000, orderCount: 800 },
//   wholesale: { totalSales: 300000000, orderCount: 200 },
//   vip: { totalSales: 500000000, orderCount: 150 }
// }
```

---

**Version History:**
- v1.0 (2025-11-25): Initial documentation
- v1.1 (2025-11-25): Added customer selection workflow and guest customer strategy
