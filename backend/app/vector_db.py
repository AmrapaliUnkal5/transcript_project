import chromadb
from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import Chroma
import os
from dotenv import load_dotenv
from app.embedding_manager import EmbeddingManager
from app.database import SessionLocal
from app.models import Bot, EmbeddingModel, UserSubscription, SubscriptionPlan
from app.utils.logger import get_module_logger
from app.config import settings

# Initialize logger
logger = get_module_logger(__name__)

load_dotenv()

# Use settings object instead of direct environment access
api_key = settings.OPENAI_API_KEY

if not api_key:
    logger.critical("OPENAI_API_KEY is not configured in settings")
    raise ValueError("OPENAI_API_KEY is not set in configuration!")

# Initialize ChromaDB Client
chroma_client = chromadb.PersistentClient(path="./chromadb_store")


def add_document(bot_id: int, text: str, metadata: dict, force_model: str = None, user_id: int = None):
    """Adds a document to a bot-specific vector database in ChromaDB."""
    logger.info(f"Adding document to vector database", 
               extra={"bot_id": bot_id, "document_id": metadata.get('id', 'unknown'),
                     "document_type": metadata.get('source', 'unknown')})
    
    try:
        # If force_model is provided, use it (for re-embedding)
        if force_model:
            model_name = force_model
            logger.info(f"Using forced embedding model", 
                       extra={"bot_id": bot_id, "model_name": model_name})
            # Initialize embedding manager with forced model
            embedder = EmbeddingManager(model_name=model_name)
        else:
            # Otherwise, use the model selection utility if user_id is provided
            if user_id:
                logger.debug(f"Using model selection based on user subscription", 
                           extra={"bot_id": bot_id, "user_id": user_id})
                embedder = EmbeddingManager(bot_id=bot_id, user_id=user_id)
                model_name = embedder.model_name
                logger.info(f"Selected embedding model", 
                           extra={"bot_id": bot_id, "model_name": model_name})
            else:
                # Otherwise, get from DB (normal case)
                logger.debug(f"Getting bot configuration", extra={"bot_id": bot_id})
                model_name = get_bot_config(bot_id)
                logger.info(f"Using embedding model from bot config", 
                           extra={"bot_id": bot_id, "model_name": model_name})
                # Initialize embedding manager with model name
                embedder = EmbeddingManager(model_name=model_name)
        
        # Test the embedder with a small piece of text before proceeding
        try:
            test_embedding = embedder.embed_query("test")
            if not test_embedding:
                raise ValueError("Failed to generate test embedding")
            
            # Get the embedding dimension from the test
            embedding_dimension = len(test_embedding)
            logger.debug(f"Embedding dimension verified", 
                        extra={"bot_id": bot_id, "dimension": embedding_dimension})
            
        except Exception as e:
            error_msg = f"Failed to initialize embedder for model {model_name}: {str(e)}"
            logger.error(f"Embedding initialization failed", 
                         extra={"bot_id": bot_id, "model_name": model_name, 
                               "error": str(e)})
            raise ValueError(error_msg)
        
        # Sanitize model name for collection name
        sanitized_model_name = model_name.replace("/", "_").replace(".", "_").replace("-", "_")
        base_collection_name = f"bot_{bot_id}_{sanitized_model_name}"
        
        # Check if this is a re-embedding process by looking at metadata
        is_reembedding = metadata.get("source") == "re-embed"
        
        # For re-embedding, use the temp_collection name if provided
        if is_reembedding and metadata.get("temp_collection"):
            collection_name = metadata.get("temp_collection")
            logger.info(f"Using temporary collection for re-embedding", 
                       extra={"bot_id": bot_id, "collection": collection_name})
        else:
            # Normal document addition (not re-embedding)
            # First check if there are timestamped collections for this model
            try:
                collections = chroma_client.list_collections()
                
                # Handle both old and new ChromaDB API versions
                # Check if collections is a list of strings (new API) or objects with name attribute (old API)
                if collections and isinstance(collections, list):
                    if collections and hasattr(collections[0], 'name'):
                        # Old API (pre-0.6.0) - collections is a list of objects with name attribute
                        logger.debug("Using old ChromaDB API style (pre-0.6.0)")
                        collection_names = [collection.name for collection in collections]
                    else:
                        # New API (0.6.0+) - collections is already a list of strings
                        logger.debug("Using new ChromaDB API style (0.6.0+)")
                        collection_names = collections
                else:
                    logger.warning("Unexpected collections format from ChromaDB")
                    collection_names = []
                
                # Find timestamped collections for this model (sorted by timestamp, most recent first)
                timestamped_collections = [
                    name for name in collection_names
                    if name.startswith(base_collection_name + "_")
                ]
                
                if timestamped_collections:
                    # Sort to get most recent first
                    timestamped_collections.sort(reverse=True)
                    collection_name = timestamped_collections[0]
                    logger.info(f"Using most recent timestamped collection", 
                               extra={"bot_id": bot_id, "collection": collection_name})
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
                                
                                if result['embeddings'] and len(result['embeddings']) > 0 and len(result['embeddings'][0]) > 0:
                                    existing_dimension = len(result['embeddings'][0][0])
                                    logger.debug(f"Existing collection dimension", 
                                                extra={"bot_id": bot_id, "dimension": existing_dimension})
                                    
                                    if existing_dimension != embedding_dimension:
                                        logger.warning(f"Embedding dimension mismatch", 
                                                     extra={"bot_id": bot_id, 
                                                           "existing_dimension": existing_dimension, 
                                                           "new_dimension": embedding_dimension})
                                        raise ValueError(f"Embedding dimension {embedding_dimension} does not match collection dimensionality {existing_dimension}")
                            except Exception as e:
                                logger.error(f"Error checking collection dimensions", 
                                            extra={"bot_id": bot_id, "error": str(e)})
                                raise e
                        collection_name = base_collection_name
                        logger.info(f"Using base collection", 
                                   extra={"bot_id": bot_id, "collection": collection_name})
                    except Exception as e:
                        if "not found" in str(e).lower():
                            # Collection doesn't exist, create it
                            collection_name = base_collection_name
                            logger.info(f"Creating new base collection", 
                                       extra={"bot_id": bot_id, "collection": collection_name})
                        else:
                            # Other error
                            logger.error(f"Error accessing collection", 
                                        extra={"bot_id": bot_id, "error": str(e)})
                            raise e
            except Exception as e:
                logger.error(f"Error checking for existing collections", 
                            extra={"bot_id": bot_id, "error": str(e)})
                # Fallback to base collection name
                collection_name = base_collection_name
                logger.info(f"Falling back to base collection name", 
                           extra={"bot_id": bot_id, "collection": collection_name})
        
        logger.debug(f"Getting or creating ChromaDB collection", 
                    extra={"bot_id": bot_id, "collection": collection_name})
        bot_collection = chroma_client.get_or_create_collection(
            name=collection_name,
            embedding_function=None  # We'll provide our own embeddings
        )
        logger.debug(f"Collection status", 
                    extra={"bot_id": bot_id, "collection": collection_name, 
                          "is_new": bot_collection.count() == 0})

        logger.debug(f"Generating document embedding", 
                    extra={"bot_id": bot_id, "document_id": metadata.get('id', 'unknown')})
        vector = embedder.embed_document(text)
        if not vector:
            logger.error(f"Failed to generate document embedding", 
                        extra={"bot_id": bot_id, "document_id": metadata.get('id', 'unknown')})
            raise ValueError("Failed to generate document embedding")
            
        logger.debug(f"Embedding generated successfully", 
                    extra={"bot_id": bot_id, "vector_length": len(vector)})

        logger.debug(f"Adding document to ChromaDB collection", 
                    extra={"bot_id": bot_id, "collection": collection_name})
        bot_collection.add(
            ids=[metadata["id"]],
            embeddings=[vector],
            metadatas=[metadata],
            documents=[text]
        )
        logger.info(f"Document added successfully", 
                   extra={"bot_id": bot_id, "document_id": metadata.get('id', 'unknown'), 
                         "collection": collection_name, 
                         "collection_count": bot_collection.count()})
        
    except Exception as e:
        error_msg = f"Error processing document for bot {bot_id}: {str(e)}"
        logger.exception(f"Document addition failed", 
                        extra={"bot_id": bot_id, "document_id": metadata.get('id', 'unknown'), 
                              "error": str(e)})
        raise ValueError(error_msg)


