from sqlalchemy.orm import Session
from app.models import UserAddon, Addon, UserSubscription, User
from app.schemas import UserAddonCreate, UserAddonUpdate
from datetime import datetime, timedelta
from typing import List, Optional, Dict
import logging

logger = logging.getLogger(__name__)

class AddonService:
    """
    Service for managing add-ons functionality including purchase, expiry, and feature access
    """
    
    @staticmethod
    def get_addon_details(db: Session, addon_id: int) -> Optional[Addon]:
        """Get details of a specific add-on"""
        return db.query(Addon).filter(Addon.id == addon_id).first()
    
    @staticmethod
    def check_addon_active(db: Session, user_id: int, addon_type: str) -> bool:
        """
        Check if a user has an active add-on of the specified type
        
        Args:
            db: Database session
            user_id: ID of the user
            addon_type: Type of add-on to check (e.g., "Multilingual", "White Labelling")
            
        Returns:
            True if user has an active addon of the specified type, False otherwise
        """
        current_time = datetime.now()
        
        # Check if the user has any active add-ons of the specified type
        addon_query = (
            db.query(UserAddon)
            .join(Addon, UserAddon.addon_id == Addon.id)
            .filter(
                UserAddon.user_id == user_id,
                Addon.addon_type == addon_type,
                UserAddon.is_active == True,
                UserAddon.status == "active",
                UserAddon.expiry_date > current_time
            )
        )
        
        return db.query(addon_query.exists()).scalar()
    
    @staticmethod
    def purchase_addon(db: Session, user_id: int, addon_id: int) -> UserAddon:
        """
        Process the purchase of an add-on for a user
        
        Args:
            db: Database session
            user_id: ID of the user purchasing the add-on
            addon_id: ID of the add-on being purchased
            
        Returns:
            The created UserAddon record
        """
        # Get addon details
        addon = db.query(Addon).filter(Addon.id == addon_id).first()
        if not addon:
            raise ValueError(f"Add-on with ID {addon_id} not found")
        
        # Get user's active subscription
        subscription = (
            db.query(UserSubscription)
            .filter(
                UserSubscription.user_id == user_id,
                UserSubscription.status == "active"
            )
            .order_by(UserSubscription.expiry_date.desc())
            .first()
        )
        
        if not subscription:
            raise ValueError(f"User with ID {user_id} does not have an active subscription")
            
        # Determine expiry date based on addon type
        current_time = datetime.now()
        
        # Default - expires with the subscription (for one-time add-ons)
        expiry_date = subscription.expiry_date
        
        # Special case: Additional Messages addon (lifetime until used up or subscription canceled)
        if addon.addon_type == "Additional Messages":
            # Set a far future date (5 years) as messages add-on doesn't expire with billing cycle
            expiry_date = current_time + timedelta(days=5*365)
        
        # Create new user addon record
        user_addon = UserAddon(
            user_id=user_id,
            addon_id=addon_id,
            subscription_id=subscription.id,
            purchase_date=current_time,
            expiry_date=expiry_date,
            is_active=True,
            auto_renew=addon.is_recurring,
            status="active"
        )
        
        db.add(user_addon)
        db.commit()
        db.refresh(user_addon)
        
        return user_addon
    
    @staticmethod
    def cancel_addon(db: Session, user_addon_id: int) -> UserAddon:
        """
        Cancel a user's add-on
        
        Args:
            db: Database session
            user_addon_id: ID of the user add-on to cancel
            
        Returns:
            The updated UserAddon record
        """
        user_addon = db.query(UserAddon).filter(UserAddon.id == user_addon_id).first()
        if not user_addon:
            raise ValueError(f"User add-on with ID {user_addon_id} not found")
        
        user_addon.is_active = False
        user_addon.status = "cancelled"
        user_addon.updated_at = datetime.now()
        
        db.commit()
        db.refresh(user_addon)
        
        return user_addon
    
    @staticmethod
    def get_user_addons(db: Session, user_id: int) -> List[UserAddon]:
        """
        Get all add-ons for a specific user
        
        Args:
            db: Database session
            user_id: ID of the user
            
        Returns:
            List of UserAddon records
        """
        return (
            db.query(UserAddon)
            .filter(UserAddon.user_id == user_id)
            .order_by(UserAddon.created_at.desc())
            .all()
        )
    
    @staticmethod
    def check_expired_addons() -> None:
        """
        Background task to check and deactivate expired add-ons
        
        Should be run periodically (e.g., daily) to ensure expired add-ons are properly marked
        """
        from app.database import SessionLocal
        
        db = SessionLocal()
        try:
            current_time = datetime.now()
            
            # Find all active add-ons that have expired
            expired_addons = (
                db.query(UserAddon)
                .filter(
                    UserAddon.is_active == True,
                    UserAddon.status == "active",
                    UserAddon.expiry_date <= current_time
                )
                .all()
            )
            
            # Update their status
            for addon in expired_addons:
                addon.is_active = False
                addon.status = "expired"
                addon.updated_at = current_time
            
            db.commit()
            logger.info(f"Deactivated {len(expired_addons)} expired add-ons")
            
        except Exception as e:
            logger.error(f"Error checking expired add-ons: {str(e)}")
            db.rollback()
        finally:
            db.close()
    
    @staticmethod
    def check_features_access(db: Session, user_id: int) -> Dict[str, bool]:
        """
        Check which add-on features a user has access to
        
        Args:
            db: Database session
            user_id: ID of the user
            
        Returns:
            Dictionary with feature access status
        """
        current_time = datetime.now()
        
        # Get all active add-ons for the user
        active_addons = (
            db.query(UserAddon)
            .join(Addon, UserAddon.addon_id == Addon.id)
            .filter(
                UserAddon.user_id == user_id,
                UserAddon.is_active == True,
                UserAddon.status == "active",
                UserAddon.expiry_date > current_time
            )
            .with_entities(Addon.addon_type)
            .all()
        )
        
        # Convert to set for faster lookups
        active_addon_types = {addon[0] for addon in active_addons}
        
        # Return dictionary with feature flags
        return {
            "multilingual": "Multilingual" in active_addon_types,
            "white_labelling": "White Labelling" in active_addon_types,
            "additional_admin": "Additional Admin" in active_addon_types,
            "additional_words": "Additional Words" in active_addon_types,
            "additional_messages": "Additional Messages" in active_addon_types
        } 