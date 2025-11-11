# Batch Management Workflow

## Tổng quan
Document này mô tả workflow quản lý lô hàng (batch management) trong hệ thống, bao gồm quy trình nhập hàng, bán hàng, và xử lý hết hạn cho 2 loại mặt hàng: **Bình thường** và **Tươi sống**.

---

## 📦 Phân loại Mặt hàng

### 1. **Mặt hàng Bình thường**
- Nước ngọt, snack, đồ hộp, mỹ phẩm, thuốc...
- HSD dài (> 3 tháng)
- Vòng quay hàng ổn định
- **Strategy**: FEFO tự động (First Expired First Out)

### 2. **Mặt hàng Tươi sống**
- Rau, củ, quả, thịt, cá, sữa tươi, bánh mì...
- HSD ngắn (< 7 ngày)
- Cần xử lý nhanh
- **Strategy**: Tùy chọn lô + Giảm giá động

---

## 🔄 Workflow Chung

```
┌─────────────────────────────────────────────────────────────┐
│                    WORKFLOW TỔNG QUAN                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  NHẬP HÀNG                                                   │
│  └─> Quét mã NSX                                             │
│      └─> Chọn/Tạo lô                                         │
│          └─> Nhập thông tin lô (HSD, NSX, SL)                │
│              └─> Lưu vào database                            │
│                                                              │
│  BÁN HÀNG                                                    │
│  ├─> [Mặt hàng BÌNH THƯỜNG]                                  │
│  │   └─> Quét mã NSX                                         │
│  │       └─> Hệ thống TỰ ĐỘNG chọn lô FEFO                  │
│  │           └─> Trừ inventory                               │
│  │                                                           │
│  └─> [Mặt hàng TƯƠI SỐNG]                                    │
│      └─> Quét mã NSX                                         │
│          └─> Nhân viên TỰ CHỌN lô                            │
│              └─> Áp dụng giảm giá/khuyến mãi (nếu có)        │
│                  └─> Trừ inventory                           │
│                                                              │
│  QUẢN LÝ HẾT HẠN                                             │
│  ├─> Cron job hàng ngày (00:00)                              │
│  │   └─> Tự động đánh dấu lô hết hạn                         │
│  │                                                           │
│  ├─> Dashboard cảnh báo                                      │
│  │   ├─> Critical: < 7 ngày                                  │
│  │   ├─> Warning: 7-14 ngày                                  │
│  │   └─> Notice: 15-30 ngày                                  │
│  │                                                           │
│  └─> Xử lý mặt hàng tươi sống sắp hết hạn                    │
│      ├─> Tự động giảm giá (HSD < 2 ngày)                     │
│      ├─> Khuyến mãi mua 1 tặng 1 (HSD < 1 ngày)              │
│      └─> Thông báo nhân viên xử lý                           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 1️⃣ NHẬP HÀNG (Stock Receiving)

### Flow Chart
```
Quét mã NSX (8934588123456)
    ↓
Tìm Product trong DB
    ↓
Hiển thị thông tin sản phẩm
    ↓
Lựa chọn:
├─> [Lô hiện có] → Chọn lô → Cộng số lượng
└─> [Tạo lô mới] → Nhập thông tin lô
                   ├─ Mã lô (BATCH001)
                   ├─ NSX (01/11/2025)
                   ├─ HSD (31/01/2026)
                   ├─ Số lượng (50)
                   └─ Ghi chú (optional)
    ↓
Lưu vào database:
├─> ProductBatch
├─> Inventory (+quantity)
└─> Log transaction
    ↓
✅ Hoàn tất
```

### API Endpoint

**POST /api/stock-receiving**

```json
Request:
{
  "productCode": "PROD001",      // Từ barcode scan
  "batchCode": "BATCH003",       // Nhân viên nhập
  "mfgDate": "2025-11-01",       // Nhân viên nhập
  "expiryDate": "2026-01-31",    // Nhân viên nhập
  "quantity": 50,                // Nhân viên nhập
  "notes": "Lô mới từ NCC ABC"   // Optional
}

Response:
{
  "success": true,
  "data": {
    "product": { ... },
    "batch": {
      "id": "673f...",
      "batchCode": "BATCH003",
      "expiryDate": "2026-01-31",
      "quantity": 50,
      "status": "active"
    },
    "inventory": {
      "quantityOnHand": 130,
      "quantityAvailable": 130
    }
  },
  "message": "Stock received successfully"
}
```

### Business Rules
- ✅ Bắt buộc nhập thông tin lô khi nhập hàng
- ✅ Tự động tạo `batchCode` nếu không có (format: PROD001-YYYYMMDD-001)
- ✅ Validation: `expiryDate` > `mfgDate`
- ✅ Validation: `expiryDate` > today (cảnh báo nếu đã hết hạn)
- ✅ Transaction: Đảm bảo atomic (batch + inventory cùng update)

---

## 2️⃣ BÁN HÀNG - Mặt hàng BÌNH THƯỜNG

### Flow Chart
```
Quét mã NSX (8934588123456)
    ↓
