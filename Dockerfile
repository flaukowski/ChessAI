# =============================================================================
# AudioNoise Web - Multi-stage Dockerfile
# =============================================================================
# Build stages:
# 1. deps - Install dependencies
# 2. builder - Build client and server
# 3. runner - Production runtime
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Dependencies
# -----------------------------------------------------------------------------
FROM node:20-alpine AS deps

WORKDIR /app

# Install build dependencies for native modules
RUN apk add --no-cache libc6-compat python3 make g++

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# -----------------------------------------------------------------------------
# Stage 2: Builder
# -----------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set production environment for build
ENV NODE_ENV=production

# Build the application
RUN npm run build

# Prune devDependencies after build
RUN npm prune --production

# -----------------------------------------------------------------------------
# Stage 3: Runner (Production)
# -----------------------------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 audionoiseuser

# Set production environment
ENV NODE_ENV=production
ENV PORT=5000

# Copy built application
COPY --from=builder --chown=audionoiseuser:nodejs /app/dist ./dist
COPY --from=builder --chown=audionoiseuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=audionoiseuser:nodejs /app/package.json ./package.json

# Copy static files if they exist
COPY --from=builder --chown=audionoiseuser:nodejs /app/dist/public ./dist/public

# Switch to non-root user
USER audionoiseuser

# Expose the port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/health || exit 1

# Start the application
CMD ["node", "dist/index.js"]
