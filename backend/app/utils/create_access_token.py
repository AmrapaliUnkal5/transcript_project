from datetime import datetime, timedelta, timezone
from jose import jwt
from app.config import settings  
from fastapi import HTTPException
import logging
from app.utils.logger import get_module_logger

# Create a logger for this module
logger = get_module_logger(__name__)

def create_access_token(data: dict, expires_delta: timedelta = None):
    """
    Generate an access token with an expiration date.
    
    Args:
    - data: The data (usually the user information) to encode in the JWT token.
    - expires_delta: Time duration for the token's expiry.

    Returns:
    - Encoded JWT token string.
    """
    to_encode = data.copy()
    
    # Clean datetime objects to ensure JSON serialization compatibility
    for key, value in to_encode.items():
        if isinstance(value, datetime):
            to_encode[key] = value.isoformat()
    
    logger.debug("encode_data= %s", to_encode)
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})
    
    SECRET_KEY = settings.SECRET_KEY  # Use the key from config
    ALGORITHM = settings.ALGORITHM  # Use the algorithm from config
    encoded_jwt=jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str):
    """
    Decode a JWT access token.
    
    Args:
    - token: The JWT token to decode.

    Returns:
    - Decoded token payload (dict).
    """
    try:
        SECRET_KEY = settings.SECRET_KEY  # Ensure you have this in your config
        ALGORITHM = settings.ALGORITHM  # Ensure you have this in your config

        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

        # Check if token is expired
        exp_timestamp = payload.get("exp")
        logger.debug("exp_timestamp: %s", exp_timestamp)
        logger.debug("datetime.now(timezone.utc).timestamp(): %s", datetime.now(timezone.utc).timestamp())
        if datetime.now(timezone.utc).timestamp() > exp_timestamp:
            raise HTTPException(status_code=401, detail="Token has expired")

        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=400, detail="Invalid token")

