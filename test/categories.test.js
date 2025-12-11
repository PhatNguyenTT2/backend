/**
 * @file categories.test.js
 * @description Unit tests for categories controller
 */

const mockingoose = require('mockingoose');
const mongoose = require('mongoose');
const Category = require('../models/category');
const Product = require('../models/product');
const request = require('supertest');
const express = require('express');
const categoriesRouter = require('../controllers/categories');
const { userExtractor } = require('../utils/auth');

// Mock authentication middleware
jest.mock('../utils/auth', () => {
  const mongoose = require('mongoose');
  return {
    userExtractor: (req, res, next) => {
      req.user = {
        _id: new mongoose.Types.ObjectId(),
        role: { roleId: 'ADMIN' },
        email: 'admin@test.com'
      };
      next();
    }
  };
});

// Setup Express app
const app = express();
app.use(express.json());
app.use('/api/categories', categoriesRouter);

describe('Categories Controller Unit Tests', () => {
  beforeEach(() => {
    mockingoose.resetAll();
    jest.clearAllMocks();
  });

  describe('GET /api/categories', () => {
    it('should return paginated categories successfully', async () => {
      // Arrange: Mock data với pagination và filters
      const mockCategories = [
        {
          _id: new mongoose.Types.ObjectId(),
          categoryCode: 'CAT2025000001',
          name: 'Electronics',
          description: 'Electronic items',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          _id: new mongoose.Types.ObjectId(),
          categoryCode: 'CAT2025000002',
          name: 'Clothing',
          description: 'Fashion items',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      mockingoose(Category).toReturn(mockCategories, 'find');
      mockingoose(Category).toReturn(2, 'countDocuments');

      // Act: Gọi API với query params
      const response = await request(app)
        .get('/api/categories?page=1&limit=20&isActive=true&search=Electr')
        .expect(200);

      // Assert: Kiểm tra structure và data
      expect(response.body.success).toBe(true);
      expect(response.body.data.categories).toBeDefined();
      expect(response.body.data.pagination).toBeDefined();
      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.limit).toBe(20);
      expect(response.body.data.pagination.total).toBe(2);
      expect(Array.isArray(response.body.data.categories)).toBe(true);
    });

    it('should handle database errors', async () => {
      // Arrange: Mock database error
      mockingoose(Category).toReturn(new Error('Database connection failed'), 'find');

      // Act & Assert
      const response = await request(app)
        .get('/api/categories')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toBe('Failed to get categories');
    });
  });

  describe('GET /api/categories/:id', () => {
    it('should return a single category by ID with recent products', async () => {
      // Arrange
      const categoryId = new mongoose.Types.ObjectId();
      const mockCategory = {
        _id: categoryId,
        categoryCode: 'CAT2025000001',
        name: 'Electronics',
        description: 'Electronic items',
        image: 'electronics.jpg',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockProducts = [
        {
          _id: new mongoose.Types.ObjectId(),
          productCode: 'PRD2025000001',
          name: 'Laptop',
          originalPrice: 1000,
          discountPercentage: 10
        }
      ];

      mockingoose(Category).toReturn(mockCategory, 'findOne');
      mockingoose(Product).toReturn(mockProducts, 'find');

      // Act
      const response = await request(app)
        .get(`/api/categories/${categoryId}`)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.category).toBeDefined();
      expect(response.body.data.category.name).toBe('Electronics');
      expect(response.body.data.recentProducts).toBeDefined();
      expect(Array.isArray(response.body.data.recentProducts)).toBe(true);
    });

    it('should return 404 when category not found', async () => {
      // Arrange
      mockingoose(Category).toReturn(null, 'findOne');

      // Act
      const response = await request(app)
        .get(`/api/categories/${new mongoose.Types.ObjectId()}`)
        .expect(404);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toBe('Category not found');
      expect(response.body.error.code).toBe('CATEGORY_NOT_FOUND');
    });
  });

  describe('POST /api/categories', () => {
    it('should create a new category successfully', async () => {
      // Arrange
      const newCategory = {
        name: 'New Electronics',
        description: 'Latest electronic gadgets',
        image: 'electronics.jpg',
        isActive: true
      };

      const savedCategory = {
        _id: new mongoose.Types.ObjectId(),
        categoryCode: 'CAT2025000001',
        ...newCategory,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockingoose(Category).toReturn(null, 'findOne'); // No existing category
      mockingoose(Category).toReturn(savedCategory, 'save');

      // Act
      const response = await request(app)
        .post('/api/categories')
        .send(newCategory)
        .expect(201);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Category created successfully');
      expect(response.body.data).toBeDefined();
      expect(response.body.data.name).toBe(newCategory.name);
    });

    it('should return 400 when name is missing', async () => {
      // Arrange
      const invalidCategory = {
        description: 'Category without name'
      };

      // Act
      const response = await request(app)
        .post('/api/categories')
        .send(invalidCategory)
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toBe('Missing required fields');
      expect(response.body.error.code).toBe('MISSING_REQUIRED_FIELDS');
      expect(response.body.error.details).toContain('name is required');
    });

    it('should return 409 when category name already exists', async () => {
      // Arrange
      const existingCategory = {
        _id: new mongoose.Types.ObjectId(),
        categoryCode: 'CAT2025000001',
        name: 'Electronics',
        isActive: true
      };

      const duplicateCategory = {
        name: 'Electronics'
      };

      mockingoose(Category).toReturn(existingCategory, 'findOne');

      // Act
      const response = await request(app)
        .post('/api/categories')
        .send(duplicateCategory)
        .expect(409);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Category name already exists');
      expect(response.body.error.code).toBe('DUPLICATE_CATEGORY_NAME');
    });
  });

  describe('PUT /api/categories/:id', () => {
    it('should update category successfully', async () => {
      // Arrange
      const categoryId = new mongoose.Types.ObjectId();
      const existingCategory = {
        _id: categoryId,
        categoryCode: 'CAT2025000001',
        name: 'Old Name',
        description: 'Old description',
        isActive: true,
        save: jest.fn()
      };

      const updateData = {
        name: 'Updated Name',
        description: 'Updated description'
      };

      const updatedCategory = {
        ...existingCategory,
        ...updateData
      };

      existingCategory.save.mockResolvedValue(updatedCategory);

      let callCount = 0;
      mockingoose(Category).toReturn(() => {
        callCount++;
        if (callCount === 1) return existingCategory;
        return null; // No duplicate
      }, 'findOne');

      // Act
      const response = await request(app)
        .put(`/api/categories/${categoryId}`)
        .send(updateData)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Category updated successfully');
      expect(response.body.data.name).toBe(updateData.name);
    });

    it('should return 404 when category not found', async () => {
      // Arrange
      mockingoose(Category).toReturn(null, 'findOne');

      const updateData = {
        name: 'Updated Name'
      };

      // Act
      const response = await request(app)
        .put(`/api/categories/${new mongoose.Types.ObjectId()}`)
        .send(updateData)
        .expect(404);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Category not found');
      expect(response.body.error.code).toBe('CATEGORY_NOT_FOUND');
    });

    it('should return 409 when new name already exists', async () => {
      // Arrange
      const categoryId = new mongoose.Types.ObjectId();
      const existingCategory = {
        _id: categoryId,
        categoryCode: 'CAT2025000001',
        name: 'Old Name',
        isActive: true
      };

      const duplicateCategory = {
        _id: new mongoose.Types.ObjectId(),
        categoryCode: 'CAT2025000002',
        name: 'Existing Name',
        isActive: true
      };

      const updateData = {
        name: 'Existing Name'
      };

      // First call returns the category to update
      // Second call returns duplicate name check
      let callCount = 0;
      mockingoose(Category).toReturn((query) => {
        callCount++;
        if (callCount === 1) return existingCategory;
        return duplicateCategory;
      }, 'findOne');

      // Act
      const response = await request(app)
        .put(`/api/categories/${categoryId}`)
        .send(updateData)
        .expect(409);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Category name already exists');
      expect(response.body.error.code).toBe('DUPLICATE_CATEGORY_NAME');
    });
  });

  describe('DELETE /api/categories/:id', () => {
    it('should delete inactive category without products', async () => {
      // Arrange: Category phải inactive và không có products
      const categoryId = new mongoose.Types.ObjectId();
      const category = {
        _id: categoryId,
        categoryCode: 'CAT2025000001',
        name: 'Inactive Category',
        isActive: false
      };

      mockingoose(Category).toReturn(category, 'findOne');
      mockingoose(Product).toReturn(0, 'countDocuments');
      mockingoose(Category).toReturn(category, 'findByIdAndDelete');

      // Act
      const response = await request(app)
        .delete(`/api/categories/${categoryId}`)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Category deleted successfully');
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.categoryCode).toBe(category.categoryCode);
      expect(response.body.data.name).toBe(category.name);
    });

    it('should return 400 when category has active products', async () => {
      // Arrange: Business rule - không thể xóa category có products
      const categoryId = new mongoose.Types.ObjectId();
      const category = {
        _id: categoryId,
        categoryCode: 'CAT2025000001',
        name: 'Category With Products',
        isActive: false
      };

      mockingoose(Category).toReturn(category, 'findOne');
      mockingoose(Product).toReturn(5, 'countDocuments');

      // Act
      const response = await request(app)
        .delete(`/api/categories/${categoryId}`)
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Cannot delete category with active products');
      expect(response.body.error.code).toBe('CATEGORY_HAS_ACTIVE_PRODUCTS');
      expect(response.body.error.details).toContain('5 active product(s)');
    });
  });
});
