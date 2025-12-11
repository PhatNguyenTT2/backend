const mongoose = require('mongoose');
const supertest = require('supertest');
const app = require('../app');
const Order = require('../models/order');
const OrderDetail = require('../models/orderDetail');
const Customer = require('../models/customer');
const Employee = require('../models/employee');
const Product = require('../models/product');
const ProductBatch = require('../models/productBatch');
const Category = require('../models/category');
const CustomerDiscountSettings = require('../models/customerDiscountSettings');
const mockingoose = require('mockingoose');

const api = supertest(app);

/**
 * Orders Test Suite
 * 
 * Following TEST_WRITING_GUIDE.md principles:
 * - 2-3 tests per describe block
 * - 10-15 tests total for CRUD controller
 * - Focus on validation and critical errors
 * - Skip complex transaction/populate scenarios
 * 
 * Test Structure:
 * - GET /api/orders: 2 tests
 * - GET /api/orders/:id: 2 tests
 * - POST /api/orders: 4 tests (complex endpoint with validation)
 * - PUT /api/orders/:id: 3 tests
 * - DELETE /api/orders/:id: 2 tests
 * Total: 13 tests
 */

// Mock auth middleware
jest.mock('../utils/middleware', () => ({
  ...jest.requireActual('../utils/middleware'),
  authenticateToken: (req, res, next) => {
    req.user = { id: 'mock-user-id', username: 'testuser' };
    next();
  }
}));

// Mock CustomerDiscountSettings static method
CustomerDiscountSettings.getActiveDiscounts = jest.fn().mockResolvedValue({
  guest: 0,
  retail: 10,
  wholesale: 15,
  vip: 20
});

// Close connections after all tests
afterAll(async () => {
  await mongoose.connection.close();
});

describe('GET /api/orders', () => {
  beforeEach(() => {
    mockingoose.resetAll();
  });

  test('should return paginated orders with filters', async () => {
    const mockOrders = [
      {
        _id: new mongoose.Types.ObjectId(),
        orderNumber: 'ORD2501000001',
        customer: new mongoose.Types.ObjectId(),
        createdBy: new mongoose.Types.ObjectId(),
        orderDate: new Date(),
        status: 'pending',
        paymentStatus: 'pending',
        total: 100000
      }
    ];

    mockingoose(Order).toReturn(mockOrders, 'find');
    mockingoose(Order).toReturn(1, 'countDocuments');

    const response = await api
      .get('/api/orders')
      .query({ page: 1, limit: 20 })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.orders).toBeDefined();
    expect(response.body.pagination).toBeDefined();
    expect(response.body.pagination.page).toBe(1);
  });

  test('should handle database errors gracefully', async () => {
    mockingoose(Order).toReturn(new Error('Database connection failed'), 'find');

    const response = await api
      .get('/api/orders')
      .expect(500);

    expect(response.body.success).toBe(false);
    expect(response.body.error.message).toBe('Failed to fetch orders');
  });
});

