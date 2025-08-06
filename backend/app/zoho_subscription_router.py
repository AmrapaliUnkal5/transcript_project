from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import SubscriptionPlan, Addon, UserSubscription, User, UserAddon
from typing import List, Dict, Any, Optional, Union
from app.zoho_billing_service import ZohoBillingService, format_subscription_data_for_hosted_page
from app.dependency import get_current_user
from datetime import datetime, timedelta, timezone
from pydantic import BaseModel
import logging
import os
from app.schemas import ZohoCheckoutRequest, ZohoCheckoutResponse
from app.utils.create_access_token import create_access_token
from fastapi.responses import JSONResponse
from app.utils.logger import get_module_logger, get_webhook_logger
from app.config import settings

router = APIRouter(prefix="/zoho", tags=["Zoho Subscriptions"])
logger = get_module_logger(__name__)
webhook_logger = get_webhook_logger()

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
            
        # Check if phone number is available - Zoho requires this field
        if not user_data["phone_no"]:
            # Return a specific error that the frontend can recognize
            return JSONResponse(
                status_code=422,
                content={
                    "detail": "phone_number_required",
                    "message": "Phone number is required for subscription checkout"
                }
            )

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
        
        # Check if user has any previous Zoho history (existing customer)
        existing_customer_subscription = db.query(UserSubscription).filter(
            UserSubscription.user_id == user_id,
            UserSubscription.zoho_customer_id.isnot(None)
        ).first()
        
        # Check if user has an active subscription that can be updated
        active_subscription_for_update = db.query(UserSubscription).filter(
            UserSubscription.user_id == user_id,
            UserSubscription.status == "active",
            UserSubscription.zoho_subscription_id.isnot(None)
        ).order_by(UserSubscription.payment_date.desc()).first()
        
        logger.info(f"User {user_id} - Existing customer: {existing_customer_subscription.zoho_customer_id if existing_customer_subscription else 'None'}")
        logger.info(f"User {user_id} - Active subscription for update: {active_subscription_for_update.zoho_subscription_id if active_subscription_for_update else 'None'}")
        
        zoho_service = ZohoBillingService()
        
        if active_subscription_for_update:
            # User has active subscription that can be updated - use update subscription API
            logger.info(f"Using update subscription API for existing subscription {active_subscription_for_update.zoho_subscription_id}")
            
            # Fetch customer details from Zoho first to include billing and account information
            customer_details = None
            if active_subscription_for_update.zoho_customer_id:
                logger.info(f"Fetching customer details from Zoho for customer ID: {active_subscription_for_update.zoho_customer_id}")
                customer_details = zoho_service.get_customer_details(active_subscription_for_update.zoho_customer_id)
                
                if not customer_details:
                    logger.warning(f"Could not fetch customer details for customer ID: {active_subscription_for_update.zoho_customer_id}")
            
            update_data = {
                "plan": {
                    "plan_code": plan.zoho_plan_code,
                    "quantity": 1
                },
                "redirect_url": f"{os.getenv('FRONTEND_URL', 'https://evolra.ai')}/",
                "cancel_url": f"{os.getenv('FRONTEND_URL', 'https://evolra.ai')}/subscription",
            }
            
            # Include customer details if we successfully fetched them
            if customer_details:
                logger.info("Including customer details in update subscription call")
                
                # Extract and include customer information
                customer_data = {
                    "customer_id": customer_details.get("customer_id"),
                    "display_name": customer_details.get("display_name"),
                    "first_name": customer_details.get("first_name"),
                    "last_name": customer_details.get("last_name"),
                    "email": customer_details.get("email"),
                    "phone": customer_details.get("phone"),
                    "company_name": customer_details.get("company_name"),
                }
                
                # Include billing address if available
                if customer_details.get("billing_address"):
                    customer_data["billing_address"] = customer_details.get("billing_address")
                
                # Include shipping address if available
                if customer_details.get("shipping_address"):
                    customer_data["shipping_address"] = customer_details.get("shipping_address")
                
                update_data["customer"] = customer_data
                logger.info(f"Added customer data to update payload: {customer_data}")
            else:
                logger.warning("No customer details available - proceeding without customer data in update")
            
            # Add addons if provided
            if addon_codes and len(addon_codes) > 0:
                addon_counts = {}
                for code in addon_codes:
                    addon_counts[code] = addon_counts.get(code, 0) + 1
                
                update_data["addons"] = [
                    {"addon_code": code, "quantity": count} 
                    for code, count in addon_counts.items()
                ]
                
            checkout_url = zoho_service.get_subscription_update_hosted_page_url(
                active_subscription_for_update.zoho_subscription_id, 
                update_data
            )
        else:
            # User either has no subscription or has expired/cancelled subscription
            # Use new subscription API, but pass customer_id if they're an existing customer
            existing_customer_id = existing_customer_subscription.zoho_customer_id if existing_customer_subscription else None
            
            if existing_customer_id:
                logger.info(f"Using new subscription API for existing customer {existing_customer_id} (expired/cancelled subscription)")
            else:
                logger.info(f"Using new subscription API for completely new user {user_id}")
            
            subscription_data = format_subscription_data_for_hosted_page(
                user_id=user_id,
                user_data=user_data,
                plan_code=plan.zoho_plan_code,
                addon_codes=addon_codes,
                existing_customer_id=existing_customer_id,
                billing_address=request.billing_address,
                shipping_address=request.shipping_address,
                gstin=request.gstin
            )
            checkout_url = zoho_service.get_hosted_page_url(subscription_data)
            
            # Log the final subscription data
            logger.info(f"Formatted subscription data: {subscription_data}")


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
        # TODO: Add webhook signature verification for production security
        # Example: verify_webhook_signature(request.headers, payload)
        
        # Log webhook reception with timestamp
        import time
        timestamp = datetime.now().isoformat()
        
        # Parse the webhook payload
        payload = await request.json()
        
        # Enhanced logging for debugging
        event_type = payload.get("event_type")
        print(f"\n{'='*60}")
        print(f"ZOHO WEBHOOK RECEIVED: {timestamp}")
        print(f"Event Type: {event_type}")
        print(f"Request Method: {request.method}")
        print(f"Request URL: {request.url}")
        print(f"Headers: {dict(request.headers)}")
        print(f"Raw Payload: {payload}")
        print(f"{'='*60}\n")
        
        # Log webhook to structured logging system
        webhook_logger.info(
            "Zoho webhook received",
            extra={
                "event_type": event_type,
                "webhook_url": str(request.url),
                "method": request.method,
                "headers": dict(request.headers),
                "payload": payload,
                "user_agent": request.headers.get("user-agent"),
                "content_length": request.headers.get("content-length"),
                "source_ip": request.headers.get("x-forwarded-for") or request.client.host if request.client else "unknown"
            }
        )
        
        # If event_type is null, try to determine from payload structure
        if event_type is None:
            print("Event type is null, attempting to determine from payload structure...")
            
            # Check if this is a payment-related webhook
            if "payment" in payload and payload["payment"].get("status") == "success":
                event_type = "payment_success"
                print(f"Detected payment success event from payload structure")
            elif "payment" in payload and payload["payment"].get("status") == "failed":
                event_type = "payment_failed"
                print(f"Detected payment failed event from payload structure")
            elif "subscription" in payload:
                # Check subscription status to determine event type
                sub_status = payload.get("subscription", {}).get("status", "").lower()
                if sub_status == "live" or sub_status == "active":
                    event_type = "subscription_created"
                    print(f"Detected subscription created event from payload structure")
                elif sub_status == "cancelled":
                    event_type = "subscription_cancelled"  
                    print(f"Detected subscription cancelled event from payload structure")
        
        # Handle different event types
        if event_type == "subscription_created":
            result = await handle_subscription_created(payload, db)
            print(f"Subscription created handler result: {result}")
        elif event_type == "subscription_cancelled":
            result = await handle_subscription_cancelled(payload, db)
            print(f"Subscription cancelled handler result: {result}")
        elif event_type == "subscription_renewed":
            result = await handle_subscription_renewed(payload, db)
            print(f"Subscription renewed handler result: {result}")
        elif event_type == "payment_failed" or event_type == "subscription_payment_failed" or event_type == "hostedpage_payment_failed":
            result = await handle_payment_failed(payload, db)
            print(f"Payment failed handler result: {result}")
        elif event_type == "payment_success":
            result = await handle_payment_success(payload, db)
            print(f"Payment success handler result: {result}")
        else:
            print(f"Unhandled webhook event type: {event_type}")
            # Return success even for unhandled events to avoid webhook retries
        
        print(f"Webhook processing completed successfully for event: {event_type}")
        
        # Log successful webhook processing
        webhook_logger.info(
            "Webhook processed successfully",
            extra={
                "event_type": event_type,
                "processing_result": "success"
            }
        )
        
        return {"success": True, "message": f"Processed {event_type}"}
    
    except Exception as e:
        error_msg = f"Error processing Zoho webhook: {str(e)}"
        logger.error(error_msg)
        print(f"ERROR: {error_msg}")
        
        # Log webhook processing error
        webhook_logger.error(
            "Webhook processing failed",
            extra={
                "event_type": event_type,
                "error_message": error_msg,
                "processing_result": "error"
            }
        )
            
        return {"success": False, "error": str(e)}

