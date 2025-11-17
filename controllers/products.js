const productsRouter = require('express').Router();
const Product = require('../models/product');
const Category = require('../models/category');
const ProductBatch = require('../models/productBatch');
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
 * - getProductsWithBatches() - Use populate batches virtual
 * - findByCategory() - Use GET /api/products?category=:categoryId
 * - toggleActive() - Use PUT /api/products/:id with { isActive: false/true }
 * - findActiveProducts() - Use GET /api/products?isActive=true
 */

/**
 * GET /api/products
 * Get all products with filtering via query parameters
 * 
 * Query parameters:
 * - isActive: boolean - Filter by active status
 * - category: ObjectId - Filter by category
 * - search: string - Search by product name or code
 * - minPrice: number - Filter by minimum price
 * - maxPrice: number - Filter by maximum price
 * - withBatches: boolean - Include batches
 * - withInventory: boolean - Include inventory
 * - page: number - Page number for pagination
 * - limit: number - Items per page
 */
productsRouter.get('/', async (request, response) => {
  try {
    const {
      isActive,
      category,
      search,
      minPrice,
      maxPrice,
      withBatches,
      withInventory,
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

    if (search) {
      filter.$or = [
        { name: new RegExp(search, 'i') },
        { productCode: new RegExp(search, 'i') },
        { vendor: new RegExp(search, 'i') }
      ];
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      filter.unitPrice = {};
      if (minPrice !== undefined) {
        filter.unitPrice.$gte = parseFloat(minPrice);
      }
      if (maxPrice !== undefined) {
        filter.unitPrice.$lte = parseFloat(maxPrice);
      }
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build query
    let query = Product.find(filter)
      .populate('category', 'categoryCode name image')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    // Populate batches if requested
    if (withBatches === 'true') {
      query = query.populate({
        path: 'batches',
        select: 'batchCode quantity expiryDate manufacturingDate costPrice unitPrice',
        options: { sort: { expiryDate: 1 } }
      });
    }

    // Populate inventory if requested
    if (withInventory === 'true') {
      query = query.populate('inventory', 'quantityAvailable quantityReserved quantityOnShelf');
    }

    const products = await query;

    // Get total count for pagination
    const total = await Product.countDocuments(filter);

    response.json({
      success: true,
      data: {
        products,
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
 * Get single product by ID with batches and inventory
 */
productsRouter.get('/:id', async (request, response) => {
  try {
    const product = await Product.findById(request.params.id)
      .populate('category', 'categoryCode name image description')
      .populate({
        path: 'batches',
        select: 'batchCode quantity expiryDate manufacturingDate costPrice unitPrice promotionApplied discountPercentage',
        options: { sort: { expiryDate: 1 } }
      })
      .populate('inventory', 'quantityAvailable quantityReserved quantityOnShelf quantityOnHand');

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
      data: { product }
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
      unitPrice,
      isActive,
      vendor
    } = request.body;

    // Validation
    if (!name || !category || !unitPrice) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Missing required fields',
          code: 'MISSING_REQUIRED_FIELDS',
          details: 'name, category, and unitPrice are required'
        }
      });
    }

    // Validate category exists
    const categoryExists = await Category.findById(category);
    if (!categoryExists) {
      return response.status(404).json({
        success: false,
        error: {
          message: 'Category not found',
          code: 'CATEGORY_NOT_FOUND'
        }
      });
    }

    // Check if product name already exists in the same category
    const existingProduct = await Product.findOne({
      name: { $regex: new RegExp(`^${name}$`, 'i') },
      category
    });

    if (existingProduct) {
      return response.status(409).json({
        success: false,
        error: {
          message: 'Product name already exists in this category',
          code: 'DUPLICATE_PRODUCT_NAME'
        }
      });
    }

    // Create product
    const product = new Product({
      name,
      image: image || null,
      category,
      unitPrice,
      isActive: isActive !== undefined ? isActive : true,
      vendor: vendor || null
    });

    const savedProduct = await product.save();

    // Create inventory for the new product
    const inventory = new Inventory({
      product: savedProduct._id,
      quantityOnHand: 0,
      quantityReserved: 0,
      quantityOnShelf: 0,
      reorderPoint: 10,
      warehouseLocation: null
    });

    await inventory.save();

    // Populate category before returning
    await savedProduct.populate('category', 'categoryCode name image');

    response.status(201).json({
      success: true,
      data: savedProduct,
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
 * - Activate/Deactivate (via isActive field)
 */
productsRouter.put('/:id', userExtractor, async (request, response) => {
  try {
    const {
      name,
      image,
      category,
      unitPrice,
      isActive,
      vendor
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

    // Validate category if provided
    if (category && category !== product.category.toString()) {
      const categoryExists = await Category.findById(category);
      if (!categoryExists) {
        return response.status(404).json({
          success: false,
          error: {
            message: 'Category not found',
            code: 'CATEGORY_NOT_FOUND'
          }
        });
      }
    }

    // Check if new name already exists (excluding current product)
    if (name && name !== product.name) {
      const checkCategory = category || product.category;
      const existingProduct = await Product.findOne({
        _id: { $ne: product._id },
        name: { $regex: new RegExp(`^${name}$`, 'i') },
        category: checkCategory
      });

      if (existingProduct) {
        return response.status(409).json({
          success: false,
          error: {
            message: 'Product name already exists in this category',
            code: 'DUPLICATE_PRODUCT_NAME'
          }
        });
      }
    }

    // Update fields
    if (name !== undefined) product.name = name;
    if (image !== undefined) product.image = image;
    if (category !== undefined) product.category = category;
    if (unitPrice !== undefined) product.unitPrice = unitPrice;
    if (isActive !== undefined) product.isActive = isActive;
    if (vendor !== undefined) product.vendor = vendor;

    const updatedProduct = await product.save();

    // Populate category before returning
    await updatedProduct.populate('category', 'categoryCode name image');

    response.json({
      success: true,
      data: updatedProduct,
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
 * 
 * Note: Cannot delete product if it has active batches or inventory
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

    // Check if product has active batches
    const activeBatchCount = await ProductBatch.countDocuments({
      product: product._id,
      quantity: { $gt: 0 }
    });

    if (activeBatchCount > 0) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Cannot delete product with active batches',
          code: 'PRODUCT_HAS_ACTIVE_BATCHES',
          details: `This product has ${activeBatchCount} batch(es) with remaining quantity. Please clear inventory first.`
        }
      });
    }

    // Check if product has inventory
    const inventory = await Inventory.findOne({ product: product._id });
    if (inventory && inventory.quantityAvailable > 0) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Cannot delete product with inventory',
          code: 'PRODUCT_HAS_INVENTORY',
          details: `This product has ${inventory.quantityAvailable} unit(s) in inventory. Please clear inventory first.`
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
        name: product.name,
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
