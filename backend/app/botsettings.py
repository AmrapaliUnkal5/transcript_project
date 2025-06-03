from fastapi import APIRouter, Depends, HTTPException,UploadFile, File,Request
from sqlalchemy.orm import Session
from app.database import get_db
from app import crud
from app import schemas
import os
from fastapi.responses import JSONResponse
import shutil
from app.config import settings
from app.schemas import  BotUpdateStatus, ReactionCreate
from app.models import Bot, User, InteractionReaction, Notification
from datetime import datetime
from app.utils.reembedding_utils import reembed_all_files
from app.dependency import get_current_user
from datetime import datetime, timezone
from app.notifications import add_notification
from .utils.email_helper import send_email

router = APIRouter(prefix="/botsettings", tags=["Bot Settings"])

# Use environment variable-based path
UPLOAD_DIR = settings.UPLOAD_BOT_DIR  # Directory to save uploaded images
os.makedirs(UPLOAD_DIR, exist_ok=True)

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


@router.post("/upload_bot")
async def upload_bot_icon(file: UploadFile = File(...)):
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Assuming the frontend can access this uploaded file via a static URL
    file_url = f"{settings.SERVER_URL}/{settings.UPLOAD_BOT_DIR}/{file.filename}"  # Adjust according to your server setup
    
    return JSONResponse(content={"url": file_url}) 

@router.put("/del/{bot_id}", response_model=schemas.BotResponse)
def update_bot_status(bot_id: int, db: Session = Depends(get_db)):
    """Update only the status of the bot to 'Deleted'"""
    updated_bot = crud.delete_bot(db, bot_id)
    #add notification
    event_type="BOT_DELETED",
    event_data=f"Bot has been deleted."
    add_notification(db=db,
                    event_type=event_type,
                    event_data=event_data,
                    bot_id=bot_id,
                    user_id=updated_bot.user_id)


    if not updated_bot:
        raise HTTPException(status_code=404, detail="Bot not found")

    return updated_bot  # Return updated bot object

# Endpoint to update bot status and is_active
@router.put("/bots/{bot_id}")
def update_bot(bot_id: int, update_data: BotUpdateStatus, db: Session = Depends(get_db)):
    
    try:
        # Find the bot by bot_id
        bot = db.query(Bot).filter(Bot.bot_id == bot_id).first()
        if not bot:
            raise HTTPException(status_code=404, detail="Bot not found")

        # Update the bot's status and is_active
        bot.is_active = update_data.is_active
        bot.status = update_data.status
        bot.updated_at = datetime.utcnow()  # Update the updated_at timestamp

        # Commit changes to the database
        db.commit()
        db.refresh(bot)

        # Create a new notification for bot activation
        print("bot.user_id",bot.user_id)
        event_type="BOT_ACTIVATED",
        event_data=f"Bot has been activated."
        add_notification(db=db,
                    event_type=event_type,
                    event_data=event_data,
                    bot_id=bot_id,
                    user_id=bot.user_id)
        print("update_data.is_active",update_data.is_active)
        
        if update_data.is_active:
            user = db.query(User).filter(User.user_id == bot.user_id).first()
            print("user",user.email)
            if user:
                send_bot_activation_email(user_name=user.name, user_email=user.email, bot_name=bot.bot_name)
        
        return {"message": "Bot updated successfully", "bot": bot}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()


@router.post("/reembed/{bot_id}")
async def reembed_bot_knowledge(bot_id: int, db: Session = Depends(get_db)):
    await reembed_all_files(bot_id, db)
    return {"message": "Re-embedding completed successfully"}
    db.close()


@router.post("/interactions/reaction")
async def submit_reaction(payload: ReactionCreate, db: Session = Depends(get_db)):
    existing = (
        db.query(InteractionReaction)
        .filter_by(interaction_id=payload.interaction_id, message_id=payload.message_id)
        .first()
    )
    if existing:
        if existing.reaction == payload.reaction:
            # Same reaction sent again — deselect (delete)
            db.delete(existing)
            db.commit()
            return {"message": "Reaction removed."}
        else:
            # Different reaction — update
            existing.reaction = payload.reaction
            db.commit()
            db.refresh(existing)
            return {"message": "Reaction updated."}

    reaction = InteractionReaction(
        interaction_id=payload.interaction_id,
        session_id=payload.session_id,
        bot_id=payload.bot_id,
        reaction=payload.reaction,
        message_id = payload.message_id
    )
    db.add(reaction)
    db.commit()
    db.refresh(reaction)
    return {"message": "Reaction recorded successfully"}

def send_bot_activation_email(user_name: str, user_email: str, bot_name: str):
    print("user send_bot_activation_email")
    subject = "Your chatbot has been activated!"
    body = f"""
    <html>
    <body style="font-family: Arial, sans-serif; color: #000;">
        <p>Hello {user_name},</p>

        <p>Your chatbot "{bot_name}" is now active and ready to use.</p>

        <p>You can customize it further by selecting the bot from the homepage if needed.</p>

        <p>Best regards,<br>
        Evolra Admin</p>
    </body>
    </html>
    """
    send_email(user_email, subject, body)
