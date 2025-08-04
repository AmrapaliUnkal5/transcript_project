import os
import time
import json
import uuid
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Form, HTTPException, status
from typing import List
from pathlib import Path
from datetime import datetime
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import File as FileModel, Bot, User, YouTubeVideo, ScrapedNode
from app.dependency import get_current_user
from app.schemas import UserOut, StartTrainingRequest
from app.utils.file_size_validations_utils import (
    UPLOAD_FOLDER,
    convert_size,
    validate_file_size,
    generate_file_id,
    save_file_to_folder,
    prepare_file_metadata,
    insert_file_metadata,
    process_file_for_knowledge,
    get_hierarchical_file_path,
    save_extracted_text,
    archive_original_file,
    parse_storage_to_bytes,
    get_current_usage
)
from app.fetchsubscripitonplans import get_subscription_plan_by_id
from app.word_count_validation import validate_cumulative_word_count, update_bot_word_and_file_count
from .crud import update_user_word_count
from app.notifications import add_notification
from app.vector_db import delete_document_from_chroma
from app.celery_tasks import process_file_upload_part1, process_file_upload_part2, process_youtube_videos_part2, process_web_scraping_part2
from app.utils.file_storage import delete_file as delete_file_storage
from app.config import settings
from app.utils.logger import get_module_logger

# Initialize logger
logger = get_module_logger(__name__)

router = APIRouter()

# Ensure the upload folder exists
if not UPLOAD_FOLDER.startswith("s3://"):
    logger.info(f"🔧 DEBUG: Creating upload folder: {UPLOAD_FOLDER}")
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    logger.info(f"✅ DEBUG: Upload folder ready: {UPLOAD_FOLDER}")
else:
    logger.info(f"☁️ DEBUG: Using S3 storage: {UPLOAD_FOLDER}")

async def validate_file_size(files: List[UploadFile], current_user: dict, db: Session):
    """Validate file sizes against user's subscription limits"""
    logger.info(f"🔍 DEBUG: Starting file size validation for {len(files)} files")
    logger.info(f"👤 DEBUG: Validating for user_id: {current_user.get('user_id')}")
    logger.info(f"📋 DEBUG: User subscription_plan_id: {current_user.get('subscription_plan_id')}")
    
    plan_limits = await get_subscription_plan_by_id(current_user["subscription_plan_id"], db)
    if not plan_limits:
        logger.error(f"❌ DEBUG: Subscription plan not found for plan_id: {current_user['subscription_plan_id']}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Subscription plan not found"
        )
    
    logger.info(f"📊 DEBUG: Plan found - Name: {plan_limits.get('name')}, File size limit: {plan_limits.get('file_size_limit_mb')}MB, Storage limit: {plan_limits.get('storage_limit')}")
    
    storage_limit_bytes = parse_storage_to_bytes(plan_limits["storage_limit"])
    max_size_bytes = plan_limits["file_size_limit_mb"] * 1024 * 1024
    
    logger.info(f"📏 DEBUG: Calculated limits - Storage: {storage_limit_bytes} bytes, Max file: {max_size_bytes} bytes")
    
    # Get current usage
    current_usage = await get_current_usage(current_user["user_id"], db)
    logger.info(f"📈 DEBUG: Current usage - Storage: {current_usage.get('storage_bytes', 0)} bytes")

    # Validate per-file size
    total_new_size = 0
    logger.info(f"🔍 DEBUG: Validating {len(files)} individual files")
    for i, file in enumerate(files):
        logger.info(f"📄 DEBUG: File {i+1}/{len(files)} - Name: {file.filename}, Size: {file.size} bytes")
        if file.size > max_size_bytes:
            logger.error(f"❌ DEBUG: File {file.filename} exceeds size limit - Size: {file.size}, Limit: {max_size_bytes}")
            raise HTTPException(
                status_code=400,
                detail=f"File {file.filename} exceeds {plan_limits['file_size_limit_mb']}MB limit for your {plan_limits['name']} plan"
            )
        total_new_size += file.size
        logger.info(f"✅ DEBUG: File {file.filename} size validation passed")
    
    logger.info(f"📊 DEBUG: Total new size: {total_new_size} bytes")
    
    # Validate cumulative storage
    if current_usage["storage_bytes"] + total_new_size > storage_limit_bytes:
        logger.error(f"❌ DEBUG: Storage limit exceeded - Current: {current_usage['storage_bytes']}, New: {total_new_size}, Limit: {storage_limit_bytes}")
        raise HTTPException(
            status_code=400,
            detail=f"Upload would exceed your storage limit of {plan_limits['storage_limit']}"
        )
    
    logger.info(f"✅ DEBUG: All file size validations passed")
    return plan_limits

