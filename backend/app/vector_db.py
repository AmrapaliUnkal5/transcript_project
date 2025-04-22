import chromadb
from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import Chroma
import os
from dotenv import load_dotenv
from app.embedding_manager import EmbeddingManager
from app.database import SessionLocal
from app.models import Bot, EmbeddingModel

load_dotenv()

api_key = os.getenv("OPENAI_API_KEY")

if not api_key:
    raise ValueError("OPENAI_API_KEY is not set in the environment variables!")

# Initialize ChromaDB Client
chroma_client = chromadb.PersistentClient(path="./chromadb_store")


def add_document(bot_id: int, text: str, metadata: dict, force_model: str = None):
    """Adds a document to a bot-specific vector database in ChromaDB."""
    print(f"\n🔄 Starting document addition process for bot {bot_id}")
    print(f"📄 Document metadata: {metadata}")
    
    if not text.strip():
        print(f"⚠️ Skipping empty document for bot {bot_id}: {metadata['id']}")
        return

    try:
        # If force_model is provided, use it (for re-embedding)
        if force_model:
            model_name = force_model
            print(f"🔧 Using forced model name: {model_name}")
        else:
            # Otherwise, get from DB (normal case)
            print(f"🔍 Getting bot configuration for bot_id: {bot_id}")
            model_name = get_bot_config(bot_id)
            
        print(f"📊 Using embedding model: {model_name}")
        
        # Initialize embedding manager first to validate the model
        print("🤖 Initializing embedding manager")
        embedder = EmbeddingManager(model_name)
        
        # Test the embedder with a small piece of text before proceeding
        try:
            test_embedding = embedder.embed_query("test")
            if not test_embedding:
                raise ValueError("Failed to generate test embedding")
            
            # Get the embedding dimension from the test
            embedding_dimension = len(test_embedding)
            print(f"📐 Embedding dimension: {embedding_dimension}")
            
        except Exception as e:
            error_msg = f"Failed to initialize embedder for model {model_name}: {str(e)}"
            print(f"❌ {error_msg}")
            # You might want to log this error or notify admin
            raise ValueError(error_msg)
        
        # Sanitize model name for collection name
        sanitized_model_name = model_name.replace("/", "_").replace(".", "_").replace("-", "_")
        base_collection_name = f"bot_{bot_id}_{sanitized_model_name}"
        
        # Check if this is a re-embedding process by looking at metadata
        is_reembedding = metadata.get("source") == "re-embed"
        
        # For re-embedding, use the temp_collection name if provided
        if is_reembedding and metadata.get("temp_collection"):
            collection_name = metadata.get("temp_collection")
            print(f"🔄 This is a re-embedding process. Using provided collection: {collection_name}")
        else:
            # Normal document addition (not re-embedding)
            # First check if there are timestamped collections for this model
            try:
                collections = chroma_client.list_collections()
                collection_names = collections  # Already just names in v0.6.0+

                # Find timestamped collections for this model (sorted by timestamp, most recent first)
                timestamped_collections = [
                    name for name in collection_names
                    if name.startswith(base_collection_name + "_")
                ]
                
                if timestamped_collections:
                    # Sort to get most recent first
                    timestamped_collections.sort(reverse=True)
                    collection_name = timestamped_collections[0]
                    print(f"📚 Found existing timestamped collection, using most recent: {collection_name}")
                else:
                    # No timestamped collections, try to use base collection
                    try:
                        existing_collection = chroma_client.get_collection(name=base_collection_name)
                        if existing_collection.count() > 0:
                            # Test dimension compatibility
                            try:
                                result = existing_collection.query(
                                    query_embeddings=[[0.0] * embedding_dimension],
                                    n_results=1,
                                    include=['embeddings']
                                )
                                
                                if result['embeddings'][0]:
                                    existing_dimension = len(result['embeddings'][0][0])
                                    print(f"📐 Existing collection dimension: {existing_dimension}")
                                    
                                    if existing_dimension != embedding_dimension:
                                        print(f"⚠️ Dimension mismatch! Old: {existing_dimension}, New: {embedding_dimension}")
                                        raise ValueError(f"Embedding dimension {embedding_dimension} does not match collection dimensionality {existing_dimension}")
                            except Exception as e:
                                print(f"❌ Error checking collection dimensions: {str(e)}")
                                raise e
                        collection_name = base_collection_name
                        print(f"📚 Using base collection: {collection_name}")
                    except Exception as e:
                        if "not found" in str(e).lower():
                            # Collection doesn't exist, create it
                            collection_name = base_collection_name
                            print(f"📚 Creating new base collection: {collection_name}")
                        else:
                            # Other error
                            print(f"❌ Error accessing collection: {str(e)}")
                            raise e
            except Exception as e:
                print(f"❌ Error checking for existing collections: {str(e)}")
                # Fallback to base collection name
                collection_name = base_collection_name
                print(f"📚 Falling back to base collection name: {collection_name}")
        
        print("📥 Getting or creating ChromaDB collection")
        bot_collection = chroma_client.get_or_create_collection(
            name=collection_name,
            embedding_function=None  # We'll provide our own embeddings
        )
        print(f"✅ Collection status: {'Created' if bot_collection.count() == 0 else 'Existing'}")

        print("🔄 Generating document embedding")
        vector = embedder.embed_document(text)
        if not vector:
            raise ValueError("Failed to generate document embedding")
            
        print(f"✅ Embedding generated successfully. Vector length: {len(vector)}")

        print("💾 Adding document to ChromaDB collection")
        bot_collection.add(
            ids=[metadata["id"]],
            embeddings=[vector],
            metadatas=[metadata],
            documents=[text]
        )
        print(f"✅ Document added successfully to collection")
        print(f"📊 Collection count after addition: {bot_collection.count()}")

        print(f"✨ Document addition completed for bot {bot_id}: {metadata['id']}\n")
        
    except Exception as e:
        error_msg = f"Error processing document for bot {bot_id}: {str(e)}"
        print(f"❌ {error_msg}")
        # You might want to log this error or notify admin
        raise ValueError(error_msg)


