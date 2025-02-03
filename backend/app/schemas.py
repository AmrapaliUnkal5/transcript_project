# app/schemas.py
from pydantic import BaseModel,EmailStr
from typing import Optional

#creating new users
class UserBase(BaseModel):
    
    email: EmailStr
    company_name: str
    role: Optional[str] = "client"

class UserCreate(UserBase):
    
    name: str
    password: Optional[str] = None
    token: Optional[str] = None  # Token is optional for non-social logins
    phone_no: Optional[str] = None

class UserOut(BaseModel):
    name: str
    email: str
    role: str
    company_name: Optional[str] = None

    class Config:
        from_attributes = True  # This replaces 'orm_mode'

class RegisterResponse(BaseModel):
    message: str
    user: UserOut  # Include the UserOut schema as a nested object

    class Config:
        from_attributes = True  # This replaces 'orm_mode' for working with SQLAlchemy models


# Model for login request
class LoginRequest(BaseModel):
    email: EmailStr
    password: str

#added for Forgotpassword
class ForgotpasswordRequest(BaseModel):
    email: EmailStr

class PasswordResetRequest(BaseModel):
    email: EmailStr
    password: str
