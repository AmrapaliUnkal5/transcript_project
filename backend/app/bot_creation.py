from fastapi import FastAPI, Depends, HTTPException, APIRouter, Request
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Bot, UserSubscription, SubscriptionPlan
from app.schemas import BotCreation, UserOut, BotRename
from app.dependency import get_current_user
from app.utils.logger import get_module_logger
from datetime import datetime, timedelta

# Initialize logger
logger = get_module_logger(__name__)

router = APIRouter()

@router.post("/create-bot")
def create_bot(request: Request, bot: BotCreation, db: Session = Depends(get_db), current_user: UserOut = Depends(get_current_user)):
    request_id = getattr(request.state, "request_id", "unknown")
    
    # Safely extract user_id
    if isinstance(current_user, dict):  # If current_user is a dictionary
        user_id = current_user.get("user_id")
    else:  
        user_id = getattr(current_user, "user_id", None)

    logger.info(f"Creating new bot", 
               extra={"request_id": request_id, "user_id": user_id, 
                     "bot_name": bot.bot_name})

    if not user_id:
        logger.warning(f"User not authenticated for bot creation", 
                      extra={"request_id": request_id})
        raise HTTPException(status_code=400, detail="User not authenticated")

    # Check if a bot with the same name already exists for the given user_id
    existing_bot = db.query(Bot).filter(Bot.user_id == user_id, func.lower(Bot.bot_name) == bot.bot_name.lower(),Bot.status !="Deleted").first()
    if existing_bot:
        logger.warning(f"Bot with same name already exists", 
                      extra={"request_id": request_id, "user_id": user_id, 
                            "bot_name": bot.bot_name, "existing_bot_id": existing_bot.bot_id})
        raise HTTPException(status_code=400, detail="A bot with this name already exists for the user")

    # Check if user has any existing bots (excluding deleted ones)
    user_has_existing_bots = db.query(Bot).filter(Bot.user_id == user_id, Bot.status != "Deleted").first() is not None
    
    # Check if user has any active subscription
    user_has_subscription = db.query(UserSubscription).filter(
        UserSubscription.user_id == user_id,
        UserSubscription.status == "active"
    ).first() is not None
    
    # If user doesn't have an active subscription and this is their first bot,
    # create a free plan subscription for them
    if not user_has_subscription and not user_has_existing_bots:
        logger.info(f"User has no subscription and creating first bot, adding free plan", 
                    extra={"request_id": request_id, "user_id": user_id})
        
        # Get the free plan (Explorer Plan) from subscription_plans
        free_plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.name == "Explorer Plan").first()
        
        if not free_plan:
            # Fallback to plan ID 1 if plan by name not found
            free_plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == 1).first()
            
        if free_plan:
            # Create a new subscription for the free plan
            subscription = UserSubscription(
                user_id=user_id,
                subscription_plan_id=free_plan.id,
                amount=0.00,
                currency="USD",
                payment_date=datetime.now(),
                expiry_date=datetime.now() + timedelta(days=30),
                status="active",
                auto_renew=False
            )
            
            db.add(subscription)
            db.commit()
            logger.info(f"Created free plan subscription for user", 
                        extra={"request_id": request_id, "user_id": user_id, 
                              "plan_id": free_plan.id, "plan_name": free_plan.name})

    try:
        # Create a new bot
        db_bot = Bot(
            bot_name=bot.bot_name,
            status=bot.status,
            is_active=bot.is_active,
            user_id=user_id,
            word_count=0,
            external_knowledge=bot.external_knowledge
        )

        db.add(db_bot)
        db.commit()
        db.refresh(db_bot)
        
        logger.info(f"Bot created successfully", 
                   extra={"request_id": request_id, "user_id": user_id, 
                         "bot_id": db_bot.bot_id, "bot_name": bot.bot_name})

        return {
            "success": True,
            "bot_id": db_bot.bot_id,
            "external_knowledge": db_bot.external_knowledge,  
            "message": "Bot created successfully"
        }
    except Exception as e:
        logger.exception(f"Error creating bot", 
                        extra={"request_id": request_id, "user_id": user_id, 
                              "bot_name": bot.bot_name, "error": str(e)})
        raise HTTPException(status_code=500, detail=f"Error creating bot: {str(e)}")


