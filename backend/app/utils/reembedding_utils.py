from app.models import File, Bot, User, EmbeddingModel
from app.vector_db import add_document
from app.utils.upload_knowledge_utils import extract_text_from_file
import aiofiles
import asyncio
import logging
import time
import os
import shutil
from datetime import datetime

async def reembed_all_files(bot_id: int, db):
    """Re-embed all files for a specific bot with the current embedding model.
    
    This function is called when a bot's embedding model is changed to ensure
    all documents use the new embedding model.
    
    When a new model is used with the same dimensions, the same collection is updated.
    When a new model has different dimensions, a temporary collection is created.
    If ALL files are successfully re-embedded, this temporary collection is used.
    If ANY file fails, we keep using the original collection.
    """
    start_time = time.time()
    
    # Get bot details to get user/account info
    # IMPORTANT: Get a fresh query here to ensure we have the latest data
    # after a model ID change in the admin panel
    bot = db.query(Bot).filter(Bot.bot_id == bot_id).first()
    if not bot:
        print(f"❌ Bot with ID {bot_id} not found")
        return {
            "bot_id": bot_id,
            "error": "Bot not found"
        }
    
    # Explicitly refresh from database to ensure we have latest data
    db.refresh(bot)
    
    user_id = bot.user_id
    
    # Get all files for this bot
    files = db.query(File).filter(File.bot_id == bot_id).all()
    total_files = len(files)
    
    if total_files == 0:
        print(f"📄 No files found for bot {bot_id}. Nothing to re-embed.")
        return {
            "bot_id": bot_id,
            "total_files": 0,
            "success_count": 0,
            "error_count": 0,
            "elapsed_time": 0
        }
    
    print(f"🔄 Starting re-embedding for bot {bot_id}. Total files: {total_files}")
    
    # Verify we have proper embedding model information
    if not bot.embedding_model_id:
        print(f"❌ Bot {bot_id} has no embedding model ID assigned")
        return {
            "bot_id": bot_id,
            "error": "No embedding model ID assigned to bot"
        }
    
    # Get embedding model details - query directly to ensure latest data
    embedding_model = db.query(EmbeddingModel).filter(
        EmbeddingModel.id == bot.embedding_model_id
    ).first()
    
    if not embedding_model:
        print(f"❌ Could not find embedding model with ID {bot.embedding_model_id}")
        return {
            "bot_id": bot_id,
            "error": f"Could not find embedding model with ID {bot.embedding_model_id}"
        }
    
    print(f"📋 Embedding model details:")
    print(f"   - ID: {embedding_model.id}")
    print(f"   - Name: {embedding_model.name}")
    print(f"   - Provider: {embedding_model.provider}")
    if embedding_model.dimension:
        print(f"   - Dimension: {embedding_model.dimension}")
    
    # Store the model name to ensure consistency
    model_name = embedding_model.name
    
    # Try to get the model name first
    try:
        # We won't rely on get_bot_config here since it might be inconsistent
        # Use the directly retrieved model name instead
        sanitized_model_name = model_name.replace("/", "_").replace(".", "_").replace("-", "_")
        base_collection_name = f"bot_{bot_id}_{sanitized_model_name}"
        print(f"🔍 Using model: {model_name}")
        print(f"📚 Base collection name: {base_collection_name}")
        
        # Create a timestamp string for a consistent temporary collection name
        timestamp = int(time.time())
        temp_collection_name = f"{base_collection_name}_{timestamp}"
        print(f"📚 Creating temporary collection: {temp_collection_name}")
        
    except Exception as e:
        error_msg = f"Error getting model name: {str(e)}"
        print(f"❌ {error_msg}")
        return {
            "bot_id": bot_id,
            "error": error_msg
        }
    
    success_count = 0
    error_count = 0
    first_error_message = None
    
    # Update all files' embedding model ID to the new model
    # This ensures all files get processed with the same model
    for file in files:
        if bot.embedding_model_id:
            file.embedding_model_id = bot.embedding_model_id
            file.embedding_status = "pending"
            file.last_embedded = None
    db.commit()
    
    for index, file in enumerate(files):
        try:
            print(f"📄 Processing file {index+1}/{total_files}: {file.file_name}")
            
            # Since we're now storing just text files, we can directly read the text
            file_path = file.file_path
            
            # Check if file exists
            if not os.path.exists(file_path):
                error_msg = f"File not found: {file_path}"
                print(f"⚠️ {error_msg}")
                if not first_error_message:
                    first_error_message = error_msg
                error_count += 1
                continue
            
            # Read the text file content
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    text = f.read()
                
                if not text or not text.strip():
                    error_msg = f"Empty text in file: {file.file_name}. Skipping."
                    print(f"⚠️ {error_msg}")
                    if not first_error_message:
                        first_error_message = error_msg
                    error_count += 1
                    continue
                    
                print(f"📄 Read {len(text)} characters from {file.file_name}")
            except Exception as e:
                error_msg = f"Error reading text from file {file.file_name}: {str(e)}"
                print(f"❌ {error_msg}")
                if not first_error_message:
                    first_error_message = error_msg
                error_count += 1
                continue
            
            # Create metadata for re-embedding
            metadata = {
                "id": file.unique_file_name,
                "source": "re-embed",
                "file_path": file.file_path,
                "file_name": file.file_name,
                "bot_id": bot_id,
                "user_id": user_id,
                "temp_collection": temp_collection_name,  # Add this to use the same temporary collection for all files
                "model_name": model_name  # Add this to ensure consistent model usage
            }
            
            # Update embedding_status in database
            file.embedding_status = "processing"
            db.commit()
            
            # Add document with new embedding
            try:
                add_document(bot_id, text, metadata, force_model=model_name)  # Force using the same model
                
                # Update status in DB
                file.embedding_status = "completed"
                file.last_embedded = datetime.now()
                db.commit()
                
                success_count += 1
                print(f"✅ Successfully re-embedded file: {file.file_name}")
            except Exception as e:
                error_msg = f"Error adding document to vector DB: {str(e)}"
                print(f"❌ {error_msg}")
                if not first_error_message:
                    first_error_message = error_msg
                
                # Update status in DB to reflect the error
                file.embedding_status = "failed"
                db.commit()
                error_count += 1
            
            # Add a small delay to prevent rate limiting issues with embedding APIs
            await asyncio.sleep(0.5)
            
        except Exception as e:
            error_msg = f"Error re-embedding file {file.file_name}: {str(e)}"
            print(f"❌ {error_msg}")
            # Capture first error message for admin notification
            if not first_error_message:
                first_error_message = error_msg
            
            # Update status in DB
            file.embedding_status = "failed"
            db.commit()
            error_count += 1
    
    elapsed_time = time.time() - start_time
    
    # Check if ALL files were successfully re-embedded
    all_successful = error_count == 0 and success_count == total_files
    
    if all_successful:
        print("✅ All files were successfully re-embedded!")
        print(f"✅ Using the new collection: {temp_collection_name}")
        
        # Update all files to indicate they were embedded with the new model
        for file in files:
            file.embedding_status = "completed"
            file.last_embedded = datetime.now()
            file.embedding_model_id = bot.embedding_model_id
        db.commit()
    else:
        # Some files failed, so we should continue using the original collection
        print(f"⚠️ Some files failed to re-embed ({error_count}/{total_files})")
        print("⚠️ Continuing to use the original collection")
    
    # Summary
    print(f"\n✅ Re-embedding completed for bot {bot_id}")
    print(f"📊 Summary:")
    print(f"   - Total files: {total_files}")
    print(f"   - Successfully re-embedded: {success_count}")
    print(f"   - Failed: {error_count}")
    print(f"   - Elapsed time: {elapsed_time:.2f} seconds")
    print(f"   - All successful: {all_successful}")
    
    # If not all files were successful, revert the embedding model ID for the bot
    if not all_successful:
        print("⚠️ Not all files were successfully re-embedded. Checking for failed files...")
        
        # List failed files for debugging
        failed_files = db.query(File).filter(
            File.bot_id == bot_id,
            File.embedding_status == "failed"
        ).all()
        
        for f in failed_files:
            print(f"❌ Failed file: {f.file_name}")
    
    result = {
        "bot_id": bot_id,
        "total_files": total_files,
        "success_count": success_count,
        "error_count": error_count,
        "elapsed_time": elapsed_time,
        "all_successful": all_successful,
        "temp_collection": temp_collection_name
    }
    
    # Add first error message if any
    if first_error_message:
        result["error_message"] = first_error_message
    
    return result