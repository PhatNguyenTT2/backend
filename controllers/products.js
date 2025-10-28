const productsRouter = require('express').Router()
const Product = require('../models/product')
const Category = require('../models/category')
const Inventory = require('../models/inventory')
const DetailProduct = require('../models/detailProduct')
const { userExtractor, isAdmin } = require('../utils/auth')

// GET /api/products - Get all products
productsRouter.get('/', async (request, response) => {
  try {
    const {
      include_inactive,
      category,
      in_stock,
      search,
      min_price,
      max_price,
      vendor
    } = request.query

    let products

    // Search functionality
    if (search) {
      products = await Product.searchProducts(search)
    }
    // Filter by price range
    else if (min_price || max_price) {
      const minPrice = min_price ? parseFloat(min_price) : 0
      const maxPrice = max_price ? parseFloat(max_price) : Infinity
      products = await Product.findByPriceRange(minPrice, maxPrice)
    }
    // Filter by category
    else if (category) {
      products = await Product.findByCategory(category)
    }
    // Filter in-stock products
    else if (in_stock === 'true') {
      products = await Product.findInStockProducts()
    }
    // Get all active products
    else {
      const filter = {}
      if (include_inactive !== 'true') {
        filter.isActive = true
      }
      if (vendor) {
        filter.vendor = { $regex: vendor, $options: 'i' }
      }

      products = await Product.find(filter)
        .populate('category', 'categoryCode name image')
        .populate('detail')
        .populate('inventory')
        .sort({ createdAt: -1 })
    }

    const productsData = products.map(product => ({
      id: product._id,
      productCode: product.productCode,
      name: product.name,
      category: product.category ? {
        id: product.category._id,
        categoryCode: product.category.categoryCode,
        name: product.category.name,
        image: product.category.image
      } : null,
      costPrice: product.costPrice,
      originalPrice: product.originalPrice,
      discountPercentage: product.discountPercentage,
      sellPrice: product.sellPrice,
      discountAmount: product.discountAmount,
      profitMargin: product.profitMargin,
      profitAmount: product.profitAmount,
      vendor: product.vendor,
      isActive: product.isActive,
      stock: product.stock,
      detail: product.detail ? {
        id: product.detail._id,
        description: product.detail.description,
        image: product.detail.image
      } : null,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt
    }))

    response.status(200).json({
      success: true,
      data: {
        products: productsData
      }
    })
  } catch (error) {
    response.status(500).json({
      error: 'Failed to fetch products'
    })
  }
})

// GET /api/products/stats/overview - Get product statistics (Admin only)
productsRouter.get('/stats/overview', userExtractor, isAdmin, async (request, response) => {
  try {
    const stats = await Product.getStatistics()

    response.status(200).json({
      success: true,
      data: {
        statistics: stats
      }
    })
  } catch (error) {
    response.status(500).json({
      error: 'Failed to fetch statistics'
    })
  }
})

// GET /api/products/low-stock - Get low stock products (Admin only)
productsRouter.get('/low-stock', userExtractor, isAdmin, async (request, response) => {
  try {
    const lowStockProducts = await Product.getLowStockProducts()

    const productsData = lowStockProducts.map(product => ({
      id: product._id,
      productCode: product.productCode,
      name: product.name,
      category: product.category ? {
        id: product.category._id,
        name: product.category.name
      } : null,
      stock: product.stock,
      reorderPoint: product.inventory?.reorderPoint || 0,
      vendor: product.vendor
    }))

    response.status(200).json({
      success: true,
      data: {
        lowStockProducts: productsData
      }
    })
  } catch (error) {
    response.status(500).json({
      error: 'Failed to fetch low stock products'
    })
  }
})

