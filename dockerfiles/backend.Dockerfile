# syntax=docker/dockerfile:1

# Backend Dockerfile (Coolify-friendly)
# - Build context: repository root
# - Dockerfile path: dockerfiles/backend.Dockerfile
# - Mount a persistent volume to /app/data for all runtime content

FROM node:18-bookworm-slim AS base
ENV NODE_ENV=production
WORKDIR /app/backend

# Install production deps only
COPY backend/package*.json ./
RUN npm ci --omit=dev

# Copy backend source
COPY backend/ ./

# Persistent data directory (bind this to a volume in Coolify)
ENV DATA_DIR=/app/data
RUN mkdir -p ${DATA_DIR}

# Optional: add a non-root user (comment out if your platform requires root)
# RUN useradd -ms /bin/bash appuser \
#  && chown -R appuser:appuser /app
# USER appuser

EXPOSE 3001

# Healthcheck (expects /api/health route)
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch(process.env.HEALTH_URL||'http://127.0.0.1:3001/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "server.js"]


