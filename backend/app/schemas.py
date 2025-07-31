# app/schemas.py
from pydantic import BaseModel,EmailStr,Field
from typing import List, Dict, Optional, Union, Literal
from datetime import datetime
from enum import Enum
from fastapi import UploadFile

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
    total_words_used: Optional[int] = 0  
    subscription_plan_id: Optional[int] = None 

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

# Team member schemas
class TeamMemberRole(str, Enum):
    admin = "admin"
    editor = "editor"
    viewer = "viewer"

class TeamMemberInviteRequest(BaseModel):
    email: EmailStr
    role: TeamMemberRole

class TeamMemberBase(BaseModel):
    owner_id: int
    member_id: int
    role: TeamMemberRole
    invitation_status: str

class TeamMemberCreate(BaseModel):
    member_email: EmailStr
    role: TeamMemberRole

class TeamMemberUpdate(BaseModel):
    role: Optional[TeamMemberRole] = None
    invitation_status: Optional[str] = None

class TeamMemberResponse(TeamMemberBase):
    id: int
    invitation_sent_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class TeamMemberListItem(BaseModel):
    id: int
    member_id: int
    member_name: str
    member_email: str
    role: str
    invitation_status: str
    invitation_sent_at: datetime
    
    class Config:
        from_attributes = True

# Model for login request
class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class LeadFormField(BaseModel):
    field: Literal["name", "email", "phone", "address"]
    required: bool

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
    embedding_model_id: Optional[int] = None
    llm_model_id: Optional[int] = None
    message_count: Optional[int] = 0
    last_message_reset: Optional[datetime] = None
    file_size: Optional[int] = 0
    window_bg_color: Optional[str] = "#F9FAFB"
    welcome_message: Optional[str] = "Hello! How can I help you?"
    input_bg_color: Optional[str] = "#FFFFFF"
    # New customization fields
    header_bg_color: Optional[str] = "#3B82F6"
    header_text_color: Optional[str] = "#FFFFFF"
    chat_text_color: Optional[str] = "#1F2937"
    user_text_color: Optional[str] = "#121111"
    button_color: Optional[str] = "#3B82F6"
    button_text_color: Optional[str] = "#FFFFFF"
    timestamp_color: Optional[str] = "#9CA3AF"
    border_radius: Optional[str] = "12px"
    border_color: Optional[str] = "#E5E7EB"
    chat_font_family: Optional[str] = "Inter"
    lead_generation_enabled: Optional[bool] = False
    lead_form_config: Optional[List[LeadFormField]] = []
    show_sources: Optional[bool] = False
    unanswered_msg:Optional[str] = "I'm sorry, I don't have an answer for this question. This is outside my area of knowledge.Is there something else I can help with?"

class BotCreate(BotBase):
    pass  

class BotUpdate(BotBase):
     user_id: Optional[int] = None


class BotCreation(BaseModel):
    bot_name: str
    status: str
    is_active: bool
    external_knowledge: Optional[bool] = False

class BotRename(BaseModel):
     bot_name: Optional[str] = None

class BotResponse(BotBase):
    bot_id: int
    theme_id: Optional[str]
    show_sources: Optional[bool] 
    unanswered_msg: Optional[str]

    class Config:
        from_attributes = True  

class BotUpdateFields(BaseModel):
    status: Optional[str] = None
    is_active: Optional[bool] = None
    is_trained: Optional[bool] = None  
    is_retrained: Optional[bool] = None 

    class Config:
        extra = "forbid"

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

class FileBase(BaseModel):
    bot_id: int
    file_name: str
    file_type: str
    file_path: str
    file_size: str
    upload_date: datetime
    unique_file_name: str
    word_count: Optional[int] = None
    character_count: Optional[int] = None
    embedding_model_id: Optional[int] = None
    status: Optional[str] = "pending"
    last_embedded: Optional[datetime] = None
    original_file_size: str
    original_file_size_bytes: int 

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
    url: str

class VideoProcessingRequest(BaseModel):
    bot_id: int
    video_urls: List[str]

class YouTubeScrapingRequest(BaseModel):
    bot_id: int
    selected_videos: List[str]

class BotUpdateStatus(BaseModel):
    
    status: str
    is_active: bool

