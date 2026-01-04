const http = require('http')
const app = require('./app')
const config = require('./utils/config')
const logger = require('./utils/logger')

// Create HTTP server
const server = http.createServer(app)

// Setup Socket.IO
const io = require('socket.io')(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production'
      ? [process.env.FRONTEND_URL, process.env.APP_URL].filter(Boolean)
      : ['http://localhost:5173', 'http://localhost:3001'],
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling']
})

// Socket.IO authentication middleware
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token

  if (!token) {
    logger.warn('Socket connection attempted without token')
    return next(new Error('Authentication required'))
  }

  try {
    const jwt = require('jsonwebtoken')
    const UserAccount = require('./models/userAccount')
    const { PERMISSIONS, SUPER_ADMIN_PERMISSION } = require('./utils/constants')

    const decodedToken = jwt.verify(token, config.JWT_SECRET)

    // Fetch user with role and permissions
    const user = await UserAccount.findById(decodedToken.id).populate('role')

    if (!user) {
      logger.warn('Socket authentication failed: User not found', { userId: decodedToken.id })
      return next(new Error('User not found'))
    }

    // Check if user has VIEW_NOTIFICATIONS permission
    const userPermissions = user.role?.permissions || []
    const hasNotificationPermission = userPermissions.includes(PERMISSIONS.VIEW_NOTIFICATIONS)
      || userPermissions.includes(SUPER_ADMIN_PERMISSION)

    if (!hasNotificationPermission) {
      logger.warn('Socket connection denied: Missing VIEW_NOTIFICATIONS permission', {
        userId: user.id,
        username: user.username,
        role: user.role?.roleName
      })
      return next(new Error('Insufficient permissions to view notifications'))
    }

    socket.userId = decodedToken.id
    socket.username = decodedToken.username
    socket.userRole = user.role?.roleName
    logger.info('Socket authenticated with notification permission', {
      userId: decodedToken.id,
      username: decodedToken.username,
      role: user.role?.roleName
    })
    next()
  } catch (error) {
    logger.error('Socket authentication failed:', error.message)
    return next(new Error('Invalid token'))
  }
})

// Socket.IO connection handling
io.on('connection', (socket) => {
  logger.info('Client connected', {
    socketId: socket.id,
    userId: socket.userId,
    username: socket.username
  })

  socket.on('disconnect', (reason) => {
    logger.info('Client disconnected', {
      socketId: socket.id,
      userId: socket.userId,
      reason
    })
  })

  socket.on('error', (error) => {
    logger.error('Socket error:', { socketId: socket.id, error: error.message })
  })

  // Handle notification fetch request
  socket.on('notification:fetch', async () => {
    logger.info('Notification fetch requested', { socketId: socket.id })
    try {
      const notificationEmitter = require('./services/notificationEmitter')
      const notifications = await notificationEmitter.getAllNotifications()
      socket.emit('notification:initial', notifications)
      logger.info('Sent initial notifications', { socketId: socket.id, count: notifications.length })
    } catch (error) {
      logger.error('Failed to fetch notifications:', error)
      socket.emit('notification:error', { message: 'Failed to load notifications' })
    }
  })

  // Handle notification mark as read
  socket.on('notification:mark_read', (notificationId) => {
    logger.info('Notification marked as read', { socketId: socket.id, notificationId })
  })
})

// Make io accessible to other modules
app.set('io', io)

// Initialize notification emitter with Socket.IO
const notificationEmitter = require('./services/notificationEmitter')
notificationEmitter.initialize(io)

server.listen(config.PORT, () => {
  logger.info(`Server running on port ${config.PORT}`)
  logger.info(`Socket.IO ready on port ${config.PORT}`)
  logger.info(`Config API available at http://localhost:${config.PORT}/api/config`)
})
