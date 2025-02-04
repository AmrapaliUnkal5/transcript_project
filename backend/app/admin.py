from fastapi import Depends, Request, FastAPI
from sqladmin import Admin, ModelView
from sqladmin.authentication import AuthenticationBackend
from starlette.responses import RedirectResponse
from app.config import settings
from app.database import engine
from app.models import User, Bot  # Using models
from sqlalchemy.orm import Session
import jwt
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

# Admin Model Views
class UserAdmin(ModelView, model=User):
    column_list = [User.user_id, User.name, User.email, User.created_at]
    column_searchable_list = [User.name, User.email]

class BotAdmin(ModelView, model=Bot):
    column_list = [Bot.bot_id, Bot.bot_name, Bot.created_at]
    column_searchable_list = [Bot.bot_name]

def init(app: FastAPI):
    admin = Admin(app=app, engine=engine, authentication_backend=authentication_backend)
    app.mount("/admin", admin)
    admin.add_view(UserAdmin)
    admin.add_view(BotAdmin)