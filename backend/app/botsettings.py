from fastapi import APIRouter, Depends, HTTPException,UploadFile, File,Request, Form
from sqlalchemy.orm import Session
from app.database import get_db
from app import crud
from app import schemas
import os
from fastapi.responses import JSONResponse
import shutil
from app.config import settings
from app.schemas import  BotThemeUpdate, BotUpdateStatus, ReactionCreate
from app.models import Bot, User, InteractionReaction, Notification
from datetime import datetime
from app.utils.reembedding_utils import reembed_all_files
from app.dependency import get_current_user
from datetime import datetime, timezone
from app.notifications import add_notification
from app import models
from .utils.email_helper import send_email
from app.utils.file_storage import save_file, get_file_url, FileStorageError,resolve_file_url
import hashlib
import boto3

router = APIRouter(prefix="/botsettings", tags=["Bot Settings"])

# Use environment variable-based path
UPLOAD_DIR = settings.UPLOAD_BOT_DIR  # Directory to save uploaded images
if not UPLOAD_DIR.startswith("s3://"):
    os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.get("/bot/{bot_id}", response_model=schemas.BotResponse)
def get_bot_settings(bot_id: int, db: Session = Depends(get_db)):
    """Fetch bot settings by bot_id"""
    bot = crud.get_bot_by_id(db, bot_id)
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")
    if bot.bot_icon:
        bot.bot_icon = resolve_file_url(bot.bot_icon)
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
async def upload_bot_icon(bot_id: int = Form(...),file: UploadFile = File(...), db: Session = Depends(get_db)):
    try:
        # Read file content
        file_content = await file.read()

         # Generate a SHA-256 hash from the content
        hash_digest = hashlib.sha256(file_content).hexdigest()

        # Get original extension (e.g., .png, .jpg)
        _, ext = os.path.splitext(file.filename)
        new_filename = f"{hash_digest}{ext}"
        
        # Save file using the new helper function
        saved_path = save_file(UPLOAD_DIR, new_filename, file_content)
        
        # Generate file URL
        file_url = get_file_url(UPLOAD_DIR, new_filename, settings.SERVER_URL)

        bot = db.query(Bot).filter(Bot.bot_id == bot_id).first()
        if not bot:
            raise HTTPException(status_code=404, detail="Bot not found")

        bot.bot_icon = file_url
        db.commit()
        db.refresh(bot)

        if file_url.startswith('s3://'):
            resolved_url = resolve_file_url(file_url)
            return JSONResponse(content={"url": resolved_url})
        
        return JSONResponse(content={"url": file_url})
    
    except FileStorageError as e:
        raise HTTPException(status_code=500, detail=f"File storage error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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


@router.put("/theme/{bot_id}")
async def update_theme(
    bot_id: int,
    theme: schemas.BotThemeUpdate,
    db: Session = Depends(get_db)
):
    """
    Simple endpoint to update a bot's theme
    Example: PUT /botsettings/theme/1 with body {"theme_id": "ocean"}
    """
    # Get the bot
    bot = db.query(models.Bot).filter(models.Bot.bot_id == bot_id).first()
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")
    
    # Update the theme
    bot.theme_id = theme.theme_id
    
    # Save to database
    db.commit()
    
    return {"message": f"Theme updated to {theme.theme_id}", "bot_id": bot_id}

@router.get("/theme/{bot_id}")
async def get_theme(
    bot_id: int,
    db: Session = Depends(get_db)
):
    bot = db.query(models.Bot).filter(models.Bot.bot_id == bot_id).first()
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")
    
    return {"theme_id": bot.theme_id or "default"}