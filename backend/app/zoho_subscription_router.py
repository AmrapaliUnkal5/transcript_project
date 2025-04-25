from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import SubscriptionPlan, Addon, UserSubscription, User
from typing import List, Dict, Any, Optional, Union
from app.zoho_billing_service import ZohoBillingService, format_subscription_data_for_hosted_page
from app.dependency import get_current_user
from datetime import datetime, timedelta
from pydantic import BaseModel
import logging
import os
from app.schemas import ZohoCheckoutRequest, ZohoCheckoutResponse

router = APIRouter(prefix="/zoho", tags=["Zoho Subscriptions"])
logger = logging.getLogger(__name__)

# Create a Zoho Billing Service instance
zoho_service = ZohoBillingService()

# Pydantic models for request/response
class SyncResponse(BaseModel):
    success: bool
    details: Dict[str, Any]

class SubscriptionCheckoutRequest(BaseModel):
    plan_id: int
    addon_ids: Optional[List[int]] = None

class SubscriptionCheckoutResponse(BaseModel):
    checkout_url: str

# Admin-only endpoint to sync plans with Zoho
@router.post("/sync/plans", response_model=SyncResponse)
async def sync_plans_with_zoho(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Validate admin access
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Run plan sync in background
    def sync_plans():
        try:
            result = zoho_service.sync_plans_with_zoho(db)
            logger.info(f"Plans sync completed: {result}")
        except Exception as e:
            logger.error(f"Error in background plan sync: {str(e)}")
    
    background_tasks.add_task(sync_plans)
    
    return SyncResponse(
        success=True,
        details={"message": "Plans sync started in background"}
    )

# Admin-only endpoint to sync addons with Zoho
@router.post("/sync/addons", response_model=SyncResponse)
async def sync_addons_with_zoho(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Validate admin access
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Run addon sync in background
    def sync_addons():
        try:
            result = zoho_service.sync_addons_with_zoho(db)
            logger.info(f"Addons sync completed: {result}")
        except Exception as e:
            logger.error(f"Error in background addon sync: {str(e)}")
    
    background_tasks.add_task(sync_addons)
    
    return SyncResponse(
        success=True,
        details={"message": "Addons sync started in background"}
    )

# User endpoint to get a Zoho Hosted Checkout URL
@router.post("/checkout", response_model=ZohoCheckoutResponse)
async def create_subscription_checkout(
    request: ZohoCheckoutRequest,
    db: Session = Depends(get_db),
    current_user: Union[dict, User] = Depends(get_current_user),
):
    """Create a Zoho subscription checkout URL"""
    try:
        # Get plan details
        plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == request.plan_id).first()
        if not plan:
            logger.error(f"Plan with ID {request.plan_id} not found")
            raise HTTPException(status_code=404, detail=f"Plan with ID {request.plan_id} not found")

        # Handle user data based on whether current_user is dict or object
        if isinstance(current_user, dict):
            user_data = {
                "name": current_user.get("name", ""),
                "email": current_user.get("email", ""),
                "phone_no": current_user.get("phone_no", ""),
                "company_name": current_user.get("company_name", "")
            }
            user_id = current_user.get("user_id")
        else:
            user_data = {
                "name": current_user.name,
                "email": current_user.email,
                "phone_no": current_user.phone_no,
                "company_name": current_user.company_name
            }
            user_id = current_user.user_id

        # Validate required user fields
        if not user_data["email"]:
            raise HTTPException(status_code=400, detail="User email is required for subscription")

        if not user_data["name"]:
            user_data["name"] = user_data["email"].split("@")[0]  # Use part of email as name if not provided

        # Log the attempt to create checkout
        logger.info(f"Creating subscription checkout for plan {plan.name} (ID: {plan.id}) for user {user_id}")

        # Make sure we have the plan code
        if not plan.zoho_plan_code:
            logger.error(f"Plan {plan.name} (ID: {plan.id}) does not have a Zoho plan code")
            raise HTTPException(status_code=400, detail=f"Plan {plan.name} is not properly configured for checkout")

        # Get addon codes if addon IDs are provided
        addon_codes = []
        if request.addon_ids and len(request.addon_ids) > 0:
            logger.info(f"Finding addon codes for addon IDs: {request.addon_ids}")
            print(f"\n==== DEBUG: Processing Addon IDs ====")
            print(f"Received addon IDs from frontend: {request.addon_ids}")
            
            # Query all addons first to check which ones exist
            all_addons = db.query(Addon).all()
            all_addon_ids = [a.id for a in all_addons]
            print(f"All available addon IDs in database: {all_addon_ids}")
            
            # Check which addon IDs don't exist in the database
            missing_ids = set(request.addon_ids) - set(all_addon_ids)
            if missing_ids:
                print(f"WARNING: These addon IDs don't exist in database: {missing_ids}")
            
            # Create a mapping of addon IDs to codes to maintain duplicates
            addon_id_to_code = {}
            addons = db.query(Addon).filter(Addon.id.in_(set(request.addon_ids))).all()
            for addon in addons:
                if addon.zoho_addon_code:
                    addon_id_to_code[addon.id] = addon.zoho_addon_code
                    print(f"Addon ID {addon.id}: name='{addon.name}', zoho_addon_code='{addon.zoho_addon_code}', zoho_addon_id='{addon.zoho_addon_id}'")
                else:
                    print(f"WARNING: Addon ID {addon.id} '{addon.name}' has no zoho_addon_code")
            
            # Preserve duplicates by iterating through the original request list
            for addon_id in request.addon_ids:
                if addon_id in addon_id_to_code:
                    addon_codes.append(addon_id_to_code[addon_id])
                    
            print(f"Found {len(addons)} unique addons out of {len(request.addon_ids)} requested")
            
            if not addons or len(set(request.addon_ids)) != len(addons):
                found_ids = [addon.id for addon in addons] if addons else []
                missing_ids = set(request.addon_ids) - set(found_ids)
                if missing_ids:
                    logger.warning(f"Some addon IDs were not found: {missing_ids}")
            
            print(f"Final addon_codes to be used: {addon_codes}")
            print(f"==== END Processing Addon IDs ====\n")
            logger.info(f"Using addon codes: {addon_codes}")

        # Create a new transaction for the temporary subscription
        created_temp_subscription = False
        # Store temporary subscription information - this will be updated when webhook is received
        try:
            # Check if there's an existing temporary subscription
            existing_temp_sub = db.query(UserSubscription).filter(
                UserSubscription.user_id == user_id,
                UserSubscription.status == "pending"
            ).first()
            
            if existing_temp_sub:
                # Update the existing temporary subscription
                existing_temp_sub.subscription_plan_id = plan.id
                existing_temp_sub.status = "pending"
                existing_temp_sub.updated_at = datetime.now()
            else:
                # Create a new temporary subscription record with default values for required fields
                temp_subscription = UserSubscription(
                    user_id=user_id,
                    subscription_plan_id=plan.id,
                    status="pending",
                    amount=float(plan.price or 0),  # Set a default amount
                    currency="USD",  # Set a default currency
                    payment_date=datetime.now(),  # Set the current date as payment date for now
                    expiry_date=datetime.now() + timedelta(days=30),  # Set a temporary expiry date
                    created_at=datetime.now(),
                    updated_at=datetime.now(),
                    auto_renew=True
                )
                db.add(temp_subscription)
                
            db.commit()
            created_temp_subscription = True
            logger.info(f"Created/updated temporary subscription record for user {user_id}")
        except Exception as e:
            db.rollback()  # Important: roll back the transaction to avoid blocking subsequent operations
            logger.warning(f"Could not create temporary subscription record: {str(e)}")
            # Continue anyway, this is not critical
        
        # Build subscription data for Zoho
        # Use the formatter from zoho_billing_service
        subscription_data = format_subscription_data_for_hosted_page(
            user_id=user_id,
            user_data=user_data,
            plan_code=plan.zoho_plan_code,
            addon_codes=addon_codes  # Pass the addon codes to include in the checkout
        )
        
        # Log the final subscription data
        logger.info(f"Formatted subscription data: {subscription_data}")

        # Initialize Zoho billing service and get checkout URL
        zoho_service = ZohoBillingService()
        checkout_url = zoho_service.get_hosted_page_url(subscription_data)

        if not checkout_url:
            logger.error("No checkout URL returned from Zoho")
            raise HTTPException(status_code=500, detail="Failed to generate checkout URL")

        # Log success
        logger.info(f"Successfully created checkout URL for user {user_id}: {checkout_url}")

        return {"checkout_url": checkout_url}
        
    except HTTPException:
        # Re-raise HTTP exceptions as they've already been formatted properly
        raise
        
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Error creating subscription checkout: {error_msg}")
        # Make sure to rollback any ongoing transaction
        try:
            db.rollback()
        except:
            pass
        raise HTTPException(status_code=500, detail=f"Error creating subscription checkout: {error_msg}")

# Webhook endpoint to handle Zoho subscription events
@router.post("/webhook")
async def zoho_webhook_handler(request: Request, db: Session = Depends(get_db)):
    try:
        # Parse the webhook payload
        payload = await request.json()
        
        # Log the incoming webhook
        event_type = payload.get("event_type")
        print(f"\n==== Zoho Webhook Received: {event_type} ====")
        print(f"Webhook Headers: {dict(request.headers)}")
        print(f"Webhook Payload: {payload}")
        
        # Handle different event types
        if event_type == "subscription_created":
            await handle_subscription_created(payload, db)
        elif event_type == "subscription_cancelled":
            await handle_subscription_cancelled(payload, db)
        elif event_type == "subscription_renewed":
            await handle_subscription_renewed(payload, db)
        elif event_type == "payment_failed" or event_type == "subscription_payment_failed" or event_type == "hostedpage_payment_failed":
            await handle_payment_failed(payload, db)
        else:
            print(f"Unhandled webhook event type: {event_type}")
        
        return {"success": True}
    
    except Exception as e:
        logger.error(f"Error processing Zoho webhook: {str(e)}")
        print(f"ERROR processing webhook: {str(e)}")
        return {"success": False, "error": str(e)}

async def handle_subscription_created(payload: Dict[str, Any], db: Session):
    """Handle subscription created event from Zoho"""
    try:
        print(f"==== Subscription Created Webhook Received ====")
        print(f"Payload: {payload}")
        
        subscription_data = payload.get("subscription", {})
        customer_data = payload.get("customer", {})
        invoice_data = payload.get("invoice", {})
        
        # Try to extract user_id from multiple possible locations
        user_id = None
        
        # First try from custom fields if present
        custom_fields = subscription_data.get("custom_fields", {})
        if custom_fields and isinstance(custom_fields, dict):
            user_id_str = custom_fields.get("user_id")
            if user_id_str and user_id_str.isdigit():
                user_id = int(user_id_str)
                print(f"Found user_id {user_id} in custom fields")
        
        # If not found, try to find by customer email
        if not user_id:
            customer_email = customer_data.get("email")
            if customer_email:
                user = db.query(User).filter(User.email == customer_email).first()
                if user:
                    user_id = user.user_id
                    print(f"Found user_id {user_id} by email {customer_email}")
        
        # If still not found, check for pending subscriptions
        if not user_id:
            # Look for the most recent pending subscription
            pending_sub = db.query(UserSubscription).filter(
                UserSubscription.status == "pending"
            ).order_by(UserSubscription.updated_at.desc()).first()
            
            if pending_sub:
                user_id = pending_sub.user_id
                print(f"Using most recent pending subscription user_id: {user_id}")
        
        if not user_id:
            print("User ID not found in webhook data")
            logger.error("User ID not found in webhook data")
            print(f"Full webhook payload: {payload}")
            return
        
        # Get plan details from Zoho data
        plan_code = subscription_data.get("plan", {}).get("plan_code")
        plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.zoho_plan_code == plan_code).first()
        
        if not plan:
            logger.error(f"Plan with code {plan_code} not found in local database")
            return
        
        # Check if a subscription with this Zoho ID already exists
        zoho_subscription_id = subscription_data.get("subscription_id")
        existing_subscription = None
        if zoho_subscription_id:
            existing_subscription = db.query(UserSubscription).filter(
                UserSubscription.zoho_subscription_id == zoho_subscription_id
            ).first()
            
            if existing_subscription:
                print(f"Subscription with Zoho ID {zoho_subscription_id} already exists in the database. Updating...")
                # Update existing subscription
                existing_subscription.amount = float(subscription_data.get("amount", existing_subscription.amount))
                existing_subscription.currency = subscription_data.get("currency_code", existing_subscription.currency)
                existing_subscription.payment_date = datetime.now()
                existing_subscription.expiry_date = subscription_data.get("next_billing_at") or subscription_data.get("expires_at")
                existing_subscription.status = "active"
                existing_subscription.auto_renew = subscription_data.get("auto_collect", existing_subscription.auto_renew)
                existing_subscription.zoho_customer_id = customer_data.get("customer_id", existing_subscription.zoho_customer_id)
                existing_subscription.zoho_invoice_id = invoice_data.get("invoice_id", existing_subscription.zoho_invoice_id)
                existing_subscription.payment_method = invoice_data.get("payment_gateway", existing_subscription.payment_method)
                
                # Also update the user's subscription plan ID
                user = db.query(User).filter(User.user_id == user_id).first()
                if user:
                    user.subscription_plan_id = plan.id
                    print(f"Updated user {user_id} subscription plan to {plan.id}")
                
                db.commit()
                print(f"Updated existing subscription for user {user_id}")
                return
        
        # Create the user subscription
        try:
            # First, update any pending subscriptions to 'cancelled'
            db.query(UserSubscription).filter(
                UserSubscription.user_id == user_id,
                UserSubscription.status == "pending"
            ).update({"status": "cancelled"})
            
            # Then create the new active subscription
            new_subscription = UserSubscription(
                user_id=user_id,
                subscription_plan_id=plan.id,
                amount=float(subscription_data.get("amount", 0)),
                currency=subscription_data.get("currency_code", "USD"),
                payment_date=datetime.now(),
                expiry_date=subscription_data.get("next_billing_at") or subscription_data.get("expires_at"),
                status="active",
                auto_renew=subscription_data.get("auto_collect", True),
                zoho_subscription_id=subscription_data.get("subscription_id"),
                zoho_customer_id=customer_data.get("customer_id"),
                zoho_invoice_id=invoice_data.get("invoice_id"),
                payment_method=invoice_data.get("payment_gateway")
            )
            
            db.add(new_subscription)
            
            # Update the user's subscription plan
            user = db.query(User).filter(User.user_id == user_id).first()
            if user:
                user.subscription_plan_id = plan.id
                print(f"Updated user {user_id} subscription plan to {plan.id}")
            
            db.commit()
            print(f"Successfully created subscription for user {user_id}")
            logger.info(f"Subscription created for user {user_id}")
        except Exception as e:
            db.rollback()
            print(f"Database error creating subscription: {str(e)}")
            logger.error(f"Database error creating subscription: {str(e)}")
            raise
    
    except Exception as e:
        db.rollback()
        logger.error(f"Error handling subscription_created event: {str(e)}")
        print(f"ERROR handling subscription created: {str(e)}")

