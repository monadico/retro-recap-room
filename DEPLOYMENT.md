# Retro Recap Room - Deployment Guide

## Overview
This application consists of two services:
- **Backend**: Node.js API server (port 3001)
- **Frontend**: React SPA served by nginx (port 80)

## Backend Deployment

### Coolify Configuration
- **App Type**: Dockerfile
- **Build Context**: `/` (repository root)
- **Dockerfile Path**: `dockerfiles/backend.Dockerfile`
- **Ports Exposes**: `3001`
- **Ports Mappings**: `3001:3001` (or your preferred external port)

### Environment Variables
```
DATA_DIR=/app/data
FRONTEND_ORIGIN=https://your-frontend-domain.com
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_CLIENT_SECRET=your_discord_client_secret
DISCORD_REDIRECT_URI=https://your-backend-domain/auth/discord/callback
CANVA_CONTRACT_ADDRESS=0x4fb2dB30c067e0116E70436b3f9773a643016884
SESSION_SECRET=your_session_secret_here
```

### Volumes
- **Source**: `/app/data` (persistent data directory)
- **Target**: Your persistent volume

## Frontend Deployment

### Coolify Configuration
- **App Type**: Dockerfile
- **Build Context**: `/` (repository root)
- **Dockerfile Path**: `dockerfiles/frontend.Dockerfile`
- **Ports Exposes**: `80`
- **Ports Mappings**: `80:80` (or your preferred external port)

### Environment Variables
```
VITE_API_BASE=https://your-backend-domain.com
```

## Testing

### Backend Health Check
```bash
curl https://your-backend-domain/api/health
```

### Frontend Health Check
```bash
curl https://your-frontend-domain/health
```

## Data Persistence
All application data is stored in `/app/data` on the backend container:
- User sessions
- Uploaded photos/videos
- X posts
- Canvas state
- Chat messages
- Gallery content

This directory should be mounted as a persistent volume to survive deployments.

## Network Configuration
- Backend: Exposes port 3001 internally
- Frontend: Exposes port 80 internally
- Coolify handles external port mapping
- Frontend communicates with backend via `VITE_API_BASE` environment variable

## Troubleshooting

### Common Issues
1. **502 Bad Gateway**: Check container logs, verify environment variables
2. **CORS errors**: Ensure `FRONTEND_ORIGIN` is set correctly
3. **Missing data**: Verify volume mounting for `/app/data`
4. **Build failures**: Check package.json dependencies and lock files

### Logs
- Backend logs: Available in Coolify app logs
- Frontend logs: Check nginx logs in container
- Health checks: Monitor `/api/health` and `/health` endpoints 