# Test endpoint to verify webhook connectivity
@router.get("/webhook/test")
async def test_webhook_connectivity():
    """Test endpoint to verify webhook URL is accessible"""
    return {
        "status": "success", 
        "message": "Webhook endpoint is accessible",
        "timestamp": datetime.now().isoformat(),
        "endpoint": "/zoho/webhook"
    }

async def handle_subscription_created(payload: Dict[str, Any], db: Session):
    """Handle subscription created webhook event"""
    logger.info("Processing subscription created event")
    
    try:
        # Extract customer and subscription details from payload
        customer_id = payload.get("customer", {}).get("customer_id")
        subscription_id = payload.get("subscription", {}).get("subscription_id")
        subscription_number = payload.get("subscription", {}).get("subscription_number")
        plan_code = payload.get("subscription", {}).get("plan", {}).get("plan_code")
        
        logger.info(f"Subscription details: customer_id={customer_id}, subscription_id={subscription_id}, plan_code={plan_code}")
        
        if not customer_id or not subscription_id or not plan_code:
            logger.error("Missing required subscription data in webhook payload")
            return {"status": "error", "message": "Invalid webhook payload - missing required fields"}
        
        # Find the user based on the Zoho customer ID
        user = db.query(User).filter(UserSubscription.zoho_customer_id == customer_id).join(
            UserSubscription, User.user_id == UserSubscription.user_id
        ).first()
        
        if not user:
            logger.error(f"Could not find user for Zoho customer ID: {customer_id}")
            return {"status": "error", "message": f"No user found for customer ID {customer_id}"}
        
        # Get plan from database
        plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.zoho_plan_code == plan_code).first()
        if not plan:
            logger.error(f"Could not find plan for plan code: {plan_code}")
            return {"status": "error", "message": f"No plan found for plan code {plan_code}"}
        
        # Extract date information
        created_time = payload.get("subscription", {}).get("created_time")
        next_billing_at = payload.get("subscription", {}).get("next_billing_at") 
        
        # Parse dates if they exist
        payment_date = datetime.now()
        if created_time:
            try:
                payment_date = datetime.fromisoformat(created_time.replace('Z', '+00:00'))
            except:
                logger.warning(f"Could not parse created_time: {created_time}")
                
        expiry_date = payment_date + timedelta(days=30)  # Default fallback
        if next_billing_at:
            try:
                expiry_date = datetime.fromisoformat(next_billing_at.replace('Z', '+00:00'))
            except:
                logger.warning(f"Could not parse next_billing_at: {next_billing_at}")
        
        # Get amount and currency
        amount = payload.get("subscription", {}).get("amount", 0)
        currency = payload.get("subscription", {}).get("currency_code", "USD")
        
        # Create the subscription record
        new_subscription = UserSubscription(
            user_id=user.user_id,
            subscription_plan_id=plan.id,
            status="active",
            amount=amount,
            currency=currency,
            payment_date=payment_date,
            expiry_date=expiry_date,
            auto_renew=True,
            zoho_subscription_id=subscription_id,
            zoho_customer_id=customer_id
        )
        
        db.add(new_subscription)
        db.commit()
        db.refresh(new_subscription)
        
        logger.info(f"Created subscription record for user {user.user_id}, subscription ID: {new_subscription.id}")
        
        # Process add-ons (if any)
        addon_items = payload.get("subscription", {}).get("addons", [])
        if addon_items:
            logger.info(f"Processing {len(addon_items)} add-ons for subscription {subscription_id}")
            
            for addon_item in addon_items:
                addon_code = addon_item.get("addon_code")
                addon_instance_id = addon_item.get("addon_instance_id")
                
                if not addon_code:
                    logger.warning(f"Skipping add-on without addon_code in subscription {subscription_id}")
                    continue
                
                # Find the addon in our database
                addon = db.query(Addon).filter(Addon.zoho_addon_code == addon_code).first()
                if not addon:
                    logger.warning(f"Could not find add-on with code {addon_code} in database")
                    continue
                
                # Determine expiry date based on addon type
                addon_expiry = expiry_date  # Default: expires with subscription
                
                # Special case for lifetime addons (like Additional Messages)
                if addon.addon_type == "Additional Messages":
                    # Set a far future date for lifetime add-ons
                    addon_expiry = payment_date + timedelta(days=5*365)
                
                # Create UserAddon record
                user_addon = UserAddon(
                    user_id=user.user_id,
                    addon_id=addon.id,
                    subscription_id=new_subscription.id,
                    purchase_date=payment_date,
                    expiry_date=addon_expiry,
                    is_active=True,
                    auto_renew=addon.is_recurring,
                    status="active",
                    zoho_addon_instance_id=addon_instance_id
                )
                
                db.add(user_addon)
                logger.info(f"Added add-on {addon.name} (ID: {addon.id}) to user {user.user_id} subscription")
        
        # Commit all add-ons in a single transaction
        if addon_items:
            db.commit()
            logger.info(f"Committed {len(addon_items)} add-ons for subscription {subscription_id}")
        
        return {"status": "success", "message": "Subscription created successfully"}
    
    except Exception as e:
        db.rollback()
        logger.error(f"Error processing subscription created event: {str(e)}")
        return {"status": "error", "message": f"Error processing subscription: {str(e)}"}

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
            
            # Get user ID for token refresh
            user_id = subscription.user_id
            
            db.commit()
            logger.info(f"Subscription {zoho_subscription_id} cancelled")
            
            # Create fresh token with updated subscription info
            create_fresh_user_token(db, user_id)
        else:
            logger.error(f"Subscription with ID {zoho_subscription_id} not found in local database")
    
    except Exception as e:
        db.rollback()
        logger.error(f"Error handling subscription_cancelled event: {str(e)}")

