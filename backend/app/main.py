import threading
from fastapi import FastAPI, Depends, HTTPException, Response, Request,File, UploadFile, HTTPException, Query
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from .models import Base, Captcha, User, UserSubscription, Bot, TeamMember, UserAddon, UserAuthProvider
from .schemas import *
from .crud import create_user,get_user_by_email, update_user_password,update_avatar
from fastapi.security import OAuth2PasswordBearer
from passlib.context import CryptContext
from sqlalchemy.orm import Session
from app.social_login import router as social_login_router
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from app.config import SQLALCHEMY_DATABASE_URL,settings
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timedelta
from jose import JWTError, jwt
from app.utils.email_helper import send_email
from fastapi.responses import JSONResponse
import logging
from app.botsettings import router as botsettings_router
from app.admin import init
from app.utils.verify_password import verify_password
from app.utils.create_access_token import create_access_token
from app.database import get_db,engine,SessionLocal
from app.dependency import require_role,get_current_user
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from app.middleware import RoleBasedAccessMiddleware
from app.dashboard_consumables import router as bot_conversations_router
import os
import uuid
from fastapi.staticfiles import StaticFiles
from app.scraper import scrape_selected_nodes, get_website_nodes, get_scraped_urls_func
from app.file_size_validations import router as file_size_validations_router
from app.bot_creation import router as bot_creation
from typing import List
from captcha.image import ImageCaptcha
import random
import string
from app.chatbot import router as chatbot_router
from app.chat_interactions import router as chat_router
from app.email_verification import router as emailverification_router
from app.user_settings import router as usersettings_router
from app.demo_customer_support_request import router as demo_request_router
from app.analytics import router as analytics_router
from app.submit_issue_request import router as submit_issue_request
from app.word_count_validation import router as word_count_validation
from app.total_conversations_analytics import router as weekly_Conversation
from app.team_management import router as team_management_router
from app.fetchsubscripitonplans import router as fetchsubscriptionplans_router
from app.fetchsubscriptionaddons import router as fetchsubscriptionaddons_router
from app.notifications import router as notifications_router, add_notification
from app.message_count_validations import router as message_count_validations_router
from app.zoho_subscription_router import router as zoho_subscription_router
from app.zoho_sync_scheduler import initialize_scheduler
from app.admin_routes import router as admin_routes_router
from app.widget_botsettings import router as widget_botsettings_router
from app.current_billing_metrics import router as billing_metrics_router
from app.celery_app import celery_app
from app.celery_tasks import process_youtube_videos, process_file_upload, process_web_scraping
from app.captcha_cleanup_thread import captcha_cleaner
from app.utils.file_storage import save_file, get_file_url, FileStorageError


# Import our custom logging components
from app.utils.logging_config import setup_logging
from app.utils.logger import get_module_logger
from app.utils.logging_middleware import LoggingMiddleware

# Import custom exceptions and handlers
from app.utils.exceptions import (
    AuthenticationError, 
    AuthorizationError,
    ValidationError,
    ResourceNotFoundError,
    DatabaseError,
    ExternalServiceError,
    RateLimitExceededError,
    http_exception_handler
)

# Set up logging
setup_logging(log_level=logging.INFO)
logger = get_module_logger(__name__)
from app.addon_router import router as addon_router
from app.addon_scheduler import start_addon_scheduler
from app.features_router import router as features_router
from app.current_billing_metrics import router as billing_metrics_router
from app.addon_router import router as addon_router
from app.addon_scheduler import start_addon_scheduler
from app.features_router import router as features_router
from app.cron import init_scheduler
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

app = FastAPI(debug=True)

# Register exception handlers
app.add_exception_handler(AuthenticationError, http_exception_handler)
app.add_exception_handler(AuthorizationError, http_exception_handler)
app.add_exception_handler(ValidationError, http_exception_handler)
app.add_exception_handler(ResourceNotFoundError, http_exception_handler)
app.add_exception_handler(DatabaseError, http_exception_handler)
app.add_exception_handler(ExternalServiceError, http_exception_handler)
app.add_exception_handler(RateLimitExceededError, http_exception_handler)

class ForceHTTPSMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Override scheme
        request.scope["scheme"] = "https"
        response = await call_next(request)
        return response

app.add_middleware(ForceHTTPSMiddleware)

# Initialize the scheduler
scheduler = init_scheduler()

# Add shutdown handler
@app.on_event("shutdown")
def shutdown_event():
    scheduler.shutdown()

