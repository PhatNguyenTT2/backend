const statisticsRouter = require('express').Router()
const Order = require('../models/order')
const OrderDetail = require('../models/orderDetail')
const PurchaseOrder = require('../models/purchaseOrder')
const DetailPurchaseOrder = require('../models/detailPurchaseOrder')
const Product = require('../models/product')
const ProductBatch = require('../models/productBatch')
const Customer = require('../models/customer')
const logger = require('../utils/logger')

/**
 * Helper: Get period dates for dashboard statistics
 */
const getPeriodDates = (period) => {
  const now = new Date()
  let startDate, endDate, prevStartDate, prevEndDate

  if (period === 'week') {
    // Current week (Monday to Sunday)
    const dayOfWeek = now.getDay()
    const monday = new Date(now)
    monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
    monday.setHours(0, 0, 0, 0)

    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    sunday.setHours(23, 59, 59, 999)

    startDate = monday
    endDate = sunday

    // Previous week
    prevStartDate = new Date(monday)
    prevStartDate.setDate(monday.getDate() - 7)
    prevEndDate = new Date(sunday)
    prevEndDate.setDate(sunday.getDate() - 7)

  } else if (period === 'month') {
    // Current month
    startDate = new Date(now.getFullYear(), now.getMonth(), 1)
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

    // Previous month
    prevStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    prevEndDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)

  } else if (period === 'year') {
    // Current year
    startDate = new Date(now.getFullYear(), 0, 1)
    endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999)

    // Previous year
    prevStartDate = new Date(now.getFullYear() - 1, 0, 1)
    prevEndDate = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999)
  }

  return { startDate, endDate, prevStartDate, prevEndDate }
}

/**
 * Helper: Calculate percentage change
 */
const calculateChange = (current, previous) => {
  if (previous === 0) return current > 0 ? 100 : 0
  return parseFloat(((current - previous) / previous * 100).toFixed(1))
}

/**
 * GET /api/statistics/dashboard
 * Get dashboard statistics with period comparison
 * Query params: period ('week' | 'month' | 'year')
 */