def retrieve_similar_docs(bot_id: int, query_text: str, top_k=5):
    """Retrieves similar documents for a query from a bot-specific vector database in ChromaDB."""
    print(f"\n🔍 Starting similarity search for bot {bot_id}")
    print(f"🔎 Query: {query_text}")
    
    try:
        print(f"🔍 Getting bot configuration for bot_id: {bot_id}")
        model_name = get_bot_config(bot_id)
        print(f"📊 Using embedding model: {model_name}")
        
        # Initialize embedding manager
        print("🤖 Initializing embedding manager")
        try:
            embedder = EmbeddingManager(model_name)
        except Exception as e:
            print(f"❌ Error initializing embedder: {str(e)}")
            # Try to find any previous collection for this bot
            print("⚠️ Falling back to any available collection for this bot")
            return fallback_retrieve_similar_docs(bot_id, query_text, top_k)
        
        # Get embedding for query
        print("🔄 Generating query embedding")
        try:
            query_embedding = embedder.embed_query(query_text)
        except Exception as e:
            print(f"❌ Error generating query embedding: {str(e)}")
            return fallback_retrieve_similar_docs(bot_id, query_text, top_k)
        
        # Get the embedding dimension
        embedding_dimension = len(query_embedding)
        print(f"📐 Query embedding dimension: {embedding_dimension}")
        
        # Sanitize model name for ChromaDB collection naming requirements
        sanitized_model_name = model_name.replace("/", "_").replace(".", "_").replace("-", "_")
        base_collection_name = f"bot_{bot_id}_{sanitized_model_name}"
        
        # List all collections to find the appropriate one
        collections = chroma_client.list_collections()
        
        # In ChromaDB v0.6.0+, list_collections() returns collection names as strings
        collection_names = collections  # Already just names in v0.6.0+
        
        # First, look for a base collection with this model name
        if base_collection_name in collection_names:
            try:
                # Try to use the base collection
                bot_collection = chroma_client.get_collection(name=base_collection_name)
                
                # Check if it has documents
                if bot_collection.count() > 0:
                    print(f"✅ Using base collection: {base_collection_name}")
                    collection_name = base_collection_name
                else:
                    print(f"⚠️ Base collection {base_collection_name} is empty, looking for alternatives")
                    return fallback_retrieve_similar_docs(bot_id, query_text, top_k)
            except Exception as e:
                print(f"❌ Error with base collection: {str(e)}")
                return fallback_retrieve_similar_docs(bot_id, query_text, top_k)
        else:
            # Look for timestamped collections for this model
            model_collections = [
                name for name in collection_names 
                if name.startswith(base_collection_name + "_")
            ]
            
            if model_collections:
                # Sort collections by timestamp (descending) to get the most recent one
                model_collections.sort(reverse=True)
                collection_name = model_collections[0]
                print(f"✅ Using most recent collection for model: {collection_name}")
            else:
                # No collection found for this model, try fallback
                print(f"⚠️ No collection found for model {model_name}, falling back to any available collection")
                return fallback_retrieve_similar_docs(bot_id, query_text, top_k)
        
        # Query the collection
        try:
            bot_collection = chroma_client.get_collection(name=collection_name)
            print(f"✅ Collection has {bot_collection.count()} documents")
            
            # Run the query
            results = bot_collection.query(
                query_embeddings=[query_embedding],
                n_results=min(top_k, bot_collection.count()),
                include=["documents", "metadatas", "distances"]
            )
            
            # Process and return results
            docs = []
            if results["documents"] and len(results["documents"]) > 0 and len(results["documents"][0]) > 0:
                print(f"✅ Found {len(results['documents'][0])} matching documents")
                for i, doc in enumerate(results["documents"][0]):
                    metadata = results["metadatas"][0][i]
                    distance = results["distances"][0][i]
                    score = 1.0 - distance  # Convert distance to similarity score
                    docs.append({
                        "content": doc,
                        "metadata": metadata,
                        "score": score
                    })
                    print(f"📄 Match {i+1}: Score {score:.4f}, Source: {metadata.get('file_name', 'unknown')}")
            else:
                print("⚠️ No documents returned from query")
            
            return docs
            
        except Exception as e:
            print(f"❌ Error querying collection: {str(e)}")
            if "dimension" in str(e).lower():
                print(f"⚠️ Dimension mismatch error, trying fallback")
            return fallback_retrieve_similar_docs(bot_id, query_text, top_k)
            
    except Exception as e:
        error_msg = f"Error retrieving similar docs for bot {bot_id}: {str(e)}"
        print(f"❌ {error_msg}")
        return []


