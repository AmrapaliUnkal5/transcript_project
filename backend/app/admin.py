from fastapi import Depends, Request, FastAPI
from sqladmin import Admin, ModelView
from sqladmin.authentication import AuthenticationBackend
from starlette.responses import RedirectResponse
from app.config import settings
from app.database import engine
from app.models import User, Bot, File, Interaction, Language, PerformanceLog, Rating, Subscription,UserAuthProvider,ChatMessage,DemoRequest# Using models
from sqlalchemy.orm import Session
import jwt
from .database import get_db
from fastapi.security import OAuth2PasswordBearer
from .crud import get_user_by_email
from passlib.context import CryptContext
from app.utils.verify_password import verify_password

# Admin Authentication Backend
class AdminAuth(AuthenticationBackend):
    async def login(self, request: Request) -> bool:
        form = await request.form()
        email = form.get("username")
        password = form.get("password")

        # Verify user credentials using the existing login logic
        db_user = get_user_by_email(request.state.db, email=email)
        if not db_user or not verify_password(password, db_user.password):
            return False

        # Check if user has admin role
        if db_user.role != "admin":
            return False

        request.session.update({"authenticated": True, "user_email": email})
        return True

    async def logout(self, request: Request) -> bool:
        request.session.clear()
        return True

    async def authenticate(self, request: Request) -> bool:
        return request.session.get("authenticated", False)

# Initialize Admin Panel
authentication_backend = AdminAuth(secret_key="SECRET_KEY")

# Model Views
class UserAdmin(ModelView, model=User):
    column_list = [
        User.user_id,
        User.email,
        User.name,
        User.role,
        User.avatar_url,
        User.is_verified,
        User.created_at
    ]
    column_searchable_list = [User.name, User.email,User.role]

class BotAdmin(ModelView, model=Bot):
    column_list = [
        Bot.bot_id,
        Bot.bot_name,
        Bot.user_id,
        Bot.is_active,
        Bot.created_at
    ]
    column_searchable_list = [Bot.bot_id]

class FileAdmin(ModelView, model=File):
    column_list = [
        File.file_id,
        File.file_name,
        File.file_type,
        File.bot_id,
        File.upload_date
    ]
    column_searchable_list = [File.file_name, File.file_type]
    column_filters = [File.bot_id]

class LanguageAdmin(ModelView, model=Language):
    column_list = [
        Language.language_id,
        Language.language_code,
        Language.language_name
    ]
    
    column_searchable_list = [Language.language_code, Language.language_name]
    column_filters = ["language_code", "language_name"]
   
class PerformanceLogAdmin(ModelView, model=PerformanceLog):
    column_list = [
        PerformanceLog.log_id,
        PerformanceLog.bot_id,
        PerformanceLog.user_id,
        PerformanceLog.interaction_count,
        PerformanceLog.last_interaction,
        PerformanceLog.created_at,
        PerformanceLog.updated_at,
    ]
    column_searchable_list = [PerformanceLog.bot_id, PerformanceLog.user_id]
    column_filters = ["bot_id", "user_id", "created_at"]

class RatingAdmin(ModelView, model=Rating):
    column_list = [
        Rating.rating_id,
        Rating.interaction_id,
        Rating.user_id,
        Rating.rating,
        Rating.feedback,
        Rating.created_at,
    ]
    column_searchable_list = [Rating.rating, Rating.feedback]
    column_filters = ["interaction_id", "user_id", "rating"]

class SubscriptionAdmin(ModelView, model=Subscription):
    column_list = [
        Subscription.subscription_id,
        Subscription.user_id,
        Subscription.bot_id,
        Subscription.amount,
        Subscription.currency,
        Subscription.payment_date,
        Subscription.expiry_date,
        Subscription.status,
    ]
    column_searchable_list = [Subscription.currency, Subscription.status]
    column_filters = ["user_id", "bot_id", "status"]

class UserAuthProviderAdmin(ModelView, model=UserAuthProvider):
    column_list = [
        UserAuthProvider.auth_id,
        UserAuthProvider.user_id,
        UserAuthProvider.provider_name,
        UserAuthProvider.provider_user_id,
        UserAuthProvider.access_token,
        UserAuthProvider.refresh_token,
        UserAuthProvider.token_expiry,
        UserAuthProvider.created_at,
    ]
    column_searchable_list = [UserAuthProvider.provider_name, UserAuthProvider.provider_user_id]
    column_filters = ["provider_name", "created_at"]

class InteractionAdmin(ModelView, model=Interaction):
    column_list = [
        Interaction.interaction_id,
        Interaction.bot_id,
        Interaction.user_id,
        Interaction.start_time,
        Interaction.archived
        ]
    column_searchable_list = [Interaction.bot_id]
    column_filters = ["timestamp"]

class ChatMessageAdmin(ModelView, model=ChatMessage):
    column_list = [
        ChatMessage.message_id,
        ChatMessage.interaction_id,
        ChatMessage.sender,
        ChatMessage.message_text,
        ChatMessage.timestamp
    ]
    column_searchable_list = [ChatMessage.interaction_id]
    column_filters = ["user_id", "bot_id", "timestamp"]

class DemoRequestAdmin(ModelView, model=DemoRequest):
    column_list = [
        DemoRequest.id,
        DemoRequest.name,
        DemoRequest.email,
        DemoRequest.country,
        DemoRequest.phone,
        DemoRequest.created_at,

    ]
    column_searchable_list = ["id"]
    column_filters = ["id"]


def init(app: FastAPI):
    admin = Admin(app=app, engine=engine, authentication_backend=authentication_backend)
    app.mount("/admin", admin)
    admin.add_view(UserAdmin)
    admin.add_view(BotAdmin)
    admin.add_view(FileAdmin)
    # admin.add_view(InteractionAdmin)
    admin.add_view(LanguageAdmin)
    admin.add_view(PerformanceLogAdmin)
    admin.add_view(RatingAdmin) 
    admin.add_view(SubscriptionAdmin)
    admin.add_view(UserAuthProviderAdmin)
    admin.add_view(InteractionAdmin)
    admin.add_view(ChatMessageAdmin)
    admin.add_view(DemoRequestAdmin)
