from fastapi import FastAPI, Depends, HTTPException, Response, Request,File, UploadFile, HTTPException, Query
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from .models import Base, User
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


app = FastAPI()

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

ACCESS_TOKEN_EXPIRE_MINUTES = 30
 

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],  # Allow all HTTP methods (GET, POST, etc.)
    allow_headers=["*"],  # Allow all HTTP headers
)

app.add_middleware(RoleBasedAccessMiddleware)
templates = Jinja2Templates(directory="app/templates")
app.mount("/static", StaticFiles(directory="app/static"), name="static")

# # Initialize Admin Panel
init(app)

# Create tables
Base.metadata.create_all(bind=engine)

#middleware configuration
@app.middleware("http")
async def add_db_session_to_request(request: Request, call_next):
    # Open a new DB session and add it to the request state
    request.state.db = SessionLocal()
    response = await call_next(request)
    return response

# For OAuth2 Password Bearer (for login)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# Register API
@app.post("/register", response_model=RegisterResponse)
def register_user(user: UserCreate, db: Session = Depends(get_db)):
    db_user = get_user_by_email(db, user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Emailid already registered")
    new_user = create_user(db, user)

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
    
    # Create a token for the user
    token_data = {"sub": db_user.email,
                  "role":db_user.role, 
                  "user_id": db_user.user_id,
                  "name": db_user.name,  
                  "company_name": db_user.company_name,  
                  "phone_no": db_user.phone_no,}
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
            "user_id":db_user.user_id,
            "avatar_url":db_user.avatar_url,
            "phone_no":db_user.phone_no
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
    access_token = create_access_token(data={"sub": user.email,"role": user.role, "user_id":user.user_id,"name": user.name,
        "company_name": user.company_name, "phone_no": user.phone_no})
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