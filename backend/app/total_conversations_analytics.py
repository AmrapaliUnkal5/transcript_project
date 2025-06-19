from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Dict
from app.database import get_db
from app.models import Bot, Interaction, ChatMessage
from app.schemas import UserOut
from app.dependency import get_current_user
from sqlalchemy import func, Date, cast

router = APIRouter()

@router.get("/last-seven-days-conversations")
def get_weekly_conversations(
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

    # Calculate date range for last 7 days (including today)
    end_date = datetime.today()
    start_date = end_date - timedelta(days=6)  # Last 7 days including today

    # Query to get daily interaction counts for the bot within the last 7 days
    daily_user_msg_counts = (
        db.query(
            cast(Interaction.start_time, Date).label('date'),
            func.count(ChatMessage.message_id).label('user_message_count')
        )
        .join(ChatMessage, ChatMessage.interaction_id == Interaction.interaction_id)
        .filter(Interaction.bot_id == bot_id)
        .filter(Interaction.start_time >= start_date)
        .filter(Interaction.start_time <= end_date)
        .filter(ChatMessage.sender == "user")  # ✅ Only user messages
        .group_by(cast(Interaction.start_time, Date))
        .order_by(cast(Interaction.start_time, Date))
        .all()
    )
        # Create a dictionary of results by date
    date_counts = {str(record.date): record.user_message_count for record in daily_user_msg_counts}

    # Generate response for all dates in the range, including days with zero interactions
    response = {}
    current_date = start_date
    while current_date <= end_date:
        date_str = current_date.strftime('%Y-%m-%d')
        day_name = current_date.strftime('%a')  # Short day name (Mon, Tue, etc.)
        month_abbr = current_date.strftime('%b')  # Month abbreviation (Jan, Feb, etc.)
        day_number = current_date.day
        response[f"{day_name} {month_abbr} {day_number}"] = date_counts.get(date_str, 0)
        current_date += timedelta(days=1)

    return response