// GET /api/products/code/:code - Get product by code
productsRouter.get('/code/:code', async (request, response) => {
  try {
    const product = await Product.findOne({
      productCode: request.params.code.toUpperCase()
    })
      .populate('category', 'categoryCode name image description')
      .populate('detail')
      .populate('inventory')

    if (!product) {
      return response.status(404).json({
        error: 'Product not found'
      })
    }

    response.status(200).json({
      success: true,
      data: {
        product: {
          id: product._id,
          productCode: product.productCode,
          name: product.name,
          category: product.category ? {
            id: product.category._id,
            categoryCode: product.category.categoryCode,
            name: product.category.name,
            image: product.category.image,
            description: product.category.description
          } : null,
          costPrice: product.costPrice,
          originalPrice: product.originalPrice,
          discountPercentage: product.discountPercentage,
          sellPrice: product.sellPrice,
          discountAmount: product.discountAmount,
          profitMargin: product.profitMargin,
          profitAmount: product.profitAmount,
          vendor: product.vendor,
          isActive: product.isActive,
          stock: product.stock,
          detail: product.detail ? {
            id: product.detail._id,
            description: product.detail.description,
            image: product.detail.image
          } : null,
          inventory: product.inventory ? {
            id: product.inventory._id,
            quantity: product.inventory.quantity,
            reorderPoint: product.inventory.reorderPoint,
            maxStock: product.inventory.maxStock
          } : null,
          createdAt: product.createdAt,
          updatedAt: product.updatedAt
        }
      }
    })
  } catch (error) {
    response.status(500).json({
      error: 'Failed to fetch product'
    })
  }
})

// GET /api/products/:id - Get single product
productsRouter.get('/:id', async (request, response) => {
  try {
    const product = await Product.findById(request.params.id)
      .populate('category', 'categoryCode name image description')
      .populate('detail')
      .populate('inventory')

    if (!product) {
      return response.status(404).json({
        error: 'Product not found'
      })
    }

    response.status(200).json({
      success: true,
      data: {
        product: {
          id: product._id,
          productCode: product.productCode,
          name: product.name,
          category: product.category ? {
            id: product.category._id,
            categoryCode: product.category.categoryCode,
            name: product.category.name,
            image: product.category.image,
            description: product.category.description
          } : null,
          costPrice: product.costPrice,
          originalPrice: product.originalPrice,
          discountPercentage: product.discountPercentage,
          sellPrice: product.sellPrice,
          discountAmount: product.discountAmount,
          profitMargin: product.profitMargin,
          profitAmount: product.profitAmount,
          vendor: product.vendor,
          isActive: product.isActive,
          stock: product.stock,
          detail: product.detail ? {
            id: product.detail._id,
            description: product.detail.description,
            image: product.detail.image
          } : null,
          inventory: product.inventory ? {
            id: product.inventory._id,
            quantity: product.inventory.quantity,
            reorderPoint: product.inventory.reorderPoint,
            maxStock: product.inventory.maxStock
          } : null,
          createdAt: product.createdAt,
          updatedAt: product.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid product ID'
      })
    }
    response.status(500).json({
      error: 'Failed to fetch product'
    })
  }
})

// POST /api/products - Create new product (Admin only)
productsRouter.post('/', userExtractor, isAdmin, async (request, response) => {
  const {
    name,
    category,
    costPrice,
    originalPrice,
    discountPercentage,
    vendor
  } = request.body

  if (!name) {
    return response.status(400).json({
      error: 'Product name is required'
    })
  }

  if (!category) {
    return response.status(400).json({
      error: 'Category is required'
    })
  }

  if (!originalPrice || originalPrice <= 0) {
    return response.status(400).json({
      error: 'Original price is required and must be greater than 0'
    })
  }

  if (!vendor) {
    return response.status(400).json({
      error: 'Vendor is required'
    })
  }

  try {
    // Verify category exists and is active
    const categoryExists = await Category.findById(category)
    if (!categoryExists) {
      return response.status(400).json({
        error: 'Category not found'
      })
    }
    if (!categoryExists.isActive) {
      return response.status(400).json({
        error: 'Cannot add product to inactive category'
      })
    }

    const product = new Product({
      name,
      category,
      costPrice: costPrice || 0,
      originalPrice,
      discountPercentage: discountPercentage || 0,
      vendor,
      isActive: true
    })

    const savedProduct = await product.save()
    await savedProduct.populate('category', 'categoryCode name')

    response.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: {
        product: {
          id: savedProduct._id,
          productCode: savedProduct.productCode,
          name: savedProduct.name,
          category: savedProduct.category ? {
            id: savedProduct.category._id,
            categoryCode: savedProduct.category.categoryCode,
            name: savedProduct.category.name
          } : null,
          costPrice: savedProduct.costPrice,
          originalPrice: savedProduct.originalPrice,
          discountPercentage: savedProduct.discountPercentage,
          sellPrice: savedProduct.sellPrice,
          vendor: savedProduct.vendor,
          isActive: savedProduct.isActive,
          createdAt: savedProduct.createdAt
        }
      }
    })
  } catch (error) {
    if (error.name === 'ValidationError') {
      return response.status(400).json({
        error: error.message
      })
    }
    if (error.code === 11000) {
      return response.status(400).json({
        error: 'Product code already exists'
      })
    }
    response.status(500).json({
      error: 'Failed to create product'
    })
  }
})