Tìm Product + Available Batches
    ↓
Hệ thống TỰ ĐỘNG chọn lô FEFO
(First Expired First Out)
    ↓
Hiển thị thông tin:
├─ Sản phẩm: Coca Cola 330ml
├─ Giá: 10,000đ
└─ Lô được chọn: BATCH003 (HSD: 31/01/2026)
    ↓
Nhân viên nhập số lượng: 10
    ↓
Thêm vào giỏ hàng
    ↓
[Thanh toán]
    ↓
Trừ inventory:
├─> BATCH003: -10
├─> Inventory: -10
└─> Log transaction
    ↓
✅ Hoàn tất
```

### API Endpoint

**POST /api/sales**

```json
Request:
{
  "customer": "customerId",      // Optional (null = khách vãng lai)
  "items": [
    {
      "product": "productId1",
      "quantity": 10             // Hệ thống tự phân bổ vào lô FEFO
    },
    {
      "product": "productId2",
      "quantity": 5
    }
  ],
  "paymentMethod": "cash",
  "totalAmount": 150000
}

Response:
{
  "success": true,
  "data": {
    "sale": {
      "id": "sale123",
      "items": [
        {
          "product": "productId1",
          "productName": "Coca Cola 330ml",
          "batches": [                    // Tự động phân bổ
            {
              "batch": "batchId1",
              "batchCode": "BATCH003",
              "quantity": 10,
              "expiryDate": "2026-01-31"
            }
          ],
          "quantity": 10,
          "amount": 100000
        }
      ],
      "totalAmount": 150000,
      "status": "completed"
    }
  },
  "message": "Sale completed successfully"
}
```

### FEFO Algorithm

```javascript
// Pseudo code
function allocateBatchesFEFO(productId, requestedQty) {
  // 1. Lấy các lô available, sắp xếp theo HSD
  batches = find({
    product: productId,
    status: 'active',
    quantity: > 0,
    expiryDate: > today
  }).sort({ expiryDate: ASC })
  
  // 2. Phân bổ số lượng vào các lô
  selectedBatches = []
  remaining = requestedQty
  
  for (batch in batches) {
    if (remaining <= 0) break
    
    takeQty = min(batch.quantity, remaining)
    selectedBatches.push({
      batch: batch,
      quantity: takeQty
    })
    
    batch.quantity -= takeQty
    remaining -= takeQty
  }
  
  // 3. Check đủ hàng không
  if (remaining > 0) {
    throw Error("Insufficient stock")
  }
  
  return selectedBatches
}
```

### Business Rules
- ✅ **FEFO tự động**: Ưu tiên lô HSD gần nhất
- ✅ **Multi-batch**: Cho phép lấy từ nhiều lô nếu 1 lô không đủ
- ✅ **Validation**: Không bán lô đã hết hạn hoặc disposed
- ✅ **Transaction**: Atomic update batches + inventory
- ✅ **Logging**: Lưu snapshot batches đã bán để truy xuất

---

## 3️⃣ BÁN HÀNG - Mặt hàng TƯƠI SỐNG

### Flow Chart
```
Quét mã NSX (8934588123456)
    ↓
Tìm Product + Available Batches
    ↓
Hiển thị DANH SÁCH LÔ cho nhân viên CHỌN:
┌────────────────────────────────────────┐
│ ☐ BATCH010 - HSD: 14/11/2025 (2 ngày) │
│   Giá: 8,000đ (-20% giảm giá)         │
│   Tồn: 15 kg                          │
│                                       │
│ ☐ BATCH011 - HSD: 13/11/2025 (1 ngày) │
│   Giá: 5,000đ (Mua 1 tặng 1) 🎁       │
│   Tồn: 8 kg                           │
│                                       │
│ ☑ BATCH012 - HSD: 16/11/2025 (4 ngày) │
│   Giá: 10,000đ (Giá gốc)              │
│   Tồn: 25 kg                          │
└────────────────────────────────────────┘
    ↓
Nhân viên chọn lô + Nhập số lượng
    ↓
Áp dụng giá (gốc/giảm/khuyến mãi)
    ↓
