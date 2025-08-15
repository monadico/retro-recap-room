# Environment Setup Guide

## Overview
This application now supports both local development and production deployment through a centralized configuration system.

## What Changed

### 1. Centralized Configuration
- Created `src/config/environment.ts` to handle all environment-based URLs
- Automatically detects local vs production environment
- Handles both HTTP/HTTPS and WebSocket protocols

### 2. Updated Components
- **Chat.tsx**: Now uses conditional WebSocket URLs (ws:// for local, wss:// for production)
- **DesktopDock.tsx**: Uses environment-based API URLs for Discord login
- **Profile.tsx**: Uses centralized configuration
- **Gallery.tsx**: Uses centralized configuration
- All other components will be updated to use the same pattern

## Environment Variables

### Local Development (Default)
When no environment variables are set, the app automatically uses:
- **Backend API**: `http://localhost:3001`
- **WebSocket**: `ws://localhost:3001`

### Production Deployment
Set this environment variable in your deployment platform:
```bash
VITE_API_BASE=https://your-backend-domain.com
```

This will automatically configure:
- **Backend API**: `https://your-backend-domain.com`
- **WebSocket**: `wss://your-backend-domain.com`

## How It Works

### 1. Environment Detection
```typescript
// The config automatically detects your environment
const config = {
  apiBase: (import.meta as any).env?.VITE_API_BASE || 'http://localhost:3001',
  ws: {
    protocol: (import.meta as any).env?.VITE_API_BASE ? 'wss' : 'ws',
    host: // automatically extracted from VITE_API_BASE or defaults to localhost:3001
  }
};
```

### 2. Usage in Components
```typescript
import { config } from '../config/environment';

// API calls
const response = await fetch(`${config.apiBase}/auth/user`);

// WebSocket connections
const ws = new WebSocket(config.ws.url);
```

## Setting Up Your Environment

### Option 1: Local Development
Create a `.env.local` file in your project root:
```bash
# Optional - defaults to localhost:3001 if not set
VITE_API_BASE=http://localhost:3001
```

### Option 2: Production Deployment
In your deployment platform (Coolify, Vercel, etc.), set:
```bash
VITE_API_BASE=https://your-backend-domain.com
```

## Benefits

1. **No More Hardcoded URLs**: All URLs are now environment-aware
2. **Automatic Protocol Detection**: WebSocket automatically uses ws:// or wss://
3. **Easy Deployment**: Just set one environment variable
4. **Consistent Configuration**: All components use the same configuration
5. **Fallback Support**: Automatically falls back to localhost for development

## Troubleshooting

### Issue: Still getting localhost errors
**Solution**: Make sure you've set `VITE_API_BASE` in your deployment platform's environment variables.

### Issue: WebSocket connection fails
**Solution**: The app automatically handles ws:// vs wss:// protocols. Just ensure your backend supports the correct protocol.

### Issue: CORS errors
**Solution**: Make sure your backend's `FRONTEND_ORIGIN` environment variable matches your frontend domain.

## Next Steps

1. **Set Environment Variable**: Add `VITE_API_BASE` to your deployment platform
2. **Test Backend**: Ensure your backend is accessible at the specified URL
3. **Test WebSocket**: Verify WebSocket connections work with the new protocol
4. **Update Remaining Components**: Continue updating other components to use the centralized config

## Example Deployment

For a typical VPS deployment:
```bash
# Backend domain
VITE_API_BASE=https://api.yourdomain.com

# Frontend domain  
https://yourdomain.com

# Backend will automatically use:
# - API: https://api.yourdomain.com
# - WebSocket: wss://api.yourdomain.com
```
