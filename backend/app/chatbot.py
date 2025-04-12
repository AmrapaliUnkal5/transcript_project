from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Interaction, ChatMessage,YouTubeVideo, ScrapedNode, WebsiteDB,User, Bot
from app.vector_db import retrieve_similar_docs, add_document
import openai
import os
import pdfplumber
from app.utils.upload_knowledge_utils import extract_text_from_file,validate_and_store_text_in_ChromaDB
from app.youtube import store_videos_in_chroma
from app.schemas import YouTubeRequest,VideoProcessingRequest
from app.youtube import store_videos_in_chroma,get_video_urls
from typing import List
from urllib.parse import unquote
import re
from app.llm_manager import LLMManager
from app.models import Bot
from app.notifications import add_notification


router = APIRouter(prefix="/chatbot", tags=["Chatbot"])
YOUTUBE_REGEX = re.compile(
    r"^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|playlist\?list=|channel\/)|youtu\.be\/).+"
)

# Load OpenAI API key
openai.api_key = os.getenv("OPENAI_API_KEY")


@router.post("/ask")
def chatbot_response(bot_id: int, user_id: int, user_message: str, db: Session = Depends(get_db)):
    """Processes user queries, retrieves context, and generates responses using the bot's assigned LLM model."""

    # ✅ Ensure the chat session (interaction) exists
    interaction = db.query(Interaction).filter_by(bot_id=bot_id, user_id=user_id, archived=False).first()
    if not interaction:
        interaction = Interaction(bot_id=bot_id, user_id=user_id)
        db.add(interaction)
        db.commit()
        db.refresh(interaction)

    # Get bot configuration for LLM and external knowledge settings
    bot = db.query(Bot).filter(Bot.bot_id == bot_id).first()
    if not bot:
        raise HTTPException(status_code=404, detail=f"Bot with ID {bot_id} not found")
    
    llm_model_name = bot.llm_model.name if bot and bot.llm_model else None
    use_external_knowledge = bot.external_knowledge if bot else False
    
    print(f"📝 Bot settings - External knowledge: {use_external_knowledge}, LLM: {llm_model_name}")
    
    # If external knowledge is enabled but no LLM is assigned, default to GPT-4
    if use_external_knowledge and not llm_model_name:
        llm_model_name = "gpt-4"
        print(f"⚠️ No LLM assigned but external knowledge enabled. Defaulting to {llm_model_name}")

    # ✅ Retrieve relevant documents from ChromaDB
    similar_docs = retrieve_similar_docs(bot_id, user_message)
    print(f"🔍 Retrieved {len(similar_docs) if similar_docs else 0} documents for Bot {bot_id}")

    # ✅ If no relevant documents are found, use appropriate response
    if not similar_docs:
        # Even if no documents are found, we can use external knowledge if enabled
        if use_external_knowledge:
            context = ""
            print("⚠️ No relevant documents found, will use external knowledge if enabled")
        else:
            bot_reply = "I can only answer based on uploaded documents, but I don't have information on that topic."
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
        # Use the LLMManager to generate response with the appropriate model and knowledge settings
        llm = LLMManager(llm_model_name)
        bot_reply = llm.generate(context, user_message, use_external_knowledge=use_external_knowledge)
    except Exception as e:
        print(f"❌ Error generating response: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Chatbot error: {str(e)}")

    # ✅ Store both user message & bot reply in `chat_messages` table
    user_msg = ChatMessage(interaction_id=interaction.interaction_id, sender="user", message_text=user_message)
    bot_msg = ChatMessage(interaction_id=interaction.interaction_id, sender="bot", message_text=bot_reply)

    db.add_all([user_msg, bot_msg])
    db.commit()

    return {"bot_reply": bot_reply}

