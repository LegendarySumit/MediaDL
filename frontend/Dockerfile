# Build stage
FROM node:18-alpine as builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --omit=dev

# Copy source code
COPY . .

# Build Next.js app
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Install serve to run the built app (or use Next.js built-in server)
RUN npm install -g serve

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm install --omit=dev

# Copy built app from builder
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.js ./
COPY --from=builder /app/package.json ./

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:3000 || exit 1

CMD ["npm", "run", "start"]
