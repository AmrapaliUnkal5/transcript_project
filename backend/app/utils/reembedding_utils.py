from app.models import File, Bot, User, EmbeddingModel, ScrapedNode, YouTubeVideo
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

async def reembed_all_scraped_nodes(bot_id: int, db):
    """Re-embed all web scraping data for a specific bot with the current embedding model.
    
    This function is called when a bot's embedding model is changed to ensure
    all web scraping data uses the new embedding model.
    """
    start_time = time.time()
    
    # Get bot details to get user/account info
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
    
    # Get all scraped nodes for this bot
    scraped_nodes = db.query(ScrapedNode).filter(
        ScrapedNode.bot_id == bot_id,
        ScrapedNode.is_deleted == False
    ).all()
    total_nodes = len(scraped_nodes)
    
    if total_nodes == 0:
        print(f"📄 No scraped nodes found for bot {bot_id}. Nothing to re-embed.")
        return {
            "bot_id": bot_id,
            "total_nodes": 0,
            "success_count": 0,
            "error_count": 0,
            "elapsed_time": 0
        }
    
    print(f"🔄 Starting re-embedding for bot {bot_id}. Total scraped nodes: {total_nodes}")
    
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
        # Use the directly retrieved model name
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
    
    # Update all scraped nodes' status
    for node in scraped_nodes:
        node.embedding_status = "pending"
        node.last_embedded = None
    db.commit()
    
    for index, node in enumerate(scraped_nodes):
        try:
            print(f"🌐 Processing scraped node {index+1}/{total_nodes}: {node.url}")
            
            # Get the text content
            nodes_text = node.nodes_text
            
            if not nodes_text or not nodes_text.strip():
                error_msg = f"Empty text for node: {node.url}. Skipping."
                print(f"⚠️ {error_msg}")
                if not first_error_message:
                    first_error_message = error_msg
                error_count += 1
                continue
                
            print(f"🌐 Processing content with {len(nodes_text)} characters from {node.url}")
            
            # Create metadata for re-embedding
            metadata = {
                "id": f"node-{node.id}",
                "source": "web-scrape-reembed",
                "url": node.url,
                "title": node.title,
                "bot_id": bot_id,
                "user_id": user_id,
                "website_id": node.website_id,
                "temp_collection": temp_collection_name,
                "model_name": model_name
            }
            
            # Update embedding_status in database
            node.embedding_status = "processing"
            db.commit()
            
            # Add document with new embedding
            try:
                add_document(bot_id, nodes_text, metadata, force_model=model_name)
                
                # Update status in DB
                node.embedding_status = "completed"
                node.last_embedded = datetime.now()
                db.commit()
                
                success_count += 1
                print(f"✅ Successfully re-embedded scraped node: {node.url}")
            except Exception as e:
                error_msg = f"Error adding document to vector DB: {str(e)}"
                print(f"❌ {error_msg}")
                if not first_error_message:
                    first_error_message = error_msg
                
                # Update status in DB to reflect the error
                node.embedding_status = "failed"
                db.commit()
                error_count += 1
            
            # Add a small delay to prevent rate limiting issues with embedding APIs
            await asyncio.sleep(0.5)
            
        except Exception as e:
            error_msg = f"Error re-embedding scraped node {node.url}: {str(e)}"
            print(f"❌ {error_msg}")
            if not first_error_message:
                first_error_message = error_msg
            
            # Update status in DB
            node.embedding_status = "failed"
            db.commit()
            error_count += 1
    
    elapsed_time = time.time() - start_time
    
    # Check if ALL nodes were successfully re-embedded
    all_successful = error_count == 0 and success_count == total_nodes
    
    if all_successful:
        print("✅ All scraped nodes were successfully re-embedded!")
        print(f"✅ Using the new collection: {temp_collection_name}")
        
        # Update all nodes to indicate they were embedded with the new model
        for node in scraped_nodes:
            node.embedding_status = "completed"
            node.last_embedded = datetime.now()
        db.commit()
    else:
        # Some nodes failed, so we should continue using the original collection
        print(f"⚠️ Some scraped nodes failed to re-embed ({error_count}/{total_nodes})")
        print("⚠️ Continuing to use the original collection")
    
    # Summary
    print(f"\n✅ Web scraping re-embedding completed for bot {bot_id}")
    print(f"📊 Summary:")
    print(f"   - Total nodes: {total_nodes}")
    print(f"   - Successfully re-embedded: {success_count}")
    print(f"   - Failed: {error_count}")
    print(f"   - Elapsed time: {elapsed_time:.2f} seconds")
    print(f"   - All successful: {all_successful}")
    
    return {
        "bot_id": bot_id,
        "total_nodes": total_nodes,
        "success_count": success_count,
        "error_count": error_count,
        "elapsed_time": elapsed_time,
        "all_successful": all_successful,
        "first_error": first_error_message
    }

