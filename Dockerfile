# ─── Build stage ──────────────────────────────────────────────────────────────
FROM node:20-slim AS base

# Install system dependencies: ffmpeg + yt-dlp prerequisites
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    curl \
    ca-certificates \
    unzip \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Install Deno (required JS runtime for yt-dlp YouTube extraction)
RUN curl -fsSL https://deno.land/install.sh | sh
ENV DENO_INSTALL="/root/.deno"
ENV PATH="$DENO_INSTALL/bin:$PATH"

# Install latest yt-dlp binary
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
    -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

# Update yt-dlp to the absolute latest version
RUN yt-dlp -U || true

# ─── App ──────────────────────────────────────────────────────────────────────
WORKDIR /app

# Copy package files and install Node dependencies
COPY backend/package*.json ./backend/
RUN cd backend && npm install --omit=dev

# Copy all source files
COPY backend/ ./backend/

# Expose port (Render uses PORT env var)
EXPOSE 10000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:${PORT:-10000}/api/health || exit 1

# Start server
CMD ["node", "backend/server.js"]
