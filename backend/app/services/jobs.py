"""
Unified Job Management Service (CONSOLIDATED)
Replaces both job_store.py and history.py

Single source of truth for:
- Job CRUD operations
- Job state management
- Job persistence in Redis
- Query and filtering
- File operations

All jobs stored as Redis HASHes for consistency
"""

import time
import os
from typing import Dict, List, Optional
from redis_utils import redis_client as redis
from app.config import Config


# Constants
JOB_PREFIX = "job:"
JOBS_LIST_KEY = "jobs:all"
JOB_EXPIRY_SECONDS = 86400  # 24 hours


def safe_delete_file(file_path: str) -> bool:
    """
    Safely delete a file with validation and error handling
    
    Security:
    - Validates file is within downloads directory
    - Prevents path traversal attacks
    - Handles permissions and OS errors
    
    Args:
        file_path: Path to file
    
    Returns:
        True if deleted or already gone, False if failed
    """
    try:
        if not file_path or not os.path.exists(file_path):
            return True  # Already gone
        
        # Security: Ensure file is in downloads directory
        abs_file_path = os.path.abspath(file_path)
        abs_downloads_dir = os.path.abspath(Config.DOWNLOAD_DIR)
        
        if not abs_file_path.startswith(abs_downloads_dir):
            print(f"Security: Blocked delete outside downloads dir: {file_path}")
            return False
        
        if not os.path.isfile(abs_file_path):
            return False  # Not a regular file
        
        os.remove(abs_file_path)
        return True
    except PermissionError:
        print(f"Permission denied deleting {file_path}")
        return False
    except OSError as e:
        print(f"Error deleting {file_path}: {e}")
        return False


def create_job(job_data: Dict) -> str:
    """
    Create a new download job in Redis
    
    Args:
        job_data: Dictionary with job details including:
            - job_id: Unique identifier
            - url: Download URL
            - platform: youtube, instagram, tiktok, twitter, facebook, etc.
            - type: video or audio
            - format: mp4, mp3, etc.
            - quality: selected quality level
            - Any other metadata
    
    Returns:
        job_id (from job_data)
    
    Raises:
        ValueError: If job_id not in job_data
    """
    if "job_id" not in job_data:
        raise ValueError("job_data must contain 'job_id'")
    
    job_id = job_data["job_id"]
    
    # Ensure defaults
    defaults = {
        "created_at": int(time.time()),
        "updated_at": int(time.time()),
        "status": "queued",
        "progress": 0.0,
        "file_name": "",
        "file_path": "",
        "error": "",
        "retry_count": 0,
        "parent_job_id": "",
        "child_job_id": "",
    }
    
    # Merge with provided data (provided data takes precedence)
    final_data = {**defaults, **job_data}
    
    # Store as Redis HASH (atomic, consistent)
    redis.hset(f"{JOB_PREFIX}{job_id}", mapping=final_data)
    
    # Add to jobs list (most recent first)
    redis.lpush(JOBS_LIST_KEY, job_id)
    
    # Set expiration
    redis.expire(f"{JOB_PREFIX}{job_id}", JOB_EXPIRY_SECONDS)
    
    return job_id


def get_job(job_id: str) -> Optional[Dict]:
    """
    Retrieve a job from Redis
    
    Args:
        job_id: The job ID
    
    Returns:
        Dictionary with job data, or None if not found
    """
    job_data = redis.hgetall(f"{JOB_PREFIX}{job_id}")
    
    if not job_data:
        return None
    
    # Convert numeric fields from string to proper types
    numeric_fields = ["progress", "created_at", "updated_at", "retry_count"]
    for field in numeric_fields:
        if field in job_data:
            try:
                job_data[field] = float(job_data[field]) if field == "progress" else int(job_data[field])
            except (ValueError, TypeError):
                pass  # Keep as string if conversion fails
    
    return job_data


def update_job(job_id: str, **updates) -> bool:
    """
    Update specific fields in a job (atomic HASH update)
    
    Args:
        job_id: The job ID
        **updates: Fields to update (e.g., progress=50.5, status="running")
    
    Returns:
        True if job exists and was updated, False if job not found
    """
    # Check job exists
    if not redis.exists(f"{JOB_PREFIX}{job_id}"):
        return False
    
    # Add updated timestamp
    updates["updated_at"] = int(time.time())
    
    # Update HASH atomically
    redis.hset(f"{JOB_PREFIX}{job_id}", mapping=updates)
    
    # Refresh expiration
    redis.expire(f"{JOB_PREFIX}{job_id}", JOB_EXPIRY_SECONDS)
    
    return True


