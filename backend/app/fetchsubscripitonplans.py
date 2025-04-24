from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db

from app.config import settings
from app.schemas import SubscriptionPlanSchema
from app.models import SubscriptionPlan
from typing import List
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/subscriptionplans", tags=["Subscription Plans"])

@router.get("/", response_model=List[SubscriptionPlanSchema])
def get_subscription_plans(db: Session = Depends(get_db)):
    logger.info("Fetching subscription plans")
    try:
        plans = db.query(SubscriptionPlan).all()
        logger.info(f"Found {len(plans)} plans")
        return plans
    except Exception as e:
        logger.error(f"Error fetching plans: {str(e)}")
        raise