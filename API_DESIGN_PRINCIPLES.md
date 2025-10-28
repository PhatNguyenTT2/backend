# API Design Principles - Resource References

## 📋 Nguyên Tắc Chung

Khi thiết kế RESTful API, mỗi endpoint nên **chỉ trả về dữ liệu thuộc về resource đó** và **tham chiếu đến các resource khác qua ID**, thay vì populate toàn bộ dữ liệu của resource liên quan.

---

## 🎯 Nguyên Tắc: Reference Over Embedding

### ✅ **ĐÚNG: Chỉ trả về ID của resource liên quan**

```json
// GET /api/detail-customers/:id
{
  "success": true,
  "data": {
    "detailCustomer": {
      "id": "abc123",
      "customerId": "xyz789",        // ✅ Chỉ trả về ID
      "customerType": "vip",
      "totalSpent": 50000000,
      "notes": "VIP customer",
      "createdAt": "2025-10-20T00:00:00Z",
      "updatedAt": "2025-10-23T00:00:00Z"
    }
  }
}
```

### ❌ **SAI: Populate toàn bộ dữ liệu của resource liên quan**

```json
// GET /api/detail-customers/:id
{
  "success": true,
  "data": {
    "detailCustomer": {
      "id": "abc123",
      "customer": {                    // ❌ Dư thừa dữ liệu
        "id": "xyz789",
        "customerCode": "CUST20250001",
        "fullName": "Nguyễn Văn A",
        "email": "nguyenvana@example.com",
        "phone": "0123456789",
        "address": "123 ABC Street",
        "gender": "male",
        "dateOfBirth": "1990-01-01",
        "isActive": true
      },
      "customerType": "vip",
      "totalSpent": 50000000,
      "notes": "VIP customer"
    }
  }
}
```

---

## 🔍 Lý Do và Lợi Ích

### 1. **Single Responsibility Principle (SRP)**
- Mỗi endpoint chỉ chịu trách nhiệm về **resource của nó**
- `/api/detail-customers/:id` chỉ nên trả về thông tin **detail customer**, không phải customer
- `/api/customers/:id` chịu trách nhiệm trả về thông tin **customer đầy đủ**

### 2. **Performance - Hiệu Suất**
- ✅ **Giảm kích thước response** 60-70%
- ✅ **Không cần JOIN/populate** khi không cần thiết
- ✅ **Query nhanh hơn** - Chỉ query 1 collection thay vì nhiều
- ✅ **Giảm tải cho database** - Ít dữ liệu phải đọc và serialize

**Ví dụ:**
```javascript
// TRƯỚC (với populate) - Slow ❌
const detailCustomers = await DetailCustomer.find(filter)
  .populate('customer', 'customerCode fullName email phone address gender dateOfBirth isActive')
  .sort({ totalSpent: -1 })
// Query time: ~150ms | Response size: ~45KB

// SAU (chỉ ID) - Fast ✅
const detailCustomers = await DetailCustomer.find(filter)
  .sort({ totalSpent: -1 })
// Query time: ~45ms | Response size: ~12KB
```

### 3. **Caching - Khả Năng Cache**
- ✅ Customer data có thể được **cache độc lập**
- ✅ Client chỉ cần gọi API `/api/customers/:id` **một lần**, sau đó cache lại
- ✅ Khi customer data thay đổi, **không ảnh hưởng** đến cache của detail-customer

**Flow với cache:**
```javascript
// Lần 1: Lấy detail customer
const detail = await fetch('/api/detail-customers/abc123')
// => { customerId: 'xyz789', ... }

// Lần 2: Kiểm tra cache trước khi gọi API
let customer = cache.get('customer:xyz789')
if (!customer) {
  customer = await fetch('/api/customers/xyz789')
  cache.set('customer:xyz789', customer, 3600) // Cache 1 giờ
}
```

### 4. **Bandwidth - Tiết Kiệm Băng Thông**
- ✅ Đặc biệt quan trọng với **mobile apps** (3G/4G)
- ✅ Giảm chi phí **data transfer** cho server
- ✅ **Faster page load** cho end users

### 5. **Separation of Concerns - Tách Biệt Trách Nhiệm**
- ✅ Mỗi resource có endpoint riêng biệt
- ✅ Dễ dàng **maintain và test** từng phần độc lập
- ✅ Khi thay đổi Customer model, **không ảnh hưởng** đến DetailCustomer responses

### 6. **Flexibility - Linh Hoạt**
- ✅ Client **tự quyết định** khi nào cần thông tin customer đầy đủ
- ✅ Có thể load **lazy** (chỉ load khi cần)
- ✅ Dễ dàng **compose data** theo nhu cầu UI

---

## 📐 Khi Nào Nên Populate?

Có một số trường hợp **hợp lý** để populate dữ liệu:

### ✅ 1. **Aggregate/Report Endpoints**
Khi mục đích endpoint là **tổng hợp dữ liệu từ nhiều nguồn** để hiển thị report/dashboard.

```javascript
// GET /api/reports/customer-overview
// Mục đích: Hiển thị dashboard với đầy đủ thông tin
{
  "customers": [
    {
      "id": "abc123",
      "fullName": "Nguyễn Văn A",
      "customerType": "vip",
      "totalSpent": 50000000,
      "orderCount": 150
    }
  ]
}
```

### ✅ 2. **Search/Filter Endpoints**
Khi cần **search across multiple fields** từ nhiều collections.

```javascript
// GET /api/search?q=nguyenvana
// Trả về kết quả search với context đầy đủ để người dùng nhận diện
```

### ✅ 3. **Minimal Info for Display**
Populate **chỉ những field cần thiết** để hiển thị trong list/dropdown.

