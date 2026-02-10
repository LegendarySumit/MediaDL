def detect_platform(url: str) -> str:
    """
    Detect the platform from a URL
    
    Args:
        url: URL string to analyze
    
    Returns:
        Platform name: youtube, instagram, tiktok, twitter, facebook, or unknown
    """
    url_lower = url.lower()
    
    # YouTube
    if "youtube.com" in url_lower or "youtu.be" in url_lower:
        return "youtube"
    
    # Instagram
    if "instagram.com" in url_lower:
        return "instagram"
    
    # TikTok
    if "tiktok.com" in url_lower or "vm.tiktok.com" in url_lower or "vt.tiktok.com" in url_lower:
        return "tiktok"
    
    # Twitter / X
    if "twitter.com" in url_lower or "x.com" in url_lower:
        return "twitter"
    
    # Facebook
    if "facebook.com" in url_lower or "fb.watch" in url_lower:
        return "facebook"
    
    # Unknown platform
    return "unknown"