def fallback_retrieve_similar_docs(bot_id: int, query_text: str, top_k=5):
    """Fallback method to retrieve documents from any available collection for this bot."""
    print(f"🔄 Attempting fallback retrieval for bot {bot_id}")
    
    try:
        # List all collections
        collections = chroma_client.list_collections()
        # In ChromaDB v0.6.0+, list_collections() returns collection names as strings
        collection_names = collections  # Already just names in v0.6.0+
        
        # Find all collections for this bot
        bot_collections = [name for name in collection_names if f"bot_{bot_id}_" in name]
        
        if not bot_collections:
            print(f"⚠️ No collections found for bot {bot_id}")
            return []
            
        print(f"📚 Found collections for bot {bot_id}: {bot_collections}")
        
        # Try Hugging Face embedding as fallback for query
        from app.embedding_manager import HuggingFaceAPIEmbedder
        from app.config import settings
        
        print("🔄 Using Hugging Face embeddings as fallback for query")
        huggingface_api_key = settings.HUGGINGFACE_API_KEY
        if not huggingface_api_key:
            print("❌ No HuggingFace API key found")
            return []
            
        hf_embedder = HuggingFaceAPIEmbedder("BAAI/bge-large-en-v1.5", huggingface_api_key)
        
        # Try collections one by one until we find one that works
        for collection_name in bot_collections:
            try:
                print(f"🔍 Trying collection: {collection_name}")
                collection = chroma_client.get_collection(name=collection_name)
                
                if collection.count() == 0:
                    print(f"⚠️ Collection {collection_name} is empty, skipping")
                    continue
                
                # Use a safer approach to determine the dimension
                # Get the embeddings dimensions using a test query with minimal data size
                try:
                    # First, try with a reasonable default (1024 for BAAI/bge-large-en-v1.5)
                    expected_dimension = 1024
                    
                    # Create a zeros array of the expected dimension
                    zeros_query = [0.0] * expected_dimension
                    
                    # Try querying with this array to get the collection's dimension
                    sample_result = collection.query(
                        query_embeddings=[zeros_query],
                        n_results=1,
                        include=["embeddings"]
                    )
                    
                    # Check if we got a valid result with embeddings
                    if sample_result and "embeddings" in sample_result and sample_result["embeddings"]:
                        if len(sample_result["embeddings"]) > 0 and len(sample_result["embeddings"][0]) > 0:
                            dimension = len(sample_result["embeddings"][0][0])
                            print(f"📐 Collection dimension: {dimension}")
                        else:
                            print(f"⚠️ No embeddings returned from collection {collection_name}, skipping")
                            continue
                    else:
                        print(f"⚠️ Invalid response from collection {collection_name}, skipping")
                        continue
                    
                except Exception as e:
                    # If the dimension doesn't match, we'll get an error
                    print(f"⚠️ Error determining dimension: {str(e)}")
                    
                    # Try a different approach - use the error message to extract the dimension
                    error_str = str(e)
                    if "dimension" in error_str.lower():
                        # Try to extract the dimension from error message like "Embedding dimension X does not match Y"
                        import re
                        dimension_match = re.search(r'dimension (\d+)', error_str)
                        if dimension_match:
                            dimension = int(dimension_match.group(1))
                            print(f"📐 Collection dimension from error: {dimension}")
                        else:
                            print(f"⚠️ Could not determine dimension for {collection_name}, skipping")
                            continue
                    else:
                        print(f"⚠️ Unknown error with collection {collection_name}, skipping")
                        continue
                
                # Get query embedding with matching dimensions
                query_embedding = hf_embedder.embed_query(query_text)
                
                # Now, query the collection
                try:
                    if len(query_embedding) != dimension:
                        print(f"⚠️ Dimension mismatch: Query {len(query_embedding)} vs Collection {dimension}")
                        continue
                    
                    results = collection.query(
                        query_embeddings=[query_embedding],
                        n_results=top_k,
                        include=["documents", "metadatas", "distances"]
                    )
                    
                    # Process results
                    docs = []
                    
                    # Check if there are any documents returned
                    if (results and 
                        "documents" in results and 
                        results["documents"] and 
                        len(results["documents"]) > 0 and 
                        len(results["documents"][0]) > 0):
                        
                        print(f"✅ Found {len(results['documents'][0])} matching documents in {collection_name}")
                        
                        for i, doc in enumerate(results["documents"][0]):
                            metadata = results["metadatas"][0][i] if "metadatas" in results and results["metadatas"] and i < len(results["metadatas"][0]) else {}
                            distance = results["distances"][0][i] if "distances" in results and results["distances"] and i < len(results["distances"][0]) else 1.0
                            score = 1.0 - distance
                            docs.append({
                                "content": doc,
                                "metadata": metadata,
                                "score": score
                            })
                            print(f"📄 Match {i+1}: Score {score:.4f}, Source: {metadata.get('file_name', 'unknown')}")
                        
                        if docs:
                            print(f"✅ Successfully retrieved documents from fallback collection: {collection_name}")
                            return docs
                    else:
                        print(f"⚠️ No matching documents found in {collection_name}")
                        
                except Exception as e:
                    print(f"⚠️ Error querying collection {collection_name}: {str(e)}")
                    continue
                    
            except Exception as e:
                print(f"⚠️ Error with collection {collection_name}: {str(e)}")
                continue
        
        print("❌ All fallback attempts failed")
        return []
        
    except Exception as e:
        print(f"❌ Error in fallback retrieval: {str(e)}")
        return []


