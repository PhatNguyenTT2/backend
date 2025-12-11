# Test Suite Documentation

## Tổng quan

Backend của dự án sử dụng **Jest** và **Supertest** để testing các API endpoints. Tất cả các test files nằm trong thư mục `test/`.

## Công nghệ sử dụng

- **Jest** v30.2.0 - Test runner và framework
- **Supertest** v7.1.4 - HTTP assertion library
- **Mockingoose** v2.16.2 - MongoDB/Mongoose mocking library
- **bcrypt** - Password hashing cho authentication tests
- **jsonwebtoken** - JWT token testing

## Cấu trúc Test

Mỗi test file tuân theo pattern:
- 10-15 tests per controller
- 2-4 tests per endpoint
- Focus: validation errors, business logic errors, 404 errors
- Skip: complex transaction success, cascade operations

## Danh sách Test Files

### 1. categories.test.js
**Controller**: Categories CRUD  
**Endpoints tested**:
- `GET /api/categories` - List categories with filters
- `GET /api/categories/:id` - Get single category
- `POST /api/categories` - Create category
- `PUT /api/categories/:id` - Update category
- `DELETE /api/categories/:id` - Delete category

**Test cases** (13 tests):
- GET: Pagination, database errors
- GET/:id: Success, 404
- POST: Missing name, duplicate code, validation
- PUT: 404, duplicate code, validation
- DELETE: 404, has products constraint

**Đặc điểm**:
- Mock authentication middleware
- Test validation với categoryCode format
- Test constraint với products relationship

---

### 2. login.test.js
**Controller**: Authentication  
**Endpoints tested**:
- `POST /api/login` - User login

**Test cases** (5 tests):
- Login success với valid credentials
- Login failed với wrong password
- Login failed với non-existent user
- Login failed với missing username
- Login failed với missing password

**Đặc điểm**:
- bcrypt password hashing
- JWT token generation
- Mock environment variables (JWT_SECRET)
- Populate user với role và employee data

---

### 3. customers.test.js
**Controller**: Customers CRUD  
**Endpoints tested**:
- `GET /api/customers` - List customers
- `GET /api/customers/:id` - Get single customer
- `POST /api/customers` - Create customer
- `PUT /api/customers/:id` - Update customer
- `DELETE /api/customers/:id` - Delete customer

**Test cases** (13 tests):
- GET: Pagination, database errors
- GET/:id: Success, 404
- POST: Missing fields, invalid email, invalid phone, duplicate email
- PUT: 404, email in use, invalid phone
- DELETE: 404, has active orders

**Đặc điểm**:
- Email/phone validation với regex
- Customer.findOne mock với jest.fn() cho complex scenarios
- Active orders constraint check

---

### 4. orders.test.js
**Controller**: Orders CRUD (complex model)  
**Endpoints tested**:
- `GET /api/orders` - List orders
- `GET /api/orders/:id` - Get single order
- `POST /api/orders` - Create order
- `PUT /api/orders/:id` - Update order
- `DELETE /api/orders/:id` - Delete order

**Test cases** (13 tests):
- GET: Pagination, database errors
- GET/:id: Success, 404
- POST: Missing customer, missing items, empty items, invalid customer
- PUT: 404, paid order update, cancelled order update
- DELETE: 404, paid order deletion (hardDelete required)

**Đặc điểm**:
- Complex relationships: Customer, OrderDetail, Product, ProductBatch
- Mock CustomerDiscountSettings.getActiveDiscounts
- Business rules: Cannot update/delete paid orders
- Error code: MISSING_ORDER_ITEMS

---

### 5. employees.test.js
**Controller**: Employees CRUD (với UserAccount relationship)  
**Endpoints tested**:
- `GET /api/employees` - List employees
- `GET /api/employees/:id` - Get single employee
- `POST /api/employees` - Create employee with user account
- `PUT /api/employees/:id` - Update employee
- `DELETE /api/employees/:id` - Delete employee (cascade)

**Test cases** (13 tests):
- GET: Pagination, database errors
- GET/:id: Success, 404
- POST: Missing userData, missing employeeData, invalid email, validation error
- PUT: 404, email in use, validation error
- DELETE: 404, has active orders (constraint)

**Đặc điểm**:
- 1-to-1 relationship với UserAccount
- Mock mongoose.startSession() for transactions
- Cascade deletion với UserAccount và EmployeePOSAuth
- Separate validation cho userData vs employeeData

---

### 6. purchaseOrders.test.js
**Controller**: Purchase Orders CRUD  
**Endpoints tested**:
- `GET /api/purchase-orders` - List purchase orders
- `GET /api/purchase-orders/:id` - Get single purchase order
- `POST /api/purchase-orders` - Create purchase order
- `PUT /api/purchase-orders/:id` - Update purchase order
- `DELETE /api/purchase-orders/:id` - Delete purchase order

**Test cases** (13 tests):
- GET: Pagination, database errors
- GET/:id: Success, 404
- POST: Missing supplier, missing items, empty items, supplier not found
- PUT: 404, received PO update, cancelled PO update
- DELETE: 404, approved PO deletion

**Đặc điểm**:
- Similar to orders but với Supplier
- Status workflow: pending → approved → received
- Business rules: Cannot delete approved POs, cannot update received/cancelled POs
- Mock DetailPurchaseOrder, Supplier, Product

---

### 7. payments.test.js
**Controller**: Payments CRUD (polymorphic reference)  
**Endpoints tested**:
- `GET /api/payments` - List payments
- `GET /api/payments/:id` - Get single payment
- `POST /api/payments` - Create payment
- `PUT /api/payments/:id` - Update payment
- `DELETE /api/payments/:id` - Delete payment