def retrieve_similar_docs(bot_id: int, query_text: str, top_k=5, user_id: int = None):
    """Retrieves similar documents for a query from a bot-specific vector database in ChromaDB."""
    logger.info(f"Starting similarity search", 
               extra={"bot_id": bot_id, "query_length": len(query_text), 
                     "top_k": top_k})
    
    try:
        # Use model selection utility if user_id is provided
        if user_id:
            logger.debug(f"Using model selection based on user subscription", 
                       extra={"bot_id": bot_id, "user_id": user_id})
            embedder = EmbeddingManager(bot_id=bot_id, user_id=user_id)
            model_name = embedder.model_name
            logger.info(f"Selected embedding model", 
                       extra={"bot_id": bot_id, "model_name": model_name})
        else:
            # Otherwise get from bot config
            logger.debug(f"Getting bot configuration", 
                        extra={"bot_id": bot_id})
            model_name = get_bot_config(bot_id)
            logger.info(f"Using embedding model from bot config", 
                       extra={"bot_id": bot_id, "model_name": model_name})
            
            # Initialize embedding manager
            logger.debug(f"Initializing embedding manager", 
                        extra={"bot_id": bot_id, "model_name": model_name})
            try:
                embedder = EmbeddingManager(model_name=model_name)
            except Exception as e:
                logger.error(f"Error initializing embedder", 
                            extra={"bot_id": bot_id, "model_name": model_name, "error": str(e)})
                # Try to find any previous collection for this bot
                logger.warning(f"Falling back to any available collection", 
                              extra={"bot_id": bot_id})
                return fallback_retrieve_similar_docs(bot_id, query_text, top_k)
        
        # Get embedding for query
        logger.debug(f"Generating query embedding", 
                    extra={"bot_id": bot_id})
        try:
            query_embedding = embedder.embed_query(query_text)
        except Exception as e:
            logger.error(f"Error generating query embedding", 
                        extra={"bot_id": bot_id, "error": str(e)})
            return fallback_retrieve_similar_docs(bot_id, query_text, top_k)
        
        # Get the embedding dimension
        embedding_dimension = len(query_embedding)
        logger.debug(f"Query embedding dimension", 
                    extra={"bot_id": bot_id, "dimension": embedding_dimension})
        
        # Sanitize model name for ChromaDB collection naming requirements
        sanitized_model_name = model_name.replace("/", "_").replace(".", "_").replace("-", "_")
        base_collection_name = f"bot_{bot_id}_{sanitized_model_name}"
        
        # List all collections to find the appropriate one
        collections = chroma_client.list_collections()
        
        # Handle both old and new ChromaDB API versions
        # Check if collections is a list of strings (new API) or objects with name attribute (old API)
        if collections and isinstance(collections, list):
            if collections and hasattr(collections[0], 'name'):
                # Old API (pre-0.6.0) - collections is a list of objects with name attribute
                logger.debug("Using old ChromaDB API style (pre-0.6.0)")
                collection_names = [collection.name for collection in collections]
            else:
                # New API (0.6.0+) - collections is already a list of strings
                logger.debug("Using new ChromaDB API style (0.6.0+)")
                collection_names = collections
        else:
            logger.warning("Unexpected collections format from ChromaDB")
            collection_names = []
        
        # First, look for a base collection with this model name
        if base_collection_name in collection_names:
            try:
                # Try to use the base collection
                bot_collection = chroma_client.get_collection(name=base_collection_name)
                
                # Check if it has documents
                if bot_collection.count() > 0:
                    logger.info(f"Using base collection", 
                               extra={"bot_id": bot_id, "collection": base_collection_name})
                    collection_name = base_collection_name
                else:
                    logger.warning(f"Base collection {base_collection_name} is empty, looking for alternatives")
                    return fallback_retrieve_similar_docs(bot_id, query_text, top_k)
            except Exception as e:
                logger.error(f"Error with base collection", 
                            extra={"bot_id": bot_id, "error": str(e)})
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
                logger.info(f"Using most recent collection for model", 
                           extra={"bot_id": bot_id, "collection": collection_name})
            else:
                # No collection found for this model, try fallback
                logger.warning(f"No collection found for model {model_name}, falling back to any available collection")
                return fallback_retrieve_similar_docs(bot_id, query_text, top_k)
        
        # Query the collection
        try:
            bot_collection = chroma_client.get_collection(name=collection_name)
            logger.info(f"Collection has {bot_collection.count()} documents")
            
            # Run the query
            results = bot_collection.query(
                query_embeddings=[query_embedding],
                n_results=min(top_k, bot_collection.count()),
                include=["documents", "metadatas", "distances"]
            )
            
            # Process and return results
            docs = []
            if results["documents"] and len(results["documents"]) > 0 and len(results["documents"][0]) > 0:
                logger.info(f"Found {len(results['documents'][0])} matching documents")
                for i, doc in enumerate(results["documents"][0]):
                    metadata = results["metadatas"][0][i]
                    distance = results["distances"][0][i]
                    score = 1.0 - distance  # Convert distance to similarity score
                    docs.append({
                        "content": doc,
                        "metadata": metadata,
                        "score": score
                    })
                    logger.info(f"Match {i+1}: Score {score:.4f}, Source: {metadata.get('file_name', 'unknown')}")
            else:
                logger.warning("No documents returned from query")
            
            return docs
            
        except Exception as e:
            logger.error(f"Error querying collection", 
                        extra={"bot_id": bot_id, "error": str(e)})
            if "dimension" in str(e).lower():
                logger.warning(f"Dimension mismatch error, trying fallback")
            return fallback_retrieve_similar_docs(bot_id, query_text, top_k)
            
    except Exception as e:
        error_msg = f"Error retrieving similar docs for bot {bot_id}: {str(e)}"
        logger.exception(f"Similarity search failed", 
                        extra={"bot_id": bot_id, "error": str(e)})
        return []


