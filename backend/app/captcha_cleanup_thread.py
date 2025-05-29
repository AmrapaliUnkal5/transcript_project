import logging
import threading
from datetime import datetime, timedelta, timezone
from typing import Optional

#from fastapi import logger

from app.models import Captcha

logger = logging.getLogger(__name__)

class CaptchaCleaner:
    def __init__(self):
        self._cleanup_lock = threading.Lock()
        self._last_cleanup_time: Optional[datetime] = None
        
    def cleanup_expired_captchas(self, db):
        """Delete CAPTCHAs older than 10 minutes"""
        with self._cleanup_lock:
            try:
                #now = datetime.utcnow()
                now = datetime.now(timezone.utc) 
                # Only run cleanup if it hasn't run in the last minute
                if self._last_cleanup_time and (now - self._last_cleanup_time) < timedelta(minutes=10):
                    return
                
                cutoff = now - timedelta(minutes=10)
                deleted_count = db.query(Captcha).filter(Captcha.created_at < cutoff).delete()
                db.commit()
                logger.info(f"Cleaned up {deleted_count} expired CAPTCHAs")
                self._last_cleanup_time = now
            except Exception as e:
                logger.error(f"Error cleaning up CAPTCHAs: {str(e)}")
                db.rollback()
                raise

# Initialize the cleaner at app startup
captcha_cleaner = CaptchaCleaner()