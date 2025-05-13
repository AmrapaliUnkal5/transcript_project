from typing import List
from chromadb import logger
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Bot, Interaction, ChatMessage, User, WordCloudData
from pydantic import BaseModel
from app.vector_db import retrieve_similar_docs
from app.chatbot import generate_response  
from datetime import datetime, timezone
from app.schemas import FAQResponse, WordCloudResponse
import threading 
from app.clustering import PGClusterer
from app.utils.logger import get_module_logger
from app.word_cloud_processor import WordCloudProcessor

# Create a logger for this module
logger = get_module_logger(__name__)

pg_clusterer = PGClusterer()


router = APIRouter(prefix="/chat", tags=["Chat Interactions"])

class StartChatRequest(BaseModel):
    bot_id: int
    user_id: int

@router.post("/start_chat")
def start_chat(request: StartChatRequest, db: Session = Depends(get_db)):
    """Creates a new chat session for a user and bot."""
    logger.info("Bot ID: %s", request.bot_id)
    logger.info("User ID: %s", request.user_id)

    new_interaction = Interaction(bot_id=request.bot_id, user_id=request.user_id)
    db.add(new_interaction)
    db.commit()
    db.refresh(new_interaction)

    return {"interaction_id": new_interaction.interaction_id}


class SendMessageRequest(BaseModel):
    interaction_id: int
    sender: str
    message_text: str
    is_addon_message: bool = False

# ✅ Function to handle clustering in the background
def async_cluster_question(bot_id, message_text,message_id):
    db = next(get_db())
    try:
        cluster_id = pg_clusterer.process_question(db,bot_id, message_text)
        logger.info("🔁 Background Cluster ID: %s", cluster_id)

        # Update message with cluster_id
        db.query(ChatMessage)\
            .filter(ChatMessage.message_id == message_id)\
            .update({"cluster_id": cluster_id})
        db.commit()
        logger.info("✅ Cluster id updated in database")
    except Exception as e:
        logger.warning("⚠️ Error in background clustering: %s", e)
        db.rollback()
    finally:
        db.close()

def update_message_counts(bot_id: int, user_id: int):
    db = next(get_db())
    try:
        # Update bot message count
        db.query(Bot).filter(Bot.bot_id == bot_id).update({
            Bot.message_count: Bot.message_count + 1
        })
       
        # Update user message count
        db.query(User).filter(User.user_id == user_id).update({
            User.total_message_count: User.total_message_count + 1
        })

        db.commit()
        logger.info("✅ Message counts updated")
    except Exception as e:
        db.rollback()
        logger.warning("⚠️ Failed to update message counts: %s", e)
    finally:
        db.close()

def async_update_word_cloud(bot_id: int, message_text: str):
    """Background thread to update word cloud"""
    db = next(get_db())
    try:
        WordCloudProcessor.update_word_cloud(bot_id, message_text, db)
        logger.info(f"✅ Updated word cloud for bot {bot_id}")
    except Exception as e:
        logger.warning(f"⚠️ Error in word cloud update: {str(e)}")
    finally:
        db.close()

@router.post("/send_message")
def send_message(request: SendMessageRequest, db: Session = Depends(get_db)):
    """Stores a user message, retrieves relevant context, and generates a bot response."""

    # ✅ Check if interaction exists
    interaction = db.query(Interaction).filter(Interaction.interaction_id == request.interaction_id).first()
    if not interaction:
        raise HTTPException(status_code=404, detail="Chat session not found")

    logger.debug("interaction_botid=> %s", interaction.bot_id)
    

    # ✅ Store user message with cluster_id=None initially
    user_message = ChatMessage(
        interaction_id=request.interaction_id,
        sender=request.sender,
        message_text=request.message_text,
        cluster_id="temp"
    )
    db.add(user_message)
    db.commit()
    db.refresh(user_message)

    def is_greeting(msg):
        greetings = ["hi", "hello", "hey", "good morning", "good evening", "good afternoon", "how are you"]
        msg = msg.strip().lower()
        return msg in greetings

    # ✅ Start clustering in background thread if sender is user
    if request.sender.lower() == "user" and not is_greeting(request.message_text):
        threading.Thread(
            target=async_cluster_question,
            args=(interaction.bot_id, request.message_text,user_message.message_id)
        ).start()

        print("Word cloud thread started")
        threading.Thread(
            target=async_update_word_cloud,
            args=(interaction.bot_id, request.message_text)
        ).start()
        

    # ✅ Retrieve context using vector database
    similar_docs = retrieve_similar_docs(interaction.bot_id, request.message_text)
    context = " ".join([doc.get('content', '') for doc in similar_docs]) if similar_docs else "No relevant documents found."

    # ✅ Generate chatbot response using LLM
    bot_reply_dict = generate_response(
        bot_id=interaction.bot_id, 
        user_id=interaction.user_id, 
        user_message=request.message_text, 
        db=db
    )

    # ✅ Extract actual response string
    bot_reply_text = bot_reply_dict["bot_reply"]

    # ✅ Store bot response in DB
    bot_message = ChatMessage(
        interaction_id=request.interaction_id,
        sender="bot",
        message_text=bot_reply_text
    )
    db.add(bot_message)
    db.commit()

    logger.debug("is_addon_message=> %s", request.is_addon_message)

    # ✅ Update message count in background
    if not request.is_addon_message:
        threading.Thread(
            target=update_message_counts,
            args=(interaction.bot_id, interaction.user_id)
        ).start()

    return {"message": bot_reply_text, "message_id": bot_message.message_id}

