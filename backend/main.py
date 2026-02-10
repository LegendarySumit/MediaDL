from fastapi import FastAPI, BackgroundTasks, Form, HTTPException, Request
from fastapi.responses import StreamingResponse, FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import time
import uuid
import os
import glob
import logging
from logging.handlers import RotatingFileHandler
from datetime import datetime

from video import download_video_with_progress
from audio import download_audio_with_progress
from detector import detect_platform
from app.services.jobs import (
    create_job, update_job, get_job, delete_job, 
    export_job_json, safe_delete_file
)
from app.services.cleanup import StorageCleanup
from app.services.download_orchestrator import (
    create_download_wrapper,
    make_progress_callback,
    make_error_callback
)
from app.config import Config
from app.api.history import router as history_router

# Create logs directory
os.makedirs(Config.LOG_DIR, exist_ok=True)

# Setup logging with both file and console handlers
logger = logging.getLogger(__name__)
logger.setLevel(Config.LOG_LEVEL)

# Console handler
console_handler = logging.StreamHandler()
console_handler.setLevel(Config.LOG_LEVEL)
console_formatter = logging.Formatter(
    '%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
console_handler.setFormatter(console_formatter)
logger.addHandler(console_handler)

# File handler with rotation (10MB max, keep 5 backups)
log_file = os.path.join(Config.LOG_DIR, 'media_downloader.log')
file_handler = RotatingFileHandler(
    log_file,
    maxBytes=Config.LOG_MAX_SIZE_MB * 1024 * 1024,
    backupCount=Config.LOG_BACKUP_COUNT
)
file_handler.setLevel(Config.LOG_LEVEL)
file_formatter = logging.Formatter(
    '%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
file_handler.setFormatter(file_formatter)
logger.addHandler(file_handler)

# Prevent propagation to root logger
logger.propagate = False

# Initialize rate limiter
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title="Media Downloader", version="1.0.0")

# Add rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, lambda req, exc: JSONResponse(
    status_code=429,
    content={"error": "Rate limit exceeded. Please try again later."}
))

# Allow frontend to communicate with backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include history router - brings in all /api/history/* endpoints
app.include_router(history_router)


@app.on_event("startup")
async def startup_event():
    """Initialize application on startup"""
    logger.info("=" * 60)
    logger.info("MEDIA DOWNLOADER - STARTUP")
    logger.info("=" * 60)
    
    # Validate and print configuration
    try:
        Config.validate()
        logger.info(f"API: http://{Config.API_HOST}:{Config.API_PORT}")
        logger.info(f"Downloads: {Config.DOWNLOAD_DIR}")
        logger.info(f"Cleanup Age: {Config.CLEANUP_DAYS} days")
        logger.info(f"Rate Limits: {Config.VIDEO_REQUESTS_PER_MINUTE} video/min, {Config.AUDIO_REQUESTS_PER_MINUTE} audio/min")
        logger.info(f"Log Level: {Config.LOG_LEVEL}")
        logger.info("All systems ready")
    except Exception as e:
        logger.error(f"Startup error: {e}")
        raise
    
    logger.info("=" * 60)


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    logger.info("Shutting down Media Downloader...")


@app.get("/health")
async def health_check(request: Request):
    """Check application health and system status"""
    try:
        # Check Redis connectivity
        redis_status = "ok"
        try:
            redis_client.ping()
        except Exception as e:
            redis_status = f"error: {str(e)}"
        
        # Check disk space
        storage_stats = StorageCleanup.get_storage_stats()
        
        # Check if directory exists
        os.makedirs(Config.DOWNLOAD_DIR, exist_ok=True)
        
        return JSONResponse(
            status_code=200,
            content={
                "status": "healthy" if redis_status == "ok" else "degraded",
                "timestamp": datetime.utcnow().isoformat(),
                "redis": redis_status,
                "storage": {
                    "total_gb": round(storage_stats["total"] / (1024**3), 2),
                    "used_gb": round(storage_stats["used"] / (1024**3), 2),
                    "free_gb": round(storage_stats["free"] / (1024**3), 2),
                    "percent_used": round(storage_stats["percent"], 1)
                },
                "config": {
                    "api_port": Config.API_PORT,
                    "cleanup_age_days": Config.CLEANUP_DAYS,
                    "rate_limits": {
                        "video_per_minute": Config.VIDEO_REQUESTS_PER_MINUTE,
                        "audio_per_minute": Config.AUDIO_REQUESTS_PER_MINUTE
                    }
                }
            }
        )
    except Exception as e:
        logger.error(f"Health check error: {e}")
        return JSONResponse(
            status_code=503,
            content={"status": "error", "detail": str(e)}
        )


