import os
import time
import json
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
    generate_file_id,
    save_file_to_folder,
    prepare_file_metadata,
    insert_file_metadata,
    process_file_for_knowledge,
    get_hierarchical_file_path,
    save_extracted_text,
    archive_original_file
)

router = APIRouter()

# Ensure the upload folder exists
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

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
    # Validate total file size
    validate_file_size(files)

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

    uploaded_files = []
    knowledge_upload_messages = []
    
    for i, file in enumerate(files):
        original_filename = file.filename

        try:
            # Process file for knowledge extraction and ChromaDB storage
            # This extracts text and adds to ChromaDB
            extracted_text, file_id = await process_file_for_knowledge(file, bot_id)
            
            # Create text file name with txt extension
            text_filename = f"{file_id}.txt"
            
            # Create path for the text file
            text_file_path = get_hierarchical_file_path(bot_id, text_filename)
            
            # Save extracted text to a text file
            await save_extracted_text(extracted_text, text_file_path)
            print(f"✅ Saved extracted text to {text_file_path}")
            
            # Archive the original file (optional)
            archive_path = await archive_original_file(file, bot_id, file_id)
            print(f"📦 Archived original file to {archive_path}")

            # Prepare and insert file metadata into the database
            file_metadata = prepare_file_metadata(
                original_filename=original_filename,
                file_type=file.content_type,
                bot_id=bot_id,
                text_file_path=text_file_path,
                file_id=file_id,
                word_count=word_counts_list[i],
                char_count=char_counts_list[i]
            )
            
            db_file = insert_file_metadata(db, file_metadata)

            # Append file details to response
            uploaded_files.append({
                "filename": original_filename,
                "filetype": file.content_type,
                "size": file_metadata["file_size"],
                "file_path": str(text_file_path),
                "upload_date": datetime.now().isoformat(),
                "unique_file_name": file_id,
                "word_count": word_counts_list[i],  
                "char_count": char_counts_list[i], 
                "total_word_count": total_word_count,  
                "total_char_count": total_char_count   
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
        "knowledge_upload": knowledge_upload_messages,
        "total_word_count": total_word_count,  
        "total_char_count": total_char_count   
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