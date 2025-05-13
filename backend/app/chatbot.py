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
from app.dependency import get_current_user
from app.schemas import UserOut, YouTubeVideoResponse

# Initialize logger
logger = get_module_logger(__name__)

router = APIRouter(prefix="/chatbot", tags=["Chatbot"])
YOUTUBE_REGEX = re.compile(
    r"^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|playlist\?list=|channel\/)|youtu\.be\/).+"
)

# Load OpenAI API key
openai.api_key = os.getenv("OPENAI_API_KEY")

# New function to fetch recent chat history
def get_chat_history(db: Session, interaction_id: int, limit: int = 10):
    """
    Fetches the last `limit` chat messages for a given interaction,
    ordered from oldest to newest.
    
    Args:
        db: Database session
        interaction_id: The interaction ID to fetch messages for
        limit: Maximum number of messages to return
        
    Returns:
        List of ChatMessage objects
    """
    chat_history = db.query(ChatMessage)\
        .filter(ChatMessage.interaction_id == interaction_id)\
        .order_by(ChatMessage.timestamp.asc())\
        .limit(limit)\
        .all()
    
    return chat_history

# New function to format chat history into a string
def format_chat_history(chat_messages: List[ChatMessage]) -> str:
    """
    Formats a list of chat messages into a string with appropriate prefixes.
    
    Args:
        chat_messages: List of ChatMessage objects
        
    Returns:
        Formatted chat history string
    """
    if not chat_messages:
        return ""
    
    formatted_history = "\n\nPrevious messages:\n"
    
    for message in chat_messages:
        prefix = "User: " if message.sender.lower() == "user" else "Assistant: "
        formatted_history += f"{prefix}{message.message_text}\n"
    
    return formatted_history

# Adding a new helper function to detect and respond to greetings
def is_greeting(message: str) -> tuple[bool, str]:
    """
    Checks if a message is a simple greeting and returns an appropriate response.
    
    Args:
        message: The user's message text
        
    Returns:
        A tuple of (is_greeting, response). If is_greeting is True, response contains the greeting response.
    """
    # Convert to lowercase and strip whitespace for consistent matching
    message = message.lower().strip()
    
    # Remove punctuation from the end for better matching
    message = message.rstrip('!.,;:?')
    
    # Dictionary of greetings and their responses
    greetings = {
        # Basic greetings
        "hi": "Hi there! How can I help you today?",
        "hello": "Hello! How can I assist you?",
        "hey": "Hey! What can I help you with?",
        "greetings": "Greetings! How may I assist you today?",
        "howdy": "Howdy! What can I do for you?",
        
        # Time-based greetings
        "good morning": "Good morning! How can I help you today?",
        "morning": "Good morning! How can I assist you today?",
        "good afternoon": "Good afternoon! What can I assist you with?",
        "afternoon": "Good afternoon! What can I help you with today?",
        "good evening": "Good evening! How may I help you?",
        "evening": "Good evening! How can I assist you today?",
        "good day": "Good day to you! How can I be of assistance?",
        "good night": "Good night! Is there something I can help you with before you go?",
        
        # Other common greetings
        "what's up": "Not much, just here to help! What can I do for you?",
        "whats up": "Not much, just here to help! What can I do for you?",
        "wassup": "Hey there! What can I help you with?",
        "how are you": "I'm doing well, thanks for asking! How can I assist you?",
        "how r u": "I'm doing well! How can I help you today?",
        "how are u": "I'm good, thanks! How can I assist you?",
        "how you doing": "I'm doing great! What can I help you with?",
        "how r you": "I'm doing well, thanks! What can I help you with today?",
        "how's it going": "Everything's running smoothly! What can I help you with?",
        "hows it going": "Everything's great! How can I assist you today?",
        "yo": "Hey there! What's on your mind?",
        "hiya": "Hiya! How can I assist you today?",
        "sup": "Hey! What can I help you with?",
        "hola": "Hola! How can I help you?",
        "namaste": "Namaste! How may I assist you today?",
        "ciao": "Ciao! How can I help you?",
        "bonjour": "Bonjour! How can I assist you today?",
        "guten tag": "Guten Tag! How may I help you today?",
        "konnichiwa": "Konnichiwa! How can I assist you?",
        "salaam": "Salaam! How may I help you today?",
        
        # Compound and variation greetings
        "hi there": "Hello there! How can I help you today?",
        "hello there": "Hi there! What can I help you with?",
        "hey there": "Hey there! How can I assist you?",
        "hi friend": "Hello friend! How can I help you today?",
        "hello friend": "Hi there, friend! What can I help you with?",
        "heya": "Heya! How can I assist you today?",
        "heyy": "Hey there! What can I help you with?",
        "hiii": "Hi! How can I assist you today?",
        "hiiii": "Hello there! How can I help you?",
        "hellooo": "Hello! What can I help you with today?",
        "heyyy": "Hey! How can I assist you?",
    }
    
    # Check if the message is exactly a greeting
    if message in greetings:
        return True, greetings[message]
    
    # Check for phrases that start with greetings
    for greeting, response in greetings.items():
        # Check exact match
        if message == greeting:
            return True, response
        
        # Check prefix match with common endings
        if message.startswith(greeting + " "):
            # Check for common continuation phrases that should still be treated as greetings
            continuation = message[len(greeting):].strip()
            simple_continuations = [
                "there", "friend", "pal", "buddy", "everyone", "all", "folks", 
                "team", "guys", "everyone", "anybody", "everyone", "y'all"
            ]
            
            if continuation in simple_continuations or not continuation:
                return True, response
    
    # Look for emojis commonly used as greetings
    greeting_emojis = ["👋", "🙋", "🙋‍♂️", "🙋‍♀️", "✋", "🖐️", "🤚", "✌️"]
    if any(emoji in message for emoji in greeting_emojis) and len(message.strip()) <= 5:
        return True, "Hello there! How can I help you today?"
    
    # Not a recognized greeting
    return False, ""

