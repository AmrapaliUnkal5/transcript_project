from app.celery_app import celery_app
from app.youtube import store_videos_in_chroma, send_failure_notification
from app.database import get_db
from app.models import YouTubeVideo, User, Bot
from sqlalchemy.orm import Session
import logging

# Configure logging
logger = logging.getLogger(__name__)

@celery_app.task(bind=True, name='process_youtube_videos', max_retries=3)
def process_youtube_videos(self, bot_id: int, video_urls: list):
    """
    Celery task to process YouTube videos in the background.
    
    Args:
        bot_id: The ID of the chatbot
        video_urls: List of YouTube video URLs to process
    """
    try:
        logger.info(f"🎬 Starting Celery task to process {len(video_urls)} YouTube videos for bot {bot_id}")
        
        # Get database session
        db = next(get_db())
        
        # Process videos
        result = store_videos_in_chroma(bot_id, video_urls, db)
        
        # Get success/failure counts
        success_count = len(result.get("stored_videos", []))
        failed_count = len(result.get("failed_videos", []))
        
        # Log completion
        logger.info(
            f"✅ YouTube processing complete for bot {bot_id}. "
            f"Success: {success_count}, Failed: {failed_count}"
        )
        
        # Return results
        return {
            "status": "complete",
            "bot_id": bot_id,
            "success_count": success_count,
            "failed_count": failed_count,
            "failed_videos": result.get("failed_videos", [])
        }
        
    except Exception as e:
        logger.exception(f"❌ Error in Celery task for processing YouTube videos: {str(e)}")
        
        # Retry task if not max retries
        if self.request.retries < self.max_retries:
            logger.info(f"Retrying task... Attempt {self.request.retries + 1} of {self.max_retries}")
            raise self.retry(exc=e, countdown=60 * (2 ** self.request.retries))  # Exponential backoff
        
        # Report failure if no more retries
        try:
            db = next(get_db())
            send_failure_notification(
                db=db,
                bot_id=bot_id,
                video_url="multiple videos",
                reason=f"Task failed after {self.max_retries} retries: {str(e)}"
            )
        except Exception as notify_error:
            logger.exception(f"Failed to send failure notification: {str(notify_error)}")
        
        return {
            "status": "failed",
            "bot_id": bot_id,
            "error": str(e)
        } 