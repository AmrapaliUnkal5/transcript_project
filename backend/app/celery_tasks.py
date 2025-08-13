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

from typing import List
from app.celery_app import celery_app
from app.youtube import store_videos_in_chroma, send_failure_notification
from app.database import get_db
from app.models import YouTubeVideo, User, Bot, File, SubscriptionPlan, UserSubscription, EmbeddingModel, ScrapedNode
from sqlalchemy.orm import Session
import logging
from app.utils.file_size_validations_utils import process_file_for_knowledge, prepare_file_metadata, insert_file_metadata
from app.notifications import add_notification
from datetime import datetime
from app.scraper import scrape_selected_nodes, send_web_scraping_failure_notification, mark_scraped_nodes_failed
from app.vector_db import add_document, delete_document_from_chroma, delete_video_from_chroma, delete_url_from_chroma
import os
import hashlib
import uuid
import asyncio
from app.utils.reembedding_utils import reembed_all_bot_data
import time
from app.utils.upload_knowledge_utils import extract_text_from_file
from app.utils.upload_knowledge_utils import chunk_text
from app.config import settings
from app.utils.file_storage import save_file, get_file_url, delete_file as delete_file_storage, FileStorageError
# from app.grid_refresh_ws import broadcast_grid_refresh

# Configure logging
logger = logging.getLogger(__name__)



@celery_app.task(bind=True, name='reembed_bots_for_subscription_plan', max_retries=3)
def reembed_bots_for_subscription_plan(self, subscription_plan_id: int, old_embedding_model_id: int, new_embedding_model_id: int):
    """
    Celery task to reembed data for all bots affected by a subscription plan embedding model change.

    This task identifies all bots that:
    1. Don't have a specific embedding model assigned
    2. Are owned by users with active subscriptions to the modified plan
    
    Args:
        subscription_plan_id: The ID of the subscription plan that was modified
        old_embedding_model_id: The previous embedding model ID
        new_embedding_model_id: The new embedding model ID
    """
    try:
        logger.info(f"🔄 Starting Celery task to reembed bots for subscription plan {subscription_plan_id}")
        logger.info(f"🔄 Embedding model change: {old_embedding_model_id} -> {new_embedding_model_id}")
        
        # Get database session
        db = next(get_db())
        
        # Check if the embedding model IDs are actually different
        if old_embedding_model_id == new_embedding_model_id:
            logger.info(f"⏩ Embedding model unchanged. Skipping reembedding.")
            return {
                "status": "skipped",
                "reason": "embedding_model_unchanged",
                "subscription_plan_id": subscription_plan_id
            }

        # Get details of the embedding models
        old_model = db.query(EmbeddingModel).filter(EmbeddingModel.id == old_embedding_model_id).first()
        new_model = db.query(EmbeddingModel).filter(EmbeddingModel.id == new_embedding_model_id).first()
        
        if not new_model:
            logger.error(f"❌ New embedding model with ID {new_embedding_model_id} not found")
            return {
                "status": "error",
                "reason": "new_embedding_model_not_found",
                "subscription_plan_id": subscription_plan_id
            }

        logger.info(f"📋 Old embedding model: {old_model.name if old_model else 'None'}")
        logger.info(f"📋 New embedding model: {new_model.name}")

        # Get the subscription plan
        subscription_plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == subscription_plan_id).first()
        if not subscription_plan:
            logger.error(f"❌ Subscription plan with ID {subscription_plan_id} not found")
            return {
                "status": "error",
                "reason": "subscription_plan_not_found",
                "subscription_plan_id": subscription_plan_id
            }

        logger.info(f"📋 Subscription plan: {subscription_plan.name}")

        # Find all active subscriptions to this plan
        active_subscriptions = db.query(UserSubscription).filter(
            UserSubscription.subscription_plan_id == subscription_plan_id,
            UserSubscription.status == "active"
        ).all()

        if not active_subscriptions:
            logger.info(f"⏩ No active subscriptions found for plan {subscription_plan_id}. Skipping reembedding.")
            return {
                "status": "completed",
                "affected_bots": 0,
                "processed_bots": 0,
                "subscription_plan_id": subscription_plan_id
            }
        
        logger.info(f"👥 Found {len(active_subscriptions)} active subscriptions to plan {subscription_plan_id}")

        # Extract user IDs with active subscriptions
        user_ids = [sub.user_id for sub in active_subscriptions]
        logger.info(f"👥 User IDs with active subscriptions: {user_ids}")

        # Find all bots that:
        # 1. Belong to users with active subscriptions to this plan
        # 2. Don't have their own specific embedding model (i.e., rely on the plan default)
        affected_bots = db.query(Bot).filter(
            Bot.user_id.in_(user_ids),
            Bot.embedding_model_id.is_(None)
        ).all()

        total_affected_bots = len(affected_bots)
        logger.info(f"🤖 Found {total_affected_bots} bots affected by the embedding model change")

        if total_affected_bots == 0:
            logger.info(f"⏩ No affected bots found. Skipping reembedding.")
            return {
                "status": "completed",
                "affected_bots": 0,
                "processed_bots": 0,
                "subscription_plan_id": subscription_plan_id
            }

        # Process each bot
        successful_bots = 0
        failed_bots = 0
        bot_ids_processed = []

        for index, bot in enumerate(affected_bots):
            bot_id = bot.bot_id
            logger.info(f"🤖 Processing bot {index+1}/{total_affected_bots}: {bot.bot_name} (ID: {bot_id})")

            try:
                # Create event loop for async functions
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                
                try:
                    # Run the reembedding
                    results = loop.run_until_complete(reembed_all_bot_data(bot_id, db))
                    
                    # Check results
                    if results.get("error"):
                        logger.error(f"❌ Error reembedding bot {bot_id}: {results.get('error')}")
                        failed_bots += 1
                    else:
                        logger.info(f"✅ Successfully reembedded bot {bot_id}")
                        logger.info(f"📊 Results: {results['success_count']} successes, {results['error_count']} errors")
                        successful_bots += 1
                        bot_ids_processed.append(bot_id)
                finally:
                    loop.close()
                
            except Exception as e:
                logger.exception(f"❌ Error processing bot {bot_id}: {str(e)}")
                failed_bots += 1

            # Add a small delay to prevent rate limiting issues with embedding APIs
            time.sleep(0.5)
        
        logger.info(f"\n✅ Reembedding completed for subscription plan {subscription_plan_id}")
        logger.info(f"📊 Summary:")
        logger.info(f"   - Total affected bots: {total_affected_bots}")
        logger.info(f"   - Successfully processed: {successful_bots}")
        logger.info(f"   - Failed: {failed_bots}")
        
        return {
            "status": "completed",
            "affected_bots": total_affected_bots,
            "processed_bots": successful_bots,
            "failed_bots": failed_bots,
            "bot_ids_processed": bot_ids_processed,
            "subscription_plan_id": subscription_plan_id
        }
        
    except Exception as e:
        logger.exception(f"❌ Error in Celery task for reembedding subscription plan bots: {str(e)}")
        
        # Retry task if not max retries
        if self.request.retries < self.max_retries:
            logger.info(f"Retrying task... Attempt {self.request.retries + 1} of {self.max_retries}")
            raise self.retry(exc=e, countdown=60 * (2 ** self.request.retries))  # Exponential backoff
        
        return {
            "status": "error",
            "error": str(e),
            "subscription_plan_id": subscription_plan_id
        } 

