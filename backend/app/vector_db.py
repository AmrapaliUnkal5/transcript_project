import chromadb
from langchain_openai import OpenAIEmbeddings  # Updated OpenAI import
from langchain_community.vectorstores import Chroma  # Updated ChromaDB import
import os
from dotenv import load_dotenv

load_dotenv()  # ✅ Load .env file

api_key = os.getenv("OPENAI_API_KEY")  # ✅ Read API key

if not api_key:
    raise ValueError("OPENAI_API_KEY is not set in the environment variables!")

# Initialize ChromaDB Client
chroma_client = chromadb.PersistentClient(path="./chromadb_store")

# Initialize OpenAI Embeddings (Replace with your OpenAI API key)

embedding_function = OpenAIEmbeddings(openai_api_key=api_key)

# Create or load an existing ChromaDB collection
collection = chroma_client.get_or_create_collection(name="chatbot_knowledge")

def add_document(bot_id: int, text: str, metadata: dict):
    """Adds a document to a bot-specific vector database in ChromaDB."""
    if not text.strip():
        print(f"⚠️ Skipping empty document for bot {bot_id}: {metadata['id']}")
        return  # Skip empty documents

    # ✅ Create a unique collection for each bot
    collection_name = f"bot_{bot_id}"
    bot_collection = chroma_client.get_or_create_collection(name=collection_name)

    # ✅ Generate embeddings
    vector = embedding_function.embed_documents([text])[0]  

    # ✅ Store the document in ChromaDB
    bot_collection.add(
        ids=[metadata["id"]],
        embeddings=[vector],
        metadatas=[metadata],
        documents=[text]  # Store the document text
    )

    print(f"✅ Document added to bot {bot_id}: {metadata['id']}")

def retrieve_similar_docs(bot_id: int, query_text: str, top_k=3):
    """Retrieves similar documents from the bot-specific vector database."""
    
    collection_name = f"bot_{bot_id}"
    bot_collection = chroma_client.get_or_create_collection(name=collection_name)

    query_vector = embedding_function.embed_query(query_text)

    results = bot_collection.query(query_embeddings=[query_vector], n_results=top_k)

    print(f"🔍 Query Results for Bot {bot_id}: {results}")

    if results and "documents" in results and results["documents"]:
        return [{"text": text} for text in results["documents"][0] if text]

    return []

