from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependency import get_current_user
from app.models import User, Addon, UserAddon
from app.schemas import AddonSchema, UserAddonOut, PurchaseAddonRequest, CancelAddonRequest
from app.addon_service import AddonService
from typing import List, Dict
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/addons", tags=["Add-ons"])

# Get all available add-ons
@router.get("/", response_model=List[AddonSchema])
async def get_addons(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all available add-ons"""
    return db.query(Addon).all()

# Get user's purchased add-ons
@router.get("/user", response_model=List[UserAddonOut])
async def get_user_addons(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all add-ons purchased by the current user"""
    user_addons = (
        db.query(UserAddon)
        .filter(UserAddon.user_id == current_user.user_id)
        .all()
    )
    
    return user_addons

# Purchase an add-on
@router.post("/purchase", response_model=UserAddonOut)
async def purchase_addon(
    request: PurchaseAddonRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Purchase an add-on for the current user"""
    try:
        user_addon = AddonService.purchase_addon(
            db=db,
            user_id=current_user.user_id,
            addon_id=request.addon_id
        )
        return user_addon
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error purchasing add-on: {str(e)}")
        raise HTTPException(status_code=500, detail="An error occurred while processing the add-on purchase")

# Cancel an add-on
@router.post("/cancel", response_model=UserAddonOut)
async def cancel_addon(
    request: CancelAddonRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Cancel a purchased add-on"""
    try:
        # Ensure the user owns this add-on
        user_addon = db.query(UserAddon).filter(
            UserAddon.id == request.user_addon_id,
            UserAddon.user_id == current_user.user_id
        ).first()
        
        if not user_addon:
            raise HTTPException(status_code=404, detail="Add-on not found or does not belong to you")
        
        updated_addon = AddonService.cancel_addon(
            db=db,
            user_addon_id=request.user_addon_id
        )
        return updated_addon
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error cancelling add-on: {str(e)}")
        raise HTTPException(status_code=500, detail="An error occurred while processing the add-on cancellation")

# Check features access
@router.get("/features", response_model=Dict[str, bool])
async def check_features_access(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Check which add-on features the user has access to"""
    return AddonService.check_features_access(db=db, user_id=current_user.user_id)

# Admin endpoint to manually check and update expired add-ons
@router.post("/check-expired", status_code=200)
async def check_expired_addons(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Admin endpoint to manually trigger checking and updating expired add-ons"""
    # Ensure user is an admin
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Run in background to avoid blocking the request
    background_tasks.add_task(AddonService.check_expired_addons)
    
    return {"message": "Background task to check expired add-ons has been initiated"}