def fallback_retrieve_similar_docs(bot_id: int, query_text: str, top_k=5):
    """Fallback method to retrieve documents from any available collection for this bot."""
    logger.info(f"Attempting fallback retrieval for bot {bot_id}")
    
    try:
        # List all collections
        collections = chroma_client.list_collections()
        
        # Handle both old and new ChromaDB API versions
        # Check if collections is a list of strings (new API) or objects with name attribute (old API)
        if collections and isinstance(collections, list):
            if collections and hasattr(collections[0], 'name'):
                # Old API (pre-0.6.0) - collections is a list of objects with name attribute
                logger.debug("Using old ChromaDB API style (pre-0.6.0)")
                bot_collections = [collection.name for collection in collections if f"bot_{bot_id}_" in collection.name]
            else:
                # New API (0.6.0+) - collections is already a list of strings
                logger.debug("Using new ChromaDB API style (0.6.0+)")
                bot_collections = [name for name in collections if f"bot_{bot_id}_" in name]
        else:
            logger.warning("Unexpected collections format from ChromaDB")
            bot_collections = []
        
        if not bot_collections:
            logger.warning(f"No collections found for bot {bot_id}")
            return []
            
        logger.info(f"Found collections for bot {bot_id}: {bot_collections}")
        
        # Try Hugging Face embedding as fallback for query
        from app.embedding_manager import HuggingFaceAPIEmbedder
        
        logger.info(f"Using Hugging Face embeddings as fallback for query")
        huggingface_api_key = settings.HUGGINGFACE_API_KEY
        if not huggingface_api_key:
            logger.warning(f"No HuggingFace API key found")
            return []
            
        hf_embedder = HuggingFaceAPIEmbedder("BAAI/bge-large-en-v1.5", huggingface_api_key)
        
        # Try collections one by one until we find one that works
        for collection_name in bot_collections:
            try:
                logger.info(f"Trying collection: {collection_name}")
                collection = chroma_client.get_collection(name=collection_name)
                
                if collection.count() == 0:
                    logger.warning(f"Collection {collection_name} is empty, skipping")
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
                            logger.debug(f"Collection dimension", 
                                        extra={"bot_id": bot_id, "dimension": dimension})
                        else:
                            logger.warning(f"No embeddings returned from collection {collection_name}, skipping")
                            continue
                    else:
                        logger.warning(f"Invalid response from collection {collection_name}, skipping")
                        continue
                    
                except Exception as e:
                    # If the dimension doesn't match, we'll get an error
                    logger.warning(f"Error determining dimension", 
                                  extra={"bot_id": bot_id, "error": str(e)})
                    
                    # Try a different approach - use the error message to extract the dimension
                    error_str = str(e)
                    if "dimension" in error_str.lower():
                        # Try to extract the dimension from error message like "Embedding dimension X does not match Y"
                        import re
                        dimension_match = re.search(r'dimension (\d+)', error_str)
                        if dimension_match:
                            dimension = int(dimension_match.group(1))
                            logger.debug(f"Collection dimension from error", 
                                        extra={"bot_id": bot_id, "dimension": dimension})
                        else:
                            logger.warning(f"Could not determine dimension for {collection_name}, skipping")
                            continue
                    else:
                        logger.warning(f"Unknown error with collection {collection_name}, skipping")
                        continue
                
                # Get query embedding with matching dimensions
                query_embedding = hf_embedder.embed_query(query_text)
                
                # Now, query the collection
                try:
                    if len(query_embedding) != dimension:
                        logger.warning(f"Dimension mismatch: Query {len(query_embedding)} vs Collection {dimension}")
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
                        
                        logger.info(f"Found {len(results['documents'][0])} matching documents in {collection_name}")
                        
                        for i, doc in enumerate(results["documents"][0]):
                            metadata = results["metadatas"][0][i] if "metadatas" in results and results["metadatas"] and i < len(results["metadatas"][0]) else {}
                            distance = results["distances"][0][i] if "distances" in results and results["distances"] and i < len(results["distances"][0]) else 1.0
                            score = 1.0 - distance
                            docs.append({
                                "content": doc,
                                "metadata": metadata,
                                "score": score
                            })
                            logger.info(f"Match {i+1}: Score {score:.4f}, Source: {metadata.get('file_name', 'unknown')}")
                        
                        if docs:
                            logger.info(f"Successfully retrieved documents from fallback collection: {collection_name}")
                            return docs
                    else:
                        logger.warning(f"No matching documents found in {collection_name}")
                        
                except Exception as e:
                    logger.warning(f"Error querying collection {collection_name}", 
                                  extra={"bot_id": bot_id, "error": str(e)})
                    continue
                    
            except Exception as e:
                logger.warning(f"Error with collection {collection_name}", 
                              extra={"bot_id": bot_id, "error": str(e)})
                continue
        
        logger.error(f"All fallback attempts failed")
        return []
        
    except Exception as e:
        logger.error(f"Error in fallback retrieval", 
                    extra={"bot_id": bot_id, "error": str(e)})
        return []


