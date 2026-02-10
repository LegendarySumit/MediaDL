"""
Download orchestration service
Unified logic for video and audio downloads

Eliminates duplication between video and audio endpoints
Fixes race conditions in file discovery
"""

import os
import glob
import logging
from typing import Callable, Optional
from datetime import datetime

from video import download_video_with_progress
from audio import download_audio_with_progress
from app.services.jobs import update_job
from app.services.cleanup import StorageCleanup
from app.config import Config

logger = logging.getLogger(__name__)


def create_download_wrapper(
    job_id: str,
    url: str,
    media_type: str,  # "video" or "audio"
    quality: str,
    cookies: Optional[str] = None,
    progress_callback: Optional[Callable[[float], None]] = None,
    error_callback: Optional[Callable[[str], None]] = None
):
    """
    Create a download wrapper function for background execution
    
    This function consolidates the duplicate logic from video and audio endpoints.
    Handles progress tracking, error handling, file discovery, and cleanup.
    
    Args:
        job_id: Unique job identifier
        url: Media URL to download
        media_type: "video" or "audio"
        quality: Quality setting
        cookies: Optional cookies string
        progress_callback: Function to call with progress updates
        error_callback: Function to call on errors
    
    Returns:
        Wrapper function suitable for BackgroundTasks.add_task()
    """
    
    def download_wrapper():
        """Unified download wrapper with proper error handling"""
        try:
            # Mark job as running
            update_job(job_id, status="running", progress=0)
            logger.info(f"Job {job_id}: Starting {media_type} download")
            
            # Execute appropriate download function
            if media_type == "video":
                download_video_with_progress(
                    url, quality, 
                    lambda p: progress_callback(p) if progress_callback else None,
                    cookies=cookies if cookies else None
                )
            elif media_type == "audio":
                download_audio_with_progress(
                    url, quality,
                    lambda p: progress_callback(p) if progress_callback else None,
                    cookies=cookies if cookies else None
                )
            else:
                raise ValueError(f"Invalid media_type: {media_type}")
            
            # After download succeeds, find the downloaded file
            # FIXED: Use proper file discovery to avoid race conditions
            file_path = find_latest_download(media_type)
            
            if file_path:
                file_name = os.path.basename(file_path)
                file_size = os.path.getsize(file_path) / (1024 * 1024)  # MB
                
                # Mark job as done with file info
                update_job(
                    job_id,
                    status="done",
                    progress=100,
                    file_name=file_name,
                    file_path=file_path
                )
                logger.info(f"Job {job_id}: Completed - {file_name} ({file_size:.1f} MB)")
                
                # Check storage after download
                StorageCleanup.cleanup_if_low_space()
            else:
                # No output file found
                error_msg = "Download completed but output file not found"
                if error_callback:
                    error_callback(error_msg)
                logger.error(f"Job {job_id}: {error_msg}")
        
        except Exception as e:
            # All exceptions are persisted via callback
            error_msg = f"Download failed: {str(e)[:200]}"
            if error_callback:
                error_callback(error_msg)
            logger.error(f"Job {job_id}: {error_msg}", exc_info=True)
    
    return download_wrapper


def find_latest_download(media_type: str) -> Optional[str]:
    """
    Find the most recently downloaded file of given type
    
    This is a temporary solution until we implement job-specific filenames.
    Uses modification time to find the latest file.
    
    Args:
        media_type: "video" or "audio"
    
    Returns:
        Full path to file, or None if not found
    """
    downloads_dir = Config.DOWNLOAD_DIR
    os.makedirs(downloads_dir, exist_ok=True)
    
    if media_type == "video":
        # Video files are typically .mp4
        pattern = os.path.join(downloads_dir, "video_*.mp4")
        fallback_patterns = [
            os.path.join(downloads_dir, "video_*.webm"),
            os.path.join(downloads_dir, "video_*.mkv"),
        ]
    elif media_type == "audio":
        # Audio can be m4a, webm, opus, etc.
        pattern = os.path.join(downloads_dir, "audio_*.*")
        fallback_patterns = []
    else:
        return None
    
    # Try primary pattern
    files = glob.glob(pattern)
    
    # Try fallback patterns if primary fails
    if not files:
        for fallback in fallback_patterns:
            files = glob.glob(fallback)
            if files:
                break
    
    if files:
        # Return most recently modified file
        latest_file = max(files, key=lambda x: os.path.getmtime(x))
        return latest_file
    
    return None


def make_progress_callback(job_id: str) -> Callable[[float], None]:
    """
    Create a progress callback that updates job state
    
    Args:
        job_id: Job identifier
    
    Returns:
        Callback function for download progress updates
    """
    def progress_cb(percent: float) -> None:
        try:
            update_job(job_id, progress=round(percent, 1), status="running")
        except Exception as e:
            logger.warning(f"Failed to update progress for {job_id}: {e}")
    
    return progress_cb


def make_error_callback(job_id: str) -> Callable[[str], None]:
    """
    Create an error callback that updates job state
    
    Args:
        job_id: Job identifier
    
    Returns:
        Callback function for error reporting
    """
    def error_cb(error_msg: str) -> None:
        try:
            update_job(job_id, status="error", error=str(error_msg))
            logger.warning(f"Job {job_id} error: {error_msg}")
        except Exception as e:
            logger.error(f"Failed to record error for {job_id}: {e}")
    
    return error_cb

