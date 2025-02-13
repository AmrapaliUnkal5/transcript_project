# app/bot_conversations.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models import User, Bot, Interaction
from app.database import get_db
from app.dependency import get_current_user

router = APIRouter()

@router.get("/bots/conversations")
def get_all_bot_conversations(
    db: Session = Depends(get_db), 
    current_user: dict = Depends(get_current_user)
):
    """
    Returns a list of bots owned by the current user along with 
    their conversation (interaction) counts.
    
    Example response:
    [
      {"bot_id": 1, "Total Conversation": 5},
      {"bot_id": 2, "Total Conversation": 6}
    ]
    """
    # Retrieve full user record from DB using the email from the token.
    user = db.query(User).filter(User.email == current_user.get("email")).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user_id = user.user_id

    # Perform a LEFT OUTER JOIN from Bot to Interaction so that even bots with no interactions are included.
    bots_with_conversations = (
        db.query(
            Bot.bot_id,
            func.count(Interaction.interaction_id).label("conversation_count")
        )
        .outerjoin(Interaction, Interaction.bot_id == Bot.bot_id)
        .filter(Bot.user_id == user_id)
        .group_by(Bot.bot_id)
        .all()
    )

    # Format the response as a list of dictionaries.
    result = [
        {"bot_id": bot_id, "Total Conversation": conversation_count}
        for bot_id, conversation_count in bots_with_conversations
    ]
    return result


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
