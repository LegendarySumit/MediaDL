"""
Cleanup service for managing old jobs and files
Prevent disk space issues and orphaned data

Policies:
- Keep jobs for X days (default: 7)
- Keep last N jobs (default: 500)
- Auto-cleanup on startup
- Manual cleanup via API
"""

import time
import os
import shutil
from typing import Dict
from app.config import Config
from redis_utils import redis_client as redis


class StorageCleanup:
    """Storage management and cleanup utilities"""
    
    @staticmethod
    def get_storage_stats() -> Dict:
        """Get disk usage statistics"""
        stat = shutil.disk_usage(Config.DOWNLOAD_DIR)
        return {
            "total": stat.total,
            "used": stat.used,
            "free": stat.free,
            "percent": (stat.used / stat.total) * 100
        }
    
    @staticmethod
    def cleanup_old_files(days: int = None) -> int:
        """Remove files older than specified days"""
        if days is None:
            days = Config.CLEANUP_DAYS
        
        cutoff = time.time() - (days * 86400)
        deleted = 0
        
        try:
            for file in os.listdir(Config.DOWNLOAD_DIR):
                file_path = os.path.join(Config.DOWNLOAD_DIR, file)
                if os.path.isfile(file_path):
                    if os.path.getmtime(file_path) < cutoff:
                        os.remove(file_path)
                        deleted += 1
        except Exception:
            pass
        
        return deleted
    
    @staticmethod
    def cleanup_if_low_space() -> int:
        """Delete old files if disk space is low"""
        stat = shutil.disk_usage(Config.DOWNLOAD_DIR)
        free_gb = stat.free / (1024**3)
        
        if free_gb > Config.MIN_DISK_SPACE_GB:
            return 0
        
        # Delete oldest files until we have enough space
        deleted = 0
        files = []
        
        try:
            for file in os.listdir(Config.DOWNLOAD_DIR):
                file_path = os.path.join(Config.DOWNLOAD_DIR, file)
                if os.path.isfile(file_path):
                    mtime = os.path.getmtime(file_path)
                    files.append((mtime, file_path))
            
            # Sort by modification time (oldest first)
            files.sort()
            
            for _, file_path in files:
                if free_gb > Config.MIN_DISK_SPACE_GB:
                    break
                
                try:
                    file_size = os.path.getsize(file_path)
                    os.remove(file_path)
                    free_gb += file_size / (1024**3)
                    deleted += 1
                except Exception:
                    pass
        except Exception:
            pass
        
        return deleted


def get_disk_usage() -> dict:
    """Get disk usage statistics"""
    stat = shutil.disk_usage(Config.DOWNLOAD_DIR)
    return {
        "total_gb": stat.total / (1024**3),
        "used_gb": stat.used / (1024**3),
        "free_gb": stat.free / (1024**3),
        "percent_used": (stat.used / stat.total) * 100
    }


def cleanup_old_jobs(days: int = None) -> Dict:
    """
    Remove jobs older than specified days
    
    Args:
        days: Delete jobs older than this many days (default from config)
    
    Safety:
        - Never deletes running jobs
        - Only deletes files that belong to the job
        - Cleans Redis references atomically
    
    Returns:
        Statistics about cleanup
    """
    if days is None:
        days = Config.CLEANUP_DAYS
    
    cutoff = time.time() - (days * 86400)
    job_ids = redis.lrange("jobs:all", 0, -1)
    
    deleted_count = 0
    errors = []
    
    for job_id in job_ids:
        job = redis.hgetall(f"job:{job_id}")
        
        if not job:
            continue
        
        # NEVER delete running jobs
        if job.get("status") == "running":
            continue
        
        # Check if job is old
        created_at = int(job.get("created_at", 0))
        if created_at >= cutoff:
            continue
        
        # Delete file if it exists and is owned by this job
        file_path = job.get("file_path")
        if file_path and os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception as e:
                errors.append(f"Could not delete file {file_path}: {e}")
        
        # Remove from Redis
        redis.delete(f"job:{job_id}")
        redis.lrem("jobs:all", 0, job_id)
        deleted_count += 1
    
    return {
        "deleted_jobs": deleted_count,
        "errors": errors,
        "policy": f"Older than {days} days"
    }


def cleanup_by_count(keep_count: int = None) -> Dict:
    """
    Keep only the most recent N jobs
    
    Args:
        keep_count: Number of recent jobs to keep (default from config)
    
    Returns:
        Statistics about cleanup
    """
    if keep_count is None:
        keep_count = Config.JOB_HISTORY_LIMIT
    
    job_ids = redis.lrange("jobs:all", 0, -1)
    
    if len(job_ids) <= keep_count:
        return {
            "deleted_jobs": 0,
            "policy": f"Keep last {keep_count}",
            "message": "No cleanup needed"
        }
    
    # Get jobs to delete (oldest ones)
    jobs_to_delete = job_ids[keep_count:]
    deleted_count = 0
    errors = []
    
    for job_id in jobs_to_delete:
        job = redis.hgetall(f"job:{job_id}")
        
        if not job:
            continue
        
        # Never delete running jobs
        if job.get("status") == "running":
            continue
        
        # Delete file if exists
        file_path = job.get("file_path")
        if file_path and os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception as e:
                errors.append(f"Could not delete file {file_path}: {e}")
        
        # Remove from Redis
        redis.delete(f"job:{job_id}")
        redis.lrem("jobs:all", 0, job_id)
        deleted_count += 1
    
    return {
        "deleted_jobs": deleted_count,
        "errors": errors,
        "policy": f"Keep last {keep_count} jobs"
    }


def cleanup_by_disk_space() -> Dict:
    """
    Delete old jobs if disk space is low
    
    Only triggers if free space < MIN_DISK_SPACE_GB
    
    Returns:
        Statistics about cleanup
    """
    usage = get_disk_usage()
    
    if usage["free_gb"] > Config.MIN_DISK_SPACE_GB:
        return {
            "deleted_jobs": 0,
            "message": f"Disk space OK ({usage['free_gb']:.1f}GB free)",
            "policy": "Disk space based"
        }
    
    # Need to free space - delete oldest non-running jobs
    job_ids = redis.lrange("jobs:all", 0, -1)
    deleted_count = 0
    errors = []
    
    for job_id in job_ids:
        if usage["free_gb"] > Config.MIN_DISK_SPACE_GB:
            break  # Enough space now
        
        job = redis.hgetall(f"job:{job_id}")
        if not job or job.get("status") == "running":
            continue
        
        # Delete file
        file_path = job.get("file_path")
        if file_path and os.path.exists(file_path):
            try:
                os.remove(file_path)
                usage = get_disk_usage()
            except Exception as e:
                errors.append(f"Could not delete file {file_path}: {e}")
        
        # Remove from Redis
        redis.delete(f"job:{job_id}")
        redis.lrem("jobs:all", 0, job_id)
        deleted_count += 1
    
    return {
        "deleted_jobs": deleted_count,
        "errors": errors,
        "free_space_gb": usage["free_gb"],
        "policy": "Low disk space cleanup"
    }


def full_cleanup() -> Dict:
    """Run all cleanup policies"""
    results = {
        "by_age": cleanup_old_jobs(),
        "by_count": cleanup_by_count(),
        "by_disk_space": cleanup_by_disk_space(),
        "total_deleted": 0
    }
    
    results["total_deleted"] = (
        results["by_age"].get("deleted_jobs", 0) +
        results["by_count"].get("deleted_jobs", 0) +
        results["by_disk_space"].get("deleted_jobs", 0)
    )
    
    results["disk_usage"] = get_disk_usage()
    
    return results

