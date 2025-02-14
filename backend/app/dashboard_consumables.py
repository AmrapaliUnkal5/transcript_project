# app/bot_conversations.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models import User, Bot, Interaction, Rating
from app.database import get_db
from app.dependency import get_current_user

router = APIRouter()

# @router.get("/bots/conversations")
# def get_all_bot_conversations(
#     db: Session = Depends(get_db), 
#     current_user: dict = Depends(get_current_user)
# ):
#     """
#     Returns a list of bots owned by the current user along with 
#     their conversation (interaction) counts.
    
#     Example response:
#     [
#       {"bot_id": 1, "Total Conversation": 5},
#       {"bot_id": 2, "Total Conversation": 6}
#     ]
#     """
#     # Retrieve full user record from DB using the email from the token.
#     user = db.query(User).filter(User.email == current_user.get("email")).first()
#     if not user:
#         raise HTTPException(status_code=404, detail="User not found")
    
#     user_id = user.user_id

#     # Perform a LEFT OUTER JOIN from Bot to Interaction so that even bots with no interactions are included.
#     bots_with_conversations = (
#         db.query(
#             Bot.bot_id,
#             func.count(Interaction.interaction_id).label("conversation_count")
#         )
#         .outerjoin(Interaction, Interaction.bot_id == Bot.bot_id)
#         .filter(Bot.user_id == user_id)
#         .group_by(Bot.bot_id)
#         .all()
#     )

#     # Format the response as a list of dictionaries.
#     result = [
#         {"bot_id": bot_id, "Total Conversation": conversation_count}
#         for bot_id, conversation_count in bots_with_conversations
#     ]
#     return result




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
    
    For example, if bot id 11 has 4 interactions with timestamps whose seconds values are 
    3, 4, 5, and 6, then responsetime will be (3+4+5+6)/4 = 4.5.
    
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

#total convo and avg rating

# # app/dashboard_consumables.py

# from fastapi import APIRouter, Depends, HTTPException
# from sqlalchemy.orm import Session
# from sqlalchemy import func
# from app.models import User, Bot, Interaction, Rating
# from app.database import get_db
# from app.dependency import get_current_user

# router = APIRouter()

# @router.get("/dashboard_consumables")
# def get_dashboard_consumables(
#     db: Session = Depends(get_db), 
#     current_user: dict = Depends(get_current_user)
# ):
#     """
#     Returns a list of bots owned by the logged-in user with the following details:
#       - Total Conversation: Count of interactions
#       - rating: Average rating from the ratings table (joined via interactions)
    
#     Example response:
#       [
#         {"bot_id": 11, "Total Conversation": 4, "rating": 4},
#         {"bot_id": 12, "Total Conversation": 6, "rating": 3.5}
#       ]
#     """
#     # Retrieve the full user record using the email from the token.
#     user = db.query(User).filter(User.email == current_user.get("email")).first()
#     if not user:
#         raise HTTPException(status_code=404, detail="User not found")
    
#     user_id = user.user_id

#     # Query bots with a LEFT OUTER JOIN to interactions and ratings.
#     # It calculates:
#     #   - Total Conversation: count of interactions
#     #   - rating: average of Rating.rating
#     results = (
#         db.query(
#             Bot.bot_id,
#             func.count(Interaction.interaction_id).label("conversation_count"),
#             func.avg(Rating.rating).label("avg_rating")
#         )
#         .outerjoin(Interaction, Interaction.bot_id == Bot.bot_id)
#         .outerjoin(Rating, Rating.interaction_id == Interaction.interaction_id)
#         .filter(Bot.user_id == user_id)
#         .group_by(Bot.bot_id)
#         .all()
#     )

#     output = []
#     for bot_id, conversation_count, avg_rating in results:
#         output.append({
#             "bot_id": bot_id,
#             "Total Conversation": conversation_count,
#             "rating": round(avg_rating, 2) if avg_rating is not None else None,
#         })

#     return output


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
