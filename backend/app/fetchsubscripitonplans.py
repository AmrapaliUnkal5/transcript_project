from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db

from app.config import settings
from app.schemas import  SubscriptionPlanSchema
from app.models import SubscriptionPlan
from typing import List

router = APIRouter(prefix="/subscriptionplans", tags=["Subscription Plans"])

@router.get("/", response_model=List[SubscriptionPlanSchema])
def get_subscription_plans(db: Session = Depends(get_db)):
    return db.query(SubscriptionPlan).all()  # FastAPI auto-serializes response