# Helper function to create fresh token with updated user data
def create_fresh_user_token(db: Session, user_id: int):
    """
    Create a fresh JWT token with the latest user data from the database
    """
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        logger.error(f"User with ID {user_id} not found when creating fresh token")
        return None
        
    # Get the user's active subscription
    user_subscription = db.query(UserSubscription).filter(
        UserSubscription.user_id == user_id,
        UserSubscription.status.notin_(["pending", "failed", "cancelled"])
    ).order_by(UserSubscription.payment_date.desc()).first()
    
    subscription_plan_id = user_subscription.subscription_plan_id if user_subscription else 1
    
    # Get user's active addons
    user_addons = db.query(UserAddon).filter(
        UserAddon.user_id == user_id,
        UserAddon.status == "active"
    ).all()
    
    addon_plan_ids = [addon.addon_id for addon in user_addons] if user_addons else []
    
    # Get message addon (ID 5) details if exists
    message_addon = db.query(UserAddon).filter(
        UserAddon.user_id == user_id,
        UserAddon.addon_id == 5,
        UserAddon.is_active == True
    ).order_by(UserAddon.expiry_date.desc()).first()
    
    # Create token data
    token_data = {
        "sub": user.email,
        "role": user.role,
        "user_id": user_id,
        "name": user.name,
        "company_name": user.company_name,
        "phone_no": user.phone_no,
        "subscription_plan_id": subscription_plan_id,
        "total_words_used": user.total_words_used,
        "addon_plan_ids": addon_plan_ids,
        "message_addon_expiry": message_addon.expiry_date if message_addon else 'Not Available',
        "subscription_status": user_subscription.status if user_subscription else "new",
    }
    
    # Create token with standard expiration
    return create_access_token(data=token_data, expires_delta=timedelta(minutes=120))  # 2 hours token

