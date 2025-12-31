const statisticsRouter = require('express').Router()
const Order = require('../models/order')
const OrderDetail = require('../models/orderDetail')
const PurchaseOrder = require('../models/purchaseOrder')
const DetailPurchaseOrder = require('../models/detailPurchaseOrder')
const StockOutOrder = require('../models/stockOutOrder')
const DetailStockOutOrder = require('../models/detailStockOutOrder')
const Product = require('../models/product')
const ProductBatch = require('../models/productBatch')
const Customer = require('../models/customer')
const Inventory = require('../models/inventory')
const DetailInventory = require('../models/detailInventory')
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

    // 4. Build summary with change percentages
    const totalOrdersChange = calculateChange(currentTotalOrders, previousTotalOrders)
    const totalSalesChange = calculateChange(currentTotalSales, previousTotalSales)
    const newCustomersChange = calculateChange(currentNewCustomers, previousNewCustomers)
    const totalRevenueChange = calculateChange(currentTotalRevenue, previousTotalRevenue)

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

    // Build chart data arrays with appropriate labels based on period
    const orderTrend = {
      labels: [],
      current: [],
      previous: []
    }

    if (period === 'week') {
      // Week: show day names (Mon-Sun)
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      let currentDate = new Date(startDate)
      while (currentDate <= endDate) {
        const dateKey = currentDate.toISOString().split('T')[0]
        const dayOfWeek = currentDate.getDay()

        orderTrend.labels.push(dayNames[dayOfWeek])
        orderTrend.current.push(currentOrdersByDate[dateKey] || 0)

        currentDate.setDate(currentDate.getDate() + 1)
      }

      let prevDate = new Date(prevStartDate)
      while (prevDate <= prevEndDate) {
        const dateKey = prevDate.toISOString().split('T')[0]
        orderTrend.previous.push(previousOrdersByDate[dateKey] || 0)
        prevDate.setDate(prevDate.getDate() + 1)
      }
    } else if (period === 'month') {
      // Month: show date labels at intervals (MM/DD format)
      // Create intervals: show ~8-10 labels across the month
      const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1
      const interval = Math.max(Math.floor(totalDays / 8), 1)

      let currentDate = new Date(startDate)
      let dayCount = 0

      while (currentDate <= endDate) {
        const dateKey = currentDate.toISOString().split('T')[0]

        // Show label at intervals or first/last day
        if (dayCount % interval === 0 || currentDate >= endDate) {
          const label = `${String(currentDate.getMonth() + 1).padStart(2, '0')}/${String(currentDate.getDate()).padStart(2, '0')}`
          orderTrend.labels.push(label)
          orderTrend.current.push(currentOrdersByDate[dateKey] || 0)
        }

        currentDate.setDate(currentDate.getDate() + 1)
        dayCount++
      }

      // For previous period, use same interval
      let prevDate = new Date(prevStartDate)
      let prevDayCount = 0

      while (prevDate <= prevEndDate) {
        const dateKey = prevDate.toISOString().split('T')[0]

        if (prevDayCount % interval === 0 || prevDate >= prevEndDate) {
          orderTrend.previous.push(previousOrdersByDate[dateKey] || 0)
        }

        prevDate.setDate(prevDate.getDate() + 1)
        prevDayCount++
      }
    } else if (period === 'year') {
      // Year: show month names
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

      // Aggregate by month
      const currentByMonth = Array(12).fill(0)
      const previousByMonth = Array(12).fill(0)

      currentOrders.forEach(order => {
        const month = order.orderDate.getMonth()
        currentByMonth[month] += order.total
      })

      previousOrders.forEach(order => {
        const month = order.orderDate.getMonth()
        previousByMonth[month] += order.total
      })

      orderTrend.labels = monthNames
      orderTrend.current = currentByMonth
      orderTrend.previous = previousByMonth
    }

    // 6. Top categories with colors
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

    // Color palette for categories
    const categoryColors = ['#e6816f', '#3b82f6', '#fbbf24', '#a855f7', '#10b981']

    const totalCategoryQty = categoryStats.reduce((sum, c) => sum + c.total, 0)
    const topCategories = categoryStats.map((cat, index) => ({
      name: cat._id,
      value: totalCategoryQty > 0 ? Math.round((cat.total / totalCategoryQty) * 100) : 0,
      color: categoryColors[index] || '#6b7280'
    }))

    // 7. Recent transactions - formatted for template
    const transactions = currentOrders
      .sort((a, b) => b.orderDate - a.orderDate)
      .slice(0, 10)
      .map(order => ({
        id: order.orderNumber,
        customer: order.customer?.fullName || 'N/A',
        phone: order.customer?.phone || 'N/A',
        amount: order.total,
        date: order.orderDate.toLocaleDateString('vi-VN'),
        status: order.status
      }))

    // 8. Format response - simplified structure for template
    response.json({
      success: true,
      data: {
        totalOrders: currentTotalOrders,
        totalSales: currentTotalSales,
        newCustomers: currentNewCustomers,
        totalRevenue: currentTotalRevenue,
        changes: {
          totalOrders: totalOrdersChange,
          totalSales: totalSalesChange,
          newCustomers: newCustomersChange,
          totalRevenue: totalRevenueChange
        },
        orderTrend,
        topCategories,
        transactions
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

    // ==================== FETCH STOCK OUT DATA ====================
    const stockOutQuery = {
      orderDate: { $gte: startDate, $lte: endDate },
      status: 'completed' // Only count completed stock out orders
    }

    const stockOutOrders = await StockOutOrder.find(stockOutQuery)
      .populate('createdBy', 'fullName employeeCode')
      .sort({ orderDate: 1 })

    logger.info('Stock out orders found', {
      count: stockOutOrders.length,
      year: selectedYear
    })

    const stockOutOrderIds = stockOutOrders.map(so => so._id)

    let stockOutDetailsQuery = { stockOutOrder: { $in: stockOutOrderIds } }
    if (productId) {
      stockOutDetailsQuery.product = productId
    }

    const stockOutDetails = await DetailStockOutOrder.find(stockOutDetailsQuery)
      .populate({
        path: 'product',
        populate: { path: 'category', select: 'name' }
      })
      .populate('batchId', 'batchCode costPrice')

    logger.info('Stock out details found', {
      count: stockOutDetails.length,
      year: selectedYear
    })

    // Filter by category if specified
    let filteredStockOutDetails = stockOutDetails
    if (categoryId) {
      filteredStockOutDetails = stockOutDetails.filter(
        detail => detail.product?.category?._id.toString() === categoryId
      )
    }

    // Categorize stock out orders by reason
    const stockOutSalesOrders = stockOutOrders.filter(so => so.reason === 'sales')
    const stockOutLossOrders = stockOutOrders.filter(so => so.reason !== 'sales')

    logger.info('Stock out categorized', {
      salesCount: stockOutSalesOrders.length,
      lossCount: stockOutLossOrders.length
    })

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
          purchaseOrders: new Set(),
          // Stock out metrics
          stockOutSalesQuantity: 0,
          stockOutSalesRevenue: 0,
          stockOutSalesOrders: new Set(),
          stockOutLossQuantity: 0,
          stockOutLossValue: 0,
          stockOutLossOrders: new Set()
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
          purchaseOrders: new Set(),
          // Stock out metrics
          stockOutSalesQuantity: 0,
          stockOutSalesRevenue: 0,
          stockOutSalesOrders: new Set(),
          stockOutLossQuantity: 0,
          stockOutLossValue: 0,
          stockOutLossOrders: new Set()
        })
      }

      const productData = productProfitMap.get(productId)
      productData.quantityPurchased += detail.quantity
      productData.totalCost += detail.total
      productData.purchaseOrders.add(po._id.toString())
    })

    // Process stock out data
    filteredStockOutDetails.forEach(detail => {
      const product = detail.product
      if (!product) {
        logger.warn('Stock out detail missing product', { detailId: detail._id })
        return
      }

      const productId = product._id.toString()
      const stockOut = stockOutOrders.find(so => so._id.toString() === detail.stockOutOrder.toString())
      if (!stockOut) {
        logger.warn('Stock out order not found for detail', { detailId: detail._id })
        return
      }

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
          purchaseOrders: new Set(),
          // Stock out metrics
          stockOutSalesQuantity: 0,
          stockOutSalesRevenue: 0,
          stockOutSalesOrders: new Set(),
          stockOutLossQuantity: 0,
          stockOutLossValue: 0,
          stockOutLossOrders: new Set()
        })
      }

      const productData = productProfitMap.get(productId)

      // Parse unitPrice from Decimal128
      let unitPrice = 0
      if (detail.unitPrice) {
        if (typeof detail.unitPrice === 'object' && detail.unitPrice.$numberDecimal) {
          unitPrice = parseFloat(detail.unitPrice.$numberDecimal)
        } else if (typeof detail.unitPrice === 'string') {
          unitPrice = parseFloat(detail.unitPrice)
        } else {
          unitPrice = parseFloat(detail.unitPrice)
        }
      }

      const totalValue = detail.quantity * unitPrice

      logger.info('Processing stock out detail', {
        productCode: product.productCode,
        quantity: detail.quantity,
        unitPrice: unitPrice,
        totalValue: totalValue,
        reason: stockOut.reason
      })

      if (stockOut.reason === 'sales') {
        // Stock out for sales increases revenue
        productData.stockOutSalesQuantity += detail.quantity
        productData.stockOutSalesRevenue += totalValue
        productData.stockOutSalesOrders.add(stockOut._id.toString())
      } else {
        // Stock out for other reasons (damage, expired, etc.) is a loss
        productData.stockOutLossQuantity += detail.quantity
        productData.stockOutLossValue += totalValue
        productData.stockOutLossOrders.add(stockOut._id.toString())
      }
    })

    // ==================== CALCULATE PROFIT METRICS ====================
    const products = Array.from(productProfitMap.values()).map(data => {
      // Calculate total revenue including stock out sales
      const revenue = data.totalRevenue + data.stockOutSalesRevenue

      // Calculate total cost including stock out losses
      const cost = data.totalCost + data.stockOutLossValue

      const profit = revenue - cost
      const profitMargin = revenue > 0 ? (profit / revenue) * 100 : 0

      // Calculate total quantity sold (including stock out sales)
      const totalQuantitySold = data.quantitySold + data.stockOutSalesQuantity
      const averageSellingPrice = totalQuantitySold > 0 ? revenue / totalQuantitySold : 0

      const averageCostPrice = data.quantityPurchased > 0 ? data.totalCost / data.quantityPurchased : 0
      const profitPerUnit = averageSellingPrice - averageCostPrice

      return {
        productId: data.productId,
        productCode: data.productCode,
        productName: data.productName,
        categoryName: data.categoryName,
        image: data.image,
        // Sales
        quantitySold: data.quantitySold,
        totalRevenue: data.totalRevenue,
        salesOrders: data.salesOrders.size,
        averageSellingPrice: averageSellingPrice,
        // Purchase
        quantityPurchased: data.quantityPurchased,
        totalCost: data.totalCost,
        purchaseOrders: data.purchaseOrders.size,
        averageCostPrice: averageCostPrice,
        // Stock Out Sales
        stockOutSalesQuantity: data.stockOutSalesQuantity,
        stockOutSalesRevenue: data.stockOutSalesRevenue,
        stockOutSalesOrders: data.stockOutSalesOrders.size,
        // Stock Out Losses
        stockOutLossQuantity: data.stockOutLossQuantity,
        stockOutLossValue: data.stockOutLossValue,
        stockOutLossOrders: data.stockOutLossOrders.size,
        // Combined metrics
        totalQuantitySold: totalQuantitySold,
        combinedRevenue: revenue,
        combinedCost: cost,
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

    // Aggregate stock out sales by month
    stockOutSalesOrders.forEach(so => {
      const month = so.orderDate.getMonth()
      // Parse totalPrice from Decimal128
      let totalPrice = 0
      if (so.totalPrice) {
        if (typeof so.totalPrice === 'object' && so.totalPrice.$numberDecimal) {
          totalPrice = parseFloat(so.totalPrice.$numberDecimal)
        } else {
          totalPrice = parseFloat(so.totalPrice)
        }
      }
      monthlyData[month].revenue += totalPrice
      monthlyData[month].stockOutSalesOrders = (monthlyData[month].stockOutSalesOrders || 0) + 1
    })

    // Aggregate stock out losses by month
    stockOutLossOrders.forEach(so => {
      const month = so.orderDate.getMonth()
      // Parse totalPrice from Decimal128
      let totalPrice = 0
      if (so.totalPrice) {
        if (typeof so.totalPrice === 'object' && so.totalPrice.$numberDecimal) {
          totalPrice = parseFloat(so.totalPrice.$numberDecimal)
        } else {
          totalPrice = parseFloat(so.totalPrice)
        }
      }
      monthlyData[month].cost += totalPrice
      monthlyData[month].stockOutLossOrders = (monthlyData[month].stockOutLossOrders || 0) + 1
    })

    // Calculate monthly profit
    monthlyData.forEach(month => {
      month.profit = month.revenue - month.cost
      month.profitMargin = month.revenue > 0 ? (month.profit / month.revenue) * 100 : 0
      // Add stock out order counters
      month.stockOutSalesOrders = month.stockOutSalesOrders || 0
      month.stockOutLossOrders = month.stockOutLossOrders || 0
    })

    // ==================== SUMMARY STATISTICS ====================
    const summary = {
      totalRevenue: products.reduce((sum, p) => sum + p.totalRevenue, 0),
      totalCost: products.reduce((sum, p) => sum + p.totalCost, 0),
      stockOutSalesRevenue: products.reduce((sum, p) => sum + p.stockOutSalesRevenue, 0),
      stockOutLossValue: products.reduce((sum, p) => sum + p.stockOutLossValue, 0),
      combinedRevenue: 0,
      combinedCost: 0,
      grossProfit: 0,
      profitMargin: 0,
      totalProductsSold: products.filter(p => p.quantitySold > 0).length,
      totalProductsPurchased: products.filter(p => p.quantityPurchased > 0).length,
      totalSalesOrders: salesOrders.length,
      totalPurchaseOrders: purchaseOrders.length,
      totalStockOutSalesOrders: stockOutSalesOrders.length,
      totalStockOutLossOrders: stockOutLossOrders.length
    }

    // Calculate combined metrics
    summary.combinedRevenue = summary.totalRevenue + summary.stockOutSalesRevenue
    summary.combinedCost = summary.totalCost + summary.stockOutLossValue
    summary.grossProfit = summary.combinedRevenue - summary.combinedCost
    summary.profitMargin = summary.combinedRevenue > 0
      ? (summary.grossProfit / summary.combinedRevenue) * 100
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

/**
 * GET /api/statistics/inventory
 * Get inventory report with stock analysis and distribution
 * Query params: categoryId (optional), productId (optional), view (optional), includeDetails (optional)
 */
statisticsRouter.get('/inventory', async (request, response) => {
  try {
    const { categoryId, productId, view, includeDetails } = request.query

    logger.info('Fetching inventory report', { categoryId, productId, view, includeDetails })

    // Build product filter
    const productFilter = { isActive: true }
    if (categoryId) {
      productFilter.category = categoryId
    }
    if (productId) {
      productFilter._id = productId
    }

    // Get all active products
    const products = await Product.find(productFilter)
      .populate('category', 'name categoryCode')
      .sort({ productCode: 1 })

    const productIds = products.map(p => p._id)

    // Get all inventories for these products
    const inventories = await Inventory.find({ product: { $in: productIds } })
      .populate('product', 'productCode name image category')

    // Get all product batches for these products
    const batches = await ProductBatch.find({
      product: { $in: productIds }
    }).select('_id product')

    const batchIds = batches.map(b => b._id)

    // Get all detail inventories
    const detailInventories = await DetailInventory.find({
      batchId: { $in: batchIds }
    }).populate({
      path: 'batchId',
      select: 'batchCode expirationDate createdAt product',
      populate: {
        path: 'product',
        select: 'productCode name'
      }
    })

    // Create a map of product inventory data
    const productInventoryMap = new Map()

    // Initialize map with all products
    products.forEach(product => {
      productInventoryMap.set(product._id.toString(), {
        productId: product._id,
        productCode: product.productCode,
        productName: product.name,
        categoryId: product.category?._id,
        categoryName: product.category?.name || 'Uncategorized',
        image: product.image,
        quantityOnHand: 0,
        quantityOnShelf: 0,
        quantityReserved: 0,
        quantityAvailable: 0,
        totalQuantity: 0,
        reorderPoint: 10,
        warehouseLocation: null,
        isOutOfStock: true,
        isLowStock: false,
        needsReorder: true,
        batchCount: 0,
        oldestBatchDays: null,
        batches: []
      })
    })

    // Aggregate inventory data from DetailInventory
    detailInventories.forEach(detail => {
      if (!detail.batchId || !detail.batchId.product) return

      const productId = detail.batchId.product._id.toString()
      const productData = productInventoryMap.get(productId)
      if (!productData) return

      // Accumulate quantities
      productData.quantityOnHand += detail.quantityOnHand || 0
      productData.quantityOnShelf += detail.quantityOnShelf || 0
      productData.quantityReserved += detail.quantityReserved || 0
      productData.batchCount++

      // Calculate oldest batch
      if (detail.batchId.createdAt) {
        const batchAge = Math.floor((Date.now() - new Date(detail.batchId.createdAt)) / (1000 * 60 * 60 * 24))
        if (productData.oldestBatchDays === null || batchAge > productData.oldestBatchDays) {
          productData.oldestBatchDays = batchAge
        }
      }

      // Add batch details if requested
      if (includeDetails === 'true') {
        productData.batches.push({
          batchId: detail.batchId._id,
          batchCode: detail.batchId.batchCode,
          quantityOnHand: detail.quantityOnHand,
          quantityOnShelf: detail.quantityOnShelf,
          quantityReserved: detail.quantityReserved,
          quantityAvailable: detail.quantityAvailable,
          totalQuantity: detail.totalQuantity,
          location: detail.location,
          expirationDate: detail.batchId.expirationDate
        })
      }
    })

    // Update inventory data from Inventory collection
    inventories.forEach(inv => {
      const productId = inv.product._id.toString()
      const productData = productInventoryMap.get(productId)
      if (!productData) return

      productData.reorderPoint = inv.reorderPoint || 10
      productData.warehouseLocation = inv.warehouseLocation
    })

    // Calculate derived fields for all products
    productInventoryMap.forEach((data) => {
      data.totalQuantity = data.quantityOnHand + data.quantityOnShelf
      data.quantityAvailable = Math.max(0, data.totalQuantity - data.quantityReserved)
      data.isOutOfStock = data.quantityAvailable === 0
      data.isLowStock = data.quantityAvailable > 0 && data.quantityAvailable <= (data.reorderPoint * 2)
      data.needsReorder = data.quantityAvailable <= data.reorderPoint
    })

    // Convert to array
    let productsList = Array.from(productInventoryMap.values())

    // Apply view filter
    if (view === 'low-stock') {
      productsList = productsList.filter(p => p.isLowStock)
    } else if (view === 'out-of-stock') {
      productsList = productsList.filter(p => p.isOutOfStock)
    } else if (view === 'needs-reorder') {
      productsList = productsList.filter(p => p.needsReorder)
    }

    // ==================== SUMMARY METRICS ====================
    const summary = {
      totalProducts: productsList.length,
      totalQuantity: 0,
      totalWarehouseStock: 0,
      totalShelfStock: 0,
      totalReservedStock: 0,
      totalAvailableStock: 0,
      lowStockItems: 0,
      outOfStockItems: 0,
      needsReorderItems: 0,
      warehouseUtilization: 0,
      shelfUtilization: 0
    }

    productsList.forEach(product => {
      summary.totalQuantity += product.totalQuantity
      summary.totalWarehouseStock += product.quantityOnHand
      summary.totalShelfStock += product.quantityOnShelf
      summary.totalReservedStock += product.quantityReserved
      summary.totalAvailableStock += product.quantityAvailable
      if (product.isLowStock) summary.lowStockItems++
      if (product.isOutOfStock) summary.outOfStockItems++
      if (product.needsReorder) summary.needsReorderItems++
    })

    // Calculate utilization percentages
    if (summary.totalQuantity > 0) {
      summary.warehouseUtilization = parseFloat(((summary.totalWarehouseStock / summary.totalQuantity) * 100).toFixed(1))
      summary.shelfUtilization = parseFloat(((summary.totalShelfStock / summary.totalQuantity) * 100).toFixed(1))
    }

    // ==================== CATEGORY DISTRIBUTION ====================
    const categoryMap = new Map()

    productsList.forEach(product => {
      const categoryKey = product.categoryId?.toString() || 'uncategorized'
      if (!categoryMap.has(categoryKey)) {
        categoryMap.set(categoryKey, {
          categoryId: product.categoryId,
          categoryName: product.categoryName,
          productCount: 0,
          totalQuantity: 0,
          warehouseStock: 0,
          shelfStock: 0,
          percentage: 0
        })
      }

      const categoryData = categoryMap.get(categoryKey)
      categoryData.productCount++
      categoryData.totalQuantity += product.totalQuantity
      categoryData.warehouseStock += product.quantityOnHand
      categoryData.shelfStock += product.quantityOnShelf
    })

    // Calculate percentages and add colors
    const categoryColors = ['#e6816f', '#3b82f6', '#fbbf24', '#a855f7', '#10b981', '#ec4899', '#f97316']
    const categoryDistribution = Array.from(categoryMap.values())
      .sort((a, b) => b.totalQuantity - a.totalQuantity)
      .slice(0, 7)
      .map((cat, index) => ({
        ...cat,
        percentage: summary.totalQuantity > 0
          ? parseFloat(((cat.totalQuantity / summary.totalQuantity) * 100).toFixed(1))
          : 0,
        color: categoryColors[index] || '#6b7280'
      }))

    // ==================== STOCK STATUS BREAKDOWN ====================
    const stockStatus = {
      inStock: productsList.filter(p => !p.isLowStock && !p.isOutOfStock && p.quantityAvailable > p.reorderPoint * 2).length,
      lowStock: summary.lowStockItems,
      outOfStock: summary.outOfStockItems,
      needsReorder: summary.needsReorderItems
    }

    // ==================== MONTHLY STOCK MOVEMENT ====================
    const now = new Date()
    const yearStart = new Date(now.getFullYear(), 0, 1)

    const monthlyData = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      monthName: new Date(now.getFullYear(), i, 1).toLocaleString('en-US', { month: 'short' }),
      incoming: 0,
      outgoing: 0,
      netChange: 0
    }))

    // Get purchase orders for the year (incoming stock)
    const purchaseOrders = await PurchaseOrder.find({
      orderDate: { $gte: yearStart, $lte: now },
      status: { $in: ['approved', 'received'] }
    })

    const purchaseOrderIds = purchaseOrders.map(po => po._id)
    const purchaseDetails = await DetailPurchaseOrder.find({
      purchaseOrder: { $in: purchaseOrderIds },
      product: { $in: productIds }
    })

    purchaseDetails.forEach(detail => {
      const po = purchaseOrders.find(p => p._id.equals(detail.purchaseOrder))
      if (po && po.orderDate) {
        const month = new Date(po.orderDate).getMonth()
        monthlyData[month].incoming += detail.quantity || 0
      }
    })

    // Get sales orders for the year (outgoing stock)
    const salesOrders = await Order.find({
      orderDate: { $gte: yearStart, $lte: now },
      status: 'delivered',
      paymentStatus: 'paid'
    })

    const salesOrderIds = salesOrders.map(o => o._id)
    const salesDetails = await OrderDetail.find({
      order: { $in: salesOrderIds }
    }).populate({
      path: 'batch',
      select: 'product',
      match: { product: { $in: productIds } }
    })

    salesDetails.forEach(detail => {
      if (!detail.batch) return
      const order = salesOrders.find(o => o._id.equals(detail.order))
      if (order && order.orderDate) {
        const month = new Date(order.orderDate).getMonth()
        monthlyData[month].outgoing += detail.quantity || 0
      }
    })

    // Calculate net change
    monthlyData.forEach(month => {
      month.netChange = month.incoming - month.outgoing
    })

    const stockMovement = {
      labels: monthlyData.map(m => m.monthName),
      incoming: monthlyData.map(m => m.incoming),
      outgoing: monthlyData.map(m => m.outgoing),
      netChange: monthlyData.map(m => m.netChange)
    }

    // ==================== FORMAT RESPONSE ====================
    logger.info('Inventory report calculated', {
      totalProducts: summary.totalProducts,
      totalQuantity: summary.totalQuantity,
      lowStockItems: summary.lowStockItems
    })

    response.json({
      success: true,
      data: {
        summary,
        categoryDistribution,
        stockStatus,
        stockMovement,
        products: productsList
      }
    })

  } catch (error) {
    logger.error('Error fetching inventory report:', error)
    response.status(500).json({
      success: false,
      error: 'Failed to fetch inventory report',
      message: error.message
    })
  }
})

