from sqlalchemy.orm import Session
from app.models import UserAddon, Addon, UserSubscription, User, SubscriptionPlan
from app.schemas import UserAddonCreate, UserAddonUpdate
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
import logging
from app.zoho_billing_service import ZohoBillingService
from app.schemas import BulkAddOnCheckoutRequest

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
                # Addon.addon_type == addon_type,
                UserAddon.is_active == True,
                UserAddon.status == "active",
                UserAddon.expiry_date > current_time
            )
        )
        
        return db.query(addon_query.exists()).scalar()
    
    @staticmethod
    def purchase_addon(db: Session, user_id: int, addon_id: int, quantity: int = 1) -> List[UserAddon]:
        """
        Process the purchase of an add-on for a user
        
        Args:
            db: Database session
            user_id: ID of the user purchasing the add-on
            addon_id: ID of the add-on being purchased
            
        Returns:
            The created UserAddon record
        """
        print("Database reached here")
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
        
        # All addons should expire with the user's current subscription end date
        # Exception: Additional Messages (addon id == 3) should have no expiry (NULL).. 
        # Currently message addon is also recurring hence this above logic is no longer require hence making id == 0 
        expiry_date = None if addon.id == 0 else subscription.expiry_date
        
        # Create as many rows as requested by quantity
        created_addons: List[UserAddon] = []
        rows_to_create = max(int(quantity), 1)
        for _ in range(rows_to_create):
            user_addon = UserAddon(
                user_id=user_id,
                addon_id=addon_id,
                subscription_id=subscription.id,
                purchase_date=current_time,
                expiry_date=expiry_date,
                is_active=True,
                auto_renew=addon.is_recurring,
                status="active",
                initial_count=0,
                remaining_count=0
            )
            db.add(user_addon)
            created_addons.append(user_addon)
        print("Database Updated - created", len(created_addons), "rows")
        db.commit()
        for ua in created_addons:
            db.refresh(ua)
        return created_addons
    
    @staticmethod
    def get_addon_checkout_url(db: Session, user_id: int, addon_id: int, quantity: int = 1) -> str:
        """
        Generate a checkout URL for standalone add-on purchase
        
        Args:
            db: Database session
            user_id: ID of the user purchasing the add-on
            addon_id: ID of the add-on being purchased
            quantity: Quantity of the add-on to purchase (default: 1)
            
        Returns:
            Checkout URL for the add-on purchase
        """
        print(f"Generating checkout URL for addon ID: {addon_id}")
        # Get addon details
        addon = db.query(Addon).filter(Addon.id == addon_id).first()
        if not addon:
            raise ValueError(f"Add-on with ID {addon_id} not found")
        
        print(f"Addon details: {addon}")
        # Make sure the addon has a Zoho code
        if not addon.zoho_addon_code:
            raise ValueError(f"Add-on '{addon.name}' is not properly configured for checkout")
        
        print(f"Addon has Zoho code: {addon.zoho_addon_code}")
        # Get user's active subscription to link the add-on to
        subscription = (
            db.query(UserSubscription)
            .filter(
                UserSubscription.user_id == user_id,
                UserSubscription.status == "active"
            )
            .order_by(UserSubscription.expiry_date.desc())
            .first()
        )
        
        print(f"Subscription details: {subscription}")
        if not subscription:
            raise ValueError("You need an active subscription to purchase add-ons. Please subscribe to a plan first.")
            
        # Get plan details to check if it's a free plan
        plan = db.query(SubscriptionPlan).filter(
            SubscriptionPlan.id == subscription.subscription_plan_id
        ).first()
        
        if plan and (plan.price == 0 or plan.price is None):
            raise ValueError("Add-ons can only be purchased with a paid subscription plan. Please upgrade from your free plan first.")
            
        # Ensure subscription has a Zoho subscription ID
        if not subscription.zoho_subscription_id:
            raise ValueError("Your subscription doesn't have a valid billing reference. Please contact support for assistance or try subscribing to a paid plan first.")
        
        print(f"User has active subscription with Zoho ID: {subscription.zoho_subscription_id}")
        # Get user details
        user = db.query(User).filter(User.user_id == user_id).first()
        if not user:
            raise ValueError(f"User with ID {user_id} not found")
        
        print(f"User found")
        # Create user data dictionary
        user_data = {
            "name": user.name,
            "email": user.email,
            "phone_no": user.phone_no,
            "company_name": user.company_name if hasattr(user, 'company_name') else None
        }
        
        print(f"User data: {user_data}")
        # Initialize Zoho billing service
        zoho_service = ZohoBillingService()
        
        print(f"Zoho service initialized")
        
        # Check if addon is recurring and handle accordingly
        if addon.is_recurring:
            print(f"Processing recurring addon: {addon.name}")
            # For recurring addons, we need to use subscription modification
            # Note: updatesubscription endpoint doesn't need user_data since it's modifying existing subscription
            # Use additive mode for standalone recurring addon purchases so Zoho charges only the delta
            checkout_url = zoho_service.get_recurring_addon_hosted_page_url(
                subscription_id=subscription.zoho_subscription_id,
                addon_code=addon.zoho_addon_code,
                quantity=quantity,
                mode="addon_purchase"
            )
        else:
            print(f"Processing one-time addon: {addon.name}")
            # Format data for Zoho hosted page (buyonetimeaddon endpoint)
            addon_data = {
                "customer": {
                    "display_name": user_data.get("name", ""),
                    "email": user_data.get("email", ""),
                    "mobile": user_data.get("phone_no") or "9081726354"  # Use mobile instead of phone with default
                },
                "addons": [
                    {
                        "addon_code": addon.zoho_addon_code,
                        "quantity": quantity
                    }
                ],
                "redirect_url": f"{zoho_service.get_frontend_url()}/dashboard/welcome?addonpayment=success",
                "cancel_url": f"{zoho_service.get_frontend_url()}/account/add-ons"
            }
            
            # Add company name if it exists
            if user_data.get("company_name"):
                addon_data["customer"]["company_name"] = user_data.get("company_name")
            
            print(f"Addon data: {addon_data}")
            
            # Get the checkout URL using the buyonetimeaddon endpoint
            checkout_url = zoho_service.get_addon_hosted_page_url(
                subscription_id=subscription.zoho_subscription_id,
                addon_data=addon_data
            )
        
        if not checkout_url:
            raise ValueError("Failed to generate checkout URL")
        
        print(f"Checkout URL generated: {checkout_url}")
        
        # Create a pending UserAddon record to track the purchase attempt
        try:
            current_time = datetime.now()
            
            # All addons should expire with the user's current subscription end date
            # Exception: Additional Messages (addon id == 3) should have no expiry (NULL)
            #Currently message addon is also recurring hence this above logic is no longer require hence making id == 0 
            addon_expiry = None if addon.id == 0 else subscription.expiry_date
            
            # Check if there's already a pending record for this addon
            existing_pending = db.query(UserAddon).filter(
                UserAddon.user_id == user_id,
                UserAddon.addon_id == addon_id,
                UserAddon.status == "pending"
            ).first()
            
            if existing_pending:
                # Update the existing pending record
                existing_pending.updated_at = current_time
                existing_pending.expiry_date = addon_expiry
                print(f"Updated existing pending addon record for user {user_id}, addon {addon_id}")
            else:
                # Create new pending UserAddon record
                pending_addon = UserAddon(
                    user_id=user_id,
                    addon_id=addon_id,
                    subscription_id=subscription.id,
                    purchase_date=current_time,
                    expiry_date=addon_expiry,
                    is_active=False,  # Not active until payment succeeds
                    auto_renew=addon.is_recurring,
                    status="pending",  # Mark as pending until webhook confirms payment
                    initial_count=0,
                    remaining_count=0  # Set to 0 until activated
                )
                
                db.add(pending_addon)
                print(f"Created pending addon record for user {user_id}, addon {addon_id}")
            
            db.commit()
            print(f"Successfully created/updated pending addon record")
            
        except Exception as e:
            db.rollback()
            print(f"WARNING: Could not create pending addon record: {str(e)}")
            logger.warning(f"Could not create pending addon record: {str(e)}")
            # Continue anyway - this is not critical for checkout URL generation
        
        return checkout_url
    
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

    @staticmethod
    def get_bulk_addon_checkout_url(db: Session, user_id: int, items: List[Dict[str, int]]) -> str:
        """
        Generate a checkout URL for purchasing multiple add-ons together (cart flow).

        Uses Zoho updatesubscription hosted page which accepts an addons array.
        """
        # Validate active subscription
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
            raise ValueError("You need an active subscription to purchase add-ons. Please subscribe to a plan first.")
        if not subscription.zoho_subscription_id:
            raise ValueError("Your subscription doesn't have a valid billing reference. Please contact support.")

        # Build addons list: resolve codes and quantities, validate
        addons_payload: List[Dict[str, int]] = []
        addon_counts: Dict[str, int] = {}
        for item in items:
            addon_id = int(item.get("addon_id"))
            quantity = int(item.get("quantity", 1))
            if quantity <= 0:
                continue
            addon = db.query(Addon).filter(Addon.id == addon_id).first()
            if not addon or not addon.zoho_addon_code:
                raise ValueError(f"Add-on with ID {addon_id} not found or not configured")
            addon_counts[addon.zoho_addon_code] = addon_counts.get(addon.zoho_addon_code, 0) + quantity

        if not addon_counts:
            raise ValueError("No valid add-ons to checkout")

        # Merge with existing recurring addons to avoid Zoho issuing credits (preserve full list)
        zoho_service = ZohoBillingService()
        merged_counts: Dict[str, int] = {}
        try:
            current_details = zoho_service.get_subscription_details(subscription.zoho_subscription_id)
            subscription_obj = (current_details or {}).get("subscription") or {}
            for item in (subscription_obj.get("addons") or []):
                code = item.get("addon_code")
                qty = int(item.get("quantity", 0) or 0)
                if code and qty > 0:
                    merged_counts[code] = merged_counts.get(code, 0) + qty
        except Exception as _e:
            # If fetching fails, proceed with only requested ones
            merged_counts = {}

        # Add requested quantities additively
        for code, qty in addon_counts.items():
            merged_counts[code] = int(merged_counts.get(code, 0)) + int(qty)

        # Prepare update payload as per Zoho: full addons array with addon_code and final quantity
        update_data: Dict[str, Any] = {
            "addons": [
                {"addon_code": code, "quantity": int(qty)}
                for code, qty in merged_counts.items()
            ],
            "redirect_url": f"{zoho_service.get_frontend_url()}/dashboard/welcome?addonpayment=success",
            "cancel_url": f"{zoho_service.get_frontend_url()}/account/add-ons"
        }

        # Generate hosted page URL
        checkout_url = zoho_service.get_subscription_update_hosted_page_url(
            subscription_id=subscription.zoho_subscription_id,
            update_data=update_data
        )

        if not checkout_url:
            raise ValueError("Failed to generate checkout URL")

        # Create/refresh pending rows for tracking (optional, similar to single flow)
        try:
            current_time = datetime.now()
            for code, qty in addon_counts.items():
                addon = db.query(Addon).filter(Addon.zoho_addon_code == code).first()
                if not addon:
                    continue
                expiry_date = None if addon.id == 0 else subscription.expiry_date
                existing_pending = db.query(UserAddon).filter(
                    UserAddon.user_id == user_id,
                    UserAddon.addon_id == addon.id,
                    UserAddon.status == "pending"
                ).first()
                if existing_pending:
                    existing_pending.updated_at = current_time
                    existing_pending.expiry_date = expiry_date
                else:
                    pending_addon = UserAddon(
                        user_id=user_id,
                        addon_id=addon.id,
                        subscription_id=subscription.id,
                        purchase_date=current_time,
                        expiry_date=expiry_date,
                        is_active=False,
                        auto_renew=addon.is_recurring,
                        status="pending",
                        initial_count=0,
                        remaining_count=0
                    )
                    db.add(pending_addon)
            db.commit()
        except Exception as _e:
            db.rollback()
            # Non-fatal
            logger.warning(f"Could not create pending rows for bulk addons: {str(_e)}")

        return checkout_url