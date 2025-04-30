from .logging_config import get_logger
from typing import Dict, Any, Optional

def get_module_logger(module_name: str, extra: Optional[Dict[str, Any]] = None):
    """
    Get a logger for a specific module with optional extra context.
    
    Args:
        module_name: The name of the module, typically __name__
        extra: Optional extra context to add to all log records
        
    Returns:
        A configured logger
    
    Example:
        ```python
        from app.utils.logger import get_module_logger
        
        logger = get_module_logger(__name__)
        logger.info("This is an info message")
        
        # With extra context
        request_logger = get_module_logger(__name__, {"request_id": "123456"})
        request_logger.info("Processing request")
        ```
    """
    return get_logger(module_name, extra)


class RequestContextLogger:
    """
    Logger that automatically includes request context information.
    Useful for tracking logs related to specific requests.
    """
    
    def __init__(self, module_name: str, request_id: str, user_id: Optional[str] = None):
        """
        Create a logger with request context.
        
        Args:
            module_name: The name of the module
            request_id: The unique ID of the request
            user_id: Optional user ID associated with the request
        """
        extra = {
            "request_id": request_id,
        }
        
        if user_id:
            extra["user_id"] = user_id
            
        self.logger = get_logger(module_name, extra)
    
    def info(self, msg: str, *args, **kwargs):
        """Log info message with request context"""
        self.logger.info(msg, *args, **kwargs)
    
    def error(self, msg: str, *args, **kwargs):
        """Log error message with request context"""
        self.logger.error(msg, *args, **kwargs)
    
    def warning(self, msg: str, *args, **kwargs):
        """Log warning message with request context"""
        self.logger.warning(msg, *args, **kwargs)
    
    def debug(self, msg: str, *args, **kwargs):
        """Log debug message with request context"""
        self.logger.debug(msg, *args, **kwargs)
    
    def critical(self, msg: str, *args, **kwargs):
        """Log critical message with request context"""
        self.logger.critical(msg, *args, **kwargs)
    
    def exception(self, msg: str, *args, **kwargs):
        """Log exception with request context"""
        self.logger.exception(msg, *args, **kwargs) 