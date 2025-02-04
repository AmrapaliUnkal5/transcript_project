from decouple import config
from pydantic_settings import BaseSettings

# Load environment variables from the .env file
GOOGLE_CLIENT_ID = config("GOOGLE_CLIENT_ID")
SQLALCHEMY_DATABASE_URL = config("DATABASE_URL")
# SMTP configuration using decouple
SMTP_CONFIG = {
    "server": config("SMTP_SERVER"),
    "port": config("SMTP_PORT", default=587, cast=int),  # Default to 587 if not provided
    "username": config("SMTP_USERNAME"),
    "password": config("SMTP_PASSWORD"),
    "tls": config("SMTP_TLS", default="True", cast=bool),  # Convert string to bool
    "from_email": config("SMTP_FROM_EMAIL")
}

class Settings(BaseSettings):
    SECRET_KEY: str = "d75e89c82a0c7d588441cca9849935dd7c43c831a0191ffd821ba2abd307f4f3"
    ALGORITHM: str = "HS256"
    SQLALCHEMY_DATABASE_URL: str = config("DATABASE_URL")
   
settings = Settings()