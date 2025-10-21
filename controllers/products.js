const productsRouter = require('express').Router()
const Product = require('../models/product')
const Category = require('../models/category')
const { userExtractor, isAdmin } = require('../utils/auth')

// GET /api/products - Get all products with pagination and filters
productsRouter.get('/', async (request, response) => {
  try {
    const {
      page = 1,
      per_page = 8,
      category,
      min_price,
      max_price,
      sort_by,
      search,
      type,
      in_stock,
      include_inactive
    } = request.query

    // Build filter object
    // For admin panel: include inactive products when requested
    const filter = {}
    if (include_inactive !== 'true') {
      filter.isActive = true
    }

    // Category filter
    if (category) {
      filter.category = category
    }

    // Price range filter
    if (min_price || max_price) {
      filter.price = {}
      if (min_price) filter.price.$gte = Number(min_price)
      if (max_price) filter.price.$lte = Number(max_price)
    }

    // Type filter (Organic, Regular, etc.)
    if (type) {
      filter.type = type
    }

    // Stock filter
    if (in_stock === 'true') {
      filter.stock = { $gt: 0 }
    }

    // Search filter (text search)
    if (search) {
      filter.$text = { $search: search }
    }

    // Sort options
    let sort = {}
    switch (sort_by) {
      case 'price_asc':
        sort = { price: 1 }
        break
      case 'price_desc':
        sort = { price: -1 }
        break
      case 'name_asc':
        sort = { name: 1 }
        break
      case 'name_desc':
        sort = { name: -1 }
        break
      case 'newest':
        sort = { createdAt: -1 }
        break
      case 'rating':
        sort = { rating: -1 }
        break
      default:
        sort = { createdAt: -1 }
    }

    // Pagination
    const pageNum = parseInt(page)
    const perPage = parseInt(per_page)
    const skip = (pageNum - 1) * perPage

    // Execute query
    const products = await Product.find(filter)
      .populate('category', 'name slug')
      .sort(sort)
      .skip(skip)
      .limit(perPage)

    // Get total count for pagination
    const total = await Product.countDocuments(filter)
    const totalPages = Math.ceil(total / perPage)

    response.status(200).json({
      success: true,
      data: {
        products,
        pagination: {
          current_page: pageNum,
          per_page: perPage,
          total,
          total_pages: totalPages,
          has_next: pageNum < totalPages,
          has_prev: pageNum > 1
        }
      }
    })
  } catch (error) {
    response.status(500).json({
      error: 'Failed to fetch products'
    })
  }
})

