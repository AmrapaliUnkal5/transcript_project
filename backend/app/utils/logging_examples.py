"""
Examples of how to use the logging system.

This module provides examples of how to use the logging system in different
parts of the application.
"""
from .logger import get_module_logger, RequestContextLogger

# Get a basic logger for this module
logger = get_module_logger(__name__)

def basic_logging_example():
    """Example of basic logging usage"""
    logger.debug("This is a debug message")
    logger.info("This is an info message")
    logger.warning("This is a warning message")
    logger.error("This is an error message")
    logger.critical("This is a critical message")
    
    # Logging exceptions
    try:
        1 / 0
    except Exception as e:
        logger.exception("An error occurred while dividing by zero")

def logging_with_context():
    """Example of logging with context"""
    # Add context to log messages
    user_logger = get_module_logger(__name__, {"user_id": "user123"})
    user_logger.info("User logged in")
    
    # For more complex contexts
    operation_logger = get_module_logger(__name__, {
        "operation_id": "op456",
        "correlation_id": "corr789",
        "environment": "production"
    })
    operation_logger.info("Operation started")

def request_logging_example():
    """Example of request-based logging"""
    # Create a request logger
    request_logger = RequestContextLogger(
        module_name=__name__,
        request_id="req123",
        user_id="user456"
    )
    
    request_logger.info("Processing request")
    request_logger.debug("Request details: ...")
    
    try:
        # Simulate an operation that might fail
        result = process_request()
        request_logger.info(f"Request processed successfully: {result}")
    except Exception as e:
        request_logger.exception(f"Failed to process request: {str(e)}")

def process_request():
    """Simulate processing a request"""
    return {"status": "success"}

def fastapi_route_example():
    """
    Example of how to use logging in a FastAPI route
    
    This is just an example and not meant to be executed directly.
    """
    # Example code for a FastAPI route
    """
    from fastapi import APIRouter, Depends, Request
    from app.utils.logger import get_module_logger
    
    router = APIRouter()
    logger = get_module_logger(__name__)
    
    @router.get("/users/{user_id}")
    async def get_user(request: Request, user_id: str):
        # The request_id was added by the LoggingMiddleware
        request_id = request.state.request_id
        
        # Log with context
        logger.info(
            f"Fetching user data for user_id: {user_id}",
            extra={"request_id": request_id, "user_id": user_id}
        )
        
        try:
            # Fetch user from database
            user = await fetch_user_from_db(user_id)
            
            logger.info(
                f"Successfully retrieved user data",
                extra={"request_id": request_id, "user_id": user_id}
            )
            
            return user
        except Exception as e:
            logger.exception(
                f"Error retrieving user: {str(e)}",
                extra={"request_id": request_id, "user_id": user_id}
            )
            raise
    """
    
    return None  # This is just a placeholder 