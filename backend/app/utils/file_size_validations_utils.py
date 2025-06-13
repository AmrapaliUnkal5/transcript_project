import re
from fastapi import HTTPException,UploadFile,HTTPException, status
from typing import List
from pathlib import Path
import os
import uuid
import shutil
from datetime import datetime
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.database import get_db, SessionLocal
from app.models import File as FileModel, Bot, User
from app.schemas import UserOut
from app.utils.upload_knowledge_utils import extract_text_from_file
from app.vector_db import add_document
from app.utils.upload_knowledge_utils import extract_text_from_file,validate_and_store_text_in_ChromaDB
from app.fetchsubscripitonplans import get_subscription_plan_by_id
import logging
from app.utils.logger import get_module_logger
from app.config import settings
from app.utils.file_storage import save_file, FileStorageError

# Create a logger for this module
logger = get_module_logger(__name__)

# Update other constants to be dynamic
UPLOAD_FOLDER = settings.UPLOAD_DIR
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

async def validate_file_size(files: List[UploadFile], current_user: dict, db: Session):
    """Validate file sizes against user's subscription limits"""
    plan_limits = await get_subscription_plan_by_id(current_user["subscription_plan_id"], db)
    if not plan_limits:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Subscription plan not found"
        )
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

def get_hierarchical_file_path(bot_id: int, filename: str, folder=None, is_archive=False):
    """Creates a hierarchical file path: uploads/account_X/bot_Y/filename."""
    if folder is None:
        folder = settings.UPLOAD_DIR
        
    user_id = get_bot_user_id(bot_id)
    if not user_id:
        # Fallback to default folder if user not found
        return os.path.join(folder, filename)
        
    # Create hierarchical path
    account_dir = os.path.join(folder, f"account_{user_id}")
    bot_dir = os.path.join(account_dir, f"bot_{bot_id}")
    
    if is_archive:
        archive_dir = os.path.join(bot_dir, "archives")
        # Create directories if they don't exist (skip if S3 paths)
        if not archive_dir.startswith("s3://"):
            os.makedirs(archive_dir, exist_ok=True)
        return os.path.join(archive_dir, filename)
    else:
        # Create directories if they don't exist (skip if S3 paths)
        if not bot_dir.startswith("s3://"):
            os.makedirs(bot_dir, exist_ok=True)
        return os.path.join(bot_dir, filename)

async def save_file_to_folder(file: UploadFile, file_path: str):
    """Saves the file to the upload folder."""
    # Ensure directory exists (skip if S3 paths)
    dir_path = os.path.dirname(file_path)
    if not dir_path.startswith("s3://"):
        os.makedirs(dir_path, exist_ok=True)
    
    with open(file_path, "wb") as buffer:
        buffer.write(await file.read())

async def save_extracted_text(text: str, file_path: str):
    """Saves extracted text to a .txt file, handling both local and S3 storage."""
    try:
        # Check if this looks like an S3 path (if UPLOAD_DIR is configured for S3)
        if settings.UPLOAD_DIR.startswith('s3://'):
            # For S3 storage, we need to extract the relative path and use the file storage helper
            # The file_path will look like: s3://bucket/uploads/account_1/bot_2/filename.txt
            # We need to extract just the filename and construct the proper S3 path
            
            # Extract the filename from the full path
            filename = os.path.basename(file_path)
            
            # Get the relative path within the upload directory
            # file_path structure: s3://bucket/uploads/account_X/bot_Y/filename.txt
            # We want: account_X/bot_Y/filename.txt
            upload_dir_path = settings.UPLOAD_DIR.rstrip('/')
            if file_path.startswith(upload_dir_path + '/'):
                relative_path = file_path[len(upload_dir_path + '/'):]
            else:
                # Fallback: just use the filename
                relative_path = filename
            
            # Use the file storage helper for S3
            text_bytes = text.encode('utf-8')
            saved_path = save_file(settings.UPLOAD_DIR, relative_path, text_bytes)
            
            logger.info(f"Successfully saved extracted text to S3: {saved_path}")
            return saved_path
        else:
            # For local storage, use the existing direct file operations
            # Ensure directory exists (skip if S3 paths)
            dir_path = os.path.dirname(file_path)
            if not dir_path.startswith("s3://"):
                os.makedirs(dir_path, exist_ok=True)
            
            # Save directly to local storage
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(text)
                
            logger.info(f"Successfully saved extracted text to local storage: {file_path}")
            return file_path
        
    except Exception as e:
        logger.error(f"Error saving extracted text to {file_path}: {str(e)}")
        raise

