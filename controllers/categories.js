const categoriesRouter = require('express').Router();
const Category = require('../models/category');
const Product = require('../models/product');
const { userExtractor } = require('../utils/middleware');

/**
 * Categories Controller - Minimal CRUD Approach
 * 
 * Only 5 basic CRUD endpoints:
 * - GET /api/categories - Get all categories with filtering
 * - GET /api/categories/:id - Get single category by ID
 * - POST /api/categories - Create new category
 * - PUT /api/categories/:id - Update category
 * - DELETE /api/categories/:id - Delete category
 * 
 * Methods NOT implemented as endpoints (waiting for frontend request):
 * - getStatistics() - Category statistics
 * - getCategoriesWithProductCount() - Use populate productCount virtual
 * - toggleActive() - Use PUT /api/categories/:id with { isActive: false/true }
 * - findActiveCategories() - Use GET /api/categories?isActive=true
 */

/**
 * GET /api/categories
 * Get all categories with filtering via query parameters
 * 
 * Query parameters:
 * - isActive: boolean - Filter by active status
 * - search: string - Search by category name
 * - withProducts: boolean - Include product count
 * - page: number - Page number for pagination
 * - limit: number - Items per page
 */
categoriesRouter.get('/', async (request, response) => {
  try {
    const {
      isActive,
      search,
      withProducts,
      page = 1,
      limit = 20
    } = request.query;

    // Build filter object
    const filter = {};

    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    if (search) {
      filter.name = new RegExp(search, 'i');
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build query
    let query = Category.find(filter)
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    // Populate product count if requested
    if (withProducts === 'true') {
      query = query.populate('productCount');
    }

    const categories = await query;

    // Get total count for pagination
    const total = await Category.countDocuments(filter);

    response.json({
      success: true,
      data: {
        categories,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get categories error:', error);
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to get categories',
        details: error.message
      }
    });
  }
});

/**
 * GET /api/categories/:id
 * Get single category by ID with product count
 */
categoriesRouter.get('/:id', async (request, response) => {
  try {
    const category = await Category.findById(request.params.id)
      .populate('productCount');

    if (!category) {
      return response.status(404).json({
        success: false,
        error: {
          message: 'Category not found',
          code: 'CATEGORY_NOT_FOUND'
        }
      });
    }

    // Optionally get products in this category
    const products = await Product.find({ 
      category: category._id,
      isActive: true 
    })
      .select('productCode name originalPrice discountPercentage')
      .limit(10);

    response.json({
      success: true,
      data: {
        category,
        recentProducts: products
      }
    });
  } catch (error) {
    console.error('Get category by ID error:', error);
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to get category',
        details: error.message
      }
    });
  }
});

/**
 * POST /api/categories
 * Create new category
 * Requires authentication
 */
categoriesRouter.post('/', userExtractor, async (request, response) => {
  try {
    const {
      name,
      image,
      description,
      isActive
    } = request.body;

    // Validation
    if (!name) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Missing required fields',
          code: 'MISSING_REQUIRED_FIELDS',
          details: 'name is required'
        }
      });
    }

    // Check if category name already exists
    const existingCategory = await Category.findOne({ 
      name: { $regex: new RegExp(`^${name}$`, 'i') }
    });

    if (existingCategory) {
      return response.status(409).json({
        success: false,
        error: {
          message: 'Category name already exists',
          code: 'DUPLICATE_CATEGORY_NAME'
        }
      });
    }

    // Create category
    const category = new Category({
      name,
      image: image || null,
      description: description || null,
      isActive: isActive !== undefined ? isActive : true
    });

    const savedCategory = await category.save();

    response.status(201).json({
      success: true,
      data: savedCategory,
      message: 'Category created successfully'
    });
  } catch (error) {
    console.error('Create category error:', error);

    // Handle duplicate category code
    if (error.code === 11000) {
      return response.status(409).json({
        success: false,
        error: {
          message: 'Category already exists',
          code: 'DUPLICATE_CATEGORY',
          details: error.message
        }
      });
    }

    // Handle validation errors
    if (error.name === 'ValidationError') {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Validation error',
          code: 'VALIDATION_ERROR',
          details: error.message
        }
      });
    }

    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to create category',
        details: error.message
      }
    });
  }
});

/**
 * PUT /api/categories/:id
 * Update category
 * Requires authentication
 * 
 * Note: This endpoint handles all updates including:
 * - Basic info updates
 * - Activate/Deactivate (via isActive field)
 */
categoriesRouter.put('/:id', userExtractor, async (request, response) => {
  try {
    const {
      name,
      image,
      description,
      isActive
    } = request.body;

    // Find category
    const category = await Category.findById(request.params.id);

    if (!category) {
      return response.status(404).json({
        success: false,
        error: {
          message: 'Category not found',
          code: 'CATEGORY_NOT_FOUND'
        }
      });
    }

    // Check if new name already exists (excluding current category)
    if (name && name !== category.name) {
      const existingCategory = await Category.findOne({
        _id: { $ne: category._id },
        name: { $regex: new RegExp(`^${name}$`, 'i') }
      });

      if (existingCategory) {
        return response.status(409).json({
          success: false,
          error: {
            message: 'Category name already exists',
            code: 'DUPLICATE_CATEGORY_NAME'
          }
        });
      }
    }

    // Update fields
    if (name !== undefined) category.name = name;
    if (image !== undefined) category.image = image;
    if (description !== undefined) category.description = description;
    if (isActive !== undefined) category.isActive = isActive;

    const updatedCategory = await category.save();

    response.json({
      success: true,
      data: updatedCategory,
      message: 'Category updated successfully'
    });
  } catch (error) {
    console.error('Update category error:', error);

    // Handle validation errors
    if (error.name === 'ValidationError') {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Validation error',
          code: 'VALIDATION_ERROR',
          details: error.message
        }
      });
    }

    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to update category',
        details: error.message
      }
    });
  }
});

/**
 * DELETE /api/categories/:id
 * Delete category (soft delete by setting isActive = false)
 * Requires authentication
 * 
 * Note: Cannot delete category if it has active products
 */
categoriesRouter.delete('/:id', userExtractor, async (request, response) => {
  try {
    const category = await Category.findById(request.params.id);

    if (!category) {
      return response.status(404).json({
        success: false,
        error: {
          message: 'Category not found',
          code: 'CATEGORY_NOT_FOUND'
        }
      });
    }

    // Check if category has active products
    const activeProductCount = await Product.countDocuments({
      category: category._id,
      isActive: true
    });

    if (activeProductCount > 0) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Cannot delete category with active products',
          code: 'CATEGORY_HAS_ACTIVE_PRODUCTS',
          details: `This category has ${activeProductCount} active product(s). Please deactivate or reassign products first.`
        }
      });
    }

    // Soft delete - set isActive to false
    category.isActive = false;
    await category.save();

    response.json({
      success: true,
      message: 'Category deleted successfully (soft delete)',
      data: {
        id: category._id,
        categoryCode: category.categoryCode,
        name: category.name,
        isActive: category.isActive
      }
    });
  } catch (error) {
    console.error('Delete category error:', error);
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to delete category',
        details: error.message
      }
    });
  }
});

module.exports = categoriesRouter;