statisticsRouter.get('/dashboard', async (request, response) => {
  try {
    const { period = 'month' } = request.query

    logger.info('Fetching dashboard statistics', { period })

    // Get period dates
    const { startDate, endDate, prevStartDate, prevEndDate } = getPeriodDates(period)

    // 1. Get current period orders
    const currentOrders = await Order.find({
      orderDate: { $gte: startDate, $lte: endDate },
      status: 'delivered',
      paymentStatus: 'paid'
    }).populate('customer', 'fullName phone')

    // 2. Get previous period orders
    const previousOrders = await Order.find({
      orderDate: { $gte: prevStartDate, $lte: prevEndDate },
      status: 'delivered',
      paymentStatus: 'paid'
    })

    // 3. Calculate summary metrics
    const currentTotalOrders = currentOrders.length
    const previousTotalOrders = previousOrders.length

    const currentTotalRevenue = currentOrders.reduce((sum, o) => sum + o.total, 0)
    const previousTotalRevenue = previousOrders.reduce((sum, o) => sum + o.total, 0)

    // Get order details for quantity calculation
    const currentOrderIds = currentOrders.map(o => o._id)
    const previousOrderIds = previousOrders.map(o => o._id)

    const currentDetails = await OrderDetail.find({ order: { $in: currentOrderIds } })
    const currentTotalSales = currentDetails.reduce((sum, d) => sum + d.quantity, 0)

    const previousDetails = await OrderDetail.find({ order: { $in: previousOrderIds } })
    const previousTotalSales = previousDetails.reduce((sum, d) => sum + d.quantity, 0)

    // New customers in period
    const currentNewCustomers = await Customer.countDocuments({
      createdAt: { $gte: startDate, $lte: endDate }
    })
    const previousNewCustomers = await Customer.countDocuments({
      createdAt: { $gte: prevStartDate, $lte: prevEndDate }
    })

    // 4. Build summary with trends
    const summary = {
      totalOrders: {
        current: currentTotalOrders,
        previous: previousTotalOrders,
        change: calculateChange(currentTotalOrders, previousTotalOrders),
        trend: currentTotalOrders >= previousTotalOrders ? 'up' : 'down'
      },
      totalSales: {
        current: currentTotalSales,
        previous: previousTotalSales,
        change: calculateChange(currentTotalSales, previousTotalSales),
        trend: currentTotalSales >= previousTotalSales ? 'up' : 'down'
      },
      newCustomers: {
        current: currentNewCustomers,
        previous: previousNewCustomers,
        change: calculateChange(currentNewCustomers, previousNewCustomers),
        trend: currentNewCustomers >= previousNewCustomers ? 'up' : 'down'
      },
      totalRevenue: {
        current: currentTotalRevenue,
        previous: previousTotalRevenue,
        change: calculateChange(currentTotalRevenue, previousTotalRevenue),
        trend: currentTotalRevenue >= previousTotalRevenue ? 'up' : 'down'
      }
    }

    // 5. Order trend data - group by date
    const currentOrdersByDate = {}
    currentOrders.forEach(order => {
      const dateKey = order.orderDate.toISOString().split('T')[0]
      currentOrdersByDate[dateKey] = (currentOrdersByDate[dateKey] || 0) + order.total
    })

    const previousOrdersByDate = {}
    previousOrders.forEach(order => {
      const dateKey = order.orderDate.toISOString().split('T')[0]
      previousOrdersByDate[dateKey] = (previousOrdersByDate[dateKey] || 0) + order.total
    })

    // Build chart data arrays
    const orderTrend = {
      labels: [],
      currentPeriod: [],
      comparisonPeriod: []
    }

    let currentDate = new Date(startDate)
    while (currentDate <= endDate) {
      const dateKey = currentDate.toISOString().split('T')[0]
      const label = `${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`

      orderTrend.labels.push(label)
      orderTrend.currentPeriod.push(currentOrdersByDate[dateKey] || 0)

      currentDate.setDate(currentDate.getDate() + 1)
    }

    let prevDate = new Date(prevStartDate)
    while (prevDate <= prevEndDate) {
      const dateKey = prevDate.toISOString().split('T')[0]
      orderTrend.comparisonPeriod.push(previousOrdersByDate[dateKey] || 0)
      prevDate.setDate(prevDate.getDate() + 1)
    }

    // 6. Top categories
    const categoryStats = await OrderDetail.aggregate([
      { $match: { order: { $in: currentOrderIds } } },
      {
        $lookup: {
          from: 'productbatches',
          localField: 'batch',
          foreignField: '_id',
          as: 'batch'
        }
      },
      { $unwind: '$batch' },
      {
        $lookup: {
          from: 'products',
          localField: 'batch.product',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: '$product' },
      {
        $lookup: {
          from: 'categories',
          localField: 'product.category',
          foreignField: '_id',
          as: 'category'
        }
      },
      { $unwind: '$category' },
      {
        $group: {
          _id: '$category.name',
          total: { $sum: '$quantity' }
        }
      },
      { $sort: { total: -1 } },
      { $limit: 5 }
    ])

    const totalCategoryQty = categoryStats.reduce((sum, c) => sum + c.total, 0)
    const topCategories = categoryStats.map(cat => ({
      name: cat._id,
      value: totalCategoryQty > 0 ? Math.round((cat.total / totalCategoryQty) * 100) : 0,
      quantity: cat.total
    }))

    // 7. Recent transactions
    const recentTransactions = currentOrders
      .sort((a, b) => b.orderDate - a.orderDate)
      .slice(0, 10)
      .map(order => ({
        id: order._id,
        orderNumber: order.orderNumber,
        customerName: order.customer?.fullName || 'N/A',
        customerPhone: order.customer?.phone || 'N/A',
        totalPayment: order.total,
        date: order.orderDate,
        status: order.status
      }))

    // 8. Format response
    response.json({
      success: true,
      data: {
        currentPeriod: {
          type: period,
          label: `${startDate.toLocaleDateString('vi-VN')} - ${endDate.toLocaleDateString('vi-VN')}`,
          startDate,
          endDate
        },
        comparisonPeriod: {
          label: `${prevStartDate.toLocaleDateString('vi-VN')} - ${prevEndDate.toLocaleDateString('vi-VN')}`,
          startDate: prevStartDate,
          endDate: prevEndDate
        },
        summary,
        orderTrend,
        topCategories,
        recentTransactions
      }
    })

    logger.info('Dashboard statistics fetched successfully', {
      period,
      totalOrders: currentTotalOrders,
      totalRevenue: currentTotalRevenue
    })

  } catch (error) {
    logger.error('Error fetching dashboard statistics:', error)
    response.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard statistics'
    })
  }
})

