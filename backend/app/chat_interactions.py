from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Interaction, ChatMessage
from pydantic import BaseModel
from app.vector_db import retrieve_similar_docs
from app.chatbot import generate_response  

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

@router.post("/send_message")
def send_message(request: SendMessageRequest, db: Session = Depends(get_db)):
    """Stores a user message, retrieves relevant context, and generates a bot response."""

    # ✅ Check if interaction exists
    interaction = db.query(Interaction).filter(Interaction.interaction_id == request.interaction_id).first()
    if not interaction:
        raise HTTPException(status_code=404, detail="Chat session not found")

    # ✅ Store user message in the database
    user_message = ChatMessage(
        interaction_id=request.interaction_id,
        sender=request.sender,
        message_text=request.message_text
    )
    db.add(user_message)
    db.commit()

    # ✅ Retrieve context using vector database (ChromaDB)
    similar_docs = retrieve_similar_docs(interaction.bot_id, request.message_text)  # ✅ Pass bot_id as required
    context = " ".join([doc['text'] for doc in similar_docs]) if similar_docs else "No relevant documents found."

    # ✅ Generate chatbot response using OpenAI or an LLM
    bot_reply_dict = generate_response(
        bot_id=interaction.bot_id, 
        user_id=interaction.user_id, 
        user_message=request.message_text, 
        db=db  # ✅ Pass `db` session to `generate_response`
    )

    # ✅ Extract the actual response as a string
    bot_reply_text = bot_reply_dict["bot_reply"]  # ✅ Ensure we extract the correct value

    # ✅ Store bot response in the database
    bot_message = ChatMessage(
        interaction_id=request.interaction_id,
        sender="bot",
        message_text=bot_reply_text  # ✅ Now storing as a string
    )
    db.add(bot_message)
    db.commit()

    return {"message": bot_reply_text}



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