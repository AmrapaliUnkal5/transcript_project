from fastapi import APIRouter, Depends, HTTPException,BackgroundTasks
from sqlalchemy import or_
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session
from app.database import SessionLocal, get_db
from app.models import Addon, User, UserAddon
from typing import List, Optional
from datetime import datetime
import logging
from pydantic import BaseModel
from app.schemas import UserAddonOut, AddonSchema
from app.dependency import get_current_user
import os

class AddonUsageRequest(BaseModel):
    addon_id: int
    messages_used: int

logger = logging.getLogger(__name__)

# Create a router for addons
router = APIRouter(prefix="/subscriptionaddons", tags=["Subscription Addons"])

@router.get("/test")
def test_addon_router():
    logger.info("Test addon router endpoint called")
    return {"message": "Addon router is working!"}

@router.get("/", response_model=List[AddonSchema])
def get_subscription_addons(db: Session = Depends(get_db)):
    logger.info("Fetching subscription addons")
    try:
        addons = db.query(Addon).all()
        logger.info(f"Found {len(addons)} addons")
        return addons
    except Exception as e:
        logger.error(f"Error fetching addons: {str(e)}")
        raise 

@router.get("/user/{user_id}", response_model=List[UserAddonOut])
def get_user_addons(user_id: int, db: Session = Depends(get_db)):
    """
    Get all addons for a specific user, including addon details
    """
    logger.info(f"Fetching addons for user {user_id}")
    try:
        user_addons = (
            db.query(UserAddon)
            .join(Addon, UserAddon.addon_id == Addon.id)
            .filter(UserAddon.user_id == user_id)
            .all()
        )
        
        if not user_addons:
            logger.info(f"No addons found for user {user_id}")
            return []
            
        logger.info(f"Found {len(user_addons)} addons for user {user_id}")
        return user_addons
        
    except Exception as e:
        logger.error(f"Error fetching user addons: {str(e)}")
        raise HTTPException(status_code=500, detail="Error fetching user addons")   

@router.post("/record-usage")
async def record_addon_usage(
    request: AddonUsageRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Records addon usage by incrementing initial_count and checking against additional_message_limit.
    Moves to next addon when current one is full.
    """
    try:
        # Get all active message addons (ID 5) ordered by purchase date (oldest first)
        user_addons = db.query(UserAddon).join(Addon).filter(
            UserAddon.user_id == current_user["user_id"],
            #UserAddon.addon_id == 3,  # Message addon
            UserAddon.addon_id == (6 if os.getenv("PROFILE") == "dev" else 3),
            UserAddon.is_active == True,
            or_(
                UserAddon.expiry_date == None,
                UserAddon.expiry_date >= datetime.utcnow()
            )
        ).order_by(UserAddon.id.asc()).all()

        if not user_addons:
            raise HTTPException(404, "No active message addons found")

        # Check if we have capacity across all addons
        total_capacity = sum(addon.addon.additional_message_limit for addon in user_addons)
        total_used = sum(addon.initial_count for addon in user_addons)
        
        if total_used + request.messages_used > total_capacity:
            raise HTTPException(400, "Not enough capacity across all addons")

        # Process in background
        background_tasks.add_task(
            update_addon_usage_proper,
            db,
            current_user["user_id"],
            request.messages_used
        )

        return {"success": True}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error recording usage: {str(e)}")
        raise HTTPException(500, "Internal server error")

def update_addon_usage_proper(db: Session, user_id: int, messages_to_use: int):
    """Background task that properly increments initial_count and handles full addons
    """
    try:
        db = SessionLocal()  # Fresh session
        now = datetime.utcnow()
        
        # Lock addons for update
        addons = db.query(UserAddon).join(Addon).filter(
            UserAddon.user_id == user_id,
            #UserAddon.addon_id == 3,
            UserAddon.addon_id == (6 if os.getenv("PROFILE") == "dev" else 3),
            UserAddon.is_active == True,
            or_(
                UserAddon.expiry_date == None,
                UserAddon.expiry_date >= now
            )
        ).order_by(UserAddon.id.asc()).with_for_update().all()

        remaining = messages_to_use
        
        for addon in addons:
            if remaining <= 0:
                break
                
            available = addon.addon.additional_message_limit - addon.initial_count
            can_use = min(available, remaining)
            
            addon.initial_count += can_use
            remaining -= can_use
            
            # Check if addon is now full
            # if addon.initial_count >= addon.addon.additional_message_limit:
            #     addon.is_active = False
            #     addon.status = 'expired'
            #     addon.expiry_date = now  # Set expiry to current time
            #     addon.updated_at = now
            #     logger.info(f"Addon {addon.id} is now full and has been marked as expired")
            
        if remaining > 0:
            db.rollback()
            logger.error("Failed to use all messages - this shouldn't happen!")
            return

        db.commit()
        logger.info(f"Successfully recorded {messages_to_use} messages")

    except Exception as e:
        db.rollback()
        logger.error(f"Background task failed: {str(e)}")
    finally:
        db.close()