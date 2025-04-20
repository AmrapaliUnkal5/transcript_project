# app/bot_conversations.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models import User, Bot, Interaction,  ChatMessage, File #Rating,
from app.database import get_db
from app.dependency import get_current_user
from datetime import datetime, timedelta, timezone
from typing import List
from app.schemas import ConversationTrendResponse
from collections import defaultdict
import re

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
    # user = db.query(User).filter(User.email == current_user.get("email")).first()
    # if not user:
    #     raise HTTPException(status_code=404, detail="User not found")
    
    # user_id = user.user_id

    # # Query bots with LEFT OUTER JOINs to interactions and ratings.
    # # - conversation_count: count of interactions
    # # - avg_rating: average of Rating.rating
    # # - avg_responsetime: average of the seconds extracted from Interaction.timestamp
    # results = (
    #     db.query(
    #         Bot.bot_id,
    #         func.count(Interaction.interaction_id).label("conversation_count"),
    #         func.avg(Rating.rating).label("avg_rating"),
    #         func.avg(func.extract('second', Interaction.timestamp)).label("avg_responsetime")
    #     )
    #     .outerjoin(Interaction, Interaction.bot_id == Bot.bot_id)
    #     .outerjoin(Rating, Rating.interaction_id == Interaction.interaction_id)
    #     .filter(Bot.user_id == user_id)
    #     .group_by(Bot.bot_id)
    #     .all()
    # )

    output = []
    # for bot_id, conversation_count, avg_rating, avg_responsetime in results:
    #     output.append({
    #         "bot_id": bot_id,
    #         "Total Conversation": conversation_count,
    #         "rating": round(avg_rating, 2) if avg_rating is not None else None,
    #         "responsetime": round(avg_responsetime, 2) if avg_responsetime is not None else None
    #     })

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
    today = datetime.now(timezone.utc).date()
    start_date = datetime.combine(today - timedelta(days=6), datetime.min.time(), tzinfo=timezone.utc)
    end_date = datetime.combine(today + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc)

    date_list = [start_date + timedelta(days=i) for i in range(7)]
    date_map = {date.strftime("%Y-%m-%d"): date.strftime("%a") for date in date_list}

    query = (
        db.query(
            Interaction.bot_id,
            func.date_trunc('day', Interaction.start_time).label("day"),
            func.count(Interaction.interaction_id).label("conversations")
        )
        .filter(Interaction.start_time >= start_date, Interaction.start_time < end_date)
        .join(Bot, Interaction.bot_id == Bot.bot_id)
        .filter(Bot.user_id == user_id)
        .filter(Bot.status != "Deleted")
        .group_by(Interaction.bot_id, "day")
        .all()
    )

    bot_data = defaultdict(lambda: {date: 0 for date in date_map.keys()})

    for bot_id, day, count in query:
        formatted_date = day.strftime("%Y-%m-%d")
        bot_data[bot_id][formatted_date] = count

    response = []
    for bot_id, date_counts in bot_data.items():
        data = []
        for date_str in sorted(date_map.keys()):
            data.append({
                "day": date_map[date_str],
                "conversations": date_counts[date_str]
            })
        response.append({"bot_id": bot_id, "data": data})

    return response

@router.get("/usage-metrics")
def get_usage_metrics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        if not current_user:
            raise HTTPException(
                status_code=401,
                detail="Unauthorized user"
            )

        user_id = current_user["user_id"]

        # ✅ Fetch user from DB to get total_words_used
        user = db.query(User).filter(User.user_id == user_id).first()
        if not user:
            raise HTTPException(
                status_code=404,
                detail="User not found"
            )

        # 1. Total words used
        total_words_used = user.total_words_used or 0

        # 2. Total bots
        bots = db.query(Bot).filter(Bot.user_id == user_id, Bot.status != "Deleted").all()
        total_bots = len(bots)
        bot_ids = [bot.bot_id for bot in bots]

        # 3. Interaction IDs of the user
        interaction_ids = (db.query(Interaction.interaction_id)
                            .join(Bot, Bot.bot_id == Interaction.bot_id)
                            .filter(
                                Interaction.user_id == user_id,
                                Bot.status != "Deleted"
                            )
                        .all()
                        )
        interaction_ids = [id_[0] for id_ in interaction_ids]

        # 4. Chat messages by user
        chat_messages_used = 0
        if interaction_ids:
            chat_messages_used = db.query(ChatMessage)\
                .filter(ChatMessage.interaction_id.in_(interaction_ids))\
                .filter(ChatMessage.sender == "user")\
                .count()
            

        # 5. Total storage used (parse file sizes and sum up)
        total_bytes_used = 0
        if bot_ids:
            files = db.query(File).filter(File.bot_id.in_(bot_ids)).all()
            for file in files:
                total_bytes_used += convert_to_bytes(file.file_size)

        # Convert total_bytes_used to readable format
        def format_bytes(size):
            # Convert bytes into KB, MB, GB etc.
            for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
                if size < 1024:
                    return f"{size:.2f} {unit}"
                size /= 1024
            return f"{size:.2f} PB"

        total_storage_used = format_bytes(total_bytes_used)

        return {
            "total_words_used": total_words_used,
            "chat_messages_used": chat_messages_used,
            "total_bots": total_bots,
            "total_storage_used":total_storage_used
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Server error: {str(e)}"
        )
    


def convert_to_bytes(size_str):
    """
    Converts a file size string like '19.44 KB', '2 MB', '1.5 GB' to bytes.
    """
    if not size_str:
        return 0

    size_str = size_str.strip().upper()
    match = re.match(r"([\d\.]+)\s*(B|KB|MB|GB|TB)", size_str)

    if not match:
        return 0

    size, unit = match.groups()
    size = float(size)

    unit_multipliers = {
        "B": 1,
        "KB": 1024,
        "MB": 1024**2,
        "GB": 1024**3,
        "TB": 1024**4,
    }

    return int(size * unit_multipliers.get(unit, 0))