class IssueRequest(BaseModel):
    user_id: Optional[int]
    username: Optional[str]
    email: Optional[str]
    phone: Optional[str]
    bot_name: Optional[str]
    bot_id: Optional[int]
    description: Optional[str]
    file: Optional[UploadFile] 

class DemoRequest(BaseModel):
    name: str
    email: str
    country: str
    company: Optional[str] = None
    phone: Optional[str] = None
    description: Optional[str] = None
    requestType: str

class BotUpdateStatus(BaseModel):
    
    status: str
    is_active: bool

class BotThemeUpdate(BaseModel):
    theme_id:str

# Define Enum for reactions
class ReactionEnum(str, Enum):
    like = "like"
    dislike = "dislike"
   
# Response model for API
class ReactionResponse(BaseModel):
    bot_id: int
    likes: int
    dislikes: int
    company: Optional[str] = None
    phone: Optional[str] = None
    description: Optional[str] = None
    requestType: str 

class ScrapeRequest(BaseModel):
    bot_id: int
    selected_nodes: List[str]

class PageData(BaseModel):
    url: str
    title: str | None  # Allowing None if the title is missing
    Word_Counts: int
    upload_date:Optional[datetime] = None
    status:Optional[str] = None
    error_code:Optional[str] = None

class EmbeddingModelBase(BaseModel):
    name: str
    provider: Optional[str] = None
    endpoint: Optional[str] = None
    dimension: Optional[int] = None
    description: Optional[str] = None
    is_active: Optional[bool] = True

class EmbeddingModelCreate(EmbeddingModelBase):
    pass

class EmbeddingModelOut(EmbeddingModelBase):
    id: int
    class Config:
        from_attributes = True


# LLMModel Schemas
class LLMModelBase(BaseModel):
    name: str
    provider: Optional[str] = None
    endpoint: Optional[str] = None
    model_type: Optional[str] = None
    pricing_per_1k_tokens: Optional[float] = None
    description: Optional[str] = None
    is_active: Optional[bool] = True
    max_input_tokens: Optional[int] = 4096  # Max context window size
    max_output_tokens: Optional[int] = 1024  # Max tokens to generate

class LLMModelCreate(LLMModelBase):
    pass

class LLMModelOut(LLMModelBase):
    id: int
    class Config:
        from_attributes = True

class SubscriptionPlanSchema(BaseModel):
    id: int
    name: str
    price: Optional[float]  # Let FastAPI return it as float
    word_count_limit: Optional[int]
    storage_limit: Optional[str]
    chatbot_limit: Optional[int]
    website_crawl_limit: Optional[str]
    youtube_grounding: Optional[bool]
    message_limit: Optional[int]
    multi_website_deployment: Optional[bool]
    ui_customization: Optional[str]
    analytics: Optional[str]
    admin_user_limit: Optional[str]
    support_level: Optional[str]
    internal_team_bots: Optional[bool]
    custom_ai_applications: Optional[bool]
    custom_agents: Optional[bool]
    process_automation: Optional[bool]
    custom_integrations: Optional[bool]
    default_embedding_model_id: Optional[int] = None
    default_llm_model_id: Optional[int] = None
    per_file_size_limit: Optional[int]
    default_embedding_model: Optional[EmbeddingModelOut] = None
    default_llm_model: Optional[LLMModelOut] = None
    
    class Config:
        from_attributes = True
    per_file_size_limit: Optional[int]


    # class Config:
    #     orm_mode = True  # Enables auto-conversion from SQLAlchemy models

class ReactionCreate(BaseModel):
    interaction_id: int
    session_id: str
    bot_id: int
    reaction: ReactionEnum
    message_id:int

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

class NotificationOut(BaseModel):
    id: int
    user_id: Optional[int]
    bot_id: Optional[int]
    event_type: Optional[str]
    event_data: Optional[str]
    is_read: Optional[bool]
    created_at: Optional[datetime]

    # class Config:
    #     orm_mode = True  # You commented this out, but it's needed!

class FAQResponse(BaseModel):
    question: str
    similar_questions: List[str]
    count: int
    cluster_id: str

class ZohoCheckoutRequest(BaseModel):
    plan_id: int
    addon_ids: Optional[List[int]] = None

class ZohoCheckoutResponse(BaseModel):
    checkout_url: str

class WebScrapingRequest(BaseModel):
    bot_id: int
    selected_nodes: List[str]

