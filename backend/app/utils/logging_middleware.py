import time
import uuid
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
from .logger import get_module_logger
from typing import Dict, Any, Callable

logger = get_module_logger(__name__)

class LoggingMiddleware(BaseHTTPMiddleware):
    """
    Middleware that logs request and response information.
    Adds a unique request_id to each request, which can be used to
    correlate log entries related to the same request.
    """
    
    def __init__(self, app: ASGIApp):
        super().__init__(app)
    
    async def dispatch(self, request: Request, call_next: Callable):
        request_id = str(uuid.uuid4())
        # Add request_id to request state for use in route handlers
        request.state.request_id = request_id
        
        # Extract user ID from token if available - safer approach
        user_id = None
        # Instead of directly accessing request.user which requires AuthenticationMiddleware,
        # we'll get user info from dependencies later in the request lifecycle
        
        # Start timer
        start_time = time.time()
        
        # Prepare request info for logging
        request_info = self._get_request_info(request)
        
        # Log request
        logger.info(
            f"Request started: {request.method} {request.url.path}",
            extra={
                "request_id": request_id,
                "request": request_info,
            }
        )
        
        try:
            # Process the request
            response = await call_next(request)
            
            # Calculate processing time
            process_time = time.time() - start_time
            
            # Log response
            logger.info(
                f"Request completed: {request.method} {request.url.path}",
                extra={
                    "request_id": request_id,
                    "status_code": response.status_code,
                    "processing_time": f"{process_time:.4f}s",
                }
            )
            
            # Add response headers
            response.headers["X-Request-ID"] = request_id
            response.headers["X-Process-Time"] = f"{process_time:.4f}"
            
            return response
            
        except Exception as e:
            # Log exceptions
            process_time = time.time() - start_time
            logger.exception(
                f"Request failed: {request.method} {request.url.path}",
                extra={
                    "request_id": request_id,
                    "processing_time": f"{process_time:.4f}s",
                    "error": str(e),
                }
            )
            raise
    
    def _get_request_info(self, request: Request) -> Dict[str, Any]:
        """Extract and sanitize request information for logging"""
        client_host = request.client.host if request.client else "unknown"
        
        # Get headers but exclude sensitive information
        headers = dict(request.headers)
        sensitive_headers = ["authorization", "cookie", "x-api-key"]
        for header in sensitive_headers:
            if header in headers:
                headers[header] = "[REDACTED]"
        
        return {
            "method": request.method,
            "path": request.url.path,
            "query_params": str(request.query_params),
            "client_host": client_host,
            "headers": headers,
        } 