"""
Security baseline for local/LAN deployment
Minimal protections without authentication
Guidelines for safe usage
"""

import re
from urllib.parse import urlparse


class SecurityValidator:
    """Validate requests for basic security"""
    
    # Allowed URL schemes
    ALLOWED_SCHEMES = {"http", "https"}
    
    # Blocked domains (examples - expand as needed)
    BLOCKED_DOMAINS = {
        "localhost:3000",  # Prevent downloading from own frontend
        "127.0.0.1:3000",
    }
    
    # URL validation regex
    URL_PATTERN = re.compile(
        r"^https?://(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&/=]*)$"
    )
    
    @classmethod
    def validate_url(cls, url: str) -> tuple:
        """
        Validate download URL
        
        Args:
            url: URL to validate
        
        Returns:
            (is_valid, error_message)
        """
        if not url:
            return False, "URL is empty"
        
        url = url.strip()
        
        # Check format
        if not cls.URL_PATTERN.match(url):
            return False, "Invalid URL format"
        
        # Parse URL
        try:
            parsed = urlparse(url)
        except Exception:
            return False, "URL parsing failed"
        
        # Check scheme
        if parsed.scheme not in cls.ALLOWED_SCHEMES:
            return False, "Only HTTP and HTTPS are supported"
        
        # Check if trying to download from local services
        netloc = parsed.netloc.lower()
        for blocked in cls.BLOCKED_DOMAINS:
            if blocked in netloc:
                return False, "Cannot download from local services"
        
        return True, None
    
    @classmethod
    def validate_quality(cls, quality: str) -> bool:
        """Validate video/audio quality parameter"""
        # Only alphanumeric and allowed special chars
        return bool(re.match(r"^[a-zA-Z0-9]+[kpbm]?$", quality))
    
    @classmethod
    def sanitize_filename(cls, filename: str) -> str:
        """Remove dangerous characters from filename"""
        # Allow only safe characters
        filename = re.sub(r'[^a-zA-Z0-9._()-]', '_', filename)
        # Prevent path traversal
        filename = filename.replace('..', '_')
        filename = filename.replace('/', '_')
        filename = filename.replace('\\', '_')
        return filename


class RateLimiter:
    """
    Simple rate limiting helper
    For production, use dedicated middleware like slowapi
    
    FIXED: Added cleanup to prevent memory leak
    """
    
    def __init__(self, max_requests: int = 100, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.requests = {}
        self.last_cleanup = time.time()
        self.cleanup_interval = 300  # Cleanup every 5 minutes
    
    def _cleanup_old_clients(self):
        """Remove client IDs with no recent requests"""
        import time
        now = time.time()
        
        if now - self.last_cleanup < self.cleanup_interval:
            return
        
        # Remove clients with all requests outside window
        clients_to_remove = []
        for client_id, req_times in self.requests.items():
            if not req_times or all(now - t > self.window_seconds * 2 for t in req_times):
                clients_to_remove.append(client_id)
        
        for client_id in clients_to_remove:
            del self.requests[client_id]
        
        self.last_cleanup = now
    
    def is_allowed(self, client_id: str) -> bool:
        """Check if client is within rate limit"""
        import time
        now = time.time()
        
        # Periodic cleanup to prevent memory leak
        self._cleanup_old_clients()
        
        if client_id not in self.requests:
            self.requests[client_id] = []
        
        # Remove old requests outside window
        self.requests[client_id] = [
            req_time for req_time in self.requests[client_id]
            if now - req_time < self.window_seconds
        ]
        
        # Check limit
        if len(self.requests[client_id]) >= self.max_requests:
            return False
        
        # Add current request
        self.requests[client_id].append(now)
        return True


# Security checklist
SECURITY_CHECKLIST = """
SECURITY BASELINE CHECKLIST

✓ Implemented:
- URL validation (scheme, format, blocked domains)
- Quality parameter validation
- Filename sanitization (prevent path traversal)
- Max download size enforcement (via config)

⚠ Recommended (for production):
- Add rate limiting middleware (slowapi)
- Enable HTTPS only (not for localhost)
- Add CSRF protection if adding auth later
- Run behind nginx with authentication
- Use firewall to restrict to LAN only
- Regular security updates to yt-dlp

⚠ NOT Implemented (not needed for LAN):
- User authentication
- API key management
- Session management
- HTTPS certificate validation

DEPLOYMENT GUIDELINES:
1. Only expose on localhost:8000 or trusted LAN
2. Use Nginx reverse proxy for public access
3. Add rate limiting at proxy level
4. Monitor logs for suspicious patterns
5. Keep yt-dlp and FFmpeg updated
"""