/**
 * GET /api/statistics/employee-sales
 * Get employee sales performance report
 * Query params: startDate (required), endDate (required), employeeId (optional)
 */
statisticsRouter.get('/employee-sales', async (request, response) => {
  try {
    const { startDate, endDate, employeeId } = request.query

    // Validate required parameters
    if (!startDate || !endDate) {
      return response.status(400).json({
        success: false,
        error: 'Missing required parameters: startDate and endDate'
      })
    }

    // Build query for orders
    const orderQuery = {
      orderDate: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      },
      status: 'delivered',
      paymentStatus: 'paid',
      createdBy: { $exists: true, $ne: null } // Only orders with employee
    }

    if (employeeId) {
      orderQuery.createdBy = employeeId
    }

    logger.info('Fetching employee sales statistics', { startDate, endDate, employeeId })

    // Find all delivered and paid orders in date range
    const orders = await Order.find(orderQuery)
      .populate({
        path: 'createdBy',
        select: 'fullName userAccount',
        populate: {
          path: 'userAccount',
          select: 'userCode'
        }
      })
      .populate('customer', 'fullName phone')
      .sort({ orderDate: -1 })

    if (orders.length === 0) {
      return response.json({
        success: true,
        data: {
          summary: {
            totalEmployees: 0,
            totalOrders: 0,
            totalRevenue: 0,
            totalQuantitySold: 0,
            averageOrderValue: 0,
            topEmployee: null
          },
          employees: [],
          dateRange: {
            startDate,
            endDate
          }
        }
      })
    }

    const orderIds = orders.map(order => order._id)

    // Get order details for quantity calculation
    const orderDetails = await OrderDetail.find({ order: { $in: orderIds } })

    // Map to organize data by employee
    const employeeSalesMap = new Map()

    orders.forEach(order => {
      const employeeId = order.createdBy?._id?.toString()
      const employeeName = order.createdBy?.fullName || 'Unknown'
      const employeeCode = order.createdBy?.userAccount?.userCode || 'N/A'

      if (!employeeId) return

      if (!employeeSalesMap.has(employeeId)) {
        employeeSalesMap.set(employeeId, {
          employeeId,
          employeeName,
          employeeCode,
          totalOrders: 0,
          totalRevenue: 0,
          totalQuantity: 0,
          ordersList: []
        })
      }

      const employeeData = employeeSalesMap.get(employeeId)

      // Calculate quantity for this order
      const orderQuantity = orderDetails
        .filter(detail => detail.order.toString() === order._id.toString())
        .reduce((sum, detail) => sum + detail.quantity, 0)

      employeeData.totalOrders += 1
      employeeData.totalRevenue += order.total
      employeeData.totalQuantity += orderQuantity
      employeeData.ordersList.push({
        orderId: order._id,
        orderNumber: order.orderNumber,
        customer: order.customer?.fullName || 'Guest',
        phone: order.customer?.phone || 'N/A',
        total: order.total,
        orderDate: order.orderDate,
        itemCount: orderQuantity
      })
    })

    // Convert Map to Array and calculate additional metrics
    const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0)
    const totalQuantitySold = orderDetails.reduce((sum, detail) => sum + detail.quantity, 0)

    const employees = Array.from(employeeSalesMap.values()).map(emp => ({
      employeeId: emp.employeeId,
      employeeName: emp.employeeName,
      employeeCode: emp.employeeCode,
      totalOrders: emp.totalOrders,
      totalRevenue: emp.totalRevenue,
      totalQuantity: emp.totalQuantity,
      averageOrderValue: emp.totalRevenue / emp.totalOrders,
      revenuePercentage: totalRevenue > 0 ? Math.round((emp.totalRevenue / totalRevenue) * 100) : 0,
      orders: emp.ordersList.sort((a, b) => b.orderDate - a.orderDate)
    }))

    // Sort by revenue descending and assign ranks
    employees.sort((a, b) => b.totalRevenue - a.totalRevenue)
    employees.forEach((emp, index) => {
      emp.rank = index + 1
    })

    // Calculate summary statistics
    const summary = {
      totalEmployees: employees.length,
      totalOrders: orders.length,
      totalRevenue,
      totalQuantitySold,
      averageOrderValue: totalRevenue / orders.length,
      topEmployee: employees.length > 0 ? {
        id: employees[0].employeeId,
        name: employees[0].employeeName,
        code: employees[0].employeeCode,
        revenue: employees[0].totalRevenue,
        orders: employees[0].totalOrders
      } : null
    }

    logger.info('Employee sales statistics calculated', {
      totalEmployees: employees.length,
      totalOrders: summary.totalOrders,
      totalRevenue: summary.totalRevenue
    })

    response.json({
      success: true,
      data: {
        summary,
        employees,
        dateRange: {
          startDate,
          endDate
        }
      }
    })
  } catch (error) {
    logger.error('Error getting employee sales statistics:', error)
    response.status(500).json({
      success: false,
      error: 'Failed to get employee sales statistics',
      message: error.message
    })
  }
})