async def handle_subscription_renewed(payload: Dict[str, Any], db: Session):
    """Handle subscription renewed webhook event"""
    logger.info("Processing subscription renewed event")
    
    try:
        # Extract subscription details from payload
        zoho_subscription_id = payload.get("subscription", {}).get("subscription_id")
        if not zoho_subscription_id:
            logger.error("Missing subscription ID in webhook payload")
            return {"status": "error", "message": "Invalid webhook payload - missing subscription ID"}
        
        # Find the subscription in our database
        subscription = db.query(UserSubscription).filter(UserSubscription.zoho_subscription_id == zoho_subscription_id).first()
        if not subscription:
            logger.error(f"Could not find subscription for Zoho subscription ID: {zoho_subscription_id}")
            return {"status": "error", "message": f"No subscription found for ID {zoho_subscription_id}"}
        
        user_id = subscription.user_id
        
        # Extract date information
        created_time = payload.get("subscription", {}).get("created_time")
        next_billing_at = payload.get("subscription", {}).get("next_billing_at")
        
        # Parse dates if they exist
        payment_date = datetime.now()
        if created_time:
            try:
                payment_date = datetime.fromisoformat(created_time.replace('Z', '+00:00'))
            except:
                logger.warning(f"Could not parse created_time: {created_time}")
                
        expiry_date = payment_date + timedelta(days=30)  # Default fallback
        if next_billing_at:
            try:
                expiry_date = datetime.fromisoformat(next_billing_at.replace('Z', '+00:00'))
            except:
                logger.warning(f"Could not parse next_billing_at: {next_billing_at}")
        
        # Update the subscription
        subscription.status = "active"
        subscription.payment_date = payment_date
        subscription.expiry_date = expiry_date
        
        # Process addons if applicable
        addons_data = payload.get("subscription", {}).get("addons", [])
        for addon_data in addons_data:
            addon_code = addon_data.get("addon_code")
            if not addon_code:
                continue
                
            # Find the addon in our system
            addon = db.query(Addon).filter(Addon.zoho_addon_code == addon_code).first()
            if not addon:
                logger.warning(f"Could not find addon with code {addon_code}")
                continue
                
            # Check if the user already has this addon
            existing_addon = db.query(UserAddon).filter(
                UserAddon.user_id == subscription.user_id,
                UserAddon.addon_id == addon.id
            ).first()
            
            if existing_addon:
                # Update existing add-on
                existing_addon.is_active = True
                existing_addon.status = "active"
                
                # Determine expiry date based on addon type
                if addon.addon_type == "Additional Messages":
                    # Don't update expiry for lifetime add-ons
                    pass
                else:
                    # One-time add-ons expire with the subscription
                    existing_addon.expiry_date = expiry_date
                
                existing_addon.updated_at = datetime.now()
                logger.info(f"Updated existing add-on {addon.name} (ID: {addon.id}) for user {subscription.user_id}")
            else:
                # Create new user addon
                new_addon = UserAddon(
                    user_id=subscription.user_id,
                    addon_id=addon.id,
                    is_active=True,
                    status="active",
                    purchase_date=datetime.now(),
                    expiry_date=expiry_date if addon.addon_type != "Additional Messages" else None,
                    created_at=datetime.now()
                )
                db.add(new_addon)
                logger.info(f"Added new add-on {addon.name} (ID: {addon.id}) for user {subscription.user_id}")
        
        db.commit()
        
        # Create a fresh token with updated subscription info
        create_fresh_user_token(db, user_id)
        
        logger.info(f"Successfully processed subscription renewed event for {zoho_subscription_id}")
        return {"status": "success", "message": "Subscription renewed successfully"}
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error handling subscription_renewed event: {str(e)}")
        return {"status": "error", "message": f"Error processing renewal: {str(e)}"}

