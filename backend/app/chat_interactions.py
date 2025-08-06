from typing import List
from chromadb import logger
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Bot, Interaction, ChatMessage, User, WordCloudData
from pydantic import BaseModel
from app.vector_db import retrieve_similar_docs
from app.chatbot import generate_response, is_greeting  
from datetime import datetime, timezone
from app.schemas import FAQResponse, WordCloudResponse
import threading 
from app.clustering import PGClusterer
from app.utils.logger import get_module_logger
from app.word_cloud_processor import WordCloudProcessor
from app.utils.ai_logger import (
    log_chat_completion, 
    log_document_retrieval, 
    log_llm_request, 
    log_llm_response,
    ai_logger
)
import time

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
    start_time = time.time()
    
    # ✅ Log initial request details
    ai_logger.info("Send message request initiated", extra={
        "ai_task": {
            "event_type": "send_message_request",
            "interaction_id": request.interaction_id,
            "sender": request.sender,
            "message_length": len(request.message_text),
            "message_preview": request.message_text[:100] + "..." if len(request.message_text) > 100 else request.message_text,
            "is_addon_message": request.is_addon_message
        }
    })

    # ✅ Check if interaction exists
    interaction = db.query(Interaction).filter(Interaction.interaction_id == request.interaction_id).first()
    if not interaction:
        ai_logger.error("Interaction not found", extra={
            "ai_task": {
                "event_type": "interaction_error",
                "interaction_id": request.interaction_id,
                "error": "Chat session not found"
            }
        })
        raise HTTPException(status_code=404, detail="Chat session not found")

    # ✅ Log interaction details found
    ai_logger.info("Interaction found", extra={
        "ai_task": {
            "event_type": "interaction_found",
            "interaction_id": request.interaction_id,
            "bot_id": interaction.bot_id,
            "user_id": interaction.user_id
        }
    })

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

    # ✅ Log message stored
    ai_logger.info("User message stored", extra={
        "ai_task": {
            "event_type": "message_stored",
            "message_id": user_message.message_id,
            "interaction_id": request.interaction_id,
            "sender": request.sender
        }
    })

    def is_greeting(msg):
        greetings = ["hi", "hello", "hey", "good morning", "good evening", "good afternoon", "how are you"]
        msg = msg.strip().lower()
        return msg in greetings

    # ✅ Start clustering in background thread if sender is user
    if request.sender.lower() == "user" and not is_greeting(request.message_text):
        ai_logger.info("Starting background clustering", extra={
            "ai_task": {
                "event_type": "clustering_initiated",
                "bot_id": interaction.bot_id,
                "message_id": user_message.message_id
            }
        })
        
        threading.Thread(
            target=async_cluster_question,
            args=(interaction.bot_id, request.message_text,user_message.message_id)
        ).start()

        print("Word cloud thread started")
        threading.Thread(
            target=async_update_word_cloud,
            args=(interaction.bot_id, request.message_text)
        ).start()
    else:
        ai_logger.info("Skipping clustering for greeting or bot message", extra={
            "ai_task": {
                "event_type": "clustering_skipped",
                "reason": "greeting_or_bot_message",
                "sender": request.sender,
                "is_greeting": is_greeting(request.message_text)
            }
        })
        

    # ✅ Log start of vector database retrieval
    ai_logger.info("Starting vector database retrieval", extra={
        "ai_task": {
            "event_type": "vector_retrieval_start",
            "bot_id": interaction.bot_id,
            "user_id": interaction.user_id,
            "query_text": request.message_text[:100] + "..." if len(request.message_text) > 100 else request.message_text
        }
    })

    # ✅ DEBUG: Test ChromaDB connection before retrieval
    try:
        from app.vector_db import get_chroma_client
        
        # ✅ Log attempt to get ChromaDB client
        ai_logger.info("Attempting to get ChromaDB client", extra={
            "ai_task": {
                "event_type": "chromadb_client_attempt",
                "bot_id": interaction.bot_id,
                "user_id": interaction.user_id
            }
        })
        
        test_client = get_chroma_client()
        
        # ✅ Check if client is None (shouldn't happen now)
        if test_client is None:
            raise Exception("get_chroma_client() returned None")
        
        # ✅ Log successful client creation
        ai_logger.info("ChromaDB client created successfully", extra={
            "ai_task": {
                "event_type": "chromadb_client_success",
                "bot_id": interaction.bot_id,
                "user_id": interaction.user_id,
                "client_type": str(type(test_client))
            }
        })
        
        all_collections = test_client.list_collections()
        
        # Safely get collection names
        if all_collections:
            if isinstance(all_collections[0], str):
                collection_names = all_collections
            else:
                collection_names = [col.name for col in all_collections]
        else:
            collection_names = []
        
        bot_collections = [name for name in collection_names if f"bot_{interaction.bot_id}_" in name]
        
        ai_logger.info("Pre-retrieval ChromaDB check", extra={
            "ai_task": {
                "event_type": "pre_retrieval_chromadb_check",
                "bot_id": interaction.bot_id,
                "user_id": interaction.user_id,
                "total_collections": len(collection_names),
                "bot_collections_found": bot_collections,
                "bot_collections_count": len(bot_collections),
                "chromadb_accessible": True
            }
        })
        
        # Clean up test client
        del test_client
        
    except Exception as test_e:
        ai_logger.error("Pre-retrieval ChromaDB check failed", extra={
            "ai_task": {
                "event_type": "pre_retrieval_chromadb_error", 
                "bot_id": interaction.bot_id,
                "user_id": interaction.user_id,
                "error": str(test_e),
                "error_type": type(test_e).__name__,
                "chromadb_accessible": False
            }
        })
        
        # ✅ Log the full exception details for debugging
        logger.error(f"Pre-retrieval ChromaDB check failed: {str(test_e)}")
        logger.error(f"Exception type: {type(test_e).__name__}")
        import traceback
        logger.error(f"Full traceback: {traceback.format_exc()}")

    # ✅ Retrieve context using vector database
    similar_docs = retrieve_similar_docs(interaction.bot_id, request.message_text, user_id=interaction.user_id)
    
    # ✅ Log vector database retrieval results
    ai_logger.info("Vector database retrieval completed", extra={
        "ai_task": {
            "event_type": "vector_retrieval_complete",
            "bot_id": interaction.bot_id,
            "user_id": interaction.user_id,
            "documents_found": len(similar_docs) if similar_docs else 0,
            "has_relevant_docs": bool(similar_docs)
        }
    })

    if similar_docs:
        # ✅ Log details about retrieved documents
        doc_details = []
        for i, doc in enumerate(similar_docs[:3]):  # Log first 3 docs
            doc_detail = {
                "index": i,
                "score": doc.get("score", 0),
                "content_length": len(doc.get("content", "")),
                "content_preview": doc.get("content", "")[:50] + "..." if len(doc.get("content", "")) > 50 else doc.get("content", ""),
                "metadata": doc.get("metadata", {})
            }
            doc_details.append(doc_detail)
            print("doc_detail=>",doc_detail)
        
        ai_logger.info("Retrieved document details", extra={
            "ai_task": {
                "event_type": "retrieved_documents_details",
                "bot_id": interaction.bot_id,
                "user_id": interaction.user_id,
                "documents": doc_details
            }
        })

    context = " ".join([doc.get('content', '') for doc in similar_docs]) if similar_docs else "No relevant documents found."
    
    # ✅ Log context preparation
    ai_logger.info("Context prepared for LLM", extra={
        "ai_task": {
            "event_type": "context_prepared", 
            "bot_id": interaction.bot_id,
            "user_id": interaction.user_id,
            "context_length": len(context),
            "context_preview": context[:150] + "..." if len(context) > 150 else context,
            "has_relevant_context": "No relevant documents found" not in context
        }
    })

    # ✅ Log start of LLM generation
    ai_logger.info("Starting LLM response generation", extra={
        "ai_task": {
            "event_type": "llm_generation_start",
            "bot_id": interaction.bot_id,
            "user_id": interaction.user_id,
            "user_message": request.message_text[:100] + "..." if len(request.message_text) > 100 else request.message_text,
            "context_provided": len(context) > 0
        }
    })

    # ✅ Generate chatbot response using LLM
    llm_start_time = time.time()
    bot_reply_dict = generate_response(
        bot_id=interaction.bot_id, 
        user_id=interaction.user_id, 
        user_message=request.message_text, 
        db=db
    )
    llm_duration = int((time.time() - llm_start_time) * 1000)

    # ✅ Extract actual response string
    bot_reply_text = bot_reply_dict["bot_reply"]
    
    # ✅ Parse response for formatting
    from app.utils.response_parser import parse_llm_response
    formatted_content = parse_llm_response(bot_reply_text)
    
    # ✅ Log LLM generation completion
    ai_logger.info("LLM response generation completed", extra={
        "ai_task": {
            "event_type": "llm_generation_complete",
            "bot_id": interaction.bot_id,
            "user_id": interaction.user_id,
            "response_length": len(bot_reply_text),
            "response_preview": bot_reply_text[:150] + "..." if len(bot_reply_text) > 150 else bot_reply_text,
            "generation_duration_ms": llm_duration,
            "success": True
        }
    })

    # ✅ Store bot response in DB
    bot_message = ChatMessage(
        interaction_id=request.interaction_id,
        sender="bot",
        message_text=bot_reply_text,
        not_answered=bot_reply_dict.get("not_answered", False)
    )
    db.add(bot_message)
    db.commit()

     # If bot couldn't answer, update the user question as well
    if bot_reply_dict.get("not_answered", False):
        db.query(ChatMessage)\
            .filter(ChatMessage.message_id == user_message.message_id)\
            .update({"not_answered": True})
        db.commit()

    # ✅ Log bot message stored
    ai_logger.info("Bot response stored", extra={
        "ai_task": {
            "event_type": "bot_response_stored",
            "message_id": bot_message.message_id,
            "interaction_id": request.interaction_id,
            "response_length": len(bot_reply_text)
        }
    })

    logger.debug("is_addon_message=> %s", request.is_addon_message)

    # ✅ Update message count in background
    if not request.is_addon_message:
        threading.Thread(
            target=update_message_counts,
            args=(interaction.bot_id, interaction.user_id)
        ).start()

    # ✅ Log complete chat completion
    total_duration = int((time.time() - start_time) * 1000)
    log_chat_completion(
        user_id=interaction.user_id,
        bot_id=interaction.bot_id,
        user_query=request.message_text,
        bot_response=bot_reply_text,
        similar_docs_count=len(similar_docs) if similar_docs else 0,
        interaction_id=request.interaction_id,
        extra={
            "total_duration_ms": total_duration,
            "llm_duration_ms": llm_duration,
            "sender": request.sender,
            "is_addon_message": request.is_addon_message,
            "message_id": bot_message.message_id,
            "user_message_id": user_message.message_id
        }
    )
  
    document_sources = []
    
    # Only show sources if:
    # 1. Not a greeting
    # 2. Not a default "no answer" response
    # 3. We have similar docs
    if (not is_greeting(request.message_text) and 
       not bot_reply_dict.get("is_default_response", False) and
       similar_docs):
        
        highest_score_doc = max(similar_docs, key=lambda x: x.get('score', 0))
        metadata = highest_score_doc.get('metadata', {})
        
        document_sources.append({
            'source': metadata.get('source', 'Unknown source'),
            'file_name': metadata.get('file_name', 'Unknown source'),
            'website_url': metadata.get('website_url', 'Unknown source'),
            'url': metadata.get('url', 'Unknown source')
        })

    return {
        "message": bot_reply_text,
        "message_id": bot_message.message_id,
        "formatted_content": formatted_content,
        "sources": document_sources,
        "is_greeting": is_greeting(request.message_text)
    }
   
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
    
