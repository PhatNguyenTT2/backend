const mongoose = require('mongoose');
const supertest = require('supertest');
const app = require('../app');
const Payment = require('../models/payment');
const Order = require('../models/order');
const PurchaseOrder = require('../models/purchaseOrder');
const mockingoose = require('mockingoose');

const api = supertest(app);

/**
 * Payments Test Suite
 * 
 * Following TEST_WRITING_GUIDE.md principles:
 * - 2-3 tests per describe block
 * - 10-15 tests total for CRUD controller
 * - Focus on validation and critical errors
 * - Skip complex transaction/populate scenarios
 * 
 * Test Structure:
 * - GET /api/payments: 2 tests
 * - GET /api/payments/:id: 2 tests
 * - POST /api/payments: 4 tests (polymorphic reference validation)
 * - PUT /api/payments/:id: 2 tests
 * - DELETE /api/payments/:id: 3 tests
 * Total: 13 tests
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

describe('GET /api/payments', () => {
  beforeEach(() => {
    mockingoose.resetAll();
  });

  test('should return paginated payments with filters', async () => {
    const mockPayments = [
      {
        _id: new mongoose.Types.ObjectId(),
        paymentNumber: 'PPAY2025000001',
        amount: 500000,
        paymentMethod: 'cash',
        paymentDate: new Date(),
        status: 'completed',
        referenceType: 'Order',
        referenceId: new mongoose.Types.ObjectId()
      }
    ];

    mockingoose(Payment).toReturn(mockPayments, 'find');
    mockingoose(Payment).toReturn(1, 'countDocuments');

    const response = await api
      .get('/api/payments')
      .query({ page: 1, limit: 50 })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.payments).toBeDefined();
    expect(response.body.data.pagination).toBeDefined();
    expect(response.body.data.pagination.page).toBe(1);
  });

  test('should handle database errors gracefully', async () => {
    mockingoose(Payment).toReturn(new Error('Database connection failed'), 'find');

    const response = await api
      .get('/api/payments')
      .expect(500);

    expect(response.body.success).toBe(false);
    expect(response.body.error.message).toBe('Failed to fetch payments');
  });
});

describe('GET /api/payments/:id', () => {
  beforeEach(() => {
    mockingoose.resetAll();
  });

  test('should return payment with populated references', async () => {
    const paymentId = new mongoose.Types.ObjectId();
    const mockPayment = {
      _id: paymentId,
      paymentNumber: 'PPAY2025000001',
      amount: 500000,
      paymentMethod: 'cash',
      paymentDate: new Date(),
      status: 'completed',
      referenceType: 'Order',
      referenceId: new mongoose.Types.ObjectId()
    };

    mockingoose(Payment).toReturn(mockPayment, 'findOne');

    const response = await api
      .get(`/api/payments/${paymentId}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();
  });

  test('should return 404 when payment not found', async () => {
    const paymentId = new mongoose.Types.ObjectId();
    mockingoose(Payment).toReturn(null, 'findOne');

    const response = await api
      .get(`/api/payments/${paymentId}`)
      .expect(404);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('PAYMENT_NOT_FOUND');
  });
});

describe('POST /api/payments', () => {
  beforeEach(() => {
    mockingoose.resetAll();
  });

  test('should return 400 when required fields are missing', async () => {
    const response = await api
      .post('/api/payments')
      .send({
        amount: 500000
        // missing referenceType, referenceId, paymentMethod
      })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('MISSING_REQUIRED_FIELDS');
  });

  test('should return 400 when referenceType is invalid', async () => {
    const response = await api
      .post('/api/payments')
      .send({
        referenceType: 'InvalidType',
        referenceId: new mongoose.Types.ObjectId(),
        amount: 500000,
        paymentMethod: 'cash'
      })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('INVALID_REFERENCE_TYPE');
  });

  test('should return 404 when Order reference not found', async () => {
    const orderId = new mongoose.Types.ObjectId();

    // Mock Order.exists to return false
    Order.exists = jest.fn().mockResolvedValue(false);

    const response = await api
      .post('/api/payments')
      .send({
        referenceType: 'Order',
        referenceId: orderId,
        amount: 500000,
        paymentMethod: 'cash'
      })
      .expect(404);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('REFERENCE_NOT_FOUND');
  });

  test('should return 404 when PurchaseOrder reference not found', async () => {
    const poId = new mongoose.Types.ObjectId();

    // Mock PurchaseOrder.exists to return false
    PurchaseOrder.exists = jest.fn().mockResolvedValue(false);

    const response = await api
      .post('/api/payments')
      .send({
        referenceType: 'PurchaseOrder',
        referenceId: poId,
        amount: 500000,
        paymentMethod: 'bank_transfer'
      })
      .expect(404);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('REFERENCE_NOT_FOUND');
  });
});

describe('PUT /api/payments/:id', () => {
  beforeEach(() => {
    mockingoose.resetAll();
  });

  test('should return 404 when payment not found', async () => {
    const paymentId = new mongoose.Types.ObjectId();
    mockingoose(Payment).toReturn(null, 'findOne');

    const response = await api
      .put(`/api/payments/${paymentId}`)
      .send({ amount: 600000 })
      .expect(404);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('PAYMENT_NOT_FOUND');
  });

  test('should handle payment updates', async () => {
    const paymentId = new mongoose.Types.ObjectId();

    Payment.findById = jest.fn().mockResolvedValue({
      _id: paymentId,
      paymentNumber: 'PPAY2025000001',
      amount: 500000,
      paymentMethod: 'cash',
      status: 'pending',
      referenceType: 'Order',
      referenceId: new mongoose.Types.ObjectId(),
      save: jest.fn().mockResolvedValue(true),
      populate: jest.fn().mockReturnThis()
    });

    // Mock Order/PurchaseOrder for payment status update
    mockingoose(Order).toReturn({
      _id: new mongoose.Types.ObjectId(),
      orderNumber: 'ORD2501000001',
      total: 1000000,
      paymentStatus: 'pending',
      save: jest.fn()
    }, 'findOne');

    mockingoose(Payment).toReturn([], 'find');

    const response = await api
      .put(`/api/payments/${paymentId}`)
      .send({ amount: 600000 })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe('Payment updated successfully');
  });
});

describe('DELETE /api/payments/:id', () => {
  beforeEach(() => {
    mockingoose.resetAll();
    jest.clearAllMocks();
  });

  test('should return 404 when payment not found', async () => {
    const paymentId = new mongoose.Types.ObjectId();

    Payment.findById = jest.fn().mockResolvedValue(null);

    const response = await api
      .delete(`/api/payments/${paymentId}`)
      .expect(404);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('PAYMENT_NOT_FOUND');
  });

  test('should return 400 when deleting completed payment', async () => {
    const paymentId = new mongoose.Types.ObjectId();

    Payment.findById = jest.fn().mockResolvedValue({
      _id: paymentId,
      paymentNumber: 'PPAY2025000001',
      amount: 500000,
      paymentMethod: 'cash',
      status: 'completed',
      referenceType: 'Order',
      referenceId: new mongoose.Types.ObjectId()
    });

    const response = await api
      .delete(`/api/payments/${paymentId}`)
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('CANNOT_DELETE_PAYMENT');
  });

  test('should return 400 when deleting cancelled payment', async () => {
    const paymentId = new mongoose.Types.ObjectId();

    Payment.findById = jest.fn().mockResolvedValue({
      _id: paymentId,
      paymentNumber: 'PPAY2025000001',
      amount: 500000,
      paymentMethod: 'cash',
      status: 'cancelled',
      referenceType: 'Order',
      referenceId: new mongoose.Types.ObjectId()
    });

    const response = await api
      .delete(`/api/payments/${paymentId}`)
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('CANNOT_DELETE_PAYMENT');
  });
});
