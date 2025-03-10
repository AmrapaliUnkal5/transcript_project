from fastapi import HTTPException,UploadFile
from typing import List
from pathlib import Path
import os
import uuid
from datetime import datetime
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import File as FileModel, Bot
from app.schemas import UserOut
from app.utils.upload_knowledge_utils import extract_text_from_file,validate_and_store_text_in_ChromaDB


MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10MB
MAX_FILE_SIZE_MB = 10
UPLOAD_FOLDER = "uploads"

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

def validate_file_size(files: List[UploadFile]):
    """Validates the total size of the files."""
    total_size = sum(file.size for file in files)
    if total_size > MAX_FILE_SIZE_BYTES:
        raise HTTPException(status_code=400, detail=f"Total file size exceeds {MAX_FILE_SIZE_MB}MB limit")

def generate_unique_filename(filename: str) -> str:
    """Generates a unique filename to avoid conflicts."""
    return f"{Path(filename).stem}_{uuid.uuid4().hex[:8]}{Path(filename).suffix}"

async def save_file_to_folder(file: UploadFile, file_path: str):
    """Saves the file to the upload folder."""
    with open(file_path, "wb") as buffer:
        buffer.write(await file.read())

def prepare_file_metadata(file: UploadFile, bot_id: int, file_path: str, unique_filename: str):
    """Prepares file metadata for database insertion."""
    file_size_readable = convert_size(file.size)
    return {
        "bot_id": bot_id,
        "file_name": file.filename,
        "file_type": file.content_type,
        "file_path": str(file_path),
        "file_size": file_size_readable,
        "unique_file_name": unique_filename
    }

def insert_file_metadata(db: Session, file_metadata: dict):
    """Inserts file metadata into the database."""
    db_file = FileModel(**file_metadata)
    db.add(db_file)
    db.commit()
    db.refresh(db_file)
    return db_file

async def process_file_for_knowledge(file: UploadFile, bot_id: int):
    """Extracts text, validates it, and stores it in ChromaDB."""
    file.file.seek(0)  # Reset file pointer
    text = await extract_text_from_file(file)
    validate_and_store_text_in_ChromaDB(text, bot_id, file)