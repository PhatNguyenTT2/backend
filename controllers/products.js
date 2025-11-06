const productsRouter = require('express').Router();
const Product = require('../models/product');
const Inventory = require('../models/inventory');
const { userExtractor } = require('../utils/auth');

/**
 * Products Controller - Minimal CRUD Approach
 * 
 * Only 5 basic CRUD endpoints:
 * - GET /api/products - Get all products with filtering
 * - GET /api/products/:id - Get single product by ID
 * - POST /api/products - Create new product
 * - PUT /api/products/:id - Update product
 * - DELETE /api/products/:id - Delete product
 * 
 * Methods NOT implemented as endpoints (waiting for frontend request):
 * - getStatistics() - Product statistics
 * - getLowStock() - Use GET /api/products?lowStock=true
 * - getByCategory() - Use GET /api/products?category=categoryId
 * - toggleActive() - Use PUT /api/products/:id with { isActive: false/true }
 * - updateStock() - Handled through Inventory model
 */

/**
 * GET /api/products
 * Get all products with filtering via query parameters
 * 
 * Query parameters:
 * - isActive: boolean - Filter by active status
 * - category: string - Filter by category ID
 * - vendor: string - Filter by vendor name
 * - search: string - Search by product name
 * - minPrice: number - Filter by minimum price
 * - maxPrice: number - Filter by maximum price
 * - lowStock: boolean - Filter products with low stock (< 10)
 * - page: number - Page number for pagination
 * - limit: number - Items per page
 */
productsRouter.get('/', async (request, response) => {
  try {
    const {
      isActive,
      category,
      vendor,
      search,
      minPrice,
      maxPrice,
      lowStock,
      page = 1,
      limit = 20
    } = request.query;

    // Build filter object
    const filter = {};

    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    if (category) {
      filter.category = category;
    }

    if (vendor) {
      filter.vendor = new RegExp(vendor, 'i');
    }

    if (search) {
      filter.name = new RegExp(search, 'i');
    }

    if (minPrice || maxPrice) {
      filter.originalPrice = {};
      if (minPrice) filter.originalPrice.$gte = parseFloat(minPrice);
      if (maxPrice) filter.originalPrice.$lte = parseFloat(maxPrice);
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get products with population
    let query = Product.find(filter)
      .populate('category', 'categoryCode name')
      .populate('inventory')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const products = await query;

    // Filter low stock if requested (after population)
    let filteredProducts = products;
    if (lowStock === 'true') {
      filteredProducts = products.filter(p => {
        if (!p.inventory) return false;
        const available = p.inventory.quantityAvailable || 0;
        return available < 10;
      });
    }

    // Get total count for pagination
    const total = await Product.countDocuments(filter);

    response.json({
      success: true,
      data: {
        products: filteredProducts,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get products error:', error);
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to get products',
        details: error.message
      }
    });
  }
});

/**
 * GET /api/products/:id
 * Get single product by ID with full details
 */
productsRouter.get('/:id', async (request, response) => {
  try {
    const product = await Product.findById(request.params.id)
      .populate('category', 'categoryCode name description')
      .populate('detail')
      .populate('inventory')
      .populate('batches');

    if (!product) {
      return response.status(404).json({
        success: false,
        error: {
          message: 'Product not found',
          code: 'PRODUCT_NOT_FOUND'
        }
      });
    }

    response.json({
      success: true,
      data: product
    });
  } catch (error) {
    console.error('Get product by ID error:', error);
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to get product',
        details: error.message
      }
    });
  }
});

/**
 * POST /api/products
 * Create new product
 * Requires authentication
 */
productsRouter.post('/', userExtractor, async (request, response) => {
  try {
    const {
      name,
      image,
      category,
      costPrice,
      originalPrice,
      discountPercentage,
      vendor,
      isActive
    } = request.body;

    // Validation
    if (!name || !category || !originalPrice || !vendor) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Missing required fields',
          code: 'MISSING_REQUIRED_FIELDS',
          details: 'name, category, originalPrice, and vendor are required'
        }
      });
    }

    // Create product
    const product = new Product({
      name,
      image: image || null,
      category,
      costPrice: costPrice || 0,
      originalPrice,
      discountPercentage: discountPercentage || 0,
      vendor,
      isActive: isActive !== undefined ? isActive : true
    });

    const savedProduct = await product.save();

    // Create inventory entry for new product
    const inventory = new Inventory({
      product: savedProduct._id,
      quantityOnHand: 0,
      quantityOnShelf: 0,
      quantityReserved: 0,
      warehouseLocation: 'Main Warehouse'
    });
    await inventory.save();

    // Populate and return
    const populatedProduct = await Product.findById(savedProduct._id)
      .populate('category', 'categoryCode name')
      .populate('inventory');

    response.status(201).json({
      success: true,
      data: populatedProduct,
      message: 'Product created successfully'
    });
  } catch (error) {
    console.error('Create product error:', error);

    // Handle duplicate product code
    if (error.code === 11000) {
      return response.status(409).json({
        success: false,
        error: {
          message: 'Product already exists',
          code: 'DUPLICATE_PRODUCT',
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
        message: 'Failed to create product',
        details: error.message
      }
    });
  }
});

/**
 * PUT /api/products/:id
 * Update product
 * Requires authentication
 * 
 * Note: This endpoint handles all updates including:
 * - Basic info updates
 * - Price changes
 * - Activate/Deactivate (via isActive field)
 */
productsRouter.put('/:id', userExtractor, async (request, response) => {
  try {
    const {
      name,
      image,
      category,
      costPrice,
      originalPrice,
      discountPercentage,
      vendor,
      isActive
    } = request.body;

    // Find product
    const product = await Product.findById(request.params.id);

    if (!product) {
      return response.status(404).json({
        success: false,
        error: {
          message: 'Product not found',
          code: 'PRODUCT_NOT_FOUND'
        }
      });
    }

    // Update fields
    if (name !== undefined) product.name = name;
    if (image !== undefined) product.image = image;
    if (category !== undefined) product.category = category;
    if (costPrice !== undefined) product.costPrice = costPrice;
    if (originalPrice !== undefined) product.originalPrice = originalPrice;
    if (discountPercentage !== undefined) product.discountPercentage = discountPercentage;
    if (vendor !== undefined) product.vendor = vendor;
    if (isActive !== undefined) product.isActive = isActive;

    const updatedProduct = await product.save();

    // Populate and return
    const populatedProduct = await Product.findById(updatedProduct._id)
      .populate('category', 'categoryCode name')
      .populate('inventory');

    response.json({
      success: true,
      data: populatedProduct,
      message: 'Product updated successfully'
    });
  } catch (error) {
    console.error('Update product error:', error);

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
        message: 'Failed to update product',
        details: error.message
      }
    });
  }
});

/**
 * DELETE /api/products/:id
 * Delete product (soft delete by setting isActive = false)
 * Requires authentication
 */
productsRouter.delete('/:id', userExtractor, async (request, response) => {
  try {
    const product = await Product.findById(request.params.id);

    if (!product) {
      return response.status(404).json({
        success: false,
        error: {
          message: 'Product not found',
          code: 'PRODUCT_NOT_FOUND'
        }
      });
    }

    // Soft delete - set isActive to false
    product.isActive = false;
    await product.save();

    response.json({
      success: true,
      message: 'Product deleted successfully (soft delete)',
      data: {
        id: product._id,
        productCode: product.productCode,
        isActive: product.isActive
      }
    });
  } catch (error) {
    console.error('Delete product error:', error);
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to delete product',
        details: error.message
      }
    });
  }
});

module.exports = productsRouter;
