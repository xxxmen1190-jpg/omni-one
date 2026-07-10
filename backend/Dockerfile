# ─── Build Stage ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Install build tools and OpenSSL for Prisma
RUN apk add --no-cache openssl

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package files
COPY package.json ./

# Install dependencies
RUN pnpm install

# Copy source code and Prisma schema
COPY tsconfig.json ./
COPY src/ ./src/
COPY prisma/ ./prisma/

# Generate Prisma client
RUN pnpm dlx prisma generate

# Build TypeScript code
RUN pnpm run build

# ─── Production Stage ────────────────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

# Install OpenSSL for Prisma and curl for healthchecks
RUN apk add --no-cache openssl curl

# Set production environment
ENV NODE_ENV=production

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package files
COPY package.json ./

# Install only production dependencies
RUN pnpm install --prod

# Copy built artifacts and Prisma from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Create storage directory for local uploads
RUN mkdir -p storage && chown -R node:node storage

# Switch to non-root user
USER node

# Expose backend port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# Start the application
CMD ["node", "dist/server/index.js"]
