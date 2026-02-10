"""
Download History API
REST endpoints for retrieving download history and job details
"""

from fastapi import APIRouter, HTTPException, Query
from app.services.jobs import list_jobs, get_job, get_jobs_by_status, get_jobs_by_platform, get_stats, export_job_json, update_job
from app.services.retry import RetryManager

router = APIRouter(prefix="/api/history", tags=["history"])


@router.get("/")
async def get_history(limit: int = Query(50, ge=1, le=500)):
    """
    Get download history (most recent jobs first)
    
    Query Parameters:
    - limit: Number of jobs to return (1-500, default: 50)
    
    Returns:
        {
            "items": [
                {
                    "job_id": "uuid",
                    "url": "https://...",
                    "platform": "youtube",
                    "type": "video",
                    "format": "mp4",
                    "quality": "720p",
                    "status": "done",
                    "progress": 100,
                    "file_name": "video.mp4",
                    "file_path": "/downloads/video.mp4",
                    "error": "",
                    "created_at": 1234567890,
                    "updated_at": 1234567890
                },
                ...
            ],
            "total": 150
        }
    """
    jobs = list_jobs(limit)
    # list_jobs already returns full job dictionaries
    serialized_jobs = [export_job_json(job) for job in jobs if job]
    
    return {
        "items": serialized_jobs,
        "total": len(serialized_jobs),
        "limit": limit
    }


@router.get("/{job_id}")
async def get_job_details(job_id: str):
    """
    Get details for a specific job
    
    Path Parameters:
    - job_id: The job ID (UUID)
    
    Returns:
        {
            "job_id": "uuid",
            "url": "https://...",
            "platform": "youtube",
            "type": "video",
            "format": "mp4",
            "quality": "720p",
            "status": "done",
            "progress": 100,
            "file_name": "video.mp4",
            "file_path": "/downloads/video.mp4",
            "error": "",
            "created_at": 1234567890,
            "updated_at": 1234567890
        }
    
    Raises:
        HTTPException: 404 if job not found
    """
    job = get_job(job_id)
    
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    
    return export_job_json(job)


@router.get("/status/{status}")
async def get_jobs_by_status_endpoint(status: str, limit: int = Query(50, ge=1, le=500)):
    """
    Get jobs filtered by status
    
    Path Parameters:
    - status: One of "queued", "running", "done", "error"
    
    Query Parameters:
    - limit: Number of jobs to return (1-500, default: 50)
    
    Returns:
        {
            "status": "done",
            "items": [...],
            "total": 10
        }
    """
    valid_statuses = ["queued", "running", "done", "error"]
    if status not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}"
        )
    
    jobs = get_jobs_by_status(status, limit)
    # get_jobs_by_status already returns full job dictionaries
    serialized_jobs = [export_job_json(job) for job in jobs if job]
    
    return {
        "status": status,
        "items": serialized_jobs,
        "total": len(serialized_jobs)
    }


@router.get("/platform/{platform}")
async def get_jobs_by_platform_endpoint(platform: str, limit: int = Query(50, ge=1, le=500)):
    """
    Get jobs filtered by platform
    
    Path Parameters:
    - platform: One of "youtube", "instagram", etc.
    
    Query Parameters:
    - limit: Number of jobs to return (1-500, default: 50)
    
    Returns:
        {
            "platform": "youtube",
            "items": [...],
            "total": 25
        }
    """
    jobs = get_jobs_by_platform(platform, limit)
    # get_jobs_by_platform already returns full job dictionaries
    serialized_jobs = [export_job_json(job) for job in jobs if job]
    
    return {
        "platform": platform,
        "items": serialized_jobs,
        "total": len(serialized_jobs)
    }


@router.get("/stats/overview")
async def get_stats_overview():
    """
    Get statistics overview of all downloads
    
    Returns:
        {
            "total": number,
            "by_status": {...},
            "by_platform": {...},
            "by_type": {...},
            "by_format": {...}
        }
    """
    return get_stats()


@router.post("/{job_id}/retry")
async def retry_job(job_id: str):
    """
    Retry a failed download job
    
    Returns:
        {"job_id": "new-job-id"} on success
        {"error": "..."} if retry not possible
    """
    if not RetryManager.can_retry(job_id):
        return {"error": "Job cannot be retried"}
    
    new_job_id = RetryManager.create_retry_job(job_id)
    if not new_job_id:
        return {"error": "Failed to create retry job"}
    
    return {
        "job_id": new_job_id,
        "original_job_id": job_id,
        "status": "queued"
    }


@router.get("/{job_id}/retry-info")
async def get_retry_info(job_id: str):
    """Get retry information for a job"""
    info = RetryManager.get_retry_info(job_id)
    if not info:
        raise HTTPException(status_code=404, detail="Job not found")
    return info
