import logging
import time
import threading
from datetime import datetime, timedelta
from app.addon_service import AddonService

logger = logging.getLogger(__name__)

class AddonExpiryScheduler:
    """
    A scheduler that runs in a background thread to periodically check for expired add-ons
    
    This service handles:
    - Checking for expired one-time add-ons and marking them as inactive
    - Running at regular intervals (e.g., daily)
    """
    
    def __init__(self, interval_hours=24):
        """
        Initialize the scheduler with the given interval in hours
        
        Args:
            interval_hours: Hours between checks (default: 24 hours/daily)
        """
        self.interval_seconds = interval_hours * 60 * 60  # Convert hours to seconds
        self.thread = None
        self.stop_event = threading.Event()
        
    def start(self):
        """Start the scheduler in a background thread"""
        if self.thread and self.thread.is_alive():
            logger.warning("Add-on expiry scheduler is already running")
            return
            
        self.stop_event.clear()
        self.thread = threading.Thread(target=self._run, daemon=True)
        self.thread.start()
        logger.info(f"Add-on expiry scheduler started, checking every {self.interval_seconds // 3600} hours")
        
    def stop(self):
        """Stop the scheduler thread"""
        if self.thread and self.thread.is_alive():
            logger.info("Stopping add-on expiry scheduler")
            self.stop_event.set()
            self.thread.join(timeout=5)
            logger.info("Add-on expiry scheduler stopped")
        else:
            logger.warning("Add-on expiry scheduler is not running")
            
    def _run(self):
        """Internal method to run the scheduler loop"""
        logger.info("Add-on expiry scheduler running")
        
        while not self.stop_event.is_set():
            try:
                # Run the expiry check
                logger.info("Checking for expired add-ons")
                AddonService.check_expired_addons()
                logger.info("Completed expired add-ons check")
                
            except Exception as e:
                logger.error(f"Error in add-on expiry scheduler: {str(e)}")
                
            # Sleep until the next check interval
            # Using wait with a timeout allows for graceful shutdown
            self.stop_event.wait(timeout=self.interval_seconds)

# Create a singleton instance
addon_scheduler = AddonExpiryScheduler()

def start_addon_scheduler():
    """Start the add-on expiry scheduler"""
    addon_scheduler.start()
    
def stop_addon_scheduler():
    """Stop the add-on expiry scheduler"""
    addon_scheduler.stop() 