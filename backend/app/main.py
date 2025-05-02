from fastapi import FastAPI, Depends, HTTPException, Response, Request,File, UploadFile, HTTPException, Query
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from .models import Base, User, UserSubscription, TeamMember,UserAddon
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
from app.notifications import router as notifications_router
from app.message_count_validations import router as message_count_validations_router
from app.zoho_subscription_router import router as zoho_subscription_router
from app.zoho_sync_scheduler import initialize_scheduler
from app.admin_routes import router as admin_routes_router
from app.widget_botsettings import router as widget_botsettings_router
from app.current_billing_metrics import router as billing_metrics_router

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


app = FastAPI(debug=True)

# Register exception handlers
app.add_exception_handler(AuthenticationError, http_exception_handler)
app.add_exception_handler(AuthorizationError, http_exception_handler)
app.add_exception_handler(ValidationError, http_exception_handler)
app.add_exception_handler(ResourceNotFoundError, http_exception_handler)
app.add_exception_handler(DatabaseError, http_exception_handler)
app.add_exception_handler(ExternalServiceError, http_exception_handler)
app.add_exception_handler(RateLimitExceededError, http_exception_handler)

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

app.mount("/uploads_bot", StaticFiles(directory="uploads_bot"), name="uploads_bot")
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
    expose_headers=["X-New-Token"],  # Expose custom headers
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
    logger.info(f"Registering new user with email: {user.email}")
    db_user = get_user_by_email(db, user.email)
    if db_user:
        logger.warning(f"Registration failed: Email already registered: {user.email}")
        raise HTTPException(status_code=400, detail="Emailid already registered")
    new_user = create_user(db, user)
    logger.info(f"User registered successfully: {user.email}")

    # ✅ Generate JWT token for the registered user
    token_data = {
        "sub": new_user.email,
        "role": new_user.role,
        "user_id": new_user.user_id,
    }
    print("regisering")
    access_token = create_access_token(data=token_data, expires_delta=timedelta(hours=settings.REGISTER_TOKEN_EXPIRE_HOURS))
    emailverificationurl = f"{settings.BASE_URL}/verify-email?token={access_token}"
     # ✅ Send verification email
    subject = "Verify Your Email - Complete Registration"
    body = f"""
    Hi {new_user.name},

    Thank you for registering! Please verify your email by clicking the link below:

    {emailverificationurl}

    This link will expire in 24 hours.

    Best regards,
    Your Team
    """
    send_email(new_user.email, subject, body)
    print("Sent email success")

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
    if not db_user or not verify_password(login_request.password, db_user.password):
        raise HTTPException(status_code=400, detail="Invalid credentials")

    # Check if the user is verified
    if not db_user.is_verified:
        raise HTTPException(status_code=400, detail="Email not verified. Please activate your email-id.")
    
    # Check if user is a team member
    team_member_entry = db.query(TeamMember).filter(TeamMember.member_id == db_user.user_id).first()
    is_team_member = team_member_entry is not None
    owner_id = team_member_entry.owner_id if team_member_entry else None

    subscription_user_id = owner_id if is_team_member else db_user.user_id
    member_id = db_user.user_id if is_team_member else None
    
    
    
    user_subscription = db.query(UserSubscription).filter(
    UserSubscription.user_id == db_user.user_id,
    UserSubscription.status != "pending"
    ).order_by(UserSubscription.payment_date.desc()).first()

    print("If user subscription", user_subscription)
    print("user sub id=>", user_subscription.subscription_plan_id)

# Get message addon (ID 5) details if exists
    message_addon = db.query(UserAddon).filter(
    UserAddon.user_id == db_user.user_id,
    UserAddon.addon_id == 5,
    UserAddon.is_active == True
    ).order_by(UserAddon.expiry_date.desc()).first()

    # If no active subscription exists, set default subscription ID to 1
    subscription_plan_id = user_subscription.subscription_plan_id if user_subscription else 1
    print("")

    user_addons = db.query(UserAddon).filter(
        UserAddon.user_id == db_user.user_id,
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
                  "subscription_status": user_subscription.status if user_subscription else "expired",
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
            "subscription_status": user_subscription.status if user_subscription else "expired",
        }
    }