# Add a new handler for payment failures
async def handle_payment_failed(payload: Dict[str, Any], db: Session):
    """Handle payment failure events from Zoho"""
    try:
        # Extract data from payload
        customer_data = payload.get("customer", {})
        payment_data = payload.get("payment", {})
        
        # Get customer ID for lookup
        customer_id = customer_data.get("customer_id")
        
        if not customer_id:
            logger.error(f"Missing customer ID in payment failed payload")
            return
            
        # Extract the email from customer data to identify our user
        email = customer_data.get("email")
        if not email:
            logger.error(f"Customer email not found in webhook payload")
            return
            
        # Find the user by email
        user = db.query(User).filter(User.email == email).first()
        if not user:
            logger.error(f"User with email {email} not found in database")
            return
            
        user_id = user.user_id
        
        # Find any pending subscription
        pending_subscription = db.query(UserSubscription).filter(
            UserSubscription.user_id == user_id,
            UserSubscription.status == "pending"
        ).order_by(UserSubscription.created_at.desc()).first()
        
        if pending_subscription:
            # Update the pending subscription to failed status
            pending_subscription.status = "failed"
            pending_subscription.updated_at = datetime.now()
            pending_subscription.notes = f"Payment failed: {payment_data.get('failure_reason') or 'Unknown reason'}"
            
            db.commit()
            print(f"Updated pending subscription for user {user_id} to failed status")
            
            # Create a fresh token with the updated subscription info
            create_fresh_user_token(db, user_id)
        else:
            print(f"No pending subscription found for user {user_id} to mark as failed")
            
    except Exception as e:
        db.rollback()
        logger.error(f"Error handling payment_failed event: {str(e)}")
        print(f"ERROR handling payment failure: {str(e)}")

