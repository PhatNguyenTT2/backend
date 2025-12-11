const mongoose = require('mongoose');
const supertest = require('supertest');
const app = require('../app');
const Product = require('../models/product');
const Category = require('../models/category');
const ProductBatch = require('../models/productBatch');
const Inventory = require('../models/inventory');
const mockingoose = require('mockingoose');

const api = supertest(app);

/**
 * Products Test Suite
 * 
 * Following TEST_WRITING_GUIDE.md principles:
 * - 2-3 tests per describe block
 * - 10-15 tests total for CRUD controller
 * - Focus on validation and critical errors
 * - Skip complex populate/FEFO scenarios
 * 
 * Test Structure:
 * - GET /api/products: 2 tests
 * - GET /api/products/:id: 2 tests
 * - POST /api/products: 4 tests
 * - PUT /api/products/:id: 3 tests
 * - DELETE /api/products/:id: 3 tests
 * Total: 14 tests
 */

// Mock user in request
jest.mock('../utils/auth', () => ({
  userExtractor: (req, res, next) => {
    req.user = { id: 'mock-user-id', username: 'testuser' };
    next();
  }
}));

// Close connections after all tests
afterAll(async () => {
  await mongoose.connection.close();
});

describe('GET /api/products', () => {
  beforeEach(() => {
    mockingoose.resetAll();
  });

  test('should return paginated products with filters', async () => {
    const mockProducts = [
      {
        _id: new mongoose.Types.ObjectId(),
        productCode: 'PROD2025000001',
        name: 'Test Product',
        category: new mongoose.Types.ObjectId(),
        unitPrice: 100000,
        isActive: true
      }
    ];

    mockingoose(Product).toReturn(mockProducts, 'find');
    mockingoose(Product).toReturn(1, 'countDocuments');

    const response = await api
      .get('/api/products')
      .query({ page: 1, limit: 20 })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.products).toBeDefined();
    expect(response.body.data.pagination).toBeDefined();
    expect(response.body.data.pagination.page).toBe(1);
  });

  test('should handle database errors gracefully', async () => {
    mockingoose(Product).toReturn(new Error('Database connection failed'), 'find');

    const response = await api
      .get('/api/products')
      .expect(500);

    expect(response.body.success).toBe(false);
    expect(response.body.error.message).toBe('Failed to get products');
  });
});

