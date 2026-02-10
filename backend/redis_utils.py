"""
Centralized Redis client initialization
Consistent pattern for all services
"""

import os
import redis
import fakeredis


def get_redis_client():
    """
    Get Redis client with proper fallback handling
    
    Returns:
        Redis client instance (real Redis or FakeRedis)
    
    Environment Variables:
        USE_FAKEREDIS: If "true", uses in-memory fakeredis (default: true for dev)
        REDIS_HOST: Redis server host (default: localhost)
        REDIS_PORT: Redis server port (default: 6379)
        REDIS_DB: Redis database number (default: 0)
    """
    use_fake = os.getenv("USE_FAKEREDIS", "true").lower() == "true"
    
    if use_fake:
        # Development: in-memory Redis
        client = fakeredis.FakeRedis(decode_responses=True)
        print("[OK] Redis (fakeredis - in-memory) initialized")
        return client
    
    # Production: real Redis
    host = os.getenv("REDIS_HOST", "localhost")
    port = int(os.getenv("REDIS_PORT", "6379"))
    db = int(os.getenv("REDIS_DB", "0"))
    
    try:
        client = redis.Redis(
            host=host,
            port=port,
            db=db,
            decode_responses=True,
            socket_connect_timeout=5,
            socket_keepalive=True
        )
        # Test connection
        client.ping()
        print(f"✓ Redis connected at {host}:{port}")
        return client
    except redis.ConnectionError as e:
        print(f"✗ Redis connection failed: {e}")
        print(f"  Falling back to in-memory fakeredis")
        return fakeredis.FakeRedis(decode_responses=True)


# Singleton instance
redis_client = get_redis_client()
