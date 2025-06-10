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
from app.models import File as FileModel, Bot, User
from app.dependency import get_current_user
from app.schemas import UserOut
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
from app.word_count_validation import validate_cumulative_word_count
from .crud import update_user_word_count
from app.notifications import add_notification
from app.vector_db import delete_document_from_chroma
from app.celery_tasks import process_file_upload
from app.utils.file_storage import delete_file as delete_file_storage
from app.config import settings

router = APIRouter()

# Ensure the upload folder exists
if not UPLOAD_FOLDER.startswith("s3://"):
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)

async def validate_file_size(files: List[UploadFile], current_user: dict, db: Session):
    """Validate file sizes against user's subscription limits"""
    plan_limits = await get_subscription_plan_by_id(current_user["subscription_plan_id"], db)
    if not plan_limits:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Subscription plan not found"
        )
    storage_limit_bytes = parse_storage_to_bytes(plan_limits["storage_limit"])
    max_size_bytes = plan_limits["file_size_limit_mb"] * 1024 * 1024
    
    # Get current usage
    current_usage = await get_current_usage(current_user["user_id"], db)

    # Validate per-file size
    total_new_size = 0
    for file in files:
        if file.size > max_size_bytes:
            raise HTTPException(
                status_code=400,
                detail=f"File {file.filename} exceeds {plan_limits['file_size_limit_mb']}MB limit for your {plan_limits['name']} plan"
            )
        total_new_size += file.size
    
    # Validate cumulative storage
    if current_usage["storage_bytes"] + total_new_size > storage_limit_bytes:
        raise HTTPException(
            status_code=400,
            detail=f"Upload would exceed your storage limit of {plan_limits['storage_limit']}"
        )
    
    return plan_limits

