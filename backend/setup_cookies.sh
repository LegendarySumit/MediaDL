#!/bin/bash
# Setup YouTube cookies from environment variable (if provided)
# This script loads cookies from YOUTUBE_COOKIES_BASE64 environment variable
# Usage: source setup_cookies.sh (or call before starting app)

if [ ! -z "$YOUTUBE_COOKIES_BASE64" ]; then
    echo "Setting up YouTube cookies from environment variable..."
    echo "$YOUTUBE_COOKIES_BASE64" | base64 -d > /app/cookies.txt
    chmod 600 /app/cookies.txt
    echo "✓ YouTube cookies loaded from environment variable"
elif [ -f "/app/cookies.txt" ]; then
    echo "✓ Using existing cookies.txt file ($(wc -c < /app/cookies.txt) bytes)"
else
    echo "⚠ No YouTube cookies found. Some videos may fail to download."
    echo "  To provide cookies:"
    echo "  1. Export cookies as base64: base64 -w0 cookies.txt > cookies.b64"
    echo "  2. Set environment variable: YOUTUBE_COOKIES_BASE64=<content>"
fi