@router.get("/files")
async def get_files(
    bot_id: int,
    db: Session = Depends(get_db),
    current_user: UserOut = Depends(get_current_user)
):
    """Fetch files uploaded for the given bot ID."""
    logger.info(f"📂 DEBUG: GET /files called for bot_id: {bot_id}")
    logger.info(f"👤 DEBUG: Request from user_id: {current_user.get('user_id')}")

    # Ensure the bot belongs to the current user
    bot = db.query(Bot).filter(Bot.bot_id == bot_id, Bot.user_id == current_user["user_id"]).first()
    if not bot:
        logger.error(f"❌ DEBUG: Bot not found or unauthorized - bot_id: {bot_id}, user_id: {current_user.get('user_id')}")
        raise HTTPException(status_code=404, detail="No bot found for the given bot ID or unauthorized access")

    logger.info(f"✅ DEBUG: Bot authorization successful - bot_id: {bot_id}")

    # Fetch files related to the given bot ID
    files = db.query(FileModel).filter(FileModel.bot_id == bot_id).all()
    logger.info(f"📄 DEBUG: Found {len(files)} files for bot_id: {bot_id}")

    return files

@router.delete("/files/{file_id}")
async def delete_file(
    file_id: int,
    db: Session = Depends(get_db),
    current_user: UserOut = Depends(get_current_user)
):
    """Delete a file by its ID."""
    logger.info(f"🗑️ DEBUG: DELETE /files/{file_id} called")
    logger.info(f"👤 DEBUG: Request from user_id: {current_user.get('user_id')}")
    
    file = db.query(FileModel).filter(FileModel.file_id == file_id).first()
    if not file:
        logger.error(f"❌ DEBUG: File not found - file_id: {file_id}")
        raise HTTPException(status_code=404, detail="File not found")

    logger.info(f"📄 DEBUG: File found - Name: {file.file_name}, Bot_id: {file.bot_id}, Status: {file.status}")

    # Ensure the file belongs to the current user's bot
    bot = db.query(Bot).filter(Bot.bot_id == file.bot_id, Bot.user_id == current_user["user_id"]).first()
    if not bot:
        logger.error(f"❌ DEBUG: Unauthorized access - file.bot_id: {file.bot_id}, user_id: {current_user.get('user_id')}")
        raise HTTPException(status_code=403, detail="Unauthorized access")

    logger.info(f"✅ DEBUG: File authorization successful")

    # Delete the file from storage (local or S3)
    logger.info(f"🗂️ DEBUG: Starting file deletion from storage")
    logger.info(f"🗂️ DEBUG: File path: {file.file_path}")
    logger.info(f"🗂️ DEBUG: Storage type: {'S3' if settings.UPLOAD_DIR.startswith('s3://') else 'Local'}")
    
    try:
        if settings.UPLOAD_DIR.startswith('s3://'):
            # For S3 storage, extract the relative path and use the file storage helper
            upload_dir_path = settings.UPLOAD_DIR.rstrip('/')
            logger.info(f"☁️ DEBUG: S3 upload directory: {upload_dir_path}")
            
            if file.file_path.startswith(upload_dir_path + '/'):
                relative_path = file.file_path[len(upload_dir_path + '/'):]
                logger.info(f"☁️ DEBUG: S3 relative path: {relative_path}")
                delete_file_storage(settings.UPLOAD_DIR, relative_path)
            else:
                # Fallback: try to delete using just the filename
                filename = os.path.basename(file.file_path)
                logger.info(f"☁️ DEBUG: S3 fallback filename: {filename}")
                delete_file_storage(settings.UPLOAD_DIR, filename)
        else:
            # For local storage, use the existing method
            logger.info(f"💾 DEBUG: Local file path: {file.file_path}")
            if os.path.exists(file.file_path):
                os.remove(file.file_path)
                logger.info(f"✅ DEBUG: Local file deleted successfully")
            else:
                logger.warning(f"⚠️ DEBUG: Local file not found at path: {file.file_path}")
    except Exception as e:
        logger.error(f"❌ DEBUG: Error deleting file from storage: {str(e)}")
        # Continue with deletion even if file deletion fails

    # Delete the document from ChromaDB
    logger.info(f"🗄️ DEBUG: Starting ChromaDB document deletion")
    logger.info(f"🗄️ DEBUG: Bot ID: {bot.bot_id}, File identifier: {file.unique_file_name}")
    
    try:
        # Use the unique_file_name (the actual file identifier) instead of database ID
        # This is the ID that was used when adding to ChromaDB
        delete_document_from_chroma(bot.bot_id, file.unique_file_name)
        logger.info(f"✅ DEBUG: ChromaDB document deleted successfully")
    except Exception as e:
        logger.error(f"❌ DEBUG: Error deleting from ChromaDB: {str(e)}")
        # Continue with deletion even if ChromaDB deletion fails
    
    # ✅ Store values before deletion
    should_update_word_count = file.status == "Success"
    word_count = file.word_count
    file_size = file.original_file_size_bytes
    logger.info(f"📊 DEBUG: Pre-deletion values - should_update_word_count: {should_update_word_count}, word_count: {word_count}, file_size: {file_size}")

    # Delete the file record from the database
    logger.info(f"🗃️ DEBUG: Deleting database record for file_id: {file_id}")
    db.delete(file)
    db.commit()
    logger.info(f"✅ DEBUG: Database record deleted successfully")
    
    # ✅ Now safe to use cached values
    if should_update_word_count:
        logger.info(f"📊 DEBUG: Updating bot word and file count - word_count: -{word_count}, file_size: -{file_size}")
        update_bot_word_and_file_count(
            db,
            bot.bot_id,
            word_count = -word_count,
            file_size = -file_size if file_size else None
        )
        logger.info(f"✅ DEBUG: Bot word and file count updated successfully")
    else:
        logger.info(f"ℹ️ DEBUG: Skipping word count update - file status was not 'Success'")
    
    event_type = "DOCUMENT DELETED"
    logger.info(f"📢 DEBUG: Preparing notification - event_type: {event_type}")

    logger.info(f"👤 DEBUG: Current user details - user_id: {current_user.get('user_id')}, is_team_member: {current_user.get('is_team_member')}")
    if current_user["is_team_member"] == True:
        logged_in_team_member = current_user["member_id"]
        message = f"Document '{file.file_name}' deleted successfully by Team Member :{logged_in_team_member}"
        logger.info(f"👥 DEBUG: Team member deletion - member_id: {logged_in_team_member}")
    else:
        message = f"Document '{file.file_name}' deleted successfully."
        logger.info(f"👤 DEBUG: Regular user deletion")
    
    logger.info(f"📢 DEBUG: Notification message: {message}")
    add_notification(
                    db=db,
                    event_type=event_type,
                    event_data=message,
                    bot_id=bot.bot_id,
                    user_id=current_user["user_id"]
                    )
    logger.info(f"✅ DEBUG: Notification added successfully")

    return {"success": True, "message": "File deleted successfully"}