@router.post("/upload")
async def validate_and_upload_files(
    files: List[UploadFile] = File(),
    bot_id: int = Form(...),
    word_counts: str = Form("[]"),  
    char_counts: str = Form("[]"),  
    db: Session = Depends(get_db),
    current_user: UserOut = Depends(get_current_user)
):
    """Validates total file size, extracts text, stores in ChromaDB, and uploads files only if successful."""
    print("🚀 DEBUG: Starting validate_and_upload_files function")
    print(f"🚀 DEBUG: Received {len(files)} files for bot_id: {bot_id}")
    print(f"🚀 DEBUG: Current user: {current_user['user_id']} (is_team_member: {current_user.get('is_team_member', 'N/A')})")
    print(f"🚀 DEBUG: Storage configuration - UPLOAD_DIR: {settings.UPLOAD_DIR}")
    print(f"🚀 DEBUG: Storage type: {'S3' if settings.UPLOAD_DIR.startswith('s3://') else 'Local'}")
    
    # Validate total file size and get plan limits
    print("📏 DEBUG: Starting file size validation")
    try:
        plan_limits = await validate_file_size(files, current_user, db)
        print(f"📏 DEBUG: File size validation passed. Plan: {plan_limits.get('name', 'Unknown')}")
        print(f"📏 DEBUG: Plan limits - File size: {plan_limits.get('file_size_limit_mb', 'N/A')}MB, Storage: {plan_limits.get('storage_limit', 'N/A')}")
    except Exception as e:
        print(f"❌ DEBUG: File size validation failed: {str(e)}")
        raise

    if not bot_id:
        print("❌ DEBUG: Bot ID is missing")
        raise HTTPException(status_code=400, detail="Bot ID is required")
    
    # Parse the word and char counts from JSON strings
    print("🔢 DEBUG: Parsing word and character counts")
    try:
        word_counts_list = json.loads(word_counts)
        char_counts_list = json.loads(char_counts)
        print(f"🔢 DEBUG: Parsed counts - Words: {word_counts_list}, Chars: {char_counts_list}")
    except json.JSONDecodeError as e:
        print(f"❌ DEBUG: Failed to parse counts JSON: {str(e)}")
        raise HTTPException(status_code=400, detail="Invalid word_counts or char_counts format")

    # Validate that counts lists match the number of files
    if len(word_counts_list) != len(files) or len(char_counts_list) != len(files):
        print(f"❌ DEBUG: Count mismatch - Files: {len(files)}, Word counts: {len(word_counts_list)}, Char counts: {len(char_counts_list)}")
        raise HTTPException(
            status_code=400,
            detail=f"Counts lists must match number of files. Got {len(files)} files, "
                  f"{len(word_counts_list)} word counts, {len(char_counts_list)} char counts"
        )

    # Calculate total word and character counts
    total_word_count = sum(word_counts_list)
    total_char_count = sum(char_counts_list)
    print(f"🔢 DEBUG: Total counts - Words: {total_word_count}, Chars: {total_char_count}")

    # Validate file sizes and get plan limits
    print("📏 DEBUG: Re-validating file size (duplicate call)")
    plan_limits = await validate_file_size(files, current_user, db)
    
    # Validate cumulative word count
    print("📝 DEBUG: Validating cumulative word count")
    try:
        await validate_cumulative_word_count(total_word_count, current_user, db)
        print("📝 DEBUG: Cumulative word count validation passed")
    except Exception as e:
        print(f"❌ DEBUG: Cumulative word count validation failed: {str(e)}")
        raise

    uploaded_files = []
    knowledge_upload_messages = []
    
    print(f"🔄 DEBUG: Starting file processing loop for {len(files)} files")
    
    for i, file in enumerate(files):
        print(f"\n📄 DEBUG: Processing file {i+1}/{len(files)}: {file.filename}")
        print(f"📄 DEBUG: File details - Size: {file.size} bytes, Type: {file.content_type}")
        
        original_filename = file.filename
        original_size_bytes = file.size  # Get original file size

        try:
            # Generate a file ID for tracking
            print("🆔 DEBUG: Generating file ID")
            file_id = generate_file_id(bot_id, original_filename)
            print(f"🆔 DEBUG: Generated file_id: {file_id}")
            
            # Create text file name with txt extension
            text_filename = f"{file_id}.txt"
            print(f"📝 DEBUG: Text filename: {text_filename}")
            
            # Create path for the text file
            print("📁 DEBUG: Creating hierarchical file path")
            text_file_path = get_hierarchical_file_path(bot_id, text_filename)
            print(f"📁 DEBUG: Text file path: {text_file_path}")
            
            # Archive the original file to preserve it
            print("📦 DEBUG: Starting archive process")
            try:
                archive_path = await archive_original_file(file, bot_id, file_id)
                print(f"📦 DEBUG: Successfully archived original file to: {archive_path}")
            except Exception as archive_error:
                print(f"❌ DEBUG: Archive failed: {str(archive_error)}")
                raise

            # Create an initial empty text file to reserve the path
            print("💾 DEBUG: Creating initial placeholder text file")
            try:
                placeholder_result = await save_extracted_text("Processing file...", text_file_path)
                print(f"💾 DEBUG: Placeholder file created at: {placeholder_result}")
            except Exception as placeholder_error:
                print(f"❌ DEBUG: Placeholder creation failed: {str(placeholder_error)}")
                raise
            
            # Create initial file record in pending state
            print("📊 DEBUG: Preparing file metadata")
            try:
                file_metadata = prepare_file_metadata(
                    original_filename=original_filename,
                    file_type=file.content_type,
                    bot_id=bot_id,
                    text_file_path=text_file_path,
                    file_id=file_id,
                    word_count=word_counts_list[i],
                    char_count=char_counts_list[i],
                    original_size_bytes=original_size_bytes
                )
                print(f"📊 DEBUG: File metadata prepared: {file_metadata}")
            except Exception as metadata_error:
                print(f"❌ DEBUG: Metadata preparation failed: {str(metadata_error)}")
                raise
            
            # Set initial embedding status to pending
            file_metadata["embedding_status"] = "pending"
            print("📊 DEBUG: Set embedding status to 'pending'")
            
            # Insert initial file metadata into database
            print("💾 DEBUG: Inserting file metadata into database")
            try:
                db_file = insert_file_metadata(db, file_metadata)
                print(f"💾 DEBUG: Database record created with ID: {db_file.file_id}")
            except Exception as db_error:
                print(f"❌ DEBUG: Database insertion failed: {str(db_error)}")
                raise
            
            # Prepare data for async processing
            print("🔄 DEBUG: Preparing data for Celery task")
            file_data = {
                "file_id": file_id,
                "original_filename": original_filename,
                "file_type": file.content_type, 
                "file_path": text_file_path,
                "word_count": word_counts_list[i],
                "char_count": char_counts_list[i],
                "original_size_bytes": original_size_bytes
            }
            print(f"🔄 DEBUG: Celery task data: {file_data}")
            
            # Submit file for background processing
            print("🚀 DEBUG: Submitting Celery task")
            try:
                task = process_file_upload.delay(bot_id, file_data)
                print(f"🚀 DEBUG: Celery task submitted successfully with task_id: {task.id}")
                print(f"🚀 DEBUG: Task state: {task.state}")
            except Exception as celery_error:
                print(f"❌ DEBUG: Celery task submission failed: {str(celery_error)}")
                print(f"❌ DEBUG: Celery error type: {type(celery_error)}")
                # Continue processing even if Celery fails
                print("⚠️ DEBUG: Continuing without Celery task")
            
            # Add initial notification about file upload
            print("📢 DEBUG: Adding notification")
            try:
                event_type = "DOCUMENT_UPLOADED"
                if current_user["is_team_member"] == True:
                    logged_in_team_member = current_user["member_id"]
                    event_data = f'"{original_filename}" uploaded to bot. {word_counts_list[i]} words extracted successfully by Team Member :{logged_in_team_member}'
                else:
                    event_data = f'"{original_filename}" uploaded to bot. {word_counts_list[i]} words extracted successfully.'
                                  
                add_notification(
                        db=db,
                        event_type=event_type,
                        event_data=event_data,
                        bot_id=bot_id,
                        user_id=current_user["user_id"]
                        )
                print(f"📢 DEBUG: Notification added: {event_data}")
            except Exception as notification_error:
                print(f"❌ DEBUG: Notification failed: {str(notification_error)}")

            # Append file details to response
            print("📋 DEBUG: Preparing response data")
            uploaded_files.append({
                "filename": original_filename,
                "filetype": file.content_type,
                "size": file_metadata["file_size"],
                "original_size": file_metadata["original_file_size"],
                "file_path": str(text_file_path),
                "size_limit": plan_limits["file_size_limit_mb"] * 1024 * 1024,
                "upload_date": datetime.now().isoformat(),
                "unique_file_name": file_id,
                "word_count": word_counts_list[i],  
                "char_count": char_counts_list[i], 
                "total_word_count": total_word_count,  
                "total_char_count": total_char_count,
                "plan_name": plan_limits["name"],
                "status": "processing"
            })

            # Success message
            knowledge_upload_messages.append(f"File upload initiated for: {original_filename}. Processing in background.")
            print(f"✅ DEBUG: File {i+1}/{len(files)} processed successfully: {original_filename}")

        except HTTPException as e:
            print(f"❌ DEBUG: HTTPException for file {original_filename}: {e.detail}")
            knowledge_upload_messages.append(f"Failed to upload file: {original_filename}. Error: {e.detail}")
        except Exception as e:
            print(f"❌ DEBUG: Unexpected error for file {original_filename}: {str(e)}")
            print(f"❌ DEBUG: Error type: {type(e)}")
            import traceback
            print(f"❌ DEBUG: Full traceback: {traceback.format_exc()}")
            knowledge_upload_messages.append(f"Failed to upload file: {original_filename}. Error: {str(e)}")

    print(f"\n🏁 DEBUG: File processing loop completed")
    print(f"🏁 DEBUG: Successfully processed: {len(uploaded_files)} files")
    print(f"🏁 DEBUG: Total messages: {len(knowledge_upload_messages)}")

    # If no files were successfully uploaded, return an error
    if not uploaded_files:
        print("❌ DEBUG: No files were successfully uploaded")
        raise HTTPException(status_code=400, detail="No files could be uploaded for processing.")

    print("✅ DEBUG: Preparing final response")
    response_data = {
        "success": True,
        "message": "Files uploaded and queued for processing. You will be notified when processing is complete.",
        "files": uploaded_files,
        "knowledge_upload": knowledge_upload_messages,
        "total_word_count": total_word_count,  
        "total_char_count": total_char_count,
        "plan_limits": {  # Include plan info in response
            "name": plan_limits["name"],
            "file_size_limit_mb": plan_limits["file_size_limit_mb"],
        }
    }
    
    print(f"✅ DEBUG: Final response prepared with {len(uploaded_files)} files")
    print("🏆 DEBUG: validate_and_upload_files function completed successfully")
    
    return response_data

