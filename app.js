const express = require('express')
const cors = require('cors')
const mongoose = require('mongoose')
const config = require('./utils/config')
const logger = require('./utils/logger')
const middleware = require('./utils/middleware')
const productsRouter = require('./controllers/products')
const loginRouter = require('./controllers/login')
const posLoginRouter = require('./controllers/posLogin')
const rolesRouter = require('./controllers/roles')
const categoriesRouter = require('./controllers/categories')
const ordersRouter = require('./controllers/orders')
const customersRouter = require('./controllers/customers')
const suppliersRouter = require('./controllers/suppliers')
const purchaseOrdersRouter = require('./controllers/purchaseOrders')
const paymentsRouter = require('./controllers/payments')
const inventoriesRouter = require('./controllers/inventories')
const detailInventoriesRouter = require('./controllers/detailInventories')
const inventoryMovementBatchesRouter = require('./controllers/inventoryMovementBatches')
const employeesRouter = require('./controllers/employees')
const employeePOSAuthsRouter = require('./controllers/employeePOSAuths')
const orderDetailsRouter = require('./controllers/orderDetails')
const productBatchesRouter = require('./controllers/productBatches')
const stockOutOrdersRouter = require('./controllers/stockOutOrders')
// const detailCustomersRouter = require('./controllers/detailCustomers')
// const detailProductsRouter = require('./controllers/detailProducts')
const detailPurchaseOrdersRouter = require('./controllers/detailPurchaseOrders')
const detailStockOutOrdersRouter = require('./controllers/detailStockOutOrders')
// const detailSuppliersRouter = require('./controllers/detailSuppliers')
const userAccountsRouter = require('./controllers/userAccounts')
const settingsRouter = require('./controllers/settings')
const customerDiscountSettingsRouter = require('./controllers/customerDiscountSettings')
const permissionsRouter = require('./controllers/permissions')
const statisticsRouter = require('./controllers/statistics')
const vnpayRouter = require('./controllers/vnpay')
const locationMastersRouter = require('./controllers/locationMasters')
const configController = require('./controllers/config')
const promotionScheduler = require('./services/promotionScheduler')
const notificationScheduler = require('./services/notificationScheduler')
const notificationEmitter = require('./services/notificationEmitter')

const app = express()

// Make notificationEmitter accessible via app
app.set('notificationEmitter', notificationEmitter)

logger.info('connecting to', config.MONGODB_URI)

mongoose
  .connect(config.MONGODB_URI)
  .then(async () => {
    logger.info('connected to MongoDB')

    // Initialize fresh product promotion scheduler
    await promotionScheduler.init()

    // Initialize notification scheduler
    await notificationScheduler.init()
  })
  .catch(error => {
    logger.error('error connection to MongoDB:', error.message)
  })

app.use(cors())
app.use(express.static('dist'))
app.use(express.json())
// CRITICAL: Use native querystring parser for VNPay signature verification
// This prevents Express from creating nested objects from query params
app.set('query parser', (str) => {
  return require('querystring').parse(str);
})

// URL Normalization middleware: Fix double slashes (e.g., //api -> /api)
// This is crucial for VNPay return URLs that may have accidental double slashes
app.use((req, res, next) => {
  if (req.path.includes('//')) {
    const normalizedUrl = req.url.replace(/\/+/g, '/')
    logger.info(`URL normalized: ${req.url} -> ${normalizedUrl}`)
    return res.redirect(301, normalizedUrl)
  }
  next()
})

app.use(middleware.requestLogger)

// API Routes
// Authentication routes - PUBLIC (no auth middleware needed)
app.use('/api/login', loginRouter)
app.use('/api/pos-login', posLoginRouter)

// Config routes - PUBLIC (no auth required)
app.get('/api/config', configController.getClientConfig)
app.get('/api/config/health', configController.healthCheck)

// Protected routes
app.use('/api/products', productsRouter)
app.use('/api/roles', rolesRouter)
app.use('/api/categories', categoriesRouter)
app.use('/api/orders', ordersRouter)
app.use('/api/customers', customersRouter)
app.use('/api/suppliers', suppliersRouter)
app.use('/api/purchase-orders', purchaseOrdersRouter)
app.use('/api/payments', paymentsRouter)
app.use('/api/inventories', inventoriesRouter)
app.use('/api/detail-inventories', detailInventoriesRouter)
app.use('/api/inventory-movement-batches', inventoryMovementBatchesRouter)
app.use('/api/employees', employeesRouter)
app.use('/api/pos-auth', employeePOSAuthsRouter)
app.use('/api/order-details', orderDetailsRouter)
app.use('/api/product-batches', productBatchesRouter)
app.use('/api/stock-out-orders', stockOutOrdersRouter)
app.use('/api/detail-purchase-orders', detailPurchaseOrdersRouter)
app.use('/api/detail-stock-out-orders', detailStockOutOrdersRouter)
app.use('/api/user-accounts', userAccountsRouter)
app.use('/api/settings', settingsRouter)
app.use('/api/customer-discount-settings', customerDiscountSettingsRouter)
app.use('/api/permissions', permissionsRouter)
app.use('/api/statistics', statisticsRouter)
app.use('/api/vnpay', vnpayRouter)
app.use('/api/location-masters', locationMastersRouter)

if (process.env.NODE_ENV === 'test') {
  const testingRouter = require('./controllers/testing')
  app.use('/api/testing', testingRouter)
}

// SPA fallback: serve index.html for non-API routes
// This allows direct navigation to /pos-login, /dashboard, etc.
const pathModule = require('path')
app.use((req, res, next) => {
  // Normalize path to handle double slashes (e.g., //api/vnpay/return -> /api/vnpay/return)
  const normalizedPath = req.path.replace(/\/+/g, '/')

  // Skip API routes and Socket.IO - let Express router handle them
  if (normalizedPath.startsWith('/api/') || normalizedPath.startsWith('/socket.io/')) {
    return next()
  }

  // For all other routes, serve index.html (SPA routing)
  const indexPath = pathModule.join(__dirname, 'dist', 'index.html')

  res.sendFile(indexPath, (err) => {
    if (err) {
      logger.error('Failed to serve index.html:', err)
      next() // Let unknownEndpoint handle it
    }
    // Do NOT call next() on success - we've sent the response
  })
})

app.use(middleware.unknownEndpoint)
app.use(middleware.errorHandler)

module.exports = app
