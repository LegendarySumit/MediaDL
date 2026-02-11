#!/usr/bin/env python3
"""
Utility to manage YouTube cookies for yt-dlp downloads.
Supports loading cookies from environment variables or files.
"""

import os
import base64
import sys

def setup_cookies_from_env():
    """Load cookies from YOUTUBE_COOKIES_BASE64 environment variable."""
    cookies_b64 = os.getenv("YOUTUBE_COOKIES_BASE64")
    
    if not cookies_b64:
        print("❌ YOUTUBE_COOKIES_BASE64 environment variable not set")
        return False
    
    try:
        cookies_content = base64.b64decode(cookies_b64).decode('utf-8')
        cookies_path = os.path.join(os.path.dirname(__file__), "cookies.txt")
        
        with open(cookies_path, 'w', encoding='utf-8') as f:
            f.write(cookies_content)
        
        os.chmod(cookies_path, 0o600)  # Read/write for owner only
        print(f"✓ Cookies loaded from environment ({len(cookies_content)} bytes)")
        return True
    except Exception as e:
        print(f"❌ Failed to decode cookies: {e}")
        return False

def verify_cookies():
    """Check if cookies.txt exists and has content."""
    cookies_path = os.path.join(os.path.dirname(__file__), "cookies.txt")
    
    if not os.path.exists(cookies_path):
        print("❌ cookies.txt not found")
        return False
    
    size = os.path.getsize(cookies_path)
    if size < 100:
        print(f"⚠ cookies.txt seems too small ({size} bytes)")
        return False
    
    print(f"✓ cookies.txt ready ({size} bytes)")
    return True

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "setup":
        if setup_cookies_from_env():
            verify_cookies()
            sys.exit(0)
        sys.exit(1)
    else:
        verify_cookies()
