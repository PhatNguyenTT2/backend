const detailPurchaseOrdersRouter = require('express').Router()
const DetailPurchaseOrder = require('../models/detailPurchaseOrder')
const PurchaseOrder = require('../models/purchaseOrder')
const Product = require('../models/product')
const { userExtractor, isAdmin } = require('../utils/auth')

// GET /api/detail-purchase-orders - Get all detail purchase orders
detailPurchaseOrdersRouter.get('/', userExtractor, isAdmin, async (request, response) => {
  try {
    const { purchase_order_id, product_id } = request.query

    // Build filter
    const filter = {}
    if (purchase_order_id) {
      filter.purchaseOrder = purchase_order_id
    }
    if (product_id) {
      filter.product = product_id
    }

    const detailOrders = await DetailPurchaseOrder.find(filter)
      .populate('purchaseOrder', 'poNumber orderDate status')
      .populate('product', 'productCode name vendor costPrice')
      .sort({ createdAt: -1 })

    const detailsData = detailOrders.map(detail => ({
      id: detail._id,
      purchaseOrder: detail.purchaseOrder ? {
        id: detail.purchaseOrder._id,
        poNumber: detail.purchaseOrder.poNumber,
        orderDate: detail.purchaseOrder.orderDate,
        status: detail.purchaseOrder.status
      } : null,
      product: detail.product ? {
        id: detail.product._id,
        productCode: detail.product.productCode,
        name: detail.product.name,
        vendor: detail.product.vendor,
        costPrice: detail.product.costPrice
      } : null,
      quantity: detail.quantity,
      unitPrice: detail.unitPrice,
      total: detail.total,
      createdAt: detail.createdAt,
      updatedAt: detail.updatedAt
    }))

    response.status(200).json({
      success: true,
      data: {
        detailPurchaseOrders: detailsData
      }
    })
  } catch (error) {
    response.status(500).json({
      error: 'Failed to fetch detail purchase orders'
    })
  }
})

// GET /api/detail-purchase-orders/purchase-order/:poId - Get details by purchase order
detailPurchaseOrdersRouter.get('/purchase-order/:poId', userExtractor, isAdmin, async (request, response) => {
  try {
    const details = await DetailPurchaseOrder.getByPurchaseOrder(request.params.poId)

    const detailsData = details.map(detail => ({
      id: detail._id,
      product: detail.product ? {
        id: detail.product._id,
        productCode: detail.product.productCode,
        name: detail.product.name,
        vendor: detail.product.vendor,
        costPrice: detail.product.costPrice,
        image: detail.product.image
      } : null,
      quantity: detail.quantity,
      unitPrice: detail.unitPrice,
      total: detail.total,
      createdAt: detail.createdAt,
      updatedAt: detail.updatedAt
    }))

    response.status(200).json({
      success: true,
      data: {
        details: detailsData
      }
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid purchase order ID'
      })
    }
    response.status(500).json({
      error: 'Failed to fetch purchase order details'
    })
  }
})

// GET /api/detail-purchase-orders/purchase-order/:poId/product/:productId/total - Get total quantity by product
detailPurchaseOrdersRouter.get('/purchase-order/:poId/product/:productId/total', userExtractor, isAdmin, async (request, response) => {
  try {
    const totals = await DetailPurchaseOrder.getTotalQuantityByProduct(
      request.params.poId,
      request.params.productId
    )

    response.status(200).json({
      success: true,
      data: {
        totalQuantity: totals.totalQuantity,
        totalAmount: totals.totalAmount
      }
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid ID'
      })
    }
    response.status(500).json({
      error: 'Failed to get totals'
    })
  }
})

