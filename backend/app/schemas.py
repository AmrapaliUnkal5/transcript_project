# app/schemas.py
from pydantic import BaseModel,EmailStr
from typing import List, Dict, Optional

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

#Model for Bot
class BotBase(BaseModel):
    user_id: Optional[int] = None
    bot_name: str
    bot_icon: Optional[str] = None
    font_style: Optional[str] = None
    font_size: Optional[int] = None
    position: Optional[str] = None
    max_words_per_message: Optional[int] = 200
    is_active: Optional[bool] = True
    bot_color: Optional[str] = None
    user_color: Optional[str] = None
    appearance: Optional[str] = None
    temperature: Optional[float] = None

class BotResponse(BotBase):
    bot_id: int

class Config:
        orm_mode = True

class BotCreate(BotBase):
    pass  

class BotUpdate(BotBase):
     user_id: Optional[int] = None

#added for Forgotpassword
class ForgotpasswordRequest(BaseModel):
    email: EmailStr

class PasswordResetRequest(BaseModel):
    
    token: str
    password: str

class UpdateAvatarRequest(BaseModel):
    user_id: int
    avatar_url: str

class CaptchaRequest(BaseModel):
    user_input: str
