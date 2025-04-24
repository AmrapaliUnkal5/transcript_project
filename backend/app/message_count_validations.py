from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.dependency import get_current_user
from app.models import Bot, User, SubscriptionPlan

router = APIRouter()


@router.get("/user/msgusage")
async def get_user_msgusage(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        # Get the total message count from all bots (including deleted/inactive ones)
        total_msg_used = db.query(func.sum(Bot.message_count)).filter(
            Bot.user_id == current_user["user_id"],
            #Bot.status != "Deleted",
            #Bot.is_active == True
        ).scalar() or 0

        # Get user record
        user = db.query(User).filter(User.user_id == current_user["user_id"]).first()
        user_msg_total = user.total_message_count if user else 0

        # Update user.total_message_count if needed
        if user and total_msg_used != user_msg_total:
            user.total_message_count = total_msg_used
            db.commit()

        # Fetch plan details from DB using the subscription_plan_id
        plan = db.query(SubscriptionPlan).filter(
            SubscriptionPlan.id == current_user["subscription_plan_id"]
        ).first()

        print("plan=>",plan)

        if not plan:
            raise HTTPException(status_code=404, detail="Subscription plan not found")

        message_limit = plan.message_limit or 0

        return {
            "totalMessagesUsed": total_msg_used,
            "remainingMessages": max(message_limit - total_msg_used, 0),
            "planLimit": message_limit,
            "botMessageCount": total_msg_used,
            "userMessageCount": user_msg_total
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error fetching message usage: {str(e)}")