// GET /api/detail-purchase-orders/:id - Get single detail purchase order
detailPurchaseOrdersRouter.get('/:id', userExtractor, isAdmin, async (request, response) => {
  try {
    const detail = await DetailPurchaseOrder.findById(request.params.id)
      .populate('purchaseOrder', 'poNumber orderDate status supplier')
      .populate('product', 'productCode name vendor costPrice originalPrice')

    if (!detail) {
      return response.status(404).json({
        error: 'Detail purchase order not found'
      })
    }

    response.status(200).json({
      success: true,
      data: {
        detailPurchaseOrder: {
          id: detail._id,
          purchaseOrder: detail.purchaseOrder ? {
            id: detail.purchaseOrder._id,
            poNumber: detail.purchaseOrder.poNumber,
            orderDate: detail.purchaseOrder.orderDate,
            status: detail.purchaseOrder.status
          } : null,
          product: detail.product ? {
            id: detail.product._id,
            productCode: detail.product.productCode,
            name: detail.product.name,
            vendor: detail.product.vendor,
            costPrice: detail.product.costPrice,
            originalPrice: detail.product.originalPrice
          } : null,
          quantity: detail.quantity,
          unitPrice: detail.unitPrice,
          total: detail.total,
          createdAt: detail.createdAt,
          updatedAt: detail.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid detail purchase order ID'
      })
    }
    response.status(500).json({
      error: 'Failed to fetch detail purchase order'
    })
  }
})

// POST /api/detail-purchase-orders - Create new detail purchase order (Admin only)
detailPurchaseOrdersRouter.post('/', userExtractor, isAdmin, async (request, response) => {
  const { purchaseOrderId, productId, quantity, unitPrice, updateProductCost } = request.body

  if (!purchaseOrderId) {
    return response.status(400).json({
      error: 'Purchase order ID is required'
    })
  }

  if (!productId) {
    return response.status(400).json({
      error: 'Product ID is required'
    })
  }

  if (!quantity || quantity < 1) {
    return response.status(400).json({
      error: 'Valid quantity (minimum 1) is required'
    })
  }

  if (unitPrice === undefined || unitPrice < 0) {
    return response.status(400).json({
      error: 'Valid unit price is required'
    })
  }

  try {
    // Verify purchase order exists
    const purchaseOrder = await PurchaseOrder.findById(purchaseOrderId)
    if (!purchaseOrder) {
      return response.status(400).json({
        error: 'Purchase order not found'
      })
    }

    // Only allow adding items to pending or approved orders
    if (purchaseOrder.status === 'received' || purchaseOrder.status === 'cancelled') {
      return response.status(400).json({
        error: 'Cannot add items to received or cancelled purchase orders'
      })
    }

    // Verify product exists
    const product = await Product.findById(productId)
    if (!product) {
      return response.status(400).json({
        error: 'Product not found'
      })
    }

    // Check if product already exists in this purchase order
    const exists = await DetailPurchaseOrder.productExistsInPO(purchaseOrderId, productId)
    if (exists) {
      return response.status(400).json({
        error: 'Product already exists in this purchase order. Please update the existing item instead.'
      })
    }

    let detail

    // Use createDetailAndUpdateProduct if updateProductCost is true
    if (updateProductCost === true) {
      detail = await DetailPurchaseOrder.createDetailAndUpdateProduct({
        purchaseOrder: purchaseOrderId,
        product: productId,
        quantity,
        unitPrice
      })
    } else {
      // Create detail without updating product cost
      detail = new DetailPurchaseOrder({
        purchaseOrder: purchaseOrderId,
        product: productId,
        quantity,
        unitPrice
      })
      await detail.save()
    }

    await detail.populate('purchaseOrder', 'poNumber')
    await detail.populate('product', 'productCode name vendor')

    response.status(201).json({
      success: true,
      message: 'Detail purchase order created successfully',
      data: {
        detailPurchaseOrder: {
          id: detail._id,
          purchaseOrder: detail.purchaseOrder ? {
            id: detail.purchaseOrder._id,
            poNumber: detail.purchaseOrder.poNumber
          } : null,
          product: detail.product ? {
            id: detail.product._id,
            productCode: detail.product.productCode,
            name: detail.product.name,
            vendor: detail.product.vendor
          } : null,
          quantity: detail.quantity,
          unitPrice: detail.unitPrice,
          total: detail.total,
          createdAt: detail.createdAt
        }
      }
    })
  } catch (error) {
    if (error.name === 'ValidationError') {
      return response.status(400).json({
        error: error.message
      })
    }
    response.status(500).json({
      error: 'Failed to create detail purchase order'
    })
  }
})

// PUT /api/detail-purchase-orders/:id - Update detail purchase order (Admin only)
detailPurchaseOrdersRouter.put('/:id', userExtractor, isAdmin, async (request, response) => {
  const { quantity, unitPrice } = request.body

  try {
    const detail = await DetailPurchaseOrder.findById(request.params.id)
      .populate('purchaseOrder', 'status')

    if (!detail) {
      return response.status(404).json({
        error: 'Detail purchase order not found'
      })
    }

    // Only allow updates for pending or approved orders
    if (detail.purchaseOrder.status === 'received' || detail.purchaseOrder.status === 'cancelled') {
      return response.status(400).json({
        error: 'Cannot update items in received or cancelled purchase orders'
      })
    }

    // Update fields
    if (quantity !== undefined) {
      if (quantity < 1) {
        return response.status(400).json({
          error: 'Quantity must be at least 1'
        })
      }
      detail.quantity = quantity
    }

    if (unitPrice !== undefined) {
      if (unitPrice < 0) {
        return response.status(400).json({
          error: 'Unit price cannot be negative'
        })
      }
      detail.unitPrice = unitPrice
    }

    const updatedDetail = await detail.save()
    await updatedDetail.populate('product', 'productCode name')

    response.status(200).json({
      success: true,
      message: 'Detail purchase order updated successfully',
      data: {
        detailPurchaseOrder: {
          id: updatedDetail._id,
          product: updatedDetail.product ? {
            id: updatedDetail.product._id,
            productCode: updatedDetail.product.productCode,
            name: updatedDetail.product.name
          } : null,
          quantity: updatedDetail.quantity,
          unitPrice: updatedDetail.unitPrice,
          total: updatedDetail.total,
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
        error: 'Invalid detail purchase order ID'
      })
    }
    response.status(500).json({
      error: 'Failed to update detail purchase order'
    })
  }
})

// PATCH /api/detail-purchase-orders/:id/quantity - Update quantity (Admin only)
detailPurchaseOrdersRouter.patch('/:id/quantity', userExtractor, isAdmin, async (request, response) => {
  const { quantity } = request.body

  if (!quantity || quantity < 1) {
    return response.status(400).json({
      error: 'Valid quantity (minimum 1) is required'
    })
  }

  try {
    const detail = await DetailPurchaseOrder.findById(request.params.id)
      .populate('purchaseOrder', 'status')

    if (!detail) {
      return response.status(404).json({
        error: 'Detail purchase order not found'
      })
    }

    // Only allow updates for pending or approved orders
    if (detail.purchaseOrder.status === 'received' || detail.purchaseOrder.status === 'cancelled') {
      return response.status(400).json({
        error: 'Cannot update items in received or cancelled purchase orders'
      })
    }

    // Use the updateQuantity method from the model
    const updatedDetail = await detail.updateQuantity(quantity)

    response.status(200).json({
      success: true,
      message: 'Quantity updated successfully',
      data: {
        detailPurchaseOrder: {
          id: updatedDetail._id,
          quantity: updatedDetail.quantity,
          total: updatedDetail.total,
          updatedAt: updatedDetail.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.message === 'Quantity must be at least 1') {
      return response.status(400).json({
        error: error.message
      })
    }
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid detail purchase order ID'
      })
    }
    response.status(500).json({
      error: 'Failed to update quantity'
    })
  }
})

// PATCH /api/detail-purchase-orders/:id/unit-price - Update unit price (Admin only)
detailPurchaseOrdersRouter.patch('/:id/unit-price', userExtractor, isAdmin, async (request, response) => {
  const { unitPrice } = request.body

  if (unitPrice === undefined || unitPrice < 0) {
    return response.status(400).json({
      error: 'Valid unit price is required'
    })
  }

  try {
    const detail = await DetailPurchaseOrder.findById(request.params.id)
      .populate('purchaseOrder', 'status')

    if (!detail) {
      return response.status(404).json({
        error: 'Detail purchase order not found'
      })
    }

    // Only allow updates for pending or approved orders
    if (detail.purchaseOrder.status === 'received' || detail.purchaseOrder.status === 'cancelled') {
      return response.status(400).json({
        error: 'Cannot update items in received or cancelled purchase orders'
      })
    }

    // Use the updateUnitPrice method from the model
    const updatedDetail = await detail.updateUnitPrice(unitPrice)

    response.status(200).json({
      success: true,
      message: 'Unit price updated successfully',
      data: {
        detailPurchaseOrder: {
          id: updatedDetail._id,
          unitPrice: updatedDetail.unitPrice,
          total: updatedDetail.total,
          updatedAt: updatedDetail.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.message === 'Unit price cannot be negative') {
      return response.status(400).json({
        error: error.message
      })
    }
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid detail purchase order ID'
      })
    }
    response.status(500).json({
      error: 'Failed to update unit price'
    })
  }
})

// DELETE /api/detail-purchase-orders/:id - Delete detail purchase order (Admin only)
detailPurchaseOrdersRouter.delete('/:id', userExtractor, isAdmin, async (request, response) => {
  try {
    const detail = await DetailPurchaseOrder.findById(request.params.id)
      .populate('purchaseOrder', 'status')

    if (!detail) {
      return response.status(404).json({
        error: 'Detail purchase order not found'
      })
    }

    // Only allow deletion for pending or approved orders
    if (detail.purchaseOrder.status === 'received' || detail.purchaseOrder.status === 'cancelled') {
      return response.status(400).json({
        error: 'Cannot delete items from received or cancelled purchase orders'
      })
    }

    await DetailPurchaseOrder.findByIdAndDelete(request.params.id)

    response.status(200).json({
      success: true,
      message: 'Detail purchase order deleted successfully'
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid detail purchase order ID'
      })
    }
    response.status(500).json({
      error: 'Failed to delete detail purchase order'
    })
  }
})

module.exports = detailPurchaseOrdersRouter