// PUT /api/products/:id - Update product (Admin only)
productsRouter.put('/:id', userExtractor, isAdmin, async (request, response) => {
  const {
    name,
    category,
    costPrice,
    originalPrice,
    discountPercentage,
    vendor
  } = request.body

  try {
    const product = await Product.findById(request.params.id)

    if (!product) {
      return response.status(404).json({
        error: 'Product not found'
      })
    }

    // Verify category exists and is active if changing category
    if (category && category !== product.category.toString()) {
      const categoryExists = await Category.findById(category)
      if (!categoryExists) {
        return response.status(400).json({
          error: 'Category not found'
        })
      }
      if (!categoryExists.isActive) {
        return response.status(400).json({
          error: 'Cannot assign product to inactive category'
        })
      }
      product.category = category
    }

    // Update fields
    if (name !== undefined) product.name = name
    if (costPrice !== undefined) product.costPrice = costPrice
    if (originalPrice !== undefined) product.originalPrice = originalPrice
    if (discountPercentage !== undefined) product.discountPercentage = discountPercentage
    if (vendor !== undefined) product.vendor = vendor

    const updatedProduct = await product.save()
    await updatedProduct.populate('category', 'categoryCode name')

    response.status(200).json({
      success: true,
      message: 'Product updated successfully',
      data: {
        product: {
          id: updatedProduct._id,
          productCode: updatedProduct.productCode,
          name: updatedProduct.name,
          category: updatedProduct.category ? {
            id: updatedProduct.category._id,
            categoryCode: updatedProduct.category.categoryCode,
            name: updatedProduct.category.name
          } : null,
          costPrice: updatedProduct.costPrice,
          originalPrice: updatedProduct.originalPrice,
          discountPercentage: updatedProduct.discountPercentage,
          sellPrice: updatedProduct.sellPrice,
          vendor: updatedProduct.vendor,
          isActive: updatedProduct.isActive,
          updatedAt: updatedProduct.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.name === 'ValidationError') {
      return response.status(400).json({
        error: error.message
      })
    }
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid product ID'
      })
    }
    response.status(500).json({
      error: 'Failed to update product'
    })
  }
})

// PATCH /api/products/:id/pricing - Update product pricing (Admin only)
productsRouter.patch('/:id/pricing', userExtractor, isAdmin, async (request, response) => {
  const { originalPrice, discountPercentage } = request.body

  if (originalPrice === undefined && discountPercentage === undefined) {
    return response.status(400).json({
      error: 'At least one of originalPrice or discountPercentage is required'
    })
  }

  try {
    const product = await Product.findById(request.params.id)

    if (!product) {
      return response.status(404).json({
        error: 'Product not found'
      })
    }

    // Use the updatePricing method from the model
    const updatedProduct = await product.updatePricing(originalPrice, discountPercentage)

    response.status(200).json({
      success: true,
      message: 'Product pricing updated successfully',
      data: {
        product: {
          id: updatedProduct._id,
          productCode: updatedProduct.productCode,
          name: updatedProduct.name,
          originalPrice: updatedProduct.originalPrice,
          discountPercentage: updatedProduct.discountPercentage,
          sellPrice: updatedProduct.sellPrice,
          discountAmount: updatedProduct.discountAmount,
          updatedAt: updatedProduct.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.name === 'ValidationError') {
      return response.status(400).json({
        error: error.message
      })
    }
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid product ID'
      })
    }
    response.status(500).json({
      error: 'Failed to update pricing'
    })
  }
})

