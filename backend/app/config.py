"""
Configuration management
Centralized settings for the application
No need to edit code to change behavior
"""

import os
from pathlib import Path

# Get project root
PROJECT_ROOT = Path(__file__).parent.parent.parent

class Config:
    """Main application configuration"""
    
    # Download settings
    DOWNLOAD_DIR = os.getenv("DOWNLOAD_DIR", str(PROJECT_ROOT / "backend" / "downloads"))
    MAX_DOWNLOAD_SIZE_GB = float(os.getenv("MAX_DOWNLOAD_SIZE_GB", "50"))
    VIDEO_QUALITY = os.getenv("VIDEO_QUALITY", "720")
    AUDIO_QUALITY = os.getenv("AUDIO_QUALITY", "192")
    
    # Concurrency settings
    MAX_CONCURRENT_DOWNLOADS = int(os.getenv("MAX_CONCURRENT_DOWNLOADS", "2"))
    MAX_QUEUE_SIZE = int(os.getenv("MAX_QUEUE_SIZE", "50"))
    
    # Cleanup settings
    CLEANUP_DAYS = int(os.getenv("CLEANUP_DAYS", "7"))
    CLEANUP_MIN_DISK_SPACE_GB = float(os.getenv("CLEANUP_MIN_DISK_SPACE_GB", "5"))
    AUTO_CLEANUP_ON_STARTUP = os.getenv("AUTO_CLEANUP_ON_STARTUP", "true").lower() == "true"
    
    # Retry settings
    MAX_RETRIES = int(os.getenv("MAX_RETRIES", "3"))
    RETRY_DELAY_SECONDS = int(os.getenv("RETRY_DELAY_SECONDS", "5"))
    
    # Redis settings
    REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
    REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
    REDIS_DB = int(os.getenv("REDIS_DB", "0"))
    
    # Health check settings
    MIN_DISK_SPACE_GB = float(os.getenv("MIN_DISK_SPACE_GB", "1"))
    HEALTH_CHECK_INTERVAL = int(os.getenv("HEALTH_CHECK_INTERVAL", "60"))
    
    # Logging settings
    LOG_DIR = os.getenv("LOG_DIR", str(PROJECT_ROOT / "backend" / "logs"))
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
    LOG_MAX_SIZE_MB = int(os.getenv("LOG_MAX_SIZE_MB", "10"))
    LOG_BACKUP_COUNT = int(os.getenv("LOG_BACKUP_COUNT", "5"))
    
    # API settings
    API_HOST = os.getenv("API_HOST", "0.0.0.0")
    API_PORT = int(os.getenv("API_PORT", "8001"))  # Changed from 8000 to 8001
    API_RELOAD = os.getenv("API_RELOAD", "false").lower() == "true"
    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*").split(",")
    
    # Rate Limiting
    RATE_LIMIT_ENABLED = os.getenv("RATE_LIMIT_ENABLED", "true").lower() == "true"
    VIDEO_REQUESTS_PER_MINUTE = int(os.getenv("VIDEO_REQUESTS_PER_MINUTE", "5"))
    AUDIO_REQUESTS_PER_MINUTE = int(os.getenv("AUDIO_REQUESTS_PER_MINUTE", "10"))
    DOWNLOAD_REQUESTS_PER_MINUTE = int(os.getenv("DOWNLOAD_REQUESTS_PER_MINUTE", "15"))
    
    # Job settings
    JOB_TIMEOUT_MINUTES = int(os.getenv("JOB_TIMEOUT_MINUTES", "120"))
    JOB_HISTORY_LIMIT = int(os.getenv("JOB_HISTORY_LIMIT", "500"))
    
    @classmethod
    def validate(cls):
        """Validate configuration values"""
        errors = []
        
        if cls.MAX_CONCURRENT_DOWNLOADS < 1:
            errors.append("MAX_CONCURRENT_DOWNLOADS must be at least 1")
        
        if cls.MAX_CONCURRENT_DOWNLOADS > 10:
            errors.append("MAX_CONCURRENT_DOWNLOADS should not exceed 10 (system safety)")
        
        if cls.CLEANUP_DAYS < 1:
            errors.append("CLEANUP_DAYS must be at least 1")
        
        if cls.MAX_RETRIES < 0:
            errors.append("MAX_RETRIES cannot be negative")
        
        if not os.path.exists(cls.DOWNLOAD_DIR):
            try:
                os.makedirs(cls.DOWNLOAD_DIR, exist_ok=True)
            except Exception as e:
                errors.append(f"Cannot create DOWNLOAD_DIR: {e}")
        
        if not os.path.exists(cls.LOG_DIR):
            try:
                os.makedirs(cls.LOG_DIR, exist_ok=True)
            except Exception as e:
                errors.append(f"Cannot create LOG_DIR: {e}")
        
        if errors:
            raise ValueError(f"Configuration errors:\n" + "\n".join(errors))
    
    @classmethod
    def print_config(cls):
        """Print current configuration (for debugging)"""
        print("\n" + "="*60)
        print("CONFIGURATION LOADED")
        print("="*60)
        print(f"Download directory: {cls.DOWNLOAD_DIR}")
        print(f"Max concurrent downloads: {cls.MAX_CONCURRENT_DOWNLOADS}")
        print(f"Cleanup after: {cls.CLEANUP_DAYS} days")
        print(f"Max retries: {cls.MAX_RETRIES}")
        print(f"Redis: {cls.REDIS_HOST}:{cls.REDIS_PORT}")
        print(f"API: http://{cls.API_HOST}:{cls.API_PORT}")
        print("="*60 + "\n")


# Validate on import
try:
    Config.validate()
except ValueError as e:
    print(f"FATAL: {e}")
    raise
