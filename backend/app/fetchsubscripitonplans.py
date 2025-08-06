from fastapi import APIRouter, Depends
from sqlalchemy import or_
from sqlalchemy.orm import Session
from app.database import get_db
from app.config import settings
from app.schemas import SubscriptionPlanSchema
from app.models import Addon, SubscriptionPlan, UserAddon
from typing import List
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

async def get_subscription_plan_by_id(plan_id: int, db: Session, user_id: int = None) -> dict:
    """Get subscription plan details by ID from database with addon calculations"""
    plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == plan_id).first()
    if not plan:
        return None
    
    result = {
        "id": plan.id,
        "name": plan.name,
        "word_count_limit": plan.word_count_limit,
        "storage_limit": plan.storage_limit,
        "file_size_limit_mb": plan.per_file_size_limit,
        "message_limit": plan.message_limit,
        # Include any other fields you need
    }
    
    # Calculate addon limits if user_id is provided
    if user_id:
        # Get ALL active addons for this user
        active_addons = db.query(Addon)\
            .join(UserAddon, Addon.id == UserAddon.addon_id)\
            .filter(
                UserAddon.user_id == user_id,
                UserAddon.is_active == True,
                or_(
                    UserAddon.expiry_date == None,
                    UserAddon.expiry_date >= datetime.utcnow()
                )
            ).all()
        
        total_additional_words = 0
        total_additional_messages = 0
        total_additional_admins = 0
        
        for addon in active_addons:
            total_additional_words += addon.additional_word_limit or 0
            total_additional_messages += addon.additional_message_limit or 0
            total_additional_admins += addon.additional_admin_users or 0
        
        result["addon_additional_words"] = total_additional_words
        result["addon_additional_messages"] = total_additional_messages
        result["addon_additional_admins"] = total_additional_admins
        result["effective_word_limit"] = (plan.word_count_limit or 0) + total_additional_words
        result["effective_message_limit"] = (plan.message_limit or 0) + total_additional_messages
        
    return result

def get_subscription_plan_by_id_sync(plan_id: int, db: Session, user_id: int = None) -> dict:
    """Get subscription plan details by ID from database with addon calculations"""
    print("get_subscription_plan_by_id_sync")
    plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == plan_id).first()
    if not plan:
        return None

    result = {
        "id": plan.id,
        "name": plan.name,
        "word_count_limit": plan.word_count_limit,
        "storage_limit": plan.storage_limit,
        "file_size_limit_mb": plan.per_file_size_limit,
        "message_limit": plan.message_limit,
    }

    if user_id:
        active_addons = db.query(Addon)\
            .join(UserAddon, Addon.id == UserAddon.addon_id)\
            .filter(
                UserAddon.user_id == user_id,
                UserAddon.is_active == True,
                or_(
                    UserAddon.expiry_date == None,
                    UserAddon.expiry_date >= datetime.utcnow()
                )
            ).all()

        total_additional_words = 0
        total_additional_messages = 0
        total_additional_admins = 0

        for addon in active_addons:
            total_additional_words += addon.additional_word_limit or 0
            total_additional_messages += addon.additional_message_limit or 0
            total_additional_admins += addon.additional_admin_users or 0

        result["addon_additional_words"] = total_additional_words
        result["addon_additional_messages"] = total_additional_messages
        result["addon_additional_admins"] = total_additional_admins
        result["effective_word_limit"] = (plan.word_count_limit or 0) + total_additional_words
        result["effective_message_limit"] = (plan.message_limit or 0) + total_additional_messages

    else:
        result["effective_word_limit"] = plan.word_count_limit
        result["effective_message_limit"] = plan.message_limit

    return result
    

router = APIRouter(prefix="/subscriptionplans", tags=["Subscription Plans"])

@router.get("/", response_model=List[SubscriptionPlanSchema])
def get_subscription_plans(db: Session = Depends(get_db)):
    logger.info("Fetching subscription plans")
    try:
        plans = db.query(SubscriptionPlan).all()
        logger.info(f"Found {len(plans)} plans")
        return plans
    except Exception as e:
        logger.error(f"Error fetching plans: {str(e)}")
        raise