from fastapi import FastAPI, BackgroundTasks, Form, HTTPException, Request, APIRouter
from fastapi.responses import StreamingResponse, FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import time
import uuid
import os
import logging
from logging.handlers import RotatingFileHandler
from datetime import datetime

# Initialize static-ffmpeg for Render (provides ffmpeg binaries)
try:
    import static_ffmpeg
    static_ffmpeg.add_paths()
    logging.info("static-ffmpeg initialized successfully")
except ImportError:
    logging.warning("static-ffmpeg not installed, relying on system ffmpeg")
except Exception as e:
    logging.error(f"Error initializing static-ffmpeg: {e}")

from detector import detect_platform
from app.services.jobs import (
    create_job, update_job, get_job, delete_job, 
    safe_delete_file
)
from app.services.cleanup import StorageCleanup
from app.services.download_orchestrator import (
    create_download_wrapper,
    make_progress_callback,
    make_error_callback
)
from app.config import Config
from app.api.history import router as history_router
from redis_utils import redis_client

# Setup logging
logger = logging.getLogger(__name__)
logger.setLevel(Config.LOG_LEVEL)
console_handler = logging.StreamHandler()
console_handler.setFormatter(logging.Formatter('%(asctime)s [%(levelname)s] %(message)s'))
logger.addHandler(console_handler)
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
    allow_origins=Config.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Root endpoints (for Render health checks)
@app.get("/")
def read_root():
    return {"message": "MediaDownloader API is running", "version": "1.0.0"}

@app.get("/health")
def health_simple():
    return {"status": "ok"}

# ==================== API ROUTER ====================
api_router = APIRouter(prefix="/api")

@api_router.get("/health")
async def health_check(request: Request):
    try:
        redis_status = "ok"
        try:
            redis_client.ping()
        except Exception as e:
            redis_status = f"error: {str(e)}"
        
        storage_stats = StorageCleanup.get_storage_stats()
        return {
            "status": "healthy" if redis_status == "ok" else "degraded",
            "redis": redis_status,
            "storage": storage_stats
        }
    except Exception as e:
        return JSONResponse(status_code=503, content={"status": "error", "detail": str(e)})

@api_router.post("/cleanup")
async def manual_cleanup(request: Request):
    try:
        StorageCleanup.cleanup_old_files()
        StorageCleanup.cleanup_if_low_space()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def validate_url_security(url: str) -> bool:
    url_lower = url.lower()
    blocked = ['localhost', '127.0', '192.168', '10.0', '172.16', '0.0.0']
    if any(p in url_lower for p in blocked):
        raise HTTPException(status_code=403, detail="URL not allowed")
    
    allowed = ['youtube.com', 'youtu.be', 'instagram.com', 'tiktok.com', 'twitter.com', 'x.com', 'facebook.com', 'vimeo.com', 'dailymotion.com']
    if not any(d in url_lower for d in allowed):
        raise HTTPException(status_code=400, detail="Platform not supported")
    return True

@api_router.post("/start/video")
@limiter.limit(f"{Config.VIDEO_REQUESTS_PER_MINUTE}/minute")
def start_video(
    request: Request,
    background_tasks: BackgroundTasks,
    url: str = Form(...),
    quality: str = Form(...),
    cookies: str = Form(default="")
):
    try:
        validate_url_security(url)
        job_id = str(uuid.uuid4())
        platform = detect_platform(url)
        
        job_data = {
            "job_id": job_id, "url": url, "platform": platform, "type": "video",
            "format": "mp4", "quality": quality, "status": "queued", "progress": 0,
            "client_ip": request.client.host, "created_at": datetime.now().isoformat()
        }
        create_job(job_data)
        
        download_wrapper = create_download_wrapper(
            job_id=job_id, url=url, media_type="video", quality=quality,
            cookies=cookies if cookies else None,
            progress_callback=make_progress_callback(job_id),
            error_callback=make_error_callback(job_id)
        )
        background_tasks.add_task(download_wrapper)
        return {"job_id": job_id}
    except HTTPException: raise
    except Exception as e:
        logger.error(f"Error in start_video: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/start/audio")
@limiter.limit(f"{Config.AUDIO_REQUESTS_PER_MINUTE}/minute")
def start_audio(
    request: Request,
    background_tasks: BackgroundTasks,
    url: str = Form(...),
    quality: str = Form(default="192"),
    cookies: str = Form(default="")
):
    try:
        validate_url_security(url)
        job_id = str(uuid.uuid4())
        platform = detect_platform(url)
        
        job_data = {
            "job_id": job_id, "url": url, "platform": platform, "type": "audio",
            "format": "webm", "quality": quality, "status": "queued", "progress": 0,
            "client_ip": request.client.host, "created_at": datetime.now().isoformat()
        }
        create_job(job_data)
        
        download_wrapper = create_download_wrapper(
            job_id=job_id, url=url, media_type="audio", quality=quality,
            cookies=cookies if cookies else None,
            progress_callback=make_progress_callback(job_id),
            error_callback=make_error_callback(job_id)
        )
        background_tasks.add_task(download_wrapper)
        return {"job_id": job_id}
    except HTTPException: raise
    except Exception as e:
        logger.error(f"Error in start_audio: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/progress/{job_id}")
def progress_stream(job_id: str):
    def event_stream():
        last_progress = -1
        for _ in range(2000): # ~10 mins
            job = get_job(job_id)
            if not job: yield "data:ERROR:Job not found\n\n"; break
            
            curr = float(job.get("progress", 0))
            status = job.get("status", "queued")
            if curr != last_progress:
                msg = str(round(curr, 1))
                if job.get("file_name") and curr >= 100: msg += f"|{job['file_name']}"
                yield f"data:{msg}\n\n"
                last_progress = curr
            
            if job.get("error"): yield f"data:ERROR:{job['error']}\n\n"; break
            if status in ("done", "error"): break
            time.sleep(0.3)
            
    return StreamingResponse(event_stream(), media_type="text/event-stream")

@api_router.get("/download/{job_id}")
def download_file(job_id: str):
    job = get_job(job_id)
    if not job or not job.get("file_path"): return JSONResponse(status_code=404, content={"error": "Not found"})
    path = job["file_path"]
    if not os.path.exists(path): return JSONResponse(status_code=404, content={"error": "File missing"})
    return FileResponse(path=path, filename=os.path.basename(path), media_type="application/octet-stream")

@api_router.delete("/job/{job_id}")
def delete_job_endpoint(job_id: str):
    job = get_job(job_id)
    if not job: return {"error": "Not found"}
    if job.get("status") == "running": return {"error": "Running"}
    if job.get("file_path"): safe_delete_file(job["file_path"])
    delete_job(job_id)
    return {"status": "deleted"}

# Include the history router
api_router.include_router(history_router)

# Finally, include the main API router in the app
app.include_router(api_router)

@app.on_event("startup")
async def startup_event():
    logger.info("MEDIA DOWNLOADER STARTUP")
    Config.validate()

@app.on_event("shutdown")
async def shutdown_event():
    logger.info("MEDIA DOWNLOADER SHUTDOWN")

def extract_video_id(url: str) -> str:
    import re
    match = re.search(r'(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})', url)
    if match: return match.group(1)
    match = re.search(r'instagram\.com/(?:p|reel)/([a-zA-Z0-9_-]+)', url)
    if match: return match.group(1)
    match = re.search(r'/video/(\d+)', url)
    if match: return match.group(1)
    import hashlib
    return hashlib.md5(url.encode()).hexdigest()[:12]