async def handle_subscription_cancelled(payload: Dict[str, Any], db: Session):
    """Handle subscription cancelled event from Zoho"""
    try:
        subscription_data = payload.get("subscription", {})
        zoho_subscription_id = subscription_data.get("subscription_id")
        
        if not zoho_subscription_id:
            logger.error("Subscription ID not found in webhook payload")
            return
        
        # Update the subscription status
        subscription = db.query(UserSubscription).filter(
            UserSubscription.zoho_subscription_id == zoho_subscription_id
        ).first()
        
        if subscription:
            subscription.status = "cancelled"
            subscription.auto_renew = False
            subscription.cancellation_reason = subscription_data.get("cancel_reason")
            
            db.commit()
            logger.info(f"Subscription {zoho_subscription_id} cancelled")
        else:
            logger.error(f"Subscription with ID {zoho_subscription_id} not found in local database")
    
    except Exception as e:
        db.rollback()
        logger.error(f"Error handling subscription_cancelled event: {str(e)}")

async def handle_subscription_renewed(payload: Dict[str, Any], db: Session):
    """Handle subscription renewed event from Zoho"""
    try:
        subscription_data = payload.get("subscription", {})
        invoice_data = payload.get("invoice", {})
        zoho_subscription_id = subscription_data.get("subscription_id")
        
        if not zoho_subscription_id:
            logger.error("Subscription ID not found in webhook payload")
            return
        
        # Update the subscription
        subscription = db.query(UserSubscription).filter(
            UserSubscription.zoho_subscription_id == zoho_subscription_id
        ).first()
        
        if subscription:
            subscription.status = "active"
            subscription.amount = float(subscription_data.get("amount", subscription.amount))
            subscription.payment_date = datetime.now()
            subscription.expiry_date = subscription_data.get("next_billing_at") or subscription_data.get("expires_at")
            subscription.zoho_invoice_id = invoice_data.get("invoice_id")
            
            db.commit()
            logger.info(f"Subscription {zoho_subscription_id} renewed")
        else:
            logger.error(f"Subscription with ID {zoho_subscription_id} not found in local database")
    
    except Exception as e:
        db.rollback()
        logger.error(f"Error handling subscription_renewed event: {str(e)}")

