import hashlib
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, BackgroundTasks, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Interaction, ChatMessage,YouTubeVideo, ScrapedNode, WebsiteDB,User, Bot
from app.vector_db import retrieve_similar_docs, add_document, delete_video_from_chroma, delete_url_from_chroma
import openai
import os
import pdfplumber
from app.utils.upload_knowledge_utils import extract_text_from_file
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
from app.celery_tasks import process_youtube_videos_part1
from app.dependency import get_current_user
from app.schemas import UserOut, YouTubeVideoResponse
from langchain.memory import ConversationBufferMemory
from langchain.schema import HumanMessage, AIMessage
from datetime import datetime, timezone
from app.utils.ai_logger import log_chat_completion


# Initialize logger
logger = get_module_logger(__name__)

router = APIRouter(prefix="/chatbot", tags=["Chatbot"])
YOUTUBE_REGEX = re.compile(
    r"^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|playlist\?list=|channel\/)|youtu\.be\/).+"
)

# Load OpenAI API key
openai.api_key = os.getenv("OPENAI_API_KEY")
logger.info(f"🔑 DEBUG: OpenAI API key loaded: {'Present' if openai.api_key else 'Missing'}")

# Function to create or get memory for an interaction
def get_conversation_memory(db: Session, interaction_id: int):
    """
    Creates or retrieves a ConversationBufferMemory object for an interaction
    and loads previous messages from the database.
    
    Args:
        db: Database session
        interaction_id: The interaction ID to fetch messages for
        
    Returns:
        ConversationBufferMemory object
    """
    logger.info(f"🧠 DEBUG: Getting conversation memory for interaction_id: {interaction_id}")
    
    # Initialize memory object
    memory = ConversationBufferMemory(return_messages=True)
    logger.info(f"🧠 DEBUG: Initialized ConversationBufferMemory")
    
    # Load existing messages from the database
    chat_history = db.query(ChatMessage)\
        .filter(ChatMessage.interaction_id == interaction_id)\
        .order_by(ChatMessage.timestamp.asc())\
        .all()
    
    logger.info(f"📚 DEBUG: Loaded {len(chat_history)} messages from database for interaction_id: {interaction_id}")
    
    # Add messages to memory
    for i, message in enumerate(chat_history):
        if message.sender.lower() == "user":
            memory.chat_memory.add_user_message(message.message_text)
            logger.debug(f"👤 DEBUG: Added user message {i+1}/{len(chat_history)} to memory")
        else:
            memory.chat_memory.add_ai_message(message.message_text)
            logger.debug(f"🤖 DEBUG: Added AI message {i+1}/{len(chat_history)} to memory")
    
    logger.info(f"✅ DEBUG: Memory loaded successfully with {len(memory.chat_memory.messages)} total messages")
    return memory