@router.post("/upload")
async def validate_and_upload_files(
    files: List[UploadFile] = File(),
    bot_id: int = Form(...),
    db: Session = Depends(get_db),
    current_user: UserOut = Depends(get_current_user)
):
    """Validates total file size, extracts text, stores in ChromaDB, and uploads files only if successful."""
    logger.info(f"🚀 DEBUG: Starting validate_and_upload_files function")
    logger.info(f"📄 DEBUG: Received {len(files)} files for bot_id: {bot_id}")
    logger.info(f"👤 DEBUG: Current user: {current_user.get('user_id')} (is_team_member: {current_user.get('is_team_member', 'N/A')})")
    logger.info(f"🗂️ DEBUG: Storage configuration - UPLOAD_DIR: {settings.UPLOAD_DIR}")
    logger.info(f"🗂️ DEBUG: Storage type: {'S3' if settings.UPLOAD_DIR.startswith('s3://') else 'Local'}")
    
    # Validate total file size and get plan limits
    logger.info(f"📏 DEBUG: Starting file size validation")
    try:
        plan_limits = await validate_file_size(files, current_user, db)
        logger.info(f"📏 DEBUG: File size validation passed. Plan: {plan_limits.get('name', 'Unknown')}")
        logger.info(f"📏 DEBUG: Plan limits - File size: {plan_limits.get('file_size_limit_mb', 'N/A')}MB, Storage: {plan_limits.get('storage_limit', 'N/A')}")
    except Exception as e:
        logger.error(f"❌ DEBUG: File size validation failed: {str(e)}")
        raise

    if not bot_id:
        logger.error(f"❌ DEBUG: Bot ID is missing")
        raise HTTPException(status_code=400, detail="Bot ID is required")
    
    logger.info(f"✅ DEBUG: Bot ID validation passed: {bot_id}")
    
    # Parse the word and char counts from JSON strings

    # Validate file sizes and get plan limits
    logger.info(f"📏 DEBUG: Re-validating file size (duplicate call)")
    plan_limits = await validate_file_size(files, current_user, db)
    
    uploaded_files = []
    knowledge_upload_messages = []
    
    logger.info(f"🔄 DEBUG: Starting file processing loop for {len(files)} files")
    
    for i, file in enumerate(files):
        logger.info(f"\n📄 DEBUG: Processing file {i+1}/{len(files)}: {file.filename}")
        logger.info(f"📄 DEBUG: File details - Size: {file.size} bytes, Type: {file.content_type}")
        
        original_filename = file.filename
        original_size_bytes = file.size  # Get original file size
        logger.info(f"📄 DEBUG: Original filename: {original_filename}, Size: {original_size_bytes} bytes")

        try:
            # Generate a file ID for tracking
            logger.info(f"🆔 DEBUG: Generating file ID")
            file_id = generate_file_id(bot_id, original_filename)
            logger.info(f"🆔 DEBUG: Generated file_id: {file_id}")
            
            # Create text file name with txt extension
            text_filename = f"{file_id}.txt"
            logger.info(f"📝 DEBUG: Text filename: {text_filename}")
            
            # Create path for the text file
            logger.info(f"📁 DEBUG: Creating hierarchical file path")
            text_file_path = get_hierarchical_file_path(bot_id, text_filename)
            logger.info(f"📁 DEBUG: Text file path: {text_file_path}")
            
            # Archive the original file to preserve it
            logger.info(f"📦 DEBUG: Starting archive process")
            try:
                archive_path = await archive_original_file(file, bot_id, file_id)
                logger.info(f"📦 DEBUG: Successfully archived original file to: {archive_path}")
            except Exception as archive_error:
                logger.error(f"❌ DEBUG: Archive failed: {str(archive_error)}")
                raise

            # Create an initial empty text file to reserve the path
            logger.info(f"💾 DEBUG: Creating initial placeholder text file")
            try:
                placeholder_result = await save_extracted_text("Processing file...", text_file_path)
                logger.info(f"💾 DEBUG: Placeholder file created at: {placeholder_result}")
            except Exception as placeholder_error:
                logger.error(f"❌ DEBUG: Placeholder creation failed: {str(placeholder_error)}")
                raise
            
            # Create initial file record in pending state
            logger.info(f"📊 DEBUG: Preparing file metadata")
            try:
                file_metadata = prepare_file_metadata(
                    original_filename=original_filename,
                    file_type=file.content_type,
                    bot_id=bot_id,
                    text_file_path=text_file_path,
                    file_id=file_id,
                    original_size_bytes=original_size_bytes
                )
                logger.info(f"📊 DEBUG: File metadata prepared: {file_metadata}")
            except Exception as metadata_error:
                logger.error(f"❌ DEBUG: Metadata preparation failed: {str(metadata_error)}")
                raise
            
            # Set initial  status to Extracting
            file_metadata["status"] = "Extracting"
            file_metadata["created_by"] = current_user["user_id"]
            file_metadata["updated_by"] = current_user["user_id"]
            logger.info(f"📊 DEBUG: Set status to 'Extracting'")
            
            # Insert initial file metadata into database
            logger.info(f"💾 DEBUG: Inserting file metadata into database")
            try:
                db_file = insert_file_metadata(db, file_metadata)
                logger.info(f"💾 DEBUG: Database record created with ID: {db_file.file_id}")
            except Exception as db_error:
                logger.error(f"❌ DEBUG: Database insertion failed: {str(db_error)}")
                raise
            
            # Prepare data for async processing
            logger.info(f"🔄 DEBUG: Preparing data for Celery task")
            file_data = {
                "file_id": file_id,
                "original_filename": original_filename,
                "file_type": file.content_type, 
                "file_path": text_file_path,
                "original_size_bytes": original_size_bytes,
                "file_id_db" :db_file.file_id,

            }
            logger.info(f"🔄 DEBUG: Celery task data: {file_data}")
            
            # Submit file for background processing
            logger.info(f"🚀 DEBUG: Submitting Celery task")
            try:
                task = process_file_upload_part1.delay(bot_id, file_data)
                logger.info(f"🚀 DEBUG: Celery task submitted successfully with task_id: {task.id}")
                logger.info(f"🚀 DEBUG: Task state: {task.state}")
            except Exception as celery_error:
                logger.error(f"❌ DEBUG: Celery task submission failed: {str(celery_error)}")
                logger.error(f"❌ DEBUG: Celery error type: {type(celery_error)}")
                # Continue processing even if Celery fails
                logger.warning(f"⚠️ DEBUG: Continuing without Celery task")
            
            # Add initial notification about file upload
            logger.info(f"📢 DEBUG: Adding notification")
            try:
                event_type = "DOCUMENT_UPLOADED"
                if current_user["is_team_member"] == True:
                    logged_in_team_member = current_user["member_id"]
                    event_data = f'"{original_filename}" begun extraction of text.'# {word_counts_list[i]} words extracted successfully by Team Member :{logged_in_team_member}'
                    logger.info(f"👥 DEBUG: Team member upload - member_id: {logged_in_team_member}")
                else:
                    event_data = f'"{original_filename}" begun extraction of text.'# {word_counts_list[i]} words extracted successfully.'
                    logger.info(f"👤 DEBUG: Regular user upload")
                                  
                add_notification(
                        db=db,
                        event_type=event_type,
                        event_data=event_data,
                        bot_id=bot_id,
                        user_id=current_user["user_id"]
                        )
                logger.info(f"📢 DEBUG: Notification added: {event_data}")
            except Exception as notification_error:
                logger.error(f"❌ DEBUG: Notification failed: {str(notification_error)}")

            # Append file details to response
            logger.info(f"📋 DEBUG: Preparing response data")
            uploaded_files.append({
                "filename": original_filename,
                "filetype": file.content_type,
                "size": file_metadata["file_size"],
                "original_size": file_metadata["original_file_size"],
                "file_path": str(text_file_path),
                "size_limit": plan_limits["file_size_limit_mb"] * 1024 * 1024,
                "upload_date": datetime.now().isoformat(),
                "unique_file_name": file_id,
                "plan_name": plan_limits["name"],
                "status": "processing",
                "file_id_db": file_data["file_id_db"]
            })

            # Success message
            knowledge_upload_messages.append(f"File upload initiated for: {original_filename}. Processing in background.")
            logger.info(f"✅ DEBUG: File {i+1}/{len(files)} processed successfully: {original_filename}")

        except HTTPException as e:
            logger.error(f"❌ DEBUG: HTTPException for file {original_filename}: {e.detail}")
            knowledge_upload_messages.append(f"Failed to upload file: {original_filename}. Error: {e.detail}")
        except Exception as e:
            logger.error(f"❌ DEBUG: Unexpected error for file {original_filename}: {str(e)}")
            logger.error(f"❌ DEBUG: Error type: {type(e)}")
            import traceback
            logger.error(f"❌ DEBUG: Full traceback: {traceback.format_exc()}")
            knowledge_upload_messages.append(f"Failed to upload file: {original_filename}. Error: {str(e)}")

    logger.info(f"\n🏁 DEBUG: File processing loop completed")
    logger.info(f"🏁 DEBUG: Successfully processed: {len(uploaded_files)} files")
    logger.info(f"🏁 DEBUG: Total messages: {len(knowledge_upload_messages)}")

    # If no files were successfully uploaded, return an error
    if not uploaded_files:
        logger.error(f"❌ DEBUG: No files were successfully uploaded")
        raise HTTPException(status_code=400, detail="No files could be uploaded for processing.")

    logger.info(f"✅ DEBUG: Preparing final response")
    response_data = {
        "success": True,
        "message": "Files uploaded and queued for processing. You will be notified when processing is complete.",
        "files": uploaded_files,
        "knowledge_upload": knowledge_upload_messages,
        # "total_word_count": total_word_count,
        # "total_char_count": total_char_count,
        "plan_limits": {  # Include plan info in response
            "name": plan_limits["name"],
            "file_size_limit_mb": plan_limits["file_size_limit_mb"],
        }
    }
    
    logger.info(f"✅ DEBUG: Final response prepared with {len(uploaded_files)} files")
    logger.info(f"🏆 DEBUG: validate_and_upload_files function completed successfully")
    
    return response_data



