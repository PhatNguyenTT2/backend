const purchaseOrdersRouter = require('express').Router()
const PurchaseOrder = require('../models/purchaseOrder')
const Supplier = require('../models/supplier')
const DetailPurchaseOrder = require('../models/detailPurchaseOrder')
const { userExtractor, isAdmin } = require('../utils/auth')

// GET /api/purchase-orders - Get all purchase orders
purchaseOrdersRouter.get('/', userExtractor, isAdmin, async (request, response) => {
  try {
    const {
      status,
      payment_status,
      supplier_id,
      start_date,
      end_date,
      with_details
    } = request.query

    // Build filter
    const filter = {}
    if (status) {
      filter.status = status
    }
    if (payment_status) {
      filter.paymentStatus = payment_status
    }
    if (supplier_id) {
      filter.supplier = supplier_id
    }
    if (start_date || end_date) {
      filter.orderDate = {}
      if (start_date) filter.orderDate.$gte = new Date(start_date)
      if (end_date) filter.orderDate.$lte = new Date(end_date)
    }

    let purchaseOrders

    // Get with details if requested
    if (with_details === 'true') {
      purchaseOrders = await PurchaseOrder.findWithDetails(filter)
    } else {
      purchaseOrders = await PurchaseOrder.find(filter)
        .populate('supplier', 'supplierCode companyName email phone')
        .populate('createdBy', 'fullName email')
        .sort({ orderDate: -1 })
    }

    const ordersData = purchaseOrders.map(order => ({
      id: order._id,
      poNumber: order.poNumber,
      supplier: order.supplier ? {
        id: order.supplier._id,
        supplierCode: order.supplier.supplierCode,
        companyName: order.supplier.companyName,
        email: order.supplier.email,
        phone: order.supplier.phone
      } : null,
      orderDate: order.orderDate,
      expectedDeliveryDate: order.expectedDeliveryDate,
      shippingFee: order.shippingFee,
      discountPercentage: order.discountPercentage,
      totalPrice: order.totalPrice,
      status: order.status,
      paymentStatus: order.paymentStatus,
      notes: order.notes,
      createdBy: order.createdBy ? {
        id: order.createdBy._id,
        fullName: order.createdBy.fullName,
        email: order.createdBy.email
      } : null,
      ...(with_details === 'true' && {
        subtotal: order.subtotal,
        discountAmount: order.discountAmount,
        details: order.details
      }),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt
    }))

    response.status(200).json({
      success: true,
      data: {
        purchaseOrders: ordersData
      }
    })
  } catch (error) {
    response.status(500).json({
      error: 'Failed to fetch purchase orders'
    })
  }
})

