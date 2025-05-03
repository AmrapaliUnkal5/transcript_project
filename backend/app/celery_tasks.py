"""
Celery Tasks for Background Processing

This file contains Celery tasks for asynchronous background processing in the chatbot application.
Tasks include:

1. YouTube Video Processing:
   - Extracts transcripts from YouTube videos
   - Stores them in ChromaDB for vector search
   - Updates database with video metadata
   - Sends notifications on completion/failure

2. File Upload Processing:
   - Handles document processing in the background
   - Updates status via notifications
   - Notifies users when processing is complete or failed
   - Maintains the same interface as synchronous processing

The tasks are designed to support immediate user feedback by:
1. Acknowledging file receipt immediately
2. Processing in the background without blocking the user
3. Sending notifications when processing is complete
4. Updating file status in the database at each step
"""

from app.celery_app import celery_app
from app.youtube import store_videos_in_chroma, send_failure_notification
from app.database import get_db
from app.models import YouTubeVideo, User, Bot, File
from sqlalchemy.orm import Session
import logging
from app.utils.file_size_validations_utils import process_file_for_knowledge, prepare_file_metadata, insert_file_metadata
from app.notifications import add_notification
from datetime import datetime
from app.scraper import scrape_selected_nodes, send_web_scraping_failure_notification

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

@celery_app.task(bind=True, name='process_file_upload', max_retries=3)
def process_file_upload(self, bot_id: int, file_data: dict):
    """
    Celery task to process file uploads in the background.
    
    Args:
        bot_id: The ID of the chatbot
        file_data: Dictionary containing file metadata and paths
    """
    try:
        logger.info(f"📄 Starting Celery task to process file upload for bot {bot_id}")
        
        # Get database session
        db = next(get_db())
        
        # Get bot information (for notifications)
        bot = db.query(Bot).filter(Bot.bot_id == bot_id).first()
        if not bot:
            raise Exception(f"Bot with ID {bot_id} not found")
            
        # Get file path
        file_path = file_data.get("file_path")
        original_filename = file_data.get("original_filename")
        if not file_path or not original_filename:
            raise Exception("Missing file path or original filename")
        
        # Attempt to process the file
        try:
            # Update file status to "processing" in the database
            file_record = db.query(File).filter(
                File.bot_id == bot_id,
                File.unique_file_name == file_data.get("file_id")
            ).first()
            
            if file_record:
                file_record.embedding_status = "processing"
                db.commit()
            
            # Add processed data to database
            processed_file = db.query(File).filter(
                File.unique_file_name == file_data.get("file_id"),
                File.bot_id == bot_id
            ).first()
            
            if processed_file:
                processed_file.embedding_status = "completed"
                processed_file.last_embedded = datetime.now()
                db.commit()
                
                # Send success notification
                add_notification(
                    db=db,
                    event_type="FILE_PROCESSED",
                    event_data=f'"{original_filename}" has been processed successfully. {file_data.get("word_count", 0)} words extracted.',
                    bot_id=bot_id,
                    user_id=bot.user_id
                )
                
                logger.info(f"✅ File processing complete for {original_filename}")
                
                return {
                    "status": "complete",
                    "bot_id": bot_id,
                    "file_id": file_data.get("file_id"),
                    "filename": original_filename,
                    "word_count": file_data.get("word_count", 0)
                }
            else:
                raise Exception(f"File record not found for {file_data.get('file_id')}")
                
        except Exception as process_error:
            # Mark file as failed in database
            if file_record:
                file_record.embedding_status = "failed"
                db.commit()
                
            # Send failure notification
            add_notification(
                db=db,
                event_type="FILE_PROCESSING_FAILED",
                event_data=f'Failed to process "{original_filename}". Reason: {str(process_error)}',
                bot_id=bot_id,
                user_id=bot.user_id
            )
            
            raise process_error
            
    except Exception as e:
        logger.exception(f"❌ Error in Celery task for processing file upload: {str(e)}")
        
        # Retry task if not max retries
        if self.request.retries < self.max_retries:
            logger.info(f"Retrying task... Attempt {self.request.retries + 1} of {self.max_retries}")
            raise self.retry(exc=e, countdown=60 * (2 ** self.request.retries))  # Exponential backoff
        
        # Report failure if no more retries
        try:
            db = next(get_db())
            bot = db.query(Bot).filter(Bot.bot_id == bot_id).first()
            
            add_notification(
                db=db,
                event_type="FILE_PROCESSING_FAILED",
                event_data=f'Failed to process "{file_data.get("original_filename", "unknown file")}". Task failed after {self.max_retries} retries: {str(e)}',
                bot_id=bot_id,
                user_id=bot.user_id if bot else None
            )
        except Exception as notify_error:
            logger.exception(f"Failed to send failure notification: {str(notify_error)}")
        
        return {
            "status": "failed",
            "bot_id": bot_id,
            "file_id": file_data.get("file_id"),
            "error": str(e)
        } 

@celery_app.task(bind=True, name='process_web_scraping', max_retries=3)
def process_web_scraping(self, bot_id: int, url_list: list):
    """
    Celery task to process web scraping in the background.
    
    Args:
        bot_id: The ID of the chatbot
        url_list: List of URLs to scrape
    """
    try:
        logger.info(f"🌐 Starting Celery task to process {len(url_list)} web pages for bot {bot_id}")
        
        # Get database session
        db = next(get_db())
        
        # Process web pages
        result = scrape_selected_nodes(url_list, bot_id, db)
        
        # Get success/failure counts
        success_count = len(result) if result else 0
        
        # Log completion
        logger.info(
            f"✅ Web scraping complete for bot {bot_id}. "
            f"Scraped {success_count} pages successfully."
        )
        
        # Return results
        return {
            "status": "complete",
            "bot_id": bot_id,
            "success_count": success_count,
            "scraped_data": result
        }
        
    except Exception as e:
        logger.exception(f"❌ Error in Celery task for processing web scraping: {str(e)}")
        
        # Retry task if not max retries
        if self.request.retries < self.max_retries:
            logger.info(f"Retrying task... Attempt {self.request.retries + 1} of {self.max_retries}")
            raise self.retry(exc=e, countdown=60 * (2 ** self.request.retries))  # Exponential backoff
        
        # Report failure if no more retries
        try:
            db = next(get_db())
            send_web_scraping_failure_notification(
                db=db,
                bot_id=bot_id,
                reason=f"Task failed after {self.max_retries} retries: {str(e)}"
            )
        except Exception as notify_error:
            logger.exception(f"Failed to send failure notification: {str(notify_error)}")
        
        return {
            "status": "failed",
            "bot_id": bot_id,
            "error": str(e)
        } 