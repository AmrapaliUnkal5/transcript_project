from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends,Query
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
        # Get the total message count from all bots
        total_msg_used = db.query(func.sum(Bot.message_count)).filter(
            Bot.user_id == current_user["user_id"]
        ).scalar() or 0

        # Update user's total_message_count if different
        user = db.query(User).filter(User.user_id == current_user["user_id"]).first()
        if user and total_msg_used != user.total_message_count:
            user.total_message_count = total_msg_used
            db.commit()

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
            Addon.id == 3,  # Additional Messages addon
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
        effective_remaining = max(0, (base_message_limit + additional_messages) - total_msg_used)

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
    
@router.get("/api/usage/messages/check")
def check_message_limit(
    user_id: int = Query(..., description="User ID from frontend"),
    db: Session = Depends(get_db),
):
    try:
        # Get the user
        user = db.query(User).filter(User.user_id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        # Get user's active subscription
        user_sub = db.query(UserSubscription).filter(
            UserSubscription.user_id == user_id,
            UserSubscription.status == 'active'
        ).order_by(UserSubscription.payment_date.desc()).first()

        # Get plan limits
        if user_sub:
            plan = db.query(SubscriptionPlan).filter(
                SubscriptionPlan.id == user_sub.subscription_plan_id
            ).first()
            base_limit = plan.message_limit if plan else 100
        else:
            base_limit = 100  # Free plan default

        # Calculate total available messages (base + addons)
        total_limit = base_limit
        message_addons = db.query(UserAddon).join(Addon).filter(
            UserAddon.user_id == user_id,
            UserAddon.is_active == True,
            Addon.id == 3,
            or_(
                UserAddon.expiry_date == None,
                UserAddon.expiry_date >= datetime.utcnow()
            )
        ).all()

        for addon in message_addons:
            total_limit += addon.addon.additional_message_limit

        # Check usage
        total_used = user.total_message_count or 0
        can_send = total_used < total_limit

        return {
            "canSendMessage": can_send,
            "message": "Message limit reached" if not can_send else "",
            "total_used": total_used,
            "total_limit": total_limit,
            "remaining": max(0, total_limit - total_used)
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error checking message limit: {str(e)}")