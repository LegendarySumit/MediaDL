"""
Health check system
Monitor system status and dependencies
Return diagnostic information
"""

import time
from typing import Dict
from app.config import Config
from app.services.concurrency import DownloadSemaphore
from file_utils import get_disk_usage
from redis_utils import redis_client as redis


def check_redis() -> dict:
    """Check Redis connectivity and performance"""
    start = time.time()
    try:
        redis.ping()
        latency = (time.time() - start) * 1000
        
        info = redis.info()
        return {
            "status": "healthy",
            "latency_ms": round(latency, 2),
            "version": info.get("redis_version", "unknown"),
            "used_memory_mb": info.get("used_memory", 0) / (1024**2)
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e)
        }


def check_disk() -> dict:
    """Check disk space and health"""
    usage = get_disk_usage()
    
    status = "healthy"
    if usage["free_gb"] < Config.MIN_DISK_SPACE_GB:
        status = "critical"
    elif usage["percent_used"] > 90:
        status = "warning"
    
    return {
        "status": status,
        "free_gb": round(usage["free_gb"], 2),
        "used_gb": round(usage["used_gb"], 2),
        "total_gb": round(usage["total_gb"], 2),
        "percent_used": round(usage["percent_used"], 1),
        "min_required_gb": Config.MIN_DISK_SPACE_GB
    }


def check_concurrency() -> dict:
    """Check download concurrency stats"""
    status = DownloadSemaphore.get_status()
    
    health = "healthy"
    if status["active"] >= status["max"]:
        health = "at_capacity"
    
    return {
        "status": health,
        "active_downloads": status["active"],
        "max_concurrent": status["max"],
        "available_slots": status["available_slots"],
        "queued_jobs": status["queued"],
        "queue_capacity": Config.MAX_QUEUE_SIZE - status["queued"]
    }


def check_jobs() -> dict:
    """Check job statistics"""
    all_jobs = redis.lrange("jobs:all", 0, -1) or []
    
    stats = {
        "total": len(all_jobs),
        "by_status": {}
    }
    
    for job_id in all_jobs:
        job = redis.hgetall(f"job:{job_id}")
        if job:
            status = job.get("status", "unknown")
            stats["by_status"][status] = stats["by_status"].get(status, 0) + 1
    
    return stats


def get_health_status() -> dict:
    """Get complete health status"""
    return {
        "timestamp": int(time.time()),
        "status": "healthy",  # Overall status
        "redis": check_redis(),
        "disk": check_disk(),
        "concurrency": check_concurrency(),
        "jobs": check_jobs()
    }


def get_detailed_status() -> dict:
    """Get detailed system status with all metrics"""
    health = get_health_status()
    
    # Determine overall health
    statuses = [
        health["redis"].get("status"),
        health["disk"].get("status"),
        health["concurrency"].get("status")
    ]
    
    if "unhealthy" in statuses:
        health["status"] = "unhealthy"
    elif "critical" in statuses:
        health["status"] = "critical"
    elif "warning" in statuses:
        health["status"] = "warning"
    else:
        health["status"] = "healthy"
    
    return health