@celery_app.task(bind=True, name='process_youtube_videos_part1', max_retries=3)
def process_youtube_videos_part1(self, bot_id: int, video_urls: List[str]):
    """
    Celery task to extract and save YouTube transcripts & metadata only (no embedding).
    Mirrors original process_youtube_videos, but stops before vectorization.
    """

    from app.youtube import get_video_transcript, save_video_metadata, send_failure_notification
    from app.models import Bot, User, SubscriptionPlan, UserSubscription
    from app.word_count_validation import validate_cumulative_word_count_sync_for_celery

    db = next(get_db())
    valid_videos = []
    failed_videos = []

    bot = db.query(Bot).filter(Bot.bot_id == bot_id).first()
    user_id = bot.user_id if bot else None

    for url in video_urls:
        try:
            transcript_result = get_video_transcript(url)
            if isinstance(transcript_result, tuple) and len(transcript_result) == 2:
                transcript, metadata = transcript_result
            else:
                transcript, metadata = transcript_result, None

            if not transcript:
                reason = "Extraction Failed:Could not extract transcript from the YouTube video."
                send_failure_notification(db, bot_id, url, reason)

                existing_video = db.query(YouTubeVideo).filter(
                    YouTubeVideo.video_url == url,
                    YouTubeVideo.bot_id == bot_id,
                    YouTubeVideo.is_deleted == False
                ).first()
                if existing_video:
                    existing_video.status = "Failed"
                    existing_video.error_code = reason
                    db.commit()
                else:
                    logger.warning(
                        f"No YouTubeVideo entry found for bot_id={bot_id}, url={url}. Possibly deleted.",
                        extra={"bot_id": bot_id}
                    )

                failed_videos.append({"url": url, "reason": reason})
                continue

            if not metadata:
                if "youtu.be/" in url:
                    extracted_video_id = url.split("youtu.be/")[-1].split("?")[0]
                elif "v=" in url:
                    extracted_video_id = url.split("v=")[-1].split("&")[0]
                else:
                    extracted_video_id = hashlib.md5(url.encode()).hexdigest()
            else:
                extracted_video_id = metadata.get("video_id")

            existing_video = db.query(YouTubeVideo).filter(
                YouTubeVideo.video_id == extracted_video_id,
                YouTubeVideo.bot_id == bot_id,
                YouTubeVideo.is_deleted == False
            ).first()

            if not existing_video:
                logger.warning(
                    f"[YouTubeTranscript] Video ID {extracted_video_id} not found in DB for bot_id={bot_id}. Possibly deleted or not inserted.",
                    extra={"bot_id": bot_id}
                )
                failed_videos.append({
                    "url": url,
                    "reason": "Video not found in DB (possibly deleted)"
                })
                continue

            word_count = len(transcript.split())
            existing_word_count = existing_video.transcript_count if existing_video and existing_video.transcript_count else 0
            word_diff = max(word_count - existing_word_count, 0)


            # ✅ Individual word count validation here
            try:
                validate_cumulative_word_count_sync_for_celery(word_diff, {"user_id": user_id}, db)
            except Exception as e:
                # Mark this video as failed due to word limit
                save_video_metadata(db, bot_id, url, transcript, metadata)
                if existing_video:
                    existing_video.status = "Failed"
                    existing_video.error_code = "Word count exceeds your subscription plan limit."
                    db.commit()
                    add_notification(
                            db=db,
                            event_type="YOUTUBE_WORD_LIMIT_EXCEEDED",
                            event_data=str(e),
                            bot_id=bot_id,
                            user_id=user_id
                        )
                failed_videos.append({
                    "url": url,
                    "reason": f"Word count exceeded: {str(e)}"
                })
                continue  # Skip saving and move to next video

            valid_videos.append({
                "url": url,
                "transcript": transcript,
                "word_count": word_diff,
                "metadata": metadata,
                "video_id": extracted_video_id
            })
            save_video_metadata(db, bot_id, url, transcript, metadata)

        except Exception as e:
            failed_videos.append({"url": url, "reason": str(e)})

    if not valid_videos:
        raise Exception("❌ All videos failed. Nothing to process.")


    # for v in valid_videos:
    #     save_video_metadata(db, bot_id, v["url"], v["transcript"], v["metadata"])

    return {
        "status": "completed",
        "message": f"✅ Saved {len(valid_videos)} video(s) to DB. Embedding will be triggered manually.",
        "failed": failed_videos,
        "bot_id": bot_id
    }


