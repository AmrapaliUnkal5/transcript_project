from app.models import File, Bot, User, EmbeddingModel, ScrapedNode, YouTubeVideo
from app.vector_db import add_document, get_qdrant_client
from app.utils.upload_knowledge_utils import extract_text_from_file, chunk_markdown_text, chunk_text
import aiofiles
import asyncio
import logging
import time
import os
import shutil
from datetime import datetime
from qdrant_client.models import Filter, FieldCondition, MatchValue

logger = logging.getLogger(__name__)

async def delete_file_embeddings(file_name: str, bot_id: int, db):
    """
    Delete all embeddings for a specific file from the vector database.

    Args:
        file_name: The original filename used in metadata
        bot_id: Bot ID
        db: Database session

    Returns:
        Number of embeddings deleted
    """
    try:
        deleted_count = 0

        # Use Qdrant only
        qdrant_client = get_qdrant_client()
        if not qdrant_client:
            logger.error(f"❌ Qdrant client not available")
            return 0

        try:
            collection_name = "unified_vector_store"

            # Create filter to find all documents for this file using file_name + bot_id
            metadata_filter = Filter(
                must=[
                    FieldCondition(key="bot_id", match=MatchValue(value=bot_id)),
                    FieldCondition(key="file_name", match=MatchValue(value=file_name))
                ]
            )

            # Get all points matching this filter
            scroll_result = qdrant_client.scroll(
                collection_name=collection_name,
                scroll_filter=metadata_filter,
                limit=1000
            )

            # Keep scrolling until we have all points
            all_point_ids = []
            offset = None
            while True:
                scroll_result = qdrant_client.scroll(
                    collection_name=collection_name,
                    scroll_filter=metadata_filter,
                    limit=1000,
                    offset=offset
                )

                if scroll_result[0]:  # [0] is the points list
                    all_point_ids.extend([point.id for point in scroll_result[0]])

                offset = scroll_result[1]  # [1] is the next offset
                if not offset:
                    break

            if all_point_ids:
                logger.info(f"🗑️ Found {len(all_point_ids)} embeddings to delete in Qdrant for file {file_name}")
                qdrant_client.delete(
                    collection_name=collection_name,
                    points_selector=all_point_ids
                )
                deleted_count = len(all_point_ids)
                logger.info(f"✅ Deleted {deleted_count} embeddings from Qdrant")
            else:
                logger.info(f"ℹ️ No embeddings found for file {file_name}")

        except Exception as e:
            logger.error(f"❌ Error deleting from Qdrant: {str(e)}")
            return 0

        return deleted_count

    except Exception as e:
        logger.error(f"❌ Error in delete_file_embeddings: {str(e)}")
        return 0

async def delete_scraped_node_embeddings(url: str, bot_id: int, db):
    """
    Delete all embeddings for a specific scraped node from the vector database.

    Args:
        url: The website URL used in metadata
        bot_id: Bot ID
        db: Database session

    Returns:
        Number of embeddings deleted
    """
    try:
        # Use Qdrant only
        qdrant_client = get_qdrant_client()
        if not qdrant_client:
            logger.error(f"❌ Qdrant client not available")
            return 0

        try:
            collection_name = "unified_vector_store"

            # Create filter to find all documents for this website using url + bot_id
            metadata_filter = Filter(
                must=[
                    FieldCondition(key="bot_id", match=MatchValue(value=bot_id)),
                    FieldCondition(key="url", match=MatchValue(value=url))
                ]
            )

            # Get all points matching this filter
            all_point_ids = []
            offset = None
            while True:
                scroll_result = qdrant_client.scroll(
                    collection_name=collection_name,
                    scroll_filter=metadata_filter,
                    limit=1000,
                    offset=offset
                )

                if scroll_result[0]:
                    all_point_ids.extend([point.id for point in scroll_result[0]])

                offset = scroll_result[1]
                if not offset:
                    break

            if all_point_ids:
                logger.info(f"🗑️ Found {len(all_point_ids)} embeddings to delete in Qdrant for website {url}")
                qdrant_client.delete(
                    collection_name=collection_name,
                    points_selector=all_point_ids
                )
                deleted_count = len(all_point_ids)
                logger.info(f"✅ Deleted {deleted_count} embeddings from Qdrant")
                return deleted_count
            else:
                logger.info(f"ℹ️ No embeddings found for website {url}")
                return 0

        except Exception as e:
            logger.error(f"❌ Error deleting from Qdrant: {str(e)}")
            return 0

    except Exception as e:
        logger.error(f"❌ Error in delete_scraped_node_embeddings: {str(e)}")
        return 0

