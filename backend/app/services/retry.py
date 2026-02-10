"""
Retry system for failed downloads
Tracks retry count, maintains parent-child job relationships
Safe across restarts via Redis
"""

import uuid
from app.services.jobs import create_job, update_job, get_job
from app.config import Config

try:
    from redis_utils import redis_client as redis
except ImportError:
    try:
        import fakeredis
        redis = fakeredis.FakeRedis(decode_responses=True)
    except:
        from redis import Redis
        redis = Redis(host=Config.REDIS_HOST, port=Config.REDIS_PORT, decode_responses=True)


class RetryManager:
    """Manage job retries"""
    
    @classmethod
    def create_retry_job(cls, original_job_id: str, new_params: dict = None) -> str:
        """
        Create a new job that retries a failed job
        
        Args:
            original_job_id: ID of the failed job
            new_params: Optional parameter overrides
        
        Returns:
            New job ID, or None if retry limit exceeded
        """
        original_job = get_job(original_job_id)
        
        if not original_job:
            return None
        
        # Get retry count
        retry_count = int(original_job.get("retry_count", 0))
        
        if retry_count >= Config.MAX_RETRIES:
            return None  # Exceeded max retries
        
        # Create new job with same parameters
        new_job_id = str(uuid.uuid4())
        
        job_data = {
            "job_id": new_job_id,
            "url": new_params.get("url") if new_params else original_job.get("url"),
            "platform": new_params.get("platform") if new_params else original_job.get("platform"),
            "type": new_params.get("type") if new_params else original_job.get("type"),
            "format": new_params.get("format") if new_params else original_job.get("format"),
            "quality": new_params.get("quality") if new_params else original_job.get("quality"),
            "status": "queued",
            "progress": 0,
            "retry_count": retry_count + 1,
            "parent_job_id": original_job_id,
            "file_name": "",
            "file_path": "",
            "error": "",
        }
        
        create_job(job_data)
        
        # Update original job to mark it as having a retry
        update_job(original_job_id, child_job_id=new_job_id)
        
        return new_job_id
    
    @classmethod
    def get_retry_chain(cls, job_id: str) -> list:
        """
        Get full retry chain for a job
        
        Args:
            job_id: Job ID to trace
        
        Returns:
            List of job IDs from original to current
        """
        chain = [job_id]
        current_job = get_job(job_id)
        
        # Trace backwards to original
        while current_job and current_job.get("parent_job_id"):
            parent_id = current_job.get("parent_job_id")
            chain.insert(0, parent_id)
            current_job = get_job(parent_id)
        
        # Trace forwards to latest
        latest = get_job(job_id)
        while latest and latest.get("child_job_id"):
            child_id = latest.get("child_job_id")
            chain.append(child_id)
            latest = get_job(child_id)
        
        return chain
    
    @classmethod
    def can_retry(cls, job_id: str) -> bool:
        """Check if job can be retried"""
        job = get_job(job_id)
        if not job:
            return False
        
        # Must be in error or cancelled state
        if job.get("status") not in ("error", "cancelled"):
            return False
        
        # Must not exceed max retries
        retry_count = int(job.get("retry_count", 0))
        if retry_count >= Config.MAX_RETRIES:
            return False
        
        return True
    
    @classmethod
    def get_retry_info(cls, job_id: str) -> dict:
        """Get retry information for a job"""
        job = get_job(job_id)
        if not job:
            return {}
        
        retry_count = int(job.get("retry_count", 0))
        can_retry = cls.can_retry(job_id)
        
        return {
            "job_id": job_id,
            "retry_count": retry_count,
            "max_retries": Config.MAX_RETRIES,
            "retries_remaining": max(0, Config.MAX_RETRIES - retry_count),
            "can_retry": can_retry,
            "parent_job_id": job.get("parent_job_id"),
            "child_job_id": job.get("child_job_id"),
        }
