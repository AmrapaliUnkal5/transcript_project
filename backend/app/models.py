# app/models.py
from typing import Optional
from sqlalchemy import BigInteger, Column, Integer, String, Boolean, Text, TIMESTAMP,Float, func,ForeignKey,CheckConstraint,Numeric,DateTime, UniqueConstraint, Enum, DECIMAL
from app.database import Base
from pydantic import BaseModel
from datetime import datetime
import enum 
from sqlalchemy.orm import relationship

from app.schemas import ReactionEnum


#Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    user_id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=True)  # Name from frontend
    email = Column(String, unique=True, nullable=False)  # Email from frontend
    password = Column(String, nullable=True)  # Password from frontend (hashed for security)
    role = Column(String, default="client")  # Default role is 'client'
    is_verified = Column(Boolean, default=False)  # Default verification status
    avatar_url = Column(Text, nullable=True)  # Can be updated later
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp(), nullable=False)
    updated_at = Column(TIMESTAMP, server_default=func.current_timestamp(), onupdate=func.current_timestamp())
    phone_no = Column(String, nullable=True)  # Optional phone number
    company_name = Column(String, nullable=True)  # Optional company name
    total_words_used = Column(Integer, default=0)  
    communication_email = Column(String, nullable=True)  # New Field Optional
    
    # Add relationships for team membership
    owned_teams = relationship("TeamMember", foreign_keys="TeamMember.owner_id", back_populates="owner", cascade="all, delete-orphan")
    team_memberships = relationship("TeamMember", foreign_keys="TeamMember.member_id", back_populates="member", cascade="all, delete-orphan")

# Model for the token
class TokenPayload(BaseModel):
    credential: str

# Define permission levels for team members
class TeamMemberRole(enum.Enum):
    ADMIN = "admin"       # Can manage team members and all bots
    EDITOR = "editor"     # Can edit bot settings, training data, etc.
    VIEWER = "viewer"     # Can only view bots and analytics

# Team member model to track user relationships
class TeamMember(Base):
    __tablename__ = "teammembers"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    owner_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True)
    member_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(Enum(TeamMemberRole), nullable=False, default=TeamMemberRole.VIEWER)
    invitation_status = Column(String(20), nullable=False, default="pending")  # pending, accepted, declined
    invitation_token = Column(String(255), nullable=True)
    invitation_sent_at = Column(TIMESTAMP, server_default=func.current_timestamp(), nullable=False)
    updated_at = Column(TIMESTAMP, server_default=func.current_timestamp(), onupdate=func.current_timestamp())
    
    # Define relationships
    owner = relationship("User", foreign_keys=[owner_id], back_populates="owned_teams")
    member = relationship("User", foreign_keys=[member_id], back_populates="team_memberships")
    
    # Ensure unique owner-member combinations
    __table_args__ = (
        UniqueConstraint('owner_id', 'member_id', name='unique_team_member'),
    )

class Bot(Base):
    __tablename__ = "bots"

    bot_id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=True)
    bot_name = Column(String, nullable=False)
    bot_icon = Column(String, nullable=True)
    font_style = Column(String, nullable=True)
    font_size = Column(Integer, nullable=True)
    position = Column(String, nullable=True)
    max_words_per_message = Column(Integer, nullable=True, default=200)
    is_active = Column(Boolean, nullable=True, default=True)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp(), nullable=True)
    updated_at = Column(TIMESTAMP, server_default=func.current_timestamp(), onupdate=func.current_timestamp(), nullable=True)
    bot_color = Column(String, nullable=True)
    user_color = Column(String, nullable=True)
    appearance = Column(Text, nullable=True)  
    temperature = Column(Float, nullable=True)  
    status= Column(String, nullable=True)
    word_count = Column(Integer, default=0)
    external_knowledge = Column(Boolean, nullable=False, server_default='false')
    embedding_model_id = Column(Integer, ForeignKey("embedding_models.id"), nullable=True)
    llm_model_id = Column(Integer, ForeignKey("llm_models.id"), nullable=True)

    # Add relationships
    embedding_model = relationship("EmbeddingModel", back_populates="bots")
    llm_model = relationship("LLMModel", back_populates="bots")
    files = relationship("File", back_populates="bot", cascade="all, delete-orphan")

