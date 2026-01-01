import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import socketService from '../services/socketService'
import configService from '../services/configService'
import authService from '../services/authService'
import { hasPermission, PERMISSIONS } from '../utils/permissions'

const NotificationContext = createContext()

export const useNotifications = () => {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider')
  }
  return context
}

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([])
  const [toasts, setToasts] = useState([])
  const [counts, setCounts] = useState({ total: 0, critical: 0, high: 0, warning: 0 })
  const [isConnected, setIsConnected] = useState(false)

  // Track shown toast IDs to prevent duplicates
  const shownToastIds = useState(() => new Set())[0]

  // Remove toast
  const removeToast = useCallback((toastId) => {
    setToasts(prev => prev.filter(t => t.toastId !== toastId))
  }, [])

  // Add toast notification (with duplicate check)
  const addToast = useCallback((notification) => {
    // Prevent duplicate toasts for same notification
    if (shownToastIds.has(notification.id)) {
      console.log('[NotificationContext] Skipping duplicate toast for:', notification.id)
      return
    }

    shownToastIds.add(notification.id)

    const toast = {
      ...notification,
      toastId: `toast-${notification.id}-${Date.now()}`
    }

    setToasts(prev => [...prev, toast])

    // Auto remove toast after 10 seconds
    setTimeout(() => {
      removeToast(toast.toastId)
      // Clear from shown set after a delay to allow re-showing if needed
      setTimeout(() => {
        shownToastIds.delete(notification.id)
      }, 5000)
    }, 10000)
  }, [removeToast, shownToastIds])

  // Add new notification
  const addNotification = useCallback((notification) => {
    let isNew = false

    setNotifications(prev => {
      // Check if notification already exists
      const exists = prev.some(n => n.id === notification.id)
      if (exists) {
        return prev
      }

      isNew = true
      const newNotifications = [notification, ...prev]

      // Update counts
      const newCounts = {
        total: newNotifications.length,
        critical: newNotifications.filter(n => n.severity === 'critical').length,
        high: newNotifications.filter(n => n.severity === 'high').length,
        warning: newNotifications.filter(n => n.severity === 'warning').length
      }
      setCounts(newCounts)

      return newNotifications
    })

    // Only add toast if notification is truly new
    // Note: We use a separate check because setState callback runs async
    addToast(notification)
  }, [addToast])

  // Set initial notifications (from API, no toast)
  const setInitialNotifications = useCallback((notificationList) => {
    setNotifications(notificationList)

    // Update counts
    const newCounts = {
      total: notificationList.length,
      critical: notificationList.filter(n => n.severity === 'critical').length,
      high: notificationList.filter(n => n.severity === 'high').length,
      warning: notificationList.filter(n => n.severity === 'warning').length
    }
    setCounts(newCounts)
  }, [])

  // Clear all notifications
  const clearNotifications = useCallback(() => {
    setNotifications([])
    setCounts({ total: 0, critical: 0, high: 0, warning: 0 })
  }, [])

  // Use refs to avoid re-registering listeners when callbacks change
  const addNotificationRef = useRef(addNotification)
  const setInitialNotificationsRef = useRef(setInitialNotifications)

  useEffect(() => {
    addNotificationRef.current = addNotification
    setInitialNotificationsRef.current = setInitialNotifications
  }, [addNotification, setInitialNotifications])

  // Initialize socket connection - empty deps to run only once
  useEffect(() => {
    const token = authService.getToken()
    if (!token) {
      console.log('[NotificationContext] No token found, skipping socket connection')
      return
    }

    // Check if user has VIEW_NOTIFICATIONS permission
    const currentUser = authService.getUser()
    const hasNotificationPermission = hasPermission(currentUser, PERMISSIONS.VIEW_NOTIFICATIONS)

    if (!hasNotificationPermission) {
      console.log('[NotificationContext] User does not have VIEW_NOTIFICATIONS permission, skipping socket connection', {
        user: currentUser?.username,
        permissions: currentUser?.permissions
      })
      return
    }

    console.log('[NotificationContext] User has VIEW_NOTIFICATIONS permission, initializing socket')

    let isInitialized = false
    let isMounted = true

    // Initialize configuration and socket connection
    const initializeConnection = async () => {
      if (isInitialized || !isMounted) return
      isInitialized = true

      try {
        // Pre-load config (socket service will use it)
        console.log('[NotificationContext] Loading configuration...')
        await configService.getConfig()

        if (!isMounted) return

        // Connect to socket
        console.log('[NotificationContext] Connecting to socket...')
        await socketService.connect(token)

        if (!isMounted) return

        setIsConnected(socketService.isConnected())

        // Request initial notifications after successful connection
        if (socketService.isConnected()) {
          console.log('[NotificationContext] Requesting initial notifications...')
          socketService.fetchNotifications()
        }
      } catch (error) {
        console.error('[NotificationContext] Initialization failed:', error)
        // Show user-friendly error if permission denied
        if (error.message?.includes('permission')) {
          console.warn('[NotificationContext] Permission denied: Cannot view notifications')
        }
      }
    }

    initializeConnection()

    // Listen for connection status changes
    const handleConnect = () => {
      console.log('[NotificationContext] Socket connected')
      setIsConnected(true)
    }

    const handleDisconnect = () => {
      console.log('[NotificationContext] Socket disconnected')
      setIsConnected(false)
    }

    // Listen for real-time notifications - use refs to get latest callback
    const handleNotification = (notification) => {
      console.log('[NotificationContext] Received real-time notification:', notification)
      addNotificationRef.current(notification)
      playNotificationSound()
    }

    // Listen for initial notifications load
    const handleInitialNotifications = (notificationList) => {
      console.log('[NotificationContext] Received initial notifications:', notificationList.length)
      setInitialNotificationsRef.current(notificationList)
    }

    // Listen for notification refresh (batch updates/resolves)
    const handleRefreshNotifications = (notificationList) => {
      console.log('[NotificationContext] Notification refresh - replacing all notifications:', notificationList.length)
      setInitialNotificationsRef.current(notificationList) // Replace with fresh data, no toasts
    }

    socketService.on('notification', handleNotification)
    socketService.on('notification:initial', handleInitialNotifications)
    socketService.on('notification:refresh', handleRefreshNotifications)
    socketService.on('connect', handleConnect)
    socketService.on('disconnect', handleDisconnect)

    // Cleanup - these are the exact same function references, so off() will work
    return () => {
      isMounted = false
      socketService.off('notification', handleNotification)
      socketService.off('notification:initial', handleInitialNotifications)
      socketService.off('notification:refresh', handleRefreshNotifications)
      socketService.off('connect', handleConnect)
      socketService.off('disconnect', handleDisconnect)
    }
  }, []) // Empty deps - run only once on mount

  // Play notification sound
  const playNotificationSound = () => {
    try {
      const audio = new Audio('/notification-sound.mp3')
      audio.volume = 0.3
      audio.play().catch(err => {
        console.log('Could not play notification sound:', err.message)
      })
    } catch (error) {
      console.log('Notification sound error:', error)
    }
  }

  const value = {
    notifications,
    toasts,
    counts,
    isConnected,
    addNotification,
    setInitialNotifications,
    removeToast,
    clearNotifications
  }

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  )
}
