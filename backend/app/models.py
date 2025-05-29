# app/models.py
from typing import Optional
from sqlalchemy import JSON, BigInteger, Column, Integer, String, Boolean, Text, TIMESTAMP,Float, func,ForeignKey,CheckConstraint,Numeric,DateTime, UniqueConstraint, Enum, DECIMAL,LargeBinary
from app.database import Base
from pydantic import BaseModel
from datetime import datetime
import enum 
from sqlalchemy.orm import relationship
import numpy as np
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
    total_message_count = Column(Integer, default=0) 
    communication_email = Column(String, nullable=True)  # New Field Optional
    total_file_size=Column(BigInteger, default=0)
    
    # Add relationships for team membership
    owned_teams = relationship("TeamMember", foreign_keys="TeamMember.owner_id", back_populates="owner", cascade="all, delete-orphan")
    team_memberships = relationship("TeamMember", foreign_keys="TeamMember.member_id", back_populates="member", cascade="all, delete-orphan")

    def __str__(self):
        return f"{self.name} ({self.email})" if self.name else self.email

# Model for the token
class TokenPayload(BaseModel):
    credential: str

# Define permission levels for team members
class TeamMemberRole(enum.Enum):
    admin = "admin"    # Lowercase to match PostgreSQL exactly
    editor = "editor"
    viewer = "viewer"     # Can only view bots and analytics

# Team member model to track user relationships
class TeamMember(Base):
    __tablename__ = "teammembers"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    owner_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True)
    member_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(Enum(TeamMemberRole), nullable=False, default=TeamMemberRole.viewer)
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
    
    def __str__(self):
        return f"Team member {self.id}: {self.role.value} ({self.invitation_status})"

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
    message_count = Column(Integer, default=0)
    window_bg_color = Column(String, nullable=True, default="#F9FAFB")
    welcome_message = Column(Text, nullable=True, default="Hi there! How can I help you today?")
    input_bg_color = Column(String, nullable=True, default="#FFFFFF")
    file_size = Column(BigInteger, default=0)
    # New customization fields
    header_bg_color = Column(String, nullable=True, default="#3B82F6")
    header_text_color = Column(String, nullable=True, default="#FFFFFF")
    chat_text_color = Column(String, nullable=True, default="#1F2937")
    user_text_color = Column(String, nullable=True, default="#121111")
    button_color = Column(String, nullable=True, default="#3B82F6")
    button_text_color = Column(String, nullable=True, default="#FFFFFF")
    timestamp_color = Column(String, nullable=True, default="#9CA3AF")
    border_radius = Column(String, nullable=True, default="12px")
    border_color = Column(String, nullable=True, default="#E5E7EB")
    chat_font_family = Column(String, nullable=True, default="Inter")
    selected_domain = Column(String, nullable=True)

    # Add relationships
    embedding_model = relationship("EmbeddingModel", back_populates="bots")
    llm_model = relationship("LLMModel", back_populates="bots")
    files = relationship("File", back_populates="bot", cascade="all, delete-orphan")
    
    def __str__(self):
        status_indicator = " (active)" if self.is_active else " (inactive)"
        return f"{self.bot_name}{status_indicator}"

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
    original_file_size = Column(String(50), nullable=True)  # Human-readable size
    original_file_size_bytes = Column(BigInteger, nullable=True)  # Size in bytes

    # Relationships
    bot = relationship("Bot", back_populates="files")
    embedding_model = relationship("EmbeddingModel", back_populates="files")
    
    def __str__(self):
        return f"{self.file_name} ({self.file_type})"

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
    
    def __str__(self):
        archive_status = " (archived)" if self.archived else ""
        return f"Interaction {self.interaction_id}: Bot {self.bot_id}, User {self.user_id}{archive_status}"

