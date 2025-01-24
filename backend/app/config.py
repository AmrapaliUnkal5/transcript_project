from decouple import config

# Load environment variables from the .env file
GOOGLE_CLIENT_ID = config("GOOGLE_CLIENT_ID")
SQLALCHEMY_DATABASE_URL = config("DATABASE_URL")
