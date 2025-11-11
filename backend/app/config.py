from decouple import config
from pydantic_settings import BaseSettings
from typing import Optional
import os

# Load environment variables from the .env file
GOOGLE_CLIENT_ID = config("GOOGLE_CLIENT_ID")
FACEBOOK_APP_ID = config("FACEBOOK_APP_ID")
FACEBOOK_APP_SECRET = config("FACEBOOK_APP_SECRET")
REDIRECT_URI = config("REDIRECT_URI")
SQLALCHEMY_DATABASE_URL = config("DATABASE_URL")

# Folder path configurations with environment variable support
UPLOAD_BOT_DIR = config("UPLOAD_BOT_DIR", default="uploads_bot")
UPLOAD_DIR = config("UPLOAD_DIR", default="uploads")
CHROMA_DIR = config("CHROMADB_STORE_DIR", default="chromadb_store")
LOG_DIR = config("LOG_DIR", default="logs")

# Create directories if they don't exist (skip if S3 paths)
if not UPLOAD_BOT_DIR.startswith("s3://"):
    os.makedirs(UPLOAD_BOT_DIR, exist_ok=True)
if not UPLOAD_DIR.startswith("s3://"):
    os.makedirs(UPLOAD_DIR, exist_ok=True)
if not CHROMA_DIR.startswith("s3://"):
    os.makedirs(CHROMA_DIR, exist_ok=True)
if not LOG_DIR.startswith("s3://"):
    os.makedirs(LOG_DIR, exist_ok=True)

# SMTP configuration using decouple
SMTP_CONFIG = {
    "server": config("SMTP_SERVER"),
    "PROFILE": config("PROFILE",default="not_dev"),   
    "port": config("SMTP_PORT", default=587, cast=int),  # Default to 587 if not provided
    "username": config("SMTP_USERNAME"),
    "password": config("SMTP_PASSWORD"),
    "tls": config("SMTP_TLS", default="True", cast=bool),  # Convert string to bool
    "from_email": config("SMTP_FROM_EMAIL"),
    "demo_email": config("DEMO_EMAIL").split(",")

}

# Optional API keys - properly handled if not set
HUGGINGFACE_API_KEY = config("HUGGINGFACE_API_KEY", default=None)
OPENAI_API_KEY = config("OPENAI_API_KEY", default=None)
GEMINI_API_KEY = config("GEMINI_API_KEY", default=None)
DEEPSEEK_API_KEY= config("DEEPSEEK_API_KEY", default=None)
ANTHROPIC_API_KEY= config("ANTHROPIC_API_KEY", default=None)
GROQ_API_KEY = config("GROQ_API_KEY", default=None)
QDRANT_URL = config("QDRANT_URL", default="http://159.89.165.123:6333")
QDRANT_API_KEY = config("QDRANT_API_KEY", default=None)

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
    GEMINI_API_KEY: Optional[str] = GEMINI_API_KEY  # Add Gemini API key
    DEEPSEEK_API_KEY: Optional[str] =DEEPSEEK_API_KEY
    ANTHROPIC_API_KEY: Optional[str] =ANTHROPIC_API_KEY
    GROQ_API_KEY: Optional[str] = GROQ_API_KEY
    QDRANT_URL: str = QDRANT_URL
    QDRANT_API_KEY: Optional[str] = QDRANT_API_KEY
    WIDGET_API_URL:str =config("WIDGET_API_URL")
    # Add folder path settings
    UPLOAD_BOT_DIR: str = UPLOAD_BOT_DIR
    UPLOAD_DIR: str = UPLOAD_DIR
    CHROMA_DIR: str = CHROMA_DIR
    LOG_DIR: str = LOG_DIR

settings = Settings()