# Check required environment variables
zoho_product_id = os.getenv('ZOHO_DEFAULT_PRODUCT_ID')
if not zoho_product_id:
    logger.warning("ZOHO_DEFAULT_PRODUCT_ID environment variable is not set! This is required for addon synchronization with Zoho.")

# Initialize Zoho sync scheduler
logger.info("Initializing Zoho sync scheduler")
initialize_scheduler()

# Add the logging middleware
#app.add_middleware(LoggingMiddleware)

app.mount("/uploads_bot", StaticFiles(directory="/uploads_bot"), name="uploads_bot")
app.include_router(botsettings_router)
app.include_router(social_login_router)
app.include_router(bot_conversations_router)
app.include_router(file_size_validations_router)
app.include_router(chatbot_router)
app.include_router(chat_router)
app.include_router(bot_creation)
app.include_router(emailverification_router)
app.include_router(usersettings_router)
app.include_router(demo_request_router)
app.include_router(analytics_router)
app.include_router(submit_issue_request)
app.include_router(word_count_validation)
app.include_router(weekly_Conversation)
app.include_router(team_management_router)
app.include_router(fetchsubscriptionplans_router)
# Add addon router with explicit logger
logger.info("Registering subscription addons router...")
app.include_router(fetchsubscriptionaddons_router)
app.include_router(notifications_router)
app.include_router(message_count_validations_router)
app.include_router(zoho_subscription_router)
app.include_router(admin_routes_router)
app.include_router(widget_botsettings_router)
app.include_router(billing_metrics_router)
app.include_router(addon_router)
app.include_router(features_router)

# Start the add-on expiry scheduler
start_addon_scheduler()
app.include_router(billing_metrics_router)
app.include_router(addon_router)
app.include_router(features_router)

# Start the add-on expiry scheduler
start_addon_scheduler()

ACCESS_TOKEN_EXPIRE_MINUTES = 120
 

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_origin_regex="http://localhost.*",  # Allow all localhost origins
    allow_credentials=True,
    allow_methods=["*"],  # Allow all HTTP methods (GET, POST, etc.)
    allow_headers=["*"],  # Allow all HTTP headers
    expose_headers=["X-Captcha-ID","X-New-Token"],  
)

# app.add_middleware(RoleBasedAccessMiddleware)
templates = Jinja2Templates(directory="app/templates")
app.mount("/static", StaticFiles(directory="app/static"), name="static")

# Initialize Admin Panel
logger.info("Initializing admin panel")
init(app)

#middleware configuration
@app.middleware("http")
async def add_db_session_to_request(request: Request, call_next):
    # Open a new DB session and add it to the request state
    db = SessionLocal()
    request.state.db = db
    try:
        # Call the next middleware or endpoint handler
        response = await call_next(request)
        return response
    finally:
        # Close the DB session when done
        db.close()

@app.middleware("http")
async def extend_token_expiration(request: Request, call_next):
    """
    Middleware to extend the token expiration time whenever a user makes a request.
    This implements a sliding session timeout that only ends after inactivity.
    """
    # Skip token refresh for authentication endpoints
    if request.url.path in ["/login", "/token", "/register", "/forgot-password", "/reset-password"]:
        response = await call_next(request)
        return response
        
    
    # Get the authorization header
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.replace("Bearer ", "")
        try:
            # Decode the token without validation to get the payload
            payload = jwt.decode(
                token, 
                settings.SECRET_KEY, 
                algorithms=[settings.ALGORITHM],
                options={"verify_exp": False}  # Don't validate expiration yet
            )
            
            # Only refresh if the token is still valid
            current_time = datetime.utcnow().timestamp()
            if payload.get("exp") and payload.get("exp") > current_time:
                # Create a new token with the same payload but extended expiration
                new_payload = payload.copy()
                # Remove the exp claim as create_access_token will add it
                if "exp" in new_payload:
                    del new_payload["exp"]
                
                # Create new token with extended expiration
                new_token = create_access_token(
                    data=new_payload, 
                    expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
                )
                
                # Call the next middleware or endpoint handler
                response = await call_next(request)
                
                # Add the new token to the response headers
                response.headers["X-New-Token"] = new_token
                return response
        except Exception as e:
            # If there's any error decoding the token, just continue without refreshing
            logger.error(f"Error refreshing token: {str(e)}")
    
    # If no token or error, just continue with the request
    response = await call_next(request)
    return response