# Account Information API
@app.get("/account", response_model=RegisterResponse)
def get_account_info(email: str, db: Session = Depends(get_db)):
    """
    Fetch and display account information based on the username.
    """
    db_user = get_user_by_email(db, email=email)
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    return RegisterResponse(
        message="Successfull retrival",
        user=UserOut(
            email=db_user.email,
            role=db_user.role,
            company_name=db_user.company_name,
            name=db_user.name
        )
    )

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
    # Generate a secure JWT token
    token_data = {"email": request.email, "exp": datetime.utcnow() + timedelta(minutes=settings.FORGOT_PASSWORD_TOKEN_EXPIRY_MINUTES)}
    token = jwt.encode(token_data, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

    reset_link = f"{settings.BASE_URL}/reset-password?token={token}"

    subject = "Password Reset Request"
    body = f"""
    Hi,

    We received a request to reset your password. Click the link below to reset it:

    {reset_link}

    This link will expire in {settings.FORGOT_PASSWORD_TOKEN_EXPIRY_MINUTES} minutes.

    If you didn't request a password reset, please ignore this email.

    Thanks,
    Your Team
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
    print(f"Received login request for: {form_data.username}")

    user = db.query(User).filter(User.email == form_data.username).first()
    if not user:
        print("User not found in database")
        raise HTTPException(status_code=401, detail="User not found")

    if not verify_password(form_data.password, user.password):
        print("Password verification failed")
        raise HTTPException(status_code=401, detail="Incorrect password")

    print("User authenticated successfully!")

    user_subscription = db.query(UserSubscription).filter(
        UserSubscription.user_id == user.user_id,
        UserSubscription.status != "pending"
    ).order_by(UserSubscription.payment_date.desc()).first()

    print("If user subscription", user_subscription)
    print("user sub id=>", user_subscription.subscription_plan_id)
    
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
        "subscription_status": user_subscription.status if user_subscription else "expired",
        "message_addon_expiry": message_addon.expiry_date if message_addon else 'Not Available',
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
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

@app.post("/upload-avatar/")
async def upload_avatar(file: UploadFile = File(...)):
    try:
        # Generate a unique filename
        file_extension = file.filename.split(".")[-1]
        print("file_extension", file_extension)
        filename = f"{uuid.uuid4()}.{file_extension}"
        print("filename", filename)
        
        # Define the file path to save the file
        file_path = os.path.join(UPLOAD_DIR, filename)

        # Save the file
        with open(file_path, "wb") as buffer:
            buffer.write(await file.read())

        # Return the URL of the saved file
        file_url = f"{settings.SERVER_URL}/{UPLOAD_DIR}/{filename}"
        return JSONResponse(content={"url": file_url}, status_code=200)

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@app.put("/update-avatar/")
async def update_avatar_endpoint(request: UpdateAvatarRequest, db: Session = Depends(get_db)):
    """
    Update the avatar URL for a user.
    """
    print("request.user_id",request.user_id)
    print("request.avatar_url",request.avatar_url)
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
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=5))

@app.get("/captcha")
async def get_captcha():
    captcha_text = generate_captcha_text()
    image = ImageCaptcha()
    image_data = image.generate(captcha_text)

    # Store CAPTCHA (in a real app, store it in Redis or DB)
    captcha_store["captcha"] = captcha_text

    return Response(content=image_data.read(), media_type="image/png")

@app.post("/validate-captcha")
async def validate_captcha(data: CaptchaRequest):
    print("capta",captcha_store.get("captcha", ""))
    is_valid = data.user_input == captcha_store.get("captcha", "")
    return {"valid": is_valid, "message": "Captcha validated", "user_input": data.user_input}