# Add a new handler for payment failures
async def handle_payment_failed(payload: Dict[str, Any], db: Session):
    """Handle payment failure events from Zoho"""
    try:
        print(f"==== Payment Failed Webhook Received ====")
        print(f"Payload: {payload}")
        
        # Extract relevant information from the payload
        subscription_data = payload.get("subscription", {})
        customer_data = payload.get("customer", {})
        hostedpage_data = payload.get("hostedpage", {})
        invoice_data = payload.get("invoice", {})
        payment_data = payload.get("payment", {})
        
        # Try to extract user_id using the same methods as in subscription_created
        user_id = None
        
        # First try from custom fields if present
        custom_fields = subscription_data.get("custom_fields", {})
        if custom_fields and isinstance(custom_fields, dict):
            user_id_str = custom_fields.get("user_id")
            if user_id_str and user_id_str.isdigit():
                user_id = int(user_id_str)
                print(f"Found user_id {user_id} in custom fields")
        
        # If not found, try to find by customer email
        if not user_id:
            customer_email = customer_data.get("email") or hostedpage_data.get("customer", {}).get("email")
            if customer_email:
                user = db.query(User).filter(User.email == customer_email).first()
                if user:
                    user_id = user.user_id
                    print(f"Found user_id {user_id} by email {customer_email}")
        
        # If still not found, check for pending subscriptions
        if not user_id:
            # Look for the most recent pending subscription
            pending_sub = db.query(UserSubscription).filter(
                UserSubscription.status == "pending"
            ).order_by(UserSubscription.updated_at.desc()).first()
            
            if pending_sub:
                user_id = pending_sub.user_id
                print(f"Using most recent pending subscription user_id: {user_id}")
        
        if not user_id:
            print("User ID not found in webhook data for payment failure")
            logger.error("User ID not found in webhook data for payment failure")
            return
        
        # Get the subscription ID if available
        zoho_subscription_id = subscription_data.get("subscription_id")
        if zoho_subscription_id:
            # Check if there's an existing subscription with this Zoho ID
            subscription = db.query(UserSubscription).filter(
                UserSubscription.zoho_subscription_id == zoho_subscription_id
            ).first()
            
            if subscription:
                # Update the existing subscription to failed status
                subscription.status = "failed"
                subscription.updated_at = datetime.now()
                subscription.notes = f"Payment failed: {payment_data.get('failure_reason') or 'Unknown reason'}"
                
                db.commit()
                print(f"Updated subscription {zoho_subscription_id} to failed status")
                return
        
        # If no subscription ID or no matching subscription found, 
        # update the most recent pending subscription for this user
        pending_subscription = db.query(UserSubscription).filter(
            UserSubscription.user_id == user_id,
            UserSubscription.status == "pending"
        ).order_by(UserSubscription.updated_at.desc()).first()
        
        if pending_subscription:
            # Update the pending subscription to failed status
            pending_subscription.status = "failed"
            pending_subscription.updated_at = datetime.now()
            pending_subscription.notes = f"Payment failed: {payment_data.get('failure_reason') or 'Unknown reason'}"
            
            db.commit()
            print(f"Updated pending subscription for user {user_id} to failed status")
        else:
            print(f"No pending subscription found for user {user_id} to mark as failed")
            
    except Exception as e:
        db.rollback()
        logger.error(f"Error handling payment_failed event: {str(e)}")
        print(f"ERROR handling payment failure: {str(e)}") 