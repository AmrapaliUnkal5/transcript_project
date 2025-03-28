from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Dict
from app.database import get_db
from app.models import Bot, Interaction
from app.schemas import UserOut
from app.dependency import get_current_user
from sqlalchemy import func

router = APIRouter()

@router.get("/weekly-conversations")
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

    # Get the start and end of the current week
    today = datetime.today()
    start_of_week = today - timedelta(days=today.weekday())  # Monday of this week
    end_of_week = start_of_week + timedelta(days=6)  # Sunday of this week

    # Query to get daily interaction counts for the bot within the current week
    daily_counts = (
        db.query(
            func.to_char(Interaction.start_time, 'Dy').label('day'),  # Extract abbreviated day name (e.g., Mon)
            func.count(Interaction.interaction_id).label('interaction_count')
        )
        .filter(Interaction.bot_id == bot_id)
        .filter(Interaction.start_time >= start_of_week)
        .filter(Interaction.start_time <= end_of_week)
        .group_by(func.to_char(Interaction.start_time, 'Dy'))
        .all()
    )

    # Define the correct weekday abbreviations in order
    days_of_week = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    response = {day: 0 for day in days_of_week}  
    
    # Ensure consistent abbreviation mapping
    for day, count in daily_counts:
        response[day.strip()[:3]] = count  

    return response