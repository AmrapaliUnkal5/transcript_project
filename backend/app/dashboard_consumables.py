# app/bot_conversations.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models import User, Bot, Interaction, Rating
from app.database import get_db
from app.dependency import get_current_user
from datetime import datetime, timedelta, timezone
from typing import List
from app.schemas import ConversationTrendResponse

router = APIRouter()

#All three display
@router.get("/dashboard_consumables")
def get_dashboard_consumables(
    db: Session = Depends(get_db), 
    current_user: dict = Depends(get_current_user)
):
    """
    Returns a list of bots owned by the logged-in user with the following details:
      - Total Conversation: Count of interactions
      - rating: Average rating from the ratings table (joined via interactions)
      - responsetime: Average of the seconds extracted from Interaction.timestamp
    
    Example response:
      [
        {"bot_id": 11, "Total Conversation": 4, "rating": 4, "responsetime": 4.5},
        {"bot_id": 12, "Total Conversation": 6, "rating": 3.5, "responsetime": 5}
      ]
    """
    # Retrieve the full user record using the email from the token.
    user = db.query(User).filter(User.email == current_user.get("email")).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user_id = user.user_id

    # Query bots with LEFT OUTER JOINs to interactions and ratings.
    # - conversation_count: count of interactions
    # - avg_rating: average of Rating.rating
    # - avg_responsetime: average of the seconds extracted from Interaction.timestamp
    results = (
        db.query(
            Bot.bot_id,
            func.count(Interaction.interaction_id).label("conversation_count"),
            func.avg(Rating.rating).label("avg_rating"),
            func.avg(func.extract('second', Interaction.timestamp)).label("avg_responsetime")
        )
        .outerjoin(Interaction, Interaction.bot_id == Bot.bot_id)
        .outerjoin(Rating, Rating.interaction_id == Interaction.interaction_id)
        .filter(Bot.user_id == user_id)
        .group_by(Bot.bot_id)
        .all()
    )

    output = []
    for bot_id, conversation_count, avg_rating, avg_responsetime in results:
        output.append({
            "bot_id": bot_id,
            "Total Conversation": conversation_count,
            "rating": round(avg_rating, 2) if avg_rating is not None else None,
            "responsetime": round(avg_responsetime, 2) if avg_responsetime is not None else None
        })

    return output


#displaying based on bot id

@router.get("/bot/{bot_id}/conversations")
def get_single_bot_conversation(
    bot_id: int, 
    db: Session = Depends(get_db), 
    current_user: dict = Depends(get_current_user)
):
    """
    Returns the conversation count for a specific bot (bot_id) 
    after verifying that the bot belongs to the logged-in user.
    
    Example response:
    {"bot_id": 1, "Total Conversation": 5}
    """
    # Retrieve full user record using the email from the token.
    user = db.query(User).filter(User.email == current_user.get("email")).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user_id = user.user_id

    # Verify that the specified bot belongs to the logged-in user.
    bot = db.query(Bot).filter(Bot.bot_id == bot_id, Bot.user_id == user_id).first()
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found for current user")

    # Count the number of interactions for this bot.
    conversation_count = (
        db.query(func.count(Interaction.interaction_id))
        .filter(Interaction.bot_id == bot_id)
        .scalar()
    )
    return {"bot_id": bot_id, "Total Conversation": conversation_count}

@router.get("/conversation-trends", response_model=List[ConversationTrendResponse])
def get_conversation_trends(user_id: int, db: Session = Depends(get_db)):
    """
    Fetches the count of conversations per bot for the last 7 days.
    """
    end_date = datetime.now(timezone.utc)
    start_date = end_date - timedelta(days=7)

    # Fetch conversation count per bot, per day
    query = (
        db.query(Interaction.bot_id, 
                 func.date_trunc('day', Interaction.start_time).label("day"),
                 func.count(Interaction.interaction_id).label("conversations"))
        .filter(Interaction.start_time >= start_date, Interaction.start_time <= end_date)
        .join(Bot, Interaction.bot_id == Bot.bot_id)
        .filter(Bot.user_id == user_id)  # Only fetch user's bots
        .filter(Bot.status != "Deleted")  # Exclude bots with status "deleted"
        .group_by(Interaction.bot_id, "day")
        .order_by("day")
        .all()
    )

    # Convert query result to the required response format
    trends = {}
    for bot_id, day, count in query:
        formatted_day = day.strftime("%a")  # Convert to "Mon", "Tue", etc.
        if bot_id not in trends:
            trends[bot_id] = []
        trends[bot_id].append({"day": formatted_day, "conversations": count})

    # Format response
    response = [
        {"bot_id": bot_id, "data": trend_data} for bot_id, trend_data in trends.items()
    ]
    
    return response