class File(Base):
    __tablename__ = "files"

    file_id = Column(Integer, primary_key=True, autoincrement=True)
    bot_id = Column(Integer, ForeignKey("bots.bot_id", onupdate="CASCADE", ondelete="CASCADE"), nullable=True)
    file_name = Column(String(255), nullable=False)
    file_type = Column(Text, nullable=True)
    file_path = Column(String(500), nullable=True)
    upload_date = Column(TIMESTAMP, server_default=func.current_timestamp(), nullable=True)
    file_size = Column(Text, nullable=True)
    unique_file_name = Column(Text, nullable=True)
    word_count = Column(Integer) 
    character_count = Column(Integer)
    embedding_model_id = Column(Integer, ForeignKey("embedding_models.id"), nullable=True)
    embedding_status = Column(String(50), default="pending", nullable=True)  # pending, completed, failed
    last_embedded = Column(TIMESTAMP, nullable=True)

    # Relationships
    bot = relationship("Bot", back_populates="files")
    embedding_model = relationship("EmbeddingModel", back_populates="files")

class Interaction(Base):
    __tablename__ = "interactions"

    interaction_id = Column(Integer, primary_key=True, autoincrement=True)
    bot_id = Column(Integer, ForeignKey("bots.bot_id"), nullable=False, index=True)  # ✅ Linked to bot
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False, index=True)  # ✅ Linked to user
    start_time = Column(TIMESTAMP, server_default=func.current_timestamp(), nullable=False, index=True)
    archived = Column(Boolean, default=False, index=True)  # ✅ For archival optimization
    end_time = Column(TIMESTAMP, nullable=True, index=True)  # ✅ New column to track session end time
    session_id = Column(String(50), nullable=True)  # ✅ Added session_id column

    # # Relationships
    # user = relationship("User", back_populates="interactions")
    # bot = relationship("Bot", back_populates="interactions")
    # messages = relationship("ChatMessage", back_populates="interaction", cascade="all, delete-orphan")

class ChatMessage(Base):
    __tablename__ = "chat_messages"

    message_id = Column(Integer, primary_key=True, autoincrement=True)
    interaction_id = Column(Integer, ForeignKey("interactions.interaction_id"), nullable=False, index=True)  # ✅ Linked to interaction
    sender = Column(String, nullable=False)  # "user" or "bot"
    message_text = Column(Text, nullable=False)
    timestamp = Column(TIMESTAMP, server_default=func.current_timestamp(), nullable=False, index=True)

    # Relationships
    # interaction = relationship("Interaction", back_populates="messages")


class Language(Base):
    __tablename__ = "languages"

    language_id = Column(
        Integer, 
        primary_key=True, 
        server_default="nextval('languages_language_id_seq'::regclass)"
    )
    language_code = Column(String(10), nullable=False)
    language_name = Column(String(50), nullable=False)

class PerformanceLog(Base):
    __tablename__ = "performance_logs"

    log_id = Column(
        Integer, 
        primary_key=True, 
        server_default="nextval('performance_logs_log_id_seq'::regclass)"
    )
    bot_id = Column(Integer, ForeignKey("bots.bot_id", ondelete="CASCADE"))
    user_id = Column(Integer, nullable=True)
    interaction_count = Column(Integer, default=0, nullable=True)
    last_interaction = Column(TIMESTAMP, nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp(), nullable=False)
    updated_at = Column(TIMESTAMP, server_default=func.current_timestamp(), onupdate=func.current_timestamp(), nullable=False)

