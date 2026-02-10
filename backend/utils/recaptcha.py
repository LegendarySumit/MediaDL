"""
reCAPTCHA v3 verification utility

Usage:
    from utils.recaptcha import verify_recaptcha
    
    is_valid = await verify_recaptcha(token, remote_ip)
"""

import os
import httpx
from typing import Optional

RECAPTCHA_SECRET_KEY = os.getenv("RECAPTCHA_SECRET_KEY")
RECAPTCHA_ENABLED = os.getenv("RECAPTCHA_ENABLED", "false").lower() == "true"
RECAPTCHA_VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify"
RECAPTCHA_THRESHOLD = float(os.getenv("RECAPTCHA_THRESHOLD", "0.5"))


async def verify_recaptcha(token: Optional[str], remote_ip: str) -> bool:
    """
    Verify reCAPTCHA v3 token
    
    Args:
        token: reCAPTCHA token from frontend
        remote_ip: User's IP address
        
    Returns:
        bool: True if verification passes or reCAPTCHA is disabled
    """
    
    # If reCAPTCHA is not enabled, always pass
    if not RECAPTCHA_ENABLED or not RECAPTCHA_SECRET_KEY:
        return True
    
    # If no token provided when reCAPTCHA is enabled, fail
    if not token:
        return False
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                RECAPTCHA_VERIFY_URL,
                data={
                    "secret": RECAPTCHA_SECRET_KEY,
                    "response": token,
                    "remoteip": remote_ip,
                },
                timeout=10.0,
            )
            
            if response.status_code != 200:
                return False
            
            result = response.json()
            
            # Check if verification was successful
            if not result.get("success"):
                return False
            
            # Check score (reCAPTCHA v3 returns a score from 0.0 to 1.0)
            score = result.get("score", 0.0)
            
            # You can adjust the threshold based on your needs
            # 0.5 is a good balance between security and user experience
            return score >= RECAPTCHA_THRESHOLD
            
    except Exception as e:
        # Log error but don't block users if reCAPTCHA service is down
        print(f"reCAPTCHA verification error: {e}")
        # In production, you might want to fail closed (return False)
        # For now, we fail open to not break the service
        return True


def get_client_ip(request) -> str:
    """
    Extract client IP from request, handling proxies
    """
    # Check for forwarded IP (when behind a proxy/load balancer)
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        # X-Forwarded-For can contain multiple IPs, take the first one
        return forwarded_for.split(",")[0].strip()
    
    # Check for real IP header
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip
    
    # Fallback to direct client
    return request.client.host if request.client else "unknown"
