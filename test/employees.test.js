const mongoose = require('mongoose');
const supertest = require('supertest');
const app = require('../app');
const Employee = require('../models/employee');
const UserAccount = require('../models/userAccount');
const EmployeePOSAuth = require('../models/employeePOSAuth');
const mockingoose = require('mockingoose');

const api = supertest(app);

/**
 * Employees Test Suite
 * 
 * Following TEST_WRITING_GUIDE.md principles:
 * - 2-3 tests per describe block
 * - 10-15 tests total for CRUD controller
 * - Focus on validation and critical errors
 * - Skip complex transaction/populate scenarios
 * 
 * Test Structure:
 * - GET /api/employees: 2 tests
 * - GET /api/employees/:id: 2 tests
 * - POST /api/employees: 4 tests (complex with transaction)
 * - PUT /api/employees/:id: 3 tests
 * - DELETE /api/employees/:id: 2 tests
 * Total: 13 tests
 */

// Mock auth middleware (if needed)
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

describe('GET /api/employees', () => {
  beforeEach(() => {
    mockingoose.resetAll();
  });

  test('should return all employees with populated userAccount', async () => {
    const mockEmployees = [
      {
        _id: new mongoose.Types.ObjectId(),
        fullName: 'Test Employee',
        phone: '0123456789',
        address: 'Test Address',
        userAccount: {
          _id: new mongoose.Types.ObjectId(),
          username: 'testuser',
          email: 'test@example.com',
          isActive: true
        }
      }
    ];

    mockingoose(Employee).toReturn(mockEmployees, 'find');

    const response = await api
      .get('/api/employees')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.employees).toBeDefined();
    expect(response.body.data.count).toBeDefined();
  });

  test('should handle database errors gracefully', async () => {
    mockingoose(Employee).toReturn(new Error('Database connection failed'), 'find');

    const response = await api
      .get('/api/employees')
      .expect(500);

    expect(response.body.success).toBe(false);
    expect(response.body.error.message).toBe('Failed to fetch employees');
  });
});

