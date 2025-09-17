from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependency import get_current_user
from app.models import User, Addon, UserAddon
from app.schemas import AddonSchema, UserAddonOut, PurchaseAddonRequest, CancelAddonRequest, AddOnCheckoutResponse
from app.addon_service import AddonService
from typing import List, Dict, Any, Union, Optional
import logging
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/addons", tags=["Add-ons"])

# Get all available add-ons
@router.get("/", response_model=List[AddonSchema])
async def get_addons(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get all available add-ons"""
    return db.query(Addon).all()

# Get user's purchased add-ons
@router.get("/user", response_model=List[UserAddonOut])
async def get_user_addons(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get all add-ons purchased by the current user"""
    user_addons = (
        db.query(UserAddon)
        .filter(UserAddon.user_id == current_user["user_id"])
        .all()
    )
    
    return user_addons

# Purchase an add-on
@router.post("/purchase", response_model=List[UserAddonOut])
async def purchase_addon(
    request: PurchaseAddonRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Purchase an add-on for the current user"""
    try:
        user_addons = AddonService.purchase_addon(
            db=db,
            user_id=current_user["user_id"],
            addon_id=request.addon_id,
            quantity=request.quantity or 1
        )
        return user_addons
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error purchasing add-on: {str(e)}")
        raise HTTPException(status_code=500, detail="An error occurred while processing the add-on purchase")

# Checkout for standalone add-on purchase
@router.post("/checkout", response_model=AddOnCheckoutResponse)
async def addon_checkout(
    request: PurchaseAddonRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Generate a checkout URL for standalone add-on purchase"""
    try:
        logger.debug(f"Received request: {request}")
        # Get the add-on details
        addon = db.query(Addon).filter(Addon.id == request.addon_id).first()
        if not addon:
            raise HTTPException(status_code=404, detail=f"Add-on with ID {request.addon_id} not found")
            
        logger.debug(f"Add-on found: {addon}")
        logger.debug(f"Add-on details: {addon.name}, {addon.id}, {addon.addon_type}")
        logger.debug(f"Current user: {current_user['user_id']}")
        # Log information about the request
        logger.info(f"Creating checkout for add-on '{addon.name}' (ID: {addon.id}) for user {current_user['user_id']}")
        logger.info(f"Add-on type: {addon.addon_type}, Quantity: {request.quantity}")
        
        # Get the checkout URL for the standalone add-on
        checkout_url = AddonService.get_addon_checkout_url(
            db=db,
            user_id=current_user['user_id'],
            addon_id=request.addon_id,
            quantity=request.quantity
        )
        logger.debug(f"Checkout URL generated: {checkout_url}")
        return {"checkout_url": checkout_url}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating add-on checkout: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error creating add-on checkout: {str(e)}")

# Cancel an add-on
@router.post("/cancel", response_model=UserAddonOut)
async def cancel_addon(
    request: CancelAddonRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Cancel a purchased add-on"""
    try:
        # Ensure the user owns this add-on
        user_addon = db.query(UserAddon).filter(
            UserAddon.id == request.user_addon_id,
            UserAddon.user_id == current_user["user_id"]
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
    current_user: dict = Depends(get_current_user)
):
    """Check which add-on features the user has access to"""
    return AddonService.check_features_access(db=db, user_id=current_user["user_id"])

# Admin endpoint to manually check and update expired add-ons
@router.post("/check-expired", status_code=200)
async def check_expired_addons(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Admin endpoint to manually trigger checking and updating expired add-ons"""
    # Ensure user is an admin
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Run in background to avoid blocking the request
    background_tasks.add_task(AddonService.check_expired_addons)
    
    return {"message": "Background task to check expired add-ons has been initiated"}

# Add a new endpoint to get pending addons for a user
@router.get("/pending/{user_id}")
async def get_pending_addons(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: Union[dict, User] = Depends(get_current_user),
):
    """Get pending addon purchases for a user"""
    try:
        # Verify that the requested user_id matches the current user or is admin
        if isinstance(current_user, dict):
            requester_id = current_user.get("user_id")
            is_admin = current_user.get("role") == "admin"
        else:
            requester_id = current_user.user_id
            is_admin = current_user.role == "admin"
            
        if requester_id != user_id and not is_admin:
            raise HTTPException(status_code=403, detail="Not authorized to view this user's addon purchases")
            
        # Get pending addon purchases for this user
        pending_addons = db.query(UserAddon).filter(
            UserAddon.user_id == user_id,
            UserAddon.status == "pending"
        ).all()
        
        if not pending_addons:
            return {"pendingAddons": []}
            
        # Format the response
        pending_addon_data = []
        for pending_addon in pending_addons:
            addon = db.query(Addon).filter(Addon.id == pending_addon.addon_id).first()
            
            addon_data = {
                "id": pending_addon.id,
                "addon_id": pending_addon.addon_id,
                "user_id": pending_addon.user_id,
                "status": pending_addon.status,
                "created_at": pending_addon.created_at.isoformat() if pending_addon.created_at else None,
                "updated_at": pending_addon.updated_at.isoformat() if pending_addon.updated_at else None,
                "addon_name": addon.name if addon else None,
                "addon_price": addon.price if addon else None
            }
            
            pending_addon_data.append(addon_data)
            
        return {"pendingAddons": pending_addon_data}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting pending addons: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error getting pending addons: {str(e)}")

# Add endpoint to cancel a pending addon purchase
@router.post("/cancel-pending/{addon_id}")
async def cancel_pending_addon(
    addon_id: int,
    db: Session = Depends(get_db),
    current_user: Union[dict, User] = Depends(get_current_user),
):
    """Cancel a pending addon purchase"""
    try:
        # Find the pending addon purchase
        user_addon = db.query(UserAddon).filter(
            UserAddon.addon_id == addon_id,
            UserAddon.status == "pending"
        ).first()
        
        if not user_addon:
            raise HTTPException(status_code=404, detail="Pending addon purchase not found")
            
        # Verify that the addon purchase belongs to the current user or user is admin
        if isinstance(current_user, dict):
            requester_id = current_user.get("user_id")
            is_admin = current_user.get("role") == "admin"
        else:
            requester_id = current_user.user_id
            is_admin = current_user.role == "admin"
            
        if user_addon.user_id != requester_id and not is_admin:
            raise HTTPException(status_code=403, detail="Not authorized to cancel this addon purchase")
            
        # Mark the addon purchase as cancelled
        user_addon.status = "cancelled"
        user_addon.updated_at = datetime.now()
        
        db.commit()
        
        return {"success": True, "message": "Pending addon purchase cancelled"}
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error cancelling pending addon purchase: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error cancelling pending addon purchase: {str(e)}")

@router.get("/statusaddon/{user_id}")
def get_user_addon_status(user_id: int, db: Session = Depends(get_db)):
    """
    Return the latest active addon status for the given user_id.
    """
    # Get latest active addon for this user (order by purchase_date desc)
    latest_addon = (
        db.query(UserAddon)
        .filter(UserAddon.user_id == user_id)
        .order_by(UserAddon.purchase_date.desc())
        .first()
    )

    if not latest_addon:
        raise HTTPException(status_code=404, detail="No active addon found for this user")

    return {
        "status": latest_addon.status,              # e.g. "active", "pending", "failed"
        "addon_id": latest_addon.addon_id,
        "subscription_id": latest_addon.subscription_id,
        "purchase_date": latest_addon.purchase_date,
        "expiry_date": latest_addon.expiry_date,
        "remaining_count": latest_addon.remaining_count,
        "initial_count": latest_addon.initial_count,
    }