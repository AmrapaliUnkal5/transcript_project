"""
Custom exceptions with integrated logging.

This module provides custom exception classes that automatically log
when they are raised, making it easier to track and debug errors.
"""
from fastapi import HTTPException, status
from .logger import get_module_logger

logger = get_module_logger(__name__)

class LoggedException(Exception):
    """Base class for exceptions that automatically log when raised."""
    
    def __init__(self, message: str, log_level: str = "error", extra: dict = None):
        """
        Initialize the exception with a message and log it.
        
        Args:
            message: The error message
            log_level: The logging level to use (debug, info, warning, error, critical)
            extra: Additional context to include in the log
        """
        self.message = message
        self.extra = extra or {}
        
        # Log the exception
        log_method = getattr(logger, log_level)
        log_method(f"{self.__class__.__name__}: {message}", extra=self.extra)
        
        super().__init__(message)


class AuthenticationError(LoggedException):
    """Exception raised for authentication errors."""
    
    def __init__(self, message: str = "Authentication failed", extra: dict = None):
        super().__init__(message, "error", extra)


class AuthorizationError(LoggedException):
    """Exception raised for authorization errors."""
    
    def __init__(self, message: str = "Not authorized to perform this action", extra: dict = None):
        super().__init__(message, "warning", extra)


class ValidationError(LoggedException):
    """Exception raised for data validation errors."""
    
    def __init__(self, message: str = "Invalid data", extra: dict = None):
        super().__init__(message, "warning", extra)


class ResourceNotFoundError(LoggedException):
    """Exception raised when a requested resource is not found."""
    
    def __init__(self, resource_type: str, resource_id: str, extra: dict = None):
        message = f"{resource_type} with ID {resource_id} not found"
        extra = extra or {}
        extra.update({
            "resource_type": resource_type,
            "resource_id": resource_id
        })
        super().__init__(message, "warning", extra)


class DatabaseError(LoggedException):
    """Exception raised for database-related errors."""
    
    def __init__(self, message: str = "Database operation failed", extra: dict = None):
        super().__init__(message, "error", extra)


class ExternalServiceError(LoggedException):
    """Exception raised for errors from external services."""
    
    def __init__(self, service_name: str, message: str = "External service error", extra: dict = None):
        extra = extra or {}
        extra["service_name"] = service_name
        super().__init__(f"{service_name}: {message}", "error", extra)


class RateLimitExceededError(LoggedException):
    """Exception raised when a rate limit is exceeded."""
    
    def __init__(self, limit_type: str, message: str = "Rate limit exceeded", extra: dict = None):
        extra = extra or {}
        extra["limit_type"] = limit_type
        super().__init__(message, "warning", extra)


# Utility function to convert custom exceptions to FastAPI HTTP exceptions
def http_exception_handler(request, exc):
    """
    Convert custom exceptions to FastAPI HTTP exceptions.
    
    This function can be registered as an exception handler with FastAPI.
    
    Example:
        ```python
        from fastapi import FastAPI
        from app.utils.exceptions import AuthenticationError, http_exception_handler
        
        app = FastAPI()
        app.add_exception_handler(AuthenticationError, http_exception_handler)
        ```
    """
    status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
    
    if isinstance(exc, AuthenticationError):
        status_code = status.HTTP_401_UNAUTHORIZED
    elif isinstance(exc, AuthorizationError):
        status_code = status.HTTP_403_FORBIDDEN
    elif isinstance(exc, ValidationError):
        status_code = status.HTTP_400_BAD_REQUEST
    elif isinstance(exc, ResourceNotFoundError):
        status_code = status.HTTP_404_NOT_FOUND
    elif isinstance(exc, RateLimitExceededError):
        status_code = status.HTTP_429_TOO_MANY_REQUESTS
    
    # Log the HTTP exception with request context
    request_id = getattr(request.state, "request_id", "unknown")
    logger.error(
        f"HTTP {status_code}: {exc.message}",
        extra={
            "request_id": request_id,
            "status_code": status_code,
            "exception_type": exc.__class__.__name__,
            **exc.extra
        }
    )
    
    return HTTPException(status_code=status_code, detail=exc.message) 