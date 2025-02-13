from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import crud
from app import schemas

router = APIRouter(prefix="/botsettings", tags=["Bot Settings"])

@router.get("/bot/{bot_id}", response_model=schemas.BotResponse)
def get_bot_settings(bot_id: int, db: Session = Depends(get_db)):
    """Fetch bot settings by bot_id"""
    bot = crud.get_bot_by_id(db, bot_id)
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")
    return bot

@router.post("/", response_model=schemas.BotResponse)
def create_bot_settings(bot_data: schemas.BotCreate, db: Session = Depends(get_db)):
    """Create bot settings (insert if first time)"""
    return crud.create_bot(db, bot_data)

@router.put("/{bot_id}", response_model=schemas.BotResponse)
def update_bot_settings(bot_id: int, bot_data: schemas.BotUpdate, db: Session = Depends(get_db)):
    """Update bot settings if already existing"""
    updated_bot = crud.update_bot(db, bot_id, bot_data)
    if not updated_bot:
        raise HTTPException(status_code=404, detail="Bot not found")
    return updated_bot

@router.get("/user/{user_id}")
def get_bot_setting_by_user_id(user_id: int, db: Session = Depends(get_db)):
    """Fetch user details by user_id"""
    return crud.get_bot_by_user_id(db, user_id) or []    
 
