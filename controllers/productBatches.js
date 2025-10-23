const productBatchesRouter = require('express').Router()
const ProductBatch = require('../models/productBatch')
const Product = require('../models/product')
const { userExtractor, isAdmin } = require('../utils/auth')

// GET /api/product-batches - Get all product batches
productBatchesRouter.get('/', userExtractor, isAdmin, async (request, response) => {
  try {
    const { product_id, status, near_expiry, expired } = request.query

    // Build filter
    const filter = {}
    if (product_id) {
      filter.product = product_id
    }
    if (status) {
      filter.status = status
    }

    let batches

    // Get near expiry batches
    if (near_expiry === 'true') {
      const days = request.query.days ? parseInt(request.query.days) : 30
      batches = await ProductBatch.findNearExpiryBatches(days)
    }
    // Get expired batches
    else if (expired === 'true') {
      batches = await ProductBatch.findExpiredBatches()
    }
    // Get all batches with filter
    else {
      batches = await ProductBatch.find(filter)
        .populate('product', 'productCode name vendor category')
        .sort({ createdAt: -1 })
    }

    const batchesData = batches.map(batch => ({
      id: batch._id,
      product: batch.product ? {
        id: batch.product._id,
        productCode: batch.product.productCode,
        name: batch.product.name,
        vendor: batch.product.vendor
      } : null,
      batchCode: batch.batchCode,
      mfgDate: batch.mfgDate,
      expiryDate: batch.expiryDate,
      quantity: batch.quantity,
      status: batch.status,
      notes: batch.notes,
      isExpired: batch.isExpired,
      daysUntilExpiry: batch.daysUntilExpiry,
      isNearExpiry: batch.isNearExpiry,
      createdAt: batch.createdAt,
      updatedAt: batch.updatedAt
    }))

    response.status(200).json({
      success: true,
      data: {
        batches: batchesData
      }
    })
  } catch (error) {
    response.status(500).json({
      error: 'Failed to fetch product batches'
    })
  }
})

