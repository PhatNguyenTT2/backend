const detailProductsRouter = require('express').Router()
const DetailProduct = require('../models/detailProduct')
const Product = require('../models/product')
const { userExtractor, isAdmin } = require('../utils/auth')

// GET /api/detail-products - Get all detail products
detailProductsRouter.get('/', userExtractor, isAdmin, async (request, response) => {
  try {
    const detailProducts = await DetailProduct.find()
      .populate('product', 'productCode name category vendor isActive')
      .sort({ createdAt: -1 })

    const detailProductsData = detailProducts.map(detail => ({
      id: detail._id,
      product: detail.product ? {
        id: detail.product._id,
        productCode: detail.product.productCode,
        name: detail.product.name,
        vendor: detail.product.vendor,
        isActive: detail.product.isActive
      } : null,
      image: detail.image,
      description: detail.description,
      createdAt: detail.createdAt,
      updatedAt: detail.updatedAt
    }))

    response.status(200).json({
      success: true,
      data: {
        detailProducts: detailProductsData
      }
    })
  } catch (error) {
    response.status(500).json({
      error: 'Failed to fetch detail products'
    })
  }
})

// GET /api/detail-products/product/:productId - Get detail by product ID
detailProductsRouter.get('/product/:productId', async (request, response) => {
  try {
    const detailProduct = await DetailProduct.findByProduct(request.params.productId)

    if (!detailProduct) {
      return response.status(404).json({
        error: 'Product detail not found'
      })
    }

    await detailProduct.populate('product', 'productCode name category vendor originalPrice sellPrice isActive')

    response.status(200).json({
      success: true,
      data: {
        detailProduct: {
          id: detailProduct._id,
          product: detailProduct.product ? {
            id: detailProduct.product._id,
            productCode: detailProduct.product.productCode,
            name: detailProduct.product.name,
            vendor: detailProduct.product.vendor,
            originalPrice: detailProduct.product.originalPrice,
            sellPrice: detailProduct.product.sellPrice,
            isActive: detailProduct.product.isActive
          } : null,
          image: detailProduct.image,
          description: detailProduct.description,
          createdAt: detailProduct.createdAt,
          updatedAt: detailProduct.updatedAt
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
      error: 'Failed to fetch product detail'
    })
  }
})

// GET /api/detail-products/:id - Get single detail product
detailProductsRouter.get('/:id', async (request, response) => {
  try {
    const detailProduct = await DetailProduct.findById(request.params.id)
      .populate('product', 'productCode name category vendor originalPrice sellPrice isActive')

    if (!detailProduct) {
      return response.status(404).json({
        error: 'Product detail not found'
      })
    }

    response.status(200).json({
      success: true,
      data: {
        detailProduct: {
          id: detailProduct._id,
          product: detailProduct.product ? {
            id: detailProduct.product._id,
            productCode: detailProduct.product.productCode,
            name: detailProduct.product.name,
            vendor: detailProduct.product.vendor,
            originalPrice: detailProduct.product.originalPrice,
            sellPrice: detailProduct.product.sellPrice,
            isActive: detailProduct.product.isActive
          } : null,
          image: detailProduct.image,
          description: detailProduct.description,
          createdAt: detailProduct.createdAt,
          updatedAt: detailProduct.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid detail product ID'
      })
    }
    response.status(500).json({
      error: 'Failed to fetch product detail'
    })
  }
})

// POST /api/detail-products - Create new detail product (Admin only)
detailProductsRouter.post('/', userExtractor, isAdmin, async (request, response) => {
  const { productId, image, description } = request.body

  if (!productId) {
    return response.status(400).json({
      error: 'Product ID is required'
    })
  }

  if (!image) {
    return response.status(400).json({
      error: 'Image is required'
    })
  }

  try {
    // Use the createWithProduct method from the model (includes transaction)
    const detailProduct = await DetailProduct.createWithProduct(productId, {
      image,
      description
    })

    await detailProduct.populate('product', 'productCode name vendor')

    response.status(201).json({
      success: true,
      message: 'Product detail created successfully',
      data: {
        detailProduct: {
          id: detailProduct._id,
          product: detailProduct.product ? {
            id: detailProduct.product._id,
            productCode: detailProduct.product.productCode,
            name: detailProduct.product.name,
            vendor: detailProduct.product.vendor
          } : null,
          image: detailProduct.image,
          description: detailProduct.description,
          createdAt: detailProduct.createdAt
        }
      }
    })
  } catch (error) {
    if (error.message === 'Product not found') {
      return response.status(400).json({
        error: 'Product not found'
      })
    }
    if (error.message === 'Product detail already exists') {
      return response.status(400).json({
        error: 'Product detail already exists'
      })
    }
    if (error.name === 'ValidationError') {
      return response.status(400).json({
        error: error.message
      })
    }
    if (error.code === 11000) {
      return response.status(400).json({
        error: 'Product detail already exists'
      })
    }
    response.status(500).json({
      error: 'Failed to create product detail'
    })
  }
})

// PUT /api/detail-products/:id - Update detail product (Admin only)
detailProductsRouter.put('/:id', userExtractor, isAdmin, async (request, response) => {
  const { image, description } = request.body

  try {
    const detailProduct = await DetailProduct.findById(request.params.id)

    if (!detailProduct) {
      return response.status(404).json({
        error: 'Product detail not found'
      })
    }

    // Use the updateDetails method from the model
    const updatedDetail = await detailProduct.updateDetails({
      image,
      description
    })

    await updatedDetail.populate('product', 'productCode name vendor')

    response.status(200).json({
      success: true,
      message: 'Product detail updated successfully',
      data: {
        detailProduct: {
          id: updatedDetail._id,
          product: updatedDetail.product ? {
            id: updatedDetail.product._id,
            productCode: updatedDetail.product.productCode,
            name: updatedDetail.product.name,
            vendor: updatedDetail.product.vendor
          } : null,
          image: updatedDetail.image,
          description: updatedDetail.description,
          updatedAt: updatedDetail.updatedAt
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
        error: 'Invalid detail product ID'
      })
    }
    response.status(500).json({
      error: 'Failed to update product detail'
    })
  }
})

// PATCH /api/detail-products/:id/image - Update product image (Admin only)
detailProductsRouter.patch('/:id/image', userExtractor, isAdmin, async (request, response) => {
  const { image } = request.body

  if (!image) {
    return response.status(400).json({
      error: 'Image URL is required'
    })
  }

  try {
    const detailProduct = await DetailProduct.findById(request.params.id)

    if (!detailProduct) {
      return response.status(404).json({
        error: 'Product detail not found'
      })
    }

    // Use the updateImage method from the model
    const updatedDetail = await detailProduct.updateImage(image)

    response.status(200).json({
      success: true,
      message: 'Product image updated successfully',
      data: {
        detailProduct: {
          id: updatedDetail._id,
          image: updatedDetail.image,
          updatedAt: updatedDetail.updatedAt
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
        error: 'Invalid detail product ID'
      })
    }
    response.status(500).json({
      error: 'Failed to update product image'
    })
  }
})

// PATCH /api/detail-products/:id/description - Update product description (Admin only)
detailProductsRouter.patch('/:id/description', userExtractor, isAdmin, async (request, response) => {
  const { description } = request.body

  if (description === undefined) {
    return response.status(400).json({
      error: 'Description is required'
    })
  }

  try {
    const detailProduct = await DetailProduct.findById(request.params.id)

    if (!detailProduct) {
      return response.status(404).json({
        error: 'Product detail not found'
      })
    }

    // Use the updateDescription method from the model
    const updatedDetail = await detailProduct.updateDescription(description)

    response.status(200).json({
      success: true,
      message: 'Product description updated successfully',
      data: {
        detailProduct: {
          id: updatedDetail._id,
          description: updatedDetail.description,
          updatedAt: updatedDetail.updatedAt
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
        error: 'Invalid detail product ID'
      })
    }
    response.status(500).json({
      error: 'Failed to update product description'
    })
  }
})

// POST /api/detail-products/bulk-update - Bulk update detail products (Admin only)
detailProductsRouter.post('/bulk-update', userExtractor, isAdmin, async (request, response) => {
  const { updates } = request.body

  if (!updates || !Array.isArray(updates) || updates.length === 0) {
    return response.status(400).json({
      error: 'Updates array is required'
    })
  }

  // Validate updates format
  for (const update of updates) {
    if (!update.productId || !update.data) {
      return response.status(400).json({
        error: 'Each update must have productId and data'
      })
    }
  }

  try {
    // Use the bulkUpdateDetails method from the model
    const result = await DetailProduct.bulkUpdateDetails(updates)

    response.status(200).json({
      success: true,
      message: 'Bulk update completed successfully',
      data: {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
        upsertedCount: result.upsertedCount
      }
    })
  } catch (error) {
    response.status(500).json({
      error: 'Failed to perform bulk update'
    })
  }
})

// DELETE /api/detail-products/:id - Delete detail product (Admin only)
detailProductsRouter.delete('/:id', userExtractor, isAdmin, async (request, response) => {
  try {
    const detailProduct = await DetailProduct.findById(request.params.id)

    if (!detailProduct) {
      return response.status(404).json({
        error: 'Product detail not found'
      })
    }

    await DetailProduct.findByIdAndDelete(request.params.id)

    response.status(200).json({
      success: true,
      message: 'Product detail deleted successfully'
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid detail product ID'
      })
    }
    response.status(500).json({
      error: 'Failed to delete product detail'
    })
  }
})

module.exports = detailProductsRouter