Thêm vào giỏ hàng
    ↓
[Thanh toán]
    ↓
Trừ inventory
    ↓
✅ Hoàn tất
```

### API Endpoint

**GET /api/products/:id/batches-for-sale**

```json
Response:
{
  "success": true,
  "data": {
    "product": {
      "id": "prod123",
      "name": "Rau cải ngọt",
      "unit": "kg",
      "originalPrice": 10000
    },
    "batches": [
      {
        "id": "batch010",
        "batchCode": "BATCH010",
        "expiryDate": "2025-11-14",
        "daysUntilExpiry": 2,
        "quantity": 15,
        "pricing": {
          "type": "discount",
          "originalPrice": 10000,
          "discountPercent": 20,
          "salePrice": 8000,
          "reason": "Near expiry (2 days)"
        },
        "badge": "⚠️ Giảm 20%"
      },
      {
        "id": "batch011",
        "batchCode": "BATCH011",
        "expiryDate": "2025-11-13",
        "daysUntilExpiry": 1,
        "quantity": 8,
        "pricing": {
          "type": "promo",
          "originalPrice": 10000,
          "salePrice": 5000,
          "promoType": "buy1get1",
          "reason": "Expiring tomorrow"
        },
        "badge": "🎁 Mua 1 tặng 1"
      },
      {
        "id": "batch012",
        "batchCode": "BATCH012",
        "expiryDate": "2025-11-16",
        "daysUntilExpiry": 4,
        "quantity": 25,
        "pricing": {
          "type": "normal",
          "originalPrice": 10000,
          "salePrice": 10000
        },
        "badge": null
      }
    ],
    "suggestion": "batch011"  // Gợi ý bán lô sắp hết hạn nhất
  }
}
```

**POST /api/sales/fresh-products**

```json
Request:
{
  "customer": "customerId",
  "items": [
    {
      "product": "productId1",
      "batches": [                    // TỰ CHỌN
        {
          "batch": "batch011",
          "quantity": 2,
          "priceType": "promo",        // Để tracking khuyến mãi
          "unitPrice": 5000
        }
      ]
    }
  ],
  "paymentMethod": "cash",
  "totalAmount": 10000
}

Response: (Tương tự sale bình thường)
```

### Pricing Rules (Mặt hàng tươi sống)

```javascript
function calculateFreshProductPrice(batch, product) {
  const daysLeft = batch.daysUntilExpiry;
  const basePrice = product.originalPrice;
  
  // Rule 1: HSD < 1 ngày → Mua 1 tặng 1
  if (daysLeft < 1 && daysLeft >= 0) {
    return {
      type: 'promo',
      salePrice: basePrice / 2,      // 50% giá
      promoType: 'buy1get1',
      badge: '🎁 Mua 1 tặng 1'
    };
  }
  
  // Rule 2: HSD 1-2 ngày → Giảm 30%
  if (daysLeft >= 1 && daysLeft < 2) {
    return {
      type: 'discount',
      salePrice: basePrice * 0.7,    // Giảm 30%
      discountPercent: 30,
      badge: '⚠️ Giảm 30%'
    };
  }
  
  // Rule 3: HSD 2-3 ngày → Giảm 20%
  if (daysLeft >= 2 && daysLeft < 3) {
    return {
      type: 'discount',
      salePrice: basePrice * 0.8,    // Giảm 20%
      discountPercent: 20,
      badge: '⚠️ Giảm 20%'
    };
  }
  
  // Rule 4: HSD 3-5 ngày → Giảm 10%
  if (daysLeft >= 3 && daysLeft < 5) {
    return {
      type: 'discount',
      salePrice: basePrice * 0.9,    // Giảm 10%
      discountPercent: 10,
      badge: 'Giảm 10%'
    };
  }
  
  // Rule 5: HSD >= 5 ngày → Giá gốc
  return {
    type: 'normal',
    salePrice: basePrice,
    badge: null
  };
}
```

### Business Rules
- ✅ **Manual selection**: Nhân viên TỰ CHỌN lô để bán
- ✅ **Dynamic pricing**: Giá tự động theo HSD
- ✅ **Visual badges**: Hiển thị rõ khuyến mãi/giảm giá
- ✅ **Suggestion**: Gợi ý bán lô sắp hết hạn nhất
- ✅ **Multi-batch**: Cho phép chọn nhiều lô cùng lúc
- ✅ **Promotion tracking**: Lưu loại khuyến mãi đã áp dụng

---

## 4️⃣ QUẢN LÝ HẾT HẠN (Expiry Management)

### 4.1 Cron Job - Auto Check Expired

**Chạy hàng ngày lúc 00:00**

```javascript
// Tự động đánh dấu lô đã hết hạn
const result = await ProductBatch.updateMany(
  {
    status: 'active',
    expiryDate: { $lt: new Date() }
  },
  {
    $set: { status: 'expired' }
  }
);