class TeamMemberOut(BaseModel):
    id: int
    owner_id: int
    member_id: int
    role: TeamMemberRole
    invitation_status: str
    invitation_sent_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
class AddonSchema(BaseModel):
    id: int
    name: str
    price: float
    description: str
    addon_type: Optional[str] = None
    zoho_addon_id: Optional[str] = None
    zoho_addon_code: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    additional_word_limit: Optional[int] = 0
    additional_message_limit: Optional[int] = 0
    additional_admin_users: Optional[int] = 0
    
    class Config:
        from_attributes = True

class UserAddonBase(BaseModel):
    user_id: int
    addon_id: int
    subscription_id: int
    expiry_date: Optional[datetime] = None  # Changed to Optional
    is_active: bool = True
    auto_renew: bool = False
    status: str = "active"
    

class UserAddonCreate(UserAddonBase):
    pass

class UserAddonUpdate(BaseModel):
    is_active: Optional[bool] = None
    auto_renew: Optional[bool] = None
    status: Optional[str] = None
    expiry_date: Optional[datetime] = None

class UserAddonOut(BaseModel):
    id: int
    user_id: int
    addon_id: int
    subscription_id: int
    purchase_date: datetime
    expiry_date: Optional[datetime] = None
    is_active: bool
    auto_renew: bool
    status: str
    addon: AddonSchema
    
    class Config:
        from_attributes = True

class PurchaseAddonRequest(BaseModel):
    addon_id: int
    quantity: Optional[int] = 1

class CancelAddonRequest(BaseModel):
    user_addon_id: int

class AddonUsageItem(BaseModel):
    addon_id: int
    name: str
    limit: int
    remaining: int

class MessageUsageResponse(BaseModel):
    total_messages_used: int
    base_plan: dict
    addons: dict
    effective_remaining: int

class AddOnCheckoutResponse(BaseModel):
    checkout_url: str

class YouTubeVideoResponse(BaseModel):
    video_id: str
    video_title: str
    video_url: str
    transcript_count: Optional[int] = 0
    upload_date: Optional[datetime] = None
    status: Optional[str] = None
    error_code: Optional[str] = None

class WordCloudResponse(BaseModel):
    words: List[Dict[str, Union[str, int]]]

class UpdateBotDomainRequest(BaseModel):
    bot_id: int
    selected_domain: str = Field(..., min_length=3, max_length=255)

class BotWidgetResponse(BaseModel):
    
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
    status: Optional[str] = None
    embedding_model_id: Optional[int] = None
    llm_model_id: Optional[int] = None
    message_count: Optional[int] = 0
    last_message_reset: Optional[datetime] = None
    file_size: Optional[int] = 0
    window_bg_color: Optional[str] = "#F9FAFB"
    welcome_message: Optional[str] = "Hello! How can I help you?"
    input_bg_color: Optional[str] = "#FFFFFF"
    header_bg_color: Optional[str] = "#3B82F6"
    header_text_color: Optional[str] = "#FFFFFF"
    chat_text_color: Optional[str] = "#1F2937"
    user_text_color: Optional[str] = "#121111"
    button_color: Optional[str] = "#3B82F6"
    button_text_color: Optional[str] = "#FFFFFF"
    timestamp_color: Optional[str] = "#9CA3AF"
    border_radius: Optional[str] = "12px"
    border_color: Optional[str] = "#E5E7EB"
    chat_font_family: Optional[str] = "Inter"
    lead_generation_enabled: Optional[bool] = False
    lead_form_config: Optional[List[LeadFormField]] = []

    class Config:
        from_attributes = True

class ReactionCreateWidget(BaseModel):
    interaction_id: str
    session_id: str
    reaction: ReactionEnum
    message_id:str

from typing import Literal
class BotWidgetInitialResponse(BaseModel):
    avatarUrl: Optional[str]
    position: Literal["top-left", "top-right", "bottom-left", "bottom-right"]
    welcomeMessage: Optional[str]

class LeadCreate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None

class LeadOut(BaseModel):
    id: int
    name: Optional[str]
    email: Optional[str]
    phone: Optional[str]
    address: Optional[str]
    created_at: datetime

class MarkProcessedResponse(BaseModel):
    success: bool
    message: str
    scraped_nodes_updated: int
    youtube_videos_updated: int
    files_updated: int
class StartTrainingRequest(BaseModel):
    bot_id: int
