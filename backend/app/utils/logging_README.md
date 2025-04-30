# Structured Logging System

This document explains how to use the structured logging system in this project.

## Overview

The logging system provides structured logging with the following features:

- Separate log files by level (debug, info, warning, error)
- Log rotation by size or time
- Structured JSON logging format
- Sensitive data redaction
- Context-aware logging
- Request tracking with unique request IDs

## Log Files

Logs are stored in the `logs/` directory at the project root:

- `debug.log` - Debug level and above (rotated daily)
- `info.log` - Info level and above (rotated by size)
- `warning.log` - Warning level and above (rotated daily)
- `error.log` - Error level and above (rotated by size)

## Using the Logger

### Basic Usage

```python
from app.utils.logger import get_module_logger

# Get a logger for your module
logger = get_module_logger(__name__)

# Log messages at different levels
logger.debug("Detailed debug information")
logger.info("General information")
logger.warning("Warning message")
logger.error("Error message")
logger.critical("Critical error message")

# Log exceptions
try:
    # Some operation that might fail
    result = 1 / 0
except Exception as e:
    logger.exception("An error occurred")  # Includes traceback
```

### Logging with Context

```python
from app.utils.logger import get_module_logger

# Log with additional context
logger = get_module_logger(__name__, {
    "user_id": "123",
    "operation": "user_login"
})

logger.info("User logged in")  # Will include user_id and operation in the log
```

### Request Context Logger

For tracking operations within a request:

```python
from app.utils.logger import RequestContextLogger

# Create a logger with request context
request_logger = RequestContextLogger(
    module_name=__name__,
    request_id="request-123",
    user_id="user-456"  # Optional
)

request_logger.info("Processing request")
```

### In FastAPI Route Handlers

The logging middleware automatically adds `request_id` to the request state:

```python
from fastapi import APIRouter, Request
from app.utils.logger import get_module_logger

router = APIRouter()
logger = get_module_logger(__name__)

@router.get("/resource/{resource_id}")
async def get_resource(request: Request, resource_id: str):
    # Get the request_id from request state
    request_id = request.state.request_id
    
    # Log with request context
    logger.info(
        f"Fetching resource: {resource_id}",
        extra={"request_id": request_id}
    )
    
    # Do something
    
    return {"id": resource_id}
```

## Sensitive Data Handling

The logging system automatically redacts sensitive data in log records. Keys that contain any of the following terms will be redacted:

- password
- token
- secret
- api_key
- authorization
- access_token
- refresh_token
- private_key
- jwt

Example:

```python
logger.info("User authenticated", extra={
    "user_id": "123",
    "access_token": "sensitive-data"  # Will be logged as "[REDACTED]"
})
```

## Log Configuration

The logging system is configured in `app/utils/logging_config.py`. If you need to modify the logging behavior:

- Change log levels
- Adjust rotation settings
- Modify log formats
- Add custom handlers

You can modify this file directly.

## Best Practices

1. **Use the appropriate log level**:
   - DEBUG: Detailed information, useful for debugging
   - INFO: General information about system operation
   - WARNING: Something unexpected happened, but the system can continue
   - ERROR: Something failed, but the application can still function
   - CRITICAL: A serious error that may prevent the program from continuing

2. **Include context**:
   - Always include relevant context in logs
   - For user actions, include user ID
   - For operations on resources, include resource IDs
   - For request handling, include the request ID

3. **Don't log sensitive data**:
   - Never log passwords, tokens, or other sensitive data
   - The system redacts known sensitive keys, but be careful with custom data

4. **Be concise but informative**:
   - Log messages should be brief but contain enough information to understand what happened
   - Include specific identifiers when logging actions on resources

5. **Use structured logging**:
   - Pass structured data using the `extra` parameter
   - This makes logs more searchable and analyzable 