def is_farewell(message: str) -> tuple[bool, str]:
    """
    Checks if a message is a farewell and returns an appropriate response.
    
    Args:
        message: The user's message text
        
    Returns:
        A tuple of (is_farewell, response). If is_farewell is True, response contains the farewell response.
    """
    # Convert to lowercase and strip whitespace for consistent matching
    message = message.lower().strip()
    
    # Remove punctuation from the end for better matching
    message = message.rstrip('!.,;:?')
    
    # Dictionary of farewells and their responses
    farewells = {
        # Basic farewells
        "bye": "Goodbye! Feel free to come back if you have more questions.",
        "goodbye": "Goodbye! Have a great day!",
        "see you": "See you later! Don't hesitate to reach out if you need anything else.",
        "see ya": "See ya! Come back anytime you need assistance.",
        "see you later": "See you later! Have a wonderful day!",
        "cya": "See you! Have a great day!",
        "farewell": "Farewell! It was a pleasure assisting you.",
        
        # Time-based farewells
        "good night": "Good night! Sleep well and have a great day tomorrow.",
        "have a good day": "You too! Have a wonderful day!",
        "have a great day": "You too! Have a fantastic day ahead!",
        "have a nice day": "Thank you! You have a nice day as well!",
        
        # Other common farewells
        "thanks": "You're welcome! Is there anything else I can help you with?",
        "thank you": "You're welcome! Feel free to ask if you need any more assistance.",
        "thx": "You're welcome! Have a great day!",
        "ty": "You're welcome! Let me know if you need anything else.",
        "thanks a lot": "You're very welcome! It was my pleasure to help.",
        "thank you very much": "You're very welcome! Don't hesitate to reach out again if needed.",
        "appreciate it": "Happy to help! Have a great day!",
        "thanks for your help": "You're welcome! That's what I'm here for.",
        
        # Compound and variation farewells
        "talk to you later": "Looking forward to it! Have a great day!",
        "ttyl": "Talk to you later! Have a great day!",
        "i'm leaving": "Take care! Feel free to return when you need assistance.",
        "i have to go": "No problem! Have a great day and come back anytime.",
        "got to go": "Take care! Feel free to chat again whenever you need help.",
        "gotta go": "No problem! Have a great day!",
        "until next time": "Until next time! Looking forward to helping you again.",
        "catch you later": "Catch you later! Have a great day!",
        "adios": "¡Adiós! Have a wonderful day!",
        "au revoir": "Au revoir! Feel free to return anytime you need assistance.",
        
        # Exit commands
        "exit": "Goodbye! Feel free to return when you need assistance.",
        "quit": "Closing this conversation. Feel free to start a new one anytime!",
        "end": "Ending our conversation. Have a great day!",
        "stop": "Stopping here as requested. Feel free to start a new conversation anytime!"
    }
    
    # Check if the message is exactly a farewell
    if message in farewells:
        return True, farewells[message]
    
    # Add compound farewell detection
    for farewell, response in farewells.items():
        # Check exact match
        if message == farewell:
            return True, response
        
        # Check for common endings to farewells
        if farewell in ["bye", "goodbye", "thanks", "thank you"]:
            if message.endswith(" " + farewell):
                return True, response
    
    # Not a recognized farewell
    return False, ""

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
    
    # ✅ Check if this is just a greeting message, to save tokens
    is_greeting_msg, greeting_response = is_greeting(user_message)
    if is_greeting_msg:
        logger.info(f"Greeting detected, responding without LLM", 
                  extra={"request_id": request_id, "bot_id": bot_id, "user_message": user_message})
        
        # Store conversation
        user_msg = ChatMessage(interaction_id=interaction.interaction_id, sender="user", message_text=user_message)
        bot_msg = ChatMessage(interaction_id=interaction.interaction_id, sender="bot", message_text=greeting_response)
        db.add_all([user_msg, bot_msg])
        db.commit()
        
        return {"bot_reply": greeting_response}
    
    # ✅ Check if this is a farewell message, to save tokens
    is_farewell_msg, farewell_response = is_farewell(user_message)
    if is_farewell_msg:
        logger.info(f"Farewell detected, responding without LLM", 
                  extra={"request_id": request_id, "bot_id": bot_id, "user_message": user_message})
        
        # Store conversation
        user_msg = ChatMessage(interaction_id=interaction.interaction_id, sender="user", message_text=user_message)
        bot_msg = ChatMessage(interaction_id=interaction.interaction_id, sender="bot", message_text=farewell_response)
        db.add_all([user_msg, bot_msg])
        db.commit()
        
        return {"bot_reply": farewell_response}
    
    use_external_knowledge = bot.external_knowledge if bot else False
    temperature = bot.temperature if bot and bot.temperature is not None else 0.7
    
    # Get message character limit from bot settings or use default
    message_char_limit = bot.max_words_per_message * 5 if bot and bot.max_words_per_message else 1000  # Approx 5 chars per word
    
    # Check if current user message exceeds character limit
    if len(user_message) > message_char_limit:
        logger.warning(f"User message exceeds character limit", 
                     extra={"request_id": request_id, "bot_id": bot_id, 
                           "message_length": len(user_message), "limit": message_char_limit})
        raise HTTPException(status_code=400, 
                           detail=f"Your message exceeds the maximum allowed length of {message_char_limit} characters.")
    
    logger.debug(f"Bot settings retrieved", 
                extra={"request_id": request_id, "bot_id": bot_id, 
                      "external_knowledge": use_external_knowledge, "temperature": temperature})
    
    # ✅ Retrieve recent chat history
    chat_history = get_chat_history(db, interaction.interaction_id)
    formatted_history = format_chat_history(chat_history)
    
    logger.debug(f"Retrieved chat history", 
                extra={"request_id": request_id, "bot_id": bot_id, 
                      "message_count": len(chat_history)})
    
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
        # Pass the formatted history to the LLM
        bot_reply = llm.generate(context, user_message, use_external_knowledge=use_external_knowledge, 
                                temperature=temperature, chat_history=formatted_history)
        
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
    
    # ✅ Check if this is just a greeting message, to save tokens
    is_greeting_msg, greeting_response = is_greeting(user_message)
    if is_greeting_msg:
        logger.info(f"Greeting detected, responding without LLM", 
                  extra={"bot_id": bot_id, "user_message": user_message})
        
        # Store conversation
        user_msg = ChatMessage(interaction_id=interaction.interaction_id, sender="user", message_text=user_message)
        bot_msg = ChatMessage(interaction_id=interaction.interaction_id, sender="bot", message_text=greeting_response)
        db.add_all([user_msg, bot_msg])
        db.commit()
        
        return {"bot_reply": greeting_response}
    
    # ✅ Check if this is a farewell message, to save tokens
    is_farewell_msg, farewell_response = is_farewell(user_message)
    if is_farewell_msg:
        logger.info(f"Farewell detected, responding without LLM", 
                  extra={"bot_id": bot_id, "user_message": user_message})
        
        # Store conversation
        user_msg = ChatMessage(interaction_id=interaction.interaction_id, sender="user", message_text=user_message)
        bot_msg = ChatMessage(interaction_id=interaction.interaction_id, sender="bot", message_text=farewell_response)
        db.add_all([user_msg, bot_msg])
        db.commit()
        
        return {"bot_reply": farewell_response}
    
    use_external_knowledge = bot.external_knowledge if bot else False
    temperature = bot.temperature if bot and bot.temperature is not None else 0.7
    
    # Get message character limit from bot settings or use default
    message_char_limit = bot.max_words_per_message * 5 if bot and bot.max_words_per_message else 1000  # Approx 5 chars per word
    
    # Check if current user message exceeds character limit
    if len(user_message) > message_char_limit:
        logger.warning(f"User message exceeds character limit", 
                     extra={"bot_id": bot_id, "message_length": len(user_message), 
                           "limit": message_char_limit})
        return {"bot_reply": f"Your message exceeds the maximum allowed length of {message_char_limit} characters."}
    
    logger.debug(f"Bot settings", 
                extra={"bot_id": bot_id, "external_knowledge": use_external_knowledge, 
                      "temperature": temperature})
    
    # Retrieve chat history for the current interaction
    chat_history = get_chat_history(db, interaction.interaction_id)
    formatted_history = format_chat_history(chat_history)
    
    logger.debug(f"Retrieved chat history", 
                extra={"bot_id": bot_id, "message_count": len(chat_history)})
    
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
        # Pass the formatted history to the LLM
        bot_reply = llm.generate(context, user_message, use_external_knowledge=use_external_knowledge, 
                               temperature=temperature, chat_history=formatted_history)
        
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
    """Extracts video transcripts from a YouTube video or playlist and stores them in ChromaDB for the bot using Celery."""
    request_id = getattr(request.state, "request_id", "unknown")
    
    logger.info(f"Processing YouTube video or playlist", 
               extra={"request_id": request_id, "bot_id": bot_id, "url": channel_url})
    
    # Valid YouTube URL patterns
    # Regex pattern to match valid YouTube URLs
    youtube_regex = re.compile(
        r"^(https?:\/\/)?(www\.)?(youtube\.com\/(channel\/|playlist\?list=|watch\?v=)|youtu\.be\/).+"
    )

    if not youtube_regex.match(channel_url):
        logger.warning(f"Invalid YouTube URL provided", 
                      extra={"request_id": request_id, "bot_id": bot_id, "url": channel_url})
        raise HTTPException(status_code=400, detail="Invalid YouTube URL. Please provide a valid YouTube video or playlist URL.")
    
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