@celery_app.task(bind=True, name='process_file_upload_part1', max_retries=3)
def process_file_upload_part1(self, bot_id: int, file_data: dict):
    """
    Celery task to process file uploads in the background.
    
    Args:
        bot_id: The ID of the chatbot
        file_data: Dictionary containing file metadata and paths
    """
    try:
        logger.info(f"📄 Starting Celery task to process file upload for bot {bot_id}")
        logger.info(f"File data received: {file_data}")
        from app.word_count_validation import validate_cumulative_word_count_sync_for_celery
        from app.utils.file_size_validations_utils import update_file_metadata_status_only
        
        # Get database session
        db = next(get_db())
        print("file database id",file_data.get("file_id_db"))
        
        # Get bot information (for notifications)
        bot = db.query(Bot).filter(Bot.bot_id == bot_id).first()
        if not bot:
            raise Exception(f"Bot with ID {bot_id} not found")
            
        # Get user_id for embedding model selection
        user_id = bot.user_id
        
        # Get file path
        file_path = file_data.get("file_path")
        original_filename = file_data.get("original_filename")
        file_id = file_data.get("file_id")
        file_type = file_data.get("file_type", "application/octet-stream")
        if not file_path or not original_filename or not file_id:
            raise Exception("Missing file path, original filename, or file ID")
        
        logger.info(f"Processing file: {original_filename} (ID: {file_id})")
        logger.info(f"File type: {file_type}")
        logger.info(f"File path: {file_path}")
        
        # Attempt to process the file
        try:
            # geting the Files
            file_record = db.query(File).filter(
                File.bot_id == bot_id,
                File.unique_file_name == file_id
            ).first()
            
            if file_record:
                logger.info(f"Found file record in database.")
            else:
                logger.warning(f"No file record found in database for file_id: {file_id}")
            
            # Process the file content - USING EXISTING TEXT EXTRACTION UTILITIES
            try:
                # Check storage type and handle file operations accordingly
                is_s3_storage = settings.UPLOAD_DIR.startswith('s3://') and file_path.startswith('s3://')
                
                if is_s3_storage:
                    logger.info(f"Detected S3 storage for file: {file_path}")
                    
                    # For S3 storage, we need to extract relative path and use file storage helper
                    upload_dir_path = settings.UPLOAD_DIR.rstrip('/')
                    if file_path.startswith(upload_dir_path + '/'):
                        relative_path = file_path[len(upload_dir_path + '/'):]
                    else:
                        # Fallback: extract from full S3 path
                        relative_path = file_path.split('/')[-1]  # Just the filename as fallback
                    
                    logger.info(f"S3 relative path: {relative_path}")
                    
                    # Get file content from S3
                    try:
                        # Use get_file_url to download content (this reads the file content)
                        # We'll need to implement a helper to get file content
                        
                        # Read the file content from S3
                        import boto3
                        from urllib.parse import urlparse
                        
                        # Parse S3 URL
                        parsed_url = urlparse(file_path)
                        bucket_name = parsed_url.netloc
                        s3_key = parsed_url.path.lstrip('/')
                        
                        # Get S3 client
                        s3_client = boto3.client('s3')
                        
                        # Check if object exists and get its size
                        try:
                            response = s3_client.head_object(Bucket=bucket_name, Key=s3_key)
                            file_size = response['ContentLength']
                            logger.info(f"S3 file size: {file_size} bytes")
                        except Exception as head_error:
                            logger.error(f"S3 file does not exist or cannot be accessed: {file_path}")
                            raise Exception(f"File does not exist at path: {file_path}")
                        
                        # Get the file content
                        logger.info(f"Reading file content from S3: {file_path}")
                        response = s3_client.get_object(Bucket=bucket_name, Key=s3_key)
                        file_content = response['Body'].read()
                        logger.info(f"Successfully read {len(file_content)} bytes from S3")
                        
                    except Exception as s3_error:
                        logger.error(f"Error accessing S3 file {file_path}: {str(s3_error)}")
                        raise Exception(f"File does not exist at path: {file_path}")
                else:
                    logger.info(f"Detected local storage for file: {file_path}")
                    
                    # Check if file exists
                    if not os.path.exists(file_path):
                        logger.error(f"File does not exist at path: {file_path}")
                        raise Exception(f"File does not exist at path: {file_path}")
                    
                    # Log file size
                    file_size = os.path.getsize(file_path)
                    logger.info(f"File size: {file_size} bytes")
                    
                    # Read the file content
                    logger.info(f"Reading file content from: {file_path}")
                    with open(file_path, 'rb') as f:
                        file_content = f.read()
                    logger.info(f"Successfully read {len(file_content)} bytes from file")
                
                # For text files, directly read the content to avoid any potential truncation
                file_content_text = None
                
                # Special handling for PDFs - since PDF extraction is failing
                if original_filename.lower().endswith('.pdf'):
                    logger.info(f"PDF file detected - using specialized extraction method")
                    
                    # First, try to find the original archived PDF
                    _, ext = os.path.splitext(original_filename)
                    archive_filename = f"{file_id}_original{ext}"
                    
                    # Get user_id for the bot to create path
                    user_id = bot.user_id if bot else None
                    
                    if user_id:
                        # Build archive path - handle both S3 and local
                        if is_s3_storage:
                            # For S3, construct the archive S3 path
                            archive_relative_path = f"account_{user_id}/bot_{bot_id}/archives/{archive_filename}"
                            archive_s3_path = f"{settings.UPLOAD_DIR.rstrip('/')}/{archive_relative_path}"
                            
                            logger.info(f"Looking for S3 PDF archive at: {archive_s3_path}")
                            
                            try:
                                # Parse S3 URL for archive
                                from urllib.parse import urlparse
                                parsed_url = urlparse(archive_s3_path)
                                bucket_name = parsed_url.netloc
                                s3_key = parsed_url.path.lstrip('/')
                                
                                # Get archive content from S3
                                import boto3
                                s3_client = boto3.client('s3')
                                
                                # Check if file exists first
                                try:
                                    s3_client.head_object(Bucket=bucket_name, Key=s3_key)
                                    logger.info(f"Found original PDF in S3")
                                except:
                                    logger.error(f"Original PDF file not found in S3 at: {archive_s3_path}")
                                    raise Exception("PDF archive not found in S3")
                                
                                # Get the archive content
                                response = s3_client.get_object(Bucket=bucket_name, Key=s3_key)
                                archive_pdf_content = response['Body'].read()
                                
                                logger.info(f"Successfully downloaded PDF from S3, got {len(archive_pdf_content)} bytes")
                                
                                # Try multiple PDF extraction libraries in sequence
                                # 1. Try PyPDF2
                                try:
                                    import PyPDF2
                                    import io
                                    logger.info(f"Attempting extraction with PyPDF2")
                                    
                                    pdf_text = ""
                                    try:
                                        pdf_file_obj = io.BytesIO(archive_pdf_content)
                                        pdf_reader = PyPDF2.PdfReader(pdf_file_obj)
                                        logger.info(f"PDF has {len(pdf_reader.pages)} pages according to PyPDF2")
                                        
                                        for page_num in range(len(pdf_reader.pages)):
                                            page = pdf_reader.pages[page_num]
                                            page_text = page.extract_text()
                                            if page_text:
                                                pdf_text += page_text + "\n\n"
                                                logger.info(f"Extracted {len(page_text)} chars from page {page_num+1}")
                                            else:
                                                logger.warning(f"No text extracted from page {page_num+1} with PyPDF2")
                                        
                                        if pdf_text.strip():
                                            logger.info(f"Successfully extracted {len(pdf_text)} chars with PyPDF2")
                                            file_content_text = pdf_text
                                        else:
                                            logger.warning(f"PyPDF2 extraction yielded no text, trying next method")
                                    except Exception as pypdf_err:
                                        logger.error(f"PyPDF2 extraction error: {str(pypdf_err)}")
                                except ImportError:
                                    logger.warning(f"PyPDF2 not available, skipping this extraction method")
                                
                                # 2. If PyPDF2 failed, try pdfplumber
                                if not file_content_text:
                                    try:
                                        import pdfplumber
                                        import io
                                        logger.info(f"Attempting extraction with pdfplumber")
                                        
                                        pdf_text = ""
                                        try:
                                            pdf_file_obj = io.BytesIO(archive_pdf_content)
                                            with pdfplumber.open(pdf_file_obj) as pdf:
                                                logger.info(f"PDF has {len(pdf.pages)} pages according to pdfplumber")
                                                
                                                for page_num, page in enumerate(pdf.pages):
                                                    page_text = page.extract_text() or ""
                                                    pdf_text += page_text + "\n\n"
                                                    logger.info(f"Extracted {len(page_text)} chars from page {page_num+1}")
                                            
                                            if pdf_text.strip():
                                                logger.info(f"Successfully extracted {len(pdf_text)} chars with pdfplumber")
                                                file_content_text = pdf_text
                                            else:
                                                logger.warning(f"Pdfplumber extraction yielded no text, trying next method")
                                        except Exception as plumber_err:
                                            logger.error(f"Pdfplumber extraction error: {str(plumber_err)}")
                                    except ImportError:
                                        logger.warning(f"pdfplumber not available, skipping this extraction method")
                                
                                # 3. If both failed, try PyMuPDF (fitz)
                                if not file_content_text:
                                    try:
                                        import fitz  # PyMuPDF
                                        import io
                                        logger.info(f"Attempting extraction with PyMuPDF (fitz)")
                                        
                                        pdf_text = ""
                                        try:
                                            pdf_file_obj = io.BytesIO(archive_pdf_content)
                                            doc = fitz.open(stream=pdf_file_obj, filetype="pdf")
                                            logger.info(f"PDF has {len(doc)} pages according to PyMuPDF")
                                            
                                            for page_num in range(len(doc)):
                                                page = doc[page_num]
                                                page_text = page.get_text()
                                                pdf_text += page_text + "\n\n"
                                                logger.info(f"Extracted {len(page_text)} chars from page {page_num+1}")
                                            
                                            if pdf_text.strip():
                                                logger.info(f"Successfully extracted {len(pdf_text)} chars with PyMuPDF")
                                                file_content_text = pdf_text
                                            else:
                                                logger.warning(f"PyMuPDF extraction yielded no text")
                                        except Exception as fitz_err:
                                            logger.error(f"PyMuPDF extraction error: {str(fitz_err)}")
                                    except ImportError:
                                        logger.warning(f"PyMuPDF not available, skipping this extraction method")
                                
                                # 4. As a last resort, try to OCR with pytesseract
                                if not file_content_text:
                                    try:
                                        import fitz  # PyMuPDF for image extraction
                                        from PIL import Image
                                        import pytesseract
                                        import io
                                        
                                        logger.info(f"Attempting OCR with pytesseract")
                                        
                                        pdf_text = ""
                                        try:
                                            pdf_file_obj = io.BytesIO(archive_pdf_content)
                                            doc = fitz.open(stream=pdf_file_obj, filetype="pdf")
                                            for page_num in range(len(doc)):
                                                page = doc[page_num]
                                                
                                                # Get page as image
                                                pix = page.get_pixmap()
                                                img_data = pix.tobytes("png")
                                                img = Image.open(io.BytesIO(img_data))
                                                
                                                # OCR the image
                                                page_text = pytesseract.image_to_string(img)
                                                pdf_text += page_text + "\n\n"
                                                logger.info(f"OCR extracted {len(page_text)} chars from page {page_num+1}")
                                            
                                            if pdf_text.strip():
                                                logger.info(f"Successfully extracted {len(pdf_text)} chars with OCR")
                                                file_content_text = pdf_text
                                            else:
                                                logger.warning(f"OCR extraction yielded no text")
                                        except Exception as ocr_err:
                                            logger.error(f"OCR extraction error: {str(ocr_err)}")
                                    except ImportError as imp_err:
                                        logger.warning(f"OCR libraries not available: {str(imp_err)}")
                                
                            except Exception as s3_pdf_err:
                                logger.error(f"Error accessing S3 PDF archive: {str(s3_pdf_err)}")
                        else:
                            # For local storage, use existing method
                            # Build archive path
                            account_dir = os.path.join(settings.UPLOAD_DIR, f"account_{user_id}")
                            bot_dir = os.path.join(account_dir, f"bot_{bot_id}")
                            archive_dir = os.path.join(bot_dir, "archives")
                            archive_path = os.path.join(archive_dir, archive_filename)
                            
                            logger.info(f"Looking for original PDF at: {archive_path}")
                            
                            if os.path.exists(archive_path):
                                logger.info(f"Found original PDF at {archive_path}")
                                
                                # Try multiple PDF extraction libraries in sequence
                                # 1. Try PyPDF2
                                try:
                                    import PyPDF2
                                    logger.info(f"Attempting extraction with PyPDF2")
                                    
                                    pdf_text = ""
                                    with open(archive_path, 'rb') as pdf_file:
                                        try:
                                            pdf_reader = PyPDF2.PdfReader(pdf_file)
                                            logger.info(f"PDF has {len(pdf_reader.pages)} pages according to PyPDF2")
                                            
                                            for page_num in range(len(pdf_reader.pages)):
                                                page = pdf_reader.pages[page_num]
                                                page_text = page.extract_text()
                                                if page_text:
                                                    pdf_text += page_text + "\n\n"
                                                    logger.info(f"Extracted {len(page_text)} chars from page {page_num+1}")
                                                else:
                                                    logger.warning(f"No text extracted from page {page_num+1} with PyPDF2")
                                            
                                            if pdf_text.strip():
                                                logger.info(f"Successfully extracted {len(pdf_text)} chars with PyPDF2")
                                                file_content_text = pdf_text
                                            else:
                                                logger.warning(f"PyPDF2 extraction yielded no text, trying next method")
                                        except Exception as pypdf_err:
                                            logger.error(f"PyPDF2 extraction error: {str(pypdf_err)}")
                                except ImportError:
                                    logger.warning(f"PyPDF2 not available, skipping this extraction method")
                                
                                # 2. If PyPDF2 failed, try pdfplumber
                                if not file_content_text:
                                    try:
                                        import pdfplumber
                                        logger.info(f"Attempting extraction with pdfplumber")
                                        
                                        pdf_text = ""
                                        try:
                                            with pdfplumber.open(archive_path) as pdf:
                                                logger.info(f"PDF has {len(pdf.pages)} pages according to pdfplumber")
                                                
                                                for page_num, page in enumerate(pdf.pages):
                                                    page_text = page.extract_text() or ""
                                                    pdf_text += page_text + "\n\n"
                                                    logger.info(f"Extracted {len(page_text)} chars from page {page_num+1}")
                                            
                                            if pdf_text.strip():
                                                logger.info(f"Successfully extracted {len(pdf_text)} chars with pdfplumber")
                                                file_content_text = pdf_text
                                            else:
                                                logger.warning(f"Pdfplumber extraction yielded no text, trying next method")
                                        except Exception as plumber_err:
                                            logger.error(f"Pdfplumber extraction error: {str(plumber_err)}")
                                    except ImportError:
                                        logger.warning(f"pdfplumber not available, skipping this extraction method")
                                
                                # 3. If both failed, try PyMuPDF (fitz)
                                if not file_content_text:
                                    try:
                                        import fitz  # PyMuPDF
                                        logger.info(f"Attempting extraction with PyMuPDF (fitz)")
                                        
                                        pdf_text = ""
                                        try:
                                            doc = fitz.open(archive_path)
                                            logger.info(f"PDF has {len(doc)} pages according to PyMuPDF")
                                            
                                            for page_num in range(len(doc)):
                                                page = doc[page_num]
                                                page_text = page.get_text()
                                                pdf_text += page_text + "\n\n"
                                                logger.info(f"Extracted {len(page_text)} chars from page {page_num+1}")
                                            
                                            if pdf_text.strip():
                                                logger.info(f"Successfully extracted {len(pdf_text)} chars with PyMuPDF")
                                                file_content_text = pdf_text
                                            else:
                                                logger.warning(f"PyMuPDF extraction yielded no text")
                                        except Exception as fitz_err:
                                            logger.error(f"PyMuPDF extraction error: {str(fitz_err)}")
                                    except ImportError:
                                        logger.warning(f"PyMuPDF not available, skipping this extraction method")
                                
                                # 4. As a last resort, try to OCR with pytesseract
                                if not file_content_text:
                                    try:
                                        import fitz  # PyMuPDF for image extraction
                                        from PIL import Image
                                        import pytesseract
                                        import io
                                        
                                        logger.info(f"Attempting OCR with pytesseract")
                                        
                                        pdf_text = ""
                                        try:
                                            doc = fitz.open(archive_path)
                                            for page_num in range(len(doc)):
                                                page = doc[page_num]
                                                
                                                # Get page as image
                                                pix = page.get_pixmap()
                                                img_data = pix.tobytes("png")
                                                img = Image.open(io.BytesIO(img_data))
                                                
                                                # OCR the image
                                                page_text = pytesseract.image_to_string(img)
                                                pdf_text += page_text + "\n\n"
                                                logger.info(f"OCR extracted {len(page_text)} chars from page {page_num+1}")
                                            
                                            if pdf_text.strip():
                                                logger.info(f"Successfully extracted {len(pdf_text)} chars with OCR")
                                                file_content_text = pdf_text
                                            else:
                                                logger.warning(f"OCR extraction yielded no text")
                                        except Exception as ocr_err:
                                            logger.error(f"OCR extraction error: {str(ocr_err)}")
                                    except ImportError as imp_err:
                                        logger.warning(f"OCR libraries not available: {str(imp_err)}")
                            else:
                                logger.error(f"Original PDF file not found at expected path: {archive_path}")
                    else:
                        logger.error(f"Cannot build archive path - user_id not found for bot {bot_id}")
                
                # For text files, use standard extraction
                elif original_filename.lower().endswith('.txt'):
                    logger.info(f"Text file detected. Using direct text extraction method")
                    try:
                        # Handle text extraction based on storage type
                        if is_s3_storage:
                            # For S3, we already have the file_content from above
                            # Decode it as text
                            logger.info(f"Decoding S3 file content for text file")
                            try:
                                file_content_text = file_content.decode('utf-8')
                                logger.info(f"Direct UTF-8 extraction successful, got {len(file_content_text)} characters")
                            except UnicodeDecodeError:
                                # Fall back to more lenient encoding
                                logger.info(f"UTF-8 decoding failed, trying with 'utf-8-sig' encoding")
                                try:
                                    file_content_text = file_content.decode('utf-8-sig', errors='replace')
                                    logger.info(f"Fallback text extraction successful, got {len(file_content_text)} characters")
                                except Exception as decode_err:
                                    logger.error(f"Error decoding S3 file content: {decode_err}")
                                    file_content_text = None
                        else:
                            # For local files, use the existing method
                            # Try reading as UTF-8 first
                            with open(file_path, 'r', encoding='utf-8') as f:
                                file_content_text = f.read()
                                logger.info(f"Direct UTF-8 extraction successful, got {len(file_content_text)} characters")
                        
                        # Check if text is just the placeholder
                        if file_content_text and file_content_text.strip() == "Processing file...":
                            logger.warning(f"Detected placeholder text 'Processing file...' - need to use original archived file")
                            file_content_text = None  # Will try to get from archive file
                            
                            # Get the original archived file path based on archive_original_file function
                            # The archive file uses the original filename extension
                            _, ext = os.path.splitext(original_filename)
                            archive_filename = f"{file_id}_original{ext}"
                            
                            # Get user_id for the bot to create path
                            user_id = None
                            try:
                                bot = db.query(Bot).filter(Bot.bot_id == bot_id).first()
                                if bot:
                                    user_id = bot.user_id
                            except Exception as user_err:
                                logger.error(f"Error getting user_id: {user_err}")
                            
                            if user_id:
                                # Build archive path - handle both S3 and local
                                if is_s3_storage:
                                    # For S3, construct the archive S3 path
                                    archive_relative_path = f"account_{user_id}/bot_{bot_id}/archives/{archive_filename}"
                                    archive_s3_path = f"{settings.UPLOAD_DIR.rstrip('/')}/{archive_relative_path}"
                                    
                                    logger.info(f"Looking for S3 archive file at: {archive_s3_path}")
                                    
                                    try:
                                        # Parse S3 URL for archive
                                        from urllib.parse import urlparse
                                        parsed_url = urlparse(archive_s3_path)
                                        bucket_name = parsed_url.netloc
                                        s3_key = parsed_url.path.lstrip('/')
                                        
                                        # Get archive content from S3
                                        import boto3
                                        s3_client = boto3.client('s3')
                                        response = s3_client.get_object(Bucket=bucket_name, Key=s3_key)
                                        archive_content = response['Body'].read()
                                        
                                        logger.info(f"Found original archive file in S3, got {len(archive_content)} bytes")
                                        
                                        # For text files, try to decode directly
                                        if original_filename.lower().endswith(('.txt')):
                                            for encoding in ['utf-8', 'utf-8-sig', 'latin-1', 'cp1252']:
                                                try:
                                                    file_content_text = archive_content.decode(encoding, errors='replace')
                                                    logger.info(f"Successfully decoded S3 archive file with {encoding}, got {len(file_content_text)} characters")
                                                    break
                                                except Exception as decode_err:
                                                    logger.error(f"Failed to decode with {encoding}: {decode_err}")
                                        
                                    except Exception as s3_archive_err:
                                        logger.error(f"Error accessing S3 archive file: {str(s3_archive_err)}")
                                else:
                                    # For local storage, use existing method
                                    # Build path similar to get_hierarchical_file_path with is_archive=True
                                    account_dir = os.path.join(settings.UPLOAD_DIR, f"account_{user_id}")
                                    bot_dir = os.path.join(account_dir, f"bot_{bot_id}")
                                    archive_dir = os.path.join(bot_dir, "archives")
                                    archive_path = os.path.join(archive_dir, archive_filename)
                                    
                                    logger.info(f"Looking for archive file at: {archive_path}")
                                    
                                    if os.path.exists(archive_path):
                                        logger.info(f"Found original archive file at {archive_path}")
                                        
                                        # Read the file and extract the text
                                        try:
                                            with open(archive_path, 'rb') as f:
                                                archive_content = f.read()
                                            
                                            logger.info(f"Successfully read {len(archive_content)} bytes from archive file")
                                            
                                            # Extract text from the original file based on its extension
                                            if original_filename.lower().endswith(('.txt')):
                                                # For text files, try to decode directly
                                                for encoding in ['utf-8', 'utf-8-sig', 'latin-1', 'cp1252']:
                                                    try:
                                                        file_content_text = archive_content.decode(encoding, errors='replace')
                                                        logger.info(f"Successfully decoded archive file with {encoding}, got {len(file_content_text)} characters")
                                                        break
                                                    except Exception as decode_err:
                                                        logger.error(f"Failed to decode with {encoding}: {decode_err}")
                                            else:
                                                # For other files, use the extraction utility
                                                from app.utils.upload_knowledge_utils import extract_text_from_file
                                                #import asyncio
                                                
                                                loop = asyncio.new_event_loop()
                                                asyncio.set_event_loop(loop)
                                                try:
                                                    file_content_text = loop.run_until_complete(
                                                        extract_text_from_file(archive_content, filename=original_filename)
                                                    )
                                                    logger.info(f"Extracted {len(file_content_text)} characters from archive file")
                                                except Exception as extract_err:
                                                    logger.error(f"Error extracting text from archive: {extract_err}")
                                                finally:
                                                    loop.close()
                                        except Exception as archive_err:
                                            logger.error(f"Error processing archive file: {archive_err}")
                                    else:
                                        logger.error(f"Archive file not found at: {archive_path}")
                            else:
                                logger.error(f"Cannot build archive path - user_id not found for bot {bot_id}")
                    except Exception as txt_err:
                        logger.error(f"Error with text file reading: {txt_err}")
                        if not is_s3_storage:
                            # For local files, try fallback encoding
                            try:
                                with open(file_path, 'r', encoding='utf-8-sig', errors='replace') as f:
                                    file_content_text = f.read()
                                    logger.info(f"Fallback text extraction successful, got {len(file_content_text)} characters")
                                    
                                    # Check if text is just the placeholder
                                    if file_content_text.strip() == "Processing file...":
                                        logger.warning(f"Detected placeholder text 'Processing file...' even with fallback encoding")
                                        file_content_text = None  # Will proceed to next methods
                            except Exception as fallback_err:
                                logger.error(f"Error with fallback text file reading: {fallback_err}")
                                file_content_text = None
                        else:
                            file_content_text = None
                
                # If not a text file or direct extraction failed, use the standard extraction method
                if file_content_text is None:
                    # Special handling for image files
                    if original_filename.lower().endswith(('.png', '.jpg', '.jpeg')):
                        logger.info(f"🔍 Image file detected: {original_filename}, using enhanced OCR")
                        try:
                            from app.utils.upload_knowledge_utils import extract_text_from_image
                            
                            # If we have the original file content
                            if file_content:
                                logger.info(f"Using file content for OCR ({len(file_content)} bytes)")
                                file_content_text = extract_text_from_image(file_content)
                            else:
                                # Try to get from the archive
                                _, ext = os.path.splitext(original_filename)
                                archive_filename = f"{file_id}_original{ext}"
                                
                                # Get user_id for the bot to create path
                                user_id = None
                                bot = db.query(Bot).filter(Bot.bot_id == bot_id).first()
                                if bot:
                                    user_id = bot.user_id
                                
                                if user_id:
                                    # Build path to the archive file - handle both S3 and local
                                    if is_s3_storage:
                                        # For S3, construct the archive S3 path
                                        archive_relative_path = f"account_{user_id}/bot_{bot_id}/archives/{archive_filename}"
                                        archive_s3_path = f"{settings.UPLOAD_DIR.rstrip('/')}/{archive_relative_path}"
                                        
                                        logger.info(f"Looking for S3 image archive at: {archive_s3_path}")
                                        
                                        try:
                                            # Parse S3 URL for archive
                                            from urllib.parse import urlparse
                                            parsed_url = urlparse(archive_s3_path)
                                            bucket_name = parsed_url.netloc
                                            s3_key = parsed_url.path.lstrip('/')
                                            
                                            # Get archive content from S3
                                            import boto3
                                            s3_client = boto3.client('s3')
                                            response = s3_client.get_object(Bucket=bucket_name, Key=s3_key)
                                            archive_content = response['Body'].read()
                                            
                                            logger.info(f"Using S3 archive file for OCR, got {len(archive_content)} bytes")
                                            file_content_text = extract_text_from_image(archive_content)
                                        except Exception as s3_image_err:
                                            logger.error(f"Error accessing S3 image archive: {str(s3_image_err)}")
                                    else:
                                        # For local storage, use existing method
                                        account_dir = os.path.join(settings.UPLOAD_DIR, f"account_{user_id}")
                                        bot_dir = os.path.join(account_dir, f"bot_{bot_id}")
                                        archive_dir = os.path.join(bot_dir, "archives")
                                        archive_path = os.path.join(archive_dir, archive_filename)
                                        
                                        if os.path.exists(archive_path):
                                            logger.info(f"Using archive file for OCR: {archive_path}")
                                            with open(archive_path, 'rb') as f:
                                                archive_content = f.read()
                                            file_content_text = extract_text_from_image(archive_content)
                            
                            if file_content_text:
                                logger.info(f"✅ OCR successful: extracted {len(file_content_text)} characters")
                                text_preview = file_content_text[:100] + "..." if len(file_content_text) > 100 else file_content_text
                                logger.info(f"Text preview: {text_preview}")
                            else:
                                logger.warning("⚠️ OCR extraction failed to produce any text")
                        except Exception as ocr_err:
                            logger.error(f"Error during OCR: {str(ocr_err)}")
                    
                    # Standard method for all file types if we still don't have text
                    if file_content_text is None:
                        # Import the existing text extraction function
                        from app.utils.upload_knowledge_utils import extract_text_from_file
                        #import asyncio
                        
                        # Use the same text extraction that's working in the rest of the system
                        logger.info(f"Starting text extraction for file: {original_filename}")
                        loop = asyncio.new_event_loop()
                        asyncio.set_event_loop(loop)
                        try:
                            file_content_text = loop.run_until_complete(
                                extract_text_from_file(file_content, filename=original_filename)
                            )
                            logger.info(f"Text extraction completed successfully")
                            # Log text length and preview
                            text_length = len(file_content_text) if file_content_text else 0
                            text_preview = file_content_text[:100] + "..." if text_length > 100 else file_content_text
                            logger.info(f"Extracted text length: {text_length} characters")
                            logger.info(f"Text preview: {text_preview}")
                        except Exception as extract_err:
                            logger.error(f"Error during text extraction: {str(extract_err)}")
                            file_content_text = None
                        finally:
                            loop.close()
                
                # Add debugging for short text results
                if file_content_text and len(file_content_text) < 100:
                    logger.warning(f"⚠️ Very short text extracted ({len(file_content_text)} chars). File size is {len(file_content)/1024:.2f} KB")
                    logger.warning(f"Full extracted content: {file_content_text}")
                    # Try one more time with a direct binary read for text files
                    if original_filename.lower().endswith('.txt'):
                        logger.info("Attempting emergency text extraction directly from binary content")
                        try:
                            # Try different encodings
                            for encoding in ['utf-8', 'latin-1', 'cp1252', 'ascii']:
                                try:
                                    direct_text = file_content.decode(encoding, errors='replace')
                                    logger.info(f"Binary decoding with {encoding} got {len(direct_text)} characters")
                                    if len(direct_text) > len(file_content_text):
                                        logger.info(f"Using binary decoded text ({len(direct_text)} chars) instead of extracted text ({len(file_content_text)} chars)")
                                        file_content_text = direct_text
                                        break
                                except Exception as decode_err:
                                    logger.error(f"Error decoding with {encoding}: {decode_err}")
                        except Exception as bin_err:
                            logger.error(f"Emergency extraction failed: {bin_err}")
                
                # If we still don't have content
                if not file_content_text:
                    logger.warning(f"No text content extracted from file: {original_filename}")
                    # Try to get it from the file record as fallback
                    if file_record and hasattr(file_record, 'extracted_content') and file_record.extracted_content:
                        logger.info(f"Using extracted_content from database as fallback")
                        file_content_text = file_record.extracted_content
                        logger.info(f"Retrieved {len(file_content_text)} characters from database")
                    else:
                        # Try one more time with OCR if it's an image file
                        if original_filename.lower().endswith(('.png', '.jpg', '.jpeg')):
                            logger.info(f"🔄 Attempting OCR extraction one more time for image file: {original_filename}")
                            try:
                                from app.utils.upload_knowledge_utils import extract_text_from_image
                                # Get the original archived file path
                                _, ext = os.path.splitext(original_filename)
                                archive_filename = f"{file_id}_original{ext}"
                                
                                # Get user_id for the bot to create path
                                user_id = None
                                bot = db.query(Bot).filter(Bot.bot_id == bot_id).first()
                                if bot:
                                    user_id = bot.user_id
                                
                                if user_id:
                                    # Build path to the archive file - handle both S3 and local
                                    if is_s3_storage:
                                        # For S3, construct the archive S3 path
                                        archive_relative_path = f"account_{user_id}/bot_{bot_id}/archives/{archive_filename}"
                                        archive_s3_path = f"{settings.UPLOAD_DIR.rstrip('/')}/{archive_relative_path}"
                                        
                                        logger.info(f"Looking for S3 image archive at: {archive_s3_path}")
                                        
                                        try:
                                            # Parse S3 URL for archive
                                            from urllib.parse import urlparse
                                            parsed_url = urlparse(archive_s3_path)
                                            bucket_name = parsed_url.netloc
                                            s3_key = parsed_url.path.lstrip('/')
                                            
                                            # Get archive content from S3
                                            import boto3
                                            s3_client = boto3.client('s3')
                                            response = s3_client.get_object(Bucket=bucket_name, Key=s3_key)
                                            archive_content = response['Body'].read()
                                            
                                            logger.info(f"Using S3 archive file for OCR, got {len(archive_content)} bytes")
                                            file_content_text = extract_text_from_image(archive_content)
                                        except Exception as s3_image_err:
                                            logger.error(f"Error accessing S3 image archive: {str(s3_image_err)}")
                                    else:
                                        # For local storage, use existing method
                                        account_dir = os.path.join(settings.UPLOAD_DIR, f"account_{user_id}")
                                        bot_dir = os.path.join(account_dir, f"bot_{bot_id}")
                                        archive_dir = os.path.join(bot_dir, "archives")
                                        archive_path = os.path.join(archive_dir, archive_filename)
                                        
                                        if os.path.exists(archive_path):
                                            logger.info(f"Using archive file for OCR: {archive_path}")
                                            with open(archive_path, 'rb') as f:
                                                archive_content = f.read()
                                            file_content_text = extract_text_from_image(archive_content)
                                
                                if file_content_text:
                                    logger.info(f"✅ OCR successful on second attempt: extracted {len(file_content_text)} chars")
                                else:
                                    logger.warning("📉 OCR failed on second attempt")
                            except Exception as ocr_retry_err:
                                logger.error(f"Error in OCR retry: {str(ocr_retry_err)}")
                        
                        # Try dedicated DOCX fallback extraction if it's a DOCX file
                        elif original_filename.lower().endswith(('.docx', '.doc')):
                            logger.info(f"🔄 Attempting dedicated DOCX/DOC extraction fallback for: {original_filename}")
                            try:
                                # Get the original archived file path
                                _, ext = os.path.splitext(original_filename)
                                archive_filename = f"{file_id}_original{ext}"
                                
                                # Get user_id for the bot to create path
                                user_id = None
                                bot = db.query(Bot).filter(Bot.bot_id == bot_id).first()
                                if bot:
                                    user_id = bot.user_id
                                
                                if user_id:
                                    archive_content = None
                                    
                                    # Build path to the archive file - handle both S3 and local
                                    if is_s3_storage:
                                        # For S3, construct the archive S3 path
                                        archive_relative_path = f"account_{user_id}/bot_{bot_id}/archives/{archive_filename}"
                                        archive_s3_path = f"{settings.UPLOAD_DIR.rstrip('/')}/{archive_relative_path}"
                                        
                                        logger.info(f"Looking for S3 DOCX archive at: {archive_s3_path}")
                                        
                                        try:
                                            # Parse S3 URL for archive
                                            from urllib.parse import urlparse
                                            parsed_url = urlparse(archive_s3_path)
                                            bucket_name = parsed_url.netloc
                                            s3_key = parsed_url.path.lstrip('/')
                                            
                                            # Get archive content from S3
                                            import boto3
                                            s3_client = boto3.client('s3')
                                            response = s3_client.get_object(Bucket=bucket_name, Key=s3_key)
                                            archive_content = response['Body'].read()
                                            
                                            logger.info(f"Got S3 archive file for DOCX extraction, {len(archive_content)} bytes")
                                        except Exception as s3_docx_err:
                                            logger.error(f"Error accessing S3 DOCX archive: {str(s3_docx_err)}")
                                    else:
                                        # For local storage, use existing method
                                        account_dir = os.path.join(settings.UPLOAD_DIR, f"account_{user_id}")
                                        bot_dir = os.path.join(account_dir, f"bot_{bot_id}")
                                        archive_dir = os.path.join(bot_dir, "archives")
                                        archive_path = os.path.join(archive_dir, archive_filename)
                                        
                                        if os.path.exists(archive_path):
                                            logger.info(f"Found local archive file for DOCX extraction: {archive_path}")
                                            with open(archive_path, 'rb') as f:
                                                archive_content = f.read()
                                            logger.info(f"Got local archive file for DOCX extraction, {len(archive_content)} bytes")
                                        else:
                                            logger.error(f"Local archive file not found: {archive_path}")
                                    
                                    # Try extracting text from the archive content
                                    if archive_content:
                                        logger.info(f"Attempting DOCX text extraction from archive content...")
                                        
                                        # Try using the extract functions directly
                                        if original_filename.lower().endswith('.docx'):
                                            from app.utils.upload_knowledge_utils import extract_text_from_docx, extract_text_from_docx_images
                                            
                                            # Try primary DOCX extraction
                                            try:
                                                text_from_docx = extract_text_from_docx(archive_content)
                                                if text_from_docx and text_from_docx.strip():
                                                    file_content_text = text_from_docx
                                                    logger.info(f"✅ DOCX text extraction successful: {len(file_content_text)} chars")
                                                else:
                                                    logger.warning("DOCX text extraction returned empty, trying images...")
                                                    # Try extracting from images in DOCX
                                                    text_from_images = extract_text_from_docx_images(archive_content)
                                                    if text_from_images and text_from_images.strip():
                                                        file_content_text = text_from_images
                                                        logger.info(f"✅ DOCX image extraction successful: {len(file_content_text)} chars")
                                                    else:
                                                        logger.warning("No text found in DOCX images either")
                                            except Exception as docx_extract_err:
                                                logger.error(f"DOCX extraction error: {str(docx_extract_err)}")
                                        
                                        elif original_filename.lower().endswith('.doc'):
                                            from app.utils.upload_knowledge_utils import extract_text_from_doc
                                            
                                            # Try DOC extraction
                                            try:
                                                text_from_doc = extract_text_from_doc(archive_content)
                                                if text_from_doc and text_from_doc.strip():
                                                    file_content_text = text_from_doc
                                                    logger.info(f"✅ DOC text extraction successful: {len(file_content_text)} chars")
                                                else:
                                                    logger.warning("DOC text extraction returned empty")
                                            except Exception as doc_extract_err:
                                                logger.error(f"DOC extraction error: {str(doc_extract_err)}")
                                    else:
                                        logger.error(f"Could not get archive content for DOCX/DOC extraction")
                                
                                if file_content_text:
                                    logger.info(f"✅ DOCX/DOC fallback extraction successful: extracted {len(file_content_text)} chars")
                                else:
                                    logger.warning("📉 DOCX/DOC fallback extraction failed")
                            except Exception as docx_retry_err:
                                logger.error(f"Error in DOCX/DOC fallback extraction: {str(docx_retry_err)}")
                        
                        # If still no text, raise an error
                        if not file_content_text:
                            logger.error(f"Failed to extract content from file and no fallback available")
                            raise Exception("Failed to extract content from file and no fallback available")
                
                # Update the text file with the extracted content
                if is_s3_storage:
                    # For S3 storage, use the file storage helper to update the content
                    logger.info(f"Updating S3 text file with extracted content")
                    try:
                        # Extract relative path from the full S3 path
                        upload_dir_path = settings.UPLOAD_DIR.rstrip('/')
                        if file_path.startswith(upload_dir_path + '/'):
                            relative_path = file_path[len(upload_dir_path + '/'):]
                        else:
                            # Fallback: extract from full S3 path
                            relative_path = file_path.split('/')[-1]
                        
                        # Save the extracted content to S3
                        text_bytes = file_content_text.encode('utf-8')
                        updated_path = save_file(settings.UPLOAD_DIR, relative_path, text_bytes)
                        logger.info(f"✅ Successfully updated S3 text file with {len(file_content_text)} characters at: {updated_path}")
                    except Exception as s3_update_err:
                        logger.error(f"Error updating S3 text file: {str(s3_update_err)}")
                        # Continue processing even if update fails
                else:
                    # For local storage, use existing method
                    if os.path.exists(file_path):
                        logger.info(f"Updating text file with extracted content")
                        with open(file_path, 'w', encoding='utf-8') as f:
                            f.write(file_content_text)
                        logger.info(f"✅ Successfully updated text file with {len(file_content_text)} characters")
                
                file_metadata_list = [] #for updating word count and charater count in files Table
                extracted_filenames = []
                total_word_count = 0

                word_count = len(file_content_text.split())
                char_count = len(file_content_text)

                # Save to a per-file metadata list
                file_metadata_list.append({
                    "file_id_db": file_data.get("file_id_db"),
                    "word_count": word_count,
                    "char_count": char_count
                })
                extracted_filenames.append(original_filename)
                total_word_count += word_count

                #validate the word count
                try:
                    validate_cumulative_word_count_sync_for_celery(total_word_count, {"user_id": user_id}, db)
                    quota_exceeded = False
                    error_message = None
                except Exception as e:
                    quota_exceeded = True
                    error_message = "Word count exceeds your subscription plan limit."
                    try:
                        extracted_str = ", ".join(extracted_filenames)
                        message = (
                            f"Word count quota exceeded while extracting {len(extracted_filenames)} file(s): {extracted_str}. "
                            f"Please upgrade your plan or reduce the file size."
                        )

                        add_notification(
                            db=db,
                            event_type="WORD_LIMIT_EXCEEDED",
                            event_data=message,
                            bot_id=bot_id,
                            user_id=bot.user_id
                        )
                        logger.info("⚠️ Word count quota exceeded notification sent.")
                    except Exception as notify_error:
                        logger.error(f"Error sending quota exceeded notification: {str(notify_error)}")

                # 2. Update each file's status in DB
                for metadata in file_metadata_list:
                    metadata["status"] = "Failed" if quota_exceeded else "Extracted"
                    metadata["error_message"] = error_message if quota_exceeded else None
                    metadata["updated_by"] = user_id  # Required for auditing
                    print("metadata",metadata)

                    update_file_metadata_status_only(db, metadata)
                    # print("Broadcasting files update...")
                    # asyncio.run(broadcast_grid_refresh(bot_id, "Files"))

                try:
                    add_notification(
                        db=db,
                        event_type="FILE_EXTRACTION",
                        event_data=f'"{original_filename}" has been extracted successfully. {metadata.get("word_count", 0)} words extracted.',
                        bot_id=bot_id,
                        user_id=bot.user_id
                    )
                    logger.info(f"✅ Successfully sent success notification")
                except Exception as notify_error:
                    logger.error(f"Error sending notification: {str(notify_error)}")
                
                logger.info(f"✅ File processing -part 1 Complete for  {original_filename}")
                
                return {
                    "status": "complete",
                    "bot_id": bot_id,
                    "file_id": file_id,
                    "filename": original_filename,
                    "word_count": file_data.get("word_count", 0)
                }
            except Exception as process_error:
                logger.exception(f"❌ Error processing file content extraction: {str(process_error)}")
                raise process_error
                
        except Exception as process_error:
            # Mark file as failed in database
            if file_record:
                logger.info(f"Marking file extraction as failed in database")
                file_record.status = "Failed"
                error_msg = f"Extraction Failed: {str(process_error)}"
                file_record.error_code = error_msg
                file_record.updated_by = bot.user_id
                db.commit()
                logger.info(f"Updated file status of extraction to 'failed'")
                
            # Send failure notification
            try:
                add_notification(
                    db=db,
                    event_type="FILE_PROCESSING_FAILED",
                    event_data=f'Failed to process and extract text"{original_filename}". Reason: {str(process_error)}',
                    bot_id=bot_id,
                    user_id=bot.user_id
                )
                logger.info(f"Sent failure notification")
            except Exception as notify_error:
                logger.error(f"Error sending failure notification: {str(notify_error)}")
            
            raise process_error
            
    except Exception as e:
        logger.exception(f"❌ Error in Celery task for processing file Extraction process: {str(e)}")
        
        # Retry task if not max retries
        if self.request.retries < self.max_retries:
            logger.info(f"Retrying task... Attempt {self.request.retries + 1} of {self.max_retries}")
            raise self.retry(exc=e, countdown=60 * (2 ** self.request.retries))  # Exponential backoff
        
        # Report failure if no more retries
        try:
            db = next(get_db())
            bot = db.query(Bot).filter(Bot.bot_id == bot_id).first()
            # Update the file status to failed
            file_id = file_data.get("file_id")
            if file_id:
                try:
                    update_file_metadata_status_only(db, {
                        "file_id_db": file_data.get("file_id_db"),
                        "status": "Failed",
                        "error_message": f"Extraction Failed: {str(e)}",
                        "updated_by": bot.user_id if bot else None
                    })
                    db.commit()
                    logger.info(f"✅ File ID {file_id} marked as 'failed' in DB after final retry failure.")
                except Exception as update_error:
                    db.rollback()
                    logger.exception(f"❌ Failed to mark file {file_id} as failed in DB: {str(update_error)}")
            add_notification(
                db=db,
                event_type="FILE_EXTRACTION_FAILED",
                event_data=f'Failed to extract "{file_data.get("original_filename", "unknown file")}". Task failed after {self.max_retries} retries: {str(e)}',
                bot_id=bot_id,
                user_id=bot.user_id if bot else None
            )
            logger.info(f"Sent final failure notification after {self.max_retries} retries")
        except Exception as notify_error:
            logger.exception(f"Failed to send final failure notification: {str(notify_error)}")
        
        return {
            "status": "failed",
            "bot_id": bot_id,
            "file_id": file_data.get("file_id"),
            "error": str(e)
        } 