def get_bot_config(bot_id: int) -> str:
    """Returns the embedding model name for the bot."""
    db = SessionLocal()
    try:
        bot = db.query(Bot).filter(Bot.bot_id == bot_id).first()
        
        if not bot:
            print(f"⚠️ Bot with ID {bot_id} not found")
            return "BAAI/bge-large-en-v1.5"  # Default fallback
            
        if not bot.embedding_model:
            print(f"⚠️ Bot {bot_id} has no embedding model assigned, using default")
            # Try to find a default model from the database
            default_model = db.query(EmbeddingModel).filter(
                EmbeddingModel.provider == "huggingface",
                EmbeddingModel.model_name == "BAAI/bge-large-en-v1.5",
                EmbeddingModel.is_active == True
            ).first()
            
            if default_model:
                print(f"✅ Using default model from database: {default_model.name}")
                return default_model.name
            else:
                return db.query(EmbeddingModel).filter(
                    EmbeddingModel.provider == "huggingface",
                    EmbeddingModel.is_active == True
                ).first().name
        
        # Return the model name from the relationship
        model_name = bot.embedding_model.name
        print(f"✅ Using embedding model for bot {bot_id}: {model_name}")
        return model_name
    except Exception as e:
        print(f"❌ Error getting bot config: {str(e)}")
        return "BAAI/bge-large-en-v1.5"  # Default fallback in case of error
    finally:
        db.close()


