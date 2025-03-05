# app/schemas.py
from pydantic import BaseModel,EmailStr
from typing import List, Dict, Optional
from datetime import datetime

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
    user_id:int
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

# #Model for Bot
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
    status: Optional[str]=None

class BotCreate(BotBase):
    pass  

class BotUpdate(BotBase):
     user_id: Optional[int] = None


class BotCreation(BaseModel):
    bot_name: str
    status: str
    is_active: bool

class BotRename(BaseModel):
     bot_name: Optional[str] = None

class BotResponse(BotBase):
    bot_id: int

    class Config:
        from_attributes = True  

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

#model for Files
class FileBase(BaseModel):
    bot_id: int
    file_name: str
    file_type: str
    file_path: str
    file_size: str
    upload_date: datetime
    unique_file_name: str

class FileCreate(FileBase):
    pass

class FileResponse(FileBase):
    file_id: int

    class Config:
        from_attributes = True  # This replaces 'orm_mode'