@router.get("/bot/{bot_id}/videos", response_model=List[YouTubeVideoResponse])
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
        video_data = [
            YouTubeVideoResponse(
                video_id=video.video_id,
                video_title=video.video_title,
                video_url=video.video_url
            )
            for video in videos
        ]
        
        logger.info(f"Retrieved bot's YouTube videos", 
                   extra={"request_id": request_id, "bot_id": bot_id, "video_count": len(video_ids)})
        
        return video_data
    except Exception as e:
        logger.exception(f"Error retrieving bot videos", 
                        extra={"request_id": request_id, "bot_id": bot_id, "error": str(e)})
        raise HTTPException(status_code=500, detail=f"Error retrieving videos: {str(e)}")


@router.delete("/bot/{bot_id}/videos")
def soft_delete_video(request: Request, bot_id: int, video_id: str = Query(...), db: Session = Depends(get_db),current_user: UserOut = Depends(get_current_user)):
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
        user_youtube = current_user["user_id"]
        print("user_youtube",user_youtube)
        
        # Add notification
        notification_text = f"Video '{video.video_title}' was removed from bot {bot_id}'s knowledge base."
        add_notification(db, "Video Removed", notification_text,bot_id, user_youtube)
        
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
def soft_delete_scraped_url(
    request: Request, 
    bot_id: int, 
    url: str = Query(...),
    word_count: int = Query(...), 
    db: Session = Depends(get_db),
    current_user: UserOut = Depends(get_current_user)
):
 
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

        # Update bot and user word counts
        bot = db.query(Bot).filter(Bot.bot_id == bot_id).first()
        if bot:
            bot.word_count = max(0, (bot.word_count or 0) - word_count)
        
        user = db.query(User).filter(User.user_id == current_user["user_id"]).first()
        if user:
            user.total_words_used = max(0, (user.total_words_used or 0) - word_count)
        
        db.commit()
        
        # Delete from ChromaDB
        delete_url_from_chroma(bot_id, decoded_url)
        
        # Add notification
        notification_text = f"URL '{decoded_url}' was removed from bot {bot_id}'s knowledge base."
        add_notification(db, "URL Removed", notification_text,bot_id, current_user["user_id"])
        
        logger.info(f"Scraped URL deleted successfully", 
                   extra={"request_id": request_id, "bot_id": bot_id, "url": decoded_url})
        
        return {"message": "Scraped URL deleted successfully", "words_removed": word_count}
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