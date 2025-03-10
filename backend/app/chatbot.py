from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Interaction, ChatMessage
from app.vector_db import retrieve_similar_docs, add_document
import openai
import os
import pdfplumber
from app.utils.upload_knowledge_utils import extract_text_from_file,validate_and_store_text_in_ChromaDB
from app.youtube import store_videos_in_chroma

router = APIRouter(prefix="/chatbot", tags=["Chatbot"])

# Load OpenAI API key
openai.api_key = os.getenv("OPENAI_API_KEY")


@router.post("/ask")
def chatbot_response(bot_id: int, user_id: int, user_message: str, db: Session = Depends(get_db)):
    """Processes user queries, retrieves context, and generates responses using GPT."""

    # ✅ Ensure the chat session (interaction) exists
    interaction = db.query(Interaction).filter_by(bot_id=bot_id, user_id=user_id, archived=False).first()
    if not interaction:
        interaction = Interaction(bot_id=bot_id, user_id=user_id)
        db.add(interaction)
        db.commit()
        db.refresh(interaction)

    # ✅ Retrieve relevant documents from ChromaDB
    similar_docs = retrieve_similar_docs(bot_id, user_message)
    print(f"🔍 Retrieved Documents for Bot {bot_id}: {similar_docs}")

    # ✅ If no relevant documents are found, return a fallback response
    if not similar_docs or all(doc["text"].strip() == "" for doc in similar_docs):
        bot_reply = "I can only answer based on uploaded documents, but I don't have information on that topic."
    else:
        context = " ".join([doc["text"] for doc in similar_docs if doc["text"].strip()])
        try:
            response = openai.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": "You are a helpful chatbot. You should only answer based on the provided context. If the context does not contain relevant information, say you don't know."},
                    {"role": "user", "content": f"Context: {context}\nUser: {user_message}\nBot:"}
                ],
                temperature=0.7,
                max_tokens=150
            )
            bot_reply = response.choices[0].message.content
        except Exception as e:
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
    """Generates a chatbot response using OpenAI GPT based on uploaded knowledge only."""

    # ✅ Ensure the chat session (interaction) exists
    interaction = db.query(Interaction).filter_by(bot_id=bot_id, user_id=user_id, archived=False).first()
    if not interaction:
        interaction = Interaction(bot_id=bot_id, user_id=user_id)
        db.add(interaction)
        db.commit()
        db.refresh(interaction)

    # ✅ Retrieve relevant documents from ChromaDB
    similar_docs = retrieve_similar_docs(bot_id, user_message)
    print(f"🔍 Retrieved Documents for Bot {bot_id}: {similar_docs}")

    # ✅ If no relevant documents are found, return a fallback response
    if not similar_docs or all(doc["text"].strip() == "" for doc in similar_docs):
        bot_reply = "I can only answer based on uploaded documents, but I don't have information on that topic."
    else:
        context = " ".join([doc["text"] for doc in similar_docs if doc["text"].strip()])
        try:
            response = openai.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": "You are a helpful chatbot. You should only answer based on the provided context. If the context does not contain relevant information, say you don't know."},
                    {"role": "user", "content": f"Context: {context}\nUser: {user_message}\nBot:"}
                ],
                temperature=0.7,
                max_tokens=150
            )
            bot_reply = response.choices[0].message.content
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Chatbot error: {str(e)}")

    # ✅ Store both user message & bot reply in `chat_messages` table
    user_msg = ChatMessage(interaction_id=interaction.interaction_id, sender="user", message_text=user_message)
    bot_msg = ChatMessage(interaction_id=interaction.interaction_id, sender="bot", message_text=bot_reply)

    db.add_all([user_msg, bot_msg])
    db.commit()

    return {"bot_reply": bot_reply}


@router.post("/process_youtube")
def process_youtube(bot_id: int, channel_url: str, db: Session = Depends(get_db)):
    """Extracts video transcripts from a YouTube channel and stores them in ChromaDB for the bot."""

    if not channel_url.startswith("https://www.youtube.com/"):
        raise HTTPException(status_code=400, detail="Invalid YouTube channel URL.")
    
    result = store_videos_in_chroma(bot_id, channel_url)
    return result

