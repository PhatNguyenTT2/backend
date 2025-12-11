const mongoose = require('mongoose');
const supertest = require('supertest');
const app = require('../app');
const ProductBatch = require('../models/productBatch');
const Product = require('../models/product');
const DetailInventory = require('../models/detailInventory');
const mockingoose = require('mockingoose');

const api = supertest(app);

/**
 * ProductBatches Test Suite
 * 
 * Following TEST_WRITING_GUIDE.md principles:
 * - 2-3 tests per describe block
 * - 10-15 tests total for CRUD controller
 * - Focus on validation and critical errors
 * - Skip complex inventory scenarios
 * 
 * Test Structure:
 * - GET /api/product-batches: 2 tests
 * - GET /api/product-batches/:id: 2 tests
 * - POST /api/product-batches: 5 tests
 * - PUT /api/product-batches/:id: 3 tests
 * - DELETE /api/product-batches/:id: 3 tests
 * Total: 15 tests
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

describe('GET /api/product-batches', () => {
  beforeEach(() => {
    mockingoose.resetAll();
  });

  test('should return paginated batches with filters', async () => {
    const mockBatches = [
      {
        _id: new mongoose.Types.ObjectId(),
        batchCode: 'BATCH2025000001',
        product: new mongoose.Types.ObjectId(),
        costPrice: 80000,
        unitPrice: 100000,
        quantity: 50,
        status: 'active'
      }
    ];

    mockingoose(ProductBatch).toReturn(mockBatches, 'find');
    mockingoose(ProductBatch).toReturn(1, 'countDocuments');

    const response = await api
      .get('/api/product-batches')
      .query({ page: 1, limit: 20 })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.batches).toBeDefined();
    expect(response.body.data.pagination).toBeDefined();
    expect(response.body.data.pagination.page).toBe(1);
  });

  test('should handle database errors gracefully', async () => {
    mockingoose(ProductBatch).toReturn(new Error('Database connection failed'), 'find');

    const response = await api
      .get('/api/product-batches')
      .expect(500);

    expect(response.body.success).toBe(false);
    expect(response.body.error.message).toBe('Failed to get product batches');
  });
});

describe('GET /api/product-batches/:id', () => {
  beforeEach(() => {
    mockingoose.resetAll();
  });

  test('should return batch with populated product', async () => {
    const batchId = new mongoose.Types.ObjectId();
    const mockBatch = {
      _id: batchId,
      batchCode: 'BATCH2025000001',
      product: new mongoose.Types.ObjectId(),
      costPrice: 80000,
      unitPrice: 100000,
      quantity: 50,
      status: 'active'
    };

    mockingoose(ProductBatch).toReturn(mockBatch, 'findOne');
    mockingoose(DetailInventory).toReturn(null, 'findOne');

    const response = await api
      .get(`/api/product-batches/${batchId}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.batch).toBeDefined();
  });

  test('should return 404 when batch not found', async () => {
    const batchId = new mongoose.Types.ObjectId();
    mockingoose(ProductBatch).toReturn(null, 'findOne');

    const response = await api
      .get(`/api/product-batches/${batchId}`)
      .expect(404);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('BATCH_NOT_FOUND');
  });
});

describe('POST /api/product-batches', () => {
  beforeEach(() => {
    mockingoose.resetAll();
    jest.clearAllMocks();
  });

  test('should return 400 when required fields are missing', async () => {
    const response = await api
      .post('/api/product-batches')
      .send({
        product: new mongoose.Types.ObjectId()
        // missing costPrice, unitPrice, quantity
      })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('MISSING_REQUIRED_FIELDS');
  });

  test('should return 404 when product not found', async () => {
    const productId = new mongoose.Types.ObjectId();

    Product.findById = jest.fn().mockResolvedValue(null);

    const response = await api
      .post('/api/product-batches')
      .send({
        product: productId,
        costPrice: 80000,
        unitPrice: 100000,
        quantity: 50
      })
      .expect(404);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('PRODUCT_NOT_FOUND');
  });

  test('should return 400 when mfgDate is after expiryDate', async () => {
    const productId = new mongoose.Types.ObjectId();

    Product.findById = jest.fn().mockResolvedValue({
      _id: productId,
      name: 'Test Product'
    });

    const response = await api
      .post('/api/product-batches')
      .send({
        product: productId,
        costPrice: 80000,
        unitPrice: 100000,
        quantity: 50,
        mfgDate: '2025-12-31',
        expiryDate: '2025-01-01'
      })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('INVALID_DATES');
  });

  test('should return 400 when discount promotion without percentage', async () => {
    const productId = new mongoose.Types.ObjectId();

    Product.findById = jest.fn().mockResolvedValue({
      _id: productId,
      name: 'Test Product'
    });

    const response = await api
      .post('/api/product-batches')
      .send({
        product: productId,
        costPrice: 80000,
        unitPrice: 100000,
        quantity: 50,
        promotionApplied: 'discount',
        discountPercentage: 0
      })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('MISSING_DISCOUNT');
  });

  test('should handle validation errors', async () => {
    const productId = new mongoose.Types.ObjectId();

    Product.findById = jest.fn().mockResolvedValue({
      _id: productId,
      name: 'Test Product'
    });

    ProductBatch.prototype.save = jest.fn().mockRejectedValue({
      name: 'ValidationError',
      message: 'Cost price cannot be negative'
    });

    const response = await api
      .post('/api/product-batches')
      .send({
        product: productId,
        costPrice: -1000,
        unitPrice: 100000,
        quantity: 50
      })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('PUT /api/product-batches/:id', () => {
  beforeEach(() => {
    mockingoose.resetAll();
    jest.clearAllMocks();
  });

  test('should return 404 when batch not found', async () => {
    const batchId = new mongoose.Types.ObjectId();

    ProductBatch.findById = jest.fn().mockResolvedValue(null);

    const response = await api
      .put(`/api/product-batches/${batchId}`)
      .send({ unitPrice: 120000 })
      .expect(404);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('BATCH_NOT_FOUND');
  });

  test('should return 400 when discount promotion has invalid percentage', async () => {
    const batchId = new mongoose.Types.ObjectId();

    ProductBatch.findById = jest.fn().mockResolvedValue({
      _id: batchId,
      batchCode: 'BATCH2025000001',
      product: new mongoose.Types.ObjectId(),
      costPrice: 80000,
      unitPrice: 100000,
      quantity: 50,
      promotionApplied: 'none',
      discountPercentage: 0
    });

    const response = await api
      .put(`/api/product-batches/${batchId}`)
      .send({
        promotionApplied: 'discount',
        discountPercentage: 0
      })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('INVALID_DISCOUNT');
  });

  test('should handle batch updates', async () => {
    const batchId = new mongoose.Types.ObjectId();
    const productId = new mongoose.Types.ObjectId();

    const savedBatch = {
      _id: batchId,
      batchCode: 'BATCH2025000001',
      product: productId,
      costPrice: 80000,
      unitPrice: 120000,
      quantity: 50,
      promotionApplied: 'none',
      populate: jest.fn().mockResolvedValue({
        _id: batchId,
        batchCode: 'BATCH2025000001',
        product: productId,
        unitPrice: 120000
      })
    };

    const mockBatch = {
      _id: batchId,
      batchCode: 'BATCH2025000001',
      product: productId,
      costPrice: 80000,
      unitPrice: 100000,
      quantity: 50,
      promotionApplied: 'none',
      discountPercentage: 0,
      save: jest.fn().mockResolvedValue(savedBatch)
    };

    ProductBatch.findById = jest.fn().mockResolvedValue(mockBatch);
    DetailInventory.findOne = jest.fn().mockResolvedValue(null);

    const response = await api
      .put(`/api/product-batches/${batchId}`)
      .send({ unitPrice: 120000 })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe('Product batch updated successfully');
  });
});

describe('DELETE /api/product-batches/:id', () => {
  beforeEach(() => {
    mockingoose.resetAll();
    jest.clearAllMocks();
  });

  test('should return 404 when batch not found', async () => {
    const batchId = new mongoose.Types.ObjectId();

    ProductBatch.findById = jest.fn().mockResolvedValue(null);

    const response = await api
      .delete(`/api/product-batches/${batchId}`)
      .expect(404);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('BATCH_NOT_FOUND');
  });

  test('should return 400 when batch has inventory', async () => {
    const batchId = new mongoose.Types.ObjectId();

    ProductBatch.findById = jest.fn().mockResolvedValue({
      _id: batchId,
      batchCode: 'BATCH2025000001',
      quantity: 0
    });

    DetailInventory.findOne = jest.fn().mockResolvedValue({
      _id: new mongoose.Types.ObjectId(),
      productBatch: batchId,
      quantityOnHand: 10
    });

    const response = await api
      .delete(`/api/product-batches/${batchId}`)
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('BATCH_HAS_INVENTORY');
  });

  test('should return 400 when batch has remaining quantity', async () => {
    const batchId = new mongoose.Types.ObjectId();

    ProductBatch.findById = jest.fn().mockResolvedValue({
      _id: batchId,
      batchCode: 'BATCH2025000001',
      quantity: 50
    });

    DetailInventory.findOne = jest.fn().mockResolvedValue(null);

    const response = await api
      .delete(`/api/product-batches/${batchId}`)
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('BATCH_HAS_QUANTITY');
  });
});
