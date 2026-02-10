"""
Download history service
Manages download job persistence in Redis
"""

import time
from redis import Redis
import os

# Import redis client from parent directory
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from redis_client import redis_client as redis
except ImportError:
    # Fallback for Redis connection if redis_client not available
    try:
        import fakeredis
        redis = fakeredis.FakeStrictRedis(decode_responses=True)
    except:
        redis = Redis(host="localhost", port=6379, decode_responses=True)


def create_job(job_data: dict) -> str:
    """
    Create a new download job in Redis
    
    Args:
        job_data: Dictionary with job details (job_id, url, platform, type, format, quality, etc.)
    
    Returns:
        job_id
    """
    job_data["created_at"] = int(time.time())
    job_data["updated_at"] = job_data["created_at"]
    
    # Set default values if not provided
    if "status" not in job_data:
        job_data["status"] = "queued"
    if "progress" not in job_data:
        job_data["progress"] = 0
    if "file_name" not in job_data:
        job_data["file_name"] = ""
    if "file_path" not in job_data:
        job_data["file_path"] = ""
    if "error" not in job_data:
        job_data["error"] = ""
    
    job_id = job_data["job_id"]
    
    # Store as Redis HASH
    redis.hset(f"job:{job_id}", mapping=job_data)
    
    # Add to ordered list for history
    redis.lpush("jobs:all", job_id)
    
    # Set expiration to 24 hours (86400 seconds)
    redis.expire(f"job:{job_id}", 86400)
    
    return job_id


def update_job(job_id: str, **updates) -> bool:
    """
    Update job fields in Redis
    
    Args:
        job_id: The job ID
        **updates: Fields to update (progress, status, file_name, file_path, error, etc.)
    
    Returns:
        True if successful
    """
    updates["updated_at"] = int(time.time())
    
    # Update the HASH
    redis.hset(f"job:{job_id}", mapping=updates)
    
    # Refresh expiration
    redis.expire(f"job:{job_id}", 86400)
    
    return True


def get_job(job_id: str) -> dict:
    """
    Retrieve a job from Redis
    
    Args:
        job_id: The job ID
    
    Returns:
        Dictionary with job data, or empty dict if not found
    """
    job = redis.hgetall(f"job:{job_id}")
    
    # Convert numeric fields
    if job:
        for key in ["progress", "created_at", "updated_at"]:
            if key in job:
                try:
                    job[key] = float(job[key]) if key == "progress" else int(job[key])
                except (ValueError, TypeError):
                    pass
    
    return job


def list_jobs(limit: int = 50) -> list:
    """
    List all download jobs (most recent first)
    
    Args:
        limit: Maximum number of jobs to return
    
    Returns:
        List of job dictionaries
    """
    # Get job IDs from the ordered list
    job_ids = redis.lrange("jobs:all", 0, limit - 1)
    
    jobs = []
    for job_id in job_ids:
        job = get_job(job_id)
        if job:
            jobs.append(job)
    
    return jobs


def delete_job(job_id: str) -> bool:
    """
    Delete a job from history
    
    Args:
        job_id: The job ID
    
    Returns:
        True if successful
    """
    redis.delete(f"job:{job_id}")
    redis.lrem("jobs:all", 1, job_id)
    return True


def count_jobs() -> int:
    """Get total number of jobs in history"""
    return redis.llen("jobs:all")


def clear_old_jobs(seconds: int = 86400) -> int:
    """
    Clear jobs older than specified seconds
    
    Args:
        seconds: Age threshold in seconds (default: 24 hours)
    
    Returns:
        Number of jobs deleted
    """
    current_time = int(time.time())
    cutoff_time = current_time - seconds
    
    deleted = 0
    job_ids = redis.lrange("jobs:all", 0, -1)
    
    for job_id in job_ids:
        job = get_job(job_id)
        if job and int(job.get("created_at", 0)) < cutoff_time:
            delete_job(job_id)
            deleted += 1
    
    return deleted


def get_jobs_by_status(status: str, limit: int = 50) -> list:
    """
    Get jobs by status (queued, running, done, error)
    
    Args:
        status: Job status to filter by
        limit: Maximum number of jobs to return
    
    Returns:
        List of job dictionaries matching the status
    """
    all_jobs = list_jobs(limit * 2)  # Get extra to account for filtering
    matching_jobs = [job for job in all_jobs if job.get("status") == status]
    return matching_jobs[:limit]


def get_jobs_by_platform(platform: str, limit: int = 50) -> list:
    """
    Get jobs by platform (youtube, instagram, etc.)
    
    Args:
        platform: Platform name
        limit: Maximum number of jobs to return
    
    Returns:
        List of job dictionaries from that platform
    """
    all_jobs = list_jobs(limit * 2)
    matching_jobs = [job for job in all_jobs if job.get("platform") == platform]
    return matching_jobs[:limit]


def export_job_json(job_id: str) -> dict:
    """
    Export a job as JSON-serializable dictionary
    
    Args:
        job_id: The job ID
    
    Returns:
        Dictionary ready for JSON serialization
    """
    job = get_job(job_id)
    if not job:
        return {}
    
    # Ensure all values are JSON-serializable
    return {
        "job_id": job.get("job_id", ""),
        "url": job.get("url", ""),
        "platform": job.get("platform", ""),
        "type": job.get("type", ""),
        "format": job.get("format", ""),
        "quality": job.get("quality", ""),
        "status": job.get("status", ""),
        "progress": float(job.get("progress", 0)),
        "file_name": job.get("file_name", ""),
        "file_path": job.get("file_path", ""),
        "error": job.get("error", ""),
        "created_at": int(job.get("created_at", 0)),
        "updated_at": int(job.get("updated_at", 0))
    }