class Rating(Base):
    __tablename__ = "ratings"

    rating_id = Column(Integer, primary_key=True, autoincrement=True)
    interaction_id = Column(Integer, ForeignKey("interactions.interaction_id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, nullable=True)
    rating = Column(Integer, nullable=False)
    feedback = Column(Text, nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp(), nullable=False)

    __table_args__ = (
        CheckConstraint("rating >= 1 AND rating <= 5", name="ratings_rating_check"),
    )

class Subscription(Base):
    __tablename__ = "subscriptions"

    subscription_id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=True)
    bot_id = Column(Integer, ForeignKey("bots.bot_id", ondelete="CASCADE"), nullable=False)
    amount = Column(Numeric(10, 2), nullable=True)
    currency = Column(String(10), nullable=False)
    payment_date = Column(TIMESTAMP, server_default=func.current_timestamp(), nullable=False)
    expiry_date = Column(TIMESTAMP, nullable=True)
    status = Column(String(20), nullable=False, default="active")

class UserAuthProvider(Base):
    __tablename__ = "user_auth_providers"

    auth_id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=True)
    provider_name = Column(String(50), nullable=False)
    provider_user_id = Column(String(255), nullable=False)
    access_token = Column(Text, nullable=True)
    refresh_token = Column(Text, nullable=True)
    token_expiry = Column(TIMESTAMP, nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp(), nullable=False)

class DemoRequest(Base):
    __tablename__ = "demo_request"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False)
    country = Column(String(255), nullable=False)
    company = Column(String(255), nullable=False)
    phone = Column(String(255), nullable=True)  # Optional field
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp(), nullable=False)

class YouTubeVideo(Base):
    __tablename__ = "youtube_videos"

    id = Column(Integer, primary_key=True, autoincrement=True)
    video_source = Column(String(50), nullable=False, server_default="YouTube")
    video_id = Column(String(255),  nullable=False)
    video_title = Column(String(500), nullable=True)
    video_url = Column(Text, nullable=False)
    channel_id = Column(String(255), nullable=True)
    channel_name = Column(String(500), nullable=True)
    duration = Column(Integer, nullable=True)
    upload_date = Column(DateTime, nullable=True)  # Ensure safe handling for missing values
    is_playlist = Column(Boolean, nullable=False, server_default="false")  # Ensures consistency
    playlist_id = Column(String(255), nullable=True)
    playlist_name = Column(String(500), nullable=True)
    view_count = Column(Integer, nullable=True)
    likes = Column(Integer, nullable=True)
    description = Column(Text, nullable=True)
    thumbnail_url = Column(Text, nullable=True)
    bot_id = Column(Integer, ForeignKey("bots.bot_id", ondelete="CASCADE"), nullable=False)
    # Uncomment if you have a `Bot` model and want bidirectional access
    # bot = relationship("Bot", back_populates="youtube_videos")
    transcript_count = Column(Integer, default=0)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    # New column to indicate soft deletion
    is_deleted = Column(Boolean, nullable=False, server_default="false")

# Define Enum for reactions
class ReactionType(enum.Enum):
    LIKE = "like"
    DISLIKE = "dislike"
    

class InteractionReaction(Base):
    __tablename__ = "interaction_reactions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    bot_id = Column(Integer, ForeignKey("bots.bot_id", ondelete="CASCADE"), nullable=False, index=True)
    interaction_id = Column(Integer, ForeignKey("interactions.interaction_id", ondelete="CASCADE"), nullable=False, index=True)
    session_id = Column(String, nullable=True, index=True)
    reaction = Column(Enum(ReactionEnum, name="reaction_type", create_type=False), nullable=False)
    reaction_time = Column(TIMESTAMP, nullable=False, server_default=func.current_timestamp())
    message_id = Column(Integer, ForeignKey("chat_messages.message_id", ondelete="CASCADE"), nullable=True,  #  Consider changing to False once all reactions are guaranteed to have a message
                        index=True
)

    __table_args__ = (UniqueConstraint("interaction_id", "session_id", name="unique_user_reaction"),)

    #interaction = relationship("Interaction", back_populates="reactions")

class ScrapedNode(Base):
    __tablename__ = "scraped_nodes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    url = Column(Text, nullable=False)
    bot_id = Column(Integer, nullable=False)  # Added bot_id
    created_at = Column(TIMESTAMP, server_default=func.now())
    title = Column(String, nullable=True)  # Ensure title is included
     # New column to indicate soft deletion
    is_deleted = Column(Boolean, nullable=False, server_default="false")
    website_id = Column(Integer, ForeignKey("websites.id", ondelete="CASCADE"), nullable=True)  # New column
    nodes_text_count = Column(Integer, nullable=True, server_default="0")

    #website = relationship("Website", back_populates="scraped_nodes")  #