@celery_app.task(bind=True, name="process_file_upload_part2", max_retries=3)
def process_file_upload_part2(self, bot_id: int, file_id: str):
    """
    Celery task to perform vectorization (part 2) for a file after text extraction.

    Args:
        bot_id: The ID of the chatbot
        file_id: Unique file ID (from files table)
    """
    from app.word_count_validation import update_bot_word_and_file_count
    try:
        logger.info(f"🧠 Starting vectorization for file_id: {file_id}, bot_id: {bot_id}")
        db = next(get_db())

        # Fetch file record
        file_record = db.query(File).filter(
            File.bot_id == bot_id,
            File.unique_file_name == file_id
        ).first()

        if file_record:
            logger.info(f"Found file record in database, The status is updated to  Embedding.")
                # file_record.embedding_status = "pending"
            file_record.status = "Embedding"
            db.commit()
        else:
            logger.warning(f"No file record found in database for file_id: {file_id}")
        original_filename = file_record.file_name


        # Load extracted text from file
        extracted_text_path = file_record.file_path
        # Check if this is S3 storage
        is_s3_storage = extracted_text_path.startswith("s3://")

        if is_s3_storage:
            logger.info(f"Detected S3 storage for extracted text: {extracted_text_path}")

            import boto3
            from urllib.parse import urlparse
            from botocore.exceptions import ClientError

            parsed_url = urlparse(extracted_text_path)
            bucket_name = parsed_url.netloc
            s3_key = parsed_url.path.lstrip("/")

            s3_client = boto3.client("s3")

            try:
                s3_client.head_object(Bucket=bucket_name, Key=s3_key)
            except ClientError as e:
                if e.response["Error"]["Code"] == "404":
                    raise Exception(f"Extracted text file does not exist in S3: {extracted_text_path}")
                raise

            logger.info(f"Reading extracted text content from S3: {extracted_text_path}")
            response = s3_client.get_object(Bucket=bucket_name, Key=s3_key)
            file_content_text = response["Body"].read().decode("utf-8")

        else:
            # Local file handling
            if not os.path.exists(extracted_text_path):
                raise Exception(f"Extracted text file does not exist: {extracted_text_path}")
            with open(extracted_text_path, "r", encoding="utf-8") as f:
                file_content_text = f.read()


        if not file_content_text.strip():
            raise Exception("Extracted text is empty")

        # Get bot information (for notifications)
        bot = db.query(Bot).filter(Bot.bot_id == bot_id).first()
        if not bot:
            raise Exception(f"Bot with ID {bot_id} not found")

        # Get user_id for embedding model selection
        user_id = bot.user_id
        original_filename = file_record.file_name
        file_type = file_record.file_type

        # ✅ Create metadata for embedding - ENSURE CONSISTENT FORMAT
        metadata = {
            "id": file_id,               # Primary identifier
            "source": "upload",          # Source type for filtering
            "file_name": original_filename,
            "file_type": file_type,
            "bot_id": bot_id             # Always include bot_id
        }

        logger.info(f"📥 Adding document to vector database: {original_filename}")

        # ✅ Split text into chunks before storing in vector database
        print("bot_id",bot_id)
        text_chunks = chunk_text(file_content_text, bot_id=bot_id, user_id=user_id, db=db)
        logger.info(f"📄 Split text into {len(text_chunks)} chunks")

        # ✅ Store each chunk with proper metadata
        for i, chunk in enumerate(text_chunks):
            chunk_metadata = metadata.copy()
            chunk_metadata["id"] = f"{file_id}_chunk_{i+1}" if len(text_chunks) > 1 else file_id
            chunk_metadata["chunk_number"] = i + 1
            chunk_metadata["total_chunks"] = len(text_chunks)

            # Add the chunk to the vector database with user_id for model selection
            add_document(bot_id=bot_id, text=chunk, metadata=chunk_metadata, user_id=user_id)

        # ✅ Update the database record
        file_record.status = "Success"
        file_record.last_embedded = datetime.now()
        file_record.updated_by = user_id
        db.commit()
        # After embedding is completed
        try:

            word_count = len(file_content_text.split())
            print("Now the File count is totally",word_count)
            if is_s3_storage:
                file_size = s3_client.head_object(Bucket=bucket_name, Key=s3_key)["ContentLength"]
            else:
                file_size = os.path.getsize(extracted_text_path)

            update_bot_word_and_file_count(
                db=db,
                bot_id=bot_id,
                word_count=word_count,
                file_size=file_size
            )
            logger.info(f"✅ Bot and user word/file counts updated successfully")
        except Exception as e:
            logger.error(f"❌ Failed to update word/file counts: {str(e)}")
        logger.info(f"✅ Vectorization completed for file_id: {file_id}")
        try:
            add_notification(
                        db=db,
                        event_type="FILE_EMBEDDING",
                        event_data=f'"{original_filename}" has been embedded successfully.',
                        bot_id=bot_id,
                        user_id=bot.user_id
                    )
            logger.info(f"✅ Successfully sent success notification")
        except Exception as notify_error:
            logger.error(f"Error sending notification: {str(notify_error)}")


    except Exception as e:
        logger.exception(f"❌ Vectorization failed for file_id {file_id}: {str(e)}")
        db = next(get_db())
        file_record = db.query(File).filter(
            File.bot_id == bot_id,
            File.unique_file_name == file_id
        ).first()
        if file_record:
            file_record.status = "Failed"
            file_record.error_code = f"Embedding Failed: {str(e)}"
            db.commit()
        # Send failure notification
        try:
            add_notification(
                    db=db,
                    event_type="FILE_PROCESSING_FAILED",
                    event_data=f'Failed to process and embed Part 2"{original_filename}". Reason: {str(e)}',
                    bot_id=bot_id,
                    user_id=user_id
                )
            logger.info(f"Sent failure notification")
        except Exception as notify_error:
                logger.error(f"Error sending failure notification: {str(notify_error)}")

        if self.request.retries < self.max_retries:
            raise self.retry(exc=e, countdown=60 * (2 ** self.request.retries))


