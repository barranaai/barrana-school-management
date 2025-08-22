# Backend Dockerfile for Barrana AI School Management System
FROM node:18-alpine AS base

# Set working directory
WORKDIR /app

# Install system dependencies for sharp and other native modules
RUN apk add --no-cache \
    vips-dev \
    python3 \
    make \
    g++ \
    libc6-compat

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY . .

# Create necessary directories
RUN mkdir -p uploads/audio uploads/media uploads/logos logs

# Set proper permissions
RUN chown -R node:node /app
USER node

# Expose port
EXPOSE 5050

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5050/api/health || exit 1

# Start the application
CMD ["npm", "start"]