describe('GET /api/orders/:id', () => {
  beforeEach(() => {
    mockingoose.resetAll();
  });

  test('should return order with populated details', async () => {
    const orderId = new mongoose.Types.ObjectId();
    const mockOrder = {
      _id: orderId,
      orderNumber: 'ORD2501000001',
      customer: { _id: new mongoose.Types.ObjectId(), fullName: 'Test Customer' },
      createdBy: { _id: new mongoose.Types.ObjectId(), fullName: 'Test Employee' },
      orderDate: new Date(),
      status: 'pending',
      paymentStatus: 'pending',
      total: 100000
    };

    mockingoose(Order).toReturn(mockOrder, 'findOne');

    const response = await api
      .get(`/api/orders/${orderId}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.order).toBeDefined();
  });

  test('should return 404 when order not found', async () => {
    const orderId = new mongoose.Types.ObjectId();
    mockingoose(Order).toReturn(null, 'findOne');

    const response = await api
      .get(`/api/orders/${orderId}`)
      .expect(404);

    expect(response.body.success).toBe(false);
    expect(response.body.error.message).toBe('Order not found');
  });
});

describe('POST /api/orders', () => {
  beforeEach(() => {
    mockingoose.resetAll();
  });

  test('should return 400 when items array is missing', async () => {
    const response = await api
      .post('/api/orders')
      .send({
        customer: new mongoose.Types.ObjectId(),
        createdBy: new mongoose.Types.ObjectId()
      })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('MISSING_ORDER_ITEMS');
  });

  test('should return 400 when items array is empty', async () => {
    const response = await api
      .post('/api/orders')
      .send({
        customer: new mongoose.Types.ObjectId(),
        createdBy: new mongoose.Types.ObjectId(),
        items: []
      })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('MISSING_ORDER_ITEMS');
  });

  test('should return 404 when customer not found', async () => {
    const customerId = new mongoose.Types.ObjectId();
    mockingoose(Customer).toReturn(null, 'findOne');

    const response = await api
      .post('/api/orders')
      .send({
        customer: customerId,
        items: [
          {
            product: new mongoose.Types.ObjectId(),
            quantity: 1,
            unitPrice: 10000
          }
        ]
      })
      .expect(404);

    expect(response.body.success).toBe(false);
    expect(response.body.error.message).toBe('Customer not found');
  });

  test('should return 404 when employee not found', async () => {
    const customerId = new mongoose.Types.ObjectId();
    const employeeId = new mongoose.Types.ObjectId();

    mockingoose(Customer).toReturn({
      _id: customerId,
      fullName: 'Test Customer',
      customerType: 'retail'
    }, 'findOne');

    mockingoose(Employee).toReturn(null, 'findOne');

    const response = await api
      .post('/api/orders')
      .send({
        customer: customerId,
        createdBy: employeeId,
        items: [
          {
            product: new mongoose.Types.ObjectId(),
            quantity: 1,
            unitPrice: 10000
          }
        ]
      })
      .expect(404);

    expect(response.body.success).toBe(false);
    expect(response.body.error.message).toBe('Employee not found');
  });
});

describe('PUT /api/orders/:id', () => {
  beforeEach(() => {
    mockingoose.resetAll();
  });

  test('should return 404 when order not found', async () => {
    const orderId = new mongoose.Types.ObjectId();
    mockingoose(Order).toReturn(null, 'findOne');

    const response = await api
      .put(`/api/orders/${orderId}`)
      .send({ status: 'shipping' })
      .expect(404);

    expect(response.body.success).toBe(false);
    expect(response.body.error.message).toBe('Order not found');
  });

  test('should return 400 when updating delivered order', async () => {
    const orderId = new mongoose.Types.ObjectId();
    const mockOrder = {
      _id: orderId,
      orderNumber: 'ORD2501000001',
      status: 'delivered',
      paymentStatus: 'paid',
      save: jest.fn()
    };

    mockingoose(Order).toReturn(mockOrder, 'findOne');

    const response = await api
      .put(`/api/orders/${orderId}`)
      .send({ shippingFee: 20000 })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error.message).toContain('Cannot update');
  });

  test('should return 400 when updating cancelled order', async () => {
    const orderId = new mongoose.Types.ObjectId();
    const mockOrder = {
      _id: orderId,
      orderNumber: 'ORD2501000001',
      status: 'cancelled',
      paymentStatus: 'refunded',
      save: jest.fn()
    };

    mockingoose(Order).toReturn(mockOrder, 'findOne');

    const response = await api
      .put(`/api/orders/${orderId}`)
      .send({ shippingFee: 20000 })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error.message).toContain('Cannot update');
  });
});

describe('DELETE /api/orders/:id', () => {
  beforeEach(() => {
    mockingoose.resetAll();
  });

  test('should return 404 when order not found', async () => {
    const orderId = new mongoose.Types.ObjectId();
    mockingoose(Order).toReturn(null, 'findOne');

    const response = await api
      .delete(`/api/orders/${orderId}`)
      .expect(404);

    expect(response.body.success).toBe(false);
    expect(response.body.error.message).toBe('Order not found');
  });

  test('should return 400 when deleting paid order with hardDelete', async () => {
    const orderId = new mongoose.Types.ObjectId();
    const mockOrder = {
      _id: orderId,
      orderNumber: 'ORD2501000001',
      customer: new mongoose.Types.ObjectId(),
      createdBy: new mongoose.Types.ObjectId(),
      status: 'pending',
      paymentStatus: 'paid',
      canBeCancelled: false
    };

    mockingoose(Order).toReturn(mockOrder, 'findOne');

    const response = await api
      .delete(`/api/orders/${orderId}`)
      .query({ hardDelete: 'true' })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('ORDER_CANNOT_BE_HARD_DELETED');
  });
});