// GET /api/products/:id - Get single product by ID
productsRouter.get('/:id', async (request, response) => {
  try {
    const product = await Product.findById(request.params.id)
      .populate('category', 'name slug description')

    if (!product) {
      return response.status(404).json({
        error: 'Product not found'
      })
    }

    response.status(200).json({
      success: true,
      data: { product }
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
    sku,
    category,
    price,
    originalPrice,
    image,
    images,
    description,
    detailDescription,
    vendor,
    stock,
    rating,
    reviewCount,
    type,
    tags,
    mfgDate,
    shelfLife,
    isFeatured
  } = request.body

  // Validation (SKU and description are optional, will be auto-generated/defaulted)
  if (!name || !category || !price || !image || !vendor) {
    return response.status(400).json({
      error: 'Required fields: name, category, price, image, vendor'
    })
  }

  try {
    // Verify category exists
    const categoryExists = await Category.findById(category)
    if (!categoryExists) {
      return response.status(400).json({
        error: 'Category not found'
      })
    }

    // Generate SKU if not provided
    let generatedSku = sku ? sku.toUpperCase() : null
    if (!generatedSku) {
      // Generate SKU: First 3 letters of name + random 5-digit number
      const namePrefix = name.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X')
      const randomNum = Math.floor(10000 + Math.random() * 90000)
      generatedSku = `${namePrefix}${randomNum}`

      // Check if SKU already exists, regenerate if needed
      let skuExists = await Product.findOne({ sku: generatedSku })
      while (skuExists) {
        const newRandomNum = Math.floor(10000 + Math.random() * 90000)
        generatedSku = `${namePrefix}${newRandomNum}`
        skuExists = await Product.findOne({ sku: generatedSku })
      }
    }

    // Create product
    const product = new Product({
      name,
      sku: generatedSku,
      category,
      price,
      originalPrice,
      image,
      images,
      description,
      detailDescription,
      vendor,
      stock: stock || 0,
      rating: rating || 0,
      reviewCount: reviewCount || 0,
      type,
      tags,
      mfgDate,
      shelfLife,
      isFeatured: isFeatured || false,
      isActive: true
    })

    const savedProduct = await product.save()
    await savedProduct.populate('category', 'name slug')

    response.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: { product: savedProduct }
    })
  } catch (error) {
    if (error.name === 'ValidationError') {
      return response.status(400).json({
        error: error.message
      })
    }
    if (error.code === 11000) {
      return response.status(400).json({
        error: 'SKU already exists'
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
    price,
    originalPrice,
    image,
    images,
    description,
    detailDescription,
    vendor,
    stock,
    rating,
    reviewCount,
    type,
    tags,
    mfgDate,
    shelfLife,
    isFeatured,
    isActive
  } = request.body

  // Note: SKU is intentionally excluded - it cannot be modified after creation

  try {
    // Verify category if provided
    if (category) {
      const categoryExists = await Category.findById(category)
      if (!categoryExists) {
        return response.status(400).json({
          error: 'Category not found'
        })
      }
    }

    // If trying to deactivate product, check stock first
    if (isActive === false) {
      const currentProduct = await Product.findById(request.params.id)
      if (currentProduct && currentProduct.stock > 0) {
        return response.status(400).json({
          error: 'Cannot deactivate product with stock. Please reduce stock to 0 first.',
          stock: currentProduct.stock
        })
      }
    }

    // Update product (SKU is excluded from update)
    const updatedProduct = await Product.findByIdAndUpdate(
      request.params.id,
      {
        name,
        category,
        price,
        originalPrice,
        image,
        images,
        description,
        detailDescription,
        vendor,
        stock,
        rating,
        reviewCount,
        type,
        tags,
        mfgDate,
        shelfLife,
        isFeatured,
        isActive
      },
      {
        new: true,
        runValidators: true,
        context: 'query'
      }
    ).populate('category', 'name slug')

    if (!updatedProduct) {
      return response.status(404).json({
        error: 'Product not found'
      })
    }

    response.status(200).json({
      success: true,
      message: 'Product updated successfully',
      data: { product: updatedProduct }
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

// DELETE /api/products/:id - Delete product (Admin only)
productsRouter.delete('/:id', userExtractor, isAdmin, async (request, response) => {
  try {
    // First, find the product to check status
    const product = await Product.findById(request.params.id)

    if (!product) {
      return response.status(404).json({
        error: 'Product not found'
      })
    }

    // Prevent deletion if product is still active
    if (product.isActive !== false) {
      return response.status(400).json({
        error: 'Cannot delete active product. Please deactivate the product first.',
        isActive: product.isActive
      })
    }

    // If product is inactive, proceed with deletion
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

// PATCH /api/products/:id/stock - Update stock quantity (Admin only)
productsRouter.patch('/:id/stock', userExtractor, isAdmin, async (request, response) => {
  const { stock } = request.body

  if (stock === undefined || stock < 0) {
    return response.status(400).json({
      error: 'Valid stock quantity is required'
    })
  }

  try {
    const product = await Product.findByIdAndUpdate(
      request.params.id,
      { stock },
      { new: true }
    )

    if (!product) {
      return response.status(404).json({
        error: 'Product not found'
      })
    }

    response.status(200).json({
      success: true,
      message: 'Stock updated successfully',
      data: { product }
    })
  } catch (error) {
    response.status(500).json({
      error: 'Failed to update stock'
    })
  }
})

module.exports = productsRouter