def get_bot_config(bot_id: int) -> str:
    """Gets the embedding model name for a specific bot from the database."""
    logger.info(f"Getting embedding model config for bot {bot_id}")
    
    db = SessionLocal()
    try:
        # Get bot from database
        bot = db.query(Bot).filter(Bot.bot_id == bot_id).first()
        
        if not bot:
            logger.warning(f"Bot {bot_id} not found in database")
            return "BAAI/bge-large-en-v1.5"  # Default fallback
            
        if bot.embedding_model:
            logger.info(f"Bot {bot_id} has an embedding model assigned: {bot.embedding_model.name}")
            return bot.embedding_model.name
        
        # Bot doesn't have embedding model, check user's subscription plan
        logger.info(f"Bot {bot_id} has no embedding model assigned, checking user subscription plan")
        user_id = bot.user_id
        
        # Get user's active subscription
        user_subscription = db.query(UserSubscription).filter(
            UserSubscription.user_id == user_id,
            UserSubscription.status == "active"
        ).order_by(UserSubscription.expiry_date.desc()).first()
        
        if user_subscription:
            # Get subscription plan
            subscription_plan = db.query(SubscriptionPlan).filter(
                SubscriptionPlan.id == user_subscription.subscription_plan_id
            ).first()
            
            if subscription_plan and subscription_plan.default_embedding_model_id:
                # Plan has a default embedding model, use it
                embedding_model = db.query(EmbeddingModel).filter(
                    EmbeddingModel.id == subscription_plan.default_embedding_model_id
                ).first()
                
                if embedding_model:
                    logger.info(f"Using embedding model from subscription plan: {embedding_model.name}")
                    return embedding_model.name
                    
        # If no model found from subscription plan or user has no subscription,
        # fall back to default model from database
        logger.warning(f"No embedding model from subscription plan, using default")
        default_model = db.query(EmbeddingModel).filter(
            EmbeddingModel.provider == "huggingface",
            EmbeddingModel.name == "BAAI/bge-large-en-v1.5",
            EmbeddingModel.is_active == True
        ).first()
        
        if default_model:
            logger.info(f"Using default model from database: {default_model.name}")
            return default_model.name
        else:
            # Last resort fallback - get any active model
            return db.query(EmbeddingModel).filter(
                EmbeddingModel.provider == "huggingface",
                EmbeddingModel.is_active == True
            ).first().name
    except Exception as e:
        logger.error(f"Error getting bot config", 
                    extra={"bot_id": bot_id, "error": str(e)})
        return "BAAI/bge-large-en-v1.5"  # Default fallback in case of error
    finally:
        db.close()