def delete_document_from_chroma(bot_id: int, file_id: str):
    """Deletes documents related to a specific file from ChromaDB."""
    print(f"\n🗑️ Starting document deletion process for bot {bot_id}, file_id {file_id}")
    
    try:
        # List all collections
        collections = chroma_client.list_collections()
        
        # Find all collections for this bot
        bot_collections = [name for name in collections if f"bot_{bot_id}_" in name]
        
        if not bot_collections:
            print(f"⚠️ No collections found for bot {bot_id}")
            return
            
        print(f"📚 Found collections for bot {bot_id}: {bot_collections}")
        
        file_id_str = str(file_id)
        
        # Try each collection and delete documents with matching file_id
        for collection_name in bot_collections:
            try:
                print(f"🔍 Checking collection: {collection_name}")
                collection = chroma_client.get_collection(name=collection_name)
                
                if collection.count() == 0:
                    print(f"⚠️ Collection {collection_name} is empty, skipping")
                    continue
                
                # Query to find document IDs with the given file ID in metadata
                try:
                    # First, get all documents and their metadata
                    results = collection.get(
                        where={"file_id": file_id_str},
                        include=["metadatas", "documents"]
                    )
                    
                    if results["ids"] and len(results["ids"]) > 0:
                        print(f"✅ Found {len(results['ids'])} documents to delete in {collection_name}")
                        
                        # Delete the documents
                        collection.delete(ids=results["ids"])
                        print(f"✅ Successfully deleted {len(results['ids'])} documents from {collection_name}")
                    else:
                        print(f"ℹ️ No documents found with file_id {file_id} in {collection_name}")
                        
                except Exception as e:
                    print(f"⚠️ Error querying collection {collection_name}: {str(e)}")
                    continue
                    
            except Exception as e:
                print(f"⚠️ Error with collection {collection_name}: {str(e)}")
                continue
        
        print(f"✅ Document deletion process completed for bot {bot_id}, file_id {file_id}\n")
        return True
    except Exception as e:
        error_msg = f"Error deleting documents from ChromaDB for bot {bot_id}, file_id {file_id}: {str(e)}"
        print(f"❌ {error_msg}")
        return False


