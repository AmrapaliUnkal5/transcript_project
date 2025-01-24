# app/crud.py
from sqlalchemy.orm import Session
from .models import User
from .schemas import UserCreate
from passlib.context import CryptContext

# Initialize password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_user_by_username(db: Session, username: str):
    return db.query(User).filter(User.username == username).first()

def create_user(db: Session, user: UserCreate):
    hashed_password = pwd_context.hash(user.password) if user.password else None  # Hash password if provided
    db_user = User(
        name=user.name,
        email=user.email,
        password=hashed_password,
        role="user",  # Default role
        is_verified=False,  # Default to unverified
        avatar_url=None,  # Default to None
        phone_no=user.phone_no,
        company_name = user.company_name
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def get_user_by_email(db: Session, email: str):
    return db.query(User).filter(User.email == email).first()
