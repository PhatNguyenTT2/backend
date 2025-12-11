# Hướng Dẫn Viết Test Chuẩn Template

## Mục Lục
1. [Cấu Trúc File Test](#cấu-trúc-file-test)
2. [Import và Setup](#import-và-setup)
3. [Mock Authentication](#mock-authentication)
4. [Cấu Trúc Describe & BeforeEach](#cấu-trúc-describe--beforeeach)
5. [Viết Test Cases](#viết-test-cases)
6. [Naming Conventions](#naming-conventions)
7. [Best Practices](#best-practices)
8. [Template Mẫu](#template-mẫu)

---

## Cấu Trúc File Test

### 1. Header Documentation
```javascript
/**
 * @file <tên-file>.test.js
 * @description Unit tests for <mô tả ngắn gọn>
 */
```

### 2. Imports Chuẩn
```javascript
// Testing Libraries
const mockingoose = require('mockingoose');
const mongoose = require('mongoose');
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken'); // nếu cần test JWT

// Models
const Model = require('../models/model');
const RelatedModel = require('../models/relatedModel');

// Controllers/Routers
const router = require('../controllers/controller');

// Utils & Middleware
const { userExtractor, isAdmin } = require('../utils/auth');
const { helperFunction } = require('../utils/helper');
```

---

## Import và Setup

### Test Controller/API (với Express)
```javascript
// Mock auth middleware
jest.mock('../utils/auth', () => {
  const mongoose = require('mongoose');
  return {
    userExtractor: (req, res, next) => {
      req.user = { 
        _id: new mongoose.Types.ObjectId(), 
        role: { roleId: 'ADMIN' } 
      };
      next();
    },
    isAdmin: (req, res, next) => {
      if (req.user && req.user.role && req.user.role.roleId === 'ADMIN') {
        next();
      } else {
        res.status(403).json({ error: 'Admin access required' });
      }
    }
  };
});

// Setup Express app
const app = express();
app.use(express.json());
app.use('/api/resource', router);
```

### Test Model (không cần Express)
```javascript
describe('Model Name Unit Tests', () => {
  beforeEach(() => {
    mockingoose.resetAll();
    jest.clearAllMocks();
  });
  
  // Test cases...
});
```

### Test Helper Functions
```javascript
describe('helperFunctionName', () => {
  // Nếu cần mock environment variables
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV, JWT_SECRET: 'testsecret' };
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });
  
  // Test cases...
});
```

---

## Mock Authentication

### Chuẩn Mock Auth Middleware
```javascript
jest.mock('../utils/auth', () => {
  const mongoose = require('mongoose');
  return {
    userExtractor: (req, res, next) => {
      req.user = { 
        _id: new mongoose.Types.ObjectId(), 
        role: { roleId: 'ADMIN' },
        email: 'test@example.com' // thêm các field cần thiết
      };
      next();
    },
    isAdmin: (req, res, next) => {
      if (req.user && req.user.role && req.user.role.roleId === 'ADMIN') {
        next();
      } else {
        res.status(403).json({ error: 'Admin access required' });
      }
    },
    // Thêm các middleware khác nếu cần
    isManager: (req, res, next) => {
      if (req.user && req.user.role && 
          ['ADMIN', 'MANAGER'].includes(req.user.role.roleId)) {
        next();
      } else {
        res.status(403).json({ error: 'Manager access required' });
      }
    }
  };
});
```

---

## Cấu Trúc Describe & BeforeEach

### Nested Describe Pattern

**NGUYÊN TẮC QUAN TRỌNG**: Mỗi describe block chỉ nên có **2-3 test cases đại diện** cho các scenario quan trọng nhất. Không cần test tất cả các trường hợp.

```javascript
describe('Resource Name Controller Unit Tests', () => {
  beforeEach(() => {
    mockingoose.resetAll();
    jest.clearAllMocks();
  });

  describe('GET /api/resource', () => {
    it('should return paginated resources successfully', async () => {
      // Test happy path với pagination
    });

    it('should filter by query parameters', async () => {
      // Test filtering
    });

    it('should handle database errors', async () => {
      // Test error case
    });
  });

  describe('GET /api/resource/:id', () => {
    it('should return a single resource by ID', async () => {
      // Test happy path
    });

    it('should return 404 when resource not found', async () => {
      // Test not found case
    });
  });

  describe('POST /api/resource', () => {
    it('should create a new resource successfully', async () => {
      // Test happy path
    });

    it('should return 400 when required fields are missing', async () => {
      // Test validation error
    });

    it('should return 409 when resource already exists', async () => {
      // Test duplicate case
    });
  });

  describe('PUT /api/resource/:id', () => {
    it('should update a resource successfully', async () => {
      // Test happy path
    });

    it('should return 404 when resource not found', async () => {
      // Test not found case
    });
  });

  describe('DELETE /api/resource/:id', () => {
    it('should delete a resource successfully', async () => {
      // Test happy path
    });

    it('should prevent deletion if resource has dependencies', async () => {
      // Test business rule
    });
  });
});
```

---

## Viết Test Cases

### 1. Test GET Request
```javascript
it('should return paginated resources', async () => {
  // Arrange: Tạo mock data
  const mockResources = [
    { 
      _id: new mongoose.Types.ObjectId(), 
      name: 'Resource 1', 
      isActive: true 
    },
    { 
      _id: new mongoose.Types.ObjectId(), 
      name: 'Resource 2', 
      isActive: true 
    }
  ];

  // Mock database response
  mockingoose(Model).toReturn(mockResources, 'find');
  mockingoose(Model).toReturn(2, 'countDocuments');

  // Act: Gọi API
  const response = await request(app)
    .get('/api/resources?page=1&limit=10')
    .expect(200);

  // Assert: Kiểm tra kết quả
  expect(response.body.success).toBe(true);
  expect(response.body.data.resources).toBeDefined();
  expect(response.body.data.pagination).toBeDefined();
  expect(Array.isArray(response.body.data.resources)).toBe(true);
});
```

### 2. Test POST Request
```javascript
it('should create a new resource', async () => {
  // Arrange
  const newResource = {
    name: 'New Resource',
    description: 'Test description',
    price: 100
  };

  const savedResource = {
    _id: new mongoose.Types.ObjectId(),
    ...newResource,
    createdAt: new Date(),
    isActive: true
  };

  mockingoose(Model).toReturn(savedResource, 'save');

  // Act
  const response = await request(app)
    .post('/api/resources')
    .send(newResource)
    .expect(201);

  // Assert
  expect(response.body.success).toBe(true);
  expect(response.body.message).toBe('Resource created successfully');
  expect(response.body.data.resource).toBeDefined();
  expect(response.body.data.resource.name).toBe(newResource.name);
});
```

### 3. Test PUT Request
```javascript
it('should update a resource', async () => {
  // Arrange
  const resourceId = new mongoose.Types.ObjectId();
  const updateData = { name: 'Updated Name' };
  
  const existingResource = {
    _id: resourceId,
    name: 'Old Name',
    isActive: true
  };

  const updatedResource = {
    ...existingResource,
    ...updateData
  };

  mockingoose(Model).toReturn(existingResource, 'findOne');
  mockingoose(Model).toReturn(updatedResource, 'findOneAndUpdate');

  // Act
  const response = await request(app)
    .put(`/api/resources/${resourceId}`)
    .send(updateData)
    .expect(200);

  // Assert
  expect(response.body.success).toBe(true);
  expect(response.body.message).toBe('Resource updated successfully');
  expect(response.body.data.resource.name).toBe(updateData.name);
});
```

### 4. Test DELETE Request
```javascript
it('should delete a resource', async () => {
  // Arrange
  const resourceId = new mongoose.Types.ObjectId();
  const resource = {
    _id: resourceId,
    name: 'Test Resource',
    isActive: false // Thường cần inactive trước khi xóa
  };

  mockingoose(Model).toReturn(resource, 'findOne');
  mockingoose(RelatedModel).toReturn(0, 'countDocuments'); // Không có dependencies
  mockingoose(Model).toReturn(resource, 'findByIdAndDelete');

  // Act
  const response = await request(app)
    .delete(`/api/resources/${resourceId}`)
    .expect(200);

  // Assert
  expect(response.body.success).toBe(true);
  expect(response.body.message).toBe('Resource deleted successfully');
});
```

### 5. Test Error Handling
```javascript
// Database Error
it('should handle database errors', async () => {
  mockingoose(Model).toReturn(new Error('DB Error'), 'find');

  const response = await request(app)
    .get('/api/resources')
    .expect(500);

  expect(response.body.error).toBeDefined();
});

// Validation Error
it('should return 400 for validation errors', async () => {
  const error = new Error('Validation failed');
  error.name = 'ValidationError';
  mockingoose(Model).toReturn(error, 'save');

  const response = await request(app)
    .post('/api/resources')
    .send({ name: 'Test' })
    .expect(400);

  expect(response.body.error).toBeDefined();
});

// Duplicate Key Error
it('should return 400 when resource already exists', async () => {
  const error = new Error('Duplicate key');
  error.code = 11000;
  mockingoose(Model).toReturn(error, 'save');

  const response = await request(app)
    .post('/api/resources')
    .send({ name: 'Existing Resource' })
    .expect(400);

  expect(response.body.error).toBe('Resource name already exists');
});

// Not Found Error
it('should return 404 when resource not found', async () => {
  mockingoose(Model).toReturn(null, 'findOne');

  const response = await request(app)
    .get(`/api/resources/${new mongoose.Types.ObjectId()}`)
    .expect(404);

  expect(response.body.error).toBe('Resource not found');
});

// Invalid ID Error
it('should return 400 for invalid resource ID', async () => {
  const response = await request(app)
    .get('/api/resources/invalid-id')
    .expect(400);

  expect(response.body.error).toBe('Invalid resource ID');
});
```

### 6. Test Model Methods
```javascript
describe('Model Method: addStock()', () => {
  it('should add stock and log movement', async () => {
    const model = new Model({
      product: new mongoose.Types.ObjectId(),
      quantityOnHand: 10
    });

    mockingoose(Model).toReturn(model, 'save');

    const result = await model.addStock(20, 'Restocked', 'REF001', userId);
    
    expect(result.quantityOnHand).toBe(30);
    expect(result.movements[0].type).toBe('in');
    expect(result.movements[0].quantity).toBe(20);
  });

  it('should throw error for invalid quantity', async () => {
    const model = new Model({ product: new mongoose.Types.ObjectId() });
    
    expect(() => model.addStock(0, 'Invalid', 'REF001', userId))
      .toThrow('Quantity must be positive');
  });
});
```

### 7. Test Helper Functions
```javascript
describe('generateToken', () => {
  it('should create a valid JWT with correct payload', () => {
    const token = generateToken('user123');
    expect(typeof token).toBe('string');

    const decoded = jwt.verify(token, 'testsecret');
    expect(decoded.id).toBe('user123');
  });

  it('should throw error if JWT_SECRET is missing', () => {
    delete process.env.JWT_SECRET;
    expect(() => generateToken('abc')).toThrow();
  });

  it('should generate unique tokens for different users', () => {
    const tokenA = generateToken('userA');
    const tokenB = generateToken('userB');
    expect(tokenA).not.toBe(tokenB);
  });
});
```

---

## Naming Conventions

### Test Suite Names (describe)
- **Controller Tests**: `'Resource Name Controller Unit Tests'`
- **Model Tests**: `'Model Name Unit Tests'`
- **Helper Tests**: `'helperFunctionName'`

### HTTP Method Groups (nested describe)
```javascript
describe('GET /api/resource')
describe('GET /api/resource/:id')
describe('POST /api/resource')
describe('PUT /api/resource/:id')
describe('DELETE /api/resource/:id')
```

### Test Case Names (it)
Format: `should + [action] + [when/if condition]`

#### Positive Cases:
- `'should return all resources'`
- `'should create a new resource'`
- `'should update a resource'`
- `'should delete a resource'`
- `'should filter by query parameters'`
- `'should return paginated results'`

#### Negative Cases:
- `'should return 404 when resource not found'`
- `'should return 400 for invalid ID'`
- `'should return 400 when required fields are missing'`
- `'should prevent deletion if resource has dependencies'`
- `'should handle database errors'`
- `'should throw error for invalid input'`

#### Edge Cases:
- `'should handle empty result set'`
- `'should handle null or undefined values'`
- `'should handle malformed data gracefully'`
- `'should handle extra-long input correctly'`
- `'should handle concurrent operations'`

---

## Best Practices

### 1. Test Structure (AAA Pattern)
```javascript
it('should do something', async () => {
  // Arrange - Chuẩn bị data và mock
  const mockData = { /* ... */ };
  mockingoose(Model).toReturn(mockData, 'find');
  
  // Act - Thực hiện action
  const response = await request(app).get('/api/resource');
  
  // Assert - Kiểm tra kết quả
  expect(response.body.success).toBe(true);
});
```

### 2. Mock Data Best Practices
```javascript
// ✅ GOOD: Sử dụng ObjectId thật
const id = new mongoose.Types.ObjectId();

// ❌ BAD: Hardcode string
const id = '507f1f77bcf86cd799439011';

// ✅ GOOD: Mock data đầy đủ
const mockResource = {
  _id: new mongoose.Types.ObjectId(),
  name: 'Test Resource',
  description: 'Test description',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date()
};

// ❌ BAD: Mock data thiếu fields
const mockResource = { name: 'Test' };
```

### 3. Reset và Clean Up
```javascript
beforeEach(() => {
  mockingoose.resetAll();  // Reset tất cả mocks
  jest.clearAllMocks();     // Clear mock calls
});

// Nếu test environment variables
afterEach(() => {
  process.env = OLD_ENV;
});
```

### 4. Test Coverage Priorities

**⚠️ QUAN TRỌNG: Giữ số lượng test case ở mức tối thiểu (2-3 tests mỗi describe block)**

**Priority 1 - Must Have (2-3 tests/endpoint):**
- ✅ Happy path (success case) - BẮT BUỘC
- ✅ Error case quan trọng nhất (404, 400, hoặc validation)
- ✅ Business rule đặc biệt (nếu có)

**Priority 2 - Should Have (chỉ khi cần thiết):**
- Database errors (500)
- Duplicate key errors (409/11000)
- Authorization errors (403)

**Priority 3 - KHÔNG NÊN test (tránh over-testing):**
- ❌ Nhiều variation của cùng 1 scenario
- ❌ Edge cases không quan trọng (null, undefined, empty)
- ❌ Malformed data (trừ khi critical)
- ❌ Concurrent operations
- ❌ Performance scenarios
- ❌ Test từng field riêng lẻ khi update

**Nguyên tắc vàng**: Mỗi endpoint nên có **2-3 tests**, tổng cộng khoảng **10-15 tests** cho toàn bộ CRUD controller.

### 5. Assertion Best Practices
```javascript
// ✅ GOOD: Multiple specific assertions
expect(response.body.success).toBe(true);
expect(response.body.data.resource).toBeDefined();
expect(response.body.data.resource.name).toBe('Test');

// ❌ BAD: Single generic assertion
expect(response.body).toBeTruthy();

// ✅ GOOD: Check array contents
expect(Array.isArray(response.body.data.resources)).toBe(true);
expect(response.body.data.resources.length).toBeGreaterThan(0);

// ❌ BAD: Only check if array exists
expect(response.body.data.resources).toBeDefined();
```

### 6. Error Testing Patterns
```javascript
// Test throwing errors
it('should throw error for invalid input', () => {
  expect(() => functionCall()).toThrow('Error message');
  expect(() => functionCall()).toThrow(ErrorClass);
});

// Test async errors
it('should handle async errors', async () => {
  await expect(asyncFunction()).rejects.toThrow('Error message');
});

// Test error responses
it('should return error response', async () => {
  const response = await request(app)
    .post('/api/resource')
    .send({ invalid: 'data' })
    .expect(400);
  
  expect(response.body.error).toBeDefined();
  expect(response.body.error).toContain('validation');
});
```

### 7. Test Query Parameters
```javascript
it('should filter by multiple parameters', async () => {
  mockingoose(Model).toReturn([], 'find');
  mockingoose(Model).toReturn(0, 'countDocuments');

  const response = await request(app)
    .get('/api/resources?isActive=true&type=premium&page=1&limit=20')
    .expect(200);

  expect(response.body.success).toBe(true);
});
```

### 8. Test với Related Models
```javascript
it('should prevent deletion if resource has dependencies', async () => {
  const resourceId = new mongoose.Types.ObjectId();
  const resource = {
    _id: resourceId,
    name: 'Test Resource',
    isActive: false
  };

  mockingoose(Model).toReturn(resource, 'findOne');
  mockingoose(RelatedModel).toReturn(5, 'countDocuments'); // Có dependencies

  const response = await request(app)
    .delete(`/api/resources/${resourceId}`)
    .expect(400);

  expect(response.body.error).toContain('Cannot delete resource');
  expect(response.body.error).toContain('dependencies');
});
```

---

## Template Mẫu

### Template 1: Controller Test (Full CRUD)
```javascript
/**
 * @file resources.test.js
 * @description Unit tests for resources controller
 */

const mockingoose = require('mockingoose');
const mongoose = require('mongoose');
const Resource = require('../models/resource');
const RelatedModel = require('../models/relatedModel');
const request = require('supertest');
const express = require('express');
const resourcesRouter = require('../controllers/resources');
const { userExtractor, isAdmin } = require('../utils/auth');

// Mock authentication middleware
jest.mock('../utils/auth', () => {
  const mongoose = require('mongoose');
  return {
    userExtractor: (req, res, next) => {
      req.user = { 
        _id: new mongoose.Types.ObjectId(), 
        role: { roleId: 'ADMIN' } 
      };
      next();
    },
    isAdmin: (req, res, next) => {
      if (req.user && req.user.role && req.user.role.roleId === 'ADMIN') {
        next();
      } else {
        res.status(403).json({ error: 'Admin access required' });
      }
    }
  };
});

// Setup Express app
const app = express();
app.use(express.json());
app.use('/api/resources', resourcesRouter);

describe('Resources Controller Unit Tests', () => {
  beforeEach(() => {
    mockingoose.resetAll();
    jest.clearAllMocks();
  });

  describe('GET /api/resources', () => {
    it('should return paginated resources successfully', async () => {
      // Arrange: Mock data với pagination
      const mockResources = [
        { _id: new mongoose.Types.ObjectId(), name: 'Resource 1', isActive: true },
        { _id: new mongoose.Types.ObjectId(), name: 'Resource 2', isActive: true }
      ];

      mockingoose(Resource).toReturn(mockResources, 'find');
      mockingoose(Resource).toReturn(2, 'countDocuments');

      // Act: Gọi API với query params
      const response = await request(app)
        .get('/api/resources?page=1&limit=10&isActive=true')
        .expect(200);

      // Assert: Kiểm tra structure và data
      expect(response.body.success).toBe(true);
      expect(response.body.data.resources).toBeDefined();
      expect(response.body.data.pagination).toBeDefined();
      expect(response.body.data.pagination.total).toBe(2);
    });

    it('should handle database errors', async () => {
      // Arrange: Mock database error
      mockingoose(Resource).toReturn(new Error('DB Connection Failed'), 'find');

      // Act & Assert
      const response = await request(app)
        .get('/api/resources')
        .expect(500);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('GET /api/resources/:id', () => {
    it('should return a single resource by ID', async () => {
      // Arrange
      const resourceId = new mongoose.Types.ObjectId();
      const mockResource = {
        _id: resourceId,
        name: 'Test Resource',
        description: 'Test description',
        isActive: true
      };

      mockingoose(Resource).toReturn(mockResource, 'findOne');

      // Act
      const response = await request(app)
        .get(`/api/resources/${resourceId}`)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.resource.name).toBe('Test Resource');
    });

    it('should return 404 when resource not found', async () => {
      mockingoose(Resource).toReturn(null, 'findOne');

      const response = await request(app)
        .get(`/api/resources/${new mongoose.Types.ObjectId()}`)
        .expect(404);

      expect(response.body.error).toBe('Resource not found');
    });
  });

  describe('POST /api/resources', () => {
    it('should create a new resource successfully', async () => {
      // Arrange
      const newResource = {
        name: 'New Resource',
        description: 'Test description'
      };

      const savedResource = {
        _id: new mongoose.Types.ObjectId(),
        ...newResource,
        isActive: true,
        createdAt: new Date()
      };

      mockingoose(Resource).toReturn(savedResource, 'save');

      // Act
      const response = await request(app)
        .post('/api/resources')
        .send(newResource)
        .expect(201);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Resource created successfully');
      expect(response.body.data.name).toBe(newResource.name);
    });

    it('should return 400 when required fields are missing', async () => {
      const response = await request(app)
        .post('/api/resources')
        .send({ description: 'No name' })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should return 409 when resource already exists', async () => {
      const error = new Error('Duplicate key');
      error.code = 11000;
      mockingoose(Resource).toReturn(error, 'save');

      const response = await request(app)
        .post('/api/resources')
        .send({ name: 'Existing Resource' })
        .expect(409);

      expect(response.body.error).toContain('already exists');
    });
  });

  describe('PUT /api/resources/:id', () => {
    it('should update a resource successfully', async () => {
      // Arrange
      const resourceId = new mongoose.Types.ObjectId();
      const existingResource = {
        _id: resourceId,
        name: 'Old Name',
        isActive: true
      };

      const updateData = { name: 'Updated Name' };

      const updatedResource = {
        ...existingResource,
        ...updateData
      };

      mockingoose(Resource).toReturn(existingResource, 'findOne');
      mockingoose(Resource).toReturn(updatedResource, 'save');

      // Act
      const response = await request(app)
        .put(`/api/resources/${resourceId}`)
        .send(updateData)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(updateData.name);
    });

    it('should return 404 when resource not found', async () => {
      mockingoose(Resource).toReturn(null, 'findOne');

      const response = await request(app)
        .put(`/api/resources/${new mongoose.Types.ObjectId()}`)
        .send({ name: 'Updated' })
        .expect(404);

      expect(response.body.error).toBe('Resource not found');
    });
  });

  describe('DELETE /api/resources/:id', () => {
    it('should delete a resource successfully', async () => {
      // Arrange
      const resourceId = new mongoose.Types.ObjectId();
      const resource = {
        _id: resourceId,
        name: 'Test Resource',
        isActive: false // Đã inactive
      };

      mockingoose(Resource).toReturn(resource, 'findOne');
      mockingoose(RelatedModel).toReturn(0, 'countDocuments'); // Không có dependencies
      mockingoose(Resource).toReturn(resource, 'findByIdAndDelete');

      // Act
      const response = await request(app)
        .delete(`/api/resources/${resourceId}`)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Resource deleted successfully');
    });

    it('should prevent deletion if resource has dependencies', async () => {
      // Arrange: Resource có products đang sử dụng
      const resourceId = new mongoose.Types.ObjectId();
      const resource = {
        _id: resourceId,
        name: 'Test Resource',
        isActive: false
      };

      mockingoose(Resource).toReturn(resource, 'findOne');
      mockingoose(RelatedModel).toReturn(5, 'countDocuments'); // Có 5 dependencies

      // Act
      const response = await request(app)
        .delete(`/api/resources/${resourceId}`)
        .expect(400);

      // Assert
      expect(response.body.error).toContain('Cannot delete');
      expect(response.body.error).toContain('dependencies');
    });
  });
});
```

### Template 2: Model Method Test
```javascript
/**
 * @file model.test.js
 * @description Unit tests for Model methods
 */

const mockingoose = require('mockingoose');
const mongoose = require('mongoose');
const Model = require('../models/model');

describe('Model Name Unit Tests', () => {
  let userId;
  let referenceId;

  beforeEach(() => {
    mockingoose.resetAll();
    userId = new mongoose.Types.ObjectId();
    referenceId = 'REF001';
  });

  describe('methodName()', () => {
    it('should perform action successfully', async () => {
      const model = new Model({
        field1: 'value1',
        field2: 100
      });

      mockingoose(Model).toReturn(model, 'save');

      const result = await model.methodName(param1, param2);
      
      expect(result.field1).toBe('expected value');
      expect(result.field2).toBe(150);
    });

    it('should throw error for invalid input', async () => {
      const model = new Model({ field1: 'value' });
      
      expect(() => model.methodName(null))
        .toThrow('Input must be valid');
    });

    it('should handle edge case gracefully', async () => {
      const model = new Model({
        field1: 'value',
        field2: 0
      });

      mockingoose(Model).toReturn(model, 'save');

      const result = await model.methodName(0);
      expect(result).toBeDefined();
    });
  });
});
```

### Template 3: Helper Function Test
```javascript
/**
 * @file helpers.test.js
 * @description Unit tests for helper functions
 */

const { helperFunction, anotherHelper } = require('../utils/helpers');
const jwt = require('jsonwebtoken');

describe('Helper Functions', () => {
  describe('helperFunction', () => {
    const OLD_ENV = process.env;

    beforeEach(() => {
      jest.resetModules();
      process.env = { ...OLD_ENV, SECRET_KEY: 'test-secret' };
    });

    afterEach(() => {
      process.env = OLD_ENV;
    });

    it('should process input correctly', () => {
      const result = helperFunction('input');
      expect(result).toBe('expected output');
    });

    it('should throw error for invalid input', () => {
      expect(() => helperFunction(null)).toThrow('Input is required');
    });

    it('should handle edge cases', () => {
      const result = helperFunction('');
      expect(result).toBe('default value');
    });

    it('should use environment variable correctly', () => {
      const result = helperFunction('test');
      expect(result).toContain(process.env.SECRET_KEY);
    });
  });

  describe('anotherHelper', () => {
    it('should return expected result', () => {
      const result = anotherHelper(1, 2);
      expect(result).toBe(3);
    });
  });
});
```

---

## Checklist Trước Khi Submit Test

### ✅ Code Quality
- [ ] Tất cả tests đều pass
- [ ] Không có console.log/console.error
- [ ] Code được format đúng chuẩn
- [ ] Không có code bị comment không cần thiết

### ✅ Coverage (Tối Thiểu - Không Over-Test)
- [ ] Test happy path cho mỗi endpoint (BẮT BUỘC)
- [ ] Test 1-2 error cases quan trọng nhất mỗi endpoint
- [ ] **TỔNG SỐ TESTS: 10-15 tests cho toàn bộ CRUD controller**
- [ ] ❌ KHÔNG test quá nhiều variations
- [ ] ❌ KHÔNG test từng field update riêng lẻ
- [ ] ❌ KHÔNG test edge cases không quan trọng

### ✅ Test Structure
- [ ] Mỗi describe block có **TỐI ĐA 2-3 test cases**
- [ ] Sử dụng AAA pattern (Arrange-Act-Assert)
- [ ] Mock data đầy đủ và realistic
- [ ] Naming conventions đúng chuẩn
- [ ] Reset mocks trong beforeEach
- [ ] Assertions cụ thể và đầy đủ

### ✅ Documentation
- [ ] File header có @file và @description
- [ ] Test names mô tả rõ ràng
- [ ] Comments giải thích logic phức tạp (nếu có)

---

## Tài Liệu Tham Khảo

### Testing Libraries
- [Jest Documentation](https://jestjs.io/)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [Mockingoose Documentation](https://github.com/alonronin/mockingoose)

### Patterns & Best Practices
- AAA Pattern (Arrange-Act-Assert)
- Given-When-Then Pattern
- Test Isolation Principles

### Status Codes
- `200` - OK (GET, PUT success)
- `201` - Created (POST success)
- `400` - Bad Request (validation errors)
- `403` - Forbidden (authorization errors)
- `404` - Not Found
- `500` - Internal Server Error

---

## Tóm Tắt Nguyên Tắc Quan Trọng

### 🎯 Quy Tắc Vàng
1. **Mỗi describe block: TỐI ĐA 2-3 test cases**
2. **Tổng số tests cho CRUD controller: 10-15 tests**
3. **Ưu tiên: 1 happy path + 1-2 error cases quan trọng nhất**
4. **KHÔNG over-test**: Tránh test quá nhiều variations của cùng 1 scenario

### ❌ Những Gì KHÔNG NÊN Làm
- Test từng field riêng lẻ khi update
- Test multiple pagination scenarios
- Test edge cases không quan trọng (null, empty, undefined)
- Test concurrent operations
- Test performance
- Tạo quá nhiều test cases tương tự nhau

### ✅ Những Gì NÊN Làm
- Focus vào business logic quan trọng
- Test happy path đầy đủ
- Test error cases critical (404, 400, 409)
- Test business rules đặc biệt (dependencies, active/inactive status)
- Giữ code test ngắn gọn, dễ maintain

---

**Version**: 2.0  
**Last Updated**: December 2025  
**Author**: Backend Team  
**Major Changes**: Giảm số lượng test cases từ 44 xuống 10-15 tests/controller