# For OAuth2 Password Bearer (for login)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# Register API
@app.post("/register", response_model=RegisterResponse)
def register_user(user: UserCreate, db: Session = Depends(get_db)):
    logger.info("Processing user registration")
    db_user = get_user_by_email(db, user.email)
    if db_user:
        logger.warning(f"Registration failed: Email already registered: {user.email}")
        raise HTTPException(status_code=400, detail="Emailid already registered")
    new_user = create_user(db, user)
    logger.info("User registration successful")

    # ✅ Generate JWT token for the registered user
    token_data = {
        "sub": new_user.email,
        "role": new_user.role,
        "user_id": new_user.user_id,
    }
    logger.info("Registering user")
    access_token = create_access_token(data=token_data, expires_delta=timedelta(hours=settings.REGISTER_TOKEN_EXPIRE_HOURS))
    emailverificationurl = f"{settings.BASE_URL}/verify-email?token={access_token}"
     # ✅ Send verification email
    subject = "Verify Your Email - Complete Registration"
    body = f"""
<html>
<body style="font-family: Arial, sans-serif; color: #000;">
    <p>Hello {new_user.name},</p>

    <p>Thank you for registering with Evolra AI! We're excited to have you on board.<br>Please verify your email by clicking the link below:</p>

    <p>
        <a href="{emailverificationurl}" style="color: #1a73e8; word-break: break-all;">{emailverificationurl}</a>
    </p>

    <p>This link will expire in 24 hours.</p>

    <p>Best regards,<br>
    Evolra Admin</p>
</body>
</html>
"""
    send_email(new_user.email, subject, body)
    logger.info("Email verification sent successfully")

    return RegisterResponse(
        message="User registered successfully",
        user=UserOut(
            user_id = new_user.user_id,
            email=new_user.email,
            role=new_user.role,
            company_name=new_user.company_name,
            name=new_user.name
        )
    )


# Login API - modified to use only username and password
@app.post("/login")
def login(login_request: LoginRequest, db: Session = Depends(get_db)):
    db_user = get_user_by_email(db, email=login_request.email)
    
    logger.info(f"Received login request for: {login_request.email}")
    
    if not db_user or not verify_password(login_request.password, db_user.password):
        logger.warning("Invalid credentials provided")
        raise HTTPException(status_code=400, detail="Invalid credentials")

    # Check if the user is verified
    if not db_user.is_verified:
        logger.warning(f"Unverified email attempt: {login_request.email}")
        raise HTTPException(status_code=400, detail="Email not verified. Please activate your email-id.")
    
    # Check if user is a team member
    team_member_entry = db.query(TeamMember).filter(
    TeamMember.member_id == db_user.user_id,
    TeamMember.invitation_status == "accepted"
    ).first()
    is_team_member = team_member_entry is not None
    owner_id = team_member_entry.owner_id if team_member_entry else None

    subscription_user_id = owner_id if is_team_member else db_user.user_id
    member_id = db_user.user_id if is_team_member else None
    
    user_subscription = db.query(UserSubscription).filter(
        UserSubscription.user_id == subscription_user_id,
        UserSubscription.status.notin_(["pending", "failed", "cancelled"])
    ).order_by(UserSubscription.payment_date.desc()).first()

    logger.debug("User subscription: %s", user_subscription)
    if user_subscription:
        logger.debug("User subscription plan ID: %s", user_subscription.subscription_plan_id)

    # Get message addon (ID 5) details if exists
    message_addon = db.query(UserAddon).filter(
        UserAddon.user_id == subscription_user_id,
        UserAddon.addon_id == 5,
        UserAddon.is_active == True
    ).order_by(UserAddon.expiry_date.desc()).first()

    # If no active subscription exists, set default subscription ID to 1
    subscription_plan_id = user_subscription.subscription_plan_id if user_subscription else 1
    
    logger.info(f"User {db_user.email} authenticated successfully")

    user_addons = db.query(UserAddon).filter(
        UserAddon.user_id == subscription_user_id,
        UserAddon.status == "active"  
    ).all()
    
    addon_plan_ids = [addon.addon_id for addon in user_addons] if user_addons else []
   
    # Create a token for the user
    token_data = {"sub": db_user.email,
                  "role":db_user.role, 
                  "user_id": subscription_user_id,
                  "name": db_user.name,  
                  "company_name": db_user.company_name,  
                  "phone_no": db_user.phone_no,
                  "subscription_plan_id": subscription_plan_id,
                  "total_words_used":db_user.total_words_used,
                  "is_team_member": is_team_member,
                   "member_id": member_id,
                  "addon_plan_ids": addon_plan_ids,
                  "message_addon_expiry": message_addon.expiry_date if message_addon else 'Not Available',
                  "subscription_status": user_subscription.status if user_subscription else "new",
                  }
    access_token = create_access_token(data=token_data, expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    
    # Return token and user info
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "email": db_user.email,
            "name": db_user.name,
            "role": db_user.role,
            "company_name": db_user.company_name,
            "user_id":subscription_user_id,
            "avatar_url":db_user.avatar_url,
            "phone_no":db_user.phone_no,
            "subscription_plan_id":subscription_plan_id,
            "total_words_used":db_user.total_words_used,
            "is_team_member": is_team_member,
            "member_id": member_id,
            "addon_plan_ids": addon_plan_ids,
            "message_addon_expiry": message_addon.expiry_date if message_addon else 'Not Available',
            "subscription_status": user_subscription.status if user_subscription else "new",
        }
    }

