from fastapi import FastAPI, Depends, APIRouter
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import InteractionReaction, ReactionType, Interaction
from app.schemas import ReactionResponse
from sqlalchemy.sql import func
from sqlalchemy import text

router = APIRouter()

@router.get("/bot/{bot_id}/metrics")
def get_bot_metrics(bot_id: int, db: Session = Depends(get_db)):
    """Fetches bot reactions and average time spent per day in a single API call."""

   

    # ✅ Count reactions (likes, dislikes, neutral)
    likes = db.query(InteractionReaction).filter(
        InteractionReaction.bot_id == bot_id,
        InteractionReaction.reaction == ReactionType.LIKE.value
    ).count()

     # ✅ Count total interactions
    total_interactions = db.query(InteractionReaction).filter(
        InteractionReaction.bot_id == bot_id
    ).count()

    dislikes = db.query(InteractionReaction).filter(
        InteractionReaction.bot_id == bot_id,
        InteractionReaction.reaction == ReactionType.DISLIKE.value
    ).count()

    # neutral = db.query(InteractionReaction).filter(
    #     InteractionReaction.bot_id == bot_id,
    #     InteractionReaction.reaction == ReactionType.NEUTRAL.value
    # ).count()

        # Calculate neutral dynamically (assumed when no like/dislike is given)
    neutral = total_interactions - (likes + dislikes)

    # If no interactions at all, show 100% neutral
    if total_interactions == 0:
        neutral = 100  # Ensures the frontend gets 100% neutral when no data exists

    # Calculate average time spent per day
    interaction_data = (
        db.query(
            func.date_trunc('day', Interaction.start_time).label("day"),
            func.sum(func.extract('epoch', Interaction.end_time - Interaction.start_time)).label("total_time_seconds"),
            func.count(Interaction.session_id.distinct()).label("unique_sessions")  # Count unique sessions
        )
        .filter(
            Interaction.bot_id == bot_id,  # ✅ Filter by bot_id
            Interaction.end_time.isnot(None),  # ✅ Only consider completed interactions
            Interaction.start_time >= func.date_trunc('day', func.now()) - text("interval '6 days'")
        )
        .group_by(func.date_trunc('day', Interaction.start_time))
        .order_by(func.date_trunc('day', Interaction.start_time))
        .all()
    )

    # ✅ Process data for frontend
    average_time_spent = [
        {
            "day": row.day.strftime("%A"),  # Convert date to weekday name
            "average_time_spent": round((row.total_time_seconds / 60) / row.unique_sessions, 2) if row.unique_sessions else 0
        }
        for row in interaction_data
    ]

    return {
        "bot_id": bot_id,
        "reactions": {
            "likes": likes,
            "dislikes": dislikes,
            "neutral": neutral
        },
        "average_time_spent": average_time_spent
    }