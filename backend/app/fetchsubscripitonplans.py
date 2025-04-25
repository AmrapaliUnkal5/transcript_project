from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.config import settings
from app.schemas import  SubscriptionPlanSchema
from app.models import SubscriptionPlan
from typing import List


async def get_subscription_plan_by_id(plan_id: int, db: Session) -> dict:
    """Get subscription plan details by ID from database"""
    plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == plan_id).first()
    if not plan:
        return None
    return {
        "id": plan.id,
        "name": plan.name,
        "word_count_limit": plan.word_count_limit,
        "storage_limit":plan.storage_limit,
        "file_size_limit_mb": plan.per_file_size_limit,
        # Include any other fields you need
    }

router = APIRouter(prefix="/subscriptionplans", tags=["Subscription Plans"])

@router.get("/", response_model=List[SubscriptionPlanSchema])
def get_subscription_plans(db: Session = Depends(get_db)):
    return db.query(SubscriptionPlan).all()  # FastAPI auto-serializes response