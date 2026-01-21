import asyncio
import threading
from fastapi import FastAPI, Depends, HTTPException, Response, Request,File, UploadFile, HTTPException, Query
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from .models import Base, Captcha, User, TeamMember, UserAuthProvider
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
from app.admin import init
from app.utils.verify_password import verify_password
from app.utils.create_access_token import create_access_token
from app.database import get_db,engine,SessionLocal
from app.dependency import require_role,get_current_user
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from app.middleware import RoleBasedAccessMiddleware
import os
import uuid
from fastapi.staticfiles import StaticFiles
from captcha.image import ImageCaptcha
import random
import string
from app.email_verification import router as emailverification_router
from app.user_settings import router as usersettings_router
from app.demo_customer_support_request import router as demo_request_router
from app.submit_issue_request import router as submit_issue_request
from app.team_management import router as team_management_router
from app.notifications import router as notifications_router, add_notification
from app.saml_auth import router as saml_auth_router
from app.superadmin_router import router as superadmin_router
from app.captcha_cleanup_thread import captcha_cleaner
from app.utils.file_storage import save_file, get_file_url, FileStorageError
from app.utils.file_storage import resolve_file_url
from app.transcript_project import router as transcript_router

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
from app.cron import init_scheduler
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

#
# IMPORTANT (path-based hosting):
# We run this project behind a path prefix: https://evolra.ai/voice-api/...
# ALB/CloudFront will forward requests with the prefix intact (no path rewriting),
# so we mount the API under that prefix to avoid breaking routes.
#
# Existing code below is written against the `app` variable (decorators, mounts, middleware).
# We keep it as the *API app* and later export a small root app that mounts it at /voice-api.
#
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


# Add the logging middleware
app.add_middleware(LoggingMiddleware)

# Mount transcript project static if local
if not os.getenv("TRANSCRIPT_DIR_S3", "false").lower() in ("1", "true", "yes"):
    if os.path.exists("transcript_project"):
        app.mount("/transcript_project", StaticFiles(directory="transcript_project"), name="transcript_project")
app.include_router(social_login_router)
app.include_router(emailverification_router)
app.include_router(usersettings_router)
app.include_router(demo_request_router)
app.include_router(submit_issue_request)
app.include_router(team_management_router)
app.include_router(notifications_router)
app.include_router(saml_auth_router)
app.include_router(superadmin_router)
app.include_router(transcript_router)

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

#app.add_middleware(RoleBasedAccessMiddleware)
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

    user_id = owner_id if is_team_member else db_user.user_id
    member_id = db_user.user_id if is_team_member else None
    
    logger.info(f"User {db_user.email} authenticated successfully")
   
    # Create a token for the user
    token_data = {
        "sub": db_user.email,
        "role": db_user.role, 
        "user_id": user_id,
        "name": db_user.name,  
        "company_name": db_user.company_name,  
        "phone_no": db_user.phone_no,
        "is_team_member": is_team_member,
        "member_id": member_id,
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
            "user_id": user_id,
            "avatar_url": resolve_file_url(db_user.avatar_url),
            "phone_no": db_user.phone_no,
            "is_team_member": is_team_member,
            "member_id": member_id,
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

    #added this logic similar to /login API
    # ✅ Check if user is a team member
    team_member_entry = db.query(TeamMember).filter(
        TeamMember.member_id == db_user.user_id,
        TeamMember.invitation_status == "accepted"
    ).first()

    is_team_member = team_member_entry is not None
    owner_id = team_member_entry.owner_id if team_member_entry else None

    # ✅ If team member → use owner's user_id
    user_id = owner_id if is_team_member else db_user.user_id
    member_id = db_user.user_id if is_team_member else None

    avatar_url = resolve_file_url(db_user.avatar_url)
    
    # Generate a fresh token with updated user information
    token_data = {
        "sub": db_user.email,
        "role": db_user.role, 
        "user_id": user_id,
        "name": db_user.name,  
        "company_name": db_user.company_name,  
        "phone_no": db_user.phone_no,
        "is_team_member": is_team_member,
        "member_id": member_id,
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
            "user_id": user_id,
            "phone_no": db_user.phone_no,
            "communication_email": db_user.communication_email,
            "is_team_member": is_team_member,
            "member_id": member_id,
            "avatar_url": avatar_url,
        }
    }


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

    avatar_url = resolve_file_url(user.avatar_url)

    access_token = create_access_token(data={
        "sub": user.email,
        "role": user.role,
        "user_id": user.user_id,
        "name": user.name,
        "company_name": user.company_name, 
        "phone_no": user.phone_no,
        "avatar_url": avatar_url,
    })
    return {"access_token": access_token, "token_type": "bearer"}

# Ensure the upload directory exists
if not settings.UPLOAD_DIR.startswith("s3://"):
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
# Mount static files directory only if it's not an S3 path
if not settings.UPLOAD_DIR.startswith("s3://"):
    app.mount(f"/{settings.UPLOAD_DIR}", StaticFiles(directory=settings.UPLOAD_DIR), name=settings.UPLOAD_DIR)

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
         #Resolve presigned URL if it's an S3 path
        resolved_url = resolve_file_url(file_url) if file_url.startswith("s3://") else file_url

        return JSONResponse(
            content={
                "url": file_url,            # original raw URL
                "resolved_url": resolved_url  # presigned or direct display URL
            },
            status_code=200
        )

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


class TokenResponse(BaseModel):
    access_token: str

@app.get("/auth/refresh-token", response_model=TokenResponse)
def refresh_token(request: Request, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """
    Returns a fresh access token with updated user details.
    """
    user_id = current_user.get("user_id")
    user = db.query(User).filter(User.user_id == user_id).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    avatar_url = resolve_file_url(user.avatar_url)
    
    token_data = {
        "sub": user.email,
        "role": user.role,
        "user_id": user.user_id,
        "name": user.name,
        "company_name": user.company_name,
        "phone_no": user.phone_no,
        "avatar_url": avatar_url,
    }
    
    new_token = create_access_token(data=token_data, expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    return {"access_token": new_token}

# ---- Root ASGI app (mounted API prefix) ----
# Export a root app that mounts the API at /voice-api so all endpoints are available at:
#   /voice-api/login, /voice-api/docs, /voice-api/admin, ...
#
# ALB/CloudFront path-based routing will forward requests with the prefix intact,
# so mounting is required (no path rewriting is done upstream).
api_app = app
root_app = FastAPI()
root_app.mount("/voice-api", api_app)

# Uvicorn serves `app.main:app`, so we rebind `app` to the root app.
app = root_app
