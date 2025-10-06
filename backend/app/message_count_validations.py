from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends,Query, Request
from sqlalchemy.orm import Session
from datetime import datetime
from sqlalchemy import func, or_

from app.database import get_db
from app.dependency import get_current_user
from app.models import Addon, Bot, User, SubscriptionPlan, UserAddon, UserSubscription

router = APIRouter()

@router.get("/user/msgusage")
async def get_user_msgusage(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:

        # Get user with current total count
        user = db.query(User).filter(
            User.user_id == current_user["user_id"]
        ).first()
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        total_msg_used = user.total_message_count or 0
        print("total_msg_used=>", total_msg_used)

        # Get base plan limits
        user_subscription = db.query(UserSubscription).filter(
            UserSubscription.user_id == current_user["user_id"],
            UserSubscription.status == 'active'
        ).order_by(UserSubscription.payment_date.desc()).first()
        
        base_message_limit = 100  # Default free plan limit
        if user_subscription:
            plan = db.query(SubscriptionPlan).filter(
                SubscriptionPlan.id == user_subscription.subscription_plan_id
            ).first()
            if plan:
                base_message_limit = plan.message_limit

        # Initialize addon-related variables
        additional_messages = 0
        remaining_addon_messages = 0
        addon_used = 0
        addon_items = []
        
        # Get all active message addons (ID 3) for this user
        message_addons = db.query(UserAddon).join(Addon).filter(
            UserAddon.user_id == current_user["user_id"],
            UserAddon.is_active == True,
            #Addon.id == 3,
            Addon.id == 7,  # Additional Messages addon
            or_(
                UserAddon.expiry_date == None,
                UserAddon.expiry_date >= datetime.utcnow()
            )
        ).all()

        # Process addons if any exist
        if message_addons:  # This check prevents the "addon not defined" error
            for addon in message_addons:
                addon_limit = addon.addon.additional_message_limit
                used = addon.initial_count or 0
                remaining = max(0, addon_limit - used)
                
                additional_messages += addon_limit
                remaining_addon_messages += remaining
                addon_used += used
                
                addon_items.append({
                    "addon_id": addon.id,
                    "name": addon.addon.name,
                    "limit": addon_limit,
                    "remaining": remaining,
                    "used": used,
                })

        # Calculate how many messages were used from base plan
        base_used = min(total_msg_used, base_message_limit)
        
        # Calculate remaining messages
        base_remaining = max(base_message_limit - total_msg_used, 0)
        print("base_message_limit=>",base_message_limit)
        print("additional_messages=>",additional_messages)
        print("total_msg_used=>",total_msg_used)
        print("addon_used=>",addon_used )
        effective_remaining = max(0, (base_message_limit + additional_messages) - (total_msg_used+addon_used ))

        return {
            "total_messages_used": total_msg_used,
            "base_plan": {
                "limit": base_message_limit,
                "used": base_used,
                "remaining": base_remaining,
            },
            "addons": {
                "total_limit": additional_messages,
                "used": addon_used,
                "remaining": remaining_addon_messages,
                "items": addon_items
            },
            "effective_remaining": effective_remaining,
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error fetching message usage: {str(e)}")
    
@router.get("/addon/white-labeling-check")
def check_white_labeling_addon_chatbotcustomization(bot_id: int, db: Session = Depends(get_db)):
    try:

        bot = db.query(Bot).filter(Bot.bot_id == bot_id).first()
        
        if not bot:
            raise HTTPException(status_code=404, detail="Bot not found")
        
        user_id = bot.user_id
        # Check if the user has the White-Labeling addon
        white_label_addon = db.query(UserAddon).join(Addon).filter(
            UserAddon.user_id == user_id,
            Addon.id == 2,  #  2 for whte labeling
            UserAddon.is_active == True,
            or_(
                UserAddon.expiry_date == None,
                UserAddon.expiry_date >= datetime.utcnow()
            )
        ).first()

        if white_label_addon:
            return {"hasWhiteLabeling": True}
        else:
            return {"hasWhiteLabeling": False}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error checking White-Labeling addon: {str(e)}")    


# Check External Knowledge add-on for current user (no bot required)
@router.get("/addon/external-knowledge-check/user")
def check_external_knowledge_addon_for_user(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        user_id = current_user["user_id"]
        ek_addon = db.query(UserAddon).join(Addon).filter(
            UserAddon.user_id == user_id,
            Addon.id == 8,
            UserAddon.is_active == True,
            or_(
                UserAddon.expiry_date == None,
                UserAddon.expiry_date >= datetime.utcnow()
            )
        ).first()

        return {"hasExternalKnowledge": True if ek_addon else False}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error checking External Knowledge addon: {str(e)}")