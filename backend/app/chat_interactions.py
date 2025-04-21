from typing import List
from chromadb import logger
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Interaction, ChatMessage
from pydantic import BaseModel
from app.vector_db import retrieve_similar_docs
from app.chatbot import generate_response  
from datetime import datetime, timezone
from app.schemas import FAQResponse
import threading 
from app.clustering import PGClusterer
pg_clusterer = PGClusterer()


router = APIRouter(prefix="/chat", tags=["Chat Interactions"])

class StartChatRequest(BaseModel):
    bot_id: int
    user_id: int

@router.post("/start_chat")
def start_chat(request: StartChatRequest, db: Session = Depends(get_db)):
    """Creates a new chat session for a user and bot."""
    print("Bot ID:", request.bot_id)
    print("User ID:", request.user_id)

    new_interaction = Interaction(bot_id=request.bot_id, user_id=request.user_id)
    db.add(new_interaction)
    db.commit()
    db.refresh(new_interaction)

    return {"interaction_id": new_interaction.interaction_id}


class SendMessageRequest(BaseModel):
    interaction_id: int
    sender: str
    message_text: str

# ✅ Function to handle clustering in the background
def async_cluster_question(bot_id, message_text,message_id):
    db = next(get_db())
    try:
        cluster_id = pg_clusterer.process_question(db,bot_id, message_text)
        print("🔁 Background Cluster ID:", cluster_id)

        # Update message with cluster_id
        db.query(ChatMessage)\
            .filter(ChatMessage.message_id == message_id)\
            .update({"cluster_id": cluster_id})
        db.commit()
        print("✅ Cluster id updated in database")
    except Exception as e:
        print(f"⚠️ Error in background clustering: {e}")
        db.rollback()
    finally:
        db.close()

@router.post("/send_message")
def send_message(request: SendMessageRequest, db: Session = Depends(get_db)):
    """Stores a user message, retrieves relevant context, and generates a bot response."""

    # ✅ Check if interaction exists
    interaction = db.query(Interaction).filter(Interaction.interaction_id == request.interaction_id).first()
    if not interaction:
        raise HTTPException(status_code=404, detail="Chat session not found")

    print("interaction_botid=>", interaction.bot_id)
    

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
    print("End interaction")
    interaction = db.query(Interaction).filter(Interaction.interaction_id == interaction_id).first()
    if not interaction:
        raise HTTPException(status_code=404, detail="Interaction not found")
    
    # Get the current UTC time
    utc_now = datetime.now(timezone.utc)
    interaction.end_time = utc_now
    print("interaction.end_time",interaction.end_time)
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
                .filter(ChatMessage.interaction.has(bot_id=bot_id))\
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