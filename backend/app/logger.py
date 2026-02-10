"""
Structured logging system
Separate logs for info, errors, and jobs
Automatic rotation to prevent disk fill
"""

import logging
import logging.handlers
import os
from app.config import Config


class JobFormatter(logging.Formatter):
    """Custom formatter with job context"""
    
    def format(self, record):
        if hasattr(record, 'job_id'):
            record.job_id_str = f"[{record.job_id}]"
        else:
            record.job_id_str = ""
        
        return super().format(record)


def setup_logging():
    """Configure structured logging with rotation"""
    
    # Ensure log directory exists
    os.makedirs(Config.LOG_DIR, exist_ok=True)
    
    # Main logger
    main_logger = logging.getLogger("media_downloader")
    main_logger.setLevel(getattr(logging, Config.LOG_LEVEL))
    
    # Remove existing handlers
    main_logger.handlers = []
    
    # Console handler
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    console_formatter = logging.Formatter(
        '[%(asctime)s] %(levelname)s: %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    console_handler.setFormatter(console_formatter)
    main_logger.addHandler(console_handler)
    
    # Info file handler with rotation
    info_file = os.path.join(Config.LOG_DIR, "app.log")
    info_handler = logging.handlers.RotatingFileHandler(
        info_file,
        maxBytes=Config.LOG_MAX_SIZE_MB * 1024 * 1024,
        backupCount=Config.LOG_BACKUP_COUNT
    )
    info_handler.setLevel(logging.INFO)
    file_formatter = logging.Formatter(
        '[%(asctime)s] %(levelname)s %(job_id_str)s: %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    info_handler.setFormatter(JobFormatter(file_formatter._fmt, datefmt=file_formatter.datefmt))
    main_logger.addHandler(info_handler)
    
    # Error file handler with rotation
    error_file = os.path.join(Config.LOG_DIR, "errors.log")
    error_handler = logging.handlers.RotatingFileHandler(
        error_file,
        maxBytes=Config.LOG_MAX_SIZE_MB * 1024 * 1024,
        backupCount=Config.LOG_BACKUP_COUNT
    )
    error_handler.setLevel(logging.ERROR)
    error_formatter = logging.Formatter(
        '[%(asctime)s] ERROR %(job_id_str)s: %(message)s [%(pathname)s:%(lineno)d]',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    error_handler.setFormatter(JobFormatter(error_formatter._fmt, datefmt=error_formatter.datefmt))
    main_logger.addHandler(error_handler)
    
    return main_logger


# Initialize logger
logger = setup_logging()


def get_logger(name: str = "media_downloader") -> logging.Logger:
    """Get logger instance"""
    return logging.getLogger(name)


def log_job(job_id: str, message: str, level: str = "info"):
    """Log with job context"""
    log_method = getattr(logger, level.lower(), logger.info)
    extra = {"job_id": job_id}
    
    if level.lower() == "error":
        logger.error(message, extra=extra)
    else:
        log_method(message)