def delete_job(job_id: str) -> bool:
    """
    Delete a job and remove from list
    
    Args:
        job_id: The job ID to delete
    
    Returns:
        True if deleted, False if not found
    """
    # Delete the HASH
    result = redis.delete(f"{JOB_PREFIX}{job_id}")
    
    # Remove from jobs list
    redis.lrem(JOBS_LIST_KEY, 0, job_id)
    
    return result > 0


def list_jobs(limit: int = 50) -> List[Dict]:
    """
    Get recent jobs (most recent first)
    
    Args:
        limit: Maximum number of jobs to return (1-1000)
    
    Returns:
        List of job dictionaries
    """
    limit = max(1, min(limit, 1000))  # Clamp to 1-1000
    
    # Get job IDs from list
    job_ids = redis.lrange(JOBS_LIST_KEY, 0, limit - 1)
    
    jobs = []
    for job_id in job_ids:
        job = get_job(job_id)
        if job:
            jobs.append(job)
    
    return jobs


def count_jobs() -> int:
    """Get total number of jobs in history"""
    return redis.llen(JOBS_LIST_KEY)


def get_jobs_by_status(status: str, limit: int = 50) -> List[Dict]:
    """
    Get jobs filtered by status
    
    Args:
        status: "queued", "running", "done", "error"
        limit: Maximum jobs to return
    
    Returns:
        List of matching jobs (most recent first)
    """
    limit = max(1, min(limit, 1000))
    all_jobs = list_jobs(limit * 3)  # Get extra to filter
    
    return [j for j in all_jobs if j.get("status") == status][:limit]


def get_jobs_by_platform(platform: str, limit: int = 50) -> List[Dict]:
    """
    Get jobs filtered by platform
    
    Args:
        platform: "youtube", "instagram", "tiktok", etc.
        limit: Maximum jobs to return
    
    Returns:
        List of matching jobs (most recent first)
    """
    limit = max(1, min(limit, 1000))
    all_jobs = list_jobs(limit * 3)  # Get extra to filter
    
    return [j for j in all_jobs if j.get("platform") == platform][:limit]


def get_stats() -> Dict:
    """
    Get statistics about all jobs
    
    Returns:
        Dictionary with counts by status, platform, type, format
    """
    all_jobs = list_jobs(500)
    
    stats = {
        "total": len(all_jobs),
        "by_status": {},
        "by_platform": {},
        "by_type": {},
        "by_format": {},
    }
    
    for job in all_jobs:
        # Count by status
        status = job.get("status", "unknown")
        stats["by_status"][status] = stats["by_status"].get(status, 0) + 1
        
        # Count by platform
        platform = job.get("platform", "unknown")
        stats["by_platform"][platform] = stats["by_platform"].get(platform, 0) + 1
        
        # Count by type
        job_type = job.get("type", "unknown")
        stats["by_type"][job_type] = stats["by_type"].get(job_type, 0) + 1
        
        # Count by format
        fmt = job.get("format", "unknown")
        stats["by_format"][fmt] = stats["by_format"].get(fmt, 0) + 1
    
    return stats


def export_job_json(job: Dict) -> Dict:
    """
    Export a job as JSON-serializable dictionary
    
    Args:
        job: Job dictionary from get_job()
    
    Returns:
        JSON-safe dictionary
    """
    if not job:
        return {}
    
    return {
        "job_id": str(job.get("job_id", "")),
        "url": str(job.get("url", "")),
        "platform": str(job.get("platform", "")),
        "type": str(job.get("type", "")),
        "format": str(job.get("format", "")),
        "quality": str(job.get("quality", "")),
        "status": str(job.get("status", "")),
        "progress": float(job.get("progress", 0)),
        "file_name": str(job.get("file_name", "")),
        "file_path": str(job.get("file_path", "")),
        "error": str(job.get("error", "")),
        "created_at": int(job.get("created_at", 0)),
        "updated_at": int(job.get("updated_at", 0)),
        "retry_count": int(job.get("retry_count", 0)),
        "parent_job_id": str(job.get("parent_job_id", "")),
        "child_job_id": str(job.get("child_job_id", "")),
    }
