# Real-Time Notification System

## Overview
WebSocket-based real-time notification system using Socket.IO for instant alerts about inventory issues, supplier credit warnings, and low stock levels.

## Architecture

### Backend (Node.js + Socket.IO)
- **Socket.IO Server** (`index.js`): WebSocket server with JWT authentication
- **Notification Emitter** (`services/notificationEmitter.js`): Service to broadcast notifications
- **Notification Scheduler** (`services/notificationScheduler.js`): Cron jobs for periodic checks
  - Batch expiry check: Every hour
  - Low stock check: Every 2 hours  
  - Supplier credit check: Every 6 hours

### Frontend (React + Socket.IO Client)
- **Socket Service** (`services/socketService.js`): WebSocket client management
- **Notification Context** (`contexts/NotificationContext.jsx`): Global notification state
- **Toast Components** (`components/ToastNotification/`): Real-time toast notifications
- **Notification Dropdown**: Updated to use real-time data from context

## Features

### Notification Types
1. **Inventory Expiry**
   - `expired_on_shelf` (Critical): Expired products still on shelf
   - `expired_in_warehouse` (High): Expired products in warehouse
   - `expiring_soon` (Warning): Products expiring within 30 days

2. **Stock Levels**
   - `low_stock` (Warning): Stock below threshold (10 units)

3. **Supplier Credit**
   - `credit_exceeded` (Critical): Debt exceeds credit limit
   - `credit_near_limit` (High): 90-100% credit utilization
   - `credit_high_utilization` (Warning): 80-89% credit utilization

### Real-Time Features
- ✅ Instant toast notifications appear in bottom-right corner
- ✅ Live badge counter updates without page refresh
- ✅ WebSocket connection status indicator
- ✅ Auto-reconnection on connection loss
- ✅ JWT authentication for socket connections
- ✅ Optional sound notifications

## Setup Instructions

### 1. Backend Setup
```bash
cd backend
npm install
```

Add to `.env`:
```
FRONTEND_URL=http://localhost:5173
```

### 2. Frontend Setup
```bash
cd admin
npm install
```

Add to `.env`:
```
VITE_API_BASE_URL=http://localhost:3000
```

### 3. Run Application
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd admin
npm run dev
```

## Usage

### Automatic Notifications
The system automatically checks and emits notifications:
- Initial check on server startup
- Periodic checks via cron jobs
- Real-time broadcast to all connected clients

### Manual Trigger (Optional)
To manually trigger notification checks, you can add API endpoints or use the scheduler directly.

### Toast Notifications
- Appear automatically when new notifications arrive
- Auto-dismiss after 10 seconds
- Click X to dismiss immediately
- Different colors for severity levels:
  - Red: Critical
  - Orange: High priority
  - Yellow/Amber: Warning
  - Blue: Info

### Notification Dropdown
- Bell icon shows total notification count
- Live indicator when WebSocket connected
- Real-time updates without manual refresh
- Click "Refresh" for fallback polling

## Socket Events

### Client → Server
- `notification:fetch` - Request notification list
- `notification:mark_read` - Mark notification as read

### Server → Client
- `notification:inventory:expired` - Expired batch alert
- `notification:inventory:expiring` - Expiring soon alert
- `notification:stock:low` - Low stock alert
- `notification:supplier:credit` - Supplier credit warning

## Configuration

### Notification Thresholds
Edit in `services/notificationScheduler.js`:
```javascript
const threshold = 10 // Low stock threshold
const thirtyDaysFromNow // Expiring soon threshold
const creditUtilization >= 80 // Credit warning threshold
```

### Cron Schedules
Edit in `services/notificationScheduler.js`:
```javascript
'0 * * * *'     // Every hour - Batch expiry
'0 */2 * * *'   // Every 2 hours - Low stock
'0 */6 * * *'   // Every 6 hours - Supplier credit
```

### Toast Auto-Dismiss Time
Edit in `contexts/NotificationContext.jsx`:
```javascript
setTimeout(() => {
  removeToast(toast.toastId)
}, 10000) // 10 seconds
```

## Troubleshooting

### WebSocket Connection Issues
- Check CORS settings in `index.js`
- Verify `VITE_API_BASE_URL` in frontend `.env`
- Check JWT token is valid in localStorage
- Check server logs for authentication errors

### Notifications Not Appearing
- Check browser console for Socket.IO errors
- Verify NotificationProvider wraps your app
- Check if notifications exist in database
- Run manual notification check

### Toast Not Showing
- Check CSS animations in `index.css`
- Verify ToastContainer is rendered in Layout
- Check z-index conflicts with other UI elements

## Development

### Adding New Notification Types
1. Add emitter method in `notificationEmitter.js`
2. Add socket event listener in `socketService.js`
3. Update toast rendering logic if needed
4. Add trigger logic in scheduler or model hooks

### Testing
```bash
# Backend
npm test

# Frontend  
npm run dev
```

## Security
- JWT authentication required for socket connections
- Token validated on every connection
- Automatic disconnection on invalid token
- CORS configured for specific origins only

## Performance
- Lightweight WebSocket protocol
- Efficient cron scheduling
- Notification deduplication by ID
- Auto-cleanup of old toasts
- Reconnection with exponential backoff

## Browser Support
- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support
- Mobile browsers: ✅ Supported