// GET /api/product-batches/stats/overview - Get batch statistics (Admin only)
productBatchesRouter.get('/stats/overview', userExtractor, isAdmin, async (request, response) => {
  try {
    const stats = await ProductBatch.getStatistics()

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

// GET /api/product-batches/expired - Get expired batches (Admin only)
productBatchesRouter.get('/expired', userExtractor, isAdmin, async (request, response) => {
  try {
    const expiredBatches = await ProductBatch.findExpiredBatches()

    const batchesData = expiredBatches.map(batch => ({
      id: batch._id,
      product: batch.product ? {
        id: batch.product._id,
        productCode: batch.product.productCode,
        name: batch.product.name
      } : null,
      batchCode: batch.batchCode,
      expiryDate: batch.expiryDate,
      quantity: batch.quantity,
      status: batch.status,
      daysUntilExpiry: batch.daysUntilExpiry
    }))

    response.status(200).json({
      success: true,
      data: {
        expiredBatches: batchesData
      }
    })
  } catch (error) {
    response.status(500).json({
      error: 'Failed to fetch expired batches'
    })
  }
})

// GET /api/product-batches/near-expiry - Get near expiry batches (Admin only)
productBatchesRouter.get('/near-expiry', userExtractor, isAdmin, async (request, response) => {
  try {
    const { days } = request.query
    const daysParam = days ? parseInt(days) : 30

    const nearExpiryBatches = await ProductBatch.findNearExpiryBatches(daysParam)

    const batchesData = nearExpiryBatches.map(batch => ({
      id: batch._id,
      product: batch.product ? {
        id: batch.product._id,
        productCode: batch.product.productCode,
        name: batch.product.name
      } : null,
      batchCode: batch.batchCode,
      expiryDate: batch.expiryDate,
      quantity: batch.quantity,
      status: batch.status,
      daysUntilExpiry: batch.daysUntilExpiry
    }))

    response.status(200).json({
      success: true,
      data: {
        nearExpiryBatches: batchesData
      }
    })
  } catch (error) {
    response.status(500).json({
      error: 'Failed to fetch near expiry batches'
    })
  }
})

// GET /api/product-batches/product/:productId/active - Get active batches by product
productBatchesRouter.get('/product/:productId/active', userExtractor, async (request, response) => {
  try {
    const batches = await ProductBatch.findActiveByProduct(request.params.productId)

    const batchesData = batches.map(batch => ({
      id: batch._id,
      batchCode: batch.batchCode,
      mfgDate: batch.mfgDate,
      expiryDate: batch.expiryDate,
      quantity: batch.quantity,
      status: batch.status,
      isExpired: batch.isExpired,
      daysUntilExpiry: batch.daysUntilExpiry,
      isNearExpiry: batch.isNearExpiry,
      createdAt: batch.createdAt
    }))

    response.status(200).json({
      success: true,
      data: {
        batches: batchesData
      }
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid product ID'
      })
    }
    response.status(500).json({
      error: 'Failed to fetch active batches'
    })
  }
})

// GET /api/product-batches/:id - Get single batch
productBatchesRouter.get('/:id', userExtractor, isAdmin, async (request, response) => {
  try {
    const batch = await ProductBatch.findById(request.params.id)
      .populate('product', 'productCode name vendor category originalPrice')

    if (!batch) {
      return response.status(404).json({
        error: 'Batch not found'
      })
    }

    response.status(200).json({
      success: true,
      data: {
        batch: {
          id: batch._id,
          product: batch.product ? {
            id: batch.product._id,
            productCode: batch.product.productCode,
            name: batch.product.name,
            vendor: batch.product.vendor,
            originalPrice: batch.product.originalPrice
          } : null,
          batchCode: batch.batchCode,
          mfgDate: batch.mfgDate,
          expiryDate: batch.expiryDate,
          quantity: batch.quantity,
          status: batch.status,
          notes: batch.notes,
          isExpired: batch.isExpired,
          daysUntilExpiry: batch.daysUntilExpiry,
          isNearExpiry: batch.isNearExpiry,
          createdAt: batch.createdAt,
          updatedAt: batch.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid batch ID'
      })
    }
    response.status(500).json({
      error: 'Failed to fetch batch'
    })
  }
})

// POST /api/product-batches - Create new batch (Admin only)
productBatchesRouter.post('/', userExtractor, isAdmin, async (request, response) => {
  const {
    productId,
    batchCode,
    mfgDate,
    expiryDate,
    quantity,
    notes
  } = request.body

  if (!productId) {
    return response.status(400).json({
      error: 'Product ID is required'
    })
  }

  if (!batchCode) {
    return response.status(400).json({
      error: 'Batch code is required'
    })
  }

  if (!quantity || quantity <= 0) {
    return response.status(400).json({
      error: 'Valid quantity is required'
    })
  }

  try {
    // Use the createBatchAndUpdateStock method from the model (includes transaction)
    const batch = await ProductBatch.createBatchAndUpdateStock({
      product: productId,
      batchCode: batchCode.toUpperCase(),
      mfgDate,
      expiryDate,
      quantity,
      notes,
      status: 'active'
    })

    await batch.populate('product', 'productCode name vendor')

    response.status(201).json({
      success: true,
      message: 'Product batch created successfully',
      data: {
        batch: {
          id: batch._id,
          product: batch.product ? {
            id: batch.product._id,
            productCode: batch.product.productCode,
            name: batch.product.name,
            vendor: batch.product.vendor
          } : null,
          batchCode: batch.batchCode,
          mfgDate: batch.mfgDate,
          expiryDate: batch.expiryDate,
          quantity: batch.quantity,
          status: batch.status,
          notes: batch.notes,
          createdAt: batch.createdAt
        }
      }
    })
  } catch (error) {
    if (error.message === 'Product not found') {
      return response.status(400).json({
        error: 'Product not found'
      })
    }
    if (error.message === 'Batch code already exists') {
      return response.status(400).json({
        error: 'Batch code already exists'
      })
    }
    if (error.name === 'ValidationError') {
      return response.status(400).json({
        error: error.message
      })
    }
    if (error.code === 11000) {
      return response.status(400).json({
        error: 'Batch code already exists'
      })
    }
    response.status(500).json({
      error: 'Failed to create batch'
    })
  }
})

// PUT /api/product-batches/:id - Update batch (Admin only)
productBatchesRouter.put('/:id', userExtractor, isAdmin, async (request, response) => {
  const { mfgDate, expiryDate, notes } = request.body

  try {
    const batch = await ProductBatch.findById(request.params.id)

    if (!batch) {
      return response.status(404).json({
        error: 'Batch not found'
      })
    }

    // Update fields (only non-critical fields)
    if (mfgDate !== undefined) batch.mfgDate = mfgDate
    if (expiryDate !== undefined) batch.expiryDate = expiryDate
    if (notes !== undefined) batch.notes = notes

    const updatedBatch = await batch.save()
    await updatedBatch.populate('product', 'productCode name')

    response.status(200).json({
      success: true,
      message: 'Batch updated successfully',
      data: {
        batch: {
          id: updatedBatch._id,
          product: updatedBatch.product ? {
            id: updatedBatch.product._id,
            productCode: updatedBatch.product.productCode,
            name: updatedBatch.product.name
          } : null,
          batchCode: updatedBatch.batchCode,
          mfgDate: updatedBatch.mfgDate,
          expiryDate: updatedBatch.expiryDate,
          quantity: updatedBatch.quantity,
          status: updatedBatch.status,
          notes: updatedBatch.notes,
          updatedAt: updatedBatch.updatedAt
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
        error: 'Invalid batch ID'
      })
    }
    response.status(500).json({
      error: 'Failed to update batch'
    })
  }
})

// PATCH /api/product-batches/:id/quantity - Update batch quantity (Admin only)
productBatchesRouter.patch('/:id/quantity', userExtractor, isAdmin, async (request, response) => {
  const { quantity } = request.body

  if (quantity === undefined || quantity < 0) {
    return response.status(400).json({
      error: 'Valid quantity is required'
    })
  }

  try {
    const batch = await ProductBatch.findById(request.params.id)

    if (!batch) {
      return response.status(404).json({
        error: 'Batch not found'
      })
    }

    if (batch.status !== 'active') {
      return response.status(400).json({
        error: 'Cannot update quantity of non-active batch'
      })
    }

    // Use the updateQuantity method from the model
    const updatedBatch = await batch.updateQuantity(quantity)

    response.status(200).json({
      success: true,
      message: 'Batch quantity updated successfully',
      data: {
        batch: {
          id: updatedBatch._id,
          batchCode: updatedBatch.batchCode,
          quantity: updatedBatch.quantity,
          updatedAt: updatedBatch.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid batch ID'
      })
    }
    response.status(500).json({
      error: 'Failed to update quantity'
    })
  }
})

// PATCH /api/product-batches/:id/dispose - Dispose batch (Admin only)
productBatchesRouter.patch('/:id/dispose', userExtractor, isAdmin, async (request, response) => {
  const { reason } = request.body

  try {
    const batch = await ProductBatch.findById(request.params.id)

    if (!batch) {
      return response.status(404).json({
        error: 'Batch not found'
      })
    }

    if (batch.status === 'disposed') {
      return response.status(400).json({
        error: 'Batch is already disposed'
      })
    }

    // Use the dispose method from the model
    const updatedBatch = await batch.dispose(reason)
    await updatedBatch.populate('product', 'productCode name')

    response.status(200).json({
      success: true,
      message: 'Batch disposed successfully',
      data: {
        batch: {
          id: updatedBatch._id,
          product: updatedBatch.product ? {
            id: updatedBatch.product._id,
            productCode: updatedBatch.product.productCode,
            name: updatedBatch.product.name
          } : null,
          batchCode: updatedBatch.batchCode,
          quantity: updatedBatch.quantity,
          status: updatedBatch.status,
          notes: updatedBatch.notes,
          updatedAt: updatedBatch.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid batch ID'
      })
    }
    response.status(500).json({
      error: 'Failed to dispose batch'
    })
  }
})

// PATCH /api/product-batches/:id/mark-expired - Mark batch as expired (Admin only)
productBatchesRouter.patch('/:id/mark-expired', userExtractor, isAdmin, async (request, response) => {
  try {
    const batch = await ProductBatch.findById(request.params.id)

    if (!batch) {
      return response.status(404).json({
        error: 'Batch not found'
      })
    }

    if (batch.status === 'expired') {
      return response.status(400).json({
        error: 'Batch is already marked as expired'
      })
    }

    // Use the markAsExpired method from the model
    const updatedBatch = await batch.markAsExpired()

    response.status(200).json({
      success: true,
      message: 'Batch marked as expired successfully',
      data: {
        batch: {
          id: updatedBatch._id,
          batchCode: updatedBatch.batchCode,
          status: updatedBatch.status,
          updatedAt: updatedBatch.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid batch ID'
      })
    }
    response.status(500).json({
      error: 'Failed to mark batch as expired'
    })
  }
})

// POST /api/product-batches/auto-expire - Auto-expire batches (Admin only)
productBatchesRouter.post('/auto-expire', userExtractor, isAdmin, async (request, response) => {
  try {
    const result = await ProductBatch.autoExpireBatches()

    response.status(200).json({
      success: true,
      message: 'Auto-expire completed successfully',
      data: {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount
      }
    })
  } catch (error) {
    response.status(500).json({
      error: 'Failed to auto-expire batches'
    })
  }
})

// DELETE /api/product-batches/:id - Delete batch (Admin only)
productBatchesRouter.delete('/:id', userExtractor, isAdmin, async (request, response) => {
  try {
    const batch = await ProductBatch.findById(request.params.id)

    if (!batch) {
      return response.status(404).json({
        error: 'Batch not found'
      })
    }

    // Only allow deletion of disposed batches or batches with 0 quantity
    if (batch.status !== 'disposed' && batch.quantity > 0) {
      return response.status(400).json({
        error: 'Can only delete disposed batches or batches with 0 quantity'
      })
    }

    await ProductBatch.findByIdAndDelete(request.params.id)

    response.status(200).json({
      success: true,
      message: 'Batch deleted successfully'
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid batch ID'
      })
    }
    response.status(500).json({
      error: 'Failed to delete batch'
    })
  }
})

module.exports = productBatchesRouter
