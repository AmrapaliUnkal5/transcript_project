from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Addon
from typing import List, Optional
from datetime import datetime
import logging
from pydantic import BaseModel

logger = logging.getLogger(__name__)

class AddonSchema(BaseModel):
    id: int
    name: str
    price: float
    description: str
    addon_type: Optional[str] = None
    zoho_addon_id: Optional[str] = None
    zoho_addon_code: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

# Create a router for addons
router = APIRouter(prefix="/subscriptionaddons", tags=["Subscription Addons"])

@router.get("/test")
def test_addon_router():
    logger.info("Test addon router endpoint called")
    return {"message": "Addon router is working!"}

@router.get("/", response_model=List[AddonSchema])
def get_subscription_addons(db: Session = Depends(get_db)):
    logger.info("Fetching subscription addons")
    try:
        addons = db.query(Addon).all()
        logger.info(f"Found {len(addons)} addons")
        return addons
    except Exception as e:
        logger.error(f"Error fetching addons: {str(e)}")
        raise 