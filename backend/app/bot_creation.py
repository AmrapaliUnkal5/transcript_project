from fastapi import FastAPI, Depends, HTTPException, APIRouter
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Bot
from app.schemas import BotCreation, UserOut, BotRename
from app.dependency import get_current_user

router = APIRouter()

@router.post("/create-bot")
def create_bot(bot: BotCreation, db: Session = Depends(get_db), current_user: UserOut = Depends(get_current_user)):
    
    # Safely extract user_id
    if isinstance(current_user, dict):  # If current_user is a dictionary
        user_id = current_user.get("user_id")
    else:  
        user_id = getattr(current_user, "user_id", None)

    if not user_id:
        raise HTTPException(status_code=400, detail="User not authenticated")

    # Check if a bot with the same name already exists for the given user_id
    existing_bot = db.query(Bot).filter(Bot.user_id == user_id, Bot.bot_name == bot.bot_name,Bot.status !="Deleted").first()
    if existing_bot:
        raise HTTPException(status_code=400, detail="A bot with this name already exists for the user")

    # Create a new bot
    db_bot = Bot(
        bot_name=bot.bot_name,
        status=bot.status,
        is_active=bot.is_active,
        user_id=user_id,  
    )

    db.add(db_bot)
    db.commit()
    db.refresh(db_bot)

    return {
        "success": True,
        "bot_id": db_bot.bot_id,
        "message": "Bot created successfully"
    }


@router.put("/update-bot-name/{bot_id}")
def update_bot_name(
    bot_id: int,
    bot_update: BotRename,
    db: Session = Depends(get_db),
    current_user: UserOut = Depends(get_current_user)
):
    print("Received request to update bot name:", bot_update)
    print("Current User:", current_user)

    # Safely extract user_id
    if isinstance(current_user, dict):  
        user_id = current_user.get("user_id")
    else:  
        user_id = getattr(current_user, "user_id", None)

    if not user_id:
        raise HTTPException(status_code=400, detail="User not authenticated")

    # Fetch the bot from the database
    db_bot = db.query(Bot).filter(Bot.bot_id == bot_id, Bot.user_id == user_id).first()
    if not db_bot:
        raise HTTPException(status_code=404, detail="Bot not found")

    # Check if the new bot name already exists for the user
    existing_bot = db.query(Bot).filter(
        Bot.user_id == user_id,
        Bot.bot_name == bot_update.bot_name,
        Bot.status !="Deleted",
        Bot.bot_id != bot_id  # Exclude the current bot
    ).first()
    if existing_bot:
        raise HTTPException(status_code=400, detail="A bot with this name already exists for the user")

    # Update the bot name
    db_bot.bot_name = bot_update.bot_name
    db.commit()
    db.refresh(db_bot)

    return {
        "success": True,
        "bot_id": db_bot.bot_id,
        "message": "Bot name updated successfully"
    }