console.log(`✅ Marked ${result.modifiedCount} batches as expired`);
```

### 4.2 Dashboard - Near Expiry Alert

**GET /api/reports/near-expiry-batches?days=30**

```json
Response:
{
  "success": true,
  "data": {
    "total": 15,
    "grouped": {
      "critical": [        // HSD < 7 ngày
        {
          "batch": { ... },
          "product": { ... },
          "daysUntilExpiry": 3,
          "quantity": 10,
          "action": "Urgent: Sell or dispose"
        }
      ],
      "warning": [         // HSD 7-14 ngày
        {
          "batch": { ... },
          "product": { ... },
          "daysUntilExpiry": 10,
          "quantity": 25,
          "action": "Promote or discount"
        }
      ],
      "notice": [          // HSD 15-30 ngày
        {
          "batch": { ... },
          "product": { ... },
          "daysUntilExpiry": 20,
          "quantity": 50,
          "action": "Monitor"
        }
      ]
    }
  }
}
```

### 4.3 Auto Pricing for Fresh Products

**Chạy mỗi 6 giờ (00:00, 06:00, 12:00, 18:00)**

```javascript
// Tự động cập nhật giá cho mặt hàng tươi sống
const freshProductBatches = await ProductBatch.find({
  status: 'active',
  expiryDate: { $lte: futureDate },  // HSD <= 5 ngày
  product: { $in: freshProductIds }
}).populate('product');

for (const batch of freshProductBatches) {
  const pricing = calculateFreshProductPrice(batch, batch.product);
  
  // Lưu vào batch hoặc cache
  // Frontend sẽ lấy giá này để hiển thị
}
```

---

## 5️⃣ PHÂN BIỆT MẶT HÀNG

### Product Schema Update

```javascript
const productSchema = new mongoose.Schema({
  // ...existing fields...
  
  productType: {
    type: String,
    enum: ['normal', 'fresh'],
    default: 'normal'
  },
  
  // Chỉ áp dụng cho fresh products
  freshSettings: {
    autoDiscount: {
      type: Boolean,
      default: false
    },
    discountRules: [{
      daysBeforeExpiry: Number,  // 2
      discountPercent: Number,   // 20
      promoType: String          // 'discount', 'buy1get1'
    }]
  }
  
  // ...existing fields...
});
```

### Phân loại khi tạo Product

```json
// Mặt hàng bình thường
{
  "name": "Coca Cola 330ml",
  "productType": "normal"
}

// Mặt hàng tươi sống
{
  "name": "Rau cải ngọt",
  "productType": "fresh",
  "freshSettings": {
    "autoDiscount": true,
    "discountRules": [
      { "daysBeforeExpiry": 3, "discountPercent": 20, "promoType": "discount" },
      { "daysBeforeExpiry": 2, "discountPercent": 30, "promoType": "discount" },
      { "daysBeforeExpiry": 1, "discountPercent": 50, "promoType": "buy1get1" }
    ]
  }
}
```

---

## 6️⃣ UX/UI DESIGN

### POS Screen - Normal Products

```
┌───────────────────────────────────────┐
│ 🔍 Quét/Tìm sản phẩm                  │
├───────────────────────────────────────┤
│                                       │
│ Scan: 8934588123456                   │
│                                       │
│ ✅ Coca Cola 330ml                    │
│    Giá: 10,000đ                       │
│    Tồn kho: 130 chai                  │
│    Lô: BATCH003 (HSD: 31/01/2026)     │
│         ↑ Tự động chọn theo FEFO      │
│                                       │
│    Số lượng: [___10___] ⬆⬇            │
│                                       │
│    [Thêm vào giỏ]                     │
│                                       │
└───────────────────────────────────────┘
```

### POS Screen - Fresh Products

```
┌───────────────────────────────────────┐
│ 🔍 Quét/Tìm sản phẩm                  │
├───────────────────────────────────────┤
│                                       │
│ Scan: 8934588123456                   │
│                                       │
│ ✅ Rau cải ngọt                       │
│    Giá gốc: 10,000đ/kg                │
│    Tồn kho: 48 kg                     │
│                                       │
│ 📦 Chọn lô hàng:                      │
│                                       │
│ ○ BATCH011 (HSD: 13/11) - 8 kg       │
│   🎁 Mua 1 tặng 1 - 5,000đ/kg         │
│   └─ Gợi ý: Bán ngay hôm nay!         │
│                                       │
│ ● BATCH010 (HSD: 14/11) - 15 kg      │
│   ⚠️ Giảm 20% - 8,000đ/kg             │
│   └─ Số lượng: [___2___] kg ⬆⬇        │
│                                       │
│ ○ BATCH012 (HSD: 16/11) - 25 kg      │
│   Giá gốc: 10,000đ/kg                 │
│                                       │
│    [Thêm vào giỏ]                     │
│                                       │
└───────────────────────────────────────┘
```

---

## 7️⃣ API SUMMARY

### Core APIs

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/stock-receiving` | POST | Nhập hàng (tạo/update batch) |
| `/api/sales` | POST | Bán hàng bình thường (FEFO) |
| `/api/sales/fresh-products` | POST | Bán hàng tươi sống (chọn lô) |
| `/api/products/:id/batches` | GET | Lấy danh sách lô (bình thường) |
| `/api/products/:id/batches-for-sale` | GET | Lấy danh sách lô + giá (tươi sống) |
| `/api/product-batches` | GET | Quản lý lô hàng (CRUD) |
| `/api/reports/near-expiry-batches` | GET | Báo cáo lô sắp hết hạn |