def delete_document_from_chroma(bot_id: int, file_id: str):
    """Deletes documents related to a specific file from ChromaDB."""
    logger.info(f"Starting document deletion process for bot {bot_id}, file_id {file_id}")
    
    try:
        # List all collections
        collections = chroma_client.list_collections()
        
        # Handle both old and new ChromaDB API versions
        # Check if collections is a list of strings (new API) or objects with name attribute (old API)
        if collections and isinstance(collections, list):
            if collections and hasattr(collections[0], 'name'):
                # Old API (pre-0.6.0) - collections is a list of objects with name attribute
                logger.debug("Using old ChromaDB API style (pre-0.6.0)")
                bot_collections = [collection.name for collection in collections if f"bot_{bot_id}_" in collection.name]
            else:
                # New API (0.6.0+) - collections is already a list of strings
                logger.debug("Using new ChromaDB API style (0.6.0+)")
                bot_collections = [name for name in collections if f"bot_{bot_id}_" in name]
        else:
            logger.warning("Unexpected collections format from ChromaDB")
            bot_collections = []
        
        if not bot_collections:
            logger.warning(f"No collections found for bot {bot_id}")
            return
            
        logger.info(f"Found collections for bot {bot_id}: {bot_collections}")
        
        file_id_str = str(file_id)
        
        # Try each collection and delete documents with matching file_id
        for collection_name in bot_collections:
            try:
                logger.info(f"Checking collection: {collection_name}")
                collection = chroma_client.get_collection(name=collection_name)
                
                if collection.count() == 0:
                    logger.warning(f"Collection {collection_name} is empty, skipping")
                    continue
                
                # Query to find document IDs with the given file ID in metadata
                try:
                    # First, get all documents and their metadata
                    results = collection.get(
                        where={"file_id": file_id_str},
                        include=["metadatas", "documents"]
                    )
                    
                    if results["ids"] and len(results["ids"]) > 0:
                        logger.info(f"Found {len(results['ids'])} documents to delete in {collection_name}")
                        
                        # Delete the documents
                        collection.delete(ids=results["ids"])
                        logger.info(f"Successfully deleted {len(results['ids'])} documents from {collection_name}")
                    else:
                        logger.info(f"No documents found with file_id {file_id} in {collection_name}")
                        
                except Exception as e:
                    logger.warning(f"Error querying collection {collection_name}", 
                                  extra={"bot_id": bot_id, "error": str(e)})
                    continue
                    
            except Exception as e:
                logger.warning(f"Error with collection {collection_name}", 
                              extra={"bot_id": bot_id, "error": str(e)})
                continue
        
        logger.info(f"Document deletion process completed for bot {bot_id}, file_id {file_id}")
        return True
    except Exception as e:
        error_msg = f"Error deleting documents from ChromaDB for bot {bot_id}, file_id {file_id}: {str(e)}"
        logger.error(f"Document deletion failed", 
                    extra={"bot_id": bot_id, "file_id": file_id, "error": str(e)})
        return False