# Account Information API
@app.get("/account")
def get_account_info(email: str, db: Session = Depends(get_db)):
    """
    Fetch and display account information based on the username.
    """
    db_user = get_user_by_email(db, email=email)
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Get the user's active subscription
    user_subscription = db.query(UserSubscription).filter(
        UserSubscription.user_id == db_user.user_id,
        UserSubscription.status.not_in(["pending", "cancelled","failed"])
    ).order_by(UserSubscription.payment_date.desc()).first()
    
    # Get subscription plan ID if available
    subscription_plan_id = user_subscription.subscription_plan_id if user_subscription else None
    
    # Get list of addon plan IDs and message addon
    user_addons = db.query(UserAddon).filter(
        UserAddon.user_id == db_user.user_id,
        UserAddon.status == "active"
    ).all()
    
    addon_plan_ids = [ua.addon_id for ua in user_addons] if user_addons else []
    
    # Get message addon (ID 5) details if exists
    message_addon = db.query(UserAddon).filter(
        UserAddon.user_id == db_user.user_id,
        UserAddon.addon_id == 5,
        UserAddon.is_active == True
    ).order_by(UserAddon.expiry_date.desc()).first()

    avatar_url = db_user.avatar_url
    
    # Generate a fresh token with updated user information
    token_data = {"sub": db_user.email,
                 "role": db_user.role, 
                 "user_id": db_user.user_id,
                 "name": db_user.name,  
                 "company_name": db_user.company_name,  
                 "phone_no": db_user.phone_no,
                 "subscription_plan_id": subscription_plan_id,
                 "total_words_used": db_user.total_words_used,
                 "addon_plan_ids": addon_plan_ids,
                 "message_addon_expiry": message_addon.expiry_date if message_addon else 'Not Available',
                 "subscription_status": user_subscription.status if user_subscription else "new",
                 "avatar_url": avatar_url,
                }
    
    access_token = create_access_token(data=token_data, expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    
    return {
        "message": "Successful retrieval",
        "access_token": access_token,
        "user": {
            "email": db_user.email,
            "role": db_user.role,
            "company_name": db_user.company_name,
            "name": db_user.name,
            "user_id": db_user.user_id,
            "phone_no": db_user.phone_no,
            "communication_email": db_user.communication_email,
            "total_words_used": db_user.total_words_used,
            "subscription_plan_id": subscription_plan_id,
            "addon_plan_ids": addon_plan_ids,
            "message_addon_expiry": message_addon.expiry_date.isoformat() if message_addon and message_addon.expiry_date else 'Not Available',
            "subscription_status": user_subscription.status if user_subscription else "new",
             "avatar_url": avatar_url,

        }
    }

@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    logging.debug("Rendering login page.")
    return templates.TemplateResponse("login.html", {"request": request})


@app.get("/welcome", response_class=HTMLResponse)
async def welcome(request: Request):
    return templates.TemplateResponse("welcome.html", {"request": request})

# Route for password reset
@app.post("/forgot-password/")
async def forgot_password(request: ForgotpasswordRequest,db: Session = Depends(get_db)):
    # Generate password reset link (replace with your own logic)
    # Check if the user exists in the database
    db_user = get_user_by_email(db, email=request.email)
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    # 2. Check if user is registered via OAuth (Google, etc.)
    auth_provider = db.query(UserAuthProvider).filter(
        UserAuthProvider.user_id == db_user.user_id
    ).first()

    if auth_provider:
        raise HTTPException(
            status_code=400,
            detail="User not registered with password. Please sign in with Google."
        )

    # Generate a secure JWT token
    token_data = {"email": request.email, "exp": datetime.utcnow() + timedelta(minutes=settings.FORGOT_PASSWORD_TOKEN_EXPIRY_MINUTES)}
    token = jwt.encode(token_data, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

    reset_link = f"{settings.BASE_URL}/reset-password?token={token}"

    subject = "Password Reset Request"
    body = f"""
<html>
<body style="font-family: Arial, sans-serif; color: #000;">

<p>Hello {db_user.name},</p>

<p>We received a request to reset your password. Click the link below to reset it:</p>

<p>
<a href="{reset_link}">{reset_link}</a>
</p>

<p>This link will expire in {settings.FORGOT_PASSWORD_TOKEN_EXPIRY_MINUTES} minutes.</p>

<p>If you didn't request a password reset, please ignore this email.</p>

<p>Best regards,<br>
Evolra Admin</p>

</body>
</html>
"""

    try:
        send_email(to_email=request.email, subject=subject, body=body)
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to send email")

    return {"message": "Password reset link sent successfully"}


@app.post("/reset-password/")
async def reset_password(request: PasswordResetRequest, db: Session = Depends(get_db)):
    
    try:
        payload = jwt.decode(request.token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        
        email = payload.get("email")
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=400, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=400, detail="Invalid token")
    
    # Check if the user exists in the database
    db_user = get_user_by_email(db, email=email)
    
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Update the user's password
    
    try:
        # Attempt to update the user's password
        update_user_password(db, user_id=db_user.user_id, new_password=request.password)
    except Exception as e:
        # Catch any unexpected errors
        raise HTTPException(status_code=500, detail="An unexpected error occurred")
    
    return JSONResponse(content={"message": "Password successfully updated"}, status_code=200)


# Token endpoint for OAuth2PasswordBearer

@app.post("/token")
def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)
):
    logger.info(f"Received login request for: {form_data.username}")

    user = db.query(User).filter(User.email == form_data.username).first()
    if not user:
        logger.warning("User not found in database")
        raise HTTPException(status_code=401, detail="User not found")

    if not verify_password(form_data.password, user.password):
        logger.warning("Password verification failed")
        raise HTTPException(status_code=401, detail="Incorrect password")

    logger.info("User authenticated successfully!")

    user_subscription = db.query(UserSubscription).filter(
        UserSubscription.user_id == user.user_id,
        UserSubscription.status.notin_(["pending", "failed", "cancelled"])
    ).order_by(UserSubscription.payment_date.desc()).first()

    logger.info(f"User subscription: {user_subscription}")
    logger.info(f"User subscription plan ID: {user_subscription.subscription_plan_id}")
    
    subscription_plan_id = user_subscription.subscription_plan_id if user_subscription else 1

    user_addons = db.query(UserAddon).filter(
        UserAddon.user_id == user.user_id,
        UserAddon.status == "active"  
    ).all()

    # Get message addon (ID 5) details if exists
    message_addon = db.query(UserAddon).filter(
    UserAddon.user_id == user.user_id,
    UserAddon.addon_id == 5,
    UserAddon.is_active == True
    ).order_by(UserAddon.expiry_date.desc()).first()
    
    addon_plan_ids = [addon.addon_id for addon in user_addons] if user_addons else []

    #avatar_url = db.avatar_url

    access_token = create_access_token(data={
        "sub": user.email,
        "role": user.role,
        "user_id": user.user_id,
        "name": user.name,
        "company_name": user.company_name, 
        "phone_no": user.phone_no,
        "subscription_plan_id": subscription_plan_id,
        "total_words_used":user.total_words_used,
        "addon_plan_ids": addon_plan_ids,
        "subscription_status": user_subscription.status if user_subscription else "new",
        "message_addon_expiry": message_addon.expiry_date if message_addon else 'Not Available',
        "avatar_url": user.avatar_url,
    })
    return {"access_token": access_token, "token_type": "bearer"}

