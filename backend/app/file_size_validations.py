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
    # Validate total file size and get plan limits
    plan_limits = await validate_file_size(files, current_user,db)

    if not bot_id:
        raise HTTPException(status_code=400, detail="Bot ID is required")
    
    # Parse the word and char counts from JSON strings
    try:
        word_counts_list = json.loads(word_counts)
        char_counts_list = json.loads(char_counts)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid word_counts or char_counts format")

    # Validate that counts lists match the number of files
    if len(word_counts_list) != len(files) or len(char_counts_list) != len(files):
        raise HTTPException(
            status_code=400,
            detail=f"Counts lists must match number of files. Got {len(files)} files, "
                  f"{len(word_counts_list)} word counts, {len(char_counts_list)} char counts"
        )

    # Calculate total word and character counts
    total_word_count = sum(word_counts_list)
    total_char_count = sum(char_counts_list)

    # Validate file sizes and get plan limits
    plan_limits = await validate_file_size(files, current_user, db)
    
    # Validate cumulative word count
    await validate_cumulative_word_count(total_word_count, current_user, db)

    uploaded_files = []
    knowledge_upload_messages = []
    
    for i, file in enumerate(files):
        original_filename = file.filename
        original_size_bytes = file.size  # Get original file size

        try:
            # Generate a file ID for tracking
            file_id = generate_file_id(bot_id, original_filename)
            
            # Create text file name with txt extension
            text_filename = f"{file_id}.txt"
            
            # Create path for the text file
            text_file_path = get_hierarchical_file_path(bot_id, text_filename)
            
            # Archive the original file to preserve it
            archive_path = await archive_original_file(file, bot_id, file_id)
            print(f"📦 Archived original file to {archive_path}")

            # Create an initial empty text file to reserve the path
            await save_extracted_text("Processing file...", text_file_path)
            
            # Create initial file record in pending state
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
            
            # Set initial embedding status to pending
            file_metadata["embedding_status"] = "pending"
            
            # Insert initial file metadata into database
            db_file = insert_file_metadata(db, file_metadata)
            
            # Prepare data for async processing
            file_data = {
                "file_id": file_id,
                "original_filename": original_filename,
                "file_type": file.content_type, 
                "file_path": text_file_path,
                "word_count": word_counts_list[i],
                "char_count": char_counts_list[i],
                "original_size_bytes": original_size_bytes
            }
            
            # Submit file for background processing
            process_file_upload.delay(bot_id, file_data)
            
            # Add initial notification about file upload
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

            # Append file details to response
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

        except HTTPException as e:
            knowledge_upload_messages.append(f"Failed to upload file: {original_filename}. Error: {e.detail}")
        except Exception as e:
            knowledge_upload_messages.append(f"Failed to upload file: {original_filename}. Error: {str(e)}")

    # If no files were successfully uploaded, return an error
    if not uploaded_files:
        raise HTTPException(status_code=400, detail="No files could be uploaded for processing.")

    return {
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
                delete_file_storage("UPLOAD_DIR", relative_path)
            else:
                # Fallback: try to delete using just the filename
                filename = os.path.basename(file.file_path)
                delete_file_storage("UPLOAD_DIR", filename)
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