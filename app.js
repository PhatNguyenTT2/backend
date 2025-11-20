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
// const paymentsRouter = require('./controllers/payments')
const inventoriesRouter = require('./controllers/inventories')
const detailInventoriesRouter = require('./controllers/detailInventories')
const inventoryMovementBatchesRouter = require('./controllers/inventoryMovementBatches')
const employeesRouter = require('./controllers/employees')
const employeePOSAuthsRouter = require('./controllers/employeePOSAuths')
const orderDetailsRouter = require('./controllers/orderDetails')
const productBatchesRouter = require('./controllers/productBatches')
// const stockOutOrdersRouter = require('./controllers/stockOutOrders')
// const detailCustomersRouter = require('./controllers/detailCustomers')
// const detailProductsRouter = require('./controllers/detailProducts')
const detailPurchaseOrdersRouter = require('./controllers/detailPurchaseOrders')
// const detailStockOutOrdersRouter = require('./controllers/detailStockOutOrders')
// const detailSuppliersRouter = require('./controllers/detailSuppliers')
const userAccountsRouter = require('./controllers/userAccounts')

const app = express()

logger.info('connecting to', config.MONGODB_URI)

mongoose
  .connect(config.MONGODB_URI)
  .then(async () => {
    logger.info('connected to MongoDB')
    // Auto-create default admin if none exists
  })
  .catch(error => {
    logger.error('error connection to MongoDB:', error.message)
  })

app.use(cors())
app.use(express.static('dist'))
app.use(express.json())
app.use(middleware.requestLogger)

// API Routes
// Authentication routes - PUBLIC (no auth middleware needed)
app.use('/api/login', loginRouter)
app.use('/api/pos-login', posLoginRouter)

// Protected routes
app.use('/api/products', productsRouter)
app.use('/api/roles', rolesRouter)
app.use('/api/categories', categoriesRouter)
app.use('/api/orders', ordersRouter)
app.use('/api/customers', customersRouter)
app.use('/api/suppliers', suppliersRouter)
app.use('/api/purchase-orders', purchaseOrdersRouter)
// app.use('/api/payments', paymentsRouter)
app.use('/api/inventories', inventoriesRouter)
app.use('/api/detail-inventories', detailInventoriesRouter)
app.use('/api/inventory-movement-batches', inventoryMovementBatchesRouter)
app.use('/api/employees', employeesRouter)
app.use('/api/pos-auth', employeePOSAuthsRouter)
app.use('/api/order-details', orderDetailsRouter)
app.use('/api/product-batches', productBatchesRouter)
app.use('/api/detail-purchase-orders', detailPurchaseOrdersRouter)
app.use('/api/user-accounts', userAccountsRouter)

if (process.env.NODE_ENV === 'test') {
  const testingRouter = require('./controllers/testing')
  app.use('/api/testing', testingRouter)
}

app.use(middleware.unknownEndpoint)
app.use(middleware.errorHandler)

module.exports = app
