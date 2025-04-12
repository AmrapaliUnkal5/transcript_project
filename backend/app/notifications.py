
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Notification, User, Bot
from app.dependency import get_current_user
from app.schemas import NotificationOut
from typing import List, Optional
from datetime import datetime, timezone
import logging


router = APIRouter()

@router.get("/notifications", response_model=List[NotificationOut])  # Optional schema
def get_notifications(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Unauthorized user")

    try:
        user_id = current_user["user_id"]
        print("user_id",user_id)
        user = db.query(User).filter(User.user_id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        notifications = (
            db.query(Notification)
            .filter(Notification.user_id == user_id, Notification.is_read == False)
            .order_by(Notification.created_at.desc())
            .all()
        )
        return notifications

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching notifications: {str(e)}")
    
@router.post("/notifications/{notif_id}/mark-read")
def mark_notification_as_read(
    notif_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    notif = db.query(Notification).filter_by(id=notif_id, user_id=current_user["user_id"]).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")

    notif.is_read = True
    db.commit()
    return {"message": "Notification marked as read"}

@router.post("/notifications/mark-all-read")
def mark_all_notifications_as_read(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    db.query(Notification).filter_by(user_id=current_user["user_id"], is_read=False).update({"is_read": True})
    db.commit()
    return {"message": "All notifications marked as read"}
    
logger = logging.getLogger(__name__)

def add_notification(
    db: Session,
    event_type: str,
    event_data: str,
    bot_id: Optional[int] = None,
    user_id: Optional[int] = None,
    
):
    try:
        
        if bot_id:                      
            bot = db.query(Bot).filter(Bot.bot_id == bot_id).first()
            bot_name = bot.bot_name
            event_data = f"{bot_name}: {event_data}"
            user_id= bot.user_id
            if not bot:
                raise HTTPException(status_code=404, detail="Bot not found")
        notification = Notification(
            user_id= user_id,
            bot_id=bot_id,
            event_type=event_type,
            event_data=event_data,
            is_read=False,
            created_at=datetime.now(timezone.utc)
        )
        db.add(notification)
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to add notification: {e}")