@router.post("/upload_knowledge")
async def upload_knowledge(
    bot_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    # Step 1: Extract text from the file
    text = await extract_text_from_file(file)

    # Step 2: Validate and store the text in ChromaDB
    validate_and_store_text_in_ChromaDB(text, bot_id, file)

    return {"message": f"Knowledge uploaded successfully for Bot {bot_id}!"}


def generate_response(bot_id: int, user_id: int, user_message: str, db: Session = Depends(get_db)):
    """Generate response using the bot's assigned LLM model."""
    # Ensure chat session exists
    interaction = db.query(Interaction).filter_by(bot_id=bot_id, user_id=user_id, archived=False).first()
    if not interaction:
        interaction = Interaction(bot_id=bot_id, user_id=user_id)
        db.add(interaction)
        db.commit()
        db.refresh(interaction)

    # Get bot configuration
    bot = db.query(Bot).filter(Bot.bot_id == bot_id).first()
    if not bot:
        raise HTTPException(status_code=404, detail=f"Bot with ID {bot_id} not found")
    
    llm_model_name = bot.llm_model.name if bot and bot.llm_model else None
    use_external_knowledge = bot.external_knowledge if bot else False
    
    print(f"📝 Bot settings - External knowledge: {use_external_knowledge}, LLM: {llm_model_name}")
    
    # If external knowledge is enabled but no LLM is assigned, default to GPT-4
    if use_external_knowledge and not llm_model_name:
        llm_model_name = "gpt-4"
        print(f"⚠️ No LLM assigned but external knowledge enabled. Defaulting to {llm_model_name}")

    # Retrieve relevant context
    similar_docs = retrieve_similar_docs(bot_id, user_message)
    print(f"🔍 Retrieved {len(similar_docs) if similar_docs else 0} documents for Bot {bot_id}")
    
    # Handle cases with no relevant documents
    if not similar_docs:
        if use_external_knowledge:
            context = ""
            print("⚠️ No relevant documents found, will use external knowledge if enabled")
        else:
            bot_reply = "I can only answer based on uploaded documents, but I don't have information on that topic."
            
            # Store conversation
            # db.add_all([
            #     ChatMessage(interaction_id=interaction.interaction_id, sender="user", message_text=user_message),
            #     ChatMessage(interaction_id=interaction.interaction_id, sender="bot", message_text=bot_reply)
            # ])
            # db.commit()
            
            return {"bot_reply": bot_reply}
    else:
        # Note: vector_db.py returns documents with a "content" field
        context = " ".join([doc.get("content", "") for doc in similar_docs])

    # Generate response using appropriate LLM and knowledge settings
    llm = LLMManager(llm_model_name)
    bot_reply = llm.generate(context, user_message, use_external_knowledge=use_external_knowledge)

    # Store conversation
    db.add_all([
        ChatMessage(interaction_id=interaction.interaction_id, sender="user", message_text=user_message),
        ChatMessage(interaction_id=interaction.interaction_id, sender="bot", message_text=bot_reply)
    ])
    db.commit()

    return {"bot_reply": bot_reply}


@router.post("/process_youtube")
def process_youtube(bot_id: int, channel_url: str, db: Session = Depends(get_db)):
    """Extracts video transcripts from a YouTube channel and stores them in ChromaDB for the bot."""
     # Valid YouTube URL patterns
    # Regex pattern to match valid YouTube URLs
    youtube_regex = re.compile(
        r"^(https?:\/\/)?(www\.)?(youtube\.com\/(channel\/|playlist\?list=|watch\?v=)|youtu\.be\/).+"
    )

    if not youtube_regex.match(channel_url):
        raise HTTPException(status_code=400, detail="Invalid YouTube channel or playlist URL.")
    
    result = store_videos_in_chroma(bot_id, channel_url)
    return result


@router.post("/fetch-videos")
async def fetch_videos(request: YouTubeRequest):
    print(request.url)
    
    if not YOUTUBE_REGEX.match(request.url):
        raise HTTPException(status_code=400, detail="Invalid YouTube URL.")
    urls = get_video_urls(request.url)
    return {"video_urls": urls}

@router.post("/process-videos")
async def process_selected_videos(request: VideoProcessingRequest,db: Session = Depends(get_db)):
    """API to process selected YouTube video transcripts and store them in ChromaDB."""
    try:
        result = store_videos_in_chroma(request.bot_id, request.video_urls,db)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@router.get("/bot/{bot_id}/videos", response_model=List[str])
def get_bot_videos(bot_id: int, db: Session = Depends(get_db)):
    """
    Retrieve all video URLs for a given bot_id.
    """
    videos = db.query(YouTubeVideo.video_url).filter(YouTubeVideo.bot_id == bot_id, YouTubeVideo.is_deleted == False).all()
    
    # if not videos:
    #     raise HTTPException(status_code=404, detail="No videos found for this bot.")

    # Extract video URLs from query result (which returns list of tuples)
    return [video[0] for video in videos] 


@router.delete("/bot/{bot_id}/videos")
def soft_delete_video(bot_id: int, video_id: str = Query(...), db: Session = Depends(get_db)):
    """
    Soft delete a YouTube video by marking is_deleted=True.
    """
    video = db.query(YouTubeVideo).filter(
        YouTubeVideo.bot_id == bot_id,
        YouTubeVideo.video_id == video_id
    ).first()

    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    transcript_word_count = video.transcript_count or 0
    bot = db.query(Bot).filter(Bot.bot_id == bot_id).first()
    if bot:
        bot.word_count = max(0, bot.word_count - transcript_word_count)  # Prevent negative

        # Get associated user
        user = db.query(User).filter(User.user_id == bot.user_id).first()
        if user:
            user.total_words_used = max(0, user.total_words_used - transcript_word_count)

    video.is_deleted = True  # Soft delete by marking is_deleted=True
    db.commit()
    event_type="VIDEO_DELETED",
    event_data=f"Video '{video.video_url}' has been deleted."
    add_notification(db=db,
                    event_type=event_type,
                    event_data=event_data,
                    bot_id=bot_id,
                    user_id=bot.user_id)

    return {"message": "Video soft deleted successfully"}

@router.delete("/bot/{bot_id}/scraped-urls")
def soft_delete_scraped_url(bot_id: int, url: str = Query(...), db: Session = Depends(get_db)):
    decoded_url = unquote(url) 
    print(f"Received bot_id: {bot_id}, url: {url}")  # Debugging
    print("decoded_url",decoded_url)
    scraped_url = db.query(ScrapedNode).filter(
        ScrapedNode.bot_id == bot_id,
        ScrapedNode.url == url,
        ScrapedNode.is_deleted == False  # Ensure it's not already deleted
    ).first()

    if not scraped_url:
        raise HTTPException(status_code=404, detail="Scraped URL not found.")

    scraped_url.is_deleted = True  # Soft delete by updating the flag
    word_count = scraped_url.nodes_text_count or 0

    # Update bot word count
    bot = db.query(Bot).filter(Bot.bot_id == bot_id).first()
    if bot:
        bot.word_count = max(0, bot.word_count - word_count)

        # Update user total word count
        user = db.query(User).filter(User.user_id == bot.user_id).first()
        if user:
            user.total_words_used = max(0, user.total_words_used - word_count)
    db.commit()
    event_type="WEBSITE_URL_DELETED",
    event_data=f"Video '{scraped_url.url}' has been deleted."
    add_notification(db=db,
                    event_type=event_type,
                    event_data=event_data,
                    bot_id=bot_id,
                    user_id=bot.user_id)

    # Check if all URLs of the same website_id for the bot are deleted
    remaining_active_urls = db.query(ScrapedNode).filter(
        ScrapedNode.bot_id == bot_id,
        ScrapedNode.website_id == scraped_url.website_id,
        ScrapedNode.is_deleted == False
    ).count()

    if remaining_active_urls == 0:
        # Soft delete the corresponding Website entry
        website_entry = db.query(WebsiteDB).filter(
            WebsiteDB.id == scraped_url.website_id
        ).first()

        if website_entry:
            website_entry.is_deleted = True
            db.commit()
            print(f"Website {website_entry.id} marked as deleted.")

    return {"message": "Scraped URL soft deleted successfully."}