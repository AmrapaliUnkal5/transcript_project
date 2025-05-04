from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, BackgroundTasks, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Interaction, ChatMessage,YouTubeVideo, ScrapedNode, WebsiteDB,User, Bot
from app.vector_db import retrieve_similar_docs, add_document, delete_video_from_chroma, delete_url_from_chroma
import openai
import os
import pdfplumber
from app.utils.upload_knowledge_utils import extract_text_from_file,validate_and_store_text_in_ChromaDB
from app.youtube import store_videos_in_chroma, process_videos_in_background
from app.schemas import YouTubeRequest,VideoProcessingRequest, YouTubeScrapingRequest
from app.youtube import store_videos_in_chroma,get_video_urls
from typing import List
from urllib.parse import unquote
import re
from app.llm_manager import LLMManager
from app.models import Bot
from app.notifications import add_notification
from app.utils.logger import get_module_logger
from app.celery_tasks import process_youtube_videos

# Initialize logger
logger = get_module_logger(__name__)

router = APIRouter(prefix="/chatbot", tags=["Chatbot"])
YOUTUBE_REGEX = re.compile(
    r"^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|playlist\?list=|channel\/)|youtu\.be\/).+"
)

# Load OpenAI API key
openai.api_key = os.getenv("OPENAI_API_KEY")


@router.post("/ask")
def chatbot_response(request: Request, bot_id: int, user_id: int, user_message: str, db: Session = Depends(get_db)):
    """Processes user queries, retrieves context, and generates responses using the bot's assigned LLM model."""
    request_id = getattr(request.state, "request_id", "unknown")
    
    logger.info(f"Processing chatbot query", 
               extra={"request_id": request_id, "bot_id": bot_id, "user_id": user_id})

    # ✅ Ensure the chat session (interaction) exists
    interaction = db.query(Interaction).filter_by(bot_id=bot_id, user_id=user_id, archived=False).first()
    if not interaction:
        logger.info(f"Creating new interaction for user and bot", 
                   extra={"request_id": request_id, "bot_id": bot_id, "user_id": user_id})
        interaction = Interaction(bot_id=bot_id, user_id=user_id)
        db.add(interaction)
        db.commit()
        db.refresh(interaction)

    # Get bot configuration for LLM and external knowledge settings
    bot = db.query(Bot).filter(Bot.bot_id == bot_id).first()
    if not bot:
        logger.error(f"Bot not found", 
                    extra={"request_id": request_id, "bot_id": bot_id})
        raise HTTPException(status_code=404, detail=f"Bot with ID {bot_id} not found")
    
    use_external_knowledge = bot.external_knowledge if bot else False
    temperature = bot.temperature if bot and bot.temperature is not None else 0.7
    
    logger.debug(f"Bot settings retrieved", 
                extra={"request_id": request_id, "bot_id": bot_id, 
                      "external_knowledge": use_external_knowledge, "temperature": temperature})
    
    # ✅ Retrieve relevant documents from ChromaDB
    similar_docs = retrieve_similar_docs(bot_id, user_message, user_id=user_id)
    logger.info(f"Retrieved documents from vector database", 
               extra={"request_id": request_id, "bot_id": bot_id, 
                     "document_count": len(similar_docs) if similar_docs else 0})

    # ✅ If no relevant documents are found, use appropriate response
    if not similar_docs:
        # Even if no documents are found, we can use external knowledge if enabled
        if use_external_knowledge:
            context = ""
            logger.info(f"No relevant documents found, using external knowledge", 
                      extra={"request_id": request_id, "bot_id": bot_id})
        else:
            bot_reply = "I can only answer based on uploaded documents, but I don't have information on that topic."
            logger.info(f"No relevant documents found and external knowledge disabled", 
                       extra={"request_id": request_id, "bot_id": bot_id})
            
            # Store conversation
            user_msg = ChatMessage(interaction_id=interaction.interaction_id, sender="user", message_text=user_message)
            bot_msg = ChatMessage(interaction_id=interaction.interaction_id, sender="bot", message_text=bot_reply)
            db.add_all([user_msg, bot_msg])
            db.commit()
            return {"bot_reply": bot_reply}
    else:
        # Extract context from similar documents
        # Note: vector_db.py returns documents with a "content" field
        context = " ".join([doc.get("content", "") for doc in similar_docs])
    
    try:
        # Use the LLMManager to generate response using the appropriate model based on user's subscription and bot settings
        logger.debug(f"Generating response with LLM", 
                    extra={"request_id": request_id, "bot_id": bot_id, 
                          "external_knowledge": use_external_knowledge})
        
        llm = LLMManager(bot_id=bot_id, user_id=user_id)
        bot_reply = llm.generate(context, user_message, use_external_knowledge=use_external_knowledge, temperature=temperature)
        
        logger.info(f"Generated response successfully", 
                   extra={"request_id": request_id, "bot_id": bot_id, 
                         "response_length": len(bot_reply) if bot_reply else 0})
    except Exception as e:
        logger.exception(f"Error generating response", 
                        extra={"request_id": request_id, "bot_id": bot_id, "error": str(e)})
        raise HTTPException(status_code=500, detail=f"Chatbot error: {str(e)}")

    # ✅ Store both user message & bot reply in `chat_messages` table
    user_msg = ChatMessage(interaction_id=interaction.interaction_id, sender="user", message_text=user_message)
    bot_msg = ChatMessage(interaction_id=interaction.interaction_id, sender="bot", message_text=bot_reply)

    db.add_all([user_msg, bot_msg])
    db.commit()
    
    logger.debug(f"Stored conversation in database", 
                extra={"request_id": request_id, "bot_id": bot_id, 
                      "interaction_id": interaction.interaction_id})

    return {"bot_reply": bot_reply}