def delete_video_from_chroma(bot_id: int, video_id: str):
    """Deletes documents related to a specific YouTube video from ChromaDB."""
    logger.info(f"Starting video document deletion process for bot {bot_id}, video_id {video_id}")
    
    try:
        # List all collections
        collections = chroma_client.list_collections()
        
        # Handle both old and new ChromaDB API versions
        # Check if collections is a list of strings (new API) or objects with name attribute (old API)
        if collections and isinstance(collections, list):
            if collections and hasattr(collections[0], 'name'):
                # Old API (pre-0.6.0) - collections is a list of objects with name attribute
                logger.debug("Using old ChromaDB API style (pre-0.6.0)")
                bot_collections = [collection.name for collection in collections if f"bot_{bot_id}_" in collection.name]
            else:
                # New API (0.6.0+) - collections is already a list of strings
                logger.debug("Using new ChromaDB API style (0.6.0+)")
                bot_collections = [name for name in collections if f"bot_{bot_id}_" in name]
        else:
            logger.warning("Unexpected collections format from ChromaDB")
            bot_collections = []
        
        if not bot_collections:
            logger.warning(f"No collections found for bot {bot_id}")
            return
            
        logger.info(f"Found collections for bot {bot_id}: {bot_collections}")
        
        # Try each collection and delete documents with matching video_id
        for collection_name in bot_collections:
            try:
                logger.info(f"Checking collection: {collection_name}")
                collection = chroma_client.get_collection(name=collection_name)
                
                if collection.count() == 0:
                    logger.warning(f"Collection {collection_name} is empty, skipping")
                    continue
                
                # Query to find document IDs with the given video ID in metadata
                try:
                    # First, get all documents and their metadata
                    results = collection.get(
                        where={"video_id": video_id},
                        include=["metadatas", "documents"]
                    )
                    
                    if results["ids"] and len(results["ids"]) > 0:
                        logger.info(f"Found {len(results['ids'])} documents to delete in {collection_name}")
                        
                        # Delete the documents
                        collection.delete(ids=results["ids"])
                        logger.info(f"Successfully deleted {len(results['ids'])} documents from {collection_name}")
                    else:
                        logger.info(f"No documents found with video_id {video_id} in {collection_name}")
                        
                except Exception as e:
                    logger.warning(f"Error querying collection {collection_name}", 
                                  extra={"bot_id": bot_id, "error": str(e)})
                    continue
                    
            except Exception as e:
                logger.warning(f"Error with collection {collection_name}", 
                              extra={"bot_id": bot_id, "error": str(e)})
                continue
        
        logger.info(f"Video document deletion process completed for bot {bot_id}, video_id {video_id}")
        return True
    except Exception as e:
        error_msg = f"Error deleting video documents from ChromaDB for bot {bot_id}, video_id {video_id}: {str(e)}"
        logger.error(f"Video deletion failed", 
                    extra={"bot_id": bot_id, "video_id": video_id, "error": str(e)})
        return False


