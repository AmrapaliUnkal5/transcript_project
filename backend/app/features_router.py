from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependency import get_current_user, require_addon
from app.models import User
from typing import Dict, List
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/features", tags=["Premium Features"])

@router.get("/multilingual", response_model=Dict[str, str])
async def get_multilingual_features(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_addon("Multilingual"))  # This will check if user has the Multilingual add-on
):
    """
    Access multilingual features - requires the Multilingual add-on
    This endpoint demonstrates how to protect routes that require specific add-ons
    """
    return {
        "message": "You have access to multilingual features",
        "available_languages": "English, Spanish, French, German, Chinese, Japanese"
    }

@router.get("/whitelabel", response_model=Dict[str, bool])
async def get_whitelabel_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_addon("White Labelling"))  # This will check if user has the White Labelling add-on
):
    """
    Access white labelling settings - requires the White Labelling add-on
    This endpoint demonstrates how to protect routes that require specific add-ons
    """
    return {
        "message": "You have access to white labelling features",
        "can_remove_branding": True,
        "can_customize_colors": True,
        "can_add_custom_logo": True
    }

@router.get("/admin-users", response_model=Dict[str, int])
async def get_admin_users_limit(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_addon("Additional Admin"))  # This will check if user has the Additional Admin add-on
):
    """
    Get admin users limit - requires the Additional Admin add-on
    This endpoint demonstrates how to protect routes that require specific add-ons
    """
    return {
        "message": "You have access to additional admin users",
        "admin_users_limit": 5  # This would typically be dynamically determined
    }

@router.get("/additional-words", response_model=Dict[str, int])
async def get_additional_words_limit(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_addon("Additional Words"))  # This will check if user has the Additional Words add-on
):
    """
    Get additional words limit - requires the Additional Words add-on
    This endpoint demonstrates how to protect routes that require specific add-ons
    """
    return {
        "message": "You have access to additional words",
        "additional_words_limit": 50000  # This would typically be dynamically determined
    }

@router.get("/messages-quota", response_model=Dict[str, int])
async def get_messages_quota(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_addon("Additional Messages"))  # This will check if user has the Additional Messages add-on
):
    """
    Get additional messages quota - requires the Additional Messages add-on
    This endpoint demonstrates how to protect routes that require specific add-ons
    """
    return {
        "message": "You have access to additional messages",
        "messages_quota": 1000,  # This would typically be dynamically determined
        "messages_used": 250,    # This would typically be dynamically determined
        "messages_remaining": 750  # This would typically be dynamically determined
    } 