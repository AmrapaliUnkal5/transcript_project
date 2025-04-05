from fastapi import HTTPException,UploadFile
from typing import List
from pathlib import Path
import os
import uuid
import shutil
from datetime import datetime
from sqlalchemy.orm import Session
from app.database import get_db, SessionLocal
from app.models import File as FileModel, Bot, User
from app.schemas import UserOut
from app.utils.upload_knowledge_utils import extract_text_from_file
from app.vector_db import add_document
from app.utils.upload_knowledge_utils import extract_text_from_file,validate_and_store_text_in_ChromaDB
from app.subscription_config import get_plan_limits

# Update other constants to be dynamic
UPLOAD_FOLDER = "uploads"  
MAX_FILE_SIZE_MB = None  
MAX_FILE_SIZE_BYTES = None 
ARCHIVE_FOLDER = "archives"


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

def validate_file_size(files: List[UploadFile], current_user: dict):
    plan_limits = get_plan_limits(current_user["subscription_plan_id"])
    max_size_bytes = plan_limits["file_size_limit_mb"] * 1024 * 1024
    
    for file in files:
        if file.size > max_size_bytes:
            raise HTTPException(
                status_code=400,
                detail=f"File {file.filename} exceeds {plan_limits['file_size_limit_mb']}MB limit for your {plan_limits['name']} plan"
            )

def generate_file_id(bot_id: int, filename: str) -> str:
    """Generate a consistent file ID based on bot_id and filename."""
    base_name = Path(filename).stem
    # Create a sanitized filename by removing special characters
    sanitized = ''.join(c if c.isalnum() else '_' for c in base_name)
    return f"{sanitized}_{bot_id}_{uuid.uuid4().hex[:8]}"

def get_bot_user_id(bot_id: int):
    """Gets the user_id associated with a bot for file organization."""
    db = SessionLocal()
    try:
        bot = db.query(Bot).filter(Bot.bot_id == bot_id).first()
        if not bot:
            return None
        return bot.user_id
    finally:
        db.close()

def get_hierarchical_file_path(bot_id: int, filename: str, folder=UPLOAD_FOLDER, is_archive=False):
    """Creates a hierarchical file path: uploads/account_X/bot_Y/filename."""
    user_id = get_bot_user_id(bot_id)
    if not user_id:
        # Fallback to default folder if user not found
        return os.path.join(folder, filename)
        
    # Create hierarchical path
    account_dir = os.path.join(folder, f"account_{user_id}")
    bot_dir = os.path.join(account_dir, f"bot_{bot_id}")
    
    if is_archive:
        archive_dir = os.path.join(bot_dir, "archives")
        # Create directories if they don't exist
        os.makedirs(archive_dir, exist_ok=True)
        return os.path.join(archive_dir, filename)
    else:
        # Create directories if they don't exist
        os.makedirs(bot_dir, exist_ok=True)
        return os.path.join(bot_dir, filename)

async def save_file_to_folder(file: UploadFile, file_path: str):
    """Saves the file to the upload folder."""
    # Ensure directory exists
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    
    with open(file_path, "wb") as buffer:
        buffer.write(await file.read())

async def save_extracted_text(text: str, file_path: str):
    """Saves extracted text to a .txt file."""
    # Ensure directory exists
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(text)
    
    return file_path

async def archive_original_file(file: UploadFile, bot_id: int, file_id: str):
    """Archives the original file."""
    # Get the original extension
    _, ext = os.path.splitext(file.filename)
    archive_filename = f"{file_id}_original{ext}"
    
    # Create archive path
    archive_path = get_hierarchical_file_path(bot_id, archive_filename, folder=UPLOAD_FOLDER, is_archive=True)
    
    # Reset file pointer to beginning
    file.file.seek(0)
    
    # Save original file to archive
    with open(archive_path, "wb") as buffer:
        buffer.write(await file.read())
    
    return archive_path

def prepare_file_metadata(original_filename: str, file_type: str, bot_id: int, text_file_path: str, file_id: str, word_count: int = 0, char_count: int = 0):
    """Prepares file metadata for database insertion."""
    file_size = os.path.getsize(text_file_path)
    file_size_readable = convert_size(file_size)
    
    return {
        "bot_id": bot_id,
        "file_name": original_filename,
        "file_type": file_type,
        "file_path": text_file_path,
        "file_size": file_size_readable,
        "unique_file_name": file_id,
        "word_count": word_count,
        "character_count": char_count
    }

def insert_file_metadata(db: Session, file_metadata: dict):
    """Inserts file metadata into the database."""
    db_file = FileModel(**file_metadata)
    db.add(db_file)
    db.commit()
    db.refresh(db_file)
    return db_file

async def process_file_for_knowledge(file: UploadFile, bot_id: int):
    """
    Extracts text, validates it, archives original file and stores in ChromaDB.
    
    Returns:
        tuple: (extracted_text, file_id)
    """
    file.file.seek(0)  # Reset file pointer
    
    try:
        # Generate a consistent file ID
        file_id = generate_file_id(bot_id, file.filename)
        
        # Extract text from file
        text = await extract_text_from_file(file)
        if not text:
            print(f"⚠️ No extractable text found in the file: {file.filename}")
            raise HTTPException(status_code=400, detail="No extractable text found in the file.")
        
        # Get user_id for the bot to include in metadata
        user_id = get_bot_user_id(bot_id)
        
        # Create a more complete metadata object
        metadata = {
            "id": file_id,
            "file_name": file.filename,
            "file_type": file.content_type,
            "source": "upload",
            "bot_id": bot_id,
            "user_id": user_id
        }
        
        # Store extracted text in ChromaDB
        print(f"💾 Storing document in ChromaDB for bot {bot_id}: {file.filename}")
        add_document(bot_id, text, metadata)
        
        return text, file_id
    except Exception as e:
        print(f"❌ Error processing file for knowledge: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Error processing file: {str(e)}")