@celery_app.task(bind=True, name='process_youtube_videos_part2', max_retries=3)
def process_youtube_videos_part2(self, bot_id: int, video_ids: List[int]):
    """
    Part 2 Celery Task: Vectorize transcripts of YouTube videos by reading from DB.
    """
    from app.models import Bot, YouTubeVideo
    from app.youtube import send_failure_notification, send_success_notification
    from app.word_count_validation import update_word_usage

    try:
        logger.info(f"Starting Vectorization for  {bot_id}")
        db = next(get_db())
        bot = db.query(Bot).filter(Bot.bot_id == bot_id).first()
        user_id = bot.user_id if bot else None

        videos_to_vectorize = db.query(YouTubeVideo).filter(YouTubeVideo.id.in_(video_ids)).all()
        if not videos_to_vectorize:
                logger.warning(f"🚫 No matching videos found in DB for bot {bot_id} and IDs: {video_ids}")
                return {"status": "skipped", "message": "No matching videos found"}
        for video in videos_to_vectorize:
            try:
                transcript = video.transcript
                transcript_chunks = chunk_text(transcript)
                logger.info(f"📄 Splitting transcript into {len(transcript_chunks)} chunks for video {video.video_title}")

                for i, chunk in enumerate(transcript_chunks):
                    metadata = {
                        "id": f"youtube-{video.id}-chunk-{i+1}",
                        "source": "youtube",
                        "source_id": video.video_id,
                        "title": video.video_title,
                        "url": video.video_url,
                        "channel_name": video.channel_name,
                        "chunk_number": i + 1,
                        "total_chunks": len(transcript_chunks),
                        "bot_id": bot_id
                    }
                    add_document(bot_id=bot_id, text=chunk, metadata=metadata, user_id=user_id)

                video.status = "Success"
                video.last_embedded = datetime.now()
                db.commit()

                # ✅ Word count update
                video_word_count = len(transcript.split())
                update_word_usage(db, bot_id, video_word_count)
                logger.info(
                        f"✅ Word usage updated: {video_word_count} words added to bot {bot_id} from video {video.video_id}",
                        extra={
                            "bot_id": bot_id,
                            "video_id": video.video_id,
                            "words_added": video_word_count
                        }
                    )

                logger.info(f"✅ Vectorized video: {video.video_title}")
                send_success_notification(
                    db, bot_id, "YOUTUBE_VIDEO_EMBEDDED",
                    f"Transcript embedded for video '{video.video_title}'.",
                    video.video_title
                )

            except Exception as e:
                logger.exception(f"❌ Error vectorizing video {video.video_title}: {str(e)}")
                video.status = "Failed"
                video.error_code = f"Embedding Failed: {str(e)}"
                db.commit()

                send_failure_notification(
                    db, bot_id, video.video_url,
                    f"Embedding failed for video '{video.video_title}': {str(e)}"
                )

        return {
            "status": "completed",
            "processed_count": len(videos_to_vectorize),
            "bot_id": bot_id
        }

    except Exception as e:
        logger.exception(f"❌ Error in YouTube vectorization task: {str(e)}")
        return {"status": "failed", "error": str(e), "bot_id": bot_id}


