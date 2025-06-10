from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from sqlalchemy import func, and_, or_
from app.database import get_db
from app.models import Bot, Interaction, ChatMessage, InteractionReaction, UserSubscription
from app.schemas import UserOut
from app.dependency import get_current_user

router = APIRouter()

@router.get("/current-billing-metrics")
def get_current_billing_metrics(
    bot_id: int,
    db: Session = Depends(get_db),
    current_user: UserOut = Depends(get_current_user)
):
    # Extract user_id
    if isinstance(current_user, dict):
        user_id = current_user.get("user_id")
    else:
        user_id = getattr(current_user, "user_id", None)

    if not user_id:
        raise HTTPException(status_code=400, detail="User not authenticated")

    # Check if bot exists for the user
    bot = db.query(Bot).filter(Bot.bot_id == bot_id, Bot.user_id == user_id).first()
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found for this user")

    # Get the current billing cycle dates for the user
    subscription = (
        db.query(UserSubscription)
        .filter(UserSubscription.user_id == user_id)
        .order_by(UserSubscription.payment_date.desc())
        .first()
    )

    if not subscription:
        raise HTTPException(
            status_code=400,
            detail="No subscription found for this user"
        )

    start_date = subscription.payment_date
    end_date = subscription.expiry_date

    # Calculate total sessions (interactions) within the billing cycle
    total_sessions = (
        db.query(func.count(Interaction.interaction_id))
        .filter(
            Interaction.bot_id == bot_id,
            Interaction.start_time >= start_date,
            Interaction.start_time <= end_date
        )
        .scalar() or 0
    )

    # Calculate total user messages within the billing cycle
    total_user_messages = (
        db.query(func.count(ChatMessage.message_id))
        .join(Interaction, Interaction.interaction_id == ChatMessage.interaction_id)
        .filter(
            Interaction.bot_id == bot_id,
            ChatMessage.sender == "user",
            ChatMessage.timestamp >= start_date,
            ChatMessage.timestamp <= end_date
        )
        .scalar() or 0
    )

    # Calculate total likes within the billing cycle
    total_likes = (
        db.query(func.count(InteractionReaction.id))
        .filter(
            InteractionReaction.bot_id == bot_id,
            InteractionReaction.reaction == "like",
            InteractionReaction.reaction_time >= start_date,
            InteractionReaction.reaction_time <= end_date
        )
        .scalar() or 0
    )

    # Calculate total dislikes within the billing cycle
    total_dislikes = (
        db.query(func.count(InteractionReaction.id))
        .filter(
            InteractionReaction.bot_id == bot_id,
            InteractionReaction.reaction == "dislike",
            InteractionReaction.reaction_time >= start_date,
            InteractionReaction.reaction_time <= end_date
        )
        .scalar() or 0
    )

    # Calculate total chat duration within the billing cycle (in seconds)
    total_duration_seconds = (
        db.query(
            func.sum(
                func.extract('epoch', Interaction.end_time) - 
                func.extract('epoch', Interaction.start_time)
            )
        )
        .filter(
            Interaction.bot_id == bot_id,
            Interaction.start_time >= start_date,
            Interaction.end_time <= end_date,
            Interaction.end_time.isnot(None)
        )
        .scalar() or 0
    )

    # Convert seconds to hours, minutes, seconds format
    hours, remainder = divmod(total_duration_seconds, 3600)
    minutes, seconds = divmod(remainder, 60)
    total_chat_duration = f"{int(hours)}h {int(minutes)}m {int(seconds)}s"

    # Count distinct session_ids
    unique_session_ids = (
        db.query(func.count(func.distinct(Interaction.session_id)))
        .filter(
            Interaction.bot_id == bot_id,
            Interaction.session_id.isnot(None),
            Interaction.start_time >= start_date,
            Interaction.start_time <= end_date
        )
        .scalar() or 0
    )

    return {
        "total_sessions": total_sessions,
        "total_user_messages": total_user_messages,
        "total_likes": total_likes,
        "total_dislikes": total_dislikes,
        "total_chat_duration": total_chat_duration,
        "billing_cycle_start": start_date,
        "billing_cycle_end": end_date,
        "unique_session_ids":unique_session_ids
    }