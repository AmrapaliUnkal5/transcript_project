from fastapi import Depends, Request, FastAPI
from sqladmin import Admin, ModelView
from sqladmin.authentication import AuthenticationBackend
from starlette.responses import RedirectResponse
from app.config import settings
from app.database import engine
from app.database import SessionLocal
from app.models import (
    User, UserAuthProvider, TeamMember, Notification, TranscriptRecord, Captcha
)
from sqlalchemy.orm import Session
import jwt
from .database import get_db
from fastapi.security import OAuth2PasswordBearer
from .crud import get_user_by_email
from passlib.context import CryptContext
from app.utils.verify_password import verify_password
# Reembedding utils removed - transcript project doesn't use re-embedding
import asyncio
from sqlalchemy.inspection import inspect
from wtforms.fields import DateTimeField
from sqlalchemy.sql.elements import ClauseElement
from datetime import datetime

# Custom DateTimeField that safely handles SQLAlchemy clause objects
class SafeDateTimeField(DateTimeField):
    def _value(self):
        if self.data is None:
            return ""
        elif isinstance(self.data, ClauseElement):
            # Return empty string when encountering SQLAlchemy clause
            return ""
        else:
            return super()._value()

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
        if db_user.role.lower() not in ("admin", "superadmin"):
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

# Base ModelView with customizations for all admin models
class BaseModelView(ModelView):
    form_overrides = {
        'created_at': SafeDateTimeField,
        'updated_at': SafeDateTimeField,
        'payment_date': SafeDateTimeField,
        'expiry_date': SafeDateTimeField,
        'purchase_date': SafeDateTimeField,
        'last_embedded': SafeDateTimeField,
        'invitation_sent_at': SafeDateTimeField,
        'reaction_time': SafeDateTimeField,
        'token_expiry': SafeDateTimeField,
        'last_updated': SafeDateTimeField,
        'start_time': SafeDateTimeField,
        'end_time': SafeDateTimeField,
        'timestamp': SafeDateTimeField,
        'upload_date': SafeDateTimeField
    }

# Model Views
class UserAdmin(BaseModelView, model=User):
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

# Chatbot-specific admin views removed - transcript project doesn't use bots, files, interactions, etc.

class UserAuthProviderAdmin(BaseModelView, model=UserAuthProvider):
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

# Chatbot-specific admin views removed - transcript project doesn't use bots, interactions, subscriptions, addons, etc.


class TeamMemberAdmin(BaseModelView, model=TeamMember):
    column_list = [
        TeamMember.id,
        TeamMember.owner_id,
        TeamMember.member_id,
        TeamMember.role,
        TeamMember.invitation_status,
        TeamMember.invitation_sent_at,
        TeamMember.updated_at
    ]
    column_searchable_list = [TeamMember.owner_id, TeamMember.member_id, TeamMember.invitation_status]
    column_filters = ["owner_id", "member_id", "role", "invitation_status"]
    
    # Add form columns to include all fields
    form_columns = [
        TeamMember.id,
        TeamMember.owner_id,
        TeamMember.member_id,
        TeamMember.role,
        TeamMember.invitation_status,
        TeamMember.invitation_token,
        TeamMember.invitation_sent_at,
        TeamMember.updated_at
    ]

# Chatbot-specific admin views removed - transcript project doesn't use interactions, scraped nodes, websites, YouTube videos, etc.

class NotificationAdmin(BaseModelView, model=Notification):
    column_list = [
        Notification.id,
        Notification.user_id,
        Notification.event_type,
        Notification.event_data,
        Notification.is_read,
        Notification.created_at
    ]
    column_searchable_list = [Notification.user_id, Notification.event_type]
    column_filters = ["user_id", "event_type", "is_read", "created_at"]
    
    # Add form columns to include all fields
    form_columns = [
        Notification.id,
        Notification.user_id,
        Notification.event_type,
        Notification.event_data,
        Notification.is_read,
        Notification.created_at
    ]

# Chatbot-specific admin views removed - transcript project doesn't use clusters, addons, word clouds, etc.

class TranscriptRecordAdmin(BaseModelView, model=TranscriptRecord):
    column_list = [
        TranscriptRecord.id,
        TranscriptRecord.user_id,
        TranscriptRecord.p_id,
        TranscriptRecord.medical_clinic,
        TranscriptRecord.age,
        TranscriptRecord.bed_no,
        TranscriptRecord.phone_no,
        TranscriptRecord.visit_date,
        TranscriptRecord.transcript_text,
        TranscriptRecord.summary_text,
        TranscriptRecord.created_at,
        TranscriptRecord.updated_at
    ]
    column_searchable_list = [TranscriptRecord.p_id, TranscriptRecord.medical_clinic]
    column_filters = ["user_id", "visit_date", "created_at"]

def init(app: FastAPI):
    admin = Admin(app=app, engine=engine, authentication_backend=authentication_backend)
    app.mount("/admin", admin)
    # Only transcript project admin views
    admin.add_view(UserAdmin)
    admin.add_view(UserAuthProviderAdmin)
    admin.add_view(TeamMemberAdmin)
    admin.add_view(NotificationAdmin)
    admin.add_view(TranscriptRecordAdmin) 