class ChatMessage(Base):
    __tablename__ = "chat_messages"

    message_id = Column(Integer, primary_key=True, autoincrement=True)
    interaction_id = Column(Integer, ForeignKey("interactions.interaction_id"), nullable=False, index=True)  # ✅ Linked to interaction
    sender = Column(String, nullable=False)  # "user" or "bot"
    message_text = Column(Text, nullable=False)
    timestamp = Column(TIMESTAMP, server_default=func.current_timestamp(), nullable=False, index=True)
    cluster_id = Column(String, nullable=True)

    # Relationships
    # interaction = relationship("Interaction", back_populates="messages")
    
    def __str__(self):
        # Truncate message text if it's too long
        preview = self.message_text[:30] + "..." if len(self.message_text) > 30 else self.message_text
        return f"{self.sender}: {preview}"

class Language(Base):
    __tablename__ = "languages"

    language_id = Column(
        Integer, 
        primary_key=True, 
        server_default="nextval('languages_language_id_seq'::regclass)"
    )
    language_code = Column(String(10), nullable=False)
    language_name = Column(String(50), nullable=False)
    
    def __str__(self):
        return f"{self.language_name} ({self.language_code})"

# class PerformanceLog(Base):
#     __tablename__ = "performance_logs"

#     log_id = Column(
#         Integer, 
#         primary_key=True, 
#         server_default="nextval('performance_logs_log_id_seq'::regclass)"
#     )
#     bot_id = Column(Integer, ForeignKey("bots.bot_id", ondelete="CASCADE"))
#     user_id = Column(Integer, nullable=True)
#     interaction_count = Column(Integer, default=0, nullable=True)
#     last_interaction = Column(TIMESTAMP, nullable=True)
#     created_at = Column(TIMESTAMP, server_default=func.current_timestamp(), nullable=False)
#     updated_at = Column(TIMESTAMP, server_default=func.current_timestamp(), onupdate=func.current_timestamp(), nullable=False)

# class Rating(Base):
#     __tablename__ = "ratings"

#     rating_id = Column(Integer, primary_key=True, autoincrement=True)
#     interaction_id = Column(Integer, ForeignKey("interactions.interaction_id", ondelete="CASCADE"), nullable=False)
#     user_id = Column(Integer, nullable=True)
#     rating = Column(Integer, nullable=False)
#     feedback = Column(Text, nullable=True)
#     created_at = Column(TIMESTAMP, server_default=func.current_timestamp(), nullable=False)

#     __table_args__ = (
#         CheckConstraint("rating >= 1 AND rating <= 5", name="ratings_rating_check"),
#     )

# class Subscription(Base):
#     __tablename__ = "subscriptions"

#     subscription_id = Column(Integer, primary_key=True, autoincrement=True)
#     user_id = Column(Integer, nullable=True)
#     bot_id = Column(Integer, ForeignKey("bots.bot_id", ondelete="CASCADE"), nullable=False)
#     amount = Column(Numeric(10, 2), nullable=True)
#     currency = Column(String(10), nullable=False)
#     payment_date = Column(TIMESTAMP, server_default=func.current_timestamp(), nullable=False)
#     expiry_date = Column(TIMESTAMP, nullable=True)
#     status = Column(String(20), nullable=False, default="active")

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
    
    def __str__(self):
        return f"{self.provider_name} auth for user {self.user_id}"

class DemoRequest(Base):
    __tablename__ = "demo_request"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False)
    country = Column(String(255), nullable=False)
    company = Column(String(255), nullable=False)
    phone = Column(String(255), nullable=True)  # Optional field
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp(), nullable=False)
    
    def __str__(self):
        return f"Demo request from {self.name} ({self.email})"

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
    # Add embedding status tracking fields
    embedding_status = Column(String(50), default="pending", nullable=True)  # pending, completed, failed
    last_embedded = Column(TIMESTAMP, nullable=True)
    transcript = Column(Text, nullable=True)
    
    def __str__(self):
        deleted_status = " (deleted)" if self.is_deleted else ""
        return f"{self.video_title}{deleted_status}"

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

    #__table_args__ = (UniqueConstraint("interaction_id", "session_id", name="unique_user_reaction"),)

    #interaction = relationship("Interaction", back_populates="reactions")
    
    def __str__(self):
        return f"{self.reaction.value} reaction for message {self.message_id}"

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
    # Add embedding status tracking fields
    embedding_status = Column(String(50), default="pending", nullable=True)  # pending, completed, failed
    last_embedded = Column(TIMESTAMP, nullable=True)
    nodes_text = Column(Text, nullable=True)  # Store the scraped text content

    #website = relationship("Website", back_populates="scraped_nodes")  #
    
    def __str__(self):
        title_str = f": {self.title}" if self.title else ""
        deleted_status = " (deleted)" if self.is_deleted else ""
        return f"Node {self.id}{title_str}{deleted_status}"