class WebsiteDB(Base):
    __tablename__ = "websites"

    id = Column(Integer, primary_key=True, index=True)
    domain = Column(String(255), nullable=False)
    bot_id = Column(Integer, ForeignKey("bots.bot_id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    is_deleted = Column(Boolean, default=False)

class SubscriptionPlan(Base):
    __tablename__ = "subscription_plans"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(50), nullable=False)
    price = Column(Numeric(10, 2), nullable=True)  # NULL for custom pricing (Enterprise)
    word_count_limit = Column(Integer, nullable=True, default=0)
    storage_limit = Column(String(50), nullable=True, default="0 MB")  # Storage with MB/GB
    chatbot_limit = Column(Integer, nullable=True, default=1)
    website_crawl_limit = Column(String(50), nullable=True, default="1 website")
    youtube_grounding = Column(Boolean, nullable=True, default=False)
    message_limit = Column(Integer, nullable=True, default=100)
    multi_website_deployment = Column(Boolean, nullable=True, default=True)
    ui_customization = Column(String(50), nullable=True, default="Basic")
    analytics = Column(String(50), nullable=True, default="None")
    admin_user_limit = Column(String(50), nullable=True, default="1")
    support_level = Column(String(50), nullable=True, default="None")
    internal_team_bots = Column(Boolean, nullable=True, default=False)
    custom_ai_applications = Column(Boolean, nullable=True, default=False)
    custom_agents = Column(Boolean, nullable=True, default=False)
    process_automation = Column(Boolean, nullable=True, default=False)
    custom_integrations = Column(Boolean, nullable=True, default=False)
    
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    updated_at = Column(TIMESTAMP, server_default=func.current_timestamp(), onupdate=func.current_timestamp())

class Addon(Base):
    __tablename__ = "addons"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(50), nullable=False)
    price = Column(DECIMAL(10, 2), nullable=False)
    description = Column(Text, nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    updated_at = Column(TIMESTAMP, server_default=func.current_timestamp(), onupdate=func.current_timestamp())

class UserSubscription(Base):
    __tablename__ = "user_subscriptions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=False)  # Links to users table
    
    subscription_plan_id = Column(Integer, ForeignKey("subscription_plans.id", ondelete="CASCADE"), nullable=False)
    amount = Column(DECIMAL(10, 2), nullable=False)
    currency = Column(String(10), nullable=False, default="USD")
    payment_date = Column(TIMESTAMP, nullable=False)
    expiry_date = Column(TIMESTAMP, nullable=False)
    status = Column(String(50), nullable=False, default="active")  # active, expired, canceled
    auto_renew = Column(Boolean, default=True)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    updated_at = Column(TIMESTAMP, server_default=func.current_timestamp(), onupdate=func.current_timestamp())
    
class EmbeddingModel(Base):
    __tablename__ = "embedding_models"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), unique=True, nullable=False)  # e.g., "openai_ada"
    provider = Column(String(100))
    endpoint = Column(Text, nullable=True)
    dimension = Column(Integer, nullable=True)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)

    # Add relationships
    bots = relationship("Bot", back_populates="embedding_model")
    files = relationship("File", back_populates="embedding_model")
    
    def __str__(self):
        """Return a string representation of the model for display in UI"""
        return f"{self.name} ({self.provider})"

class LLMModel(Base):
    __tablename__ = "llm_models"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), unique=True, nullable=False)  # e.g., "gpt-4"
    provider = Column(String(100))
    endpoint = Column(Text, nullable=True)
    model_type = Column(String(100), nullable=True)  # chat/completion
    pricing_per_1k_tokens = Column(Numeric(10, 4), nullable=True)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)

    # Add relationship
    bots = relationship("Bot", back_populates="llm_model")
    
    def __str__(self):
        """Return a string representation of the model for display in UI"""
        return f"{self.name} ({self.provider})"
    
class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=False)
    bot_id = Column(Integer, nullable=True)
    event_type = Column(String(50), nullable=False)
    event_data = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(TIMESTAMP, server_default=func.now())