# New function to format memory into a string for the LLM
def format_memory_to_string(memory: ConversationBufferMemory) -> str:
    """
    Formats conversation memory into a string with appropriate prefixes.
    
    Args:
        memory: ConversationBufferMemory object
        
    Returns:
        Formatted chat history string
    """
    logger.info(f"📝 DEBUG: Formatting memory to string")
    logger.info(f"📝 DEBUG: Memory contains {len(memory.chat_memory.messages)} messages")
    
    if not memory.chat_memory.messages:
        logger.info(f"📝 DEBUG: No messages in memory, returning empty string")
        return ""
    
    formatted_history = "\n\nPrevious messages:\n"
    
    for i, message in enumerate(memory.chat_memory.messages):
        if isinstance(message, HumanMessage):
            formatted_history += f"User: {message.content}\n"
            logger.debug(f"👤 DEBUG: Formatted user message {i+1}/{len(memory.chat_memory.messages)}")
        elif isinstance(message, AIMessage):
            formatted_history += f"Assistant: {message.content}\n"
            logger.debug(f"🤖 DEBUG: Formatted AI message {i+1}/{len(memory.chat_memory.messages)}")
    
    logger.info(f"✅ DEBUG: Memory formatted successfully, length: {len(formatted_history)} characters")
    return formatted_history

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
    logger.info(f"📚 DEBUG: Fetching chat history for interaction_id: {interaction_id}, limit: {limit}")
    
    chat_history = db.query(ChatMessage)\
        .filter(ChatMessage.interaction_id == interaction_id)\
        .order_by(ChatMessage.timestamp.asc())\
        .limit(limit)\
        .all()
    
    logger.info(f"✅ DEBUG: Retrieved {len(chat_history)} chat messages")
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
    logger.info(f"📝 DEBUG: Formatting {len(chat_messages)} chat messages")
    
    if not chat_messages:
        logger.info(f"📝 DEBUG: No chat messages to format")
        return ""
    
    formatted_history = "\n\nPrevious messages:\n"
    
    for i, message in enumerate(chat_messages):
        prefix = "User: " if message.sender.lower() == "user" else "Assistant: "
        formatted_history += f"{prefix}{message.message_text}\n"
        logger.debug(f"📝 DEBUG: Formatted message {i+1}/{len(chat_messages)} - Sender: {message.sender}")
    
    logger.info(f"✅ DEBUG: Chat history formatted successfully, length: {len(formatted_history)} characters")
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
    logger.info(f"👋 DEBUG: Checking if message is greeting: '{message}'")
    
    # Convert to lowercase and strip whitespace for consistent matching
    message = message.lower().strip()
    
    # Remove punctuation from the end for better matching
    message = message.rstrip('!.,;:?')
    
    # Dictionary of greetings and their responses
    greetings = {
        # Basic greetings
        "hi": "Hello! How can I help you?",
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
        "how you doing today": "I'm doing great! What can I help you with?",
        "how are you doing": "I'm doing great! What can I help you with?",
        "how are you doing today": "I'm doing great! What can I help you with?",
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
        logger.info(f"✅ DEBUG: Greeting detected - '{message}' -> '{greetings[message]}'")
        return True, greetings[message]
    
    # Check for phrases that start with greetings
    for greeting, response in greetings.items():
        # Check exact match
        if message == greeting:
            logger.info(f"✅ DEBUG: Exact greeting match - '{message}' -> '{response}'")
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
                logger.info(f"✅ DEBUG: Greeting with continuation - '{message}' -> '{response}'")
                return True, response
    
    # Look for emojis commonly used as greetings
    greeting_emojis = ["👋", "🙋", "🙋‍♂️", "🙋‍♀️", "✋", "🖐️", "🤚", "✌️"]
    if any(emoji in message for emoji in greeting_emojis) and len(message.strip()) <= 5:
        logger.info(f"✅ DEBUG: Emoji greeting detected - '{message}'")
        return True, "Hello there! How can I help you today?"
    
    # Not a recognized greeting
    logger.info(f"❌ DEBUG: Not a greeting - '{message}'")
    return False, ""

def is_farewell(message: str) -> tuple[bool, str]:
    """
    Checks if a message is a farewell and returns an appropriate response.
    
    Args:
        message: The user's message text
        
    Returns:
        A tuple of (is_farewell, response). If is_farewell is True, response contains the farewell response.
    """
    logger.info(f"👋 DEBUG: Checking if message is farewell: '{message}'")
    
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
        logger.info(f"✅ DEBUG: Farewell detected - '{message}' -> '{farewells[message]}'")
        return True, farewells[message]
    
    # Add compound farewell detection
    for farewell, response in farewells.items():
        # Check exact match
        if message == farewell:
            logger.info(f"✅ DEBUG: Exact farewell match - '{message}' -> '{response}'")
            return True, response
        
        # Check for common endings to farewells
        if farewell in ["bye", "goodbye", "thanks", "thank you"]:
            if message.endswith(" " + farewell):
                logger.info(f"✅ DEBUG: Farewell with ending - '{message}' -> '{response}'")
                return True, response
    
    # Not a recognized farewell
    logger.info(f"❌ DEBUG: Not a farewell - '{message}'")
    return False, ""

def extract_video_id(video_url: str) -> str:
    """Extracts YouTube video ID from URL"""
    logger.info(f"🎬 DEBUG: Extracting video ID from URL: {video_url}")
    
    if "youtu.be/" in video_url:
        video_id = video_url.split("youtu.be/")[-1].split("?")[0]
        logger.info(f"✅ DEBUG: Extracted video ID from youtu.be: {video_id}")
        return video_id
    elif "v=" in video_url:
        video_id = video_url.split("v=")[-1].split("&")[0]
        logger.info(f"✅ DEBUG: Extracted video ID from v=: {video_id}")
        return video_id
    
    logger.warning(f"❌ DEBUG: Could not extract video ID from URL: {video_url}")
    return None

def generate_response(bot_id: int, user_id: int, user_message: str, db: Session = Depends(get_db)):
    """Generate response using the bot's assigned LLM model."""
    logger.info(f"🤖 DEBUG: Starting response generation", extra={"bot_id": bot_id, "user_id": user_id})
    logger.info(f"💬 DEBUG: User message: '{user_message}'")
    
    # Ensure chat session exists
    interaction = db.query(Interaction).filter_by(bot_id=bot_id, user_id=user_id, archived=False).first()
    if not interaction:
        logger.info(f"🆕 DEBUG: Creating new interaction", extra={"bot_id": bot_id, "user_id": user_id})
        interaction = Interaction(bot_id=bot_id, user_id=user_id)
        db.add(interaction)
        db.commit()
        db.refresh(interaction)
        logger.info(f"✅ DEBUG: New interaction created with ID: {interaction.interaction_id}")
    else:
        logger.info(f"📝 DEBUG: Using existing interaction", extra={"interaction_id": interaction.interaction_id})

    # Get bot configuration
    bot = db.query(Bot).filter(Bot.bot_id == bot_id).first()
    if not bot:
        logger.error(f"❌ DEBUG: Bot not found", extra={"bot_id": bot_id})
        raise HTTPException(status_code=404, detail=f"Bot with ID {bot_id} not found")
    
    logger.info(f"🤖 DEBUG: Bot found - Name: {bot.bot_name}, External knowledge: {bot.external_knowledge}, Temperature: {bot.temperature}")
    
    # Get the bot's unanswered message
    unanswered_message = bot.unanswered_msg if bot.unanswered_msg else "I'm sorry, I don't have an answer for this question. This is outside my area of knowledge. Is there something else I can help with?"
    logger.info(f"🤖 DEBUG: Unanswered message: '{unanswered_message}'")

    # ✅ Check if this is just a greeting message, to save tokens
    is_greeting_msg, greeting_response = is_greeting(user_message)
    if is_greeting_msg:
        logger.info(f"👋 DEBUG: Greeting detected, responding without LLM", 
                  extra={"bot_id": bot_id, "user_message": user_message})
        
        # Store conversation
        # user_msg = ChatMessage(interaction_id=interaction.interaction_id, sender="user", message_text=user_message)
        # bot_msg = ChatMessage(interaction_id=interaction.interaction_id, sender="bot", message_text=greeting_response)
        # db.add_all([user_msg, bot_msg])
        # db.commit()
        
        return {"bot_reply": greeting_response,"is_default_response": True}
    
    # ✅ Check if this is a farewell message, to save tokens
    is_farewell_msg, farewell_response = is_farewell(user_message)
    if is_farewell_msg:
        logger.info(f"👋 DEBUG: Farewell detected, responding without LLM", 
                  extra={"bot_id": bot_id, "user_message": user_message})
        
        # Store conversation
        # user_msg = ChatMessage(interaction_id=interaction.interaction_id, sender="user", message_text=user_message)
        # bot_msg = ChatMessage(interaction_id=interaction.interaction_id, sender="bot", message_text=farewell_response)
        # db.add_all([user_msg, bot_msg])
        # db.commit()
        
        return {"bot_reply": farewell_response,"is_default_response": True}
    
    use_external_knowledge = bot.external_knowledge if bot else False
    temperature = bot.temperature if bot and bot.temperature is not None else 0.7
    # Get role and tone from bot
    role = bot.role if bot else "Service Assistant"  # default just in case
    tone = bot.tone if bot else "Friendly"           # default just in case
    
    # Get message character limit from bot settings or use default
    message_char_limit = bot.max_words_per_message * 5 if bot and bot.max_words_per_message else 1000  # Approx 5 chars per word
    
    # Check if current user message exceeds character limit
    if len(user_message) > message_char_limit:
        logger.warning(f"⚠️ DEBUG: User message exceeds character limit", 
                     extra={"bot_id": bot_id, "message_length": len(user_message), 
                           "limit": message_char_limit})
        return {"bot_reply": f"Your message exceeds the maximum allowed length of {message_char_limit} characters."}
    
    logger.debug(f"🤖 DEBUG: Bot settings", 
                extra={"bot_id": bot_id, "external_knowledge": use_external_knowledge, 
                      "temperature": temperature})
    
    # Use the new ConversationBufferMemory
    memory = get_conversation_memory(db, interaction.interaction_id)
    formatted_history = format_memory_to_string(memory)
    
    logger.debug(f"📚 DEBUG: Retrieved chat history", 
                extra={"bot_id": bot_id, "message_count": len(memory.chat_memory.messages)})
    
    # Retrieve relevant context
    logger.info(f"🔍 DEBUG: Retrieving similar documents from vector database")
    similar_docs = retrieve_similar_docs(bot_id, user_message, user_id=user_id)
    logger.info(f"📄 DEBUG: Retrieved documents from vector database", 
               extra={"bot_id": bot_id, "document_count": len(similar_docs) if similar_docs else 0})
    
    # Handle cases with no relevant documents
    if not similar_docs:
        if use_external_knowledge:
            context = ""
            logger.info(f"🌐 DEBUG: No relevant documents found, using external knowledge", 
                       extra={"bot_id": bot_id})
        else:
            bot_reply = unanswered_message  
            logger.info(f"❌ DEBUG: No relevant documents found and external knowledge disabled", 
                       extra={"bot_id": bot_id})
            return {"bot_reply": bot_reply,
                "is_default_response": True,
                 "not_answered": True }
    else:
        # Note: vector_db.py returns documents with a "content" field
        context = " ".join([doc.get("content", "") for doc in similar_docs])
        logger.info(f"📄 DEBUG: Context prepared with {len(similar_docs)} documents, length: {len(context)} characters")

    try:
        # Generate response using appropriate LLM and knowledge settings based on user's subscription and bot settings
        logger.debug(f"🤖 DEBUG: Generating response with LLM", 
                    extra={"bot_id": bot_id, "external_knowledge": use_external_knowledge})
        
        llm = LLMManager(bot_id=bot_id, user_id=user_id,unanswered_message=unanswered_message)
        logger.info(f"🤖 DEBUG: LLM Manager initialized")

        # Modify the context to include the unanswered message instruction
        if not use_external_knowledge:
            context += f"\n\nIf you cannot answer the question based on the context above, respond with exactly: \"{unanswered_message}\""
            logger.info(f"🤖 DEBUG: Added unanswered message instruction to context")
        
        # Pass the formatted history to the LLM
        bot_reply_dict  = llm.generate(context, user_message, use_external_knowledge=use_external_knowledge, 
                               temperature=temperature, chat_history=formatted_history,role=role,tone=tone)
        
        # Extract the actual response string and external knowledge flag
        bot_reply_text = bot_reply_dict["message"]
        used_external = bot_reply_dict.get("used_external", False)
        
        logger.info(f"Generated response successfully", 
                   extra={"bot_id": bot_id, "response_length": len(bot_reply_text ) if bot_reply_text  else 0})

        # Store conversation
        # user_msg = ChatMessage(interaction_id=interaction.interaction_id, sender="user", message_text=user_message)
        # bot_msg = ChatMessage(interaction_id=interaction.interaction_id, sender="bot", message_text=bot_reply)
        # db.add_all([user_msg, bot_msg])
        # db.commit()
        
        # Update memory with the new messages
        memory.chat_memory.add_user_message(user_message)
        memory.chat_memory.add_ai_message(bot_reply_text )
        
        logger.debug(f"💾 DEBUG: Stored conversation in database", 
                    extra={"bot_id": bot_id, "interaction_id": interaction.interaction_id})

        # when it can't answer, making this detection more reliable
        is_default_response = unanswered_message.lower() in bot_reply_text .lower()

        return {
            "bot_reply": bot_reply_text ,
            "is_default_response": bot_reply_dict.get("is_default_response", is_default_response),
            "not_answered": bot_reply_dict.get("not_answered", is_default_response),
            "used_external": bot_reply_dict.get("used_external", False),
            "is_greeting_response": bot_reply_dict.get("is_greeting_response", False),
            "is_farewell_response": bot_reply_dict.get("is_farewell_response", False)
        }
    except Exception as e:
        logger.exception(f"❌ DEBUG: Error generating response", 
                        extra={"bot_id": bot_id, "error": str(e)})
        return {
            "bot_reply": unanswered_message,
            "is_default_response": True,
            "not_answered": True
        }
        #raise HTTPException(status_code=500, detail=f"Chatbot error: {str(e)}")


@router.post("/fetch-videos")
async def fetch_videos(request: Request, video_request: YouTubeRequest):
    request_id = getattr(request.state, "request_id", "unknown")
    
    logger.info(f"🎬 DEBUG: POST /fetch-videos called", 
               extra={"request_id": request_id, "url": video_request.url})
    
    if not YOUTUBE_REGEX.match(video_request.url):
        logger.warning(f"❌ DEBUG: Invalid YouTube URL provided", 
                      extra={"request_id": request_id, "url": video_request.url})
        raise HTTPException(status_code=400, detail="Invalid YouTube URL.")
    
    logger.info(f"✅ DEBUG: YouTube URL validation passed")
    
    try:
        logger.info(f"🔍 DEBUG: Fetching video URLs from YouTube")
        urls = get_video_urls(video_request.url)
        logger.info(f"✅ DEBUG: Successfully fetched YouTube videos", 
                   extra={"request_id": request_id, "url": video_request.url, 
                         "video_count": len(urls) if urls else 0})
        return {"video_urls": urls}
    except Exception as e:
        logger.exception(f"❌ DEBUG: Error fetching YouTube videos", 
                        extra={"request_id": request_id, "url": video_request.url, 
                              "error": str(e)})
        raise HTTPException(status_code=500, detail=f"Error fetching videos: {str(e)}")

@router.post("/process-videos")
async def process_selected_videos(
    request: Request,
    video_request: VideoProcessingRequest,
    db: Session = Depends(get_db)
):
    request_id = getattr(request.state, "request_id", "unknown")
    
    logger.info(f"🎬 DEBUG: POST /process-videos called", 
               extra={"request_id": request_id, "bot_id": video_request.bot_id, 
                     "video_count": len(video_request.video_urls) if video_request.video_urls else 0})
    

    bot = db.query(Bot).filter(Bot.bot_id == video_request.bot_id).first()
    if not bot:
        logger.error(f"❌ DEBUG: Bot not found", extra={"bot_id": video_request.bot_id})
        raise HTTPException(status_code=404, detail="Bot not found")

    user_id = bot.user_id
    logger.info(f"👤 DEBUG: Processing videos for user_id: {user_id}")
    print("user_id")
    inserted = 0
    skipped = 0
    new_video_urls = []

    logger.info(f"🔄 DEBUG: Processing {len(video_request.video_urls)} video URLs")
    for i, url in enumerate(video_request.video_urls):
        logger.info(f"🎬 DEBUG: Processing video {i+1}/{len(video_request.video_urls)}: {url}")
        
        # Generate fallback video_id from URL (same logic used elsewhere)
        if "youtu.be/" in url:
            video_id = url.split("youtu.be/")[-1].split("?")[0]
            logger.info(f"🎬 DEBUG: Extracted video_id from youtu.be: {video_id}")
        elif "v=" in url:
            video_id = url.split("v=")[-1].split("&")[0]
            logger.info(f"🎬 DEBUG: Extracted video_id from v=: {video_id}")
        else:
            video_id = hashlib.md5(url.encode()).hexdigest()
            logger.info(f"🎬 DEBUG: Generated video_id from hash: {video_id}")

        existing = db.query(YouTubeVideo).filter(
            YouTubeVideo.video_id == video_id,
            YouTubeVideo.bot_id == video_request.bot_id,
            YouTubeVideo.is_deleted == False
        ).first()

        if existing:
            logger.info(f"⏭️ DEBUG: Video already exists, skipping: {video_id}")
            skipped += 1
            continue

        # Insert basic video record
        logger.info(f"💾 DEBUG: Creating new video record for video_id: {video_id}")
        basic_video = YouTubeVideo(
            video_id=video_id,
            video_url=url,
            bot_id=video_request.bot_id,
            video_title="YouTube Video",
            transcript_count=0,
            status="Extracting",
            created_by=user_id,
            updated_by=user_id,
        )
        db.add(basic_video)
        inserted += 1
        new_video_urls.append(url)
        logger.info(f"✅ DEBUG: Video record created successfully")

    db.commit()
    logger.info(f"💾 DEBUG: Database commit completed")

    print(f"✅ Inserted {inserted} new videos, skipped {skipped} existing ones")
    logger.info(f"📊 DEBUG: Processing summary - Inserted: {inserted}, Skipped: {skipped}")

    if new_video_urls:
        try:
            logger.info(f"🚀 DEBUG: Starting Celery task for {len(new_video_urls)} videos")
            task = process_youtube_videos_part1.delay(
                video_request.bot_id,
                new_video_urls
            )
            logger.info(f"✅ DEBUG: Celery task started successfully", extra={"task_id": task.id if inserted > 0 else None})
            return {
                "message": f"Video processing started for {inserted} new videos, skipping {skipped} existing ones in the background.",
                "task_id": task.id if inserted > 0 else None,
                "inserted": inserted,
                "skipped": skipped
            }
        except Exception as e:
            logger.error(f"❌ DEBUG: Celery task failed", extra={"error": str(e)})
            raise HTTPException(status_code=500, detail=str(e))
    else:
        logger.info(f"ℹ️ DEBUG: No new videos to process")
        return {
            "message": "All provided videos already exist. Nothing to process.",
            "task_id": None,
            "inserted": inserted,
            "skipped": skipped
        }


@router.get("/bot/{bot_id}/videos", response_model=List[YouTubeVideoResponse])
def get_bot_videos(request: Request, bot_id: int, db: Session = Depends(get_db)):
    """Retrieves a list of YouTube videos stored for a specific bot."""
    request_id = getattr(request.state, "request_id", "unknown")
    
    logger.info(f"🎬 DEBUG: GET /bot/{bot_id}/videos called", 
               extra={"request_id": request_id, "bot_id": bot_id})
    
    try:
        # Query the database for videos associated with the bot
        logger.info(f"🔍 DEBUG: Querying database for bot videos")
        videos = db.query(YouTubeVideo).filter(
            YouTubeVideo.bot_id == bot_id,
            YouTubeVideo.is_deleted == False
        ).all()
        
        logger.info(f"📄 DEBUG: Found {len(videos)} videos for bot_id: {bot_id}")
        
        # Extract video IDs
        video_ids = [video.video_id for video in videos]
        video_data = [
            YouTubeVideoResponse(
                video_id=video.video_id,
                video_title=video.video_title,
                video_url=video.video_url,
                transcript_count=video.transcript_count or 0,
                upload_date=video.created_at,
                status=video.status,
                error_code=video.error_code

            )
            for video in videos
        ]
        
        logger.info(f"✅ DEBUG: Retrieved bot's YouTube videos", 
                   extra={"request_id": request_id, "bot_id": bot_id, "video_count": len(video_ids)})
        
        return video_data
    except Exception as e:
        logger.exception(f"❌ DEBUG: Error retrieving bot videos", 
                        extra={"request_id": request_id, "bot_id": bot_id, "error": str(e)})
        raise HTTPException(status_code=500, detail=f"Error retrieving videos: {str(e)}")


@router.delete("/bot/{bot_id}/videos")
def soft_delete_video(request: Request, bot_id: int, video_id: str = Query(...), word_count: int = Query(0), db: Session = Depends(get_db), current_user: UserOut = Depends(get_current_user)):
    """Soft deletes a YouTube video from a bot's knowledge base."""
    request_id = getattr(request.state, "request_id", "unknown")
    
    logger.info(f"🗑️ DEBUG: DELETE /bot/{bot_id}/videos called", 
               extra={"request_id": request_id, "bot_id": bot_id, "video_id": video_id, "word_count": word_count})
    
    try:
        # Find the video
        logger.info(f"🔍 DEBUG: Searching for video in database")
        video = db.query(YouTubeVideo).filter(
            YouTubeVideo.bot_id == bot_id,
            YouTubeVideo.video_id == video_id,
            YouTubeVideo.is_deleted == False
        ).first()
        
        if not video:
            logger.warning(f"❌ DEBUG: Video not found for deletion", 
                          extra={"request_id": request_id, "bot_id": bot_id, "video_id": video_id})
            raise HTTPException(status_code=404, detail="Video not found")

        logger.info(f"✅ DEBUG: Video found - Title: {video.video_title}, Status: {video.status}")

        # Soft delete the video in the database
        video.is_deleted = True
        logger.info(f"🗑️ DEBUG: Marked video as deleted in database")
        
         # Get the transcript count from the video if word_count parameter wasn't provided
        transcript_count = word_count if word_count > 0 else (video.transcript_count or 0)
        logger.info(f"📊 DEBUG: Transcript count: {transcript_count}")

        if video.status == "Success":
            logger.info(f"✅ DEBUG: Video was successful, updating word counts")

            # Update bot and user word counts
            bot = db.query(Bot).filter(Bot.bot_id == bot_id).first()
            if bot:
                old_bot_count = bot.word_count or 0
                bot.word_count = max(0, old_bot_count - transcript_count)
                logger.info(f"📊 DEBUG: Updated bot word count: {old_bot_count} -> {bot.word_count}")

            user = db.query(User).filter(User.user_id == current_user["user_id"]).first()
            if user:
                old_user_count = user.total_words_used or 0
                user.total_words_used = max(0, old_user_count - transcript_count)
                logger.info(f"📊 DEBUG: Updated user word count: {old_user_count} -> {user.total_words_used}")

        db.commit()
        logger.info(f"💾 DEBUG: Database changes committed")
        
        # Delete from ChromaDB
        logger.info(f"🗄️ DEBUG: Deleting video from ChromaDB")
        delete_video_from_chroma(bot_id, video_id)
        logger.info(f"✅ DEBUG: Video deleted from ChromaDB")
        
        user_youtube = current_user["user_id"]
        print("user_youtube", user_youtube)
        logger.info(f"👤 DEBUG: User ID for notification: {user_youtube}")
        
        # Add notification
        notification_text = f"Video '{video.video_title}' was removed from bot {bot_id}'s knowledge base. "
        logger.info(f"📢 DEBUG: Adding notification: {notification_text}")
        add_notification(db, "Video Removed", notification_text, bot_id, user_youtube)
        logger.info(f"✅ DEBUG: Notification added successfully")
        
        logger.info(f"✅ DEBUG: Video deleted successfully", 
                   extra={"request_id": request_id, "bot_id": bot_id, "video_id": video_id, "words_removed": transcript_count})
        
        return {
            "message": "Video deleted successfully", 
            "words_removed": transcript_count
        }
    except Exception as e:
        logger.exception(f"❌ DEBUG: Error deleting video", 
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
    
    logger.info(f"🗑️ DEBUG: DELETE /bot/{bot_id}/scraped-urls called", 
               extra={"request_id": request_id, "bot_id": bot_id, "url": decoded_url, "word_count": word_count})
    
    try:
        # Find the scraped node
        logger.info(f"🔍 DEBUG: Searching for scraped node in database")
        scraped_node = db.query(ScrapedNode).filter(
            ScrapedNode.bot_id == bot_id,
            ScrapedNode.url == decoded_url,
            ScrapedNode.is_deleted == False
        ).first()
        
        if not scraped_node:
            logger.warning(f"❌ DEBUG: Scraped URL not found for deletion", 
                          extra={"request_id": request_id, "bot_id": bot_id, "url": decoded_url})
            raise HTTPException(status_code=404, detail="Scraped URL not found")
        
        logger.info(f"✅ DEBUG: Scraped node found - ID: {scraped_node.id}, Status: {scraped_node.status}")
        word_count = scraped_node.nodes_text_count
        logger.info(f"📊 DEBUG: Actual word count from node: {word_count}")
        
        # Soft delete the scraped node in the database
        scraped_node.is_deleted = True
        logger.info(f"🗑️ DEBUG: Marked scraped node as deleted in database")
        
        # Check if all nodes for this website are deleted
        print("scraped_node.website_id",scraped_node.website_id)
        logger.info(f"🌐 DEBUG: Checking website_id: {scraped_node.website_id}")
        if scraped_node.website_id:
            remaining_nodes = db.query(ScrapedNode).filter(
                ScrapedNode.website_id == scraped_node.website_id,
                ScrapedNode.is_deleted == False
            ).count()

            logger.info(f"🌐 DEBUG: Remaining nodes for website: {remaining_nodes}")
            if remaining_nodes == 0:
                print("I am here 2")
                logger.info(f"🌐 DEBUG: No remaining nodes, marking website as deleted")
                website = db.query(WebsiteDB).filter(
                    WebsiteDB.id == scraped_node.website_id
                ).first()
                if website and not website.is_deleted:
                    website.is_deleted = True
                    logger.info(f"✅ DEBUG: Website ID {scraped_node.website_id} marked as deleted")
                else:
                    logger.info(f"ℹ️ DEBUG: Website already deleted or not found")
        
        print("scraped_node.status",scraped_node.status)
        logger.info(f"📊 DEBUG: Scraped node status: {scraped_node.status}")
        if scraped_node.status == "Success":
            # Update bot and user word counts
            print("enteed")
            print("word count",word_count)
            logger.info(f"✅ DEBUG: Scraped node was successful, updating word counts")
            
            bot = db.query(Bot).filter(Bot.bot_id == bot_id).first()
            if bot:
                old_bot_count = bot.word_count or 0
                bot.word_count = max(0, old_bot_count - word_count)
                print("Bot word count after:", bot.word_count)
                logger.info(f"📊 DEBUG: Updated bot word count: {old_bot_count} -> {bot.word_count}")

            user = db.query(User).filter(User.user_id == current_user["user_id"]).first()
            if user:
                old_user_count = user.total_words_used or 0
                user.total_words_used = max(0, old_user_count - word_count)
                print("User word count after:", user.total_words_used)
                logger.info(f"📊 DEBUG: Updated user word count: {old_user_count} -> {user.total_words_used}")
        else:
            word_count = 0  # So response and logs are accurate
            logger.info(f"ℹ️ DEBUG: Scraped node was not successful, word_count set to 0")
        
        print("commiting")
        db.commit()
        logger.info(f"💾 DEBUG: Database changes committed")
        
        # Delete from ChromaDB
        logger.info(f"🗄️ DEBUG: Deleting URL from ChromaDB")
        delete_url_from_chroma(bot_id, decoded_url)
        logger.info(f"✅ DEBUG: URL deleted from ChromaDB")
        
        # Add notification
        notification_text = f"URL '{decoded_url}' was removed from bot {bot_id}'s knowledge base."
        logger.info(f"📢 DEBUG: Adding notification: {notification_text}")
        add_notification(db, "URL Removed", notification_text,bot_id, current_user["user_id"])
        logger.info(f"✅ DEBUG: Notification added successfully")
        
        logger.info(f"✅ DEBUG: Scraped URL deleted successfully", 
                   extra={"request_id": request_id, "bot_id": bot_id, "url": decoded_url})
        
        return {"message": "Scraped URL deleted successfully", "words_removed": word_count}
    except Exception as e:
        logger.exception(f"❌ DEBUG: Error deleting scraped URL", 
                        extra={"request_id": request_id, "bot_id": bot_id, 
                              "url": decoded_url, "error": str(e)})
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Error deleting scraped URL: {str(e)}")


@router.post("/scrape-youtube")
def scrape_youtube_endpoint(request: Request, youtube_request: YouTubeScrapingRequest, db: Session = Depends(get_db)):
    """Processes selected YouTube video transcripts and stores them in ChromaDB using Celery."""
    request_id = getattr(request.state, "request_id", "unknown")
    
    logger.info(f"🎬 DEBUG: POST /scrape-youtube called", 
               extra={"request_id": request_id, "bot_id": youtube_request.bot_id, 
                     "video_urls": youtube_request.video_urls})
    
    try:
        logger.info(f"✅ DEBUG: YouTube scraping endpoint processed successfully")
        return {
            "message": "YouTube content processing started",
        }
    except Exception as e:
        logger.exception(f"❌ DEBUG: Error scraping YouTube content", 
                        extra={"request_id": request_id, "bot_id": youtube_request.bot_id, 
                              "error": str(e)})
        raise HTTPException(status_code=500, detail=f"Error processing YouTube content: {str(e)}")

@router.put("/interactions/{interaction_id}/end")
def end_interaction(interaction_id: int, db: Session = Depends(get_db)):
    """
    End a chat interaction and mark it as archived.
    """
    logger.info(f"🔚 DEBUG: PUT /interactions/{interaction_id}/end called")
    
    interaction = db.query(Interaction).filter(Interaction.interaction_id == interaction_id).first()
    if not interaction:
        logger.error(f"❌ DEBUG: Interaction not found", extra={"interaction_id": interaction_id})
        raise HTTPException(status_code=404, detail="Interaction not found")
    
    logger.info(f"✅ DEBUG: Interaction found - Bot ID: {interaction.bot_id}, User ID: {interaction.user_id}")
    
    # Get the current UTC time
    utc_now = datetime.now(timezone.utc)
    interaction.end_time = utc_now
    # Also mark as archived
    interaction.archived = True
    logger.info(f"📅 DEBUG: Setting end time to: {utc_now}")
    logger.info(f"📁 DEBUG: Marking interaction as archived")
    
    db.commit()
    logger.info(f"💾 DEBUG: Database changes committed")
    
    logger.info(f"✅ DEBUG: Ended interaction", extra={"interaction_id": interaction_id})
    return {"message": "Interaction ended successfully", "end_time": interaction.end_time}