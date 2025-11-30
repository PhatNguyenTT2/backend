const statisticsRouter = require('express').Router()
const Order = require('../models/order')
const OrderDetail = require('../models/orderDetail')
const PurchaseOrder = require('../models/purchaseOrder')
const DetailPurchaseOrder = require('../models/detailPurchaseOrder')
const Product = require('../models/product')
const ProductBatch = require('../models/productBatch')
const logger = require('../utils/logger')

/**
 * GET /api/statistics/sales
 * Get sales statistics aggregated by product
 * Query params: startDate, endDate, productId (optional), categoryId (optional)
 */
statisticsRouter.get('/sales', async (request, response) => {
  try {
    const { startDate, endDate, productId, categoryId } = request.query

    // Validate required parameters
    if (!startDate || !endDate) {
      return response.status(400).json({
        success: false,
        error: 'startDate and endDate are required'
      })
    }

    // Build query for orders
    const orderQuery = {
      orderDate: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      },
      status: 'delivered',
      paymentStatus: 'paid'
    }

    logger.info('Fetching sales statistics', { startDate, endDate, productId, categoryId })

    // Find all delivered and paid orders in date range
    const orders = await Order.find(orderQuery)
      .populate('customer', 'name phone')
      .populate('createdBy', 'name')
      .sort({ orderDate: -1 })

    if (orders.length === 0) {
      return response.json({
        success: true,
        data: {
          summary: {
            totalRevenue: 0,
            totalOrders: 0,
            totalQuantity: 0,
            totalProducts: 0,
            averageOrderValue: 0
          },
          products: []
        }
      })
    }

    const orderIds = orders.map(o => o._id)

    // Find all order details for these orders
    let orderDetailsQuery = { order: { $in: orderIds } }
    if (productId) {
      orderDetailsQuery.product = productId
    }

    const orderDetails = await OrderDetail.find(orderDetailsQuery)
      .populate({
        path: 'product',
        populate: { path: 'category', select: 'name' }
      })
      .populate('batch', 'batchCode unitPrice discountPercentage')

    // Filter by category if specified
    let filteredOrderDetails = orderDetails
    if (categoryId) {
      filteredOrderDetails = orderDetails.filter(
        detail => detail.product?.category?._id.toString() === categoryId
      )
    }

    // Map to organize data by product
    const productSalesMap = new Map()

    filteredOrderDetails.forEach(detail => {
      const product = detail.product
      const batch = detail.batch
      const order = orders.find(o => o._id.toString() === detail.order.toString())

      if (!product || !batch || !order) return

      const productId = product._id.toString()

      // Initialize product entry if not exists
      if (!productSalesMap.has(productId)) {
        productSalesMap.set(productId, {
          productId: product._id,
          productCode: product.productCode,
          productName: product.name,
          categoryName: product.category?.name || 'N/A',
          image: product.image,
          totalQuantity: 0,
          totalRevenue: 0,
          orderCount: new Set(),
          batches: new Map(),
          orders: []
        })
      }

      const productData = productSalesMap.get(productId)

      // Add to product totals
      productData.totalQuantity += detail.quantity
      productData.totalRevenue += detail.total
      productData.orderCount.add(order._id.toString())

      // Add to batch breakdown
      const batchId = batch._id.toString()
      if (!productData.batches.has(batchId)) {
        productData.batches.set(batchId, {
          batchId: batch._id,
          batchCode: batch.batchCode,
          quantitySold: 0,
          revenue: 0,
          unitPrice: batch.unitPrice,
          discountPercentage: batch.discountPercentage || 0,
          orderCount: new Set()
        })
      }

      const batchData = productData.batches.get(batchId)
      batchData.quantitySold += detail.quantity
      batchData.revenue += detail.total
      batchData.orderCount.add(order._id.toString())

      // Add order details for this product
      productData.orders.push({
        orderId: order._id,
        orderNumber: order.orderNumber,
        orderDate: order.orderDate,
        customerName: order.customer?.name || 'N/A',
        customerPhone: order.customer?.phone || 'N/A',
        status: order.status,
        quantitySold: detail.quantity,
        unitPrice: detail.unitPrice,
        subtotal: detail.total,
        batchCode: batch.batchCode
      })
    })

    // Format response - convert Map to Array
    const products = Array.from(productSalesMap.values()).map(data => ({
      productId: data.productId,
      productCode: data.productCode,
      productName: data.productName,
      categoryName: data.categoryName,
      image: data.image,
      totalQuantity: data.totalQuantity,
      totalRevenue: data.totalRevenue,
      totalOrders: data.orderCount.size,
      averagePrice: data.totalRevenue / data.totalQuantity,
      batches: Array.from(data.batches.values()).map(batch => ({
        batchId: batch.batchId,
        batchCode: batch.batchCode,
        quantitySold: batch.quantitySold,
        revenue: batch.revenue,
        unitPrice: batch.unitPrice,
        discountPercentage: batch.discountPercentage,
        orderCount: batch.orderCount.size
      })),
      orders: data.orders
    }))

    // Sort by total revenue descending
    products.sort((a, b) => b.totalRevenue - a.totalRevenue)

    // Calculate summary statistics
    const summary = {
      totalRevenue: products.reduce((sum, p) => sum + p.totalRevenue, 0),
      totalOrders: orders.length,
      totalQuantity: products.reduce((sum, p) => sum + p.totalQuantity, 0),
      totalProducts: products.length,
      averageOrderValue: orders.reduce((sum, o) => sum + o.total, 0) / orders.length
    }

    logger.info('Sales statistics calculated', {
      totalProducts: products.length,
      totalOrders: summary.totalOrders,
      totalRevenue: summary.totalRevenue
    })

    response.json({
      success: true,
      data: {
        summary,
        products
      }
    })
  } catch (error) {
    logger.error('Error getting sales statistics:', error)
    response.status(500).json({
      success: false,
      error: 'Failed to get sales statistics',
      message: error.message
    })
  }
})

