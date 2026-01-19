import re
from fastapi import HTTPException,UploadFile,HTTPException, status
from typing import List, Union, Optional
from pathlib import Path
import os
import uuid
import shutil
from datetime import datetime
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.database import get_db, SessionLocal
from app.models import User
# Bot, File, ScrapedNode, YouTubeVideo removed - transcript project doesn't use bots
from app.schemas import UserOut
# Upload knowledge utils removed - transcript project doesn't use file uploads for knowledge base
# from app.utils.upload_knowledge_utils import extract_text_from_file
# from app.vector_db import add_document
# from app.utils.upload_knowledge_utils import extract_text_from_file,validate_and_store_text_in_ChromaDB
# Subscription plans removed - transcript project doesn't use subscriptions
# from app.fetchsubscripitonplans import get_subscription_plan_by_id
import logging
from app.utils.logger import get_module_logger
from app.config import settings
from app.utils.file_storage import save_file, FileStorageError
from sqlalchemy.orm.exc import NoResultFound
from sqlalchemy import select

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
    """Validate file sizes - subscription limits removed for transcript project"""
    # Subscription validation removed - transcript project doesn't use subscription limits
    pass

# generate_file_id removed - transcript project doesn't use bots or bot-based file IDs

# get_bot_user_id removed - transcript project doesn't use bots

# get_hierarchical_file_path removed - transcript project doesn't use bots or bot-based file organization

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

# Bot-related file archiving and metadata functions removed - transcript project doesn't use bots or file uploads for knowledge base


# process_file_for_knowledge removed - transcript project doesn't use file uploads for knowledge base
    
def parse_storage_to_bytes(storage_str: str) -> int:
    """Convert storage string (like '20 MB', '1 GB') to bytes"""
    units = {"KB": 1024, "MB": 1024**2, "GB": 1024**3, "TB": 1024**4}
    match = re.match(r"^(\d+\.?\d*)\s*(KB|MB|GB|TB)$", storage_str.upper())
    if not match:
        return 0
    return int(float(match.group(1)) * units[match.group(2)])

async def get_current_usage(user_id: int, db: Session):
    """Get current word count and storage usage for a user - simplified for transcript project"""
    # Transcript project doesn't use bots/files - get from user table directly
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        return {"word_count": 0, "storage_bytes": 0}
    
    return {
        "word_count": user.total_words_used or 0,
        "storage_bytes": user.total_file_size or 0
    }

def get_current_usage_sync(user_id: int, db: Session):
    """Get current word count and storage usage for a user - simplified for transcript project"""
    # Transcript project doesn't use bots/files - get from user table directly
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        return {"word_count": 0, "storage_bytes": 0}
    
    return {
        "word_count": user.total_words_used or 0,
        "storage_bytes": user.total_file_size or 0
    }