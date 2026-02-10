"""
File management utilities
Safe file operations with checks
"""

import os
import shutil
from typing import Optional


def find_downloaded_file(downloads_dir: str, file_id: str, file_type: str) -> Optional[str]:
    """
    Find a downloaded file by ID and type
    
    Safer than glob.glob which can match unrelated files
    
    Args:
        downloads_dir: Directory containing downloads
        file_id: yt-dlp video/audio ID
        file_type: "video" or "audio"
    
    Returns:
        Full path to file, or None if not found
    
    Examples:
        find_downloaded_file("/downloads", "dQw4w9WgXcQ", "video")
            → "/downloads/video_dQw4w9WgXcQ.mp4"
    """
    if not os.path.isdir(downloads_dir):
        return None
    
    # Build expected filename patterns
    if file_type == "video":
        prefix = "video_"
        extensions = [".mp4", ".webm", ".mkv", ".avi"]
    elif file_type == "audio":
        prefix = "audio_"
        extensions = [".mp3", ".wav", ".m4a", ".opus", ".vorbis"]
    else:
        return None
    
    # Search for exact match
    for ext in extensions:
        candidate = os.path.join(downloads_dir, f"{prefix}{file_id}{ext}")
        if os.path.isfile(candidate):
            return candidate
    
    # No exact match found
    return None


def safe_delete_file(file_path: str) -> bool:
    """
    Safely delete a file with error handling
    
    Args:
        file_path: Path to file
    
    Returns:
        True if deleted, False if failed
    """
    try:
        if not file_path or not os.path.exists(file_path):
            return True  # Already gone
        
        if not os.path.isfile(file_path):
            return False  # Not a regular file
        
        os.remove(file_path)
        return True
    except PermissionError:
        print(f"Permission denied deleting {file_path}")
        return False
    except OSError as e:
        print(f"Error deleting {file_path}: {e}")
        return False


def get_disk_usage(path: str) -> dict:
    """
    Get disk usage statistics
    
    Args:
        path: Path to check (file or directory)
    
    Returns:
        Dictionary with usage in GB and percentage
    """
    try:
        stat = shutil.disk_usage(path)
        total_gb = stat.total / (1024 ** 3)
        used_gb = stat.used / (1024 ** 3)
        free_gb = stat.free / (1024 ** 3)
        percent = (stat.used / stat.total * 100) if stat.total > 0 else 0
        
        return {
            "total_gb": round(total_gb, 2),
            "used_gb": round(used_gb, 2),
            "free_gb": round(free_gb, 2),
            "percent_used": round(percent, 1),
        }
    except Exception as e:
        print(f"Error getting disk usage: {e}")
        return {
            "total_gb": 0,
            "used_gb": 0,
            "free_gb": 0,
            "percent_used": 0,
        }
