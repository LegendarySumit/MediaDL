#!/bin/bash
# Entrypoint script for MediaDL backend
# Sets up cookies from environment variable if provided, then starts the app

set -e

# Setup cookies from environment variable if provided
if [ ! -z "$YOUTUBE_COOKIES_BASE64" ]; then
    echo "🔧 Setting up YouTube cookies from YOUTUBE_COOKIES_BASE64..."
    python /app/manage_cookies.py setup
    if [ $? -eq 0 ]; then
        echo "✓ Cookies loaded successfully"
    else
        echo "⚠ Warning: Failed to load cookies from environment, continuing without them"
    fi
elif [ -f "/app/cookies.txt" ]; then
    echo "✓ Using existing cookies.txt file"
else
    echo "⚠ Warning: No YouTube cookies found. Some videos may fail."
fi

# Start the application
echo "🚀 Starting MediaDL backend..."
exec uvicorn main:app --host 0.0.0.0 --port 8001
