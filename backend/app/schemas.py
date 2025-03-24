# app/schemas.py
from pydantic import BaseModel,EmailStr
from typing import List, Dict, Optional
from datetime import datetime
from enum import Enum

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
    phone_no: Optional[str] = None  # Add this field
    communication_email: Optional[str] = None  # Add this field

    class Config:
        from_attributes = True  # This replaces 'orm_mode'

class UserUpdate(BaseModel):
     name: Optional[str] = None  # Editable Full Name
     phone_no: Optional[str] = None  # Editable Phone Number
     company_name: Optional[str] = None  # Editable Company Name
     communication_email: Optional[str] = None  # Editable Alternate Address

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

class ConversationTrendData(BaseModel):
    day: str
    conversations: int

class ConversationTrendResponse(BaseModel):
    bot_id: int
    data: List[ConversationTrendData]


class YouTubeRequest(BaseModel):
    url: str  # Can be a channel or playlist URL


class VideoProcessingRequest(BaseModel):
    bot_id: int
    video_urls: List[str]

class DemoRequest(BaseModel):
    name: str
    email: str
    country: str
    company: str
    phone: str = None  # Optional field

class BotUpdateStatus(BaseModel):
    
    status: str
    is_active: bool

# Define Enum for reactions
class ReactionEnum(str, Enum):
    like = "like"
    dislike = "dislike"
   

# Response model for API
class ReactionResponse(BaseModel):
    bot_id: int
    likes: int
    dislikes: int

class ScrapeRequest(BaseModel):
    bot_id: int
    selected_nodes: List[str]

class PageData(BaseModel):
    url: str
    title: str | None  # Allowing None if the title is missing