// PATCH /api/products/:id/discount - Apply discount to product (Admin only)
productsRouter.patch('/:id/discount', userExtractor, isAdmin, async (request, response) => {
  const { discountPercentage } = request.body

  if (discountPercentage === undefined || discountPercentage < 0 || discountPercentage > 100) {
    return response.status(400).json({
      error: 'Valid discount percentage (0-100) is required'
    })
  }

  try {
    const product = await Product.findById(request.params.id)

    if (!product) {
      return response.status(404).json({
        error: 'Product not found'
      })
    }

    // Use the applyDiscount method from the model
    const updatedProduct = await product.applyDiscount(discountPercentage)

    response.status(200).json({
      success: true,
      message: 'Discount applied successfully',
      data: {
        product: {
          id: updatedProduct._id,
          productCode: updatedProduct.productCode,
          name: updatedProduct.name,
          originalPrice: updatedProduct.originalPrice,
          discountPercentage: updatedProduct.discountPercentage,
          sellPrice: updatedProduct.sellPrice,
          discountAmount: updatedProduct.discountAmount,
          updatedAt: updatedProduct.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid product ID'
      })
    }
    response.status(500).json({
      error: 'Failed to apply discount'
    })
  }
})

// PATCH /api/products/:id/remove-discount - Remove discount from product (Admin only)
productsRouter.patch('/:id/remove-discount', userExtractor, isAdmin, async (request, response) => {
  try {
    const product = await Product.findById(request.params.id)

    if (!product) {
      return response.status(404).json({
        error: 'Product not found'
      })
    }

    // Use the removeDiscount method from the model
    const updatedProduct = await product.removeDiscount()

    response.status(200).json({
      success: true,
      message: 'Discount removed successfully',
      data: {
        product: {
          id: updatedProduct._id,
          productCode: updatedProduct.productCode,
          name: updatedProduct.name,
          originalPrice: updatedProduct.originalPrice,
          discountPercentage: updatedProduct.discountPercentage,
          sellPrice: updatedProduct.sellPrice,
          updatedAt: updatedProduct.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid product ID'
      })
    }
    response.status(500).json({
      error: 'Failed to remove discount'
    })
  }
})

// PATCH /api/products/:id/cost-price - Update cost price (Admin only)
productsRouter.patch('/:id/cost-price', userExtractor, isAdmin, async (request, response) => {
  const { costPrice } = request.body

  if (costPrice === undefined || costPrice < 0) {
    return response.status(400).json({
      error: 'Valid cost price is required'
    })
  }

  try {
    const product = await Product.findById(request.params.id)

    if (!product) {
      return response.status(404).json({
        error: 'Product not found'
      })
    }

    // Use the updateCostPrice method from the model
    const updatedProduct = await product.updateCostPrice(costPrice)

    response.status(200).json({
      success: true,
      message: 'Cost price updated successfully',
      data: {
        product: {
          id: updatedProduct._id,
          productCode: updatedProduct.productCode,
          name: updatedProduct.name,
          costPrice: updatedProduct.costPrice,
          profitMargin: updatedProduct.profitMargin,
          profitAmount: updatedProduct.profitAmount,
          updatedAt: updatedProduct.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid product ID'
      })
    }
    response.status(500).json({
      error: 'Failed to update cost price'
    })
  }
})

// PATCH /api/products/:id/toggle - Toggle product active status (Admin only)
productsRouter.patch('/:id/toggle', userExtractor, isAdmin, async (request, response) => {
  try {
    const product = await Product.findById(request.params.id)

    if (!product) {
      return response.status(404).json({
        error: 'Product not found'
      })
    }

    // Use the toggleActive method from the model
    const updatedProduct = await product.toggleActive()

    response.status(200).json({
      success: true,
      message: `Product ${updatedProduct.isActive ? 'activated' : 'deactivated'} successfully`,
      data: {
        product: {
          id: updatedProduct._id,
          productCode: updatedProduct.productCode,
          name: updatedProduct.name,
          isActive: updatedProduct.isActive,
          updatedAt: updatedProduct.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid product ID'
      })
    }
    response.status(500).json({
      error: 'Failed to toggle product status'
    })
  }
})

// DELETE /api/products/:id - Delete product (Admin only)
productsRouter.delete('/:id', userExtractor, isAdmin, async (request, response) => {
  try {
    const product = await Product.findById(request.params.id)

    if (!product) {
      return response.status(404).json({
        error: 'Product not found'
      })
    }

    // Check if product is still active
    if (product.isActive !== false) {
      return response.status(400).json({
        error: 'Cannot delete active product. Please deactivate it first.'
      })
    }

    // Check if product has inventory
    const inventory = await Inventory.findOne({ product: request.params.id })
    if (inventory && inventory.quantity > 0) {
      return response.status(400).json({
        error: `Cannot delete product with ${inventory.quantity} item(s) in stock. Please clear inventory first.`
      })
    }

    // Delete associated records
    await DetailProduct.findOneAndDelete({ product: request.params.id })
    if (inventory) {
      await Inventory.findByIdAndDelete(inventory._id)
    }

    await Product.findByIdAndDelete(request.params.id)

    response.status(200).json({
      success: true,
      message: 'Product deleted successfully'
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid product ID'
      })
    }
    response.status(500).json({
      error: 'Failed to delete product'
    })
  }
})

module.exports = productsRouter