@celery_app.task(bind=True, name='process_web_scraping_part1', max_retries=3)
def process_web_scraping_part1(self, bot_id: int, url_list: list):
    """
    Celery task to process web scraping in the background.
    
    Args:
        bot_id: The ID of the chatbot
        url_list: List of URLs to scrape
    """
    try:
        logger.info(f"🌐 Starting Celery task to process {len(url_list)} web pages for bot {bot_id}")
        logger.info(f"URLs to process: {url_list}")
        
        # Get database session
        db = next(get_db())
        
        # Get bot information (for notifications)
        bot = db.query(Bot).filter(Bot.bot_id == bot_id).first()
        print("Bot", bot.user_id)
        if not bot:
            error_msg = f"Bot with ID {bot_id} not found"
            mark_scraped_nodes_failed(db, bot_id, url_list, error_msg)
            logger.error(f"❌ {error_msg}")
            return {
                "status": "failed",
                "bot_id": bot_id,
                "error": error_msg
            }
        
        # Check if URLs list is empty
        if not url_list:
            logger.warning(f"🔶 Empty URL list provided for bot {bot_id}")
            # Send notification about empty URL list
            add_notification(
                db=db,
                event_type="WEB_SCRAPING_COMPLETED",
                event_data=f"Web scraping completed but no URLs were provided to scrape.",
                bot_id=bot_id,
                user_id=bot.user_id
            )
            return {
                "status": "complete",
                "bot_id": bot_id,
                "success_count": 0,
                "scraped_data": None
            }
        
        # Try to import Playwright here to check if it's available
        try:
            from playwright.sync_api import sync_playwright
            logger.info("🌐 Playwright is available")
        except ImportError as e:
            logger.error(f"❌ Playwright import error: {str(e)}. This will affect dynamic website scraping.")
            # Still continue to try static scraping
        
        # Process web pages - Notice that scrape_selected_nodes already handles embedding
        # in the vector database (see app/scraper.py implementation)
        logger.info(f"🌐 Starting scraping for bot {bot_id}")
        result = scrape_selected_nodes(url_list, bot_id, db)
        # asyncio.run(broadcast_grid_refresh(bot_id, "Websites"))
        # Get success/failure counts
        success_count = len(result) if result else 0
        
        # Log completion
        logger.info(
            f"✅ Web scraping complete for bot {bot_id}. "
            f"Scraped {success_count} pages successfully."
        )
        print("bot_id",bot_id)
        
        # Always send a completion notification
        try:
            if success_count > 0:
                add_notification(
                    db=db,
                    event_type="WEB_SCRAPING_COMPLETED",
                    event_data=f"Successfully scraped and extracted {success_count} web pages for your bot.",
                    bot_id=bot_id
                )
            else:
                add_notification(
                    db=db,
                    event_type="WEB_SCRAPING_COMPLETED",
                    event_data=f"Web scraping completed but no content was found on the provided URLs.",
                    bot_id=bot_id
                )
            
            logger.info(f"✅ Sent completion notification for bot {bot_id}")
        except Exception as notify_err:
            logger.exception(f"❌ Failed to send completion notification: {str(notify_err)}")
        
        # Return results
        return {
            "status": "complete",
            "bot_id": bot_id,
            "success_count": success_count,
            "scraped_data": result
        }
        
    except Exception as e:
        logger.exception(f"❌ Error in Celery task for processing web scraping: {str(e)}")
        try:
            db = next(get_db())
            mark_scraped_nodes_failed(db, bot_id, url_list, str(e))
        except Exception as mark_err:
            logger.exception(f"❌ Failed to update scraped nodes to FAILED: {str(mark_err)}")
        # Capture full stack trace
        import traceback
        logger.error(f"❌ Full stack trace: {traceback.format_exc()}")
        
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

