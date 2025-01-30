# app/main.py
from fastapi import FastAPI, Depends, HTTPException, status, Request
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from .models import Base, User
from .schemas import UserCreate, UserOut, LoginRequest,RegisterResponse
from .crud import create_user,get_user_by_email
from fastapi.security import OAuth2PasswordBearer
from passlib.context import CryptContext
from sqlalchemy.orm import Session
from app.social_login import router as social_login_router
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from app.config import SQLALCHEMY_DATABASE_URL
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timedelta
from jose import JWTError, jwt
import logging
from app.botsettings import router as botsettings_router



app = FastAPI()
app.include_router(botsettings_router)

# Secret key for JWT (use a strong secret key in production)
SECRET_KEY = "your_secret_key"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],  # Allow all HTTP methods (GET, POST, etc.)
    allow_headers=["*"],  # Allow all HTTP headers
)

app.include_router(social_login_router)
engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
templates = Jinja2Templates(directory="app/templates")
app.mount("/static", StaticFiles(directory="app/static"), name="static")

# Create tables
Base.metadata.create_all(bind=engine)

# Dependency to get the DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# For OAuth2 Password Bearer (for login)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

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
    token_data = {"sub": db_user.email}
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
        }
    }



# Utility function to verify password
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


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