async def reembed_all_youtube_videos(bot_id: int, db):
    """Re-embed all YouTube video transcripts for a specific bot with the current embedding model.
    
    This function is called when a bot's embedding model is changed to ensure
    all YouTube transcripts use the new embedding model.
    """
    start_time = time.time()
    
    # Get bot details to get user/account info
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
    
    # Get all YouTube videos for this bot
    youtube_videos = db.query(YouTubeVideo).filter(
        YouTubeVideo.bot_id == bot_id,
        YouTubeVideo.is_deleted == False
    ).all()
    total_videos = len(youtube_videos)
    
    if total_videos == 0:
        print(f"📺 No YouTube videos found for bot {bot_id}. Nothing to re-embed.")
        return {
            "bot_id": bot_id,
            "total_videos": 0,
            "success_count": 0,
            "error_count": 0,
            "elapsed_time": 0
        }
    
    print(f"🔄 Starting re-embedding for bot {bot_id}. Total YouTube videos: {total_videos}")
    
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
        # Use the directly retrieved model name
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
    
    # Update all YouTube videos' status
    for video in youtube_videos:
        video.embedding_status = "pending"
        video.last_embedded = None
    db.commit()
    
    for index, video in enumerate(youtube_videos):
        try:
            print(f"📺 Processing YouTube video {index+1}/{total_videos}: {video.video_title}")
            
            # Get the transcript content
            transcript_text = video.transcript
            
            if not transcript_text or not transcript_text.strip():
                error_msg = f"No transcript for video: {video.video_id}. Skipping."
                print(f"⚠️ {error_msg}")
                if not first_error_message:
                    first_error_message = error_msg
                error_count += 1
                continue
                
            print(f"📺 Processing transcript with {len(transcript_text)} characters from {video.video_title}")
            
            # Create metadata for re-embedding
            metadata = {
                "id": f"youtube-{video.id}",
                "source": "youtube-reembed",
                "video_id": video.video_id,
                "video_title": video.video_title,
                "channel_name": video.channel_name,
                "bot_id": bot_id,
                "user_id": user_id,
                "temp_collection": temp_collection_name,
                "model_name": model_name
            }
            
            # Update embedding_status in database
            video.embedding_status = "processing"
            db.commit()
            
            # Add document with new embedding
            try:
                add_document(bot_id, transcript_text, metadata, force_model=model_name)
                
                # Update status in DB
                video.embedding_status = "completed"
                video.last_embedded = datetime.now()
                db.commit()
                
                success_count += 1
                print(f"✅ Successfully re-embedded YouTube video: {video.video_title}")
            except Exception as e:
                error_msg = f"Error adding document to vector DB: {str(e)}"
                print(f"❌ {error_msg}")
                if not first_error_message:
                    first_error_message = error_msg
                
                # Update status in DB to reflect the error
                video.embedding_status = "failed"
                db.commit()
                error_count += 1
            
            # Add a small delay to prevent rate limiting issues with embedding APIs
            await asyncio.sleep(0.5)
            
        except Exception as e:
            error_msg = f"Error re-embedding YouTube video {video.video_title}: {str(e)}"
            print(f"❌ {error_msg}")
            if not first_error_message:
                first_error_message = error_msg
            
            # Update status in DB
            video.embedding_status = "failed"
            db.commit()
            error_count += 1
    
    elapsed_time = time.time() - start_time
    
    # Check if ALL videos were successfully re-embedded
    all_successful = error_count == 0 and success_count == total_videos
    
    if all_successful:
        print("✅ All YouTube videos were successfully re-embedded!")
        print(f"✅ Using the new collection: {temp_collection_name}")
        
        # Update all videos to indicate they were embedded with the new model
        for video in youtube_videos:
            video.embedding_status = "completed"
            video.last_embedded = datetime.now()
        db.commit()
    else:
        # Some videos failed, so we should continue using the original collection
        print(f"⚠️ Some YouTube videos failed to re-embed ({error_count}/{total_videos})")
        print("⚠️ Continuing to use the original collection")
    
    # Summary
    print(f"\n✅ YouTube re-embedding completed for bot {bot_id}")
    print(f"📊 Summary:")
    print(f"   - Total videos: {total_videos}")
    print(f"   - Successfully re-embedded: {success_count}")
    print(f"   - Failed: {error_count}")
    print(f"   - Elapsed time: {elapsed_time:.2f} seconds")
    print(f"   - All successful: {all_successful}")
    
    return {
        "bot_id": bot_id,
        "total_videos": total_videos,
        "success_count": success_count,
        "error_count": error_count,
        "elapsed_time": elapsed_time,
        "all_successful": all_successful,
        "first_error": first_error_message
    }

