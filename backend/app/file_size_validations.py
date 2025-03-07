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

router = APIRouter()

UPLOAD_FOLDER = "uploads"
MAX_FILE_SIZE_MB = 10  # Maximum allowed total file size in MB
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024  # Convert MB to Bytes

# Ensure the upload folder exists
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

def convert_size(size_bytes):
    """Convert file size in bytes to a human-readable format (KB, MB, etc.)."""
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.2f} KB"
    elif size_bytes < 1024 * 1024 * 1024:
        return f"{size_bytes / (1024 * 1024):.2f} MB"
    else:
        return f"{size_bytes / (1024 * 1024 * 1024):.2f} GB"

@router.post("/upload")
async def validate_and_upload_files(
    files: List[UploadFile] = File(),
    bot_id: int = Form(...),
    db: Session = Depends(get_db),
    current_user: UserOut = Depends(get_current_user)
):
    """Validates total file size and uploads files if within limit."""
    
    # Calculate total size of all files
    total_size = sum(file.size for file in files)
    
    if total_size > MAX_FILE_SIZE_BYTES:
        raise HTTPException(status_code=400, detail=f"Total file size exceeds {MAX_FILE_SIZE_MB}MB limit")

    if not bot_id:
        raise HTTPException(status_code=400, detail="Bot ID is required")
    
    
    uploaded_files = []
    for file in files:
        # Extract the original filename
        original_filename = file.filename  # Get original filename
        
        # Generate a unique filename for storage (to avoid conflicts)
        unique_filename = f"{Path(file.filename).stem}_{uuid.uuid4().hex[:8]}{Path(file.filename).suffix}"
        file_path = os.path.join(UPLOAD_FOLDER, unique_filename)

        # Save the file to the upload folder
        with open(file_path, "wb") as buffer:
            buffer.write(await file.read())  # Save file asynchronously
        
        # Convert file size to a human-readable format
        file_size_readable = convert_size(file.size)

        # Prepare file metadata for the database
        file_metadata = {
            "bot_id": bot_id,
            "file_name": original_filename,  
            "file_type": file.content_type,
            "file_path": str(file_path),
            "file_size": file_size_readable,  
            "unique_file_name":unique_filename
        }

        # Insert file metadata into the database
        db_file = FileModel(**file_metadata)
        db.add(db_file)
        db.commit()
        db.refresh(db_file)

        # Append file details to the response
        uploaded_files.append({
            "filename": original_filename,
            "filetype": file.content_type,
            "size": file_size_readable,
            "file_path": str(file_path),
            "upload_date": datetime.now().isoformat(),
            "unique_file_name":unique_filename
        })

    return {"success": True, "message": "Files uploaded successfully", "files": uploaded_files}

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