describe('GET /api/employees/:id', () => {
  beforeEach(() => {
    mockingoose.resetAll();
  });

  test('should return employee with populated userAccount', async () => {
    const employeeId = new mongoose.Types.ObjectId();
    const mockEmployee = {
      _id: employeeId,
      fullName: 'Test Employee',
      phone: '0123456789',
      userAccount: {
        _id: new mongoose.Types.ObjectId(),
        username: 'testuser',
        email: 'test@example.com',
        isActive: true
      }
    };

    mockingoose(Employee).toReturn(mockEmployee, 'findOne');

    const response = await api
      .get(`/api/employees/${employeeId}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.employee).toBeDefined();
  });

  test('should return 404 when employee not found', async () => {
    const employeeId = new mongoose.Types.ObjectId();
    mockingoose(Employee).toReturn(null, 'findOne');

    const response = await api
      .get(`/api/employees/${employeeId}`)
      .expect(404);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('EMPLOYEE_NOT_FOUND');
  });
});

describe('POST /api/employees', () => {
  beforeEach(() => {
    mockingoose.resetAll();
  });

  test('should return 400 when userData is missing', async () => {
    const response = await api
      .post('/api/employees')
      .send({
        employeeData: {
          fullName: 'Test Employee'
        }
      })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('MISSING_FIELDS');
  });

  test('should return 400 when employeeData is missing', async () => {
    const response = await api
      .post('/api/employees')
      .send({
        userData: {
          username: 'testuser',
          email: 'test@example.com',
          password: 'password123',
          role: new mongoose.Types.ObjectId()
        }
      })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('MISSING_FIELDS');
  });

  test('should return 400 when required user fields are missing', async () => {
    const response = await api
      .post('/api/employees')
      .send({
        userData: {
          username: 'testuser'
          // missing email, password, role
        },
        employeeData: {
          fullName: 'Test Employee'
        }
      })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('MISSING_USER_FIELDS');
  });

  test('should return 400 when fullName is missing', async () => {
    const response = await api
      .post('/api/employees')
      .send({
        userData: {
          username: 'testuser',
          email: 'test@example.com',
          password: 'password123',
          role: new mongoose.Types.ObjectId()
        },
        employeeData: {
          phone: '0123456789'
          // missing fullName
        }
      })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('MISSING_EMPLOYEE_FIELDS');
  });
});

describe('PUT /api/employees/:id', () => {
  beforeEach(() => {
    mockingoose.resetAll();
  });

  test('should return 404 when employee not found', async () => {
    const employeeId = new mongoose.Types.ObjectId();
    mockingoose(Employee).toReturn(null, 'findOne');

    const response = await api
      .put(`/api/employees/${employeeId}`)
      .send({ fullName: 'Updated Name' })
      .expect(404);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('EMPLOYEE_NOT_FOUND');
  });

  test('should return 400 for validation errors', async () => {
    const employeeId = new mongoose.Types.ObjectId();

    Employee.findById = jest.fn().mockResolvedValue({
      _id: employeeId,
      fullName: 'Test Employee',
      phone: '0123456789',
      save: jest.fn().mockRejectedValue({
        name: 'ValidationError',
        message: 'Validation failed',
        errors: {
          phone: {
            message: 'Please enter a valid phone number'
          }
        }
      }),
      populate: jest.fn().mockReturnThis()
    });

    const response = await api
      .put(`/api/employees/${employeeId}`)
      .send({ phone: 'invalid-phone' })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('should return 400 for invalid phone format', async () => {
    const employeeId = new mongoose.Types.ObjectId();

    Employee.findById = jest.fn().mockResolvedValue({
      _id: employeeId,
      fullName: 'Test Employee',
      phone: '0123456789',
      save: jest.fn().mockRejectedValue({
        name: 'ValidationError',
        message: 'Phone validation failed',
        errors: {
          phone: {
            message: 'Please enter a valid phone number (10-15 digits)'
          }
        }
      }),
      populate: jest.fn().mockReturnThis()
    });

    const response = await api
      .put(`/api/employees/${employeeId}`)
      .send({ phone: 'abc' })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('DELETE /api/employees/:id', () => {
  beforeEach(() => {
    mockingoose.resetAll();
    jest.clearAllMocks();
  });

  test('should return 404 when employee not found', async () => {
    // Mock mongoose session
    const mockSession = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      abortTransaction: jest.fn(),
      endSession: jest.fn()
    };

    mongoose.startSession = jest.fn().mockResolvedValue(mockSession);

    Employee.findById = jest.fn().mockReturnValue({
      populate: jest.fn().mockReturnValue({
        session: jest.fn().mockResolvedValue(null)
      })
    });

    const employeeId = new mongoose.Types.ObjectId();

    const response = await api
      .delete(`/api/employees/${employeeId}`)
      .expect(404);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('EMPLOYEE_NOT_FOUND');
  });

  test('should return 400 when employee is still active', async () => {
    const employeeId = new mongoose.Types.ObjectId();
    const userAccountId = new mongoose.Types.ObjectId();

    // Mock mongoose session
    const mockSession = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      abortTransaction: jest.fn(),
      endSession: jest.fn()
    };

    mongoose.startSession = jest.fn().mockResolvedValue(mockSession);

    const mockEmployee = {
      _id: employeeId,
      fullName: 'Test Employee',
      userAccount: {
        _id: userAccountId,
        isActive: true
      }
    };

    Employee.findById = jest.fn().mockReturnValue({
      populate: jest.fn().mockReturnValue({
        session: jest.fn().mockResolvedValue(mockEmployee)
      })
    });

    const response = await api
      .delete(`/api/employees/${employeeId}`)
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('EMPLOYEE_STILL_ACTIVE');
  });
});
