from decouple import config


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