@celery_app.task(bind=True, name="process_web_scraping_part2", max_retries=3)
def process_web_scraping_part2(self, bot_id: int, scraped_node_ids: list):
    """
    Celery task to vectorize selected scraped website nodes for a given bot.
    """
    from app.word_count_validation import update_word_usage
    try:
        logger.info(f"🚀 Starting vectorization of {len(scraped_node_ids)} scraped nodes for bot {bot_id}")
        db = next(get_db())

        nodes = db.query(ScrapedNode).filter(
            ScrapedNode.id.in_(scraped_node_ids),
            ScrapedNode.bot_id == bot_id,
            ScrapedNode.nodes_text.isnot(None),
            ScrapedNode.is_deleted == False
        ).all()

        if not nodes:
            logger.info(f"✅ No scraped nodes found by ID for bot {bot_id}")
            return {"status": "skipped", "message": "No scraped nodes to process", "bot_id": bot_id}

        logger.info(f"🎯 Found {len(nodes)} scraped nodes to vectorize for bot {bot_id}")
        total_words_embedded = 0

        for node in nodes:
            url = node.url
            try:
                logger.info(f"Preparing to add document to vector DB", extra={"bot_id": bot_id, "url": url})
                website_id = hashlib.md5(url.encode()).hexdigest()

                metadata = {
                    "id": website_id,
                    "source": "website",
                    "website_url": url,
                    "title": node.title or "No Title",
                    "url": url,
                    "file_name": node.title or "No Title",
                    "bot_id": bot_id
                }

                bot = db.query(Bot).filter(Bot.bot_id == bot_id).first()
                user_id = bot.user_id if bot else None
                

                text_chunks = chunk_text(node.nodes_text)
                logger.info(f"Split text into {len(text_chunks)} chunks", extra={"bot_id": bot_id, "url": url})

                for i, chunk in enumerate(text_chunks):
                    chunk_metadata = metadata.copy()
                    chunk_metadata["id"] = f"{website_id}_{i}" if len(text_chunks) > 1 else website_id
                    chunk_metadata["chunk_number"] = i + 1
                    chunk_metadata["total_chunks"] = len(text_chunks)

                    if user_id:
                        logger.info(f"Adding chunk {i+1}/{len(text_chunks)} to vector DB", 
                                          extra={"bot_id": bot_id, "url": url, "user_id": user_id})
                        add_document(bot_id, text=chunk, metadata=chunk_metadata, user_id=user_id)
                    else:
                        logger.warning(f"No user_id found for bot, adding chunk without user context",
                                            extra={"bot_id": bot_id, "url": url})
                        add_document(bot_id, text=chunk, metadata=chunk_metadata)

                total_words_embedded += len(node.nodes_text.split())
                print("count of words embeded in website", total_words_embedded)
                logger.info(f"Successfully added document chunks to vector DB",
                                  extra={"bot_id": bot_id, "url": url,
                                        "document_id": website_id, "chunk_count": len(text_chunks)})
                

                node.status = "Success"
                node.last_embedded = datetime.now()
                node.updated_by = user_id
                logger.info(f"✅ Vectorization complete for {url}", extra={"bot_id": bot_id})

            except Exception as db_err:
                node.status = "Failed"
                node.error_code = f"Embedding Failed: {str(db_err)}"
                logger.error(f"❌ Failed to embed document from {url}", extra={"bot_id": bot_id, "error": str(db_err)})
                import traceback
                logger.error(traceback.format_exc())

        db.commit()
        if total_words_embedded > 0:
              # or wherever it's defined
            update_word_usage(db, bot_id, total_words_embedded)
            logger.info(
                        f"✅ Word usage updated: {total_words_embedded} words added to bot {bot_id}",
                        extra={
                            "bot_id": bot_id,
                            "words_added": total_words_embedded
                        }
                    )
        return {"status": "completed", "message": "Vectorization complete", "bot_id": bot_id}

    except Exception as e:
        logger.exception(f"❌ Error in vectorizing scraped nodes for bot {bot_id}: {str(e)}")
        raise self.retry(exc=e, countdown=60 * (2 ** self.request.retries))