async def reembed_all_bot_data(bot_id: int, db):
    """Re-embed all data (files, web scraping, YouTube) for a bot with the current embedding model.
    
    This function calls the individual re-embedding functions for each data type and
    consolidates the results.
    """
    print(f"🔄 Starting comprehensive re-embedding for bot {bot_id}")
    
    start_time = time.time()
    
    # Re-embed files
    file_results = await reembed_all_files(bot_id, db)
    print(f"✅ File re-embedding completed")
    
    # Re-embed web scraping data
    web_results = await reembed_all_scraped_nodes(bot_id, db)
    print(f"✅ Web scraping re-embedding completed")
    
    # Re-embed YouTube data
    youtube_results = await reembed_all_youtube_videos(bot_id, db)
    print(f"✅ YouTube re-embedding completed")
    
    elapsed_time = time.time() - start_time
    
    # Consolidate results
    total_items = (file_results.get("total_files", 0) + 
                   web_results.get("total_nodes", 0) + 
                   youtube_results.get("total_videos", 0))
    
    success_count = (file_results.get("success_count", 0) + 
                     web_results.get("success_count", 0) + 
                     youtube_results.get("success_count", 0))
    
    error_count = (file_results.get("error_count", 0) + 
                   web_results.get("error_count", 0) + 
                   youtube_results.get("error_count", 0))
    
    all_successful = (
        file_results.get("all_successful", True) and 
        web_results.get("all_successful", True) and 
        youtube_results.get("all_successful", True)
    )
    
    # Summary
    print(f"\n✅ Complete re-embedding process finished for bot {bot_id}")
    print(f"📊 Overall Summary:")
    print(f"   - Total items processed: {total_items}")
    print(f"   - Successfully re-embedded: {success_count}")
    print(f"   - Failed: {error_count}")
    print(f"   - Total elapsed time: {elapsed_time:.2f} seconds")
    print(f"   - All successful: {all_successful}")
    
    return {
        "bot_id": bot_id,
        "total_items": total_items,
        "success_count": success_count,
        "error_count": error_count,
        "elapsed_time": elapsed_time,
        "all_successful": all_successful,
        "file_results": file_results,
        "web_results": web_results,
        "youtube_results": youtube_results
    }