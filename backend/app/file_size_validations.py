import os
import time
import uuid
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Form
from typing import List
from pathlib import Path
from datetime import datetime
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import File as FileModel, Bot
from app.dependency import get_current_user
from app.schemas import UserOut
from app.utils.file_size_validations_utils import (
    UPLOAD_FOLDER,MAX_FILE_SIZE_MB,MAX_FILE_SIZE_BYTES,
    convert_size,
    validate_file_size,
    generate_unique_filename,
    save_file_to_folder,
    prepare_file_metadata,
    insert_file_metadata,
    process_file_for_knowledge
)

router = APIRouter()

# Ensure the upload folder exists
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

@router.post("/upload")
async def validate_and_upload_files(
    files: List[UploadFile] = File(),
    bot_id: int = Form(...),
    db: Session = Depends(get_db),
    current_user: UserOut = Depends(get_current_user)
):
    """Validates total file size, extracts text, stores in ChromaDB, and uploads files only if successful."""
    # Validate total file size
    validate_file_size(files)

    if not bot_id:
        raise HTTPException(status_code=400, detail="Bot ID is required")
    
    uploaded_files = []
    knowledge_upload_messages = []
    
    for file in files:
        original_filename = file.filename

        try:
            # Generate a unique filename
            unique_filename = generate_unique_filename(original_filename)
            file_path = os.path.join(UPLOAD_FOLDER, unique_filename)

            # Process file for knowledge (extract text and store in ChromaDB)
            await process_file_for_knowledge(file, bot_id)

            # Save the file to disk
            await save_file_to_folder(file, file_path)

            # Prepare and insert file metadata into the database
            file_metadata = prepare_file_metadata(file, bot_id, file_path, unique_filename)
            db_file = insert_file_metadata(db, file_metadata)

            # Append file details to response
            uploaded_files.append({
                "filename": original_filename,
                "filetype": file.content_type,
                "size": file_metadata["file_size"],
                "file_path": str(file_path),
                "upload_date": datetime.now().isoformat(),
                "unique_file_name": unique_filename
            })

            # Success message
            knowledge_upload_messages.append(f"Knowledge uploaded successfully for file: {original_filename}")

        except HTTPException as e:
            knowledge_upload_messages.append(f"Failed to upload knowledge for file: {original_filename}. Error: {e.detail}")
        except Exception as e:
            knowledge_upload_messages.append(f"Failed to upload knowledge for file: {original_filename}. Error: {str(e)}")

    # If no files were successfully uploaded, return an error
    if not uploaded_files:
        raise HTTPException(status_code=400, detail="Files can't be uploaded as they were not saved in ChromaDB.")

    return {
        "success": True,
        "message": "Files uploaded successfully",
        "files": uploaded_files,
        "knowledge_upload": knowledge_upload_messages
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

    # Delete the file from the filesystem
    if os.path.exists(file.file_path):
        os.remove(file.file_path)

    # Delete the file record from the database
    db.delete(file)
    db.commit()

    return {"success": True, "message": "File deleted successfully"}



