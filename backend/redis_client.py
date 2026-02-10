import redis
import fakeredis
import os

# Determine Redis host from environment (Docker vs local)
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
USE_FAKEREDIS = os.getenv("USE_FAKEREDIS", "true").lower() == "true"

# Use fakeredis for development (in-memory), real Redis for production
if USE_FAKEREDIS:
    redis_client = fakeredis.FakeRedis(decode_responses=True)
    print(f"✓ Redis (fakeredis - in-memory) connected and ready")
else:
    redis_client = redis.Redis(
        host=REDIS_HOST,
        port=6379,
        decode_responses=True,
        socket_connect_timeout=5,
        socket_keepalive=True
    )
    try:
        redis_client.ping()
        print(f"✓ Redis connected at {REDIS_HOST}:6379")
    except redis.ConnectionError as e:
        print(f"✗ Redis connection failed: {e}")
        print(f"  Make sure Redis is running at {REDIS_HOST}:6379")
        raise