@router.get("/bot_questions/{bot_id}")
def get_bot_questions(bot_id: int, db: Session = Depends(get_db)):
    """Get unique non-greeting questions asked to a bot (case-insensitive duplicates removed)"""
    messages = db.query(ChatMessage)\
        .join(Interaction)\
        .filter(
            Interaction.bot_id == bot_id,
            ChatMessage.sender == "user"
        )\
        .all()

    unique_questions = {}
    
    for msg in messages:
        msg_text = msg.message_text.strip()
        if msg_text:  # Only process non-empty messages
            # Check if it's not a greeting (case-insensitive)
            is_greet, _ = is_greeting(msg_text)
            if not is_greet:
                # Use lowercase as key to detect duplicates, but store original text
                lower_text = msg_text.lower()
                if lower_text not in unique_questions:
                    unique_questions[lower_text] = msg_text
    
    return {
        "questions": list(unique_questions.values()),
        "count": len(unique_questions)
    }


@router.get("/bot/unanswered_questions/{bot_id}")
def get_unanswered_questions(
    bot_id: int, 
    db: Session = Depends(get_db),
):
    """
    Get all unique unanswered user questions for a specific bot.
    Returns:
    - List of unique unanswered questions (case-insensitive duplicates removed)
    - Count of unique questions
    """
    skip_greetings = True
    # Query to get all unanswered user messages for the bot
    messages = db.query(ChatMessage)\
        .join(Interaction, ChatMessage.interaction_id == Interaction.interaction_id)\
        .filter(
            Interaction.bot_id == bot_id,
            ChatMessage.sender == "user",
            ChatMessage.not_answered == True
        )\
        .all()

    unique_questions = {}
    
    for msg in messages:
        msg_text = msg.message_text.strip()
        if msg_text:  # Only process non-empty messages
            # Skip greetings if enabled
            if skip_greetings:
                is_greet, _ = is_greeting(msg_text)
                if is_greet:
                    continue
            
            # Use lowercase as key to detect duplicates
            lower_text = msg_text.lower()
            if lower_text not in unique_questions:
                # Store original text but compare lowercase for duplicates
                unique_questions[lower_text] = {
                    "original_text": msg_text
                }
    
    # Prepare response
    response = {
        "questions": list(unique_questions.values())
    }
    return response