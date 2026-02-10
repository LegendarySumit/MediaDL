from redis_client import redis_client
import json

def create_job(job_id, **initial_data):
    """Create a new job in Redis with initial state"""
    job_data = {
        "progress": 0.0,
        "status": "queued",
        "error": None,
        "file_path": None,
        "file_name": None,
        "start_time": initial_data.get("start_time")
    }
    job_data.update(initial_data)
    
    redis_client.set(
        f"job:{job_id}",
        json.dumps(job_data),
        ex=86400  # Auto-expire after 24 hours
    )
    print(f"Job created: {job_id}")

def get_job(job_id):
    """Get job state from Redis"""
    data = redis_client.get(f"job:{job_id}")
    if data:
        return json.loads(data)
    return None

def update_job(job_id, **updates):
    """Update specific fields in a job"""
    job = get_job(job_id)
    if not job:
        return False
    
    job.update(updates)
    redis_client.set(
        f"job:{job_id}",
        json.dumps(job),
        ex=86400  # Refresh expiration
    )
    return True

def delete_job(job_id):
    """Delete a job from Redis"""
    redis_client.delete(f"job:{job_id}")

def list_jobs():
    """Get all active jobs"""
    pattern = redis_client.keys("job:*")
    jobs = {}
    for key in pattern:
        job_id = key.replace("job:", "")
        jobs[job_id] = get_job(job_id)
    return jobs