async def delete_youtube_video_embeddings(url: str, bot_id: int, db):
    """
    Delete all embeddings for a specific YouTube video from the vector database.

    Args:
        url: The YouTube video URL used in metadata
        bot_id: Bot ID
        db: Database session

    Returns:
        Number of embeddings deleted
    """
    try:
        # Use Qdrant only
        qdrant_client = get_qdrant_client()
        if not qdrant_client:
            logger.error(f"❌ Qdrant client not available")
            return 0

        try:
            collection_name = "unified_vector_store"

            # Create filter to find all documents for this video using url + bot_id
            metadata_filter = Filter(
                must=[
                    FieldCondition(key="bot_id", match=MatchValue(value=bot_id)),
                    FieldCondition(key="url", match=MatchValue(value=url))
                ]
            )

            # Get all points matching this filter
            all_point_ids = []
            offset = None
            while True:
                scroll_result = qdrant_client.scroll(
                    collection_name=collection_name,
                    scroll_filter=metadata_filter,
                    limit=1000,
                    offset=offset
                )

                if scroll_result[0]:
                    all_point_ids.extend([point.id for point in scroll_result[0]])

                offset = scroll_result[1]
                if not offset:
                    break

            if all_point_ids:
                logger.info(f"🗑️ Found {len(all_point_ids)} embeddings to delete in Qdrant for video {url}")
                qdrant_client.delete(
                    collection_name=collection_name,
                    points_selector=all_point_ids
                )
                deleted_count = len(all_point_ids)
                logger.info(f"✅ Deleted {deleted_count} embeddings from Qdrant")
                return deleted_count
            else:
                logger.info(f"ℹ️ No embeddings found for video {url}")
                return 0

        except Exception as e:
            logger.error(f"❌ Error deleting from Qdrant: {str(e)}")
            return 0

    except Exception as e:
        logger.error(f"❌ Error in delete_youtube_video_embeddings: {str(e)}")
        return 0

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
        logger.error(f"❌ Bot with ID {bot_id} not found")
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
        logger.info(f"📄 No files found for bot {bot_id}. Nothing to re-embed.")
        return {
            "bot_id": bot_id,
            "total_files": 0,
            "success_count": 0,
            "error_count": 0,
            "elapsed_time": 0
        }
    
    logger.info(f"🔄 Starting re-embedding for bot {bot_id}. Total files: {total_files}")
    
    # Verify we have proper embedding model information
    if not bot.embedding_model_id:
        logger.error(f"❌ Bot {bot_id} has no embedding model ID assigned")
        return {
            "bot_id": bot_id,
            "error": "No embedding model ID assigned to bot"
        }
    
    # Get embedding model details - query directly to ensure latest data
    embedding_model = db.query(EmbeddingModel).filter(
        EmbeddingModel.id == bot.embedding_model_id
    ).first()
    
    if not embedding_model:
        logger.error(f"❌ Could not find embedding model with ID {bot.embedding_model_id}")
        return {
            "bot_id": bot_id,
            "error": f"Could not find embedding model with ID {bot.embedding_model_id}"
        }
    
    logger.info(f"📋 Embedding model details:")
    logger.info(f"   - ID: {embedding_model.id}")
    logger.info(f"   - Name: {embedding_model.name}")
    logger.info(f"   - Provider: {embedding_model.provider}")
    if embedding_model.dimension:
        logger.info(f"   - Dimension: {embedding_model.dimension}")
    
    # Store the model name to ensure consistency
    model_name = embedding_model.name
    
    # Try to get the model name first
    try:
        # We won't rely on get_bot_config here since it might be inconsistent
        # Use the directly retrieved model name instead
        sanitized_model_name = model_name.replace("/", "_").replace(".", "_").replace("-", "_")
        base_collection_name = f"bot_{bot_id}_{sanitized_model_name}"
        logger.info(f"🔍 Using model: {model_name}")
        logger.info(f"📚 Base collection name: {base_collection_name}")
        
        # Create a timestamp string for a consistent temporary collection name
        timestamp = int(time.time())
        temp_collection_name = f"{base_collection_name}_{timestamp}"
        logger.info(f"📚 Creating temporary collection: {temp_collection_name}")
        
    except Exception as e:
        error_msg = f"Error getting model name: {str(e)}"
        logger.error(f"❌ {error_msg}")
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
            file.status = "Embedding"
            file.last_embedded = None
    db.commit()
    
    for index, file in enumerate(files):
        try:
            logger.info(f"📄 Processing file {index+1}/{total_files}: {file.file_name}")
            
            # Since we're now storing just text files, we can directly read the text
            file_path = file.file_path
            
            # Check if file exists
            if not os.path.exists(file_path):
                error_msg = f"File not found: {file_path}"
                logger.warning(f"⚠️ {error_msg}")
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
                    logger.warning(f"⚠️ {error_msg}")
                    if not first_error_message:
                        first_error_message = error_msg
                    error_count += 1
                    continue
                    
                logger.info(f"📄 Read {len(text)} characters from {file.file_name}")
            except Exception as e:
                error_msg = f"Error reading text from file {file.file_name}: {str(e)}"
                logger.error(f"❌ {error_msg}")
                if not first_error_message:
                    first_error_message = error_msg
                error_count += 1
                continue
            
            # Update embedding_status in database
            file.status = "Embedding"
            db.commit()
            
            # Delete old embeddings for this file BEFORE re-embedding
            try:
                logger.info(f"🗑️ Deleting old embeddings for file: {file.file_name}")
                deleted_count = await delete_file_embeddings(file.file_name, bot_id, db)
                logger.info(f"✅ Deleted {deleted_count} old embeddings for {file.file_name}")
            except Exception as e:
                logger.warning(f"⚠️ Error deleting old embeddings for {file.file_name}: {str(e)}")
                # Continue with re-embedding anyway

            # Re-embed with proper chunking
            try:
                # Check if bot uses markdown chunking
                use_markdown_chunking = bool(bot.markdown_chunking is True)

                if use_markdown_chunking:
                    # Use markdown-aware chunking
                    logger.info(f"🔪 Using markdown-aware chunking for {file.file_name}")
                    chunks_with_metadata = chunk_markdown_text(
                        text,
                        file_name=file.file_name,
                        file_id=file.unique_file_name,
                        file_type=file.file_type or "text/plain",
                        bot_id=bot_id,
                        user_id=user_id,
                        db=db
                    )

                    # Re-embed each chunk
                    for chunk_data in chunks_with_metadata:
                        chunk_text_value = chunk_data["text"]
                        chunk_metadata = chunk_data["metadata"]

                        # Add the new model info but keep original metadata
                        chunk_metadata["user_id"] = user_id
                        chunk_metadata["is_reembed"] = True

                        add_document(
                            bot_id=bot_id,
                            text=chunk_text_value,
                            metadata=chunk_metadata,
                            user_id=user_id,
                            force_model=model_name
                        )

                    logger.info(f"✅ Re-embedded {len(chunks_with_metadata)} chunks for {file.file_name}")

                else:
                    # Use legacy chunking
                    logger.info(f"🔪 Using legacy chunking for {file.file_name}")
                    text_chunks = chunk_text(text, bot_id=bot_id, user_id=user_id, db=db)

                    # Re-embed each chunk with proper IDs
                    for i, chunk_text_value in enumerate(text_chunks):
                        chunk_id = f"{file.unique_file_name}_chunk_{i+1}" if len(text_chunks) > 1 else file.unique_file_name

                        chunk_metadata = {
                            "id": chunk_id,
                            "source": "upload",  # Keep original source
                            "file_name": file.file_name,
                            "file_type": file.file_type or "text/plain",
                            "file_id": file.unique_file_name,
                            "bot_id": bot_id,
                            "user_id": user_id,
                            "chunk_number": i + 1,
                            "total_chunks": len(text_chunks),
                            "is_reembed": True  # Add flag to indicate re-embedding
                        }

                        add_document(
                            bot_id=bot_id,
                            text=chunk_text_value,
                            metadata=chunk_metadata,
                            user_id=user_id,
                            force_model=model_name
                        )

                    logger.info(f"✅ Re-embedded {len(text_chunks)} chunks for {file.file_name}")
                
                # Update status in DB
                file.status = "Success"
                file.last_embedded = datetime.now()
                db.commit()
                
                success_count += 1
                logger.info(f"✅ Successfully re-embedded file: {file.file_name}")

            except Exception as e:
                error_msg = f"Error re-embedding file {file.file_name}: {str(e)}"
                logger.error(f"❌ {error_msg}")
                if not first_error_message:
                    first_error_message = error_msg
                
                # Update status in DB to reflect the error
                file.status = "Failed"
                db.commit()
                error_count += 1
            
            # Add a small delay to prevent rate limiting issues with embedding APIs
            await asyncio.sleep(0.5)
            
        except Exception as e:
            error_msg = f"Error re-embedding file {file.file_name}: {str(e)}"
            logger.error(f"❌ {error_msg}")
            # Capture first error message for admin notification
            if not first_error_message:
                first_error_message = error_msg
            
            # Update status in DB
            file.status = "Failed"
            db.commit()
            error_count += 1
    
    elapsed_time = time.time() - start_time
    
    # Check if ALL files were successfully re-embedded
    all_successful = error_count == 0 and success_count == total_files
    
    if all_successful:
        logger.info("✅ All files were successfully re-embedded!")
        logger.info(f"✅ Using the new collection: {temp_collection_name}")
        
        # Update all files to indicate they were embedded with the new model
        for file in files:
            file.status = "Success"
            file.last_embedded = datetime.now()
            file.embedding_model_id = bot.embedding_model_id
        db.commit()
    else:
        # Some files failed, so we should continue using the original collection
        logger.warning(f"⚠️ Some files failed to re-embed ({error_count}/{total_files})")
        logger.warning("⚠️ Continuing to use the original collection")
    
    # Summary
    logger.info(f"\n✅ Re-embedding completed for bot {bot_id}")
    logger.info(f"📊 Summary:")
    logger.info(f"   - Total files: {total_files}")
    logger.info(f"   - Successfully re-embedded: {success_count}")
    logger.info(f"   - Failed: {error_count}")
    logger.info(f"   - Elapsed time: {elapsed_time:.2f} seconds")
    logger.info(f"   - All successful: {all_successful}")
    
    # If not all files were successful, revert the embedding model ID for the bot
    if not all_successful:
        logger.warning("⚠️ Not all files were successfully re-embedded. Checking for failed files...")
        
        # List failed files for debugging
        failed_files = db.query(File).filter(
            File.bot_id == bot_id,
            File.status == "Failed"
        ).all()
        
        for f in failed_files:
            logger.error(f"❌ Failed file: {f.file_name}")
    
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
        logger.error(f"❌ Bot with ID {bot_id} not found")
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
        logger.info(f"📄 No scraped nodes found for bot {bot_id}. Nothing to re-embed.")
        return {
            "bot_id": bot_id,
            "total_nodes": 0,
            "success_count": 0,
            "error_count": 0,
            "elapsed_time": 0
        }
    
    logger.info(f"🔄 Starting re-embedding for bot {bot_id}. Total scraped nodes: {total_nodes}")
    
    # Verify we have proper embedding model information
    if not bot.embedding_model_id:
        logger.error(f"❌ Bot {bot_id} has no embedding model ID assigned")
        return {
            "bot_id": bot_id,
            "error": "No embedding model ID assigned to bot"
        }
    
    # Get embedding model details - query directly to ensure latest data
    embedding_model = db.query(EmbeddingModel).filter(
        EmbeddingModel.id == bot.embedding_model_id
    ).first()
    
    if not embedding_model:
        logger.error(f"❌ Could not find embedding model with ID {bot.embedding_model_id}")
        return {
            "bot_id": bot_id,
            "error": f"Could not find embedding model with ID {bot.embedding_model_id}"
        }
    
    logger.info(f"📋 Embedding model details:")
    logger.info(f"   - ID: {embedding_model.id}")
    logger.info(f"   - Name: {embedding_model.name}")
    logger.info(f"   - Provider: {embedding_model.provider}")
    if embedding_model.dimension:
        logger.info(f"   - Dimension: {embedding_model.dimension}")
    
    # Store the model name to ensure consistency
    model_name = embedding_model.name
    
    # Try to get the model name first
    try:
        # Use the directly retrieved model name
        sanitized_model_name = model_name.replace("/", "_").replace(".", "_").replace("-", "_")
        base_collection_name = f"bot_{bot_id}_{sanitized_model_name}"
        logger.info(f"🔍 Using model: {model_name}")
        logger.info(f"📚 Base collection name: {base_collection_name}")
        
        # Create a timestamp string for a consistent temporary collection name
        timestamp = int(time.time())
        temp_collection_name = f"{base_collection_name}_{timestamp}"
        logger.info(f"📚 Creating temporary collection: {temp_collection_name}")
        
    except Exception as e:
        error_msg = f"Error getting model name: {str(e)}"
        logger.error(f"❌ {error_msg}")
        return {
            "bot_id": bot_id,
            "error": error_msg
        }
    
    success_count = 0
    error_count = 0
    first_error_message = None
    
    # Update all scraped nodes' status
    for node in scraped_nodes:
        node.status = "Embedding"
        node.last_embedded = None
    db.commit()
    
    for index, node in enumerate(scraped_nodes):
        try:
            logger.info(f"🌐 Processing scraped node {index+1}/{total_nodes}: {node.url}")
            
            # Get the text content
            nodes_text = node.nodes_text
            
            if not nodes_text or not nodes_text.strip():
                error_msg = f"Empty text for node: {node.url}. Skipping."
                logger.warning(f"⚠️ {error_msg}")
                if not first_error_message:
                    first_error_message = error_msg
                error_count += 1
                continue
                
            logger.info(f"🌐 Processing content with {len(nodes_text)} characters from {node.url}")
            
            # Update embedding_status in database
            node.status = "Embedding"
            db.commit()
            
            # Delete old embeddings for this node BEFORE re-embedding
            try:
                logger.info(f"🗑️ Deleting old embeddings for scraped node: {node.url}")
                deleted_count = await delete_scraped_node_embeddings(node.url, bot_id, db)
                logger.info(f"✅ Deleted {deleted_count} old embeddings for {node.url}")
            except Exception as e:
                logger.warning(f"⚠️ Error deleting old embeddings for {node.url}: {str(e)}")
                # Continue with re-embedding anyway

            # Re-embed with proper chunking
            try:
                # Check if bot uses markdown chunking
                use_markdown_chunking = bool(bot.markdown_chunking is True)

                # Create base metadata
                base_metadata = {
                    "source": "website",  # Keep original source
                    "website_url": node.url,
                    "url": node.url,
                    "title": node.title or "No Title",
                    "bot_id": bot_id,
                    "user_id": user_id,
                    "is_reembed": True
                }

                if use_markdown_chunking:
                    # Use markdown-aware chunking
                    logger.info(f"🔪 Using markdown-aware chunking for {node.url}")
                    markdown_chunks = chunk_markdown_text(
                        markdown_text=nodes_text,
                        file_name=node.title or "No Title",
                        file_id=node.website_id,
                        file_type="website",
                        bot_id=bot_id,
                        user_id=user_id,
                        db=db
                    )

                    # Re-embed each chunk
                    for chunk_data in markdown_chunks:
                        chunk_text_value = chunk_data["text"]
                        chunk_metadata = {**base_metadata, **chunk_data["metadata"]}

                        add_document(
                            bot_id=bot_id,
                            text=chunk_text_value,
                            metadata=chunk_metadata,
                            user_id=user_id,
                            force_model=model_name
                        )

                    logger.info(f"✅ Re-embedded {len(markdown_chunks)} chunks for {node.url}")
                    
                else:
                    # Use legacy chunking
                    logger.info(f"🔪 Using legacy chunking for {node.url}")
                    text_chunks = chunk_text(nodes_text, bot_id=bot_id, user_id=user_id, db=db)

                    # Re-embed each chunk with proper IDs
                    for i, chunk_text_value in enumerate(text_chunks):
                        chunk_id = f"{node.website_id}_{i}" if len(text_chunks) > 1 else node.website_id

                        chunk_metadata = {
                            "id": chunk_id,
                            **base_metadata,
                            "chunk_number": i + 1,
                            "total_chunks": len(text_chunks)
                        }

                        add_document(
                            bot_id=bot_id,
                            text=chunk_text_value,
                            metadata=chunk_metadata,
                            user_id=user_id,
                            force_model=model_name
                        )

                    logger.info(f"✅ Re-embedded {len(text_chunks)} chunks for {node.url}")
                
                # Update status in DB
                node.status = "Success"
                node.last_embedded = datetime.now()
                db.commit()
                
                success_count += 1
                logger.info(f"✅ Successfully re-embedded scraped node: {node.url}")

            except Exception as e:
                error_msg = f"Error re-embedding scraped node {node.url}: {str(e)}"
                logger.error(f"❌ {error_msg}")
                if not first_error_message:
                    first_error_message = error_msg
                
                # Update status in DB to reflect the error
                node.status = "Failed"
                db.commit()
                error_count += 1
            
            # Add a small delay to prevent rate limiting issues with embedding APIs
            await asyncio.sleep(0.5)
            
        except Exception as e:
            error_msg = f"Error re-embedding scraped node {node.url}: {str(e)}"
            logger.error(f"❌ {error_msg}")
            if not first_error_message:
                first_error_message = error_msg
            
            # Update status in DB
            node.status = "Failed"
            db.commit()
            error_count += 1
    
    elapsed_time = time.time() - start_time
    
    # Check if ALL nodes were successfully re-embedded
    all_successful = error_count == 0 and success_count == total_nodes
    
    if all_successful:
        logger.info("✅ All scraped nodes were successfully re-embedded!")
        logger.info(f"✅ Using the new collection: {temp_collection_name}")
        
        # Update all nodes to indicate they were embedded with the new model
        for node in scraped_nodes:
            node.status = "Success"
            node.last_embedded = datetime.now()
        db.commit()
    else:
        # Some nodes failed, so we should continue using the original collection
        logger.warning(f"⚠️ Some scraped nodes failed to re-embed ({error_count}/{total_nodes})")
        logger.warning("⚠️ Continuing to use the original collection")
    
    # Summary
    logger.info(f"\n✅ Web scraping re-embedding completed for bot {bot_id}")
    logger.info(f"📊 Summary:")
    logger.info(f"   - Total nodes: {total_nodes}")
    logger.info(f"   - Successfully re-embedded: {success_count}")
    logger.info(f"   - Failed: {error_count}")
    logger.info(f"   - Elapsed time: {elapsed_time:.2f} seconds")
    logger.info(f"   - All successful: {all_successful}")
    
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
        logger.error(f"❌ Bot with ID {bot_id} not found")
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
        logger.info(f"📺 No YouTube videos found for bot {bot_id}. Nothing to re-embed.")
        return {
            "bot_id": bot_id,
            "total_videos": 0,
            "success_count": 0,
            "error_count": 0,
            "elapsed_time": 0
        }
    
    logger.info(f"🔄 Starting re-embedding for bot {bot_id}. Total YouTube videos: {total_videos}")
    
    # Verify we have proper embedding model information
    if not bot.embedding_model_id:
        logger.error(f"❌ Bot {bot_id} has no embedding model ID assigned")
        return {
            "bot_id": bot_id,
            "error": "No embedding model ID assigned to bot"
        }
    
    # Get embedding model details - query directly to ensure latest data
    embedding_model = db.query(EmbeddingModel).filter(
        EmbeddingModel.id == bot.embedding_model_id
    ).first()
    
    if not embedding_model:
        logger.error(f"❌ Could not find embedding model with ID {bot.embedding_model_id}")
        return {
            "bot_id": bot_id,
            "error": f"Could not find embedding model with ID {bot.embedding_model_id}"
        }
    
    logger.info(f"📋 Embedding model details:")
    logger.info(f"   - ID: {embedding_model.id}")
    logger.info(f"   - Name: {embedding_model.name}")
    logger.info(f"   - Provider: {embedding_model.provider}")
    if embedding_model.dimension:
        logger.info(f"   - Dimension: {embedding_model.dimension}")
    
    # Store the model name to ensure consistency
    model_name = embedding_model.name
    
    # Try to get the model name first
    try:
        # Use the directly retrieved model name
        sanitized_model_name = model_name.replace("/", "_").replace(".", "_").replace("-", "_")
        base_collection_name = f"bot_{bot_id}_{sanitized_model_name}"
        logger.info(f"🔍 Using model: {model_name}")
        logger.info(f"📚 Base collection name: {base_collection_name}")
        
        # Create a timestamp string for a consistent temporary collection name
        timestamp = int(time.time())
        temp_collection_name = f"{base_collection_name}_{timestamp}"
        logger.info(f"📚 Creating temporary collection: {temp_collection_name}")
        
    except Exception as e:
        error_msg = f"Error getting model name: {str(e)}"
        logger.error(f"❌ {error_msg}")
        return {
            "bot_id": bot_id,
            "error": error_msg
        }
    
    success_count = 0
    error_count = 0
    first_error_message = None
    
    # Update all YouTube videos' status
    for video in youtube_videos:
        video.status = "Embedding"
        video.last_embedded = None
    db.commit()
    
    for index, video in enumerate(youtube_videos):
        try:
            logger.info(f"📺 Processing YouTube video {index+1}/{total_videos}: {video.video_title}")
            
            # Get the transcript text
            if not video.transcript or not video.transcript.strip():
                error_msg = f"Empty transcript for video: {video.video_title}. Skipping."
                logger.warning(f"⚠️ {error_msg}")
                if not first_error_message:
                    first_error_message = error_msg
                error_count += 1
                continue
            
            transcript_text = video.transcript
            logger.info(f"📺 Processing transcript with {len(transcript_text)} characters from {video.video_title}")
            
            # Update embedding_status in database
            video.status = "Embedding"
            db.commit()
            
            # Delete old embeddings for this video BEFORE re-embedding
            try:
                logger.info(f"🗑️ Deleting old embeddings for YouTube video: {video.video_title}")
                deleted_count = await delete_youtube_video_embeddings(video.video_url, bot_id, db)
                logger.info(f"✅ Deleted {deleted_count} old embeddings for {video.video_title}")
            except Exception as e:
                logger.warning(f"⚠️ Error deleting old embeddings for {video.video_title}: {str(e)}")
                # Continue with re-embedding anyway

            # Re-embed with proper chunking
            try:
                # YouTube videos always use legacy chunking (transcripts are plain text)
                logger.info(f"🔪 Using chunking for YouTube video: {video.video_title}")
                text_chunks = chunk_text(transcript_text)

                # Create base metadata matching initial embed (plus is_reembed)
                base_metadata = {
                    "source": "youtube",
                    "source_id": video.video_id,
                    "title": video.video_title,
                    "url": video.video_url,
                    "channel_name": video.channel_name,
                    "bot_id": bot_id,
                    "is_reembed": True
                }

                # Re-embed each chunk with IDs matching initial embed format
                for i, chunk_text_value in enumerate(text_chunks):
                    chunk_id = f"youtube-{video.id}-chunk-{i+1}"

                    chunk_metadata = {
                        "id": chunk_id,
                        **base_metadata,
                        "chunk_number": i + 1,
                        "total_chunks": len(text_chunks)
                    }

                    add_document(
                        bot_id=bot_id,
                        text=chunk_text_value,
                        metadata=chunk_metadata,
                        user_id=user_id,
                        force_model=model_name
                    )

                logger.info(f"✅ Re-embedded {len(text_chunks)} chunks for {video.video_title}")
                
                # Update status in DB
                video.status = "Success"
                video.last_embedded = datetime.now()
                db.commit()
                
                success_count += 1
                logger.info(f"✅ Successfully re-embedded YouTube video: {video.video_title}")

            except Exception as e:
                error_msg = f"Error re-embedding YouTube video {video.video_title}: {str(e)}"
                logger.error(f"❌ {error_msg}")
                if not first_error_message:
                    first_error_message = error_msg
                
                # Update status in DB to reflect the error
                video.status = "Failed"
                db.commit()
                error_count += 1
            
            # Add a small delay to prevent rate limiting issues with embedding APIs
            await asyncio.sleep(0.5)
            
        except Exception as e:
            error_msg = f"Error re-embedding YouTube video {video.video_title}: {str(e)}"
            logger.error(f"❌ {error_msg}")
            if not first_error_message:
                first_error_message = error_msg
            
            # Update status in DB
            video.status = "Failed"
            db.commit()
            error_count += 1
    
    elapsed_time = time.time() - start_time
    
    # Check if ALL videos were successfully re-embedded
    all_successful = error_count == 0 and success_count == total_videos
    
    if all_successful:
        logger.info("✅ All YouTube videos were successfully re-embedded!")
        logger.info(f"✅ Using the new collection: {temp_collection_name}")
        
        # Update all videos to indicate they were embedded with the new model
        for video in youtube_videos:
            video.status = "Success"
            video.last_embedded = datetime.now()
        db.commit()
    else:
        # Some videos failed, so we should continue using the original collection
        logger.warning(f"⚠️ Some YouTube videos failed to re-embed ({error_count}/{total_videos})")
        logger.warning("⚠️ Continuing to use the original collection")
    
    # Summary
    logger.info(f"\n✅ YouTube re-embedding completed for bot {bot_id}")
    logger.info(f"📊 Summary:")
    logger.info(f"   - Total videos: {total_videos}")
    logger.info(f"   - Successfully re-embedded: {success_count}")
    logger.info(f"   - Failed: {error_count}")
    logger.info(f"   - Elapsed time: {elapsed_time:.2f} seconds")
    logger.info(f"   - All successful: {all_successful}")
    
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
    logger.info(f"🔄 Starting comprehensive re-embedding for bot {bot_id}")
    
    start_time = time.time()
    
    # Re-embed files
    file_results = await reembed_all_files(bot_id, db)
    logger.info(f"✅ File re-embedding completed")
    
    # Re-embed web scraping data
    web_results = await reembed_all_scraped_nodes(bot_id, db)
    logger.info(f"✅ Web scraping re-embedding completed")
    
    # Re-embed YouTube data
    youtube_results = await reembed_all_youtube_videos(bot_id, db)
    logger.info(f"✅ YouTube re-embedding completed")
    
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
    logger.info(f"\n✅ Complete re-embedding process finished for bot {bot_id}")
    logger.info(f"📊 Overall Summary:")
    logger.info(f"   - Total items processed: {total_items}")
    logger.info(f"   - Successfully re-embedded: {success_count}")
    logger.info(f"   - Failed: {error_count}")
    logger.info(f"   - Total elapsed time: {elapsed_time:.2f} seconds")
    logger.info(f"   - All successful: {all_successful}")
    
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