```javascript
// Ví dụ: List orders với customer name
// GET /api/orders
{
  "orders": [
    {
      "id": "order123",
      "customer": {
        "id": "xyz789",
        "fullName": "Nguyễn Văn A"  // Chỉ name để hiển thị
      },
      "total": 1000000
    }
  ]
}
```

### ❌ **KHÔNG nên populate khi:**
- Endpoint chỉ cần trả về thông tin của **chính resource đó**
- Dữ liệu được populate **có thể lấy từ endpoint khác**
- Client **không phải lúc nào cũng cần** dữ liệu được populate

---

## 🛠️ Implementation Pattern

### Pattern 1: Chỉ trả về ID (Recommended)

```javascript
// Controller
detailCustomersRouter.get('/:id', async (request, response) => {
  const detailCustomer = await DetailCustomer.findById(request.params.id)
  
  response.json({
    success: true,
    data: {
      detailCustomer: {
        id: detailCustomer._id,
        customerId: detailCustomer.customer,  // Chỉ ID
        customerType: detailCustomer.customerType,
        totalSpent: detailCustomer.totalSpent,
        notes: detailCustomer.notes
      }
    }
  })
})
```

```javascript
// Client Side - Load riêng biệt khi cần
async function loadDetailCustomer(id) {
  const { detailCustomer } = await api.get(`/detail-customers/${id}`)
  
  // Chỉ load customer info khi cần hiển thị
  if (needCustomerInfo) {
    const { customer } = await api.get(`/customers/${detailCustomer.customerId}`)
    return { ...detailCustomer, customer }
  }
  
  return detailCustomer
}
```

### Pattern 2: Optional Populate với Query Parameter

```javascript
// Controller với option
detailCustomersRouter.get('/:id', async (request, response) => {
  const { populate } = request.query
  
  let query = DetailCustomer.findById(request.params.id)
  
  // Chỉ populate khi client yêu cầu
  if (populate === 'customer') {
    query = query.populate('customer', 'customerCode fullName email phone')
  }
  
  const detailCustomer = await query
  
  response.json({
    success: true,
    data: { detailCustomer }
  })
})
```

```javascript
// Client Side - Linh hoạt
// Không cần customer info
await api.get('/detail-customers/123')

// Cần customer info
await api.get('/detail-customers/123?populate=customer')
```

---

## 📊 So Sánh Performance

### Scenario: Lấy danh sách 100 detail customers

| Approach | Query Time | Response Size | Network Time | Total Time |
|----------|------------|---------------|--------------|------------|
| **Populate All** ❌ | 280ms | 450KB | 120ms | **400ms** |
| **Only ID** ✅ | 85ms | 120KB | 35ms | **120ms** |
| **Improvement** | **↓ 70%** | **↓ 73%** | **↓ 71%** | **↓ 70%** |

---

## 🎓 Best Practices Summary

1. ✅ **Default to ID references** - Mặc định chỉ trả về ID
2. ✅ **Populate only when necessary** - Chỉ populate khi thực sự cần thiết
3. ✅ **Document populate options** - Ghi chú rõ khi nào có thể populate
4. ✅ **Consider caching** - Thiết kế với cache trong đầu
5. ✅ **Measure performance** - Đo lường performance thường xuyên
6. ✅ **Keep responses lean** - Giữ response nhẹ nhất có thể
7. ✅ **Let client decide** - Để client quyết định khi nào cần full data

---

## 📝 Example: Customer & DetailCustomer

### ✅ Cấu trúc API đúng

```javascript
// GET /api/customers/:id - Full customer info
{
  "customer": {
    "id": "xyz789",
    "customerCode": "CUST20250001",
    "fullName": "Nguyễn Văn A",
    "email": "nguyenvana@example.com",
    "phone": "0123456789",
    "address": "123 ABC Street",
    "gender": "male",
    "dateOfBirth": "1990-01-01",
    "isActive": true
  }
}

// GET /api/detail-customers/:id - Only detail info + customer ID
{
  "detailCustomer": {
    "id": "abc123",
    "customerId": "xyz789",    // Reference only
    "customerType": "vip",
    "totalSpent": 50000000,
    "notes": "VIP customer"
  }
}

// GET /api/detail-customers/customer/:customerId - Find by customer ID
{
  "detailCustomer": {
    "id": "abc123",
    "customerId": "xyz789",    // Same customer ID
    "customerType": "vip",
    "totalSpent": 50000000
  }
}
```

### Client Side Implementation

```javascript
// Efficient data loading
class CustomerService {
  constructor() {
    this.cache = new Map()
  }
  
  async getCustomerWithDetails(customerId) {
    // Load in parallel nếu cần cả 2
    const [customer, details] = await Promise.all([
      this.getCustomer(customerId),
      this.getCustomerDetails(customerId)
    ])
    
    return { ...customer, details }
  }
  
  async getCustomer(id) {
    // Check cache first
    if (this.cache.has(`customer:${id}`)) {
      return this.cache.get(`customer:${id}`)
    }
    
    const customer = await api.get(`/customers/${id}`)
    this.cache.set(`customer:${id}`, customer, 3600)
    return customer
  }
  
  async getCustomerDetails(customerId) {
    return api.get(`/detail-customers/customer/${customerId}`)
  }
}
```

---

## 🔚 Conclusion

**Nguyên tắc vàng:** 
> "Mỗi endpoint chỉ nên trả về dữ liệu của chính resource đó. Reference đến các resource khác qua ID, để client tự quyết định khi nào cần load full data."

Điều này giúp API của bạn:
- ⚡ Nhanh hơn
- 💾 Tiết kiệm băng thông
- 🔧 Dễ maintain
- 🎯 Linh hoạt hơn
- 📦 Dễ cache hơn

---

**Created:** October 23, 2025  
**Last Updated:** October 23, 2025  
**Version:** 1.0