@app.post("/cleanup")
async def manual_cleanup(request: Request):
    """Manually trigger storage cleanup"""
    try:
        client_ip = request.client.host
        logger.info(f"[{client_ip}] Manual cleanup requested")
        
        # Get initial storage stats
        stats_before = StorageCleanup.get_storage_stats()
        
        # Run cleanup
        removed_files = StorageCleanup.cleanup_old_files()
        removed_size = StorageCleanup.cleanup_if_low_space()
        
        # Get final storage stats
        stats_after = StorageCleanup.get_storage_stats()
        
        total_removed = removed_files + removed_size
        freed_space_mb = (stats_before["free"] - stats_after["free"]) / (1024**2)
        
        logger.info(f"[{client_ip}] Cleanup complete: removed {total_removed} files, freed {freed_space_mb:.1f} MB")
        
        return JSONResponse(
            status_code=200,
            content={
                "status": "success",
                "files_removed": total_removed,
                "freed_space_mb": round(freed_space_mb, 1),
                "storage_after": {
                    "total_gb": round(stats_after["total"] / (1024**3), 2),
                    "used_gb": round(stats_after["used"] / (1024**3), 2),
                    "free_gb": round(stats_after["free"] / (1024**3), 2),
                    "percent_used": round(stats_after["percent"], 1)
                }
            }
        )
    except Exception as e:
        logger.error(f"Cleanup error: {e}")
        raise HTTPException(status_code=500, detail=f"Cleanup failed: {str(e)}")


def validate_url_security(url: str) -> bool:
    """
    Validate URL for security (SSRF prevention)
    
    Allows: youtube.com, instagram.com, tiktok.com, etc.
    Blocks: local IPs, internal networks, localhost
    
    Args:
        url: URL to validate
    
    Returns:
        True if safe, raises HTTPException otherwise
    """
    url_lower = url.lower()
    
    # Blocklist for SSRF/security
    blocked_patterns = [
        'localhost',
        '127.0',
        '192.168',
        '10.0',
        '172.16',
        '0.0.0',
        'file://',
        'ftp://',
    ]
    
    for pattern in blocked_patterns:
        if pattern in url_lower:
            logger.warning(f"Blocked SSRF attempt: {url[:50]}...")
            raise HTTPException(status_code=403, detail="URL not allowed for security reasons")
    
    # Allowlist for supported platforms
    allowed_domains = [
        'youtube.com',
        'youtu.be',
        'instagram.com',
        'tiktok.com',
        'twitter.com',
        'x.com',
        'facebook.com',
        'vimeo.com',
        'dailymotion.com',
    ]
    
    if not any(domain in url_lower for domain in allowed_domains):
        logger.warning(f"URL from unsupported platform: {url[:50]}...")
        raise HTTPException(status_code=400, detail="URL platform not supported")
    
    return True

@app.post("/start/video")
@limiter.limit(f"{Config.VIDEO_REQUESTS_PER_MINUTE}/minute")
def start_video(
    request: Request,
    background_tasks: BackgroundTasks,
    url: str = Form(...),
    quality: str = Form(...),
    cookies: str = Form(default="")
):
    """Start a video download in the background"""
    try:
        # Validate inputs
        if not url:
            logger.warning(f"Empty URL from {request.client.host}")
            raise HTTPException(status_code=400, detail="URL is required")
        
        if len(url) > 2000:
            logger.warning(f"URL too long from {request.client.host}")
            raise HTTPException(status_code=400, detail="URL exceeds maximum length")
        
        # Validate URL security (SSRF prevention)
        validate_url_security(url)
        
        # Validate quality
        valid_qualities = ["144", "360", "720", "1080"]
        if quality not in valid_qualities:
            logger.warning(f"Invalid quality: {quality} from {request.client.host}")
            raise HTTPException(status_code=400, detail=f"Quality must be one of {valid_qualities}")
        
        job_id = str(uuid.uuid4())
        platform = detect_platform(url)
        client_ip = request.client.host
        
        logger.info(f"[{client_ip}] New video request: {job_id} ({platform}) - {quality}p")
        
        # Create job in Redis with full metadata
        job_data = {
            "job_id": job_id,
            "url": url,
            "platform": platform,
            "type": "video",
            "format": "mp4",
            "quality": quality,
            "status": "queued",
            "progress": 0,
            "file_name": "",
            "file_path": "",
            "error": "",
            "client_ip": client_ip,
            "created_at": datetime.now().isoformat()
        }
        create_job(job_data)
        logger.info(f"Job {job_id}: Created and queued")
        
        # Create unified download wrapper
        progress_cb = make_progress_callback(job_id)
        error_cb = make_error_callback(job_id)
        
        download_wrapper = create_download_wrapper(
            job_id=job_id,
            url=url,
            media_type="video",
            quality=quality,
            cookies=cookies if cookies else None,
            progress_callback=progress_cb,
            error_callback=error_cb
        )
        
        background_tasks.add_task(download_wrapper)
        return {"job_id": job_id}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in start_video: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/start/audio")
