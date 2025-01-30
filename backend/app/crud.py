# app/crud.py
from sqlalchemy.orm import Session
from .models import User, Bot
from .schemas import UserCreate,BotCreate, BotUpdate
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

def get_bot_by_id(db: Session, bot_id: int):
    """Fetch bot settings by bot_id"""
    return db.query(Bot).filter(Bot.bot_id == bot_id).first()

def create_bot(db: Session, bot_data: BotCreate):
    """Insert bot settings if not existing"""
    new_bot = Bot(**bot_data.dict())
    db.add(new_bot)
    db.commit()
    db.refresh(new_bot)
    return new_bot

def update_bot(db: Session, bot_id: int, bot_data: BotUpdate):
    """Update bot settings if already existing"""
    # Fetch the bot from the database
    bot = db.query(Bot).filter(Bot.bot_id == bot_id).first()
    
    if not bot:
        return None  # Handle case when bot is not found
    
    #print(f"Incoming bot data: {bot_data.dict()}")
    #print(f"Existing bot data: {bot}")
    
    # Default values for each field (you can adjust these as needed)
    default_values = {
        'user_id': 0,
        'bot_name': 'string',
        'bot_icon': 'string',
        'font_style': 'string',
        'font_size': 0,
        'position': 'string',
        'max_words_per_message': 200,
        'is_active': True
    }

    # Update bot object with only provided fields that are different from defaults
    for field, value in bot_data.dict(exclude_unset=True).items():
        current_value = getattr(bot, field)  # Get current value from the database
        
        # Skip update if incoming value is the default one or same as the current value in the database
        if value != default_values.get(field) and value != current_value:
            #print(f"Updating {field} from {current_value} to {value}")
            setattr(bot, field, value)  # Set the new value
    
    db.commit()
    db.refresh(bot)  
    return bot