// GET /api/purchase-orders/stats/overview - Get purchase order statistics (Admin only)
purchaseOrdersRouter.get('/stats/overview', userExtractor, isAdmin, async (request, response) => {
  try {
    const { start_date, end_date, supplier_id } = request.query

    const stats = await PurchaseOrder.getStatistics({
      startDate: start_date,
      endDate: end_date,
      supplierId: supplier_id
    })

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

// GET /api/purchase-orders/:id - Get single purchase order
purchaseOrdersRouter.get('/:id', userExtractor, isAdmin, async (request, response) => {
  try {
    const purchaseOrder = await PurchaseOrder.findById(request.params.id)
      .populate('supplier', 'supplierCode companyName email phone address')
      .populate('createdBy', 'fullName email')
      .populate({
        path: 'details',
        populate: {
          path: 'product',
          select: 'productCode name vendor originalPrice'
        }
      })

    if (!purchaseOrder) {
      return response.status(404).json({
        error: 'Purchase order not found'
      })
    }

    // Get calculated totals
    const calculatedTotals = await purchaseOrder.getCalculatedTotals()

    response.status(200).json({
      success: true,
      data: {
        purchaseOrder: {
          id: purchaseOrder._id,
          poNumber: purchaseOrder.poNumber,
          supplier: purchaseOrder.supplier ? {
            id: purchaseOrder.supplier._id,
            supplierCode: purchaseOrder.supplier.supplierCode,
            companyName: purchaseOrder.supplier.companyName,
            email: purchaseOrder.supplier.email,
            phone: purchaseOrder.supplier.phone,
            address: purchaseOrder.supplier.address
          } : null,
          orderDate: purchaseOrder.orderDate,
          expectedDeliveryDate: purchaseOrder.expectedDeliveryDate,
          shippingFee: purchaseOrder.shippingFee,
          discountPercentage: purchaseOrder.discountPercentage,
          totalPrice: purchaseOrder.totalPrice,
          status: purchaseOrder.status,
          paymentStatus: purchaseOrder.paymentStatus,
          notes: purchaseOrder.notes,
          createdBy: purchaseOrder.createdBy ? {
            id: purchaseOrder.createdBy._id,
            fullName: purchaseOrder.createdBy.fullName,
            email: purchaseOrder.createdBy.email
          } : null,
          subtotal: calculatedTotals.subtotal,
          discountAmount: calculatedTotals.discountAmount,
          calculatedTotal: calculatedTotals.total,
          details: calculatedTotals.details.map(detail => ({
            id: detail._id,
            product: detail.product ? {
              id: detail.product._id,
              productCode: detail.product.productCode,
              name: detail.product.name,
              vendor: detail.product.vendor,
              originalPrice: detail.product.originalPrice
            } : null,
            quantity: detail.quantity,
            unitPrice: detail.unitPrice,
            total: detail.total
          })),
          createdAt: purchaseOrder.createdAt,
          updatedAt: purchaseOrder.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid purchase order ID'
      })
    }
    response.status(500).json({
      error: 'Failed to fetch purchase order'
    })
  }
})

// POST /api/purchase-orders - Create new purchase order (Admin only)
purchaseOrdersRouter.post('/', userExtractor, isAdmin, async (request, response) => {
  const {
    supplierId,
    orderDate,
    expectedDeliveryDate,
    shippingFee,
    discountPercentage,
    notes
  } = request.body

  if (!supplierId) {
    return response.status(400).json({
      error: 'Supplier ID is required'
    })
  }

  try {
    // Verify supplier exists and is active
    const supplier = await Supplier.findById(supplierId)
    if (!supplier) {
      return response.status(400).json({
        error: 'Supplier not found'
      })
    }
    if (!supplier.isActive) {
      return response.status(400).json({
        error: 'Cannot create purchase order for inactive supplier'
      })
    }

    const purchaseOrder = new PurchaseOrder({
      supplier: supplierId,
      orderDate: orderDate || new Date(),
      expectedDeliveryDate,
      shippingFee: shippingFee || 0,
      discountPercentage: discountPercentage || 0,
      totalPrice: 0, // Will be calculated when items are added
      status: 'pending',
      paymentStatus: 'unpaid',
      notes,
      createdBy: request.user.employeeId || null
    })

    const savedOrder = await purchaseOrder.save()
    await savedOrder.populate('supplier', 'supplierCode companyName email phone')
    await savedOrder.populate('createdBy', 'fullName email')

    response.status(201).json({
      success: true,
      message: 'Purchase order created successfully',
      data: {
        purchaseOrder: {
          id: savedOrder._id,
          poNumber: savedOrder.poNumber,
          supplier: savedOrder.supplier ? {
            id: savedOrder.supplier._id,
            supplierCode: savedOrder.supplier.supplierCode,
            companyName: savedOrder.supplier.companyName,
            email: savedOrder.supplier.email,
            phone: savedOrder.supplier.phone
          } : null,
          orderDate: savedOrder.orderDate,
          expectedDeliveryDate: savedOrder.expectedDeliveryDate,
          shippingFee: savedOrder.shippingFee,
          discountPercentage: savedOrder.discountPercentage,
          totalPrice: savedOrder.totalPrice,
          status: savedOrder.status,
          paymentStatus: savedOrder.paymentStatus,
          notes: savedOrder.notes,
          createdBy: savedOrder.createdBy ? {
            id: savedOrder.createdBy._id,
            fullName: savedOrder.createdBy.fullName,
            email: savedOrder.createdBy.email
          } : null,
          createdAt: savedOrder.createdAt
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
      error: 'Failed to create purchase order'
    })
  }
})

// PUT /api/purchase-orders/:id - Update purchase order (Admin only)
purchaseOrdersRouter.put('/:id', userExtractor, isAdmin, async (request, response) => {
  const {
    expectedDeliveryDate,
    shippingFee,
    discountPercentage,
    notes
  } = request.body

  try {
    const purchaseOrder = await PurchaseOrder.findById(request.params.id)

    if (!purchaseOrder) {
      return response.status(404).json({
        error: 'Purchase order not found'
      })
    }

    // Only allow updates for pending or approved orders
    if (purchaseOrder.status === 'received' || purchaseOrder.status === 'cancelled') {
      return response.status(400).json({
        error: 'Cannot update received or cancelled purchase orders'
      })
    }

    // Update fields
    if (expectedDeliveryDate !== undefined) purchaseOrder.expectedDeliveryDate = expectedDeliveryDate
    if (shippingFee !== undefined) purchaseOrder.shippingFee = shippingFee
    if (discountPercentage !== undefined) purchaseOrder.discountPercentage = discountPercentage
    if (notes !== undefined) purchaseOrder.notes = notes

    // Recalculate total price if shipping or discount changed
    if (shippingFee !== undefined || discountPercentage !== undefined) {
      await purchaseOrder.recalculateTotalPrice()
    } else {
      await purchaseOrder.save()
    }

    await purchaseOrder.populate('supplier', 'supplierCode companyName')

    response.status(200).json({
      success: true,
      message: 'Purchase order updated successfully',
      data: {
        purchaseOrder: {
          id: purchaseOrder._id,
          poNumber: purchaseOrder.poNumber,
          supplier: purchaseOrder.supplier ? {
            id: purchaseOrder.supplier._id,
            supplierCode: purchaseOrder.supplier.supplierCode,
            companyName: purchaseOrder.supplier.companyName
          } : null,
          expectedDeliveryDate: purchaseOrder.expectedDeliveryDate,
          shippingFee: purchaseOrder.shippingFee,
          discountPercentage: purchaseOrder.discountPercentage,
          totalPrice: purchaseOrder.totalPrice,
          status: purchaseOrder.status,
          notes: purchaseOrder.notes,
          updatedAt: purchaseOrder.updatedAt
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
        error: 'Invalid purchase order ID'
      })
    }
    response.status(500).json({
      error: 'Failed to update purchase order'
    })
  }
})

// PATCH /api/purchase-orders/:id/approve - Approve purchase order (Admin only)
purchaseOrdersRouter.patch('/:id/approve', userExtractor, isAdmin, async (request, response) => {
  try {
    const purchaseOrder = await PurchaseOrder.findById(request.params.id)

    if (!purchaseOrder) {
      return response.status(404).json({
        error: 'Purchase order not found'
      })
    }

    // Use the approve method from the model
    const updatedOrder = await purchaseOrder.approve()

    response.status(200).json({
      success: true,
      message: 'Purchase order approved successfully',
      data: {
        purchaseOrder: {
          id: updatedOrder._id,
          poNumber: updatedOrder.poNumber,
          status: updatedOrder.status,
          updatedAt: updatedOrder.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.message === 'Only pending purchase orders can be approved') {
      return response.status(400).json({
        error: error.message
      })
    }
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid purchase order ID'
      })
    }
    response.status(500).json({
      error: 'Failed to approve purchase order'
    })
  }
})

// PATCH /api/purchase-orders/:id/receive - Mark purchase order as received (Admin only)
purchaseOrdersRouter.patch('/:id/receive', userExtractor, isAdmin, async (request, response) => {
  try {
    const purchaseOrder = await PurchaseOrder.findById(request.params.id)

    if (!purchaseOrder) {
      return response.status(404).json({
        error: 'Purchase order not found'
      })
    }

    // Use the markAsReceived method from the model
    const updatedOrder = await purchaseOrder.markAsReceived()

    response.status(200).json({
      success: true,
      message: 'Purchase order marked as received successfully',
      data: {
        purchaseOrder: {
          id: updatedOrder._id,
          poNumber: updatedOrder.poNumber,
          status: updatedOrder.status,
          updatedAt: updatedOrder.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.message === 'Only approved purchase orders can be marked as received') {
      return response.status(400).json({
        error: error.message
      })
    }
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid purchase order ID'
      })
    }
    response.status(500).json({
      error: 'Failed to mark purchase order as received'
    })
  }
})

// PATCH /api/purchase-orders/:id/cancel - Cancel purchase order (Admin only)
purchaseOrdersRouter.patch('/:id/cancel', userExtractor, isAdmin, async (request, response) => {
  try {
    const purchaseOrder = await PurchaseOrder.findById(request.params.id)

    if (!purchaseOrder) {
      return response.status(404).json({
        error: 'Purchase order not found'
      })
    }

    // Use the cancel method from the model
    const updatedOrder = await purchaseOrder.cancel()

    response.status(200).json({
      success: true,
      message: 'Purchase order cancelled successfully',
      data: {
        purchaseOrder: {
          id: updatedOrder._id,
          poNumber: updatedOrder.poNumber,
          status: updatedOrder.status,
          updatedAt: updatedOrder.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.message === 'Cannot cancel received purchase orders') {
      return response.status(400).json({
        error: error.message
      })
    }
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid purchase order ID'
      })
    }
    response.status(500).json({
      error: 'Failed to cancel purchase order'
    })
  }
})

// PATCH /api/purchase-orders/:id/payment-status - Update payment status (Admin only)
purchaseOrdersRouter.patch('/:id/payment-status', userExtractor, isAdmin, async (request, response) => {
  const { paidAmount } = request.body

  if (paidAmount === undefined || paidAmount < 0) {
    return response.status(400).json({
      error: 'Valid paid amount is required'
    })
  }

  try {
    const purchaseOrder = await PurchaseOrder.findById(request.params.id)

    if (!purchaseOrder) {
      return response.status(404).json({
        error: 'Purchase order not found'
      })
    }

    // Use the updatePaymentStatus method from the model
    const updatedOrder = await purchaseOrder.updatePaymentStatus(parseFloat(paidAmount))

    response.status(200).json({
      success: true,
      message: 'Payment status updated successfully',
      data: {
        purchaseOrder: {
          id: updatedOrder._id,
          poNumber: updatedOrder.poNumber,
          totalPrice: updatedOrder.totalPrice,
          paymentStatus: updatedOrder.paymentStatus,
          paidAmount: parseFloat(paidAmount),
          updatedAt: updatedOrder.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid purchase order ID'
      })
    }
    response.status(500).json({
      error: 'Failed to update payment status'
    })
  }
})

// PATCH /api/purchase-orders/:id/recalculate - Recalculate total price (Admin only)
purchaseOrdersRouter.patch('/:id/recalculate', userExtractor, isAdmin, async (request, response) => {
  try {
    const purchaseOrder = await PurchaseOrder.findById(request.params.id)

    if (!purchaseOrder) {
      return response.status(404).json({
        error: 'Purchase order not found'
      })
    }

    // Use the recalculateTotalPrice method from the model
    const updatedOrder = await purchaseOrder.recalculateTotalPrice()

    response.status(200).json({
      success: true,
      message: 'Total price recalculated successfully',
      data: {
        purchaseOrder: {
          id: updatedOrder._id,
          poNumber: updatedOrder.poNumber,
          totalPrice: updatedOrder.totalPrice,
          updatedAt: updatedOrder.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid purchase order ID'
      })
    }
    response.status(500).json({
      error: 'Failed to recalculate total price'
    })
  }
})

// DELETE /api/purchase-orders/:id - Delete purchase order (Admin only)
purchaseOrdersRouter.delete('/:id', userExtractor, isAdmin, async (request, response) => {
  try {
    const purchaseOrder = await PurchaseOrder.findById(request.params.id)

    if (!purchaseOrder) {
      return response.status(404).json({
        error: 'Purchase order not found'
      })
    }

    // Only allow deletion of pending or cancelled orders
    if (purchaseOrder.status === 'approved' || purchaseOrder.status === 'received') {
      return response.status(400).json({
        error: 'Cannot delete approved or received purchase orders'
      })
    }

    // Delete associated detail purchase orders
    await DetailPurchaseOrder.deleteMany({ purchaseOrder: request.params.id })

    await PurchaseOrder.findByIdAndDelete(request.params.id)

    response.status(200).json({
      success: true,
      message: 'Purchase order deleted successfully'
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid purchase order ID'
      })
    }
    response.status(500).json({
      error: 'Failed to delete purchase order'
    })
  }
})

module.exports = purchaseOrdersRouter