@limiter.limit(f"{Config.AUDIO_REQUESTS_PER_MINUTE}/minute")
def start_audio(
    request: Request,
    background_tasks: BackgroundTasks,
    url: str = Form(...),
    quality: str = Form(default="192"),
    cookies: str = Form(default="")
):
    """Start an audio download in the background"""
    try:
        # Validate inputs
        if not url:
            logger.warning(f"Empty URL from {request.client.host}")
            raise HTTPException(status_code=400, detail="URL is required")
        
        if len(url) > 2000:
            logger.warning(f"URL too long from {request.client.host}")
            raise HTTPException(status_code=400, detail="URL exceeds maximum length")
        
        # Validate URL security (SSRF prevention)
        validate_url_security(url)
        job_id = str(uuid.uuid4())
        platform = detect_platform(url)
        client_ip = request.client.host
        
        logger.info(f"[{client_ip}] New audio request: {job_id} ({platform})")
        
        # Create job in Redis with full metadata
        job_data = {
            "job_id": job_id,
            "url": url,
            "platform": platform,
            "type": "audio",
            "format": "webm",
            "quality": quality,
            "status": "queued",
            "progress": 0,
            "file_name": "",
            "file_path": "",
            "error": "",
            "client_ip": client_ip,
            "created_at": datetime.now().isoformat()
        }
        create_job(job_data)
        logger.info(f"Job {job_id}: Created and queued")
        
        # Create unified download wrapper
        progress_cb = make_progress_callback(job_id)
        error_cb = make_error_callback(job_id)
        
        download_wrapper = create_download_wrapper(
            job_id=job_id,
            url=url,
            media_type="audio",
            quality=quality,
            cookies=cookies if cookies else None,
            progress_callback=progress_cb,
            error_callback=error_cb
        )
        
        background_tasks.add_task(download_wrapper)
        return {"job_id": job_id}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in start_audio: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/progress/{job_id}")
def progress_stream(job_id: str):
    """
    Stream progress updates from job state
    
    Improvements:
    - Configurable timeout
    - Connection health checks
    - Proper error handling
    """
    def event_stream():
        last_progress = -1
        max_duration_seconds = 600  # 10 minutes maximum
        poll_interval = 0.3  # 300ms
        max_iterations = int(max_duration_seconds / poll_interval)
        iteration = 0
        
        try:
            while iteration < max_iterations:
                iteration += 1
                
                # Read job state from Redis
                try:
                    job = get_job(job_id)
                except Exception as e:
                    logger.warning(f"Redis read error for {job_id}: {e}")
                    yield "data:ERROR:Connection error\n\n"
                    break
                
                if not job:
                    yield "data:ERROR:Job not found\n\n"
                    break
                
                # Extract job state
                current_progress = float(job.get("progress", 0))
                job_status = job.get("status", "queued")
                error_msg = job.get("error", "")
                file_name = job.get("file_name", "")
                
                # Send progress update if changed
                if current_progress != last_progress:
                    progress_data = str(round(current_progress, 1))
                    
                    # Include filename when complete
                    if file_name and current_progress >= 100:
                        progress_data += f"|{file_name}"
                    
                    yield f"data:{progress_data}\n\n"
                    last_progress = current_progress
                
                # Handle errors
                if error_msg:
                    yield f"data:ERROR:{error_msg}\n\n"
                    break
                
                # Stop streaming when job reaches terminal state
                if job_status in ("done", "error"):
                    break
                
                # TIMEOUT: If job stuck in "running" for too long without progress
                if job_status == "running" and iteration > 100 and current_progress == 0:
                    yield "data:ERROR:Download timed out (no progress)\n\n"
                    update_job(job_id, status="error", error="Timeout: no progress")
                    break
                
                # Poll Redis
                time.sleep(poll_interval)
            
            # Max iterations reached
            if iteration >= max_iterations:
                logger.warning(f"Progress stream timeout for {job_id}")
                yield "data:ERROR:Timeout\n\n"
                
        except GeneratorExit:
            # Client disconnected - normal
            logger.debug(f"Client disconnected from progress stream: {job_id}")
        except Exception as e:
            logger.error(f"Progress stream error: {e}")
            yield f"data:ERROR:Streaming error\n\n"
    
    return StreamingResponse(event_stream(), media_type="text/event-stream")

