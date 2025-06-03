import os
import logging
import logging.handlers
from logging.handlers import RotatingFileHandler, TimedRotatingFileHandler
import json
from datetime import datetime
from typing import Dict, Any, Optional

# Import settings to get LOG_DIR
try:
    from app.config import settings
    logs_dir = settings.LOG_DIR
except ImportError:
    # Fallback for cases where settings might not be available
    logs_dir = os.getenv("LOG_DIR", "logs")

# Create logs directory if it doesn't exist
os.makedirs(logs_dir, exist_ok=True)

# Log file paths
INFO_LOG_FILE = os.path.join(logs_dir, 'info.log')
ERROR_LOG_FILE = os.path.join(logs_dir, 'error.log')
DEBUG_LOG_FILE = os.path.join(logs_dir, 'debug.log')
WARNING_LOG_FILE = os.path.join(logs_dir, 'warning.log')
AI_LOG_FILE = os.path.join(logs_dir, 'ai_tasks.log')  # New log file for AI tasks

# Maximum log file size (10 MB)
MAX_LOG_SIZE = 10 * 1024 * 1024

# Formatter for structured JSON logs
class JSONFormatter(logging.Formatter):
    """
    Formatter that outputs JSON strings after parsing the log record.
    """
    def __init__(self, **kwargs):
        self.json_default = kwargs.pop("json_default", str)
        super().__init__(**kwargs)

    def format(self, record):
        log_record = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
            "message": record.getMessage(),
        }
        
        # Add exception info if exists
        if record.exc_info:
            log_record["exception"] = self.formatException(record.exc_info)
        
        # Add extra attributes from the record
        if hasattr(record, "extra"):
            log_record.update(record.extra)
            
        # Include ai_task data directly in the log record if present
        if hasattr(record, "ai_task"):
            log_record["ai_task"] = record.ai_task
        
        # Remove sensitive data keys
        self._remove_sensitive_data(log_record)
        
        return json.dumps(log_record)
    
    def _remove_sensitive_data(self, log_record: Dict[str, Any]) -> None:
        """Remove sensitive data from the log record"""
        sensitive_keys = ['password', 'token', 'secret', 'api_key', 'authorization', 
                          'access_token', 'refresh_token', 'private_key', 'jwt']
        
        for key in list(log_record.keys()):
            if any(sensitive in key.lower() for sensitive in sensitive_keys):
                log_record[key] = "[REDACTED]"


# Standard formatter for console output
CONSOLE_FORMAT = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
console_formatter = logging.Formatter(CONSOLE_FORMAT)

# File formatters
json_formatter = JSONFormatter()

# Configure logging
def setup_logging(log_level=logging.INFO):
    """
    Configure global logging settings
    """
    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)
    
    # Clear any existing handlers
    if root_logger.handlers:
        root_logger.handlers.clear()
    
    # Console handler
    console_handler = logging.StreamHandler()
    console_handler.setLevel(log_level)
    console_handler.setFormatter(console_formatter)
    root_logger.addHandler(console_handler)
    
    # Create rotating file handlers for each log level
    
    # Debug logs (daily rotation)
    debug_handler = TimedRotatingFileHandler(
        DEBUG_LOG_FILE, when='midnight', backupCount=30
    )
    debug_handler.setLevel(logging.DEBUG)
    debug_handler.setFormatter(json_formatter)
    
    # Info logs (size-based rotation)
    info_handler = RotatingFileHandler(
        INFO_LOG_FILE, maxBytes=MAX_LOG_SIZE, backupCount=5
    )
    info_handler.setLevel(logging.INFO)
    info_handler.setFormatter(json_formatter)
    
    # Warning logs (daily rotation)
    warning_handler = TimedRotatingFileHandler(
        WARNING_LOG_FILE, when='midnight', backupCount=30
    )
    warning_handler.setLevel(logging.WARNING)
    warning_handler.setFormatter(json_formatter)
    
    # Error logs (size-based rotation with more backups)
    error_handler = RotatingFileHandler(
        ERROR_LOG_FILE, maxBytes=MAX_LOG_SIZE, backupCount=10
    )
    error_handler.setLevel(logging.ERROR)
    error_handler.setFormatter(json_formatter)
    
    # Add handlers to the root logger
    root_logger.addHandler(debug_handler)
    root_logger.addHandler(info_handler)
    root_logger.addHandler(warning_handler)
    root_logger.addHandler(error_handler)
    
    # AI tasks logger - THIS IS THE IMPORTANT CHANGE
    # Create a separate logger for AI tasks rather than using root logger
    ai_logger = logging.getLogger("ai_tasks")
    ai_logger.setLevel(logging.INFO)
    ai_logger.propagate = False  # Prevent log messages from propagating to root logger
    
    # AI tasks logs (size-based rotation)
    ai_handler = RotatingFileHandler(
        AI_LOG_FILE, maxBytes=MAX_LOG_SIZE, backupCount=10
    )
    ai_handler.setLevel(logging.INFO)
    ai_handler.setFormatter(json_formatter)
    
    # Add handler to the AI tasks logger specifically
    ai_logger.addHandler(ai_handler)


def get_logger(name: str, extra: Optional[Dict[str, Any]] = None) -> logging.Logger:
    """
    Get a logger with the specified name and optional extra context.
    
    Args:
        name: The name of the logger, usually __name__
        extra: Optional extra context to add to all log records
        
    Returns:
        A configured logger
    """
    logger = logging.getLogger(name)
    
    if extra:
        # Create a logger adapter with extra context
        logger = logging.LoggerAdapter(logger, extra)
        
    return logger


# Initialize logging when this module is imported
setup_logging() 