# Add a new handler for successful payments
async def handle_payment_success(payload: Dict[str, Any], db: Session):
    """Handle successful payment events from Zoho"""
    try:
        # Extract data from payload - fix structure to match actual Zoho payload
        payment_data = payload.get("payment", {})
        
        if not payment_data:
            logger.error("No payment data found in webhook payload")
            print("ERROR: No payment data found in webhook payload")
            return
        
        # Get critical IDs for lookup from the correct structure
        customer_id = payment_data.get("customer_id")
        email = payment_data.get("email")
        
        # Extract subscription ID from invoices array
        invoices = payment_data.get("invoices", [])
        subscription_id = None
        invoice_id = None
        
        if invoices and len(invoices) > 0:
            first_invoice = invoices[0]
            invoice_id = first_invoice.get("invoice_id")
            subscription_ids = first_invoice.get("subscription_ids", [])
            if subscription_ids and len(subscription_ids) > 0:
                subscription_id = subscription_ids[0]
        
        print(f"Extracted payment data:")
        print(f"  Customer ID: {customer_id}")
        print(f"  Email: {email}")
        print(f"  Subscription ID: {subscription_id}")
        print(f"  Invoice ID: {invoice_id}")
        print(f"  Payment Status: {payment_data.get('status')}")
        
        if not customer_id:
            logger.error("Missing customer ID in payment success payload")
            print("ERROR: Missing customer ID in payment success payload")
            return
            
        if not email:
            logger.error("Customer email not found in webhook payload")
            print("ERROR: Customer email not found in webhook payload")
            return
            
        # Find the user by email
        user = db.query(User).filter(User.email == email).first()
        if not user:
            logger.error(f"User with email {email} not found in database")
            print(f"ERROR: User with email {email} not found in database")
            return
            
        user_id = user.user_id
        print(f"Found user ID: {user_id} for email: {email}")
            
        # Find any pending subscription
        pending_subscription = db.query(UserSubscription).filter(
            UserSubscription.user_id == user_id,
            UserSubscription.status == "pending"
        ).order_by(UserSubscription.created_at.desc()).first()
        
        # Find the subscription in our database by Zoho ID (if we have one)
        existing_subscription = None
        if subscription_id:
            existing_subscription = db.query(UserSubscription).filter(
                UserSubscription.zoho_subscription_id == subscription_id
            ).first()
        
        print(f"Found pending subscription: {pending_subscription is not None}")
        print(f"Found existing subscription: {existing_subscription is not None}")
        
        if existing_subscription:
            # Update existing subscription
            existing_subscription.status = "active"
            existing_subscription.payment_date = datetime.now()
            existing_subscription.zoho_invoice_id = invoice_id
            existing_subscription.updated_at = datetime.now()
            existing_subscription.notes = "Payment successful"
            
            # Create a fresh token with the updated subscription info
            create_fresh_user_token(db, user_id)
            
            db.commit()
            print(f"SUCCESS: Updated existing subscription for user {user_id} to active status")
            logger.info(f"Updated existing subscription for user {user_id} to active status")
            
        elif pending_subscription:
            # Update the pending subscription
            pending_subscription.status = "active"
            if subscription_id:
                pending_subscription.zoho_subscription_id = subscription_id
            if invoice_id:
                pending_subscription.zoho_invoice_id = invoice_id
            if customer_id:
                pending_subscription.zoho_customer_id = customer_id
            pending_subscription.payment_date = datetime.now()
            pending_subscription.updated_at = datetime.now()
            pending_subscription.notes = "Payment successful"
            
            # Create a fresh token with the updated subscription info
            create_fresh_user_token(db, user_id)
            
            db.commit()
            print(f"SUCCESS: Updated pending subscription for user {user_id} to active status")
            logger.info(f"Updated pending subscription for user {user_id} to active status")
            
        else:
            logger.error(f"No matching subscription found for payment success event. User: {user_id}, Zoho Subscription: {subscription_id}")
            print(f"ERROR: No matching subscription found for payment success event. User: {user_id}, Zoho Subscription: {subscription_id}")
            
            # Log all subscriptions for this user for debugging
            all_subs = db.query(UserSubscription).filter(UserSubscription.user_id == user_id).all()
            print(f"All subscriptions for user {user_id}:")
            for sub in all_subs:
                print(f"  ID: {sub.id}, Status: {sub.status}, Zoho ID: {sub.zoho_subscription_id}, Created: {sub.created_at}")
            
    except Exception as e:
        db.rollback()
        logger.error(f"Error handling payment_success event: {str(e)}")
        print(f"ERROR handling payment success: {str(e)}")
        import traceback
        print(f"Full traceback: {traceback.format_exc()}")