/**
 * GET /api/statistics/customer-sales
 * Get customer sales ranking report
 * Query params: startDate (required), endDate (required), customerId (optional), includeGuests (optional, default: false)
 */
statisticsRouter.get('/customer-sales', async (request, response) => {
  try {
    const { startDate, endDate, customerId, includeGuests } = request.query

    // Validate required parameters
    if (!startDate || !endDate) {
      return response.status(400).json({
        success: false,
        error: 'Start date and end date are required'
      })
    }

    const shouldIncludeGuests = includeGuests === 'true'

    logger.info('Fetching customer sales statistics', { startDate, endDate, customerId, includeGuests: shouldIncludeGuests })

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

    // Find all delivered and paid orders in date range
    const orders = await Order.find(orderQuery)
      .populate({
        path: 'customer',
        select: 'customerCode fullName phone email customerType totalSpent'
      })
      .populate('createdBy', 'fullName')
      .sort({ orderDate: -1 })

    if (orders.length === 0) {
      return response.json({
        success: true,
        data: {
          summary: {
            totalCustomers: 0,
            totalOrders: 0,
            totalRevenue: 0,
            totalQuantity: 0,
            averageOrderValue: 0,
            guestOrders: 0,
            guestRevenue: 0,
            topCustomer: null
          },
          customers: [],
          dateRange: { startDate, endDate }
        }
      })
    }

    const orderIds = orders.map(order => order._id)

    // Get order details for quantity calculation
    const orderDetails = await OrderDetail.find({ order: { $in: orderIds } })

    // Map to organize data by customer
    const customerSalesMap = new Map()
    let guestOrdersData = {
      totalOrders: 0,
      totalRevenue: 0,
      totalQuantity: 0,
      ordersList: []
    }

    orders.forEach(order => {
      const customer = order.customer

      // Handle orders without customer (virtual guests) or guest customers
      if (!customer || customer.customerType === 'guest') {
        if (shouldIncludeGuests) {
          const orderDetailsForThisOrder = orderDetails.filter(d => d.order.toString() === order._id.toString())
          const orderQuantity = orderDetailsForThisOrder.reduce((sum, d) => sum + d.quantity, 0)

          guestOrdersData.totalOrders += 1
          guestOrdersData.totalRevenue += order.total
          guestOrdersData.totalQuantity += orderQuantity
          guestOrdersData.ordersList.push({
            orderId: order._id,
            orderNumber: order.orderNumber,
            customerName: customer?.fullName || 'Walk-in Customer',
            customerPhone: customer?.phone || 'N/A',
            itemCount: orderDetailsForThisOrder.length,
            total: order.total,
            orderDate: order.orderDate,
            employee: order.createdBy?.fullName || 'N/A'
          })
        }
        return
      }

      const customerId = customer._id.toString()
      const customerName = customer.fullName || 'Unknown'
      const customerCode = customer.customerCode || 'N/A'
      const customerPhone = customer.phone || 'N/A'
      const customerEmail = customer.email || 'N/A'
      const customerType = customer.customerType || 'retail'

      if (!customerSalesMap.has(customerId)) {
        customerSalesMap.set(customerId, {
          customerId,
          customerName,
          customerCode,
          customerPhone,
          customerEmail,
          customerType,
          totalOrders: 0,
          totalRevenue: 0,
          totalQuantity: 0,
          ordersList: []
        })
      }

      const custData = customerSalesMap.get(customerId)
      custData.totalOrders += 1
      custData.totalRevenue += order.total

      // Get order details quantity
      const orderDetailsForThisOrder = orderDetails.filter(d => d.order.toString() === order._id.toString())
      const orderQuantity = orderDetailsForThisOrder.reduce((sum, d) => sum + d.quantity, 0)
      custData.totalQuantity += orderQuantity

      custData.ordersList.push({
        orderId: order._id,
        orderNumber: order.orderNumber,
        itemCount: orderDetailsForThisOrder.length,
        total: order.total,
        orderDate: order.orderDate,
        employee: order.createdBy?.fullName || 'N/A'
      })
    })

    // Convert Map to Array and calculate additional metrics
    const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0)
    const totalQuantity = orderDetails.reduce((sum, detail) => sum + detail.quantity, 0)

    const customers = Array.from(customerSalesMap.values()).map(cust => ({
      customerId: cust.customerId,
      customerName: cust.customerName,
      customerCode: cust.customerCode,
      customerPhone: cust.customerPhone,
      customerEmail: cust.customerEmail,
      customerType: cust.customerType,
      totalOrders: cust.totalOrders,
      totalRevenue: cust.totalRevenue,
      totalQuantity: cust.totalQuantity,
      averageOrderValue: cust.totalRevenue / cust.totalOrders,
      revenuePercentage: totalRevenue > 0 ? Math.round((cust.totalRevenue / totalRevenue) * 100) : 0,
      orders: cust.ordersList.sort((a, b) => b.orderDate - a.orderDate)
    }))

    // Add guest data if included and has orders
    if (shouldIncludeGuests && guestOrdersData.totalOrders > 0) {
      customers.push({
        customerId: 'GUEST',
        customerName: 'Walk-in Customers',
        customerCode: 'GUEST',
        customerPhone: 'N/A',
        customerEmail: 'N/A',
        customerType: 'guest',
        totalOrders: guestOrdersData.totalOrders,
        totalRevenue: guestOrdersData.totalRevenue,
        totalQuantity: guestOrdersData.totalQuantity,
        averageOrderValue: guestOrdersData.totalRevenue / guestOrdersData.totalOrders,
        revenuePercentage: totalRevenue > 0 ? Math.round((guestOrdersData.totalRevenue / totalRevenue) * 100) : 0,
        orders: guestOrdersData.ordersList.sort((a, b) => b.orderDate - a.orderDate)
      })
    }

    // Sort by revenue descending and assign ranks
    customers.sort((a, b) => b.totalRevenue - a.totalRevenue)
    customers.forEach((cust, index) => {
      cust.rank = index + 1
    })

    // Calculate summary statistics
    const summary = {
      totalCustomers: customers.length,
      totalOrders: orders.length,
      totalRevenue,
      totalQuantity,
      averageOrderValue: totalRevenue / orders.length,
      guestOrders: guestOrdersData.totalOrders,
      guestRevenue: guestOrdersData.totalRevenue,
      topCustomer: customers.length > 0 ? {
        id: customers[0].customerId,
        name: customers[0].customerName,
        code: customers[0].customerCode,
        type: customers[0].customerType,
        revenue: customers[0].totalRevenue,
        orders: customers[0].totalOrders
      } : null
    }

    logger.info('Customer sales statistics calculated', {
      totalCustomers: customers.length,
      totalOrders: summary.totalOrders,
      totalRevenue: summary.totalRevenue,
      guestOrders: summary.guestOrders
    })

    response.json({
      success: true,
      data: {
        summary,
        customers,
        dateRange: {
          startDate,
          endDate
        }
      }
    })
  } catch (error) {
    logger.error('Error getting customer sales statistics:', error)
    response.status(500).json({
      success: false,
      error: 'Failed to get customer sales statistics',
      message: error.message
    })
  }
})

module.exports = statisticsRouter
