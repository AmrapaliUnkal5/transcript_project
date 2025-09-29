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
import traceback
from app.schemas import ZohoCheckoutRequest, ZohoCheckoutResponse, CancelSubscriptionRequest, CancelSubscriptionResponse
from app.utils.create_access_token import create_access_token
from fastapi.responses import JSONResponse
from app.utils.logger import get_module_logger, get_webhook_logger
from app.config import settings

router = APIRouter(prefix="/zoho", tags=["Zoho Subscriptions"])
logger = get_module_logger(__name__)
webhook_logger = get_webhook_logger()

# Create a Zoho Billing Service instance
zoho_service = ZohoBillingService()

# Webhook detection configuration
ADDON_DETECTION_CONFIG = {
    "keywords": ["addon", "add-on", "additional", "extra", "premium", "feature"],
    "item_types": ["addon", "add_on"],
    "item_categories": ["addon", "add_on"],
    "small_amount_threshold": 50,  # Adjust based on your addon pricing
}

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
        print("checkout is called !!!")
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
        print("Reached here")
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
            print("existing_temp_sub=>",existing_temp_sub)
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
        print("existing_customer_subscription=>",existing_customer_subscription)
        # Check if user has an active subscription that can be updated
        active_subscription_for_update = db.query(UserSubscription).filter(
            UserSubscription.user_id == user_id,
            UserSubscription.status == "active",
            UserSubscription.zoho_subscription_id.isnot(None)
        ).order_by(UserSubscription.payment_date.desc()).first()
        print("active_subscription_for_update",active_subscription_for_update)
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
                print("customer_details=>",customer_details)
                if not customer_details:
                    logger.warning(f"Could not fetch customer details for customer ID: {active_subscription_for_update.zoho_customer_id}")
            state = request.billing_address.get("state") if request.billing_address else None
            country = request.billing_address.get("country") if request.billing_address else None

            should_apply_tax = (
                country 
                and country.lower() in ["india", "in", "ind"]  
                and country 
                and country.lower() not in ["rajasthan", "rj"]
            )
            update_data = {
                "plan": {
                    "plan_code": plan.zoho_plan_code,
                    "quantity": 1,
                },
                #"redirect_url": f"{os.getenv('FRONTEND_URL', 'https://evolra.ai')}/",
                "redirect_url": f"{os.getenv('FRONTEND_URL', 'https://evolra.ai')}/dashboard/welcome?payment=success",
                "cancel_url": f"{os.getenv('FRONTEND_URL', 'https://evolra.ai')}/subscription",
            }

            # Apply tax_id only for India and non-Rajasthan states
            if should_apply_tax:
                update_data["plan"]["tax_id"] = "2818287000000032409"
                update_data["plan"]["tax_exemption_code"] = ""

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
                
                # update_data["addons"] = [
                #     {"addon_code": code, "quantity": count} 
                #     for code, count in addon_counts.items()
                # ]

                update_data["addons"]=[
                    {
                        "addon_code": code, 
                        "quantity": count,
                        # Apply tax to each addon if needed
                        **({"tax_id": "2818287000000032409", "tax_exemption_code": ""} if should_apply_tax else {})
                    } 
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
            subscription_data["redirect_url"] = f"{settings.BASE_URL}/dashboard/welcome?payment=success"
            
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

# Cancel subscription at term end and disable auto_renew locally
@router.post("/subscription/cancel", response_model=CancelSubscriptionResponse)
async def cancel_subscription(
    request: CancelSubscriptionRequest,
    db: Session = Depends(get_db),
    current_user: Union[dict, User] = Depends(get_current_user),
):
    try:
        # Determine user id
        user_id = current_user.get("user_id") if isinstance(current_user, dict) else current_user.user_id

        # Find the latest active subscription
        subscription = db.query(UserSubscription).filter(
            UserSubscription.user_id == user_id,
            UserSubscription.status == "active"
        ).order_by(UserSubscription.expiry_date.desc()).first()

        if not subscription or not subscription.zoho_subscription_id:
            raise HTTPException(status_code=404, detail="Active subscription not found")

        # Request Zoho to cancel at term end
        zoho_service = ZohoBillingService()
        zoho_service.cancel_subscription(subscription.zoho_subscription_id, cancel_at_term_end=True, reason=request.reason)

        # Update DB - disable auto_renew
        subscription.auto_renew = False
        subscription.updated_at = datetime.now()
        note = "Cancelled at term end by user"
        subscription.notes = f"{(subscription.notes or '').strip()} | {note}".strip(" |")
        db.commit()

        return CancelSubscriptionResponse(success=True, message="Subscription will not auto-renew.")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error cancelling subscription: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error cancelling subscription: {str(e)}")
    
@router.post("/zoho/webhook_addon_test")
async def webhook_addon_test(request: Request):
    return {"status": "ok"}


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

        print(f"Webhook payload---------=======: {payload}")
        
        # Save payload to file for debugging (especially for new subscription format)
        if "subscription" in payload:
            try:
                import json
                debug_file = "backend/logs/subscription_webhook_payload.txt"
                with open(debug_file, "a") as f:
                    f.write(f"\n{datetime.now().isoformat()} - Subscription Webhook Payload:\n")
                    f.write(json.dumps(payload, indent=2))
                    f.write("\n" + "="*50 + "\n")
                webhook_logger.info(f"💾 Saved subscription webhook payload to {debug_file}")
            except Exception as e:
                webhook_logger.warning(f"Could not save subscription webhook payload: {str(e)}")
        
        # Enhanced logging for debugging
        event_type = payload.get("event_type")
        
        # Extract key information for better logging
        customer_email = None
        user_info = None
        plan_info = None
        addon_info = None
        
        # Extract customer information from different payload structures
        if "customer" in payload:
            customer_email = payload["customer"].get("email")
        elif "payment" in payload:
            customer_email = payload["payment"].get("email")
        elif "email" in payload:
            customer_email = payload.get("email")
        
        # Extract subscription/plan information
        if "subscription" in payload:
            sub_data = payload["subscription"]
            plan_info = {
                "subscription_id": sub_data.get("subscription_id"),
                "plan_code": sub_data.get("plan", {}).get("plan_code"),
                "status": sub_data.get("status"),
                "amount": sub_data.get("amount"),
                "currency": sub_data.get("currency_code")
            }
            
            # Extract addon information from subscription
            if "addons" in sub_data and sub_data["addons"]:
                addon_info = []
                for addon in sub_data["addons"]:
                    addon_info.append({
                        "addon_code": addon.get("addon_code"),
                        "addon_instance_id": addon.get("addon_instance_id"),
                        "quantity": addon.get("quantity", 1)
                    })
        
        # Extract addon information from payment/invoice structure
        if not addon_info:
            payment_data = payload.get("payment", {})
            invoice_data = payload.get("invoice", {})
            line_items = payment_data.get("line_items", []) or invoice_data.get("line_items", [])
            
            # Check for upgrade transactions in invoices (separate addon purchases)
            invoices = payment_data.get("invoices", [])
            if invoices:
                for invoice in invoices:
                    if invoice.get("transaction_type") == "upgrade":
                        # This is likely an addon purchase
                        addon_info = [{
                            "transaction_type": "upgrade",
                            "invoice_id": invoice.get("invoice_id"),
                            "subscription_ids": invoice.get("subscription_ids", []),
                            "amount": invoice.get("invoice_amount")
                        }]
                        break
            
            # Original line items check
            if line_items and not addon_info:
                addon_info = []
                for item in line_items:
                    if item.get("item_type", "").lower() in ["addon", "add_on"] or item.get("addon_code"):
                        addon_info.append({
                            "addon_code": item.get("addon_code") or item.get("item_code"),
                            "quantity": item.get("quantity", 1),
                            "item_type": item.get("item_type")
                        })
        
        # Log comprehensive webhook information
        webhook_logger.info(
            f"🔔 ZOHO WEBHOOK RECEIVED - {event_type or 'UNKNOWN_EVENT'}",
            extra={
                "event_type": event_type,
                "timestamp": timestamp,
                "customer_email": customer_email,
                "plan_info": plan_info,
                "addon_info": addon_info,
                "webhook_details": {
                    "url": str(request.url),
                    "method": request.method,
                    "user_agent": request.headers.get("user-agent"),
                    "content_length": request.headers.get("content-length"),
                    "source_ip": request.headers.get("x-forwarded-for") or request.client.host if request.client else "unknown"
                },
                "raw_payload": payload
            }
        )
        
        # Also log in a more readable format for debugging
        webhook_logger.info(
            f"📋 WEBHOOK SUMMARY: Event='{event_type}' | Customer='{customer_email}' | "
            f"Plan='{plan_info.get('plan_code') if plan_info else 'N/A'}' | "
            f"Addons='{len(addon_info) if addon_info else 0}' | "
            f"IP='{request.headers.get('x-forwarded-for') or (request.client.host if request.client else 'unknown')}'"
        )
        
        # If event_type is null, try to determine from payload structure
        if event_type is None:
            webhook_logger.warning("🔍 Event type is null, attempting to auto-detect from payload structure")
            
            # Check if this is a payment-related webhook
            if "payment" in payload:
                payment_data = payload["payment"]
                payment_status = payment_data.get("status") or payment_data.get("payment_status")
                
                # Check for addon purchases vs subscription upgrades
                invoices = payment_data.get("invoices", [])
                
                # Enhanced logic to distinguish addon purchases from subscription upgrades
                is_addon_purchase = False
                if invoices:
                    for invoice in invoices:
                        transaction_type = invoice.get("transaction_type")
                        subscription_ids = invoice.get("subscription_ids", [])
                        invoice_amount = invoice.get("invoice_amount", 0)
                        
                        if transaction_type == "upgrade":
                            # Check multiple indicators for addon vs plan upgrade
                            line_items = payment_data.get("line_items", [])
                            
                            # 1. Check for explicit addon indicators in line items
                            has_addon_line_items = any(
                                item.get("item_type") in ADDON_DETECTION_CONFIG["item_types"] or 
                                item.get("item_category") in ADDON_DETECTION_CONFIG["item_categories"] or
                                any(keyword in item.get("name", "").lower() for keyword in ADDON_DETECTION_CONFIG["keywords"])
                                for item in line_items
                            )
                            
                            # 2. Check invoice description for addon keywords
                            invoice_description = payment_data.get("description", "").lower()
                            has_addon_description = any(keyword in invoice_description for keyword in 
                                ADDON_DETECTION_CONFIG["keywords"])
                            
                            # 3. Check amount patterns (heuristic: small amounts often indicate addons)
                            is_small_amount = 0 < invoice_amount < ADDON_DETECTION_CONFIG["small_amount_threshold"]
                            
                            # Decision logic
                            if has_addon_line_items or has_addon_description:
                                # Strong indicators for addon purchase
                                is_addon_purchase = True
                                webhook_logger.info(f"🔌 DETECTION: Identified as addon purchase", extra={
                                    "has_addon_line_items": has_addon_line_items,
                                    "has_addon_description": has_addon_description,
                                    "invoice_amount": invoice_amount
                                })
                                break
                            elif subscription_ids and not has_addon_line_items and not has_addon_description:
                                # Strong indicators for subscription plan upgrade
                                is_addon_purchase = False
                                webhook_logger.info(f"🔄 DETECTION: Identified as subscription upgrade", extra={
                                    "subscription_ids": subscription_ids,
                                    "invoice_amount": invoice_amount,
                                    "no_addon_indicators": True
                                })
                            else:
                                # Ambiguous case - log for manual review
                                webhook_logger.warning(f"⚠️ DETECTION: Ambiguous upgrade transaction", extra={
                                    "transaction_type": transaction_type,
                                    "subscription_ids": subscription_ids,
                                    "invoice_amount": invoice_amount,
                                    "line_items_count": len(line_items),
                                    "manual_review_needed": True
                                })
                                # Default to subscription upgrade for safety
                                is_addon_purchase = False
                
                if payment_status == "success" or payment_status == "paid":
                    if is_addon_purchase:
                        event_type = "addon_payment_success"
                        webhook_logger.info("🔌 Auto-detected: addon_payment_success event (upgrade transaction)")
                    else:
                        event_type = "payment_success"
                        webhook_logger.info("✅ Auto-detected: payment_success event from payload structure")
                elif payment_status == "failed":
                    if is_addon_purchase:
                        event_type = "addon_payment_failed" 
                        webhook_logger.info("❌ Auto-detected: addon_payment_failed event (upgrade transaction)")
                    else:
                        event_type = "payment_failed"
                        webhook_logger.info("❌ Auto-detected: payment_failed event from payload structure")
            elif "subscription" in payload:
                # Check subscription status to determine event type
                sub_status = payload.get("subscription", {}).get("status", "").lower()
                if sub_status == "live" or sub_status == "active":
                    event_type = "subscription_created"
                    webhook_logger.info("🆕 Auto-detected: subscription_created event from payload structure")
                elif sub_status == "cancelled":
                    event_type = "subscription_cancelled"  
                    webhook_logger.info("🚫 Auto-detected: subscription_cancelled event from payload structure")
        
        # Check if this is a direct subscription webhook (new format) - PRIORITIZE THIS
        if "subscription" in payload:
            subscription_status = payload.get("subscription", {}).get("status", "").lower()
            if subscription_status in ["live", "active"]:
                event_type = "subscription_active"
            elif subscription_status == "cancelled":
                event_type = "subscription_cancelled"
            else:
                event_type = "subscription_updated"
            webhook_logger.info(f"🎯 Auto-detected subscription webhook: {event_type} (status: {subscription_status})")
        
        # Handle different event types with detailed logging
        webhook_logger.info(f"🔄 Processing webhook event: {event_type}")
        
        # PRIORITY: Handle subscription webhook format first (this replaces payment webhooks)
        if event_type in ["subscription_active", "subscription_updated", "subscription_cancelled"] or \
           (not event_type and "subscription" in payload) or "subscription" in payload:
            webhook_logger.info(f"🎯 SUBSCRIPTION WEBHOOK: Processing subscription event for {customer_email}")
            result = await handle_subscription_webhook(payload, db)
            webhook_logger.info(f"✅ SUBSCRIPTION WEBHOOK result: {result}", extra={"event_result": result})
            
        # LEGACY: Keep old handlers for backward compatibility but deprioritize them
        elif event_type == "subscription_created":
            webhook_logger.info(f"📦 LEGACY SUBSCRIPTION_CREATED: Processing for {customer_email} with plan {plan_info.get('plan_code') if plan_info else 'N/A'}")
            result = await handle_subscription_created(payload, db)
            webhook_logger.info(f"✅ LEGACY SUBSCRIPTION_CREATED result: {result}", extra={"event_result": result})
            
        elif event_type == "subscription_cancelled":
            webhook_logger.info(f"🚫 SUBSCRIPTION_CANCELLED: Processing for {customer_email}")
            result = await handle_subscription_cancelled(payload, db)
            webhook_logger.info(f"✅ SUBSCRIPTION_CANCELLED result: {result}", extra={"event_result": result})
            
        elif event_type == "subscription_renewed":
            webhook_logger.info(f"🔄 SUBSCRIPTION_RENEWED: Processing for {customer_email} with plan {plan_info.get('plan_code') if plan_info else 'N/A'}")
            result = await handle_subscription_renewed(payload, db)
            webhook_logger.info(f"✅ SUBSCRIPTION_RENEWED result: {result}", extra={"event_result": result})
            
        elif event_type in ["payment_failed", "subscription_payment_failed", "hostedpage_payment_failed"]:
            webhook_logger.warning(f"❌ LEGACY PAYMENT_FAILED: Redirecting to subscription webhook for {customer_email}")
            # Try to convert payment failed to subscription format and process
            if "payment" in payload:
                # Convert payment webhook to subscription format for consistent processing
                converted_payload = await _convert_payment_to_subscription_format(payload, "failed")
                if converted_payload:
                    result = await handle_subscription_webhook(converted_payload, db)
                else:
                    result = await handle_payment_failed(payload, db)
            else:
                result = await handle_payment_failed(payload, db)
            webhook_logger.info(f"✅ PAYMENT_FAILED handled: {result}", extra={"event_result": result})
            
        elif event_type == "payment_success":
            webhook_logger.warning(f"💰 LEGACY PAYMENT_SUCCESS: Redirecting to subscription webhook for {customer_email}")
            # Try to convert payment success to subscription format and process
            if "payment" in payload:
                # Convert payment webhook to subscription format for consistent processing
                converted_payload = await _convert_payment_to_subscription_format(payload, "active")
                if converted_payload:
                    result = await handle_subscription_webhook(converted_payload, db)
                else:
                    result = await handle_payment_success(payload, db)
            else:
                result = await handle_payment_success(payload, db)
            webhook_logger.info(f"✅ PAYMENT_SUCCESS result: {result}", extra={"event_result": result})
            
        elif event_type in ["invoice_payment_success", "addon_purchased", "addon_payment_success"]:
            webhook_logger.info(f"🔌 LEGACY ADDON: Redirecting addon events to subscription webhook for {customer_email}")
            # All addon purchases now come through subscription webhook with addons array
            if "subscription" in payload:
                result = await handle_subscription_webhook(payload, db)
            else:
                # Legacy addon webhook - try to process with existing handler
                result = await handle_addon_payment_success(payload, db)
            webhook_logger.info(f"✅ ADDON_PAYMENT_SUCCESS result: {result}", extra={"event_result": result})
            
        elif event_type in ["addon_payment_failed", "invoice_payment_failed"]:
            webhook_logger.warning(f"❌ LEGACY ADDON FAILED: Processing for {customer_email}")
            # Legacy addon failure handling
            result = await handle_addon_payment_failed(payload, db)
            webhook_logger.info(f"✅ ADDON_PAYMENT_FAILED handled: {result}", extra={"event_result": result})
            
        else:
            webhook_logger.warning(f"⚠️ UNHANDLED EVENT: {event_type} for {customer_email}")
            webhook_logger.warning(f"Unhandled payload structure", extra={"unhandled_payload": payload})
            result = {"status": "unhandled", "message": f"Event type {event_type} not handled"}
            # Return success even for unhandled events to avoid webhook retries
        
        webhook_logger.info(f"🎉 WEBHOOK PROCESSING COMPLETED: {event_type} for {customer_email}", 
                           extra={"final_status": "success", "event_type": event_type, "customer": customer_email})
        
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

# Test endpoint to simulate addon payment webhook (legacy - now redirects to subscription webhook)
@router.post("/webhook/test-addon")
async def test_addon_webhook(request: Request, db: Session = Depends(get_db)):
    """Test endpoint to simulate addon payment webhook - now redirects to subscription webhook"""
    try:
        payload = await request.json()
        
        print(f"Testing addon webhook (redirecting to subscription webhook): {payload}")
        
        # All addon processing now goes through subscription webhook
        if "subscription" in payload:
            result = await handle_subscription_webhook(payload, db)
        else:
            # For backward compatibility, try legacy handler
            result = await handle_addon_payment_success(payload, db)
        
        return {
            "status": "success",
            "message": "Test addon webhook processed via subscription webhook",
            "result": result,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error in test addon webhook: {str(e)}")
        return {
            "status": "error",
            "message": f"Test failed: {str(e)}",
            "timestamp": datetime.now().isoformat()
        }



# Test endpoint to simulate subscription webhook
@router.post("/webhook/test-subscription")
async def test_subscription_webhook(request: Request, db: Session = Depends(get_db)):
    """Test endpoint to simulate subscription webhook for testing"""
    try:
        payload = await request.json()
        
        print(f"Testing subscription webhook with payload: {payload}")
        
        # Process through the new subscription webhook handler
        result = await handle_subscription_webhook(payload, db)
        
        return {
            "status": "success",
            "message": "Test subscription webhook processed",
            "result": result,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error in test subscription webhook: {str(e)}")
        return {
            "status": "error",
            "message": f"Test failed: {str(e)}",
            "timestamp": datetime.now().isoformat()
        }



# Helper function to convert payment webhook to subscription webhook format
async def _convert_payment_to_subscription_format(payload: Dict[str, Any], status: str = "active") -> Dict[str, Any]:
    """Convert old payment webhook format to subscription webhook format for consistent processing"""
    try:
        payment_data = payload.get("payment", {})
        if not payment_data:
            return None
        
        # Extract basic info
        customer_id = payment_data.get("customer_id")
        email = payment_data.get("email")
        amount = payment_data.get("amount", 0)
        currency_code = payment_data.get("currency_code", "USD")
        payment_date = payment_data.get("date")
        
        # Extract subscription ID from invoices
        invoices = payment_data.get("invoices", [])
        subscription_id = None
        invoice_id = None
        plan_code = None
        
        if invoices and len(invoices) > 0:
            first_invoice = invoices[0]
            invoice_id = first_invoice.get("invoice_id")
            subscription_ids = first_invoice.get("subscription_ids", [])
            if subscription_ids:
                subscription_id = subscription_ids[0]
        
        # Try to get plan code from line items or database lookup
        line_items = payment_data.get("line_items", [])
        for item in line_items:
            if item.get("item_type") != "addon":  # Skip addon items
                # This could be a plan item, try to match it
                item_name = item.get("name", "")
                item_code = item.get("item_code", "")
                # You might need to add logic here to map item codes to plan codes
                # For now, we'll try to find it in the database
                break
        
        # Create subscription format payload
        converted_payload = {
            "subscription": {
                "subscription_id": subscription_id,
                "status": status,
                "amount": amount,
                "currency_code": currency_code,
                "created_time": payment_date,
                "start_date": payment_date,
                "child_invoice_id": invoice_id,
                "customer": {
                    "customer_id": customer_id,
                    "email": email
                },
                "plan": {
                    "plan_code": plan_code  # This might be None, which is okay
                },
                "addons": []  # Will be populated if needed
            }
        }
        
        webhook_logger.info(f"🔄 Converted payment webhook to subscription format for processing")
        return converted_payload
        
    except Exception as e:
        webhook_logger.warning(f"Could not convert payment to subscription format: {str(e)}")
        return None



# Admin endpoint to check USD price list configuration
@router.get("/usd-config/check")
async def check_usd_configuration(
    current_user: Union[dict, User] = Depends(get_current_user),
):
    """Check USD price list configuration status"""
    try:
        # Validate admin access
        if isinstance(current_user, dict):
            is_admin = current_user.get("role") == "admin"
        else:
            is_admin = current_user.role == "admin"
            
        if not is_admin:
            raise HTTPException(status_code=403, detail="Admin access required")
        
        # Check USD configuration
        zoho_service = ZohoBillingService()
        validation_result = zoho_service.validate_usd_price_list_setup()
        
        return {
            "status": "success",
            "timestamp": datetime.now().isoformat(),
            "usd_configuration": validation_result,
            "instructions": {
                "if_not_configured": "Set ZOHO_USD_PRICE_LIST_ID environment variable with your USD price list ID from Zoho Billing",
                "how_to_create": "Create a new price list in Zoho Billing with USD currency and copy its ID"
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error checking USD configuration: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error checking USD configuration: {str(e)}")

# Admin endpoint to view recent webhook logs
@router.get("/webhook-logs/recent")
async def get_recent_webhook_logs(
    limit: int = 50,
    current_user: Union[dict, User] = Depends(get_current_user),
):
    """Get recent webhook logs (admin only)"""
    try:
        # Validate admin access
        if isinstance(current_user, dict):
            is_admin = current_user.get("role") == "admin"
        else:
            is_admin = current_user.role == "admin"
            
        if not is_admin:
            raise HTTPException(status_code=403, detail="Admin access required")
        
        # Read recent webhook logs
        webhook_log_path = "backend/logs/webhook.log"
        recent_logs = []
        
        try:
            with open(webhook_log_path, 'r') as f:
                # Get last N lines (recent logs)
                lines = f.readlines()
                recent_lines = lines[-limit:] if len(lines) > limit else lines
                
                for line in recent_lines:
                    try:
                        import json
                        log_entry = json.loads(line.strip())
                        recent_logs.append(log_entry)
                    except json.JSONDecodeError:
                        # Handle non-JSON log lines
                        recent_logs.append({"raw_message": line.strip()})
                        
        except FileNotFoundError:
            return {
                "status": "warning",
                "message": "Webhook log file not found",
                "logs": [],
                "timestamp": datetime.now().isoformat()
            }
        
        return {
            "status": "success",
            "webhook_logs": recent_logs[-limit:],  # Most recent first
            "total_entries": len(recent_logs),
            "log_file": webhook_log_path,
            "timestamp": datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving webhook logs: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error retrieving webhook logs: {str(e)}")

# Admin endpoint to get webhook statistics
@router.get("/webhook-logs/stats")
async def get_webhook_statistics(
    current_user: Union[dict, User] = Depends(get_current_user),
):
    """Get webhook processing statistics (admin only)"""
    try:
        # Validate admin access
        if isinstance(current_user, dict):
            is_admin = current_user.get("role") == "admin"
        else:
            is_admin = current_user.role == "admin"
            
        if not is_admin:
            raise HTTPException(status_code=403, detail="Admin access required")
        
        webhook_log_path = "backend/logs/webhook.log"
        stats = {
            "total_webhooks": 0,
            "successful_processing": 0,
            "errors": 0,
            "event_types": {},
            "recent_activity": []
        }
        
        try:
            with open(webhook_log_path, 'r') as f:
                lines = f.readlines()
                
                for line in lines:
                    if "ZOHO WEBHOOK RECEIVED" in line:
                        stats["total_webhooks"] += 1
                        
                        # Extract event type
                        if " - " in line:
                            event_part = line.split(" - ")[-1].strip()
                            event_type = event_part.split()[0] if event_part else "unknown"
                            stats["event_types"][event_type] = stats["event_types"].get(event_type, 0) + 1
                    
                    if "WEBHOOK PROCESSING COMPLETED" in line:
                        stats["successful_processing"] += 1
                    
                    if "ERROR" in line or "❌" in line:
                        stats["errors"] += 1
                
                # Get recent activity (last 10 entries)
                recent_lines = lines[-10:] if len(lines) > 10 else lines
                for line in recent_lines:
                    if any(keyword in line for keyword in ["RECEIVED", "COMPLETED", "ERROR"]):
                        try:
                            import json
                            log_entry = json.loads(line.strip())
                            stats["recent_activity"].append({
                                "timestamp": log_entry.get("timestamp"),
                                "level": log_entry.get("level"),
                                "message": log_entry.get("message", "")[:100] + "..." if len(log_entry.get("message", "")) > 100 else log_entry.get("message", "")
                            })
                        except:
                            # Handle non-JSON lines
                            stats["recent_activity"].append({"raw": line.strip()[:100]})
                            
        except FileNotFoundError:
            return {
                "status": "warning",
                "message": "Webhook log file not found",
                "stats": stats,
                "timestamp": datetime.now().isoformat()
            }
        
        # Calculate success rate
        if stats["total_webhooks"] > 0:
            stats["success_rate"] = round((stats["successful_processing"] / stats["total_webhooks"]) * 100, 2)
            stats["error_rate"] = round((stats["errors"] / stats["total_webhooks"]) * 100, 2)
        else:
            stats["success_rate"] = 0
            stats["error_rate"] = 0
        
        return {
            "status": "success",
            "statistics": stats,
            "log_file": webhook_log_path,
            "timestamp": datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating webhook statistics: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error generating webhook statistics: {str(e)}")

async def handle_subscription_webhook(payload: Dict[str, Any], db: Session):
    """Handle subscription webhook events with rich subscription data"""
    webhook_logger.info("🎯 SUBSCRIPTION WEBHOOK: Processing subscription event", extra={"handler": "handle_subscription_webhook"})
    
    try:
        # Extract subscription and customer details from the new payload structure
        subscription_data = payload.get("subscription", {})
        customer_data = subscription_data.get("customer", {})
        
        if not subscription_data:
            webhook_logger.error("❌ SUBSCRIPTION WEBHOOK: No subscription data found in payload")
            return {"status": "error", "message": "Invalid webhook payload - missing subscription data"}
        
        # Extract key identifiers
        zoho_subscription_id = subscription_data.get("subscription_id")
        zoho_customer_id = customer_data.get("customer_id")
        customer_email = customer_data.get("email")
        subscription_status = subscription_data.get("status", "").lower()
        plan_data = subscription_data.get("plan", {})
        plan_code = plan_data.get("plan_code")
        addons_data = subscription_data.get("addons", [])
        
        webhook_logger.info("📋 SUBSCRIPTION WEBHOOK: Extracted data", extra={
            "zoho_subscription_id": zoho_subscription_id,
            "zoho_customer_id": zoho_customer_id,
            "customer_email": customer_email,
            "subscription_status": subscription_status,
            "plan_code": plan_code,
            "addons_count": len(addons_data)
        })
        
        if not zoho_subscription_id or not customer_email or not plan_code:
            webhook_logger.error("❌ SUBSCRIPTION WEBHOOK: Missing required subscription data", extra={
                "missing_fields": {
                    "subscription_id": not zoho_subscription_id,
                    "email": not customer_email, 
                    "plan_code": not plan_code
                }
            })
            return {"status": "error", "message": "Invalid webhook payload - missing required fields"}
        
        # Find the user by email - try multiple approaches like the payment webhook
        user = None
        if customer_email:
            user = db.query(User).filter(User.email == customer_email).first()
        
        # If not found by customer email, try to find by customer ID in existing subscriptions
        if not user and zoho_customer_id:
            existing_user_sub = db.query(UserSubscription).filter(
                UserSubscription.zoho_customer_id == zoho_customer_id
            ).first()
            if existing_user_sub:
                user = db.query(User).filter(User.user_id == existing_user_sub.user_id).first()
                if user:
                    webhook_logger.info(f"👤 SUBSCRIPTION WEBHOOK: Found user {user.user_id} via customer ID {zoho_customer_id}")
        
        if not user:
            webhook_logger.error(f"❌ SUBSCRIPTION WEBHOOK: User with email {customer_email} or customer_id {zoho_customer_id} not found in database")
            return {"status": "error", "message": f"User not found: {customer_email}"}
        
        user_id = user.user_id
        webhook_logger.info(f"👤 SUBSCRIPTION WEBHOOK: Found user {user_id} for email {customer_email}")
        
        # Find the plan in our database
        plan = None
        if plan_code:
            plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.zoho_plan_code == plan_code).first()
        
        # If plan not found by code, try to find it by looking up existing subscription
        if not plan and zoho_subscription_id:
            existing_sub = db.query(UserSubscription).filter(
                UserSubscription.zoho_subscription_id == zoho_subscription_id
            ).first()
            if existing_sub:
                plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == existing_sub.subscription_plan_id).first()
                if plan:
                    webhook_logger.info(f"🔍 SUBSCRIPTION WEBHOOK: Found plan {plan.name} via existing subscription lookup")
        
        # If still no plan found, try to find from user's pending subscription
        if not plan and user_id:
            pending_sub = db.query(UserSubscription).filter(
                UserSubscription.user_id == user_id,
                UserSubscription.status == "pending"
            ).order_by(UserSubscription.created_at.desc()).first()
            if pending_sub:
                plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == pending_sub.subscription_plan_id).first()
                if plan:
                    webhook_logger.info(f"🔍 SUBSCRIPTION WEBHOOK: Found plan {plan.name} via pending subscription lookup")
        
        if not plan:
            webhook_logger.error(f"❌ SUBSCRIPTION WEBHOOK: Plan with code {plan_code} not found in database (also tried subscription lookups)")
            return {"status": "error", "message": f"Plan not found: {plan_code}"}
        
        # Extract subscription details
        amount = subscription_data.get("amount", 0)
        currency_code = subscription_data.get("currency_code", "USD")
        created_time = subscription_data.get("created_time")
        start_date = subscription_data.get("start_date")
        next_billing_at = subscription_data.get("next_billing_at")
        current_term_ends_at = subscription_data.get("current_term_ends_at")
        
        # Parse dates
        payment_date = datetime.now()
        if created_time:
            try:
                # Handle different datetime formats from Zoho
                if 'T' in created_time:
                    payment_date = datetime.fromisoformat(created_time.replace('Z', '+00:00'))
                else:
                    payment_date = datetime.strptime(created_time, '%Y-%m-%d')
            except Exception as e:
                webhook_logger.warning(f"Could not parse created_time {created_time}: {str(e)}")
        elif start_date:
            try:
                payment_date = datetime.strptime(start_date, '%Y-%m-%d')
            except Exception as e:
                webhook_logger.warning(f"Could not parse start_date {start_date}: {str(e)}")
        
        expiry_date = payment_date + timedelta(days=30)  # Default fallback
        if current_term_ends_at:
            try:
                if 'T' in current_term_ends_at:
                    expiry_date = datetime.fromisoformat(current_term_ends_at.replace('Z', '+00:00'))
                else:
                    expiry_date = datetime.strptime(current_term_ends_at, '%Y-%m-%d')
            except Exception as e:
                webhook_logger.warning(f"Could not parse current_term_ends_at {current_term_ends_at}: {str(e)}")
        elif next_billing_at:
            try:
                if 'T' in next_billing_at:
                    expiry_date = datetime.fromisoformat(next_billing_at.replace('Z', '+00:00'))
                else:
                    expiry_date = datetime.strptime(next_billing_at, '%Y-%m-%d')
            except Exception as e:
                webhook_logger.warning(f"Could not parse next_billing_at {next_billing_at}: {str(e)}")
        
        # Handle different subscription statuses
        if subscription_status in ["live", "active"]:
            return await _handle_active_subscription(
                db, user_id, zoho_subscription_id, zoho_customer_id, plan, 
                payment_date, expiry_date, amount, currency_code, addons_data, subscription_data
            )
        elif subscription_status == "cancelled":
            return await _handle_cancelled_subscription(db, zoho_subscription_id, subscription_data)
        else:
            webhook_logger.info(f"🔍 SUBSCRIPTION WEBHOOK: Handling subscription status '{subscription_status}' as active")
            return await _handle_active_subscription(
                db, user_id, zoho_subscription_id, zoho_customer_id, plan, 
                payment_date, expiry_date, amount, currency_code, addons_data, subscription_data
            )
            
    except Exception as e:
        db.rollback()
        webhook_logger.error(f"❌ SUBSCRIPTION WEBHOOK ERROR: Failed to process subscription webhook", extra={
            "error": str(e),
            "traceback": traceback.format_exc()
        })
        return {"status": "error", "message": f"Error processing subscription webhook: {str(e)}"}

async def _handle_active_subscription(db: Session, user_id: int, zoho_subscription_id: str, 
                                    zoho_customer_id: str, plan: SubscriptionPlan, 
                                    payment_date: datetime, expiry_date: datetime, 
                                    amount: float, currency_code: str, addons_data: list, 
                                    subscription_data: dict):
    """Helper function to handle active/live subscription creation or update"""
    
    webhook_logger.info(f"📦 SUBSCRIPTION WEBHOOK: Processing active subscription for user {user_id}")
    
    # Check if this subscription already exists
    # existing_subscription = db.query(UserSubscription).filter(
    #     UserSubscription.zoho_subscription_id == zoho_subscription_id
    # ).first()

    existing_subscription = (
    db.query(UserSubscription)
    .filter(UserSubscription.zoho_subscription_id == zoho_subscription_id)
    .order_by(UserSubscription.payment_date.desc())
    .first()
)

    
    print(f"BEFORE UPDATE - Subscription state: {existing_subscription.status if existing_subscription else 'Not found'}")
    if existing_subscription:
        print(" Details=>********************",
            f"[DEBUG] Found subscription row: "
            f"id={existing_subscription.id}, "
            f"user_id={existing_subscription.user_id}, "
            f"plan_id={existing_subscription.subscription_plan_id}, "
            f"status={existing_subscription.status}, "
            f"zoho_sub_id={existing_subscription.zoho_subscription_id}, "
            f"zoho_cust_id={existing_subscription.zoho_customer_id}"
        )
    else:
        print(f"[DEBUG] No subscription row found for zoho_sub_id={zoho_subscription_id}")



    # Check for pending subscription
    pending_subscription = db.query(UserSubscription).filter(
        UserSubscription.user_id == user_id,
        UserSubscription.status == "pending"
    ).order_by(UserSubscription.created_at.desc()).first()

    if pending_subscription:
        print(" Details=>********************",
            f"[DEBUG] Pending subscription row: "
            f"id={pending_subscription.id}, "
            f"user_id={pending_subscription.user_id}, "
            f"plan_id={pending_subscription.subscription_plan_id}, "
            f"status={pending_subscription.status}, "
            f"zoho_sub_id={pending_subscription.zoho_subscription_id}, "
            f"zoho_cust_id={pending_subscription.zoho_customer_id}, "
            f"created_at={pending_subscription.created_at}, "
            f"updated_at={pending_subscription.updated_at}"
        )
    else:
        print(f"[DEBUG] No pending subscription found for user_id={user_id}")



    
    # Check for active subscription (for upgrade scenarios)
    active_subscription = db.query(UserSubscription).filter(
        UserSubscription.user_id == user_id,
        UserSubscription.status == "active"
    ).order_by(UserSubscription.payment_date.desc()).first()
    if active_subscription:
        print(" Details=>********************",
            f"[DEBUG] Active subscription row: "
            f"id={active_subscription.id}, "
            f"user_id={active_subscription.user_id}, "
            f"plan_id={active_subscription.subscription_plan_id}, "
            f"status={active_subscription.status}, "
            f"zoho_sub_id={active_subscription.zoho_subscription_id}, "
            f"zoho_cust_id={active_subscription.zoho_customer_id}, "
            f"payment_date={active_subscription.payment_date}"
        )
    else:
        print(f"[DEBUG] No active subscription found for user_id={user_id}")
    
    to_mark= db.query(UserSubscription).filter(
        UserSubscription.user_id == user_id,
        UserSubscription.status == "active"
    ).order_by(UserSubscription.payment_date.desc()).offset(1).first()

    if to_mark:
        print(" Details=>********************",
            f"[DEBUG] to_mark subscription row: "
            f"id={to_mark.id}, "
            f"user_id={to_mark.user_id}, "
            f"plan_id={to_mark.subscription_plan_id}, "
            f"status={to_mark.status}, "
            f"zoho_sub_id={to_mark.zoho_subscription_id}, "
            f"zoho_cust_id={to_mark.zoho_customer_id}, "
            f"payment_date={to_mark.payment_date}"
        )
    # Extract invoice ID from subscription data
    invoice_id = subscription_data.get("child_invoice_id") or subscription_data.get("invoice_id")
    
    webhook_logger.info(f"🔍 SUBSCRIPTION WEBHOOK: Found - Existing: {existing_subscription is not None}, Pending: {pending_subscription is not None}, Active: {active_subscription is not None}")
    print("existing_subscription=>",existing_subscription)
    if existing_subscription:
        print(" Details=>********************",
            f"[DEBUG] Found subscription row: "
            f"id={existing_subscription.id}, "
            f"user_id={existing_subscription.user_id}, "
            f"plan_id={existing_subscription.subscription_plan_id}, "
            f"status={existing_subscription.status}, "
            f"zoho_sub_id={existing_subscription.zoho_subscription_id}, "
            f"zoho_cust_id={existing_subscription.zoho_customer_id}"
        )
    else:
        print(f"[DEBUG] No subscription row found for zoho_sub_id={zoho_subscription_id}")

    print("pending_subscription=>",pending_subscription)
    if pending_subscription:
        print(" Details=>********************",
            f"[DEBUG] Pending subscription row: "
            f"id={pending_subscription.id}, "
            f"user_id={pending_subscription.user_id}, "
            f"plan_id={pending_subscription.subscription_plan_id}, "
            f"status={pending_subscription.status}, "
            f"zoho_sub_id={pending_subscription.zoho_subscription_id}, "
            f"zoho_cust_id={pending_subscription.zoho_customer_id}, "
            f"created_at={pending_subscription.created_at}, "
            f"updated_at={pending_subscription.updated_at}"
        )
    else:
        print(f"[DEBUG] No pending subscription found for user_id={user_id}")
    # Handle upgrade scenario: existing active subscription + pending subscription + different plans
    if existing_subscription and pending_subscription and existing_subscription.id != pending_subscription.id:
        print("This block of bigger loop is executed")
        if existing_subscription.subscription_plan_id != pending_subscription.subscription_plan_id:
            print("This block inside of bigger loop is executed")
            # UPGRADE CASE: User upgraded their plan
            webhook_logger.info(f"🔄 SUBSCRIPTION WEBHOOK: Upgrade detected - activating new plan", extra={
                "user_id": user_id,
                "old_subscription_id": existing_subscription.id,
                "new_subscription_id": pending_subscription.id,
                "old_plan_id": existing_subscription.subscription_plan_id,
                "new_plan_id": pending_subscription.subscription_plan_id
            })
            
            # Activate the pending subscription (new plan)
            pending_subscription.status = "active"
            pending_subscription.zoho_subscription_id = zoho_subscription_id
            pending_subscription.zoho_customer_id = zoho_customer_id
            print("payment_date=>",payment_date)
            pending_subscription.payment_date = datetime.now()
            pending_subscription.expiry_date = expiry_date
            pending_subscription.amount = amount
            pending_subscription.currency = currency_code
            pending_subscription.updated_at = datetime.now()
            pending_subscription.notes = "Plan upgraded via subscription webhook"
            if invoice_id:
                pending_subscription.zoho_invoice_id = invoice_id
            
            # Mark the old subscription as upgraded
            existing_subscription.status = "upgraded"
            existing_subscription.updated_at = datetime.now()
            existing_subscription.notes = f"Upgraded to plan {plan.name} (subscription ID: {pending_subscription.id})"
            
            subscription_record = pending_subscription
            db.commit()
            webhook_logger.info(f"✅ SUBSCRIPTION WEBHOOK: Plan upgrade completed - old: {existing_subscription.id}, new: {pending_subscription.id}")
        else:
            print("This block else of bigger loop is executed")
            # Same plan, just update existing
            existing_subscription.status = "active"
            existing_subscription.payment_date = payment_date
            existing_subscription.expiry_date = expiry_date
            existing_subscription.amount = amount
            existing_subscription.currency = currency_code
            existing_subscription.updated_at = datetime.now()
            existing_subscription.notes = "Updated via subscription webhook"
            if invoice_id:
                existing_subscription.zoho_invoice_id = invoice_id
            
            subscription_record = existing_subscription
            db.commit()
            webhook_logger.info(f"🔄 SUBSCRIPTION WEBHOOK: Updated existing subscription {existing_subscription.id}")
            
    elif existing_subscription:
        print("This block is getting executed existing_subscription")
        # Update existing subscription (renewal or update)
        existing_subscription.status = "active"
        existing_subscription.payment_date = payment_date
        existing_subscription.expiry_date = expiry_date
        existing_subscription.amount = amount
        existing_subscription.currency = currency_code
        existing_subscription.updated_at = datetime.now()
        existing_subscription.notes = "Updated via subscription webhook"
         # Mark the old subscription as upgraded
        # to_mark.status = "upgraded"
        # to_mark.updated_at = datetime.now()
        if to_mark:
            print(f"[DEBUG] Updating to_mark subscription {to_mark.id} to 'upgraded'")
            to_mark.status = "upgraded"
            to_mark.updated_at = datetime.now()
            to_mark.notes = f"Upgraded to plan {plan.name}"
            print(f"[DEBUG] to_mark updated - status: {to_mark.status}")
        if invoice_id:
            existing_subscription.zoho_invoice_id = invoice_id
        
        subscription_record = existing_subscription
        
       # to_mark.notes = f"Upgraded to plan {plan.name} (subscription ID: {pending_subscription.id})"
        db.commit()
        #db.refresh()

        
       
        
        webhook_logger.info(f"🔄 SUBSCRIPTION WEBHOOK: Updated existing subscription {existing_subscription.id}")
        
    elif pending_subscription:
        print("This block is getting executed pending_subscription")
        # Activate pending subscription (first-time or new subscription)
        pending_subscription.status = "active"
        pending_subscription.zoho_subscription_id = zoho_subscription_id
        pending_subscription.zoho_customer_id = zoho_customer_id
        pending_subscription.subscription_plan_id = plan.id
        pending_subscription.payment_date = payment_date
        pending_subscription.expiry_date = expiry_date
        pending_subscription.amount = amount
        pending_subscription.currency = currency_code
        pending_subscription.updated_at = datetime.now()
        pending_subscription.notes = "Activated via subscription webhook"
        if invoice_id:
            pending_subscription.zoho_invoice_id = invoice_id
        
        subscription_record = pending_subscription
        db.commit()
        webhook_logger.info(f"✅ SUBSCRIPTION WEBHOOK: Activated pending subscription {pending_subscription.id}")
        
    else:
        print("This block is getting executed else block")
        # Create new subscription (no existing or pending found)
        new_subscription = UserSubscription(
            user_id=user_id,
            subscription_plan_id=plan.id,
            status="active",
            amount=amount,
            currency=currency_code,
            payment_date=payment_date,
            expiry_date=expiry_date,
            auto_renew=True,
            zoho_subscription_id=zoho_subscription_id,
            zoho_customer_id=zoho_customer_id,
            notes="Created via subscription webhook"
        )
        if invoice_id:
            new_subscription.zoho_invoice_id = invoice_id
        
        db.add(new_subscription)
        db.flush()  # Get the ID without committing
        subscription_record = new_subscription
        webhook_logger.info(f"🆕 SUBSCRIPTION WEBHOOK: Created new subscription {new_subscription.id}")
    
    # Process addons from the rich subscription data
    addons_processed = 0
    print("Addon logic reached here")
    if addons_data:
        webhook_logger.info(f"🔌 SUBSCRIPTION WEBHOOK: Processing {len(addons_data)} addons")
        
        for addon_item in addons_data:
            addon_code = addon_item.get("addon_code")
            addon_instance_id = addon_item.get("addon_instance_id")
            addon_quantity = addon_item.get("quantity", 1)
            addon_name = addon_item.get("name", "")
            
            webhook_logger.info(f"🔍 SUBSCRIPTION WEBHOOK: Processing addon item", extra={
                "addon_code": addon_code,
                "addon_name": addon_name,
                "addon_quantity": addon_quantity,
                "addon_instance_id": addon_instance_id
            })
            
            if not addon_code:
                webhook_logger.warning("⚠️ SUBSCRIPTION WEBHOOK: Skipping addon without addon_code")
                continue
            
            # Find the addon in our database
            addon = db.query(Addon).filter(Addon.zoho_addon_code == addon_code).first()
            if not addon:
                webhook_logger.warning(f"⚠️ SUBSCRIPTION WEBHOOK: Addon with code {addon_code} not found in database")
                continue
            
            # Fetch all existing active/pending rows for idempotent sync
            existing_rows = db.query(UserAddon).filter(
                UserAddon.user_id == user_id,
                UserAddon.addon_id == addon.id,
                UserAddon.status.in_(["active", "pending"])
            ).order_by(UserAddon.purchase_date.asc()).all()
            
            # All addons should expire with the user's current subscription end date
            # Exception: Additional Messages (addon id == 3) should have no expiry (NULL)
            addon_expiry = None if addon.id == 3 else expiry_date
            
            created_rows = 0
            desired_count = max(int(addon_quantity), 1)
            current_count = len(existing_rows)

            # If we have more rows than desired, deactivate the extras (oldest first)
            if current_count > desired_count:
                to_deactivate = current_count - desired_count
                for row in existing_rows[:to_deactivate]:
                    row.is_active = False
                    row.status = "cancelled"
                    row.updated_at = datetime.now()
                # Keep the newest desired_count rows up-to-date
                kept_rows = existing_rows[to_deactivate:]
                for row in kept_rows:
                    row.status = "active"
                    row.is_active = True
                    row.subscription_id = subscription_record.id
                    row.purchase_date = payment_date
                    row.expiry_date = addon_expiry
                    row.zoho_addon_instance_id = addon_instance_id
                    row.updated_at = datetime.now()
                created_rows += 0
                webhook_logger.info(f"🔄 SUBSCRIPTION WEBHOOK: Normalized addon rows from {current_count} to {desired_count} for user {user_id}")

            # If we have fewer rows than desired, update existing and create the missing ones
            elif current_count < desired_count:
                for row in existing_rows:
                    row.status = "active"
                    row.is_active = True
                    row.subscription_id = subscription_record.id
                    row.purchase_date = payment_date
                    row.expiry_date = addon_expiry
                    row.zoho_addon_instance_id = addon_instance_id
                    row.updated_at = datetime.now()
                to_create = desired_count - current_count
                for _ in range(to_create):
                    new_row = UserAddon(
                        user_id=user_id,
                        addon_id=addon.id,
                        subscription_id=subscription_record.id,
                        purchase_date=payment_date,
                        expiry_date=addon_expiry,
                        is_active=True,
                        auto_renew=addon.is_recurring,
                        status="active",
                        zoho_addon_instance_id=addon_instance_id,
                        initial_count=0,
                        remaining_count=0
                    )
                    db.add(new_row)
                    created_rows += 1
                webhook_logger.info(f"🆕 SUBSCRIPTION WEBHOOK: Added {to_create} addon row(s) to reach desired count {desired_count} for user {user_id}")

            # If counts match, just ensure existing rows are updated
            else:
                for row in existing_rows:
                    row.status = "active"
                    row.is_active = True
                    row.subscription_id = subscription_record.id
                    row.purchase_date = payment_date
                    row.expiry_date = addon_expiry
                    row.zoho_addon_instance_id = addon_instance_id
                    row.updated_at = datetime.now()
                webhook_logger.info(f"ℹ️ SUBSCRIPTION WEBHOOK: Addon rows already at desired count {desired_count} for user {user_id}")

            addons_processed += created_rows
    
    # Commit all changes
    db.commit()
    
    # Create fresh token with updated subscription info
    create_fresh_user_token(db, user_id)
    
    webhook_logger.info(f"✅ SUBSCRIPTION WEBHOOK: Successfully processed subscription for user {user_id}", extra={
        "user_id": user_id,
        "subscription_id": subscription_record.id,
        "zoho_subscription_id": zoho_subscription_id,
        "addons_processed": addons_processed
    })
    
    return {"status": "success", "message": f"Subscription processed successfully with {addons_processed} addons"}

async def _handle_cancelled_subscription(db: Session, zoho_subscription_id: str, subscription_data: dict):
    """Helper function to handle subscription cancellation"""
    
    webhook_logger.info(f"🚫 SUBSCRIPTION WEBHOOK: Processing subscription cancellation for {zoho_subscription_id}")
    
    # Find the subscription in our database
    subscription = db.query(UserSubscription).filter(
        UserSubscription.zoho_subscription_id == zoho_subscription_id
    ).first()
    
    if not subscription:
        webhook_logger.error(f"❌ SUBSCRIPTION WEBHOOK: Subscription {zoho_subscription_id} not found for cancellation")
        return {"status": "error", "message": f"Subscription {zoho_subscription_id} not found"}
    
    # Update subscription status
    subscription.status = "cancelled"
    subscription.auto_renew = False
    subscription.updated_at = datetime.now()
    subscription.notes = "Cancelled via subscription webhook"
    
    user_id = subscription.user_id
    
    # Deactivate associated addons
    user_addons = db.query(UserAddon).filter(
        UserAddon.user_id == user_id,
        UserAddon.subscription_id == subscription.id,
        UserAddon.status == "active"
    ).all()
    
    for addon in user_addons:
        addon.status = "cancelled"
        addon.is_active = False
        addon.updated_at = datetime.now()
    
    db.commit()
    
    # Create fresh token with updated subscription info
    create_fresh_user_token(db, user_id)
    
    webhook_logger.info(f"✅ SUBSCRIPTION WEBHOOK: Successfully cancelled subscription {zoho_subscription_id} for user {user_id}")
    
    return {"status": "success", "message": "Subscription cancelled successfully"}

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
                
                # All addons should expire with the user's current subscription end date
                # Exception: Additional Messages (addon id == 3) should have no expiry (NULL)
                addon_expiry = None if addon.id == 3 else expiry_date
                
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
                    zoho_addon_instance_id=addon_instance_id,
                    initial_count=0,
                    remaining_count=0
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
    print("create_fresh_user_token block is reached")
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
    
    # Get message addon (ID 3) details if exists
    message_addon = db.query(UserAddon).filter(
        UserAddon.user_id == user_id,
        UserAddon.addon_id == 3,
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
                
                # All addons should expire with the user's current subscription end date
                # Exception: Additional Messages (addon id == 3) should have no expiry (NULL)
                existing_addon.expiry_date = None if addon.id == 3 else expiry_date
                
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
                    created_at=datetime.now(),
                    initial_count=0,
                    remaining_count=0
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
            webhook_logger.info(f"ℹ️ PAYMENT FAILED: No pending subscription found for user {user_id} to mark as failed")
            
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
        transaction_type = None
        
        if invoices and len(invoices) > 0:
            first_invoice = invoices[0]
            invoice_id = first_invoice.get("invoice_id")
            transaction_type = first_invoice.get("transaction_type")
            subscription_ids = first_invoice.get("subscription_ids", [])
            if subscription_ids and len(subscription_ids) > 0:
                subscription_id = subscription_ids[0]
        
        print(f"Extracted payment data:")
        print(f"  Customer ID: {customer_id}")
        print(f"  Email: {email}")
        print(f"  Subscription ID: {subscription_id}")
        print(f"  Invoice ID: {invoice_id}")
        print(f"  Transaction Type: {transaction_type}")
        print(f"  Payment Status: {payment_data.get('status')}")
        
        webhook_logger.info("💰 PAYMENT SUCCESS: Processing payment", extra={
            "customer_id": customer_id,
            "email": email,
            "subscription_id": subscription_id,
            "invoice_id": invoice_id,
            "transaction_type": transaction_type,
            "payment_status": payment_data.get('status')
        })
        
        if not customer_id:
            webhook_logger.error("❌ PAYMENT SUCCESS: Missing customer ID in payment success payload")
            return
            
        if not email:
            webhook_logger.error("❌ PAYMENT SUCCESS: Customer email not found in webhook payload")
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
        
        # Handle subscription upgrade logic properly
        if existing_subscription and pending_subscription and transaction_type == "upgrade":
            # UPGRADE CASE: Both existing and pending subscriptions exist
            # The pending subscription represents the new plan, existing is the old plan
            webhook_logger.info(f"🔄 UPGRADE DETECTED: Processing subscription upgrade", extra={
                "user_id": user_id,
                "existing_subscription_id": existing_subscription.id,
                "pending_subscription_id": pending_subscription.id,
                "zoho_subscription_id": subscription_id
            })
            
            # Update the pending subscription (new plan) to active
            pending_subscription.status = "active"
            pending_subscription.zoho_subscription_id = subscription_id
            pending_subscription.zoho_invoice_id = invoice_id
            pending_subscription.zoho_customer_id = customer_id
            pending_subscription.payment_date = datetime.now()
            pending_subscription.updated_at = datetime.now()
            pending_subscription.notes = "Subscription plan upgraded - Payment successful"
            
            # Deactivate the existing subscription (old plan)
            existing_subscription.status = "upgraded"
            existing_subscription.updated_at = datetime.now()
            existing_subscription.notes = f"Upgraded to new plan (subscription ID: {pending_subscription.id})"
            
            # Create a fresh token with the updated subscription info
            create_fresh_user_token(db, user_id)
            
            db.commit()
            
            print(f"SUCCESS: Processed subscription upgrade for user {user_id}")
            print(f"  - Activated new subscription (ID: {pending_subscription.id})")
            print(f"  - Deactivated old subscription (ID: {existing_subscription.id})")
            
            webhook_logger.info(f"✅ SUBSCRIPTION UPGRADE: Successfully processed plan upgrade", extra={
                "user_id": user_id,
                "new_subscription_id": pending_subscription.id,
                "old_subscription_id": existing_subscription.id,
                "zoho_subscription_id": subscription_id
            })
            
        elif existing_subscription and not pending_subscription:
            # EXISTING SUBSCRIPTION RENEWAL/UPDATE (not an upgrade)
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
            
        elif pending_subscription and not existing_subscription:
            # NEW SUBSCRIPTION CASE: Only pending subscription exists (first-time subscription)
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
            # No subscription found - check if this is a standalone addon purchase
            webhook_logger.info(f"🔍 PAYMENT SUCCESS: No subscription found - checking if this is a standalone addon purchase")
            
            # Try to process as addon-only invoice
            if invoice_id and not subscription_id:
                webhook_logger.info(f"💡 PAYMENT SUCCESS: Processing as potential standalone addon purchase (invoice: {invoice_id})")
                
                # Get user's active subscription for linking addons
                active_subscription = db.query(UserSubscription).filter(
                    UserSubscription.user_id == user_id,
                    UserSubscription.status == "active"
                ).order_by(UserSubscription.expiry_date.desc()).first()
                
                if active_subscription:
                    # This could be an addon purchase - delegate to addon handler
                    webhook_logger.info(f"🔗 PAYMENT SUCCESS: Found active subscription for addon purchase - delegating to addon handler")
                    addon_result = await handle_addon_payment_success(payload, db)
                    webhook_logger.info(f"✅ PAYMENT SUCCESS: Addon handler result: {addon_result}")
                    return
                else:
                    webhook_logger.warning(f"⚠️ PAYMENT SUCCESS: No active subscription found for potential addon purchase")
            
            webhook_logger.error(f"❌ PAYMENT SUCCESS: No matching subscription found for payment success event. User: {user_id}, Zoho Subscription: {subscription_id}")
            
            # Log all subscriptions for this user for debugging
            all_subs = db.query(UserSubscription).filter(UserSubscription.user_id == user_id).all()
            sub_debug_info = []
            for sub in all_subs:
                sub_debug_info.append({
                    "id": sub.id,
                    "status": sub.status,
                    "zoho_id": sub.zoho_subscription_id,
                    "created": sub.created_at.isoformat() if sub.created_at else None
                })
            
            webhook_logger.debug(f"🔍 PAYMENT SUCCESS DEBUG: All subscriptions for user {user_id}", extra={
                "user_id": user_id,
                "subscriptions": sub_debug_info
            })
            
    except Exception as e:
        db.rollback()
        webhook_logger.error(f"❌ PAYMENT SUCCESS ERROR: Error handling payment_success event", extra={
            "error": str(e),
            "user_id": user_id if 'user_id' in locals() else 'unknown',
            "email": email if 'email' in locals() else 'unknown',
            "traceback": traceback.format_exc()
        })

# Add new handlers for standalone addon purchases
async def handle_addon_payment_success(payload: Dict[str, Any], db: Session):
    """Handle successful addon payment events from Zoho (standalone addon purchases)"""
    try:
        webhook_logger.info("🔌 ADDON PAYMENT SUCCESS: Starting processing", extra={"handler": "handle_addon_payment_success"})
        
        # Extract data from payload - addon payments have different structure
        # For standalone addon purchases, the payload might have different structure
        payment_data = payload.get("payment", {})
        invoice_data = payload.get("invoice", {})
        
        # Try different payload structures
        if not payment_data and not invoice_data:
            # Check if this is a direct invoice payment structure
            if "customer_id" in payload and "email" in payload:
                payment_data = payload
            else:
                webhook_logger.error("❌ ADDON PAYMENT: No payment or invoice data found in webhook payload")
                return {"status": "error", "message": "Invalid payload structure"}
        
        # Extract customer information
        customer_id = payment_data.get("customer_id") or invoice_data.get("customer_id")
        email = payment_data.get("email") or invoice_data.get("email") or payload.get("email")
        
        # Extract invoice information
        invoice_id = payment_data.get("invoice_id") or invoice_data.get("invoice_id")
        
        # Extract addon information from line items or invoices
        line_items = payment_data.get("line_items", []) or invoice_data.get("line_items", [])
        
        # Also check for upgrade transactions in invoices (for separate addon purchases)
        invoices = payment_data.get("invoices", [])
        upgrade_invoices = [inv for inv in invoices if inv.get("transaction_type") == "upgrade"]
        
        webhook_logger.info("📋 ADDON PAYMENT: Extracted payment data", extra={
            "customer_id": customer_id,
            "email": email,
            "invoice_id": invoice_id,
            "line_items_count": len(line_items),
            "line_items": line_items,
            "upgrade_invoices_count": len(upgrade_invoices),
            "upgrade_invoices": upgrade_invoices
        })
        
        if not email:
            webhook_logger.error("❌ ADDON PAYMENT: Customer email not found in webhook payload")
            return {"status": "error", "message": "No customer email found"}
        
        # Find the user by email
        user = db.query(User).filter(User.email == email).first()
        if not user:
            webhook_logger.error(f"❌ ADDON PAYMENT: User with email {email} not found in database")
            return {"status": "error", "message": f"User not found: {email}"}
        
        user_id = user.user_id
        webhook_logger.info(f"👤 ADDON PAYMENT: Found user {user_id} for email {email}")
        
        # Get user's active subscription for linking addons
        subscription = db.query(UserSubscription).filter(
            UserSubscription.user_id == user_id,
            UserSubscription.status == "active"
        ).order_by(UserSubscription.expiry_date.desc()).first()
        
        if not subscription:
            webhook_logger.error(f"❌ ADDON PAYMENT: No active subscription found for user {user_id}")
            return {"status": "error", "message": "No active subscription found"}
        
        webhook_logger.info(f"📦 ADDON PAYMENT: Found active subscription {subscription.id} for user {user_id}")
        
        # Process addon line items or upgrade invoices
        addons_created = 0
        
        # Handle traditional line items structure
        for line_item in line_items:
            item_type = line_item.get("item_type", "").lower()
            addon_code = line_item.get("item_code") or line_item.get("addon_code")
            quantity = line_item.get("quantity", 1)
            
            # Skip non-addon items
            if item_type not in ["addon", "add_on"] and not addon_code:
                continue
            
            if not addon_code:
                webhook_logger.warning(f"⚠️ ADDON PAYMENT: Skipping line item without addon code: {line_item}")
                continue
            
            # Find the addon in our database
            addon = db.query(Addon).filter(Addon.zoho_addon_code == addon_code).first()
            if not addon:
                webhook_logger.warning(f"⚠️ ADDON PAYMENT: Could not find addon with code {addon_code} in database")
                continue
            
            webhook_logger.info(f"🔌 ADDON PAYMENT: Processing addon {addon.name} (code: {addon_code}) for user {user_id}")
            
            # Check if user already has this addon (active or pending)
            # Normalize rows for this addon to exactly the quantity paid for
            existing_rows = db.query(UserAddon).filter(
                UserAddon.user_id == user_id,
                UserAddon.addon_id == addon.id,
                UserAddon.status.in_(["active", "pending"])
            ).order_by(UserAddon.purchase_date.asc()).all()
            
            current_time = datetime.now()
            
            # All addons should expire with the user's current subscription end date
            # Exception: Additional Messages (addon id == 3) should have no expiry (NULL)
            addon_expiry = None if addon.id == 3 else subscription.expiry_date
            
            created_rows = 0
            desired_count = max(int(quantity), 1)
            current_count = len(existing_rows)

            if current_count > desired_count:
                to_deactivate = current_count - desired_count
                for row in existing_rows[:to_deactivate]:
                    row.is_active = False
                    row.status = "cancelled"
                    row.updated_at = current_time
                kept = existing_rows[to_deactivate:]
                for row in kept:
                    row.status = "active"
                    row.is_active = True
                    row.purchase_date = current_time
                    row.expiry_date = addon_expiry
                    row.updated_at = current_time
                webhook_logger.info(f"🔄 ADDON PAYMENT: Normalized addon rows from {current_count} to {desired_count} for user {user_id}")
            elif current_count < desired_count:
                for row in existing_rows:
                    row.status = "active"
                    row.is_active = True
                    row.purchase_date = current_time
                    row.expiry_date = addon_expiry
                    row.updated_at = current_time
                to_create = desired_count - current_count
                for _ in range(to_create):
                    new_row = UserAddon(
                        user_id=user_id,
                        addon_id=addon.id,
                        subscription_id=subscription.id,
                        purchase_date=current_time,
                        expiry_date=addon_expiry,
                        is_active=True,
                        auto_renew=addon.is_recurring,
                        status="active",
                        initial_count=0,
                        remaining_count=0
                    )
                    db.add(new_row)
                    created_rows += 1
                webhook_logger.info(f"🆕 ADDON PAYMENT: Added {to_create} addon row(s) to reach desired count {desired_count} for user {user_id}")
            else:
                for row in existing_rows:
                    row.status = "active"
                    row.is_active = True
                    row.purchase_date = current_time
                    row.expiry_date = addon_expiry
                    row.updated_at = current_time
                webhook_logger.info(f"ℹ️ ADDON PAYMENT: Addon rows already at desired count {desired_count} for user {user_id}")
            addons_created += created_rows
        
        # Handle upgrade transactions (separate addon purchases without line items)
        if upgrade_invoices and addons_created == 0:
            webhook_logger.info(f"🔄 ADDON PAYMENT: Processing {len(upgrade_invoices)} upgrade transactions")
            
            for upgrade_inv in upgrade_invoices:
                invoice_id = upgrade_inv.get("invoice_id")
                invoice_amount = upgrade_inv.get("invoice_amount", 0)
                subscription_ids = upgrade_inv.get("subscription_ids", [])
                
                webhook_logger.info(f"🔍 ADDON PAYMENT: Processing upgrade invoice {invoice_id} with amount {invoice_amount}")
                
                # For upgrade transactions without specific addon details, we need to:
                # 1. Check if this is a known addon purchase pattern
                # 2. Or fetch invoice details from Zoho API to get addon information
                # 3. For now, we'll create a generic addon record and log for manual review
                
                # Get all available addons to match by price if possible
                available_addons = db.query(Addon).filter(Addon.is_active == True).all()
                matching_addon = None
                
                # Try to match by price (basic heuristic)
                for addon in available_addons:
                    if abs(float(addon.price) - float(invoice_amount)) < 0.01:  # Price match within 1 cent
                        matching_addon = addon
                        webhook_logger.info(f"💰 ADDON PAYMENT: Matched addon {addon.name} by price {addon.price}")
                        break
                
                if matching_addon:
                    # Create addon record
                    current_time = datetime.now()
                    # Exception: Additional Messages (addon id == 3) should have no expiry (NULL)
                    addon_expiry = None if matching_addon.id == 3 else subscription.expiry_date
                    
                    # Check for existing addon
                    existing_addon = db.query(UserAddon).filter(
                        UserAddon.user_id == user_id,
                        UserAddon.addon_id == matching_addon.id,
                        UserAddon.status.in_(["active", "pending"])
                    ).first()
                    
                    if existing_addon:
                        existing_addon.status = "active"
                        existing_addon.is_active = True
                        existing_addon.purchase_date = current_time
                        existing_addon.expiry_date = addon_expiry
                        existing_addon.updated_at = current_time
                        webhook_logger.info(f"🔄 ADDON PAYMENT: Updated existing addon {matching_addon.name} for user {user_id}")
                    else:
                        user_addon = UserAddon(
                            user_id=user_id,
                            addon_id=matching_addon.id,
                            subscription_id=subscription.id,
                            purchase_date=current_time,
                            expiry_date=addon_expiry,
                            is_active=True,
                            auto_renew=matching_addon.is_recurring,
                            status="active",
                            initial_count=0,
                            remaining_count=0
                        )
                        db.add(user_addon)
                        webhook_logger.info(f"🆕 ADDON PAYMENT: Created new addon {matching_addon.name} for user {user_id}")
                    
                    addons_created += 1
                else:
                    # Log for manual review - couldn't automatically match addon
                    webhook_logger.warning(f"⚠️ ADDON PAYMENT: Could not automatically match upgrade transaction", extra={
                        "user_id": user_id,
                        "email": email,
                        "invoice_id": invoice_id,
                        "invoice_amount": invoice_amount,
                        "subscription_ids": subscription_ids,
                        "available_addon_prices": [addon.price for addon in available_addons],
                        "manual_review_required": True
                    })
        
        # Log addon processing summary
        total_items = len(line_items) + len(upgrade_invoices)
        webhook_logger.info(f"📊 ADDON PAYMENT: Processed {total_items} items ({len(line_items)} line items + {len(upgrade_invoices)} upgrade invoices), created/updated {addons_created} addons for user {user_id}")
        
        # Commit all changes
        db.commit()
        
        # Create a fresh token with updated addon info
        create_fresh_user_token(db, user_id)
        
        webhook_logger.info(f"✅ ADDON PAYMENT SUCCESS: Completed processing {addons_created} addon purchases for user {user_id} ({email})", 
                           extra={
                               "user_id": user_id,
                               "email": email,
                               "addons_processed": addons_created,
                               "invoice_id": invoice_id
                           })
        
        return {"status": "success", "message": f"Processed {addons_created} addon purchases"}
        
    except Exception as e:
        db.rollback()
        webhook_logger.error(f"❌ ADDON PAYMENT ERROR: Failed to process addon payment", extra={
            "error": str(e),
            "email": email if 'email' in locals() else 'unknown',
            "traceback": traceback.format_exc()
        })
        return {"status": "error", "message": f"Error processing addon payment: {str(e)}"}

async def handle_addon_payment_failed(payload: Dict[str, Any], db: Session):
    """Handle failed addon payment events from Zoho"""
    try:
        webhook_logger.warning("❌ ADDON PAYMENT FAILED: Starting processing", extra={"handler": "handle_addon_payment_failed"})
        
        # Extract customer information
        payment_data = payload.get("payment", {})
        invoice_data = payload.get("invoice", {})
        
        customer_id = payment_data.get("customer_id") or invoice_data.get("customer_id")
        email = payment_data.get("email") or invoice_data.get("email") or payload.get("email")
        
        if not email:
            webhook_logger.error("❌ ADDON PAYMENT FAILED: Customer email not found in webhook payload")
            return {"status": "error", "message": "No customer email found"}
        
        # Find the user by email
        user = db.query(User).filter(User.email == email).first()
        if not user:
            webhook_logger.error(f"❌ ADDON PAYMENT FAILED: User with email {email} not found in database")
            return {"status": "error", "message": f"User not found: {email}"}
        
        user_id = user.user_id
        
        # Log the failed payment with details
        webhook_logger.warning(f"⚠️ ADDON PAYMENT FAILED: Payment failed for user {user_id} ({email})", extra={
            "user_id": user_id,
            "email": email,
            "customer_id": customer_id,
            "failure_details": payload
        })
        
        # You might want to clean up any pending addon records here
        # For now, just log the failure
        
        return {"status": "success", "message": "Addon payment failure logged"}
        
    except Exception as e:
        webhook_logger.error(f"❌ ADDON PAYMENT FAILED ERROR: Error handling addon payment failure", extra={
            "error": str(e),
            "email": email if 'email' in locals() else 'unknown'
        })
        return {"status": "error", "message": f"Error processing addon payment failure: {str(e)}"}

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
                "redirect_url": f"{os.getenv('FRONTEND_URL', 'https://evolra.ai')}/dashboard/welcome?payment=success",
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

@router.get("/statuszoho/{user_id}")
def get_zoho_subscription_status(user_id: int, db: Session = Depends(get_db)):
    """
    Return the latest subscription status for the given user_id.
    """
    latest_subscription = (
        db.query(UserSubscription)
        .filter(UserSubscription.user_id == user_id)
        .order_by(UserSubscription.payment_date.desc())  # latest payment first
        .first()
    )

    if not latest_subscription:
        raise HTTPException(status_code=404, detail="No subscription found for this user")

    return {
        "status": latest_subscription.status,
        "subscription_id": latest_subscription.id,
        "plan_id": latest_subscription.subscription_plan_id,
        "payment_date": latest_subscription.payment_date,
        "expiry_date": latest_subscription.expiry_date
    }