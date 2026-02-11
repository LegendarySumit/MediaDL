FROM python:3.11-slim

WORKDIR /app

# Install system dependencies (FFmpeg for audio handling, curl for health checks)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Always upgrade yt-dlp to latest version (YouTube fixes land frequently)
RUN pip install --no-cache-dir --upgrade yt-dlp

# Copy backend code
COPY . .

# Copy entrypoint and helper scripts
COPY entrypoint.sh /app/entrypoint.sh
COPY manage_cookies.py /app/manage_cookies.py
RUN chmod +x /app/entrypoint.sh

# Create downloads and logs directories
RUN mkdir -p downloads logs

EXPOSE 8001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8001/health || exit 1

# Use entrypoint to setup cookies and start app
ENTRYPOINT ["/app/entrypoint.sh"]
