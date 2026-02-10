"""
Concurrency control system
Limits concurrent downloads to prevent CPU/memory overload
Uses Redis semaphore for safe multi-process coordination
"""

import time
from typing import Dict
from app.config import Config
from redis_utils import redis_client as redis


class DownloadSemaphore:
    """
    Semaphore for limiting concurrent downloads
    Safe across multiple processes via Redis
    """
    
    SEMAPHORE_KEY = "download:semaphore"
    QUEUE_KEY = "download:queue"
    
    @classmethod
    def acquire(cls, job_id: str, timeout_seconds: int = 300) -> bool:
        """
        Try to acquire a download slot
        
        Args:
            job_id: The job requesting the slot
            timeout_seconds: Max time to wait for a slot
        
        Returns:
            True if slot acquired, False if timeout
        """
        start_time = time.time()
        
        while True:
            # Get current count
            count = redis.incr(f"{cls.SEMAPHORE_KEY}:count", 1)
            
            # Check if within limit
            if count <= Config.MAX_CONCURRENT_DOWNLOADS:
                # Add to active set
                redis.sadd(f"{cls.SEMAPHORE_KEY}:active", job_id)
                # Remove from queue if present
                redis.lrem(cls.QUEUE_KEY, 0, job_id)
                return True
            else:
                # Decrement (we didn't get a slot)
                redis.decr(f"{cls.SEMAPHORE_KEY}:count", 1)
                
                # Add to queue if not already there
                if not redis.lfrompop(cls.QUEUE_KEY, count=1, numtoremove=0):
                    redis.rpush(cls.QUEUE_KEY, job_id)
                
                # Check timeout
                if time.time() - start_time > timeout_seconds:
                    return False
                
                # Wait before retry
                time.sleep(1)
    
    @classmethod
    def release(cls, job_id: str):
        """Release a download slot"""
        # Remove from active set
        redis.srem(f"{cls.SEMAPHORE_KEY}:active", job_id)
        
        # Decrement active count
        count = redis.decr(f"{cls.SEMAPHORE_KEY}:count", 1)
        if count < 0:
            redis.set(f"{cls.SEMAPHORE_KEY}:count", 0)
    
    @classmethod
    def get_status(cls) -> Dict:
        """Get concurrency status"""
        active_count = max(0, int(redis.get(f"{cls.SEMAPHORE_KEY}:count") or 0))
        active_jobs = redis.smembers(f"{cls.SEMAPHORE_KEY}:active") or set()
        queued_jobs = redis.lrange(cls.QUEUE_KEY, 0, -1) or []
        
        return {
            "active": active_count,
            "max": Config.MAX_CONCURRENT_DOWNLOADS,
            "available_slots": max(0, Config.MAX_CONCURRENT_DOWNLOADS - active_count),
            "queued": len(queued_jobs),
            "active_jobs": list(active_jobs),
            "queued_jobs": queued_jobs
        }
    
    @classmethod
    def reset(cls):
        """Reset semaphore (use on startup)"""
        redis.delete(f"{cls.SEMAPHORE_KEY}:count")
        redis.delete(f"{cls.SEMAPHORE_KEY}:active")
        redis.delete(cls.QUEUE_KEY)
        redis.set(f"{cls.SEMAPHORE_KEY}:count", 0)


def check_queue_status() -> bool:
    """
    Check if queue is full
    
    Returns:
        True if can accept new jobs, False if at capacity
    """
    status = DownloadSemaphore.get_status()
    total = status["active"] + status["queued"]
    return total < Config.MAX_QUEUE_SIZE
