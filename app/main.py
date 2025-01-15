# app/main.py
from fastapi import FastAPI, Depends, HTTPException, status
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from .models import Base, User
from .schemas import UserCreate, UserOut, LoginRequest
from .crud import get_user_by_username, create_user
from fastapi.security import OAuth2PasswordBearer
from passlib.context import CryptContext
from sqlalchemy.orm import Session

app = FastAPI()

# Database setup
SQLALCHEMY_DATABASE_URL = "postgresql://postgres:root@localhost:5433/chatbot_wrapper"


engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

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
@app.post("/register", response_model=UserOut)
def register_user(user: UserCreate, db: Session = Depends(get_db)):
    db_user = get_user_by_username(db, username=user.username)
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    return create_user(db=db, user=user)


# Login API - modified to use only username and password
@app.post("/login")
def login(login_request: LoginRequest, db: Session = Depends(get_db)):
    db_user = get_user_by_username(db, username=login_request.username)
    if not db_user or not verify_password(login_request.password, db_user.password):
        raise HTTPException(status_code=400, detail="Invalid credentials")
    return {"msg": "Login successful"}

# Utility function to verify password
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)
