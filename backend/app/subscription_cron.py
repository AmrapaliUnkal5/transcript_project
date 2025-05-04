# app/subscription_cron.py
from datetime import datetime, timedelta
from sqlalchemy import and_, func, or_, update
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models import (
    User, 
    Bot, 
    UserSubscription, 
    UserAddon, 
    SubscriptionPlan,
    Addon
)

def handle_subscription_expirations():
    print("\n=== Starting Subscription Expiration Cron Job ===")
    db = SessionLocal()
    try:
        now = datetime.utcnow()
        print(f"Current time: {now}")
        
        # Find active subscriptions that have expired
        expired_subs = db.query(UserSubscription).filter(
            UserSubscription.status == 'active',
            UserSubscription.expiry_date <= now
        ).all()
        
        print(f"Found {len(expired_subs)} expired subscriptions")
        
        for sub in expired_subs:
            try:
                print(f"\nProcessing subscription ID: {sub.id} (User: {sub.user_id}, Plan: {sub.subscription_plan_id})")
                process_expired_subscription(db, sub, now)
                db.commit()
                print("Successfully processed subscription")
            except Exception as e:
                db.rollback()
                print(f"!! Error processing subscription {sub.id}: {str(e)}")
    except Exception as e:
        db.rollback()
        print(f"!! Critical error: {str(e)}")
    finally:
        db.close()
    print("=== Cron Job Completed ===\n")

def process_expired_subscription(db: Session, sub: UserSubscription, now: datetime):
    user_id = sub.user_id
    was_free_plan = sub.subscription_plan_id == 1
    
    # 1. Handle Addons - only for paid plans
    print("\n[Step 1] Processing Addons:")
    if not was_free_plan:
        active_addons = db.query(UserAddon).filter(
            UserAddon.user_id == user_id,
            UserAddon.is_active == True
        ).all()
        
        print(f"Found {len(active_addons)} active addons to process")
        
        message_addon_config = db.query(Addon).filter(Addon.id == 3).first()
        if not message_addon_config:
            print("!! Warning: Message Addon (ID 3) config not found")
        
        for addon in active_addons:
            print(f"\nProcessing Addon ID: {addon.id} (Type: {addon.addon_id})")
            print(f"Current state - is_active: {addon.is_active}, status: {addon.status}")
            
            # Mark all addons as expired
            addon.is_active = False
            addon.status = 'expired'
            addon.updated_at = now
            print("Addon marked as expired")
            
            # Special handling for message addon (ID 3)
            if addon.addon_id == 3 and message_addon_config:
                print("Detected message addon (ID 3) - special handling")
                
                try:
                    initial_count = addon.initial_count or 0
                    print(f"Initial count from user_addon: {initial_count}")
                    
                    remaining = max(0, message_addon_config.additional_message_limit - initial_count)
                    
                    print(f"Calculated usage - Total: {initial_count}, Plan Limit: {message_addon_config.additional_message_limit}")
                    print(f"Messages used from addon: {initial_count}, Remaining: {remaining}")
                    
                    # Update addon record
                    addon.remaining_messages = remaining
                    addon.remaining_count = remaining
                    print("Updated addon with remaining counts")

                except Exception as e:
                    print(f"!! Error processing message addon: {str(e)}")
                    # Continue despite error
    else:
        print(" - User was on free plan - skipping addon processing")

    # 2. Reset message counts (for both free and paid plans)
    print("\n[Step 2] Resetting Message Counts:")
    reset_message_counts(db, user_id)
    print(" - Reset user and bot message counts")

    # 3. Mark subscription as expired
    print("\n[Step 3] Finalizing:")
    sub.status = 'expired'
    sub.updated_at = now
    print(f" - Subscription {sub.id} marked as expired")

def reset_message_counts(db: Session, user_id: int):
    # Reset all bots' message counts
    db.execute(
        update(Bot)
        .where(Bot.user_id == user_id)
        .values(message_count=0)
    )
    
    # Reset user's total message count
    db.execute(
        update(User)
        .where(User.user_id == user_id)
        .values(total_message_count=0)
    )