/**
 * GET /api/statistics/purchases
 * Get purchase statistics aggregated by product
 * Query params: startDate, endDate, productId (optional), categoryId (optional), supplierId (optional)
 */
statisticsRouter.get('/purchases', async (request, response) => {
  try {
    const { startDate, endDate, productId, categoryId, supplierId } = request.query

    // Validate required parameters
    if (!startDate || !endDate) {
      return response.status(400).json({
        success: false,
        error: 'startDate and endDate are required'
      })
    }

    // Build query for purchase orders
    const poQuery = {
      orderDate: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      },
      status: 'received',
      paymentStatus: { $in: ['paid', 'partial', 'unpaid'] }
    }

    if (supplierId) {
      poQuery.supplier = supplierId
    }

    logger.info('Fetching purchase statistics', { startDate, endDate, productId, categoryId, supplierId })

    // Find all received purchase orders in date range
    const purchaseOrders = await PurchaseOrder.find(poQuery)
      .populate('supplier', 'companyName supplierCode contactPerson phone')
      .populate('createdBy', 'name')
      .sort({ orderDate: -1 })

    if (purchaseOrders.length === 0) {
      return response.json({
        success: true,
        data: {
          summary: {
            totalCost: 0,
            totalOrders: 0,
            totalQuantity: 0,
            totalProducts: 0,
            averageOrderValue: 0
          },
          products: []
        }
      })
    }

    const poIds = purchaseOrders.map(po => po._id)

    // Find all detail purchase orders for these POs
    let detailsQuery = { purchaseOrder: { $in: poIds } }
    if (productId) {
      detailsQuery.product = productId
    }

    const detailPurchaseOrders = await DetailPurchaseOrder.find(detailsQuery)
      .populate({
        path: 'product',
        populate: { path: 'category', select: 'name' }
      })
      .populate('batch', 'batchCode expiryDate')

    // Filter by category if specified
    let filteredDetails = detailPurchaseOrders
    if (categoryId) {
      filteredDetails = detailPurchaseOrders.filter(
        detail => detail.product?.category?._id.toString() === categoryId
      )
    }

    // Map to organize data by product
    const productPurchaseMap = new Map()

    filteredDetails.forEach(detail => {
      const product = detail.product
      const batch = detail.batch
      const po = purchaseOrders.find(p => p._id.toString() === detail.purchaseOrder.toString())

      if (!product || !po) return

      const productId = product._id.toString()

      // Initialize product entry if not exists
      if (!productPurchaseMap.has(productId)) {
        productPurchaseMap.set(productId, {
          productId: product._id,
          productCode: product.productCode,
          productName: product.name,
          categoryName: product.category?.name || 'N/A',
          image: product.image,
          totalQuantity: 0,
          totalCost: 0,
          orderCount: new Set(),
          batches: new Map(),
          purchaseOrders: []
        })
      }

      const productData = productPurchaseMap.get(productId)

      // Add to product totals
      productData.totalQuantity += detail.quantity
      productData.totalCost += detail.total
      productData.orderCount.add(po._id.toString())

      // Add to batch breakdown
      if (batch) {
        const batchId = batch._id.toString()
        if (!productData.batches.has(batchId)) {
          productData.batches.set(batchId, {
            batchId: batch._id,
            batchCode: batch.batchCode,
            quantityPurchased: 0,
            cost: 0,
            costPrice: detail.costPrice,
            expiryDate: batch.expiryDate,
            orderCount: new Set()
          })
        }

        const batchData = productData.batches.get(batchId)
        batchData.quantityPurchased += detail.quantity
        batchData.cost += detail.total
        batchData.orderCount.add(po._id.toString())
      }

      // Add purchase order details for this product
      productData.purchaseOrders.push({
        purchaseOrderId: po._id,
        poNumber: po.poNumber,
        orderDate: po.orderDate,
        receivedDate: po.receivedDate,
        supplierName: po.supplier?.companyName || 'N/A',
        supplierCode: po.supplier?.supplierCode || 'N/A',
        contactPerson: po.supplier?.contactPerson || 'N/A',
        status: po.status,
        paymentStatus: po.paymentStatus,
        quantityPurchased: detail.quantity,
        costPrice: detail.costPrice,
        subtotal: detail.total,
        batchCode: batch?.batchCode || 'N/A'
      })
    })

    // Format response - convert Map to Array
    const products = Array.from(productPurchaseMap.values()).map(data => ({
      productId: data.productId,
      productCode: data.productCode,
      productName: data.productName,
      categoryName: data.categoryName,
      image: data.image,
      totalQuantity: data.totalQuantity,
      totalCost: data.totalCost,
      totalOrders: data.orderCount.size,
      averageCost: data.totalCost / data.totalQuantity,
      batches: Array.from(data.batches.values()).map(batch => ({
        batchId: batch.batchId,
        batchCode: batch.batchCode,
        quantityPurchased: batch.quantityPurchased,
        cost: batch.cost,
        costPrice: batch.costPrice,
        expiryDate: batch.expiryDate,
        orderCount: batch.orderCount.size
      })),
      purchaseOrders: data.purchaseOrders
    }))

    // Sort by total cost descending
    products.sort((a, b) => b.totalCost - a.totalCost)

    // Calculate summary statistics
    const summary = {
      totalCost: products.reduce((sum, p) => sum + p.totalCost, 0),
      totalOrders: purchaseOrders.length,
      totalQuantity: products.reduce((sum, p) => sum + p.totalQuantity, 0),
      totalProducts: products.length,
      averageOrderValue: purchaseOrders.reduce((sum, po) => sum + po.totalPrice, 0) / purchaseOrders.length
    }

    logger.info('Purchase statistics calculated', {
      totalProducts: products.length,
      totalOrders: summary.totalOrders,
      totalCost: summary.totalCost
    })

    response.json({
      success: true,
      data: {
        summary,
        products
      }
    })
  } catch (error) {
    logger.error('Error getting purchase statistics:', error)
    response.status(500).json({
      success: false,
      error: 'Failed to get purchase statistics',
      message: error.message
    })
  }
})

module.exports = statisticsRouter
