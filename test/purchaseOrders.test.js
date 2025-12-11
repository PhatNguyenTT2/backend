const mongoose = require('mongoose');
const supertest = require('supertest');
const app = require('../app');
const PurchaseOrder = require('../models/purchaseOrder');
const Supplier = require('../models/supplier');
const Employee = require('../models/employee');
const DetailPurchaseOrder = require('../models/detailPurchaseOrder');
const Product = require('../models/product');
const mockingoose = require('mockingoose');

const api = supertest(app);

/**
 * Purchase Orders Test Suite
 * 
 * Following TEST_WRITING_GUIDE.md principles:
 * - 2-3 tests per describe block
 * - 10-15 tests total for CRUD controller
 * - Focus on validation and critical errors
 * - Skip complex transaction/populate scenarios
 * 
 * Test Structure:
 * - GET /api/purchase-orders: 2 tests
 * - GET /api/purchase-orders/:id: 2 tests
 * - POST /api/purchase-orders: 4 tests (complex with validation)
 * - PUT /api/purchase-orders/:id: 3 tests
 * - DELETE /api/purchase-orders/:id: 2 tests
 * Total: 13 tests
 */

// Mock auth middleware
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

describe('GET /api/purchase-orders', () => {
  beforeEach(() => {
    mockingoose.resetAll();
  });

  test('should return paginated purchase orders with filters', async () => {
    const mockPurchaseOrders = [
      {
        _id: new mongoose.Types.ObjectId(),
        poNumber: 'PO2025000001',
        supplier: new mongoose.Types.ObjectId(),
        orderDate: new Date(),
        status: 'pending',
        paymentStatus: 'unpaid',
        totalPrice: 1000000
      }
    ];

    mockingoose(PurchaseOrder).toReturn(mockPurchaseOrders, 'find');
    mockingoose(PurchaseOrder).toReturn(1, 'countDocuments');

    const response = await api
      .get('/api/purchase-orders')
      .query({ page: 1, limit: 20 })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.purchaseOrders).toBeDefined();
    expect(response.body.data.pagination).toBeDefined();
    expect(response.body.data.pagination.page).toBe(1);
  });

  test('should handle database errors gracefully', async () => {
    mockingoose(PurchaseOrder).toReturn(new Error('Database connection failed'), 'find');

    const response = await api
      .get('/api/purchase-orders')
      .expect(500);

    expect(response.body.success).toBe(false);
    expect(response.body.error.message).toBe('Failed to get purchase orders');
  });
});

