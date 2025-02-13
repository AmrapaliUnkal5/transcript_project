from datetime import datetime, timedelta
from jose import jwt
from app.config import settings  

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
    print("encode_date=",to_encode)
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})
    
    SECRET_KEY = settings.SECRET_KEY  # Use the key from config
    ALGORITHM = settings.ALGORITHM  # Use the algorithm from config
    encoded_jwt=jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


