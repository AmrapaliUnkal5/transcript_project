from fastapi import FastAPI, Depends, HTTPException, status, Request,File, UploadFile, HTTPException
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


app = FastAPI()

app.mount("/uploads_bot", StaticFiles(directory="uploads_bot"), name="uploads_bot")
app.include_router(botsettings_router)
app.include_router(social_login_router)
app.include_router(bot_conversations_router)

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
    return RegisterResponse(
        message="User registered successfully",
        user=UserOut(
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
    
    # Create a token for the user
    #token_string=db_user.email+","+db_user.role
    token_data = {"sub": db_user.email,"role":db_user.role}
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
    access_token = create_access_token(data={"sub": user.email,"role": user.role})
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
        file_url = f"http://localhost:8000/uploads/{filename}"
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