@router.post("/start-training")
def start_training(
    request: StartTrainingRequest,
    db: Session = Depends(get_db)
):
    logger.info(f"🎯 DEBUG: POST /start-training called")
    logger.info(f"🤖 DEBUG: Request bot_id: {request.bot_id}")
    
    # ✅ Step 1: Mark bot as trained
    bot_id = request.bot_id
    logger.info(f"🤖 DEBUG: Processing bot_id: {bot_id}")
    bot = db.query(Bot).filter(Bot.bot_id == bot_id).first()
    if not bot:
        logger.error(f"❌ DEBUG: Bot not found - bot_id: {bot_id}")
        raise HTTPException(status_code=404, detail="Bot not found")

    logger.info(f"✅ DEBUG: Bot found - bot_id: {bot_id}")

    # ✅ Step 1: Fetch eligible files for vectorization
    logger.info(f"📄 DEBUG: Fetching files with status 'Extracted' for bot_id: {bot_id}")
    files_to_vectorize = db.query(FileModel).filter(
        FileModel.bot_id == bot_id,
        FileModel.status == "Extracted"
    ).all()

    if files_to_vectorize:
        logger.info(f"📄 DEBUG: Found {len(files_to_vectorize)} files to vectorize for bot {bot_id}")
        for i, file in enumerate(files_to_vectorize):
            logger.info(f"📄 DEBUG: File {i+1}/{len(files_to_vectorize)} - ID: {file.file_id}, Name: {file.file_name}, Status: {file.status}")
            file.status = "Embedding"  # update status before dispatch
            db.add(file)
            logger.info(f"🔄 DEBUG: Dispatching Celery task for file: {file.unique_file_name}")
            process_file_upload_part2.delay(bot_id, file.unique_file_name)
        db.commit()
        logger.info(f"✅ DEBUG: Updated {len(files_to_vectorize)} files to 'Embedding' status")
    else:
        logger.info(f"🚫 DEBUG: No files pending vectorization for bot {bot_id}")


    # ✅ Step 3: Vectorize eligible YouTube videos
    logger.info(f"🎯 DEBUG: Fetching YouTube videos with status 'Extracted' for bot_id: {bot_id}")
    videos_to_vectorize = db.query(YouTubeVideo).filter(
        YouTubeVideo.bot_id == bot_id,
        YouTubeVideo.status == "Extracted",
        YouTubeVideo.transcript.isnot(None),
        YouTubeVideo.is_deleted == False
    ).all()

    if videos_to_vectorize:
        logger.info(f"🎯 DEBUG: Found {len(videos_to_vectorize)} videos to vectorize for bot {bot_id}")
        for i, video in enumerate(videos_to_vectorize):
            logger.info(f"🎯 DEBUG: Video {i+1}/{len(videos_to_vectorize)} - ID: {video.id}, Title: {video.title}, Status: {video.status}")
            video.status = "Embedding"
            db.add(video)
        db.commit()
        video_ids = [video.id for video in videos_to_vectorize]
        logger.info(f"🔄 DEBUG: Dispatching Celery task for {len(video_ids)} videos: {video_ids}")
        process_youtube_videos_part2.delay(bot_id, video_ids)
        logger.info(f"✅ DEBUG: Updated {len(videos_to_vectorize)} videos to 'Embedding' status")
    else:
        logger.info(f"🚫 DEBUG: No YouTube videos pending vectorization for bot {bot_id}")
    
    # ✅ Step 3: Vectorize eligible Scraped Nodes
    logger.info(f"🌐 DEBUG: Fetching scraped nodes with status 'Extracted' for bot_id: {bot_id}")
    scraped_nodes_to_vectorize = db.query(ScrapedNode).filter(
        ScrapedNode.bot_id == bot_id,
        ScrapedNode.status == "Extracted",
        ScrapedNode.nodes_text.isnot(None),
        ScrapedNode.is_deleted == False
    ).all()

    if scraped_nodes_to_vectorize:
        logger.info(f"🌐 DEBUG: Found {len(scraped_nodes_to_vectorize)} scraped web pages to vectorize for bot {bot_id}")
        scraped_node_ids = []
        for i, node in enumerate(scraped_nodes_to_vectorize):
            logger.info(f"🌐 DEBUG: Node {i+1}/{len(scraped_nodes_to_vectorize)} - ID: {node.id}, URL: {node.url}, Status: {node.status}")
            node.status = "Embedding"
            scraped_node_ids.append(node.id)
            db.add(node)
        db.commit()
        logger.info(f"🔄 DEBUG: Dispatching Celery task for {len(scraped_node_ids)} scraped nodes: {scraped_node_ids}")
        process_web_scraping_part2.delay(bot_id, scraped_node_ids)
        logger.info(f"✅ DEBUG: Updated {len(scraped_nodes_to_vectorize)} scraped nodes to 'Embedding' status")
    else:
        logger.info(f"🚫 DEBUG: No scraped web pages pending vectorization for bot {bot_id}")

    total_items = len(files_to_vectorize) + len(videos_to_vectorize) + len(scraped_nodes_to_vectorize)
    logger.info(f"🏁 DEBUG: Training started successfully - Total items to vectorize: {total_items}")
    logger.info(f"📊 DEBUG: Breakdown - Files: {len(files_to_vectorize)}, Videos: {len(videos_to_vectorize)}, Web pages: {len(scraped_nodes_to_vectorize)}")

    return {
        "message": f"Training started. Vectorization tasks triggered for "
                   f"{len(files_to_vectorize)} files, {len(videos_to_vectorize)} videos, and "
                   f"{len(scraped_nodes_to_vectorize)} web pages.",
        "bot_id": bot_id,
        "success":True
    }