### Background Jobs

| Job | Schedule | Purpose |
|-----|----------|---------|
| Check Expired Batches | Daily 00:00 | Đánh dấu lô hết hạn |
| Update Fresh Pricing | Every 6h | Cập nhật giá mặt hàng tươi sống |
| Expiry Alert Email | Daily 08:00 | Gửi email cảnh báo lô sắp hết hạn |

---

## 8️⃣ REPORTS & ANALYTICS

### Dashboard Widgets

1. **Expiry Overview**
   - Critical (< 7 days): X lô
   - Warning (7-14 days): Y lô
   - Notice (15-30 days): Z lô

2. **Fresh Product Performance**
   - Số lượng bán theo mức giảm giá
   - Hiệu quả khuyến mãi (buy1get1)
   - Tỷ lệ thanh lý thành công

3. **FEFO Efficiency**
   - % lô được bán theo đúng FEFO
   - Thời gian tồn kho trung bình
   - Tổn thất do hết hạn

4. **Batch Traceability**
   - Lịch sử bán hàng theo lô
   - Truy xuất nguồn gốc
   - Batch recall (nếu cần)

---

## 9️⃣ BUSINESS RULES SUMMARY

### Mặt hàng Bình thường
- ✅ FEFO tự động khi bán
- ✅ Không cần chọn lô thủ công
- ✅ Giá cố định
- ✅ Cảnh báo khi HSD < 30 ngày

### Mặt hàng Tươi sống
- ✅ Nhân viên chọn lô thủ công
- ✅ Giá động theo HSD
- ✅ Khuyến mãi tự động (< 2 ngày)
- ✅ Gợi ý bán lô sắp hết hạn

### Chung
- ✅ Bắt buộc nhập lô khi nhập hàng
- ✅ Không bán lô đã hết hạn
- ✅ Transaction đảm bảo data consistency
- ✅ Logging đầy đủ để audit

---

## 🔟 IMPLEMENTATION CHECKLIST

### Phase 1: Core (Week 1-2)
- [ ] Update ProductBatch model
- [ ] API: Stock receiving
- [ ] API: Sales (FEFO for normal products)
- [ ] Cron job: Check expired batches

### Phase 2: Fresh Products (Week 3-4)
- [ ] Add `productType` to Product model
- [ ] API: Fresh product batches with pricing
- [ ] API: Sales for fresh products
- [ ] Cron job: Auto pricing for fresh products

### Phase 3: UI/UX (Week 5-6)
- [ ] POS screen for normal products
- [ ] POS screen for fresh products (batch selection)
- [ ] Dashboard: Near expiry alerts
- [ ] Dashboard: Fresh product performance

### Phase 4: Reports (Week 7-8)
- [ ] Expiry reports
- [ ] FEFO efficiency reports
- [ ] Batch traceability
- [ ] Email alerts

---

## 📚 REFERENCES

- [FEFO vs FIFO](https://www.investopedia.com/terms/f/fifo.asp)
- [Food Safety & Batch Tracking](https://www.fda.gov/food/food-safety-modernization-act-fsma)
- [Dynamic Pricing Strategies](https://www.shopify.com/retail/dynamic-pricing)

---

**Last Updated**: 2025-11-12  
**Version**: 1.0  
**Maintainer**: Backend Team  
**Status**: ✅ Approved
