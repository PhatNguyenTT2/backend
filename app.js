const express = require('express')
const cors = require('cors')
const mongoose = require('mongoose')
const config = require('./utils/config')
const logger = require('./utils/logger')
const middleware = require('./utils/middleware')
const loginRouter = require('./controllers/login')
const productsRouter = require('./controllers/products')
const usersRouter = require('./controllers/users')
const rolesRouter = require('./controllers/roles')
const departmentsRouter = require('./controllers/departments')
const categoriesRouter = require('./controllers/categories')
const ordersRouter = require('./controllers/orders')
const customersRouter = require('./controllers/customers')
const suppliersRouter = require('./controllers/suppliers')
const purchaseOrdersRouter = require('./controllers/purchaseOrders')
const paymentsRouter = require('./controllers/payments')
const inventoryRouter = require('./controllers/inventory')
const reportsRouter = require('./controllers/reports')

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
app.use('/api/login', loginRouter)
app.use('/api/products', productsRouter)
app.use('/api/users', usersRouter)
app.use('/api/roles', rolesRouter)
app.use('/api/departments', departmentsRouter)
app.use('/api/categories', categoriesRouter)
app.use('/api/orders', ordersRouter)
app.use('/api/customers', customersRouter)
app.use('/api/suppliers', suppliersRouter)
app.use('/api/purchase-orders', purchaseOrdersRouter)
app.use('/api/payments', paymentsRouter)
app.use('/api/inventory', inventoryRouter)
app.use('/api/reports', reportsRouter)
// app.use('/api/cart', cartRouter)

if (process.env.NODE_ENV === 'test') {
  const testingRouter = require('./controllers/testing')
  app.use('/api/testing', testingRouter)
}

app.use(middleware.unknownEndpoint)
app.use(middleware.errorHandler)

module.exports = app