@app.get("/download/{job_id}")
def download_file(job_id: str):
    """
    Serve the downloaded file from job state
    
    Security: Validates file path is within downloads directory
    """
    try:
        # Get job from Redis
        job = get_job(job_id)
        if not job:
            return JSONResponse(
                status_code=404,
                content={"error": "Job not found"}
            )
        
        file_path = job.get("file_path")
        if not file_path or not os.path.exists(file_path):
            return JSONResponse(
                status_code=404,
                content={"error": "File not found"}
            )
        
        # SECURITY: Validate file is within downloads directory (path traversal protection)
        abs_file_path = os.path.abspath(file_path)
        abs_downloads_dir = os.path.abspath(Config.DOWNLOAD_DIR)
        
        if not abs_file_path.startswith(abs_downloads_dir):
            logger.warning(f"Blocked path traversal attempt: {file_path}")
            return JSONResponse(
                status_code=403,
                content={"error": "Access denied"}
            )
        
        try:
            # Serve file with appropriate headers
            file_name = os.path.basename(file_path)
            return FileResponse(
                path=file_path,
                filename=file_name,
                media_type="application/octet-stream"
            )
        except Exception as e:
            logger.error(f"Download error: {e}")
            return JSONResponse(
                status_code=500,
                content={"error": str(e)}
            )
    except Exception as e:
        logger.error(f"Download endpoint error: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": "Internal error"}
        )

@app.delete("/api/job/{job_id}")
def delete_job_endpoint(job_id: str):
    """
    Delete a job and its associated file
    
    Safety:
    - Cannot delete running jobs
    - Removes file from disk if it exists
    - Cleans Redis references
    
    Args:
        job_id: Unique job identifier
    
    Returns:
        JSON response with status
    """
    try:
        job = get_job(job_id)
        
        if not job:
            return {"error": "Job not found"}
        
        # SAFETY: Prevent deletion of running jobs
        if job.get("status") == "running":
            return {"error": "Cannot delete a running job"}
        
        # Delete file if it exists and belongs to this job
        file_path = job.get("file_path")
        if file_path:
            safe_delete_file(file_path)
        
        # Remove job from Redis
        delete_job(job_id)
        logger.info(f"Deleted job: {job_id}")
        
        return {"status": "deleted", "job_id": job_id}
    except Exception as e:
        logger.error(f"Delete job error: {e}")
        return {"error": "Internal error"}

@app.get("/health")
def health_check():
    """Quick health check (simple liveness probe)"""
    return {
        "status": "ok",
        "timestamp": int(time.time())
    }


@app.get("/health/status")
def health_status():
    """Detailed health status"""
    return get_health_status()


@app.get("/health/detailed")
def health_detailed():
    """Complete system diagnostic"""
    return get_detailed_status()


# ==================== HELPER FUNCTIONS ====================

def extract_video_id(url: str) -> str:
    """
    Extract video ID from URL (heuristic)
    
    This is a best-effort extraction. The actual ID from yt-dlp might differ.
    Used primarily for finding downloaded files.
    
    Args:
        url: Video URL from YouTube, Instagram, TikTok, etc.
    
    Returns:
        Likely video ID string
    """
    import re
    
    # YouTube: https://www.youtube.com/watch?v=VIDEO_ID
    match = re.search(r'(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})', url)
    if match:
        return match.group(1)
    
    # Instagram: https://www.instagram.com/p/POST_ID/ or /reel/REEL_ID/
    match = re.search(r'instagram\.com/(?:p|reel)/([a-zA-Z0-9_-]+)', url)
    if match:
        return match.group(1)
    
    # TikTok: extract from URL
    match = re.search(r'/video/(\d+)', url)
    if match:
        return match.group(1)
    
    # Twitter/X: tweet ID
    match = re.search(r'/status/(\d+)', url)
    if match:
        return match.group(1)
    
    # Fallback: use URL hash
    import hashlib
    return hashlib.md5(url.encode()).hexdigest()[:12]


