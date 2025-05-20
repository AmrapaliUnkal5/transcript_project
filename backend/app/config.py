from decouple import config
from pydantic_settings import BaseSettings
from typing import Optional

# Load environment variables from the .env file
GOOGLE_CLIENT_ID = config("GOOGLE_CLIENT_ID")
FACEBOOK_APP_ID = config("FACEBOOK_APP_ID")
FACEBOOK_APP_SECRET = config("FACEBOOK_APP_SECRET")
REDIRECT_URI = config("REDIRECT_URI")
SQLALCHEMY_DATABASE_URL = config("DATABASE_URL")
# SMTP configuration using decouple
SMTP_CONFIG = {
    "server": config("SMTP_SERVER"),
    "port": config("SMTP_PORT", default=587, cast=int),  # Default to 587 if not provided
    "username": config("SMTP_USERNAME"),
    "password": config("SMTP_PASSWORD"),
    "tls": config("SMTP_TLS", default="True", cast=bool),  # Convert string to bool
    "from_email": config("SMTP_FROM_EMAIL"),
    "demo_email": config("DEMO_EMAIL")
}

# Optional API keys - properly handled if not set
HUGGINGFACE_API_KEY = config("HUGGINGFACE_API_KEY", default=None)
OPENAI_API_KEY = config("OPENAI_API_KEY", default=None)

class Settings(BaseSettings):
    SECRET_KEY: str = "d75e89c82a0c7d588441cca9849935dd7c43c831a0191ffd821ba2abd307f4f3"
    ALGORITHM: str = "HS256"
    SQLALCHEMY_DATABASE_URL: str = config("DATABASE_URL")
    FORGOT_PASSWORD_TOKEN_EXPIRY_MINUTES: int = 15
    REGISTER_TOKEN_EXPIRE_HOURS: int = 24
    BASE_URL: str = config("BASE_URL")
    SERVER_URL: str = config("SERVER_URL")  # Add the SERVER_URL here
    HUGGINGFACE_API_KEY: Optional[str] = HUGGINGFACE_API_KEY  # Use Optional to handle None values
    OPENAI_API_KEY: Optional[str] = OPENAI_API_KEY  # Add OpenAI API key
    WIDGET_API_URL:str =config("WIDGET_API_URL")
settings = Settings()