# Dynamic Configuration System

## Overview
Migrated from hardcoded environment variables to dynamic API-based configuration. This enables production-ready deployments where frontend fetches config from backend at runtime.

## Architecture

### Backend (Config API)
**Endpoint**: `GET /api/config`
- **Location**: `controllers/config.js`
- **Route**: Registered in `index.js` (public, no auth required)
- **Returns**: Client-safe configuration (no secrets!)

**Response Example**:
```json
{
  "apiUrl": "http://localhost:3001",
  "socketUrl": "http://localhost:3001",
  "environment": "development",
  "features": {
    "vnpayEnabled": true,
    "realTimeNotifications": true
  },
  "settings": {
    "notificationRefreshInterval": 300000,
    "sessionTimeout": 3600000,
    "toastDuration": 10000
  },
  "timestamp": "2025-12-31T...",
  "version": "1.0.0"
}
```

### Frontend (Config Service)
**Service**: `services/configService.js`
- **Pattern**: Singleton with caching
- **Methods**:
  - `getConfig()` - Fetch and cache config
  - `refresh()` - Force reload config
  - `get(path, default)` - Get nested values
  - `subscribe(callback)` - Watch config changes

**Fallback Strategy**:
1. Try `VITE_API_BASE_URL` env variable (development)
2. Use `window.location.origin` (production - same domain)
3. Fallback to `localhost:3001` (last resort)

### Socket Service Integration
**Updated**: `services/socketService.js`
- Fetches config before connecting
- Uses `config.socketUrl` dynamically
- No hardcoded URLs

### Context Integration
**Updated**: `contexts/NotificationContext.jsx`
- Pre-loads config on mount
- Passes config to socket service
- Handles async initialization

## Benefits

### ✅ Production Ready
- No need to rebuild frontend for different environments
- Config changes = backend restart only
- Same frontend bundle works everywhere

### ✅ Security
- Secrets stay on backend
- Only public config exposed via API
- Controlled configuration exposure

### ✅ Flexibility
- Feature flags can be toggled remotely
- A/B testing capabilities
- Environment-specific settings

### ✅ Maintainability
- Single source of truth (backend)
- No duplicate `.env` files
- Easier deployment

## Migration Path

### Before (Hardcoded)
```javascript
// ❌ Hardcoded in frontend .env
const url = import.meta.env.VITE_API_BASE_URL
```

### After (Dynamic)
```javascript
// ✅ Fetched from backend API
const config = await configService.getConfig()
const url = config.apiUrl
```

## Usage Examples

### Basic Config Fetch
```javascript
import configService from '@/services/configService'

// Get entire config
const config = await configService.getConfig()
console.log(config.apiUrl)

// Get specific value
const toastDuration = configService.get('settings.toastDuration', 5000)
```

### Subscribe to Changes
```javascript
const unsubscribe = configService.subscribe((config) => {
  console.log('Config updated:', config)
})

// Later...
unsubscribe()
```

### Force Refresh
```javascript
// User clicks "Refresh Config" button
const newConfig = await configService.refresh()
```

## Deployment Scenarios

### Development
```
Backend: http://localhost:3001
Frontend: http://localhost:5173
Config API: http://localhost:3001/api/config
```

### Production (Same Domain)
```
Backend: https://api.example.com
Frontend: https://example.com
Config API: https://api.example.com/api/config
```

### Production (Different Domains)
```
Backend: https://api.example.com
Frontend: https://app.example.com
Config API: https://api.example.com/api/config
```
Set `VITE_API_BASE_URL=https://api.example.com` in build environment.

## Environment Variables

### Backend `.env`
```bash
PORT=3001
APP_URL=http://localhost:3001
FRONTEND_URL=http://localhost:5173
NODE_ENV=development
API_VERSION=1.0.0
```

### Frontend `.env` (Optional)
```bash
# Only needed if backend is on different domain
VITE_API_BASE_URL=http://localhost:3001
```

## Health Check
**Endpoint**: `GET /api/config/health`

Returns server health status:
```json
{
  "status": "healthy",
  "timestamp": "2025-12-31T...",
  "uptime": 12345,
  "environment": "development"
}
```

## Security Notes

### ⚠️ Never Expose
- JWT secrets
- Database credentials
- API keys
- Internal service URLs

### ✅ Safe to Expose
- Public API URLs
- Feature flags
- Client-side settings
- Environment name

## Testing

### Backend
```bash
curl http://localhost:3001/api/config
curl http://localhost:3001/api/config/health
```

### Frontend
```javascript
// In browser console
const config = await fetch('/api/config').then(r => r.json())
console.log(config)
```

## Troubleshooting

### Config fetch fails
- Check backend is running
- Verify CORS settings
- Check network tab for errors
- Config service falls back to hardcoded values

### Socket connection fails after migration
- Ensure config loads before socket connects
- Check `config.socketUrl` is correct
- Verify JWT token is valid

### Production build issues
- Set `VITE_API_BASE_URL` in build environment
- Ensure API endpoint is accessible
- Check CORS for production domain

## Future Enhancements

### Remote Feature Flags
```javascript
if (config.features.newFeature) {
  // Enable new feature
}
```

### A/B Testing
```javascript
const variant = config.experiments.homepageVariant
```

### Dynamic Theming
```javascript
const theme = config.ui.theme
```

### Rate Limiting Config
```javascript
const rateLimit = config.settings.apiRateLimit
```
