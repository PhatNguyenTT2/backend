import { io } from 'socket.io-client'
import configService from './configService'

/**
 * Socket.IO Client Service
 * Manages WebSocket connection for real-time notifications
 */
class SocketService {
  constructor() {
    this.socket = null
    this.connected = false
    this.listeners = new Map()
    this.config = null
  }

  /**
   * Connect to Socket.IO server
   * @param {string} token - JWT authentication token
   */
  async connect(token) {
    if (this.socket?.connected) {
      console.log('Socket already connected')
      return
    }

    try {
      // Fetch config from backend
      this.config = await configService.getConfig()
      const serverUrl = this.config.socketUrl

      console.log('[SocketService] Connecting to:', serverUrl)

      this.socket = io(serverUrl, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5
      })

      this.setupEventHandlers()
    } catch (error) {
      console.error('[SocketService] Connection failed:', error)
      throw error
    }
  }

  /**
   * Setup default event handlers
   */
  setupEventHandlers() {
    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket.id)
      this.connected = true
    })

    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason)
      this.connected = false
    })

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error.message)
    })

    this.socket.on('error', (error) => {
      console.error('Socket error:', error)
    })

    // Handle notification events
    this.socket.on('notification:inventory:expired', (data) => {
      this.emit('notification', data)
    })

    this.socket.on('notification:inventory:expiring', (data) => {
      this.emit('notification', data)
    })

    this.socket.on('notification:stock:low', (data) => {
      this.emit('notification', data)
    })

    this.socket.on('notification:supplier:credit', (data) => {
      this.emit('notification', data)
    })

    // Handle initial notifications load
    this.socket.on('notification:initial', (notifications) => {
      console.log('[SocketService] Received initial notifications:', notifications.length)
      this.emit('notification:initial', notifications)
    })

    this.socket.on('notification:error', (error) => {
      console.error('[SocketService] Notification error:', error)
      this.emit('notification:error', error)
    })
  }

  /**
   * Register event listener
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event).push(callback)
  }

  /**
   * Unregister event listener
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   */
  off(event, callback) {
    if (!this.listeners.has(event)) return

    const callbacks = this.listeners.get(event)
    const index = callbacks.indexOf(callback)
    if (index > -1) {
      callbacks.splice(index, 1)
    }
  }

  /**
   * Emit event to local listeners
   * @param {string} event - Event name
   * @param {any} data - Event data
   */
  emit(event, data) {
    if (!this.listeners.has(event)) return

    const callbacks = this.listeners.get(event)
    callbacks.forEach(callback => {
      try {
        callback(data)
      } catch (error) {
        console.error('Error in socket listener:', error)
      }
    })
  }

  /**
   * Send event to server
   * @param {string} event - Event name
   * @param {any} data - Event data
   */
  send(event, data) {
    if (!this.socket?.connected) {
      console.warn('Socket not connected, cannot send event:', event)
      return
    }

    this.socket.emit(event, data)
  }

  /**
   * Request notification fetch from server
   */
  fetchNotifications() {
    this.send('notification:fetch')
  }

  /**
   * Mark notification as read
   * @param {string} notificationId - Notification ID
   */
  markNotificationRead(notificationId) {
    this.send('notification:mark_read', notificationId)
  }

  /**
   * Disconnect socket
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
      this.connected = false
      this.listeners.clear()
      console.log('Socket disconnected')
    }
  }

  /**
   * Check if socket is connected
   */
  isConnected() {
    return this.connected && this.socket?.connected
  }
}

// Export singleton instance
const socketService = new SocketService()
export default socketService