@router.get("/files")
async def get_files(
    bot_id: int,
    db: Session = Depends(get_db),
    current_user: UserOut = Depends(get_current_user)
):
    """Fetch files uploaded for the given bot ID."""
    
    # Ensure the bot belongs to the current user
    bot = db.query(Bot).filter(Bot.bot_id == bot_id, Bot.user_id == current_user["user_id"]).first()
    if not bot:
        raise HTTPException(status_code=404, detail="No bot found for the given bot ID or unauthorized access")
    
    # Fetch files related to the given bot ID
    files = db.query(FileModel).filter(FileModel.bot_id == bot_id).all()

    return files

@router.delete("/files/{file_id}")
async def delete_file(
    file_id: int,
    db: Session = Depends(get_db),
    current_user: UserOut = Depends(get_current_user)
):
    """Delete a file by its ID."""
    file = db.query(FileModel).filter(FileModel.file_id == file_id).first()
    if not file:
        raise HTTPException(status_code=404, detail="File not found")

    # Ensure the file belongs to the current user's bot
    bot = db.query(Bot).filter(Bot.bot_id == file.bot_id, Bot.user_id == current_user["user_id"]).first()
    if not bot:
        raise HTTPException(status_code=403, detail="Unauthorized access")

    # Delete the file from storage (local or S3)
    try:
        if settings.UPLOAD_DIR.startswith('s3://'):
            # For S3 storage, extract the relative path and use the file storage helper
            upload_dir_path = settings.UPLOAD_DIR.rstrip('/')
            if file.file_path.startswith(upload_dir_path + '/'):
                relative_path = file.file_path[len(upload_dir_path + '/'):]
                delete_file_storage(settings.UPLOAD_DIR, relative_path)
            else:
                # Fallback: try to delete using just the filename
                filename = os.path.basename(file.file_path)
                delete_file_storage(settings.UPLOAD_DIR, filename)
        else:
            # For local storage, use the existing method
            if os.path.exists(file.file_path):
                os.remove(file.file_path)
    except Exception as e:
        print(f"Error deleting file from storage: {str(e)}")
        # Continue with deletion even if file deletion fails
    
    # Delete the document from ChromaDB
    try:
        # Use the unique_file_name (the actual file identifier) instead of database ID
        # This is the ID that was used when adding to ChromaDB
        delete_document_from_chroma(bot.bot_id, file.unique_file_name)
        print(f"Deleting document from ChromaDB with bot_id: {bot.bot_id}, file identifier: {file.unique_file_name}")
    except Exception as e:
        print(f"Error deleting from ChromaDB: {str(e)}")
        # Continue with deletion even if ChromaDB deletion fails

    # Delete the file record from the database
    db.delete(file)
    db.commit()
    print("DOCUMENT DELETED")
    event_type = "DOCUMENT DELETED"
    
    print("Bot.bot_id",Bot.bot_id)
    print("current",current_user["user_id"])
    if current_user["is_team_member"] == True:
        logged_in_team_member = current_user["member_id"]
        message = f"Document '{file.file_name}' deleted successfully by Team Member :{logged_in_team_member}"
    else:
        message = f"Document '{file.file_name}' deleted successfully."
    add_notification(
                    
                    db=db,
                    event_type=event_type,
                    event_data=message,
                    bot_id=bot.bot_id,
                    user_id=current_user["user_id"]
                    )

    return {"success": True, "message": "File deleted successfully"}