from sqlalchemy.orm import Session
from app.models import Bot, UserSubscription, SubscriptionPlan, EmbeddingModel, LLMModel
from typing import Optional, Tuple, Dict

def get_user_subscription_plan(db: Session, user_id: int) -> Optional[SubscriptionPlan]:
    """
    Get the user's active subscription plan.
    
    Args:
        db: Database session
        user_id: User ID
        
    Returns:
        SubscriptionPlan object or None if user has no active subscription
    """
    # Find active subscription for the user
    user_subscription = db.query(UserSubscription).filter(
        UserSubscription.user_id == user_id,
        UserSubscription.status == "active"
    ).order_by(UserSubscription.expiry_date.desc()).first()
    
    if not user_subscription:
        # Default to free plan (id=1) if no active subscription
        return db.query(SubscriptionPlan).filter(SubscriptionPlan.id == 1).first()
    
    # Return the subscription plan
    return db.query(SubscriptionPlan).filter(
        SubscriptionPlan.id == user_subscription.subscription_plan_id
    ).first()

def get_models_for_bot(
    db: Session, 
    bot_id: int, 
    user_id: int
) -> Dict[str, Optional[int]]:
    """
    Get embedding and LLM model IDs for a specific bot, taking into account:
    1. Bot-specific model settings (highest priority)
    2. User's subscription plan default models (fallback)
    3. System-wide defaults (lowest priority)
    
    Args:
        db: Database session
        bot_id: Bot ID
        user_id: User ID
        
    Returns:
        Dictionary with embedding_model_id and llm_model_id
    """
    # Initialize with None values
    embedding_model_id = None
    llm_model_id = None
    
    # Get bot information
    bot = db.query(Bot).filter(Bot.bot_id == bot_id).first()
    if not bot:
        raise ValueError(f"Bot with ID {bot_id} not found")
    
    # Check if bot has specific models assigned
    if bot.embedding_model_id:
        embedding_model_id = bot.embedding_model_id
    
    if bot.llm_model_id:
        llm_model_id = bot.llm_model_id
    
    # If either model is not set at bot level, check user's subscription plan
    if not (embedding_model_id and llm_model_id):
        subscription_plan = get_user_subscription_plan(db, user_id)
        
        if subscription_plan:
            # Use subscription plan defaults for any model not set at bot level
            if not embedding_model_id and subscription_plan.default_embedding_model_id:
                embedding_model_id = subscription_plan.default_embedding_model_id
                
            if not llm_model_id and subscription_plan.default_llm_model_id:
                llm_model_id = subscription_plan.default_llm_model_id
    
    # If still not set, use system-wide defaults (first active model of each type)
    if not embedding_model_id:
        default_embedding = db.query(EmbeddingModel).filter(EmbeddingModel.is_active == True).first()
        if default_embedding:
            embedding_model_id = default_embedding.id
    
    if not llm_model_id:
        default_llm = db.query(LLMModel).filter(LLMModel.is_active == True).first()
        if default_llm:
            llm_model_id = default_llm.id
    
    return {
        "embedding_model_id": embedding_model_id,
        "llm_model_id": llm_model_id
    }

def get_embedding_model_for_bot(db: Session, bot_id: int, user_id: int) -> Optional[EmbeddingModel]:
    """
    Get the embedding model for a specific bot, following the hierarchy:
    1. Bot-specific embedding model
    2. Subscription plan default embedding model
    3. System-wide default embedding model
    
    Args:
        db: Database session
        bot_id: Bot ID
        user_id: User ID
        
    Returns:
        EmbeddingModel object or None
    """
    model_ids = get_models_for_bot(db, bot_id, user_id)
    embedding_model_id = model_ids.get("embedding_model_id")
    
    if embedding_model_id:
        return db.query(EmbeddingModel).filter(EmbeddingModel.id == embedding_model_id).first()
    
    return None

def get_llm_model_for_bot(db: Session, bot_id: int, user_id: int) -> Optional[LLMModel]:
    """
    Get the LLM model for a specific bot, following the hierarchy:
    1. Bot-specific LLM model
    2. Subscription plan default LLM model
    3. System-wide default LLM model
    
    Args:
        db: Database session
        bot_id: Bot ID
        user_id: User ID
        
    Returns:
        LLMModel object or None
    """
    model_ids = get_models_for_bot(db, bot_id, user_id)
    llm_model_id = model_ids.get("llm_model_id")
    
    if llm_model_id:
        return db.query(LLMModel).filter(LLMModel.id == llm_model_id).first()
    
    return None 