# Add a new endpoint to get subscription status for a user
@router.get("/status/{user_id}", response_model=dict)
async def get_subscription_status(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: Union[dict, User] = Depends(get_current_user),
):
    """Get subscription status for a user, including pending subscriptions"""
    try:
        # Verify that the requested user_id matches the current user or is admin
        if isinstance(current_user, dict):
            requester_id = current_user.get("user_id")
            is_admin = current_user.get("role") == "admin"
        else:
            requester_id = current_user.user_id
            is_admin = current_user.role == "admin"
            
        if requester_id != user_id and not is_admin:
            raise HTTPException(status_code=403, detail="Not authorized to view this user's subscription")
            
        # Get the latest subscription for the user
        subscription = db.query(UserSubscription).filter(
            UserSubscription.user_id == user_id
        ).order_by(UserSubscription.updated_at.desc()).first()
        
        if not subscription:
            return {"status": "none", "message": "No subscription found"}
            
        # Get the associated plan
        plan = db.query(SubscriptionPlan).filter(
            SubscriptionPlan.id == subscription.subscription_plan_id
        ).first()
        
        plan_data = None
        if plan:
            plan_data = {
                "id": plan.id,
                "name": plan.name,
                "price": plan.price,
                "billing_period": plan.billing_period
            }
            
        subscription_data = {
            "id": subscription.id,
            "status": subscription.status,
            "subscription_plan_id": subscription.subscription_plan_id,
            "plan": plan_data,
            "created_at": subscription.created_at.isoformat() if subscription.created_at else None,
            "updated_at": subscription.updated_at.isoformat() if subscription.updated_at else None,
            "zoho_subscription_id": subscription.zoho_subscription_id,
            "expiry_date": subscription.expiry_date.isoformat() if subscription.expiry_date else None,
        }
        
        return subscription_data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting subscription status: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error getting subscription status: {str(e)}")