/**
 * GET /api/statistics/sales
 * Get sales statistics aggregated by product
 * Query params: startDate, endDate, productId (optional), categoryId (optional), customerId (optional)
 */
statisticsRouter.get('/sales', async (request, response) => {
  try {
    const { startDate, endDate, productId, categoryId, customerId } = request.query

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

    if (customerId) {
      orderQuery.customer = customerId
    }

    logger.info('Fetching sales statistics', { startDate, endDate, productId, categoryId, customerId })

    // Find all delivered and paid orders in date range
    const orders = await Order.find(orderQuery)
      .populate('customer', 'fullName phone')
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

    const orderIds = orders.map(order => order._id)

    // Find all order details for these orders
    let detailsQuery = { order: { $in: orderIds } }
    if (productId) {
      detailsQuery.product = productId
    }

    const orderDetails = await OrderDetail.find(detailsQuery)
      .populate({
        path: 'product',
        populate: { path: 'category', select: 'name' }
      })
      .populate('batch', 'batchCode expiryDate')

    // Filter by category if specified
    let filteredDetails = orderDetails
    if (categoryId) {
      filteredDetails = orderDetails.filter(
        detail => detail.product?.category?._id.toString() === categoryId
      )
    }

    // Map to organize data by product
    const productSalesMap = new Map()

    filteredDetails.forEach(detail => {
      const product = detail.product
      const batch = detail.batch
      const order = orders.find(o => o._id.toString() === detail.order.toString())

      if (!product || !order) return

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
      if (batch) {
        const batchId = batch._id.toString()
        if (!productData.batches.has(batchId)) {
          productData.batches.set(batchId, {
            batchId: batch._id,
            batchCode: batch.batchCode,
            quantitySold: 0,
            revenue: 0,
            unitPrice: detail.unitPrice,
            expiryDate: batch.expiryDate,
            orderCount: new Set()
          })
        }

        const batchData = productData.batches.get(batchId)
        batchData.quantitySold += detail.quantity
        batchData.revenue += detail.total
        batchData.orderCount.add(order._id.toString())
      }

      // Add order details for this product
      productData.orders.push({
        orderId: order._id,
        orderNumber: order.orderNumber,
        orderDate: order.orderDate,
        customerName: order.customer?.fullName || 'N/A',
        customerPhone: order.customer?.phone || 'N/A',
        status: order.status,
        paymentStatus: order.paymentStatus,
        quantitySold: detail.quantity,
        unitPrice: detail.unitPrice,
        subtotal: detail.total,
        batchCode: batch?.batchCode || 'N/A'
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
        expiryDate: batch.expiryDate,
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
      status: { $in: ['approved', 'received'] } // Only approved or received POs
    }

    if (supplierId) {
      poQuery.supplier = supplierId
    }

    logger.info('Fetching purchase statistics', { startDate, endDate, productId, categoryId, supplierId })

    // Find all approved/received purchase orders in date range
    const purchaseOrders = await PurchaseOrder.find(poQuery)
      .populate('supplier', 'supplierCode companyName contactPerson')
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

    const poDetails = await DetailPurchaseOrder.find(detailsQuery)
      .populate({
        path: 'product',
        populate: { path: 'category', select: 'name' }
      })
      .populate('batch', 'batchCode expiryDate')

    // Filter by category if specified
    let filteredDetails = poDetails
    if (categoryId) {
      filteredDetails = poDetails.filter(
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
      } else {
        // Handle case where batch is not assigned yet (pending receipt)
        const pendingKey = 'pending'
        if (!productData.batches.has(pendingKey)) {
          productData.batches.set(pendingKey, {
            batchId: null,
            batchCode: 'Pending Receipt',
            quantityPurchased: 0,
            cost: 0,
            costPrice: detail.costPrice,
            expiryDate: null,
            orderCount: new Set()
          })
        }

        const batchData = productData.batches.get(pendingKey)
        batchData.quantityPurchased += detail.quantity
        batchData.cost += detail.total
        batchData.orderCount.add(po._id.toString())
      }

      // Add purchase order details for this product
      productData.purchaseOrders.push({
        purchaseOrderId: po._id,
        poNumber: po.poNumber,
        orderDate: po.orderDate,
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

/**
 * GET /api/statistics/profit
 * Get profit analysis by comparing revenue (sales) vs costs (purchases)
 * Query params: year (required), productId (optional), categoryId (optional)
 */
statisticsRouter.get('/profit', async (request, response) => {
  try {
    const { year, productId, categoryId } = request.query

    // Validate required parameters
    if (!year) {
      return response.status(400).json({
        success: false,
        error: 'year parameter is required'
      })
    }

    const selectedYear = parseInt(year)
    if (isNaN(selectedYear) || selectedYear < 2000 || selectedYear > 2100) {
      return response.status(400).json({
        success: false,
        error: 'Invalid year. Must be between 2000 and 2100'
      })
    }

    logger.info('Fetching profit statistics', { year: selectedYear, productId, categoryId })

    // Define year date range
    const startDate = new Date(selectedYear, 0, 1) // Jan 1
    const endDate = new Date(selectedYear, 11, 31, 23, 59, 59, 999) // Dec 31

    // ==================== FETCH SALES DATA ====================
    const salesQuery = {
      orderDate: { $gte: startDate, $lte: endDate },
      status: 'delivered',
      paymentStatus: 'paid'
    }

    const salesOrders = await Order.find(salesQuery)
      .populate('customer', 'fullName phone')
      .sort({ orderDate: 1 })

    const salesOrderIds = salesOrders.map(order => order._id)

    let salesDetailsQuery = { order: { $in: salesOrderIds } }
    if (productId) {
      salesDetailsQuery.product = productId
    }

    const salesDetails = await OrderDetail.find(salesDetailsQuery)
      .populate({
        path: 'product',
        populate: { path: 'category', select: 'name' }
      })
      .populate('batch', 'batchCode costPrice')

    // Filter by category if specified
    let filteredSalesDetails = salesDetails
    if (categoryId) {
      filteredSalesDetails = salesDetails.filter(
        detail => detail.product?.category?._id.toString() === categoryId
      )
    }

    // ==================== FETCH PURCHASE DATA ====================
    const purchaseQuery = {
      orderDate: { $gte: startDate, $lte: endDate },
      status: { $in: ['approved', 'received'] }
    }

    const purchaseOrders = await PurchaseOrder.find(purchaseQuery)
      .populate('supplier', 'companyName')
      .sort({ orderDate: 1 })

    const purchaseOrderIds = purchaseOrders.map(po => po._id)

    let purchaseDetailsQuery = { purchaseOrder: { $in: purchaseOrderIds } }
    if (productId) {
      purchaseDetailsQuery.product = productId
    }

    const purchaseDetails = await DetailPurchaseOrder.find(purchaseDetailsQuery)
      .populate({
        path: 'product',
        populate: { path: 'category', select: 'name' }
      })
      .populate('batch', 'batchCode')

    // Filter by category if specified
    let filteredPurchaseDetails = purchaseDetails
    if (categoryId) {
      filteredPurchaseDetails = purchaseDetails.filter(
        detail => detail.product?.category?._id.toString() === categoryId
      )
    }

    // ==================== AGGREGATE BY PRODUCT ====================
    const productProfitMap = new Map()

    // Process sales data
    filteredSalesDetails.forEach(detail => {
      const product = detail.product
      if (!product) return

      const productId = product._id.toString()
      const order = salesOrders.find(o => o._id.toString() === detail.order.toString())
      if (!order) return

      if (!productProfitMap.has(productId)) {
        productProfitMap.set(productId, {
          productId: product._id,
          productCode: product.productCode,
          productName: product.name,
          categoryName: product.category?.name || 'N/A',
          image: product.image,
          // Sales metrics
          quantitySold: 0,
          totalRevenue: 0,
          salesOrders: new Set(),
          // Purchase metrics
          quantityPurchased: 0,
          totalCost: 0,
          purchaseOrders: new Set()
        })
      }

      const productData = productProfitMap.get(productId)
      productData.quantitySold += detail.quantity
      productData.totalRevenue += detail.total
      productData.salesOrders.add(order._id.toString())
    })

    // Process purchase data
    filteredPurchaseDetails.forEach(detail => {
      const product = detail.product
      if (!product) return

      const productId = product._id.toString()
      const po = purchaseOrders.find(p => p._id.toString() === detail.purchaseOrder.toString())
      if (!po) return

      if (!productProfitMap.has(productId)) {
        productProfitMap.set(productId, {
          productId: product._id,
          productCode: product.productCode,
          productName: product.name,
          categoryName: product.category?.name || 'N/A',
          image: product.image,
          // Sales metrics
          quantitySold: 0,
          totalRevenue: 0,
          salesOrders: new Set(),
          // Purchase metrics
          quantityPurchased: 0,
          totalCost: 0,
          purchaseOrders: new Set()
        })
      }

      const productData = productProfitMap.get(productId)
      productData.quantityPurchased += detail.quantity
      productData.totalCost += detail.total
      productData.purchaseOrders.add(po._id.toString())
    })

    // ==================== CALCULATE PROFIT METRICS ====================
    const products = Array.from(productProfitMap.values()).map(data => {
      const revenue = data.totalRevenue
      const cost = data.totalCost
      const profit = revenue - cost
      const profitMargin = revenue > 0 ? (profit / revenue) * 100 : 0
      const averageSellingPrice = data.quantitySold > 0 ? revenue / data.quantitySold : 0
      const averageCostPrice = data.quantityPurchased > 0 ? cost / data.quantityPurchased : 0
      const profitPerUnit = averageSellingPrice - averageCostPrice

      return {
        productId: data.productId,
        productCode: data.productCode,
        productName: data.productName,
        categoryName: data.categoryName,
        image: data.image,
        // Sales
        quantitySold: data.quantitySold,
        totalRevenue: revenue,
        salesOrders: data.salesOrders.size,
        averageSellingPrice: averageSellingPrice,
        // Purchase
        quantityPurchased: data.quantityPurchased,
        totalCost: cost,
        purchaseOrders: data.purchaseOrders.size,
        averageCostPrice: averageCostPrice,
        // Profit
        profit: profit,
        profitMargin: profitMargin,
        profitPerUnit: profitPerUnit
      }
    })

    // Sort by profit descending
    products.sort((a, b) => b.profit - a.profit)

    // ==================== MONTHLY BREAKDOWN ====================
    const monthlyData = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      monthName: new Date(selectedYear, i, 1).toLocaleString('en-US', { month: 'long' }),
      revenue: 0,
      cost: 0,
      profit: 0,
      profitMargin: 0,
      salesOrders: 0,
      purchaseOrders: 0
    }))

    // Aggregate sales by month
    salesOrders.forEach(order => {
      const month = order.orderDate.getMonth()
      monthlyData[month].revenue += order.total
      monthlyData[month].salesOrders += 1
    })

    // Aggregate purchases by month
    purchaseOrders.forEach(po => {
      const month = po.orderDate.getMonth()
      monthlyData[month].cost += po.totalPrice
      monthlyData[month].purchaseOrders += 1
    })

    // Calculate monthly profit
    monthlyData.forEach(month => {
      month.profit = month.revenue - month.cost
      month.profitMargin = month.revenue > 0 ? (month.profit / month.revenue) * 100 : 0
    })

    // ==================== SUMMARY STATISTICS ====================
    const summary = {
      totalRevenue: products.reduce((sum, p) => sum + p.totalRevenue, 0),
      totalCost: products.reduce((sum, p) => sum + p.totalCost, 0),
      grossProfit: 0,
      profitMargin: 0,
      totalProductsSold: products.filter(p => p.quantitySold > 0).length,
      totalProductsPurchased: products.filter(p => p.quantityPurchased > 0).length,
      totalSalesOrders: salesOrders.length,
      totalPurchaseOrders: purchaseOrders.length
    }

    summary.grossProfit = summary.totalRevenue - summary.totalCost
    summary.profitMargin = summary.totalRevenue > 0
      ? (summary.grossProfit / summary.totalRevenue) * 100
      : 0

    logger.info('Profit statistics calculated', {
      year: selectedYear,
      totalProducts: products.length,
      grossProfit: summary.grossProfit,
      profitMargin: summary.profitMargin
    })

    response.json({
      success: true,
      data: {
        year: selectedYear,
        summary,
        products,
        monthlyBreakdown: monthlyData
      }
    })
  } catch (error) {
    logger.error('Error getting profit statistics:', error)
    response.status(500).json({
      success: false,
      error: 'Failed to get profit statistics',
      message: error.message
    })
  }
})

module.exports = statisticsRouter
