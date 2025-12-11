const mongoose = require('mongoose');
const supertest = require('supertest');
const app = require('../app');
const Customer = require('../models/customer');
const Order = require('../models/order');
const mockingoose = require('mockingoose');

const api = supertest(app);

/**
 * Customers Test Suite
 * 
 * Following TEST_WRITING_GUIDE.md principles:
 * - 2-3 tests per describe block
 * - 10-15 tests total for CRUD controller
 * - Focus on validation and critical errors
 * - Skip complex transaction/populate scenarios
 * 
 * Test Structure:
 * - GET /api/customers: 2 tests
 * - GET /api/customers/:id: 2 tests
 * - POST /api/customers: 4 tests
 * - PUT /api/customers/:id: 3 tests
 * - DELETE /api/customers/:id: 2 tests
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

describe('GET /api/customers', () => {
  beforeEach(() => {
    mockingoose.resetAll();
  });

  test('should return paginated customers with filters', async () => {
    const mockCustomers = [
      {
        _id: new mongoose.Types.ObjectId(),
        customerCode: 'CUST2025000001',
        fullName: 'Test Customer',
        email: 'test@example.com',
        phone: '0123456789',
        customerType: 'retail',
        totalSpent: 0,
        isActive: true
      }
    ];

    mockingoose(Customer).toReturn(mockCustomers, 'find');
    mockingoose(Customer).toReturn(1, 'countDocuments');
    mockingoose(Order).toReturn([], 'find');

    const response = await api
      .get('/api/customers')
      .query({ page: 1, limit: 20 })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.customers).toBeDefined();
    expect(response.body.data.pagination).toBeDefined();
    expect(response.body.data.pagination.currentPage).toBe(1);
  });

  test('should handle database errors gracefully', async () => {
    mockingoose(Customer).toReturn(new Error('Database connection failed'), 'find');

    const response = await api
      .get('/api/customers')
      .expect(500);

    expect(response.body.success).toBe(false);
    expect(response.body.error.message).toBe('Failed to get customers');
  });
});

describe('GET /api/customers/:id', () => {
  beforeEach(() => {
    mockingoose.resetAll();
  });

  test('should return customer with statistics', async () => {
    const customerId = new mongoose.Types.ObjectId();
    const mockCustomer = {
      _id: customerId,
      customerCode: 'CUST2025000001',
      fullName: 'Test Customer',
      email: 'test@example.com',
      customerType: 'retail',
      totalSpent: 100000,
      isActive: true,
      orders: []
    };

    mockingoose(Customer).toReturn(mockCustomer, 'findOne');

    const response = await api
      .get(`/api/customers/${customerId}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.customer).toBeDefined();
    expect(response.body.data.statistics).toBeDefined();
  });

  test('should return 404 when customer not found', async () => {
    const customerId = new mongoose.Types.ObjectId();
    mockingoose(Customer).toReturn(null, 'findOne');

    const response = await api
      .get(`/api/customers/${customerId}`)
      .expect(404);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('CUSTOMER_NOT_FOUND');
  });
});

describe('POST /api/customers', () => {
  beforeEach(() => {
    mockingoose.resetAll();
  });

  test('should return 400 when fullName is missing', async () => {
    const response = await api
      .post('/api/customers')
      .send({
        email: 'test@example.com',
        phone: '0123456789'
      })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('MISSING_FULL_NAME');
  });

  test('should return 409 when email already exists', async () => {
    const existingCustomer = {
      _id: new mongoose.Types.ObjectId(),
      customerCode: 'CUST2025000001',
      fullName: 'Existing Customer',
      email: 'duplicate@example.com'
    };

    mockingoose(Customer).toReturn(existingCustomer, 'findOne');

    const response = await api
      .post('/api/customers')
      .send({
        fullName: 'New Customer',
        email: 'duplicate@example.com',
        phone: '0123456789'
      })
      .expect(409);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('DUPLICATE_EMAIL');
  });

  test('should return 400 for invalid email format', async () => {
    mockingoose(Customer).toReturn(null, 'findOne');

    const mockSave = jest.fn().mockRejectedValue({
      name: 'ValidationError',
      message: 'Email format is invalid'
    });

    mockingoose(Customer).toReturn({ save: mockSave }, 'save');

    const response = await api
      .post('/api/customers')
      .send({
        fullName: 'Test Customer',
        email: 'invalid-email',
        phone: '0123456789'
      })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('should return 400 for invalid phone format', async () => {
    mockingoose(Customer).toReturn(null, 'findOne');

    const mockSave = jest.fn().mockRejectedValue({
      name: 'ValidationError',
      message: 'Phone format is invalid'
    });

    mockingoose(Customer).toReturn({ save: mockSave }, 'save');

    const response = await api
      .post('/api/customers')
      .send({
        fullName: 'Test Customer',
        email: 'test@example.com',
        phone: 'abc123'
      })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('PUT /api/customers/:id', () => {
  beforeEach(() => {
    mockingoose.resetAll();
  });

  test('should return 404 when customer not found', async () => {
    const customerId = new mongoose.Types.ObjectId();
    mockingoose(Customer).toReturn(null, 'findOne');

    const response = await api
      .put(`/api/customers/${customerId}`)
      .send({ fullName: 'Updated Name' })
      .expect(404);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('CUSTOMER_NOT_FOUND');
  });

  test('should return 409 when updating to duplicate email', async () => {
    const customerId = new mongoose.Types.ObjectId();

    // Mock Customer.findOne để trả về customer khác nhau tùy theo query
    Customer.findOne = jest.fn()
      .mockImplementationOnce(() => Promise.resolve({
        _id: customerId,
        customerCode: 'CUST2025000001',
        fullName: 'Test Customer',
        email: 'old@example.com',
        save: jest.fn()
      }))
      .mockImplementationOnce(() => Promise.resolve({
        _id: new mongoose.Types.ObjectId(),
        email: 'duplicate@example.com'
      }));

    const response = await api
      .put(`/api/customers/${customerId}`)
      .send({ email: 'duplicate@example.com' })
      .expect(409);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('DUPLICATE_EMAIL');
  });

  test('should return 400 for validation errors', async () => {
    const customerId = new mongoose.Types.ObjectId();

    Customer.findOne = jest.fn()
      .mockResolvedValueOnce({
        _id: customerId,
        customerCode: 'CUST2025000001',
        fullName: 'Test Customer',
        email: 'test@example.com',
        save: jest.fn().mockRejectedValue({
          name: 'ValidationError',
          message: 'Validation failed: gender is invalid'
        })
      })
      .mockResolvedValueOnce(null); // No duplicate email

    const response = await api
      .put(`/api/customers/${customerId}`)
      .send({ gender: 'invalid-gender' })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('DELETE /api/customers/:id', () => {
  beforeEach(() => {
    mockingoose.resetAll();
  });

  test('should return 404 when customer not found', async () => {
    const customerId = new mongoose.Types.ObjectId();
    mockingoose(Customer).toReturn(null, 'findOne');

    const response = await api
      .delete(`/api/customers/${customerId}`)
      .expect(404);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('CUSTOMER_NOT_FOUND');
  });

  test('should return 400 when customer has active orders', async () => {
    const customerId = new mongoose.Types.ObjectId();

    Customer.findById = jest.fn().mockResolvedValue({
      _id: customerId,
      customerCode: 'CUST2025000001',
      fullName: 'Test Customer',
      isActive: true,
      save: jest.fn()
    });

    mockingoose(Order).toReturn(5, 'countDocuments');

    const response = await api
      .delete(`/api/customers/${customerId}`)
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('CUSTOMER_HAS_ACTIVE_ORDERS');
  });
});
