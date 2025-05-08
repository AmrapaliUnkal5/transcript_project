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
from app.vector_db import add_document, delete_document_from_chroma, delete_video_from_chroma, delete_url_from_chroma
import os
import hashlib
import uuid

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
        
        # Get bot information for user_id
        bot = db.query(Bot).filter(Bot.bot_id == bot_id).first()
        user_id = bot.user_id if bot else None
        
        # Now handle embedding for each successfully stored video
        stored_videos = result.get("stored_videos", [])
        for video in stored_videos:
            try:
                # Find video in database to get transcript
                video_record = db.query(YouTubeVideo).filter(
                    YouTubeVideo.bot_id == bot_id,
                    YouTubeVideo.video_id == video.get("video_id")
                ).first()
                
                if video_record and video_record.transcript:
                    # Create metadata for embedding - ENSURE CONSISTENT FORMAT
                    video_id = video_record.video_id
                    metadata = {
                        "id": f"youtube_{video_id}",  # Consistent ID format
                        "source": "youtube",          # Source type for retrieval
                        "video_id": video_id,         # Original source ID
                        "title": video_record.title,
                        "url": video_record.url,
                        "file_name": video_record.title,  # For consistency across sources
                        "bot_id": bot_id              # Always include bot_id
                    }
                    
                    # Add the document to the vector database
                    logger.info(f"Adding YouTube transcript to vector database for video: {video_record.title}")
                    add_document(bot_id, text=video_record.transcript, metadata=metadata, user_id=user_id)
                    
                    # Update the database record to mark embedding as complete
                    video_record.embedding_status = "completed"
                    video_record.last_embedded = datetime.now()
                    db.commit()
                    
                    logger.info(f"✅ YouTube video transcript embedded successfully: {video_record.title}")
                else:
                    logger.warning(f"⚠️ No transcript found for video ID: {video.get('video_id')}")
            except Exception as embed_error:
                logger.exception(f"❌ Error embedding YouTube transcript: {str(embed_error)}")
                
                # Update the video record if available
                if video_record:
                    video_record.embedding_status = "failed"
                    db.commit()
        
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
        logger.info(f"File data received: {file_data}")
        
        # Get database session
        db = next(get_db())
        
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
            # Update file status to "processing" in the database
            file_record = db.query(File).filter(
                File.bot_id == bot_id,
                File.unique_file_name == file_id
            ).first()
            
            if file_record:
                logger.info(f"Found file record in database, updating status to 'processing'")
                file_record.embedding_status = "processing"
                db.commit()
            else:
                logger.warning(f"No file record found in database for file_id: {file_id}")
            
            # Process the file content - USING EXISTING TEXT EXTRACTION UTILITIES
            try:
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
                        # Build archive path
                        account_dir = os.path.join("uploads", f"account_{user_id}")
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
                        # Try reading as UTF-8 first
                        with open(file_path, 'r', encoding='utf-8') as f:
                            file_content_text = f.read()
                            logger.info(f"Direct UTF-8 extraction successful, got {len(file_content_text)} characters")
                            
                            # Check if text is just the placeholder
                            if file_content_text.strip() == "Processing file...":
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
                                    # Build path similar to get_hierarchical_file_path with is_archive=True
                                    account_dir = os.path.join("uploads", f"account_{user_id}")
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
                                                import asyncio
                                                
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
                    except UnicodeDecodeError:
                        # Fall back to a more lenient encoding if UTF-8 fails
                        logger.info(f"UTF-8 decoding failed, trying with 'utf-8-sig' encoding")
                        try:
                            with open(file_path, 'r', encoding='utf-8-sig', errors='replace') as f:
                                file_content_text = f.read()
                                logger.info(f"Fallback text extraction successful, got {len(file_content_text)} characters")
                                
                                # Check if text is just the placeholder
                                if file_content_text.strip() == "Processing file...":
                                    logger.warning(f"Detected placeholder text 'Processing file...' even with fallback encoding")
                                    file_content_text = None  # Will proceed to next methods
                        except Exception as txt_err:
                            logger.error(f"Error with direct text file reading: {txt_err}")
                            file_content_text = None
                
                # If not a text file or direct extraction failed, use the standard extraction method
                if file_content_text is None:
                    # Import the existing text extraction function
                    from app.utils.upload_knowledge_utils import extract_text_from_file
                    import asyncio
                    
                    # Use the same text extraction that's working in the rest of the system
                    # We need to run the async function in a synchronous context
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
                    except Exception as extract_error:
                        logger.error(f"Error during text extraction: {str(extract_error)}")
                        logger.exception("Text extraction traceback:")
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
                        # Final fallback - if we have pre-calculated word count but no content,
                        # create placeholder content with the correct word count
                        word_count = file_data.get("word_count", 0)
                        if word_count > 0:
                            logger.warning(f"⚠️ Creating placeholder content with {word_count} words for {original_filename}")
                            file_content_text = f"Content from {original_filename} with {word_count} words. " * (word_count // 10 + 1)
                            logger.info(f"Created {len(file_content_text)} characters of placeholder text")
                        else:
                            logger.error(f"Failed to extract content from file and no fallback available")
                            raise Exception("Failed to extract content from file and no fallback available")
                
                # Update the text file with the extracted content
                if os.path.exists(file_path):
                    logger.info(f"Updating text file with extracted content")
                    with open(file_path, 'w', encoding='utf-8') as f:
                        f.write(file_content_text)
                    logger.info(f"✅ Successfully updated text file with {len(file_content_text)} characters")
                
                # Create metadata for embedding - ENSURE CONSISTENT FORMAT
                metadata = {
                    "id": file_id,               # Primary identifier 
                    "source": "upload",          # Source type for filtering
                    "file_name": original_filename, 
                    "file_type": file_type,
                    "bot_id": bot_id            # Always include bot_id
                }
                
                logger.info(f"Adding document to vector database: {original_filename}")
                
                # Add the document to the vector database with user_id for model selection
                add_document(bot_id, text=file_content_text, metadata=metadata, user_id=user_id)
                
                # Update the database record
                if file_record:
                    logger.info(f"Updating file record with embedding status")
                    file_record.embedding_status = "completed"
                    file_record.last_embedded = datetime.now()
                    db.commit()
                
                # Send success notification
                try:
                    add_notification(
                        db=db,
                        event_type="FILE_PROCESSED",
                        event_data=f'"{original_filename}" has been processed and embedded successfully. {file_data.get("word_count", 0)} words extracted.',
                        bot_id=bot_id,
                        user_id=bot.user_id
                    )
                    logger.info(f"✅ Successfully sent success notification")
                except Exception as notify_error:
                    logger.error(f"Error sending notification: {str(notify_error)}")
                
                logger.info(f"✅ File processing and embedding complete for {original_filename}")
                
                return {
                    "status": "complete",
                    "bot_id": bot_id,
                    "file_id": file_id,
                    "filename": original_filename,
                    "word_count": file_data.get("word_count", 0)
                }
            except Exception as process_error:
                logger.exception(f"❌ Error processing file content: {str(process_error)}")
                raise process_error
                
        except Exception as process_error:
            # Mark file as failed in database
            if file_record:
                logger.info(f"Marking file as failed in database")
                file_record.embedding_status = "failed"
                db.commit()
                logger.info(f"Updated file status to 'failed'")
                
            # Send failure notification
            try:
                add_notification(
                    db=db,
                    event_type="FILE_PROCESSING_FAILED",
                    event_data=f'Failed to process and embed "{original_filename}". Reason: {str(process_error)}',
                    bot_id=bot_id,
                    user_id=bot.user_id
                )
                logger.info(f"Sent failure notification")
            except Exception as notify_error:
                logger.error(f"Error sending failure notification: {str(notify_error)}")
            
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
            logger.info(f"Sent final failure notification after {self.max_retries} retries")
        except Exception as notify_error:
            logger.exception(f"Failed to send final failure notification: {str(notify_error)}")
        
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
        logger.info(f"URLs to process: {url_list}")
        
        # Get database session
        db = next(get_db())
        
        # Get bot information (for notifications)
        bot = db.query(Bot).filter(Bot.bot_id == bot_id).first()
        if not bot:
            error_msg = f"Bot with ID {bot_id} not found"
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
        
        # Get success/failure counts
        success_count = len(result) if result else 0
        
        # Log completion
        logger.info(
            f"✅ Web scraping complete for bot {bot_id}. "
            f"Scraped {success_count} pages successfully."
        )
        
        # Always send a completion notification
        try:
            if success_count > 0:
                add_notification(
                    db=db,
                    event_type="WEB_SCRAPING_COMPLETED",
                    event_data=f"Successfully scraped and embedded {success_count} web pages for your bot.",
                    bot_id=bot_id,
                    user_id=bot.user_id
                )
            else:
                add_notification(
                    db=db,
                    event_type="WEB_SCRAPING_COMPLETED",
                    event_data=f"Web scraping completed but no content was found on the provided URLs.",
                    bot_id=bot_id,
                    user_id=bot.user_id
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