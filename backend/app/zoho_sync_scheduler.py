import logging
import time
import threading
import schedule
from datetime import datetime
from sqlalchemy.orm import Session
from app.database import get_db, SessionLocal
from app.zoho_billing_service import ZohoBillingService

logger = logging.getLogger(__name__)

# Create Zoho Billing Service
zoho_service = ZohoBillingService()

def sync_plans_job():
    """Scheduled job to synchronize subscription plans with Zoho"""
    logger.info(f"Running scheduled sync job at {datetime.now()}")
    
    # We need to create a new DB session in this thread
    db = SessionLocal()
    try:
        result = zoho_service.sync_plans_with_zoho(db)
        logger.info(f"Plans sync result: {result}")
        
        # Also sync addons
        result = zoho_service.sync_addons_with_zoho(db)
        logger.info(f"Addons sync result: {result}")
        
    except Exception as e:
        logger.error(f"Error in scheduled sync job: {str(e)}")
    finally:
        db.close()

def start_scheduler():
    """Start the scheduler in a background thread"""
    # Schedule the sync job to run daily at 1:00 AM
    schedule.every().day.at("01:00").do(sync_plans_job)
    
    # Also run once at startup (after 2 minutes to ensure app is fully loaded)
    schedule.every(1).minutes.do(sync_plans_job).tag('startup-sync')
    
    def run_scheduler():
        while True:
            schedule.run_pending()
            time.sleep(60)  # Check every minute
    
    # Start the scheduler in a daemon thread
    scheduler_thread = threading.Thread(target=run_scheduler, daemon=True)
    scheduler_thread.start()
    logger.info("Zoho sync scheduler started")
    
    # Remove the startup sync job after it runs once
    def remove_startup_job():
        schedule.clear('startup-sync')
    
    # Schedule the removal after 5 minutes
    schedule.every(5).minutes.do(remove_startup_job).tag('cleanup')
    schedule.every(10).minutes.do(lambda: schedule.clear('cleanup')).tag('meta-cleanup')

# Call this function on application startup to begin the scheduler
def initialize_scheduler():
    """Initialize the Zoho sync scheduler"""
    start_scheduler()
    logger.info("Zoho sync scheduler initialized") 