const productsRouter = require('express').Router();
const Product = require('../models/product');
const Category = require('../models/category');
const ProductBatch = require('../models/productBatch');
const Inventory = require('../models/inventory');
const { userExtractor } = require('../utils/auth');
const ProductPriceHistory = require('../models/productPriceHistory');

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

    // Populate inventory if requested
    if (withInventory === 'true') {
      query = query.populate('inventory', 'quantityOnHand quantityOnShelf quantityReserved reorderPoint warehouseLocation');
    }

    // Populate batches if requested (or if withInventory is true for totalQuantityOnShelf calculation)
    if (withBatches === 'true' || withInventory === 'true') {
      // Determine select fields based on what's requested
      let selectFields = 'batchCode quantity expiryDate status promotionApplied discountPercentage';
      if (withBatches === 'true') {
        // Include additional fields when explicitly requesting batches
        selectFields = 'batchCode quantity expiryDate manufacturingDate costPrice unitPrice status promotionApplied discountPercentage';
      }

      query = query.populate({
        path: 'batches',
        select: selectFields,
        options: { sort: { expiryDate: 1 } },
        // Populate detailInventory to get quantityOnShelf
        populate: {
          path: 'detailInventory',
          select: 'quantityOnShelf quantityOnHand quantityReserved'
        }
        // Don't use match to allow discount calculation on all batches
      });
    }

    const products = await query;

    // Calculate discountPercentage for each product manually (FEFO logic)
    // Virtual properties don't work properly with populated data in toJSON
    const productsWithDiscount = products.map(product => {
      const productObj = product.toJSON();

      // Calculate discount from FEFO batch
      if (productObj.batches && Array.isArray(productObj.batches) && productObj.batches.length > 0) {
        // Filter batches with shelf stock and active status
        const availableBatches = productObj.batches.filter(batch => {
          // Check detailInventory.quantityOnShelf instead of batch.quantityOnShelf
          const hasStock = batch.detailInventory
            ? (batch.detailInventory.quantityOnShelf || 0) > 0
            : (batch.quantity || 0) > 0;
          const isActive = batch.status === 'active' || !batch.status;
          return hasStock && isActive;
        });

        if (availableBatches.length > 0) {
          // Sort by expiry date (nearest first) - FEFO logic
          const sortedBatches = [...availableBatches].sort((a, b) => {
            if (!a.expiryDate) return 1;
            if (!b.expiryDate) return -1;
            return new Date(a.expiryDate) - new Date(b.expiryDate);
          });

          const fefoBatch = sortedBatches[0];

          // Set discount percentage if batch has discount promotion
          if (fefoBatch.promotionApplied === 'discount' && (fefoBatch.discountPercentage || 0) > 0) {
            productObj.discountPercentage = fefoBatch.discountPercentage;
          } else {
            productObj.discountPercentage = 0;
          }
        } else {
          productObj.discountPercentage = 0;
        }
      } else {
        productObj.discountPercentage = 0;
      }

      return productObj;
    });

    // Get total count for pagination
    const total = await Product.countDocuments(filter);

    response.json({
      success: true,
      data: {
        products: productsWithDiscount,
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
      .populate('inventory', 'quantityOnHand quantityOnShelf quantityReserved reorderPoint warehouseLocation');

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
    // Price update is restricted to specific endpoint
    // if (unitPrice !== undefined) product.unitPrice = unitPrice; 
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
 * Note: Can only delete inactive products. Cannot delete if product has active batches or inventory.
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

    // Only allow deletion of inactive products
    if (product.isActive !== false) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Cannot delete active product',
          code: 'PRODUCT_IS_ACTIVE',
          details: 'Product must be deactivated before deletion'
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

    // Hard delete - remove from database
    await Product.findByIdAndDelete(request.params.id);

    // Also delete the inventory record
    if (inventory) {
      await Inventory.findByIdAndDelete(inventory._id);
    }

    response.json({
      success: true,
      message: 'Product deleted successfully',
      data: {
        id: product._id,
        productCode: product.productCode,
        name: product.name
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

/**
 * GET /api/products/code/:productCode
 * Get product by productCode with inventory and batch information
 * Used by POS system for barcode scanning simulation
 * 
 * Query parameters:
 * - withInventory: boolean - Include inventory info
 * - withBatches: boolean - Include batch info with FEFO sorting
 * - isActive: boolean - Only active products
 */
productsRouter.get('/code/:productCode', async (request, response) => {
  try {
    const { productCode } = request.params;
    const { withInventory, withBatches, isActive } = request.query;

    // Find product by productCode
    const query = { productCode: productCode.toUpperCase() };
    if (isActive === 'true') {
      query.isActive = true;
    }

    const product = await Product.findOne(query)
      .populate('category', 'name categoryCode');

    if (!product) {
      return response.status(404).json({
        success: false,
        error: {
          message: 'Product not found',
          code: 'PRODUCT_NOT_FOUND'
        }
      });
    }

    const result = { product: product.toJSON() };

    // Include inventory if requested
    if (withInventory === 'true') {
      const inventory = await Inventory.findOne({ product: product._id })
        .select('quantityOnHand quantityOnShelf quantityReserved reorderPoint warehouseLocation');

      if (!inventory) {
        result.inventory = null;
        result.outOfStock = true;

        return response.json({
          success: true,
          data: result,
          message: 'Product has no inventory record'
        });
      }

      const inventoryObj = inventory.toJSON();
      const quantityAvailable = Math.max(0,
        (inventoryObj.quantityOnHand || 0) +
        (inventoryObj.quantityOnShelf || 0) -
        (inventoryObj.quantityReserved || 0)
      );

      inventoryObj.quantityAvailable = quantityAvailable;
      result.inventory = inventoryObj;
      result.outOfStock = quantityAvailable <= 0;

      if (result.outOfStock) {
        return response.json({
          success: true,
          data: result,
          message: 'Product is out of stock'
        });
      }

      // Include batches if requested
      if (withBatches === 'true') {
        // Find available batches with FEFO sorting
        let batches = await ProductBatch.find({
          product: product._id,
          status: 'active',
          quantity: { $gt: 0 },
          $or: [
            { expiryDate: { $gt: new Date() } },
            { expiryDate: null }
          ]
        })
          .sort({ expiryDate: 1 }); // FEFO - First Expired First Out

        // Get DetailInventory for each batch to include quantityOnShelf
        const DetailInventory = require('../models/detailInventory');

        // Process batches - for now treat all as normal (auto-select first batch)
        // Can extend later for productType = 'fresh' with dynamic pricing
        if (batches.length > 0) {
          const batchesWithInventory = await Promise.all(
            batches.map(async (batch, index) => {
              const batchObj = batch.toJSON();

              // Get DetailInventory for this batch
              const detailInventory = await DetailInventory.findOne({ batchId: batch._id });
              if (detailInventory) {
                batchObj.detailInventory = {
                  quantityOnHand: detailInventory.quantityOnHand,
                  quantityOnShelf: detailInventory.quantityOnShelf,
                  quantityReserved: detailInventory.quantityReserved,
                  quantityAvailable: detailInventory.quantityAvailable
                };
              }

              // Calculate days until expiry if expiryDate exists
              if (batch.expiryDate) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const expiry = new Date(batch.expiryDate);
                expiry.setHours(0, 0, 0, 0);
                const diffTime = expiry - today;
                const daysUntilExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                batchObj.daysUntilExpiry = daysUntilExpiry;
              }

              // First batch is auto-selected (FEFO)
              batchObj.isAutoSelected = index === 0;

              return batchObj;
            })
          );

          result.batches = batchesWithInventory;

          // ⭐ CALCULATE DISCOUNT FROM FEFO BATCH (SAME LOGIC AS getAllProducts)
          // Filter batches with shelf stock and active status
          const availableBatches = batchesWithInventory.filter(batch => {
            const hasStock = batch.detailInventory
              ? (batch.detailInventory.quantityOnShelf || 0) > 0
              : (batch.quantity || 0) > 0;
            const isActive = batch.status === 'active' || !batch.status;
            return hasStock && isActive;
          });

          if (availableBatches.length > 0) {
            // Sort by expiry date (nearest first) - FEFO logic
            const sortedBatches = [...availableBatches].sort((a, b) => {
              if (!a.expiryDate) return 1;
              if (!b.expiryDate) return -1;
              return new Date(a.expiryDate) - new Date(b.expiryDate);
            });

            const fefoBatch = sortedBatches[0];

            // Set discount percentage if batch has discount promotion
            if (fefoBatch.promotionApplied === 'discount' && (fefoBatch.discountPercentage || 0) > 0) {
              result.product.discountPercentage = fefoBatch.discountPercentage;
            } else {
              result.product.discountPercentage = 0;
            }
          } else {
            result.product.discountPercentage = 0;
          }
        } else {
          result.batches = [];
          result.outOfStock = true;

          return response.json({
            success: true,
            data: result,
            message: 'Product has no available batches'
          });
        }
      }
    }

    return response.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Get product by productCode error:', error);
    return response.status(500).json({
      success: false,
      error: {
        message: 'Server error',
        details: error.message
      }
    });
  }
});

/**
 * PUT /api/products/:id/price
 * Update product price and log history
 */
productsRouter.put('/:id/price', userExtractor, async (request, response) => {
  try {
    const { newPrice, reason } = request.body;
    const product = await Product.findById(request.params.id);

    if (!product) {
      return response.status(404).json({
        success: false,
        error: { message: 'Product not found' }
      });
    }

    if (newPrice === undefined || newPrice < 0) {
      return response.status(400).json({
        success: false,
        error: { message: 'Invalid price' }
      });
    }

    const oldPrice = product.unitPrice;

    // Update product price
    product.unitPrice = newPrice;
    await product.save();

    // Create history record
    const history = new ProductPriceHistory({
      product: product._id,
      oldPrice: oldPrice,
      newPrice: newPrice,
      reason: reason || 'Price update',
      createdBy: request.user ? request.user.id : null
    });
    await history.save();

    response.json({
      success: true,
      data: {
        product,
        history
      },
      message: 'Price updated successfully'
    });
  } catch (error) {
    console.error('Update price error:', error);
    response.status(500).json({
      success: false,
      error: { message: 'Failed to update price' }
    });
  }
});

/**
 * GET /api/products/:id/price-history
 * Get price history for a product
 */
productsRouter.get('/:id/price-history', userExtractor, async (request, response) => {
  try {
    const history = await ProductPriceHistory.find({ product: request.params.id })
      .sort({ createdAt: -1 })
      .populate({
        path: 'createdBy',
        select: 'username role', // Keep some selection but ensure we have enough for virtuals
        populate: {
          path: 'employee',
          select: 'fullName'
        }
      })
      .limit(50);

    response.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('Get price history error:', error);
    response.status(500).json({
      success: false,
      error: { message: 'Failed to get price history' }
    });
  }
});

module.exports = productsRouter;