describe('GET /api/products/:id', () => {
  beforeEach(() => {
    mockingoose.resetAll();
  });

  test('should return product with populated category', async () => {
    const productId = new mongoose.Types.ObjectId();
    const mockProduct = {
      _id: productId,
      productCode: 'PROD2025000001',
      name: 'Test Product',
      category: new mongoose.Types.ObjectId(),
      unitPrice: 100000,
      isActive: true
    };

    mockingoose(Product).toReturn(mockProduct, 'findOne');

    const response = await api
      .get(`/api/products/${productId}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.product).toBeDefined();
  });

  test('should return 404 when product not found', async () => {
    const productId = new mongoose.Types.ObjectId();
    mockingoose(Product).toReturn(null, 'findOne');

    const response = await api
      .get(`/api/products/${productId}`)
      .expect(404);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('PRODUCT_NOT_FOUND');
  });
});

describe('POST /api/products', () => {
  beforeEach(() => {
    mockingoose.resetAll();
    jest.clearAllMocks();
  });

  test('should return 400 when required fields are missing', async () => {
    const response = await api
      .post('/api/products')
      .send({
        name: 'Test Product'
        // missing category and unitPrice
      })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('MISSING_REQUIRED_FIELDS');
  });

  test('should return 404 when category not found', async () => {
    const categoryId = new mongoose.Types.ObjectId();

    Category.findById = jest.fn().mockResolvedValue(null);

    const response = await api
      .post('/api/products')
      .send({
        name: 'Test Product',
        category: categoryId,
        unitPrice: 100000
      })
      .expect(404);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('CATEGORY_NOT_FOUND');
  });

  test('should return 409 when product name exists in category', async () => {
    const categoryId = new mongoose.Types.ObjectId();

    Category.findById = jest.fn().mockResolvedValue({
      _id: categoryId,
      name: 'Test Category'
    });

    Product.findOne = jest.fn().mockResolvedValue({
      _id: new mongoose.Types.ObjectId(),
      name: 'Existing Product',
      category: categoryId
    });

    const response = await api
      .post('/api/products')
      .send({
        name: 'Existing Product',
        category: categoryId,
        unitPrice: 100000
      })
      .expect(409);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('DUPLICATE_PRODUCT_NAME');
  });

  test('should handle validation errors', async () => {
    const categoryId = new mongoose.Types.ObjectId();

    Category.findById = jest.fn().mockResolvedValue({
      _id: categoryId,
      name: 'Test Category'
    });

    Product.findOne = jest.fn().mockResolvedValue(null);

    const mockProduct = {
      _id: new mongoose.Types.ObjectId(),
      save: jest.fn().mockRejectedValue({
        name: 'ValidationError',
        message: 'Unit price cannot be negative'
      })
    };

    Product.prototype.save = jest.fn().mockRejectedValue({
      name: 'ValidationError',
      message: 'Unit price cannot be negative'
    });

    const response = await api
      .post('/api/products')
      .send({
        name: 'Test Product',
        category: categoryId,
        unitPrice: -1000
      })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('PUT /api/products/:id', () => {
  beforeEach(() => {
    mockingoose.resetAll();
    jest.clearAllMocks();
  });

  test('should return 404 when product not found', async () => {
    const productId = new mongoose.Types.ObjectId();

    Product.findById = jest.fn().mockResolvedValue(null);

    const response = await api
      .put(`/api/products/${productId}`)
      .send({ name: 'Updated Name' })
      .expect(404);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('PRODUCT_NOT_FOUND');
  });

  test('should return 409 when new name exists in category', async () => {
    const productId = new mongoose.Types.ObjectId();
    const categoryId = new mongoose.Types.ObjectId();

    Product.findById = jest.fn().mockResolvedValue({
      _id: productId,
      name: 'Old Name',
      category: categoryId
    });

    Product.findOne = jest.fn().mockResolvedValue({
      _id: new mongoose.Types.ObjectId(),
      name: 'Existing Name',
      category: categoryId
    });

    const response = await api
      .put(`/api/products/${productId}`)
      .send({ name: 'Existing Name' })
      .expect(409);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('DUPLICATE_PRODUCT_NAME');
  });

  test('should handle product updates', async () => {
    const productId = new mongoose.Types.ObjectId();
    const categoryId = new mongoose.Types.ObjectId();

    const savedProduct = {
      _id: productId,
      name: 'New Name',
      category: categoryId,
      unitPrice: 120000,
      isActive: true,
      populate: jest.fn().mockResolvedValue({
        _id: productId,
        name: 'New Name',
        category: categoryId,
        unitPrice: 120000,
        isActive: true
      })
    };

    const mockProduct = {
      _id: productId,
      name: 'Old Name',
      category: categoryId,
      unitPrice: 100000,
      isActive: true,
      save: jest.fn().mockResolvedValue(savedProduct)
    };

    Product.findById = jest.fn().mockResolvedValue(mockProduct);
    Product.findOne = jest.fn().mockResolvedValue(null);

    const response = await api
      .put(`/api/products/${productId}`)
      .send({ name: 'New Name', unitPrice: 120000 })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe('Product updated successfully');
  });
});

describe('DELETE /api/products/:id', () => {
  beforeEach(() => {
    mockingoose.resetAll();
    jest.clearAllMocks();
  });

  test('should return 404 when product not found', async () => {
    const productId = new mongoose.Types.ObjectId();

    Product.findById = jest.fn().mockResolvedValue(null);

    const response = await api
      .delete(`/api/products/${productId}`)
      .expect(404);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('PRODUCT_NOT_FOUND');
  });

  test('should return 400 when product is active', async () => {
    const productId = new mongoose.Types.ObjectId();

    Product.findById = jest.fn().mockResolvedValue({
      _id: productId,
      name: 'Test Product',
      isActive: true
    });

    const response = await api
      .delete(`/api/products/${productId}`)
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('PRODUCT_IS_ACTIVE');
  });

  test('should return 400 when product has active batches', async () => {
    const productId = new mongoose.Types.ObjectId();

    Product.findById = jest.fn().mockResolvedValue({
      _id: productId,
      name: 'Test Product',
      isActive: false
    });

    ProductBatch.countDocuments = jest.fn().mockResolvedValue(5);

    const response = await api
      .delete(`/api/products/${productId}`)
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('PRODUCT_HAS_ACTIVE_BATCHES');
  });
});