**Test cases** (13 tests):
- GET: Pagination, database errors
- GET/:id: Success, 404
- POST: Missing fields, invalid referenceType, Order not found, PurchaseOrder not found
- PUT: 404, update success
- DELETE: 404, completed payment, cancelled payment

**Đặc điểm**:
- Polymorphic reference: Order OR PurchaseOrder
- referenceType validation: ['Order', 'PurchaseOrder']
- Payment status constraints: Only delete pending payments
- Payment status sync với Order/PurchaseOrder

---

### 8. inventoryMovementBatches.test.js
**Controller**: Inventory Movement Batches CRUD  
**Endpoints tested**:
- `GET /api/inventory-movement-batches` - List movements
- `GET /api/inventory-movement-batches/:id` - Get single movement
- `POST /api/inventory-movement-batches` - Create movement
- `PUT /api/inventory-movement-batches/:id` - Update movement

**Test cases** (11 tests):
- GET: Pagination, database errors
- GET/:id: Success, 404
- POST: Missing fields, zero quantity, batch not found, detail inventory not found, batch mismatch
- PUT: 404, update administrative fields

**Đặc điểm**:
- Complex populate chain `.populate().populate()`
- Movement types: in, out, adjustment, transfer, audit
- Quantity validation: cannot be zero
- Batch and DetailInventory validation
- DELETE tests skipped (requires integration tests)

---

## Cách chạy tests

### Chạy tất cả tests
```bash
npm test
```

### Chạy một file test cụ thể
```bash
npm test -- test/categories.test.js
npm test -- test/login.test.js
npm test -- test/customers.test.js
npm test -- test/orders.test.js
npm test -- test/employees.test.js
npm test -- test/purchaseOrders.test.js
npm test -- test/payments.test.js
npm test -- test/inventoryMovementBatches.test.js
```

### Chạy test với output chi tiết
```bash
npm test -- test/categories.test.js --verbose
```

### Chạy test trong silent mode (ít log hơn)
```bash
npm test -- test/categories.test.js --silent
```

### Chạy test với coverage
```bash
npm test -- --coverage
```

### Watch mode (tự động chạy lại khi file thay đổi)
```bash
npm test -- --watch
```

## Test Pattern Guidelines

Dựa theo `TEST_WRITING_GUIDE.md`, các test tuân theo:

1. **AAA Pattern**: Arrange → Act → Assert
2. **Test count**: 10-15 tests per controller
3. **Focus areas**:
   - Validation errors (400)
   - Business logic errors (400)
   - Not found errors (404)
   - Database errors (500)

4. **Skip scenarios**:
   - Success cases requiring real DB
   - Complex transaction success
   - Cascade operations success
   - Full populate chains

5. **Mocking strategy**:
   - Mockingoose for simple queries
   - jest.fn() for complex multi-return scenarios
   - Mock authentication middleware
   - Mock external services

## Test Statistics

| Test File | Tests Count | Status | Time |
|-----------|-------------|--------|------|
| categories.test.js | 13 | ✅ PASS | ~2.5s |
| login.test.js | 5 | ✅ PASS | ~1.8s |
| customers.test.js | 13 | ✅ PASS | ~2.4s |
| orders.test.js | 13 | ✅ PASS | ~2.5s |
| employees.test.js | 13 | ✅ PASS | ~3.9s |
| purchaseOrders.test.js | 13 | ✅ PASS | ~4.3s |
| payments.test.js | 13 | ✅ PASS | ~2.1s |
| inventoryMovementBatches.test.js | 11 | ✅ PASS | ~2.2s |
| **TOTAL** | **94** | **✅ ALL PASS** | **~21.7s** |

## Common Test Utilities

### Mock Authentication
```javascript
jest.mock('../utils/auth', () => ({
  userExtractor: (req, res, next) => {
    req.user = { id: 'mock-user-id', username: 'testuser' };
    next();
  }
}));
```

### AfterAll Hook
```javascript
afterAll(async () => {
  await mongoose.connection.close();
});
```

### BeforeEach Hook
```javascript
beforeEach(() => {
  mockingoose.resetAll();
  jest.clearAllMocks();
});
```

## Troubleshooting

### Tests không tự kết thúc
**Solution**: Thêm `afterAll` hook để close mongoose connection:
```javascript
afterAll(async () => {
  await mongoose.connection.close();
});
```

### Mockingoose caching issues
**Solution**: Sử dụng `jest.fn()` thay vì mockingoose cho scenarios phức tạp:
```javascript
Model.findOne = jest.fn().mockImplementationOnce(() => result1)
                        .mockImplementationOnce(() => result2);
```

### Populate chain không work
**Solution**: Mock với proper chaining:
```javascript
const mockQuery = {
  populate: jest.fn().mockReturnThis()
};
mockQuery.populate.mockResolvedValue(mockData);
Model.findById = jest.fn().mockReturnValue(mockQuery);
```

## Notes

- Tất cả tests sử dụng Node environment (không phải browser)
- Tests chạy với `--silent` flag để giảm console output
- Mongoose warnings về duplicate indexes là expected (non-critical)
- DELETE tests cho complex controllers có thể skip nếu require integration testing
- Focus vào validation và error cases, không cần test success scenarios với real DB

## Next Steps

Các controller chưa có tests (có thể thêm sau):
- categories.js ✅
- customers.js ✅
- employees.js ✅
- orders.js ✅
- purchaseOrders.js ✅
- payments.js ✅
- inventoryMovementBatches.js ✅
- detailInventories.js ⏳
- detailPurchaseOrders.js ⏳
- inventories.js ⏳
- orderDetails.js ⏳
- permissions.js ⏳
- productBatches.js ⏳
- products.js ⏳
- roles.js ⏳
- settings.js ⏳
- statistics.js ⏳
- suppliers.js ⏳
- userAccounts.js ⏳