@router.post("/upload_knowledge")
async def upload_knowledge(
    request: Request,
    bot_id: int,
    user_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    request_id = getattr(request.state, "request_id", "unknown")
    
    logger.info(f"Knowledge upload initiated", 
               extra={"request_id": request_id, "bot_id": bot_id, "user_id": user_id, 
                     "filename": file.filename})
    
    try:
        # Step 1: Extract text from the file
        text = await extract_text_from_file(file)
        
        logger.debug(f"Text extracted from file", 
                    extra={"request_id": request_id, "bot_id": bot_id, 
                          "filename": file.filename, "text_length": len(text) if text else 0})

        # Step 2: Validate and store the text in ChromaDB
        validate_and_store_text_in_ChromaDB(text, bot_id, file, user_id=user_id)
        
        logger.info(f"Knowledge uploaded successfully", 
                   extra={"request_id": request_id, "bot_id": bot_id, 
                         "filename": file.filename})

        return {"message": f"Knowledge uploaded successfully for Bot {bot_id}!"}
    except Exception as e:
        logger.exception(f"Error uploading knowledge", 
                        extra={"request_id": request_id, "bot_id": bot_id, 
                              "filename": file.filename, "error": str(e)})
        raise HTTPException(status_code=500, detail=f"Error uploading knowledge: {str(e)}")


def generate_response(bot_id: int, user_id: int, user_message: str, db: Session = Depends(get_db)):
    """Generate response using the bot's assigned LLM model."""
    logger.info(f"Generating response", extra={"bot_id": bot_id, "user_id": user_id})
    
    # Ensure chat session exists
    interaction = db.query(Interaction).filter_by(bot_id=bot_id, user_id=user_id, archived=False).first()
    if not interaction:
        logger.info(f"Creating new interaction", extra={"bot_id": bot_id, "user_id": user_id})
        interaction = Interaction(bot_id=bot_id, user_id=user_id)
        db.add(interaction)
        db.commit()
        db.refresh(interaction)

    # Get bot configuration
    bot = db.query(Bot).filter(Bot.bot_id == bot_id).first()
    if not bot:
        logger.error(f"Bot not found", extra={"bot_id": bot_id})
        raise HTTPException(status_code=404, detail=f"Bot with ID {bot_id} not found")
    
    use_external_knowledge = bot.external_knowledge if bot else False
    temperature = bot.temperature if bot and bot.temperature is not None else 0.7
    
    logger.debug(f"Bot settings", 
                extra={"bot_id": bot_id, "external_knowledge": use_external_knowledge, 
                      "temperature": temperature})
    
    # Retrieve relevant context
    similar_docs = retrieve_similar_docs(bot_id, user_message, user_id=user_id)
    logger.info(f"Retrieved documents from vector database", 
               extra={"bot_id": bot_id, "document_count": len(similar_docs) if similar_docs else 0})
    
    # Handle cases with no relevant documents
    if not similar_docs:
        if use_external_knowledge:
            context = ""
            logger.info(f"No relevant documents found, using external knowledge", 
                       extra={"bot_id": bot_id})
        else:
            bot_reply = "I can only answer based on uploaded documents, but I don't have information on that topic."
            logger.info(f"No relevant documents found and external knowledge disabled", 
                       extra={"bot_id": bot_id})
            return {"bot_reply": bot_reply}
    else:
        # Note: vector_db.py returns documents with a "content" field
        context = " ".join([doc.get("content", "") for doc in similar_docs])

    try:
        # Generate response using appropriate LLM and knowledge settings based on user's subscription and bot settings
        logger.debug(f"Generating response with LLM", 
                    extra={"bot_id": bot_id, "external_knowledge": use_external_knowledge})
        
        llm = LLMManager(bot_id=bot_id, user_id=user_id)
        bot_reply = llm.generate(context, user_message, use_external_knowledge=use_external_knowledge, temperature=temperature)
        
        logger.info(f"Generated response successfully", 
                   extra={"bot_id": bot_id, "response_length": len(bot_reply) if bot_reply else 0})

        # Store conversation
        db.add_all([
            ChatMessage(interaction_id=interaction.interaction_id, sender="user", message_text=user_message),
            ChatMessage(interaction_id=interaction.interaction_id, sender="bot", message_text=bot_reply)
        ])
        db.commit()
        
        logger.debug(f"Stored conversation in database", 
                    extra={"bot_id": bot_id, "interaction_id": interaction.interaction_id})

        return {"bot_reply": bot_reply}
    except Exception as e:
        logger.exception(f"Error generating response", 
                        extra={"bot_id": bot_id, "error": str(e)})
        raise HTTPException(status_code=500, detail=f"Chatbot error: {str(e)}")


@router.post("/process_youtube")
def process_youtube(request: Request, bot_id: int, channel_url: str, db: Session = Depends(get_db)):
    """Extracts video transcripts from a YouTube channel and stores them in ChromaDB for the bot using Celery."""
    request_id = getattr(request.state, "request_id", "unknown")
    
    logger.info(f"Processing YouTube channel/video", 
               extra={"request_id": request_id, "bot_id": bot_id, "url": channel_url})
    
    # Valid YouTube URL patterns
    # Regex pattern to match valid YouTube URLs
    youtube_regex = re.compile(
        r"^(https?:\/\/)?(www\.)?(youtube\.com\/(channel\/|playlist\?list=|watch\?v=)|youtu\.be\/).+"
    )

    if not youtube_regex.match(channel_url):
        logger.warning(f"Invalid YouTube URL provided", 
                      extra={"request_id": request_id, "bot_id": bot_id, "url": channel_url})
        raise HTTPException(status_code=400, detail="Invalid YouTube channel or playlist URL.")
    
    try:
        # Fetch video URLs
        urls = get_video_urls(channel_url)
        if not urls:
            logger.warning(f"No videos found at URL", 
                         extra={"request_id": request_id, "bot_id": bot_id, "url": channel_url})
            raise HTTPException(status_code=404, detail="No videos found at the specified URL.")
        
        # Launch Celery task to process videos
        task = process_youtube_videos.delay(bot_id, urls)
        
        logger.info(f"YouTube processing started with Celery task ID: {task.id}", 
                   extra={"request_id": request_id, "bot_id": bot_id, "task_id": task.id, 
                         "video_count": len(urls)})
        
        return {
            "message": f"Processing {len(urls)} videos in the background",
            "video_count": len(urls),
            "task_id": task.id
        }
    except Exception as e:
        logger.exception(f"Error processing YouTube content", 
                        extra={"request_id": request_id, "bot_id": bot_id, 
                              "url": channel_url, "error": str(e)})
        raise HTTPException(status_code=500, detail=f"Error processing YouTube content: {str(e)}")


@router.post("/fetch-videos")
async def fetch_videos(request: Request, video_request: YouTubeRequest):
    request_id = getattr(request.state, "request_id", "unknown")
    
    logger.info(f"Fetching videos from YouTube URL", 
               extra={"request_id": request_id, "url": video_request.url})
    
    if not YOUTUBE_REGEX.match(video_request.url):
        logger.warning(f"Invalid YouTube URL provided", 
                      extra={"request_id": request_id, "url": video_request.url})
        raise HTTPException(status_code=400, detail="Invalid YouTube URL.")
    
    try:
        urls = get_video_urls(video_request.url)
        logger.info(f"Successfully fetched YouTube videos", 
                   extra={"request_id": request_id, "url": video_request.url, 
                         "video_count": len(urls) if urls else 0})
        return {"video_urls": urls}
    except Exception as e:
        logger.exception(f"Error fetching YouTube videos", 
                        extra={"request_id": request_id, "url": video_request.url, 
                              "error": str(e)})
        raise HTTPException(status_code=500, detail=f"Error fetching videos: {str(e)}")

@router.post("/process-videos")
async def process_selected_videos(
    request: Request,
    video_request: VideoProcessingRequest, 
    db: Session = Depends(get_db)
):
    """API to process selected YouTube video transcripts and store them in ChromaDB using Celery."""
    request_id = getattr(request.state, "request_id", "unknown")
    
    logger.info(f"Processing selected videos", 
               extra={"request_id": request_id, "bot_id": video_request.bot_id, 
                     "video_count": len(video_request.video_urls) if video_request.video_urls else 0})
    
    try:
        # Launch Celery task
        task = process_youtube_videos.delay(
            video_request.bot_id,
            video_request.video_urls
        )
        
        logger.info(f"Video processing started with Celery task ID: {task.id}", 
                   extra={"request_id": request_id, "bot_id": video_request.bot_id, "task_id": task.id})
                   
        # Return immediately with a message that processing has started
        return {
            "message": "Video processing started in the background",
            "task_id": task.id
        }
    except Exception as e:
        logger.exception(f"Error starting video processing", 
                        extra={"request_id": request_id, "bot_id": video_request.bot_id, 
                              "error": str(e)})
        raise HTTPException(status_code=500, detail=f"Error starting video processing: {str(e)}")

@router.get("/bot/{bot_id}/videos", response_model=List[str])
def get_bot_videos(request: Request, bot_id: int, db: Session = Depends(get_db)):
    """Retrieves a list of YouTube videos stored for a specific bot."""
    request_id = getattr(request.state, "request_id", "unknown")
    
    logger.info(f"Retrieving bot's YouTube videos", 
               extra={"request_id": request_id, "bot_id": bot_id})
    
    try:
        # Query the database for videos associated with the bot
        videos = db.query(YouTubeVideo).filter(
            YouTubeVideo.bot_id == bot_id,
            YouTubeVideo.is_deleted == False
        ).all()
        
        # Extract video IDs
        video_ids = [video.video_id for video in videos]
        
        logger.info(f"Retrieved bot's YouTube videos", 
                   extra={"request_id": request_id, "bot_id": bot_id, "video_count": len(video_ids)})
        
        return video_ids
    except Exception as e:
        logger.exception(f"Error retrieving bot videos", 
                        extra={"request_id": request_id, "bot_id": bot_id, "error": str(e)})
        raise HTTPException(status_code=500, detail=f"Error retrieving videos: {str(e)}")


@router.delete("/bot/{bot_id}/videos")
def soft_delete_video(request: Request, bot_id: int, video_id: str = Query(...), db: Session = Depends(get_db)):
    """Soft deletes a YouTube video from a bot's knowledge base."""
    request_id = getattr(request.state, "request_id", "unknown")
    
    logger.info(f"Deleting YouTube video from bot", 
               extra={"request_id": request_id, "bot_id": bot_id, "video_id": video_id})
    
    try:
        # Find the video
        video = db.query(YouTubeVideo).filter(
            YouTubeVideo.bot_id == bot_id,
            YouTubeVideo.video_id == video_id,
            YouTubeVideo.is_deleted == False
        ).first()
        
        if not video:
            logger.warning(f"Video not found for deletion", 
                          extra={"request_id": request_id, "bot_id": bot_id, "video_id": video_id})
            raise HTTPException(status_code=404, detail="Video not found")
        
        # Soft delete the video in the database
        video.is_deleted = True
        db.commit()
        
        # Delete from ChromaDB
        delete_video_from_chroma(bot_id, video_id)
        
        # Add notification
        notification_text = f"Video '{video.title}' was removed from bot {bot_id}'s knowledge base."
        add_notification(db, "Video Removed", notification_text, video.user_id)
        
        logger.info(f"Video deleted successfully", 
                   extra={"request_id": request_id, "bot_id": bot_id, "video_id": video_id})
        
        return {"message": "Video deleted successfully"}
    except Exception as e:
        logger.exception(f"Error deleting video", 
                        extra={"request_id": request_id, "bot_id": bot_id, 
                              "video_id": video_id, "error": str(e)})
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Error deleting video: {str(e)}")


@router.delete("/bot/{bot_id}/scraped-urls")
def soft_delete_scraped_url(request: Request, bot_id: int, url: str = Query(...), db: Session = Depends(get_db)):
    """Soft deletes a scraped URL from a bot's knowledge base."""
    request_id = getattr(request.state, "request_id", "unknown")
    
    # Decode URL if it's URL-encoded
    decoded_url = unquote(url)
    
    logger.info(f"Deleting scraped URL from bot", 
               extra={"request_id": request_id, "bot_id": bot_id, "url": decoded_url})
    
    try:
        # Find the scraped node
        scraped_node = db.query(ScrapedNode).filter(
            ScrapedNode.bot_id == bot_id,
            ScrapedNode.url == decoded_url,
            ScrapedNode.is_deleted == False
        ).first()
        
        if not scraped_node:
            logger.warning(f"Scraped URL not found for deletion", 
                          extra={"request_id": request_id, "bot_id": bot_id, "url": decoded_url})
            raise HTTPException(status_code=404, detail="Scraped URL not found")
        
        # Soft delete the scraped node in the database
        scraped_node.is_deleted = True
        db.commit()
        
        # Delete from ChromaDB
        delete_url_from_chroma(bot_id, decoded_url)
        
        # Add notification
        notification_text = f"URL '{decoded_url}' was removed from bot {bot_id}'s knowledge base."
        add_notification(db, "URL Removed", notification_text, scraped_node.user_id)
        
        logger.info(f"Scraped URL deleted successfully", 
                   extra={"request_id": request_id, "bot_id": bot_id, "url": decoded_url})
        
        return {"message": "Scraped URL deleted successfully"}
    except Exception as e:
        logger.exception(f"Error deleting scraped URL", 
                        extra={"request_id": request_id, "bot_id": bot_id, 
                              "url": decoded_url, "error": str(e)})
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Error deleting scraped URL: {str(e)}")


@router.post("/scrape-youtube")
def scrape_youtube_endpoint(request: Request, youtube_request: YouTubeScrapingRequest, db: Session = Depends(get_db)):
    """Processes selected YouTube video transcripts and stores them in ChromaDB using Celery."""
    request_id = getattr(request.state, "request_id", "unknown")
    
    logger.info(f"Scraping YouTube content", 
               extra={"request_id": request_id, "bot_id": youtube_request.bot_id, 
                     "video_urls": youtube_request.video_urls})
    
    try:
        # Launch Celery task for processing YouTube videos
        task = process_youtube_videos.delay(
            youtube_request.bot_id,
            youtube_request.video_urls
        )
        
        logger.info(f"YouTube scraping started with Celery task ID: {task.id}", 
                   extra={"request_id": request_id, "bot_id": youtube_request.bot_id, "task_id": task.id})
        
        return {
            "message": "YouTube content processing started",
            "task_id": task.id
        }
    except Exception as e:
        logger.exception(f"Error scraping YouTube content", 
                        extra={"request_id": request_id, "bot_id": youtube_request.bot_id, 
                              "error": str(e)})
        raise HTTPException(status_code=500, detail=f"Error processing YouTube content: {str(e)}")
