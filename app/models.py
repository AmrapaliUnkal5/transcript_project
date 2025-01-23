# app/models.py
from sqlalchemy import Column, Integer, String, Boolean, Text, TIMESTAMP, func
from sqlalchemy.ext.declarative import declarative_base
from pydantic import BaseModel

Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    user_id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=True)  # Name from frontend
    email = Column(String, unique=True, nullable=False)  # Email from frontend
    password = Column(String, nullable=True)  # Password from frontend (hashed for security)
    role = Column(String, default="user")  # Default role is 'user'
    is_verified = Column(Boolean, default=False)  # Default verification status
    avatar_url = Column(Text, nullable=True)  # Can be updated later
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp(), nullable=False)
    updated_at = Column(TIMESTAMP, server_default=func.current_timestamp(), onupdate=func.current_timestamp())
    phone_no = Column(String, nullable=True)  # Optional phone number
    company_name = Column(String, nullable=True)  # Optional company name

# Model for the token
class TokenPayload(BaseModel):
    credential: str