def delete_video_from_chroma(bot_id: int, video_id: str):
    """Deletes documents related to a specific YouTube video from ChromaDB."""
    print(f"\n🗑️ Starting video document deletion process for bot {bot_id}, video_id {video_id}")
    
    try:
        # List all collections
        collections = chroma_client.list_collections()
        
        # Find all collections for this bot
        bot_collections = [name for name in collections if f"bot_{bot_id}_" in name]
        
        if not bot_collections:
            print(f"⚠️ No collections found for bot {bot_id}")
            return
            
        print(f"📚 Found collections for bot {bot_id}: {bot_collections}")
        
        # Try each collection and delete documents with matching video_id
        for collection_name in bot_collections:
            try:
                print(f"🔍 Checking collection: {collection_name}")
                collection = chroma_client.get_collection(name=collection_name)
                
                if collection.count() == 0:
                    print(f"⚠️ Collection {collection_name} is empty, skipping")
                    continue
                
                # Query to find document IDs with the given video ID in metadata
                try:
                    # First, get all documents and their metadata
                    results = collection.get(
                        where={"video_id": video_id},
                        include=["metadatas", "documents"]
                    )
                    
                    if results["ids"] and len(results["ids"]) > 0:
                        print(f"✅ Found {len(results['ids'])} documents to delete in {collection_name}")
                        
                        # Delete the documents
                        collection.delete(ids=results["ids"])
                        print(f"✅ Successfully deleted {len(results['ids'])} documents from {collection_name}")
                    else:
                        print(f"ℹ️ No documents found with video_id {video_id} in {collection_name}")
                        
                except Exception as e:
                    print(f"⚠️ Error querying collection {collection_name}: {str(e)}")
                    continue
                    
            except Exception as e:
                print(f"⚠️ Error with collection {collection_name}: {str(e)}")
                continue
        
        print(f"✅ Video document deletion process completed for bot {bot_id}, video_id {video_id}\n")
        return True
    except Exception as e:
        error_msg = f"Error deleting video documents from ChromaDB for bot {bot_id}, video_id {video_id}: {str(e)}"
        print(f"❌ {error_msg}")
        return False


def delete_url_from_chroma(bot_id: int, url: str):
    """Deletes documents related to a specific scraped URL from ChromaDB."""
    print(f"\n🗑️ Starting URL document deletion process for bot {bot_id}, url {url}")
    
    try:
        # List all collections
        collections = chroma_client.list_collections()
        
        # Find all collections for this bot
        bot_collections = [name for name in collections if f"bot_{bot_id}_" in name]
        
        if not bot_collections:
            print(f"⚠️ No collections found for bot {bot_id}")
            return
            
        print(f"📚 Found collections for bot {bot_id}: {bot_collections}")
        
        # Try each collection and delete documents with matching URL
        for collection_name in bot_collections:
            try:
                print(f"🔍 Checking collection: {collection_name}")
                collection = chroma_client.get_collection(name=collection_name)
                
                if collection.count() == 0:
                    print(f"⚠️ Collection {collection_name} is empty, skipping")
                    continue
                
                # Query to find document IDs with the given URL in metadata
                try:
                    # First, get all documents and their metadata
                    results = collection.get(
                        where={"url": url},
                        include=["metadatas", "documents"]
                    )
                    
                    if results["ids"] and len(results["ids"]) > 0:
                        print(f"✅ Found {len(results['ids'])} documents to delete in {collection_name}")
                        
                        # Delete the documents
                        collection.delete(ids=results["ids"])
                        print(f"✅ Successfully deleted {len(results['ids'])} documents from {collection_name}")
                    else:
                        print(f"ℹ️ No documents found with url {url} in {collection_name}")
                        
                except Exception as e:
                    print(f"⚠️ Error querying collection {collection_name}: {str(e)}")
                    continue
                    
            except Exception as e:
                print(f"⚠️ Error with collection {collection_name}: {str(e)}")
                continue
        
        print(f"✅ URL document deletion process completed for bot {bot_id}, url {url}\n")
        return True
    except Exception as e:
        error_msg = f"Error deleting URL documents from ChromaDB for bot {bot_id}, url {url}: {str(e)}"
        print(f"❌ {error_msg}")
        return False