class WebsiteDB(Base):
    __tablename__ = "websites"

    id = Column(Integer, primary_key=True, index=True)
    domain = Column(String(255), nullable=False)
    bot_id = Column(Integer, ForeignKey("bots.bot_id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    is_deleted = Column(Boolean, default=False)
    
    def __str__(self):
        deleted_status = " (deleted)" if self.is_deleted else ""
        return f"{self.domain}{deleted_status}"

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
    default_embedding_model_id = Column(Integer, ForeignKey("embedding_models.id"), nullable=True)
    default_llm_model_id = Column(Integer, ForeignKey("llm_models.id"), nullable=True)
    zoho_plan_id = Column(String(100), nullable=True)
    zoho_plan_code = Column(String(100), nullable=True)
    billing_period = Column(String(20), nullable=True, default="monthly")  # monthly, yearly, etc.
    zoho_product_id = Column(String, nullable=True)
    per_file_size_limit = Column(Integer, nullable=True, default=0)

    
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    updated_at = Column(TIMESTAMP, server_default=func.current_timestamp(), onupdate=func.current_timestamp())
    
    # Relationships
    default_embedding_model = relationship("EmbeddingModel", foreign_keys=[default_embedding_model_id], backref="subscription_plans_embedding")
    default_llm_model = relationship("LLMModel", foreign_keys=[default_llm_model_id], backref="subscription_plans_llm")

    def __str__(self):
        return self.name

class Addon(Base):
    __tablename__ = "addons"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(50), nullable=False)
    price = Column(DECIMAL(10, 2), nullable=False)
    description = Column(Text, nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    updated_at = Column(TIMESTAMP, server_default=func.current_timestamp(), onupdate=func.current_timestamp())
    zoho_addon_id = Column(String(100), nullable=True)
    zoho_addon_code = Column(String(100), nullable=True)
    addon_type = Column(String(50), nullable=True)
    zoho_product_id = Column(String, nullable=True)
    is_recurring = Column(Boolean, default=False)
    additional_message_limit = Column(Integer, default=0, nullable=False)  # For "Additional Messages" addon
    additional_word_limit = Column(Integer, default=0)  # For "Additional Word Capacity" addon
    additional_admin_users = Column(Integer, default=0)  # For additional admin users
    
    # Add proper type hints for relationships
    user_addons = relationship("UserAddon", back_populates="addon")
    
    def __str__(self):
        return f"{self.name} (${self.price})"

class UserSubscription(Base):
    __tablename__ = "user_subscriptions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=False)  # Links to users table
    
    subscription_plan_id = Column(Integer, ForeignKey("subscription_plans.id", ondelete="CASCADE"), nullable=False)
    amount = Column(DECIMAL(10, 2), nullable=False)
    currency = Column(String(10), nullable=False, default="USD")
    payment_date = Column(TIMESTAMP, nullable=False)
    expiry_date = Column(TIMESTAMP, nullable=False)
    status = Column(String(50), nullable=False, default="active")  # active, expired, canceled, failed
    auto_renew = Column(Boolean, default=True)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    updated_at = Column(TIMESTAMP, server_default=func.current_timestamp(), onupdate=func.current_timestamp())
    zoho_subscription_id = Column(String(100), nullable=True)
    zoho_customer_id = Column(String(100), nullable=True)
    zoho_invoice_id = Column(String(100), nullable=True)
    cancellation_reason = Column(Text, nullable=True)
    payment_method = Column(String(50), nullable=True)
    notes = Column(Text, nullable=True)  # For storing payment failure reasons and other subscription notes

    # Add relationship to UserAddon
    user_addons = relationship("UserAddon", back_populates="subscription", cascade="all, delete-orphan")
    
    # Add relationship to SubscriptionPlan
    subscription_plan = relationship("SubscriptionPlan")
    
    def __str__(self):
        return f"User {self.user_id} subscription ({self.status})"

    
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
    max_input_tokens = Column(Integer, nullable=True, default=4096)  # Max context window tokens 
    max_output_tokens = Column(Integer, nullable=True, default=1024)  # Max response tokens

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
    
    def __str__(self):
        read_status = " (read)" if self.is_read else " (unread)"
        return f"{self.event_type} notification for user {self.user_id}{read_status}"

class Cluster(Base):
    __tablename__ = "clusters"
    cluster_id = Column(Integer, primary_key=True, index=True)
    bot_id = Column(Integer, index=True)
    cluster_number = Column(Integer)  # e.g., 0,1,2...
    centroid = Column(JSON, nullable=False)
    count = Column(Integer, default=1)

    questions = relationship("ClusteredQuestion", back_populates="cluster")

    __table_args__ = (UniqueConstraint('bot_id', 'cluster_number', name='unique_bot_cluster'),)
    
    def __str__(self):
        return f"Cluster {self.cluster_number} for bot {self.bot_id} ({self.count} items)"

class ClusteredQuestion(Base):
    __tablename__ = "clustered_questions"
    id = Column(Integer, primary_key=True)
    cluster_id = Column(Integer, ForeignKey("clusters.cluster_id"))
    question_text = Column(String)
    embedding = Column(JSON)

    cluster = relationship("Cluster", back_populates="questions")
    
    def __str__(self):
        # Truncate question text if it's too long
        preview = self.question_text[:30] + "..." if len(self.question_text) > 30 else self.question_text
        return f"Question: {preview}"

class UserAddon(Base):
    __tablename__ = "user_addons"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    addon_id = Column(Integer, ForeignKey("addons.id", ondelete="CASCADE"), nullable=False)
    subscription_id = Column(Integer, ForeignKey("user_subscriptions.id", ondelete="CASCADE"), nullable=False)
    purchase_date = Column(TIMESTAMP, default=func.current_timestamp(), nullable=False)
    expiry_date = Column(TIMESTAMP, nullable=True)
    is_active = Column(Boolean, default=True)
    auto_renew = Column(Boolean, default=False)
    status = Column(String(50), default="active", nullable=False)
    zoho_addon_instance_id = Column(String(100), nullable=True)
    created_at = Column(TIMESTAMP, default=func.current_timestamp())
    updated_at = Column(TIMESTAMP, default=func.current_timestamp(), onupdate=func.current_timestamp())
    remaining_count = Column(Integer, default=0)  # For tracking unused messages
    initial_count = Column(Integer)
    
    # Constraints
    __table_args__ = (
        UniqueConstraint('id', 'user_id', name='user_addons_user_id_idx'),
        UniqueConstraint('id', 'addon_id', name='user_addons_addon_id_idx'),
        UniqueConstraint('id', 'subscription_id', name='user_addons_subscription_id_idx'),
    )

    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    addon = relationship("Addon", foreign_keys=[addon_id])
    subscription = relationship("UserSubscription", back_populates="user_addons")
    
    def __str__(self):
        active_status = " (active)" if self.is_active else f" ({self.status})"
        return f"User {self.user_id} addon {self.addon_id}{active_status}"

# models.py
class WordCloudData(Base):
    __tablename__ = "word_cloud_data"
    
    bot_id = Column(Integer, ForeignKey("bots.bot_id"), primary_key=True)
    word_frequencies = Column(JSON, nullable=False, default={})  # {"word": count}
    last_updated = Column(TIMESTAMP, server_default=func.current_timestamp(), 
                         onupdate=func.current_timestamp())
                         
    def __str__(self):
        word_count = len(self.word_frequencies) if self.word_frequencies else 0
        return f"Word cloud for bot {self.bot_id} ({word_count} words)"