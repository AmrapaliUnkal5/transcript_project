from fastapi import FastAPI, Depends, APIRouter
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import InteractionReaction, ReactionType, Interaction, ChatMessage
from app.schemas import ReactionResponse
from sqlalchemy.sql import func
from sqlalchemy import text
from datetime import datetime, timedelta,timezone

router = APIRouter()

@router.get("/bot/{bot_id}/metrics")
def get_bot_metrics(bot_id: int, db: Session = Depends(get_db)):
    """Fetches bot reactions and average time spent per day in a single API call."""

    seven_days_ago = datetime.now() - timedelta(days=7)

    # Count reactions (likes, dislikes, neutral)
    likes = db.query(InteractionReaction).filter(
        InteractionReaction.bot_id == bot_id,
        InteractionReaction.reaction == ReactionType.LIKE.value,
        InteractionReaction.reaction_time >= seven_days_ago
    ).count()


    dislikes_qs = db.query(InteractionReaction).filter(
        InteractionReaction.bot_id == bot_id,
        InteractionReaction.reaction == ReactionType.DISLIKE.value,
        InteractionReaction.reaction_time >= seven_days_ago
    ).order_by(InteractionReaction.reaction_time.desc()).all()
    dislikes = len(dislikes_qs)

    # Get interaction IDs for the bot in the last 7 days
    interaction_ids_subq = db.query(Interaction.interaction_id).filter(
        Interaction.bot_id == bot_id,
        Interaction.start_time >= seven_days_ago
    ).subquery()

    # Get total bot messages in those interactions
    total_bot_messages = db.query(ChatMessage).filter(
        ChatMessage.sender == "bot",
        ChatMessage.interaction_id.in_(interaction_ids_subq)
    ).count()

    neutral = total_bot_messages - (likes + dislikes)

    # If no interactions at all, show 100% neutral
    if total_bot_messages == 0:
        neutral = 100  # Ensures the frontend gets 100% neutral when no data exists

    # ✅ Disliked Q&A
    disliked_qa = []
    for dislike in dislikes_qs:
        # Fetch disliked answer
        bot_msg = db.query(ChatMessage).filter(ChatMessage.message_id == dislike.message_id).first()

        # Get the question: previous message by user in the same interaction
        if bot_msg:
            question = (
                db.query(ChatMessage)
                .filter(
                    ChatMessage.interaction_id == bot_msg.interaction_id,
                    ChatMessage.timestamp < bot_msg.timestamp,
                    ChatMessage.sender == "user"
                )
                .order_by(ChatMessage.timestamp.desc())
                .first()
            )

            disliked_qa.append({
                "question": question.message_text if question else "Not found",
                "answer": bot_msg.message_text
            })

    # Calculate average time spent per day
    interaction_data = (
        db.query(
            func.date_trunc('day', Interaction.start_time).label("day"),
            func.sum(func.extract('epoch', Interaction.end_time - Interaction.start_time)).label("total_time_seconds"),
            func.count(Interaction.interaction_id).label("unique_interactions")  # Count unique interactions
        )
        .filter(
            Interaction.bot_id == bot_id,
            Interaction.end_time.isnot(None),  # Ignore interactions with NULL end_time
            Interaction.start_time >= func.date_trunc('day', func.now()) - text("interval '6 days'")
        )
        .group_by(func.date_trunc('day', Interaction.start_time))
        .order_by(func.date_trunc('day', Interaction.start_time))
        .all()
    )


    # Process data for frontend
    average_time_spent = [
        {
            "day": row.day.strftime("%A"),  # Convert date to weekday name
            "average_time_spent": round((row.total_time_seconds / 60) / row.unique_interactions) if row.unique_interactions else 0
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
        "average_time_spent": average_time_spent,
        "disliked_qa": disliked_qa
    }