def delete_url_from_chroma(bot_id: int, url: str):
    """Deletes documents related to a specific scraped URL from ChromaDB."""
    logger.info(f"Starting URL document deletion process for bot {bot_id}, url {url}")
    
    try:
        # List all collections
        collections = chroma_client.list_collections()
        
        # Handle both old and new ChromaDB API versions
        # Check if collections is a list of strings (new API) or objects with name attribute (old API)
        if collections and isinstance(collections, list):
            if collections and hasattr(collections[0], 'name'):
                # Old API (pre-0.6.0) - collections is a list of objects with name attribute
                logger.debug("Using old ChromaDB API style (pre-0.6.0)")
                bot_collections = [collection.name for collection in collections if f"bot_{bot_id}_" in collection.name]
            else:
                # New API (0.6.0+) - collections is already a list of strings
                logger.debug("Using new ChromaDB API style (0.6.0+)")
                bot_collections = [name for name in collections if f"bot_{bot_id}_" in name]
        else:
            logger.warning("Unexpected collections format from ChromaDB")
            bot_collections = []
        
        if not bot_collections:
            logger.warning(f"No collections found for bot {bot_id}")
            return
            
        logger.info(f"Found collections for bot {bot_id}: {bot_collections}")
        
        # Try each collection and delete documents with matching URL
        for collection_name in bot_collections:
            try:
                logger.info(f"Checking collection: {collection_name}")
                collection = chroma_client.get_collection(name=collection_name)
                
                if collection.count() == 0:
                    logger.warning(f"Collection {collection_name} is empty, skipping")
                    continue
                
                # Query to find document IDs with the given URL in metadata
                try:
                    # First, get all documents and their metadata
                    results = collection.get(
                        where={"url": url},
                        include=["metadatas", "documents"]
                    )
                    
                    if results["ids"] and len(results["ids"]) > 0:
                        logger.info(f"Found {len(results['ids'])} documents to delete in {collection_name}")
                        
                        # Delete the documents
                        collection.delete(ids=results["ids"])
                        logger.info(f"Successfully deleted {len(results['ids'])} documents from {collection_name}")
                    else:
                        logger.info(f"No documents found with url {url} in {collection_name}")
                        
                except Exception as e:
                    logger.warning(f"Error querying collection {collection_name}", 
                                  extra={"bot_id": bot_id, "error": str(e)})
                    continue
                    
            except Exception as e:
                logger.warning(f"Error with collection {collection_name}", 
                              extra={"bot_id": bot_id, "error": str(e)})
                continue
        
        logger.info(f"URL document deletion process completed for bot {bot_id}, url {url}")
        return True
    except Exception as e:
        error_msg = f"Error deleting URL documents from ChromaDB for bot {bot_id}, url {url}: {str(e)}"
        logger.error(f"URL deletion failed", 
                    extra={"bot_id": bot_id, "url": url, "error": str(e)})
        return False
