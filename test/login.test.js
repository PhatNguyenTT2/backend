/**
 * @file login.test.js
 * @description Unit tests for login controller
 */

const mockingoose = require('mockingoose');
const mongoose = require('mongoose');
const request = require('supertest');
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const loginRouter = require('../controllers/login');
const UserAccount = require('../models/userAccount');
const Employee = require('../models/employee');
const Role = require('../models/role');

// Setup Express app
const app = express();
app.use(express.json());
app.use('/api/login', loginRouter);

// Mock environment variables
process.env.JWT_SECRET = 'test-secret-key';

describe('Login Controller Unit Tests', () => {
  beforeEach(() => {
    mockingoose.resetAll();
    jest.clearAllMocks();
  });

  describe('POST /api/login', () => {
    it('should login successfully with valid credentials', async () => {
      // Arrange: Mock user với password đã hash
      const roleId = new mongoose.Types.ObjectId();
      const userId = new mongoose.Types.ObjectId();
      const employeeId = new mongoose.Types.ObjectId();

      const passwordHash = await bcrypt.hash('password123', 10);

      const mockUser = {
        _id: userId,
        username: 'testuser',
        email: 'test@example.com',
        userCode: 'USER001',
        passwordHash: passwordHash,
        role: {
          _id: roleId,
          roleName: 'Admin',
          permissions: ['read', 'write']
        },
        isActive: true,
        tokens: [],
        lastLogin: null,
        save: jest.fn().mockResolvedValue(true)
      };

      const mockEmployee = {
        _id: employeeId,
        fullName: 'Test User',
        phone: '1234567890',
        userAccount: userId
      };

      mockingoose(UserAccount).toReturn(mockUser, 'findOne');
      mockingoose(Employee).toReturn(mockEmployee, 'findOne');

      // Act: Gọi login API
      const response = await request(app)
        .post('/api/login')
        .send({
          username: 'testuser',
          password: 'password123'
        })
        .expect(200);

      // Assert: Kiểm tra response structure
      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.username).toBe('testuser');
      expect(response.body.data.user.email).toBe('test@example.com');
      expect(response.body.data.user.fullName).toBe('Test User');
    });

    it('should return 400 when credentials are missing', async () => {
      // Act & Assert: Missing username
      const response1 = await request(app)
        .post('/api/login')
        .send({ password: 'password123' })
        .expect(400);

      expect(response1.body.success).toBe(false);
      expect(response1.body.error).toBe('Username and password are required');
    });

    it('should return 401 for invalid credentials', async () => {
      // Arrange: User không tồn tại
      mockingoose(UserAccount).toReturn(null, 'findOne');

      // Act
      const response = await request(app)
        .post('/api/login')
        .send({
          username: 'wronguser',
          password: 'wrongpass'
        })
        .expect(401);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid username or password');
    });
  });

  describe('POST /api/login/register', () => {
    it('should return 400 when required fields are missing', async () => {
      // Act & Assert
      const response = await request(app)
        .post('/api/login/register')
        .send({
          username: 'test',
          email: 'test@example.com'
          // Missing fullName and password
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('All fields are required (username, email, fullName, password)');
    });

    it('should return 400 for short password', async () => {
      // Act
      const response = await request(app)
        .post('/api/login/register')
        .send({
          username: 'newuser',
          email: 'new@example.com',
          fullName: 'New User',
          password: '12345' // Too short
        })
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Password must be at least 6 characters long');
    });
  });

  describe('POST /api/login/logout', () => {
    it('should logout successfully with valid token', async () => {
      // Arrange: Mock user với token
      const userId = new mongoose.Types.ObjectId();
      const token = jwt.sign({ id: userId, username: 'testuser' }, process.env.JWT_SECRET);

      const mockUser = {
        _id: userId,
        username: 'testuser',
        tokens: [{ token }],
        save: jest.fn().mockResolvedValue(true)
      };

      mockingoose(UserAccount).toReturn(mockUser, 'findById');

      // Act
      const response = await request(app)
        .post('/api/login/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Logged out successfully');
    });

    it('should return 401 when token is missing', async () => {
      // Act
      const response = await request(app)
        .post('/api/login/logout')
        .expect(401);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Token missing or invalid');
    });
  });

  describe('GET /api/login/me', () => {
    it('should return 401 when token is missing', async () => {
      // Act
      const response = await request(app)
        .get('/api/login/me')
        .expect(401);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Token missing or invalid');
    });

    it('should return 401 when user is not found or inactive', async () => {
      // Arrange: User không tồn tại
      const userId = new mongoose.Types.ObjectId();
      const token = jwt.sign({ id: userId, username: 'testuser' }, process.env.JWT_SECRET);

      mockingoose(UserAccount).toReturn(null, 'findById');

      // Act
      const response = await request(app)
        .get('/api/login/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('User not found or inactive');
    });
  });
});