@router.put("/update-bot-name/{bot_id}")
def update_bot_name(
    request: Request,
    bot_id: int,
    bot_update: BotRename,
    db: Session = Depends(get_db),
    current_user: UserOut = Depends(get_current_user)
):
    request_id = getattr(request.state, "request_id", "unknown")
    
    logger.info(f"Updating bot name", 
               extra={"request_id": request_id, "bot_id": bot_id, 
                     "new_name": bot_update.bot_name})

    # Safely extract user_id
    if isinstance(current_user, dict):  
        user_id = current_user.get("user_id")
    else:  
        user_id = getattr(current_user, "user_id", None)

    if not user_id:
        logger.warning(f"User not authenticated for bot update", 
                      extra={"request_id": request_id, "bot_id": bot_id})
        raise HTTPException(status_code=400, detail="User not authenticated")

    try:
        # Fetch the bot from the database
        db_bot = db.query(Bot).filter(Bot.bot_id == bot_id, Bot.user_id == user_id).first()
        if not db_bot:
            logger.warning(f"Bot not found for update", 
                          extra={"request_id": request_id, "bot_id": bot_id, 
                                "user_id": user_id})
            raise HTTPException(status_code=404, detail="Bot not found")

        # Check if the new bot name already exists for the user
        existing_bot = db.query(Bot).filter(
            Bot.user_id == user_id,
            func.lower(Bot.bot_name) == bot_update.bot_name.lower(),
            Bot.status !="Deleted",
            Bot.bot_id != bot_id  # Exclude the current bot
        ).first()
        if existing_bot:
            logger.warning(f"New bot name already exists", 
                          extra={"request_id": request_id, "user_id": user_id, 
                                "new_name": bot_update.bot_name, 
                                "existing_bot_id": existing_bot.bot_id})
            raise HTTPException(status_code=400, detail="A bot with this name already exists for the user")

        # Store old name for logging
        old_name = db_bot.bot_name
        
        # Update the bot name
        db_bot.bot_name = bot_update.bot_name
        db.commit()
        db.refresh(db_bot)
        
        logger.info(f"Bot name updated successfully", 
                   extra={"request_id": request_id, "bot_id": bot_id, 
                         "user_id": user_id, "old_name": old_name, 
                         "new_name": bot_update.bot_name})

        return {
            "success": True,
            "bot_id": db_bot.bot_id,
            "message": "Bot name updated successfully"
        }
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        
        logger.exception(f"Error updating bot name", 
                        extra={"request_id": request_id, "bot_id": bot_id, 
                              "user_id": user_id, "error": str(e)})
        raise HTTPException(status_code=500, detail=f"Error updating bot name: {str(e)}")

@router.get("/get-bot-external-knowledge/{bot_id}")
def get_bot_external_knowledge(
    bot_id: int,
    db: Session = Depends(get_db),
    current_user: UserOut = Depends(get_current_user)
):
    # Safely extract user_id
    if isinstance(current_user, dict):
        user_id = current_user.get("user_id")
    else:
        user_id = getattr(current_user, "user_id", None)

    logger.info(f"Fetching external knowledge status for bot", 
               extra={"bot_id": bot_id, "user_id": user_id})

    if not user_id:
        logger.warning(f"User not authenticated")
        raise HTTPException(status_code=401, detail="User not authenticated")

    try:
        # Get the bot and verify ownership
        bot = db.query(Bot).filter(
            Bot.bot_id == bot_id,
            Bot.user_id == user_id,
            Bot.status != "Deleted"
        ).first()

        if not bot:
            logger.warning(f"Bot not found or not owned by user", 
                          extra={"bot_id": bot_id, "user_id": user_id})
            raise HTTPException(status_code=404, detail="Bot not found")

        return {
            "success": True,
            "bot_id": bot.bot_id,
            "external_knowledge": bot.external_knowledge,
            "message": "External knowledge status retrieved successfully"
        }

    except Exception as e:
        logger.exception(f"Error fetching external knowledge status", 
                        extra={"bot_id": bot_id, "user_id": user_id, "error": str(e)})
        raise HTTPException(status_code=500, detail=f"Error fetching external knowledge status: {str(e)}")


@router.put("/update-bot-external-knowledge/{bot_id}")
def update_bot_external_knowledge(
    bot_id: int,
    db: Session = Depends(get_db),
    current_user: UserOut = Depends(get_current_user)
):
    # Safely extract user_id
    if isinstance(current_user, dict):
        user_id = current_user.get("user_id")
    else:
        user_id = getattr(current_user, "user_id", None)

    logger.info(f"Toggling external knowledge for bot", 
               extra={"bot_id": bot_id, "user_id": user_id})

    if not user_id:
        logger.warning(f"User not authenticated")
        raise HTTPException(status_code=401, detail="User not authenticated")

    try:
        # Get the bot and verify ownership
        bot = db.query(Bot).filter(
            Bot.bot_id == bot_id,
            Bot.user_id == user_id,
            Bot.status != "Deleted"
        ).first()

        if not bot:
            logger.warning(f"Bot not found or not owned by user", 
                          extra={"bot_id": bot_id, "user_id": user_id})
            raise HTTPException(status_code=404, detail="Bot not found")

        # Toggle the external_knowledge value
        bot.external_knowledge = not bot.external_knowledge
        db.commit()
        db.refresh(bot)

        logger.info(f"External knowledge status toggled successfully", 
                   extra={"bot_id": bot_id, "user_id": user_id, "new_status": bot.external_knowledge})

        return {
            "success": True,
            "bot_id": bot.bot_id,
            "external_knowledge": bot.external_knowledge,
            "message": "External knowledge status updated successfully"
        }

    except Exception as e:
        logger.exception(f"Error toggling external knowledge", 
                        extra={"bot_id": bot_id, "user_id": user_id, "error": str(e)})
        raise HTTPException(status_code=500, detail=f"Error toggling external knowledge: {str(e)}")