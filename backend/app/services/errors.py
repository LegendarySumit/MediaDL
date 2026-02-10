"""
Error normalization layer
Maps raw yt-dlp/FFmpeg errors to human-readable messages
Improves user trust and debugging
"""

# yt-dlp error patterns and translations
YTDLP_ERROR_MAP = {
    "requested format not available": "The requested quality is not available for this video. Try a different quality.",
    "no video formats found": "Could not find any downloadable formats for this video.",
    "unable to download video data": "Failed to download video data. The video may be private, deleted, or geoblocked.",
    "no such user": "The user or channel does not exist.",
    "video unavailable": "This video is no longer available.",
    "yt-dlp": "Downloaded content format error. Try again with a different quality.",
    "http error 403": "Access denied. The video may be restricted in your region.",
    "http error 404": "Video not found (404).",
    "connection refused": "Could not connect to the server. Check your internet connection.",
    "timeout": "Connection timed out. Try again or check your internet speed.",
    "read timed out": "Download took too long. Try again with a smaller video or different quality.",
    "invalid url": "The URL is not valid. Please check and try again.",
}

# FFmpeg error patterns and translations
FFMPEG_ERROR_MAP = {
    "no such file or directory": "The downloaded file could not be processed. Disk space issue?",
    "permission denied": "Permission denied accessing the file. Check disk permissions.",
    "disk i/o error": "Disk input/output error. Check your disk health.",
    "out of memory": "Ran out of memory during conversion. Close other apps and try again.",
    "invalid data found": "The downloaded file is corrupted. Try downloading again.",
    "unknown encoder": "Audio/video codec not installed. Check FFmpeg installation.",
}

# Generic error patterns
GENERIC_ERROR_MAP = {
    "connection": "Connection error. Check your internet and try again.",
    "network": "Network error. Check your internet connection.",
    "ssl": "SSL/certificate error. Your internet may be blocking the connection.",
    "certificate": "Certificate verification failed. Check your network settings.",
    "proxy": "Proxy connection error. Check proxy settings.",
}


def normalize_error(error_msg: str) -> str:
    """
    Convert raw error message to human-readable text
    
    Args:
        error_msg: Raw error message from yt-dlp, FFmpeg, or system
    
    Returns:
        Human-readable error message
    """
    if not error_msg:
        return "Unknown error occurred. Please try again."
    
    error_lower = error_msg.lower()
    
    # Check yt-dlp errors first
    for pattern, translation in YTDLP_ERROR_MAP.items():
        if pattern in error_lower:
            return translation
    
    # Check FFmpeg errors
    for pattern, translation in FFMPEG_ERROR_MAP.items():
        if pattern in error_lower:
            return translation
    
    # Check generic patterns
    for pattern, translation in GENERIC_ERROR_MAP.items():
        if pattern in error_lower:
            return translation
    
    # If no pattern matched, try to extract meaningful part
    # Remove common prefixes and clean up
    if "error:" in error_lower:
        error_msg = error_msg.split("error:", 1)[1].strip()
    
    # Limit length and capitalize
    error_msg = error_msg[:200]  # Truncate if too long
    if error_msg and error_msg[0].islower():
        error_msg = error_msg[0].upper() + error_msg[1:]
    
    if not error_msg.endswith("."):
        error_msg += "."
    
    return error_msg or "An error occurred. Please try again."


def get_error_severity(error_msg: str) -> str:
    """
    Determine error severity: critical, high, medium, low
    
    Args:
        error_msg: Error message
    
    Returns:
        Severity level string
    """
    error_lower = error_msg.lower()
    
    # Critical errors
    if any(w in error_lower for w in ["disk", "permission", "out of memory"]):
        return "critical"
    
    # High severity
    if any(w in error_lower for w in ["network", "connection refused", "timeout", "ssl"]):
        return "high"
    
    # Medium severity
    if any(w in error_lower for w in ["format", "unavailable", "http error", "invalid"]):
        return "medium"
    
    # Low priority
    return "low"