async def archive_original_file(file: UploadFile, bot_id: int, file_id: str):
    """Archives the original file, handling both local and S3 storage."""
    try:
        # Get the original extension
        _, ext = os.path.splitext(file.filename)
        archive_filename = f"{file_id}_original{ext}"
        
        # Reset file pointer to beginning
        file.file.seek(0)
        file_content = await file.read()
        
        # Check if this should go to S3
        if settings.UPLOAD_DIR.startswith('s3://'):
            # For S3 storage, construct the archive path relative to the upload directory
            user_id = get_bot_user_id(bot_id)
            if user_id:
                archive_relative_path = f"account_{user_id}/bot_{bot_id}/archives/{archive_filename}"
            else:
                archive_relative_path = f"archives/{archive_filename}"
            
            # Use the file storage helper for S3
            saved_path = save_file(UPLOAD_FOLDER, archive_relative_path, file_content)
            logger.info(f"Successfully archived original file to S3: {saved_path}")
            return saved_path
        else:
            # For local storage, use the existing method
            archive_path = get_hierarchical_file_path(bot_id, archive_filename, folder=UPLOAD_FOLDER, is_archive=True)
            
            # Save original file to archive
            with open(archive_path, "wb") as buffer:
                buffer.write(file_content)
            
            logger.info(f"Successfully archived original file to local storage: {archive_path}")
            return archive_path
            
    except Exception as e:
        logger.error(f"Error archiving original file: {str(e)}")
        raise

def prepare_file_metadata(original_filename: str, file_type: str, bot_id: int, text_file_path: str, file_id: str, word_count: int = 0, char_count: int = 0, original_size_bytes: int = 0 ):
    """Prepares file metadata for database insertion."""
    try:
        # Check if this is an S3 path
        if settings.UPLOAD_DIR.startswith('s3://') and text_file_path.startswith('s3://'):
            # For S3 storage, we can't use os.path.getsize()
            # Since we just created the file with "Processing file..." text, we know the size
            # We'll calculate the size of the placeholder text
            placeholder_text = "Processing file..."
            file_size = len(placeholder_text.encode('utf-8'))
            logger.info(f"S3 file size calculated for placeholder: {file_size} bytes")
        else:
            # For local storage, use the existing method
            file_size = os.path.getsize(text_file_path)
            logger.info(f"Local file size: {file_size} bytes")
            
    except Exception as e:
        logger.error(f"Error getting file size for {text_file_path}: {str(e)}")
        # Fallback to a reasonable default for placeholder text
        placeholder_text = "Processing file..."
        file_size = len(placeholder_text.encode('utf-8'))
        logger.warning(f"Using fallback file size: {file_size} bytes")
    
    file_size_readable = convert_size(file_size)
    original_size_readable = convert_size(original_size_bytes)
    
    return {
        "bot_id": bot_id,
        "file_name": original_filename,
        "file_type": file_type,
        "file_path": text_file_path,
        "file_size": file_size_readable,
        "unique_file_name": file_id,
        "word_count": word_count,
        "character_count": char_count,
        "original_file_size": original_size_readable,  # Original file size (human-readable)
        "original_file_size_bytes": original_size_bytes,  # Original size in bytes

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
            logger.warning(f"⚠️ No extractable text found in the file: {file.filename}")
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
        logger.info(f"💾 Storing document in ChromaDB for bot {bot_id}: {file.filename}")
        add_document(bot_id, text, metadata)
        
        return text, file_id
    except Exception as e:
        logger.error(f"❌ Error processing file for knowledge: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Error processing file: {str(e)}")
    
def parse_storage_to_bytes(storage_str: str) -> int:
    """Convert storage string (like '20 MB', '1 GB') to bytes"""
    units = {"KB": 1024, "MB": 1024**2, "GB": 1024**3, "TB": 1024**4}
    match = re.match(r"^(\d+\.?\d*)\s*(KB|MB|GB|TB)$", storage_str.upper())
    if not match:
        return 0
    return int(float(match.group(1)) * units[match.group(2)])

async def get_current_usage(user_id: int, db: Session):
    """Get current word count and storage usage for a user"""
    # Get total words used (from files)
    total_words = db.query(func.sum(FileModel.word_count)).filter(
        FileModel.bot_id.in_(
            db.query(Bot.bot_id).filter(Bot.user_id == user_id)
        )
    ).scalar() or 0
    
    # Get total storage used (from files)
    total_storage_bytes = db.query(func.sum(FileModel.original_file_size_bytes)).filter(
        FileModel.bot_id.in_(
            db.query(Bot.bot_id).filter(Bot.user_id == user_id)
        )
    ).scalar() or 0
    
    return {
        "word_count": total_words,
        "storage_bytes": total_storage_bytes
    }