# Add endpoint to resume a pending checkout
@router.post("/resume-checkout/{subscription_id}", response_model=dict)
async def resume_checkout(
    subscription_id: int,
    db: Session = Depends(get_db),
    current_user: Union[dict, User] = Depends(get_current_user),
):
    """Resume a pending checkout by generating a new checkout URL for an existing pending subscription"""
    try:
        # Find the pending subscription
        subscription = db.query(UserSubscription).filter(
            UserSubscription.id == subscription_id,
            UserSubscription.status == "pending"
        ).first()
        
        if not subscription:
            raise HTTPException(status_code=404, detail="Pending subscription not found")
            
        # Verify that the subscription belongs to the current user or user is admin
        if isinstance(current_user, dict):
            requester_id = current_user.get("user_id")
            is_admin = current_user.get("role") == "admin"
        else:
            requester_id = current_user.user_id
            is_admin = current_user.role == "admin"
            
        if subscription.user_id != requester_id and not is_admin:
            raise HTTPException(status_code=403, detail="Not authorized to resume this subscription")
            
        # Get the plan details
        plan = db.query(SubscriptionPlan).filter(
            SubscriptionPlan.id == subscription.subscription_plan_id
        ).first()
        
        if not plan:
            raise HTTPException(status_code=404, detail="Subscription plan not found")
            
        # Handle user data
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
            
        # Update the pending subscription's timestamp
        subscription.updated_at = datetime.now()
        db.commit()
        
        # Check if user has any previous Zoho history (existing customer)
        existing_customer_subscription = db.query(UserSubscription).filter(
            UserSubscription.user_id == user_id,
            UserSubscription.zoho_customer_id.isnot(None)
        ).first()
        
        # Check if user has another active subscription that can be updated (not the pending one)
        active_subscription_for_update = db.query(UserSubscription).filter(
            UserSubscription.user_id == user_id,
            UserSubscription.status == "active",
            UserSubscription.zoho_subscription_id.isnot(None),
            UserSubscription.id != subscription.id  # Exclude the pending subscription
        ).order_by(UserSubscription.payment_date.desc()).first()
        
        zoho_service = ZohoBillingService()
        
        if active_subscription_for_update:
            # User has another active subscription - use update subscription API
            logger.info(f"Using update subscription API for existing subscription {active_subscription_for_update.zoho_subscription_id} (resume checkout)")
            
            # Fetch customer details from Zoho first to include billing and account information
            customer_details = None
            if active_subscription_for_update.zoho_customer_id:
                logger.info(f"Fetching customer details from Zoho for customer ID: {active_subscription_for_update.zoho_customer_id} (resume)")
                customer_details = zoho_service.get_customer_details(active_subscription_for_update.zoho_customer_id)
                
                if not customer_details:
                    logger.warning(f"Could not fetch customer details for customer ID: {active_subscription_for_update.zoho_customer_id} (resume)")
            
            update_data = {
                "plan": {
                    "plan_code": plan.zoho_plan_code,
                    "quantity": 1
                },
                "redirect_url": f"{os.getenv('FRONTEND_URL', 'https://evolra.ai')}/",
                "cancel_url": f"{os.getenv('FRONTEND_URL', 'https://evolra.ai')}/subscription",
            }
            
            # Include customer details if we successfully fetched them
            if customer_details:
                logger.info("Including customer details in update subscription call (resume)")
                
                # Extract and include customer information
                customer_data = {
                    "customer_id": customer_details.get("customer_id"),
                    "display_name": customer_details.get("display_name"),
                    "first_name": customer_details.get("first_name"),
                    "last_name": customer_details.get("last_name"),
                    "email": customer_details.get("email"),
                    "phone": customer_details.get("phone"),
                    "company_name": customer_details.get("company_name"),
                }
                
                # Include billing address if available
                if customer_details.get("billing_address"):
                    customer_data["billing_address"] = customer_details.get("billing_address")
                
                # Include shipping address if available
                if customer_details.get("shipping_address"):
                    customer_data["shipping_address"] = customer_details.get("shipping_address")
                
                update_data["customer"] = customer_data
                logger.info(f"Added customer data to update payload (resume): {customer_data}")
            else:
                logger.warning("No customer details available - proceeding without customer data in update (resume)")
            
            checkout_url = zoho_service.get_subscription_update_hosted_page_url(
                active_subscription_for_update.zoho_subscription_id, 
                update_data
            )
        else:
            # No active subscription to update - use new subscription API
            # But pass customer_id if they're an existing customer to avoid duplicates
            existing_customer_id = existing_customer_subscription.zoho_customer_id if existing_customer_subscription else None
            
            if existing_customer_id:
                logger.info(f"Using new subscription API for existing customer {existing_customer_id} (resume checkout)")
            else:
                logger.info(f"Using new subscription API for completely new user {user_id} (resume checkout)")
            
            subscription_data = format_subscription_data_for_hosted_page(
                user_id=user_id,
                user_data=user_data,
                plan_code=plan.zoho_plan_code,
                addon_codes=[],  # No add-ons for now when resuming
                existing_customer_id=existing_customer_id,
                billing_address=None,  # No new address data when resuming
                shipping_address=None,  # No new address data when resuming
                gstin=None  # No new GSTIN when resuming
            )
            
            checkout_url = zoho_service.get_hosted_page_url(subscription_data)
        
        if not checkout_url:
            raise HTTPException(status_code=500, detail="Failed to generate checkout URL")
            
        return {"checkout_url": checkout_url}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error resuming checkout: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error resuming checkout: {str(e)}")

# Add endpoint to cancel a pending subscription
@router.post("/cancel-pending/{subscription_id}")
async def cancel_pending_subscription(
    subscription_id: int,
    db: Session = Depends(get_db),
    current_user: Union[dict, User] = Depends(get_current_user),
):
    """Cancel a pending subscription"""
    try:
        # Find the pending subscription
        subscription = db.query(UserSubscription).filter(
            UserSubscription.id == subscription_id,
            UserSubscription.status == "pending"
        ).first()
        
        if not subscription:
            raise HTTPException(status_code=404, detail="Pending subscription not found")
            
        # Verify that the subscription belongs to the current user or user is admin
        if isinstance(current_user, dict):
            requester_id = current_user.get("user_id")
            is_admin = current_user.get("role") == "admin"
        else:
            requester_id = current_user.user_id
            is_admin = current_user.role == "admin"
            
        if subscription.user_id != requester_id and not is_admin:
            raise HTTPException(status_code=403, detail="Not authorized to cancel this subscription")
            
        # Mark the subscription as cancelled
        subscription.status = "cancelled"
        subscription.notes = "Cancelled by user before checkout completion"
        subscription.updated_at = datetime.now()
        
        db.commit()
        
        return {"success": True, "message": "Pending subscription cancelled"}
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error cancelling pending subscription: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error cancelling pending subscription: {str(e)}") 