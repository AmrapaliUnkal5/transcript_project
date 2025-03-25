# app/models.py
from sqlalchemy import Column, Integer, String, Boolean, Text, TIMESTAMP,Float, func,ForeignKey,CheckConstraint,Numeric,DateTime, UniqueConstraint, Enum
from app.database import Base
from pydantic import BaseModel
from datetime import datetime
import enum 


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
    communication_email = Column(String, nullable=True)  # New Field Optional

# Model for the token
class TokenPayload(BaseModel):
    credential: str

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
    appearance = Column(Text, nullable=True)  # New column added
    temperature = Column(Float, nullable=True)  # New column added
    status= Column(String, nullable=True)

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
    session_id = Column(String, nullable=False, index=True)
    reaction = Column(Enum(ReactionType), nullable=False)
    reaction_time = Column(TIMESTAMP, nullable=False, server_default=func.current_timestamp())

    __table_args__ = (UniqueConstraint("interaction_id", "session_id", name="unique_user_reaction"),)

    #interaction = relationship("Interaction", back_populates="reactions")

class ScrapedNode(Base):
    __tablename__ = "scraped_nodes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    url = Column(Text, nullable=False, unique=True)
    bot_id = Column(Integer, nullable=False)  # Added bot_id
    created_at = Column(TIMESTAMP, server_default=func.now())
    title = Column(String, nullable=True)  # Ensure title is included
     # New column to indicate soft deletion
    is_deleted = Column(Boolean, nullable=False, server_default="false")

