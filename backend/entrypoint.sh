#!/bin/bash
# Entrypoint script for MediaDL backend
# Sets up cookies from environment variable if provided, then starts the app

# Setup cookies from environment variable if provided
if [ ! -z "$YOUTUBE_COOKIES_BASE64" ]; then
    echo "Setting up YouTube cookies from YOUTUBE_COOKIES_BASE64..."
    python /app/manage_cookies.py setup
fi

# Start the application
echo "Starting MediaDL backend..."
uvicorn main:app --host 0.0.0.0 --port 8001