#API's to check RBAC Functionality
@app.get("/admin-dashboard")
def admin_dashboard(current_user= Depends(require_role(["admin"]))):
    return {"message": "Welcome, Admin!"}

@app.get("/admin-user-dashboard")
def admin_user_dashboard(current_user= Depends(require_role(["admin","user"]))):
    return {"message": f"Welcome {current_user}, you have access!"}

# Ensure the upload directory exists
if not settings.UPLOAD_DIR.startswith("s3://"):
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory="/uploads"), name="uploads")

@app.post("/upload-avatar/")
async def upload_avatar(file: UploadFile = File(...)):
    try:
        # Generate a unique filename
        file_extension = file.filename.split(".")[-1]
        logger.debug("File extension: %s", file_extension)
        filename = f"{uuid.uuid4()}.{file_extension}"
        logger.debug("Filename: %s", filename)
        
        # Read file content
        file_content = await file.read()
        
        # Save file using the new helper function
        saved_path = save_file(settings.UPLOAD_DIR, filename, file_content)
        
        # Generate file URL
        file_url = get_file_url(settings.UPLOAD_DIR, filename, settings.SERVER_URL)
        
        return JSONResponse(content={"url": file_url}, status_code=200)

    except FileStorageError as e:
        logger.error(f"File storage error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"File storage error: {str(e)}")
    except Exception as e:
        logger.error(f"Upload error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    
@app.put("/update-avatar/")
async def update_avatar_endpoint(request: UpdateAvatarRequest, db: Session = Depends(get_db)):
    """
    Update the avatar URL for a user.
    """
    logger.debug("User ID: %s", request.user_id)
    logger.debug("Avatar URL: %s", request.avatar_url)
    updated_user = update_avatar(db, user_id=request.user_id, avatar_url=request.avatar_url)
    if not updated_user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "Avatar updated successfully", "user": updated_user}


@app.post("/scrape")
def scrape_endpoint(request: ScrapeRequest ,db: Session = Depends(get_db)):
    """
    Scrapes only the selected nodes provided by the user using the hybrid approach.
    """
    data = scrape_selected_nodes(request.selected_nodes,request.bot_id, db)
    return {"message": "Scraping completed", "data": data}

@app.get("/get_nodes")
def get_nodes(website_url: str = Query(..., title="Website URL")):
    """
    API to get a list of all available pages (nodes) from a website.
    """
    return get_website_nodes(website_url)


@app.get("/scraped-urls/{bot_id}", response_model=List[PageData])
def get_scraped_urls(bot_id: int, db: Session = Depends(get_db)):
    """
    Fetch all scraped URLs for a specific bot_id.
    """
    return get_scraped_urls_func(bot_id,db)

# Store captcha values (for demo purposes; use a database in production)
captcha_store = {}

def generate_captcha_text():
    # Define characters to use (uppercase letters and digits, excluding 0, O, 1, 7)
    chars = (
        string.ascii_uppercase.replace('O', '')  # Remove 'O'
        + string.digits.replace('0', '').replace('1', '').replace('7', '')  # Remove 0, 1, 7
    )
    return "".join(random.choices(chars, k=5))

@app.get("/captcha")
async def get_captcha(db: Session = Depends(get_db)):
    captcha_text = generate_captcha_text()
    
    # Store in database
    db_captcha = Captcha(
        captcha_text=captcha_text,
        created_at=datetime.utcnow()
    )
    db.add(db_captcha)
    db.commit()
    db.refresh(db_captcha)

     # Trigger cleanup in background thread
    cleanup_thread = threading.Thread(
        target=captcha_cleaner.cleanup_expired_captchas,
        args=(db,),
        daemon=True
    )
    cleanup_thread.start()
    
    # Generate image
    image = ImageCaptcha()
    image_data = image.generate(captcha_text)
    
    return Response(
        content=image_data.read(), 
        media_type="image/png",
        headers={"X-Captcha-ID": str(db_captcha.id)}  # Send CAPTCHA ID to client
    )

@app.post("/validate-captcha")
async def validate_captcha(
    request: Request,
    data: CaptchaRequest, 
    db: Session = Depends(get_db)
):
    # Get CAPTCHA ID from headers
    captcha_id = request.headers.get("X-Captcha-ID")
    print("captcha_id=>>>",captcha_id)
    if not captcha_id:
        raise HTTPException(status_code=400, detail="Missing CAPTCHA ID")
    
    # Find the CAPTCHA record
    db_captcha = db.query(Captcha).filter(
        Captcha.id == captcha_id,
        #Captcha.is_used == False,
        Captcha.created_at >= datetime.utcnow() - timedelta(minutes=5)  # 5 min expiry
    ).first()
    
    if not db_captcha:
        logger.warning(f"CAPTCHA not found or expired. ID: {captcha_id}")
        raise HTTPException(status_code=400, detail="CAPTCHA expired or invalid")
    
    # Validate (case-insensitive)
    is_valid = data.user_input.lower() == db_captcha.captcha_text.lower()
    
    # Always mark as used after validation attempt to prevent replay attacks
    db_captcha.is_used = True
    db.commit()
    
    if not is_valid:
        raise HTTPException(status_code=400, detail="Incorrect CAPTCHA")
    
    return {"valid": True, "message": "CAPTCHA validated"}

@app.get("/task/{task_id}", response_model=dict)
def check_task_status(task_id: str):
    """API endpoint to check the status of a Celery task."""
    logger.info(f"Checking status of task {task_id}")
    
    try:
        task = celery_app.AsyncResult(task_id)
        
        result = {
            "task_id": task_id,
            "status": task.status,
            "done": task.ready()
        }
        
        # If task is complete, add the result
        if task.ready():
            if task.successful():
                result["result"] = task.result
            else:
                result["error"] = str(task.result)
        
        logger.info(f"Task {task_id} status: {task.status}")
        return result
    except Exception as e:
        logger.exception(f"Error checking task status: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error checking task status: {str(e)}")

@app.post("/scrape-async")
def scrape_async_endpoint(request: WebScrapingRequest, db: Session = Depends(get_db)):
    """
    API endpoint to start asynchronous web scraping using Celery.
    
    Accepts a list of URLs to scrape and sends a notification when complete.
    """
    try:
        logger.info(f"[SCRAPE-ASYNC] Received request with params: bot_id={request.bot_id}, urls_count={len(request.selected_nodes)}")
        logger.debug(f"[SCRAPE-ASYNC] Full request data: {request.dict()}")
        
        # Validate bot exists
        logger.info(f"[SCRAPE-ASYNC] Validating bot with ID {request.bot_id}")
        bot = db.query(Bot).filter(Bot.bot_id == request.bot_id).first()
        if not bot:
            logger.error(f"[SCRAPE-ASYNC] Bot with ID {request.bot_id} not found in database")
            raise HTTPException(status_code=404, detail=f"Bot with ID {request.bot_id} not found")
        
        logger.info(f"[SCRAPE-ASYNC] Bot found, user_id={bot.user_id}")
        
        # Start Celery task
        logger.info(f"[SCRAPE-ASYNC] Attempting to start Celery task with {len(request.selected_nodes)} URLs")
        try:
            task = process_web_scraping.delay(request.bot_id, request.selected_nodes)
            logger.info(f"[SCRAPE-ASYNC] Celery task started successfully with task_id={task.id}")
        except Exception as celery_err:
            logger.exception(f"[SCRAPE-ASYNC] Failed to start Celery task: {str(celery_err)}")
            raise HTTPException(status_code=500, detail=f"Failed to start Celery task: {str(celery_err)}")
        
        # Create initial notification
        logger.info(f"[SCRAPE-ASYNC] Creating notification for bot_id={request.bot_id}, user_id={bot.user_id}")
        try:
            add_notification(
                db=db,
                event_type="WEB_SCRAPING_STARTED",
                event_data=f"Started scraping {len(request.selected_nodes)} web pages. You will be notified when complete.",
                bot_id=request.bot_id,
                user_id=bot.user_id
            )
            logger.info(f"[SCRAPE-ASYNC] Notification created successfully")
        except Exception as notification_err:
            logger.exception(f"[SCRAPE-ASYNC] Failed to create notification: {str(notification_err)}")
            # Continue even if notification fails
        
        logger.info(f"[SCRAPE-ASYNC] Request processed successfully for bot {request.bot_id}")
        
        # Return success message
        return {
            "message": "Web scraping started in the background. You will be notified when complete.",
            "status": "processing",
            "task_id": task.id
        }
        
    except HTTPException as he:
        # Re-raise HTTP exceptions
        logger.error(f"[SCRAPE-ASYNC] HTTP error: {str(he)}")
        raise
    except Exception as e:
        logger.exception(f"[SCRAPE-ASYNC] Unhandled exception: {str(e)}")
        # Log the stack trace
        import traceback
        logger.error(f"[SCRAPE-ASYNC] Stack trace: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Error starting web scraping: {str(e)}")