describe('GET /api/purchase-orders/:id', () => {
  beforeEach(() => {
    mockingoose.resetAll();
  });

  test('should return purchase order with populated details', async () => {
    const poId = new mongoose.Types.ObjectId();
    const mockPurchaseOrder = {
      _id: poId,
      poNumber: 'PO2025000001',
      supplier: { _id: new mongoose.Types.ObjectId(), companyName: 'Test Supplier' },
      orderDate: new Date(),
      status: 'pending',
      paymentStatus: 'unpaid',
      totalPrice: 1000000,
      details: []
    };

    mockingoose(PurchaseOrder).toReturn(mockPurchaseOrder, 'findOne');

    const response = await api
      .get(`/api/purchase-orders/${poId}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.purchaseOrder).toBeDefined();
    expect(response.body.data.summary).toBeDefined();
  });

  test('should return 404 when purchase order not found', async () => {
    const poId = new mongoose.Types.ObjectId();
    mockingoose(PurchaseOrder).toReturn(null, 'findOne');

    const response = await api
      .get(`/api/purchase-orders/${poId}`)
      .expect(404);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('PURCHASE_ORDER_NOT_FOUND');
  });
});

describe('POST /api/purchase-orders', () => {
  beforeEach(() => {
    mockingoose.resetAll();
  });

  test('should return 400 when supplier is missing', async () => {
    const response = await api
      .post('/api/purchase-orders')
      .send({
        items: [
          {
            product: new mongoose.Types.ObjectId(),
            quantity: 10,
            costPrice: 50000
          }
        ]
      })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('MISSING_SUPPLIER');
  });

  test('should return 400 when items array is missing', async () => {
    const response = await api
      .post('/api/purchase-orders')
      .send({
        supplier: new mongoose.Types.ObjectId()
      })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('MISSING_ITEMS');
  });

  test('should return 400 when items array is empty', async () => {
    const response = await api
      .post('/api/purchase-orders')
      .send({
        supplier: new mongoose.Types.ObjectId(),
        items: []
      })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('MISSING_ITEMS');
  });

  test('should return 404 when supplier not found', async () => {
    const supplierId = new mongoose.Types.ObjectId();
    mockingoose(Supplier).toReturn(null, 'findOne');

    const response = await api
      .post('/api/purchase-orders')
      .send({
        supplier: supplierId,
        items: [
          {
            product: new mongoose.Types.ObjectId(),
            quantity: 10,
            costPrice: 50000
          }
        ]
      })
      .expect(404);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('SUPPLIER_NOT_FOUND');
  });
});

describe('PUT /api/purchase-orders/:id', () => {
  beforeEach(() => {
    mockingoose.resetAll();
  });

  test('should return 404 when purchase order not found', async () => {
    const poId = new mongoose.Types.ObjectId();
    mockingoose(PurchaseOrder).toReturn(null, 'findOne');

    const response = await api
      .put(`/api/purchase-orders/${poId}`)
      .send({ notes: 'Updated notes' })
      .expect(404);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('PURCHASE_ORDER_NOT_FOUND');
  });

  test('should return 400 when updating received purchase order', async () => {
    const poId = new mongoose.Types.ObjectId();
    const mockPurchaseOrder = {
      _id: poId,
      poNumber: 'PO2025000001',
      status: 'received',
      paymentStatus: 'paid'
    };

    mockingoose(PurchaseOrder).toReturn(mockPurchaseOrder, 'findOne');

    const response = await api
      .put(`/api/purchase-orders/${poId}`)
      .send({ notes: 'Cannot update' })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('ORDER_ALREADY_RECEIVED');
  });

  test('should return 400 when updating cancelled purchase order', async () => {
    const poId = new mongoose.Types.ObjectId();
    const mockPurchaseOrder = {
      _id: poId,
      poNumber: 'PO2025000001',
      status: 'cancelled',
      paymentStatus: 'unpaid'
    };

    mockingoose(PurchaseOrder).toReturn(mockPurchaseOrder, 'findOne');

    const response = await api
      .put(`/api/purchase-orders/${poId}`)
      .send({ notes: 'Cannot update' })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('ORDER_CANCELLED');
  });
});

describe('DELETE /api/purchase-orders/:id', () => {
  beforeEach(() => {
    mockingoose.resetAll();
  });

  test('should return 404 when purchase order not found', async () => {
    const poId = new mongoose.Types.ObjectId();
    mockingoose(PurchaseOrder).toReturn(null, 'findOne');

    const response = await api
      .delete(`/api/purchase-orders/${poId}`)
      .expect(404);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('PURCHASE_ORDER_NOT_FOUND');
  });

  test('should return 400 when deleting approved purchase order', async () => {
    const poId = new mongoose.Types.ObjectId();
    const mockPurchaseOrder = {
      _id: poId,
      poNumber: 'PO2025000001',
      status: 'approved',
      paymentStatus: 'unpaid'
    };

    mockingoose(PurchaseOrder).toReturn(mockPurchaseOrder, 'findOne');
    mockingoose(DetailPurchaseOrder).toReturn(0, 'countDocuments');

    const response = await api
      .delete(`/api/purchase-orders/${poId}`)
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('INVALID_STATUS_FOR_DELETION');
  });
});