@router.get("/get_chat_messages")
def get_chat_messages(interaction_id: int, db: Session = Depends(get_db)):
    """Fetches all messages for a given chat session."""

    # ✅ Check if the interaction exists
    interaction = db.query(Interaction).filter(Interaction.interaction_id == interaction_id).first()
    if not interaction:
        return {"message": "Chat session not found."}  # ✅ Return empty response instead of 404

    # ✅ Fetch chat messages
    messages = db.query(ChatMessage).filter(ChatMessage.interaction_id == interaction_id).order_by(ChatMessage.timestamp.asc()).all()

    return [
        {"sender": msg.sender, "message": msg.message_text, "timestamp": msg.timestamp}
        for msg in messages
    ] if messages else {"message": "No messages found for this chat session."}

@router.put("/interactions/{interaction_id}/end")
def end_interaction(interaction_id: int, db: Session = Depends(get_db)):
    logger.info("End interaction")
    interaction = db.query(Interaction).filter(Interaction.interaction_id == interaction_id).first()
    if not interaction:
        raise HTTPException(status_code=404, detail="Interaction not found")
    
    # Get the current UTC time
    utc_now = datetime.now(timezone.utc)
    interaction.end_time = utc_now
    logger.debug("interaction.end_time %s", interaction.end_time)
    db.commit()
    return {"message": "Session ended successfully", "end_time": interaction.end_time}

@router.get("/analytics/faqs/{bot_id}", response_model=List[FAQResponse])
def get_frequently_asked_questions(bot_id: int, db: Session = Depends(get_db), limit: int = 10):
    """
    Get frequently asked questions for a specific bot
    Returns at least one example question even for new bots
    """
    try:
        logger.info(f"Fetching FAQs for bot {bot_id}")
        faqs = pg_clusterer.get_faqs(db, bot_id, limit)

        if not faqs:
            example_questions = db.query(ChatMessage.message_text)\
                .filter(ChatMessage.interaction_id.has(bot_id=bot_id))\
                .filter(ChatMessage.sender == "user")\
                .order_by(ChatMessage.timestamp.desc())\
                .limit(5)\
                .all()

            if example_questions:
                faqs = [{
                    "question": example_questions[0][0],
                    "similar_questions": [q[0] for q in example_questions[1:]],
                    "count": 1,
                    "cluster_id": f"{bot_id}-0"
                }]

        logger.info(f"Returning {len(faqs)} FAQs for bot {bot_id}")
        return faqs

    except Exception as e:
        logger.error(f"Error getting FAQs for bot {bot_id}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error retrieving FAQs: {str(e)}"
        )


@router.get("/analytics/cluster_debug/{bot_id}")
def get_cluster_debug(bot_id: int):
    """Debug endpoint to inspect raw cluster data"""
    if bot_id not in pg_clusterer.bot_clusters:
        raise HTTPException(status_code=404, detail="No cluster data for this bot")
    
    bot_data = pg_clusterer.bot_clusters[bot_id]
    return {
        "cluster_counts": dict(bot_data['counts']),
        "sample_questions": {
            cluster_id: questions[:3]
            for cluster_id, questions in bot_data['clusters'].items()
        }
    }

@router.post("/force_save_clusters")
def force_save_clusters():
    """Manual endpoint to save cluster state"""
    pg_clusterer.save_cluster_state()
    return {"status": "Cluster state saved successfully"}

@router.get("/analytics/word_cloud/{bot_id}", response_model=WordCloudResponse)
def get_word_cloud(bot_id: int, limit: int = 50, db: Session = Depends(get_db)):
    """Get word cloud data for a specific bot"""
    try:
        word_cloud = db.query(WordCloudData).filter_by(bot_id=bot_id).first()
        
        if not word_cloud or not word_cloud.word_frequencies:
            return {"words": []}
            
        # Sort by frequency and limit results
        sorted_words = sorted(
            word_cloud.word_frequencies.items(),
            key=lambda x: x[1],
            reverse=True
        )[:limit]
        
        # Format for the frontend
        words = [{"text": word, "value": count} for word, count in sorted_words]
        
        return {"words": words}
        
    except Exception as e:
        logger.error(f"Error getting word cloud for bot {bot_id}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error retrieving word cloud: {str(e)}"
        )