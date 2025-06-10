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
import time
import signal
from contextlib import contextmanager
from app.utils.ai_logger import ai_logger

# Initialize logger
logger = get_module_logger(__name__)

load_dotenv()

# Use settings object instead of direct environment access
api_key = settings.OPENAI_API_KEY

if not api_key:
    logger.critical("OPENAI_API_KEY is not configured in settings")
    raise ValueError("OPENAI_API_KEY is not set in configuration!")

# Remove global chroma_client initialization - we'll create it per operation instead
def get_chroma_client():
    """
    Create a new ChromaDB client instance for each operation.
    This prevents thread-safety issues when using Celery with multiple workers.
    """
    try:
        client = chromadb.PersistentClient(path=f"./{settings.CHROMA_DIR}")
        logger.debug(f"Created new ChromaDB client with path: {settings.CHROMA_DIR}")
        return client
    except Exception as e:
        logger.error(f"Failed to create ChromaDB client: {str(e)}")
        raise

@contextmanager
def timeout_handler(timeout_seconds=30):
    """Context manager to handle timeouts for ChromaDB operations."""
    def timeout_signal_handler(signum, frame):
        raise TimeoutError(f"Operation timed out after {timeout_seconds} seconds")
    
    # Set up the signal handler
    old_handler = signal.signal(signal.SIGALRM, timeout_signal_handler)
    signal.alarm(timeout_seconds)
    
    try:
        yield
    finally:
        # Reset the alarm and restore the old handler
        signal.alarm(0)
        signal.signal(signal.SIGALRM, old_handler)


def safe_get_collection(collection_name, timeout_seconds=30):
    """Safely get a collection with timeout and detailed logging."""
    from app.utils.ai_logger import ai_logger
    
    client = get_chroma_client()  # Create new client instance
    logger.info(f"[DEBUG] Attempting to get collection: {collection_name}")
    logger.info(f"[DEBUG] ChromaDB client type: {type(client)}")
    logger.info(f"[DEBUG] Collection name type: {type(collection_name)}, value: '{collection_name}'")
    
    # ✅ Log collection access attempt
    ai_logger.info("Collection access attempt initiated", extra={
        "ai_task": {
            "event_type": "collection_access_initiated",
            "collection_name": collection_name,
            "timeout_seconds": timeout_seconds,
            "client_type": str(type(client))
        }
    })
    
    try:
        # First, check if the collection exists by listing all collections
        logger.info(f"[DEBUG] Checking if collection exists by listing all collections")
        with timeout_handler(timeout_seconds):
            start_time = time.time()
            all_collections = client.list_collections()
            list_time = time.time() - start_time
            logger.info(f"[DEBUG] Listed collections in {list_time:.2f}s, found {len(all_collections)} total")
            
            # ✅ Log collection listing results
            ai_logger.info("Collections listed from ChromaDB", extra={
                "ai_task": {
                    "event_type": "collections_listed",
                    "collection_name": collection_name,
                    "total_collections_found": len(all_collections),
                    "list_duration_ms": int(list_time * 1000)
                }
            })
            
            # Determine API version and get collection names
            if all_collections and len(all_collections) > 0:
                if isinstance(all_collections[0], str):
                    logger.info(f"[DEBUG] Using new ChromaDB API (v0.6.0+)")
                    collection_names = all_collections
                    api_version = "new (v0.6.0+)"
                else:
                    logger.info(f"[DEBUG] Using old ChromaDB API (pre-0.6.0)")
                    collection_names = [col.name for col in all_collections]
                    api_version = "old (pre-0.6.0)"
            else:
                collection_names = []
                api_version = "unknown (no collections)"
            
            logger.info(f"[DEBUG] Available collections: {collection_names[:10]}{'...' if len(collection_names) > 10 else ''}")
            
            # ✅ Log API version detection and collection names
            ai_logger.info("ChromaDB API version detected", extra={
                "ai_task": {
                    "event_type": "chromadb_api_version_detected",
                    "collection_name": collection_name,
                    "api_version": api_version,
                    "available_collections": collection_names[:5],  # Log first 5 for brevity
                    "total_available": len(collection_names)
                }
            })
            
            # Check if our target collection exists
            collection_exists = collection_name in collection_names
            if not collection_exists:
                logger.warning(f"[DEBUG] Collection '{collection_name}' not found in available collections")
                
                # ✅ Log collection not found
                ai_logger.warning("Target collection not found", extra={
                    "ai_task": {
                        "event_type": "collection_not_found",
                        "collection_name": collection_name,
                        "available_collections": collection_names[:10],
                        "total_available": len(collection_names),
                        "collection_exists": False
                    }
                })
                
                raise ValueError(f"Collection '{collection_name}' does not exist")
            
            logger.info(f"[DEBUG] Collection '{collection_name}' exists, proceeding to get it")
            
            # ✅ Log collection found
            ai_logger.info("Target collection found", extra={
                "ai_task": {
                    "event_type": "collection_found_in_list",
                    "collection_name": collection_name,
                    "collection_exists": True,
                    "total_available": len(collection_names)
                }
            })
        
        with timeout_handler(timeout_seconds):
            logger.info(f"[DEBUG] About to call client.get_collection() with timeout {timeout_seconds}s")
            start_time = time.time()
            
            # ✅ Log collection retrieval attempt
            ai_logger.info("Attempting to retrieve collection object", extra={
                "ai_task": {
                    "event_type": "collection_retrieval_attempt",
                    "collection_name": collection_name,
                    "timeout_seconds": timeout_seconds
                }
            })
            
            collection = client.get_collection(name=collection_name)
            
            elapsed_time = time.time() - start_time
            logger.info(f"[DEBUG] Successfully got collection in {elapsed_time:.2f} seconds")
            
            # ✅ Log successful collection retrieval
            ai_logger.info("Collection retrieved successfully", extra={
                "ai_task": {
                    "event_type": "collection_retrieved_successfully",
                    "collection_name": collection_name,
                    "retrieval_duration_ms": int(elapsed_time * 1000),
                    "collection_type": str(type(collection)),
                    "success": True
                }
            })
            
            return collection
            
    except TimeoutError as e:
        logger.error(f"[DEBUG] TIMEOUT: get_collection() timed out after {timeout_seconds} seconds for collection '{collection_name}'")
        
        # ✅ Log timeout error
        ai_logger.error("Collection access timed out", extra={
            "ai_task": {
                "event_type": "collection_access_timeout",
                "collection_name": collection_name,
                "timeout_seconds": timeout_seconds,
                "error": str(e)
            }
        })
        
        raise
    except ValueError as e:
        logger.error(f"[DEBUG] Collection does not exist: {str(e)}")
        
        # ✅ Log collection does not exist error (already logged above, but for completeness)
        ai_logger.error("Collection does not exist", extra={
            "ai_task": {
                "event_type": "collection_does_not_exist",
                "collection_name": collection_name,
                "error": str(e)
            }
        })
        
        raise
    except Exception as e:
        logger.error(f"[DEBUG] ERROR in get_collection(): {type(e).__name__}: {str(e)}")
        logger.error(f"[DEBUG] Full traceback:", exc_info=True)
        
        # ✅ Log general collection access error
        ai_logger.error("Collection access failed with general error", extra={
            "ai_task": {
                "event_type": "collection_access_general_error",
                "collection_name": collection_name,
                "error": str(e),
                "error_type": type(e).__name__
            }
        })
        
        raise
    finally:
        # Clean up the client after we're done
        if 'client' in locals():
            del client
            logger.debug("ChromaDB client cleaned up")


def add_document(bot_id: int, text: str, metadata: dict, force_model: str = None, user_id: int = None):
    """Adds a document to a bot-specific vector database in ChromaDB."""
    logger.info(f"Adding document to vector database", 
               extra={"bot_id": bot_id, "document_id": metadata.get('id', 'unknown'),
                     "document_type": metadata.get('source', 'unknown')})
    
    # Add more detailed metadata logging
    logger.info(f"Document metadata details", 
               extra={"bot_id": bot_id, "metadata": metadata})
    
    # Log text length to check if there's content to embed
    logger.info(f"Document text length: {len(text)}", 
               extra={"bot_id": bot_id})
    
    try:
        # If force_model is provided, use it (for re-embedding)
        if force_model:
            model_name = force_model
            logger.info(f"Using forced embedding model", 
                       extra={"bot_id": bot_id, "model_name": model_name})
            # Initialize embedding manager with forced model
            logger.info(f"Initializing EmbeddingManager with forced model", 
                       extra={"bot_id": bot_id, "model_name": model_name})
            embedder = EmbeddingManager(model_name=model_name)
            logger.info(f"Embedder initialized successfully", 
                       extra={"bot_id": bot_id, "model_name": model_name})
        else:
            # Otherwise, use the model selection utility if user_id is provided
            if user_id:
                logger.info(f"Using model selection based on user subscription", 
                           extra={"bot_id": bot_id, "user_id": user_id})
                logger.info(f"Initializing EmbeddingManager with bot_id and user_id", 
                           extra={"bot_id": bot_id, "user_id": user_id})
                embedder = EmbeddingManager(bot_id=bot_id, user_id=user_id)
                model_name = embedder.model_name
                logger.info(f"Selected embedding model", 
                           extra={"bot_id": bot_id, "model_name": model_name})
            else:
                # Otherwise, get from DB (normal case)
                logger.info(f"Getting bot configuration", extra={"bot_id": bot_id})
                model_name = get_bot_config(bot_id)
                logger.info(f"Using embedding model from bot config", 
                           extra={"bot_id": bot_id, "model_name": model_name})
                # Initialize embedding manager with model name
                logger.info(f"Initializing EmbeddingManager with model name", 
                           extra={"bot_id": bot_id, "model_name": model_name})
                embedder = EmbeddingManager(model_name=model_name)
                logger.info(f"Embedder initialized successfully", 
                           extra={"bot_id": bot_id, "model_name": model_name})
        
        # Test the embedder with a small piece of text before proceeding
        try:
            logger.info(f"Testing embedder with sample text", 
                       extra={"bot_id": bot_id, "model_name": model_name})
            test_embedding = embedder.embed_query("test")
            if not test_embedding:
                logger.error(f"Generated test embedding is empty", 
                           extra={"bot_id": bot_id, "model_name": model_name})
                raise ValueError("Failed to generate test embedding")
            
            # Get the embedding dimension from the test
            embedding_dimension = len(test_embedding)
            logger.info(f"Embedding dimension verified", 
                        extra={"bot_id": bot_id, "dimension": embedding_dimension, "model": model_name})
            
        except Exception as e:
            error_msg = f"Failed to initialize embedder for model {model_name}: {str(e)}"
            logger.error(f"Embedding initialization failed", 
                         extra={"bot_id": bot_id, "model_name": model_name, 
                               "error": str(e)})
            raise ValueError(error_msg)
        
        # Sanitize model name for collection name
        logger.info(f"Sanitizing model name for collection", 
                   extra={"bot_id": bot_id, "model_name": model_name})
        sanitized_model_name = model_name.replace("/", "_").replace(".", "_").replace("-", "_")
        
        # IMPORTANT: Always use a consistent collection name format based ONLY on bot_id and model
        # This ensures all data sources (YouTube, files, websites) share the same collection
        base_collection_name = f"bot_{bot_id}_{sanitized_model_name}"
        logger.info(f"Using collection name", 
                   extra={"bot_id": bot_id, "collection": base_collection_name})

        # Log collection name with source type for debugging purposes
        source_type = metadata.get('source', 'unknown')
        logger.info(f"*** COLLECTION: {base_collection_name} - SOURCE TYPE: {source_type} ***", 
                   extra={"bot_id": bot_id, "collection": base_collection_name, "source": source_type})
        
        # Check if this is a re-embedding process by looking at metadata
        is_reembedding = metadata.get("source") == "re-embed"
        
        # For re-embedding, use the temp_collection name if provided
        if is_reembedding and metadata.get("temp_collection"):
            collection_name = metadata.get("temp_collection")
            logger.info(f"Using temporary collection for re-embedding", 
                       extra={"bot_id": bot_id, "collection": collection_name})
        else:
            # Standard case for all document types - use the consistent base collection name
            collection_name = base_collection_name
            
        logger.info(f"Getting or creating ChromaDB collection", 
                    extra={"bot_id": bot_id, "collection": collection_name})
        try:
            # Create new client instance for this operation
            chroma_client = get_chroma_client()
            
            # Check if collection already exists
            try:
                logger.info(f"[DEBUG] About to check for existing collection: {collection_name}")
                existing_collection = safe_get_collection(collection_name, timeout_seconds=30)
                logger.info(f"Existing collection found", 
                           extra={"bot_id": bot_id, "collection": collection_name, 
                                 "count": existing_collection.count()})
                logger.info(f"*** USING EXISTING COLLECTION: {collection_name} - DOCUMENT COUNT: {existing_collection.count()} ***", 
                           extra={"bot_id": bot_id})
                bot_collection = existing_collection
            except Exception as e:
                logger.info(f"Collection not found, creating new collection", 
                            extra={"bot_id": bot_id, "collection": collection_name, "error": str(e)})
                bot_collection = chroma_client.create_collection(
                    name=collection_name,
                    embedding_function=None  # We'll provide our own embeddings
                )
                logger.info(f"*** CREATED NEW COLLECTION: {collection_name} ***", 
                           extra={"bot_id": bot_id})
                logger.info(f"New collection created", 
                           extra={"bot_id": bot_id, "collection": collection_name})
        except Exception as e:
            logger.error(f"Error creating/getting collection", 
                        extra={"bot_id": bot_id, "collection": collection_name, "error": str(e)})
            # Try again with get_or_create as fallback
            bot_collection = chroma_client.get_or_create_collection(
                name=collection_name,
                embedding_function=None  # We'll provide our own embeddings
            )
            logger.warning(f"Used fallback method to create collection", 
                          extra={"bot_id": bot_id, "collection": collection_name})
            
        logger.info(f"Collection status", 
                    extra={"bot_id": bot_id, "collection": collection_name, 
                          "is_new": bot_collection.count() == 0})

        logger.info(f"Generating document embedding", 
                    extra={"bot_id": bot_id, "document_id": metadata.get('id', 'unknown'),
                          "text_length": len(text), "model": model_name})
        try:
            vector = embedder.embed_document(text)
            if not vector:
                logger.error(f"Failed to generate document embedding", 
                            extra={"bot_id": bot_id, "document_id": metadata.get('id', 'unknown')})
                raise ValueError("Failed to generate document embedding")
                
            logger.info(f"Embedding generated successfully", 
                        extra={"bot_id": bot_id, "vector_length": len(vector), 
                              "first_values": str(vector[:3])})
        except Exception as e:
            logger.error(f"Error generating document embedding", 
                        extra={"bot_id": bot_id, "error": str(e)})
            raise ValueError(f"Error generating document embedding: {str(e)}")

        logger.info(f"Adding document to ChromaDB collection", 
                    extra={"bot_id": bot_id, "collection": collection_name, 
                          "id": metadata["id"]})
        try:
            add_result = bot_collection.add(
                ids=[metadata["id"]],
                embeddings=[vector],
                metadatas=[metadata],
                documents=[text]
            )
            logger.info(f"Add result: {add_result}", 
                        extra={"bot_id": bot_id, "collection": collection_name})
            logger.info(f"Document added successfully", 
                   extra={"bot_id": bot_id, "document_id": metadata.get('id', 'unknown'), 
                         "collection": collection_name, 
                         "collection_count": bot_collection.count()})
        except Exception as e:
            logger.error(f"Error adding document to collection", 
                        extra={"bot_id": bot_id, "collection": collection_name, 
                              "error": str(e)})
            raise ValueError(f"Error adding document to collection: {str(e)}")
        
    except Exception as e:
        error_msg = f"Error processing document for bot {bot_id}: {str(e)}"
        logger.exception(f"Document addition failed", 
                        extra={"bot_id": bot_id, "document_id": metadata.get('id', 'unknown'), 
                              "error": str(e)})
        raise ValueError(error_msg)
    finally:
        # Clean up the client after we're done
        if 'chroma_client' in locals():
            del chroma_client
            logger.debug("ChromaDB client cleaned up in add_document")


def retrieve_similar_docs(bot_id: int, query_text: str, top_k=5, user_id: int = None):
    """Retrieves similar documents for a query from a bot-specific vector database in ChromaDB."""
    logger.info(f"Starting similarity search", 
               extra={"bot_id": bot_id, "query_length": len(query_text), 
                     "top_k": top_k})
    
    # ✅ Log detailed search initiation
    ai_logger.info("Vector database search initiated", extra={
        "ai_task": {
            "event_type": "vector_search_start",
            "bot_id": bot_id,
            "user_id": user_id,
            "query_text": query_text[:100] + "..." if len(query_text) > 100 else query_text,
            "query_length": len(query_text),
            "top_k": top_k
        }
    })
    
    start_time = time.time()
    
    try:
        # Use model selection utility if user_id is provided
        if user_id:
            logger.debug(f"Using model selection based on user subscription", 
                       extra={"bot_id": bot_id, "user_id": user_id})
            embedder = EmbeddingManager(bot_id=bot_id, user_id=user_id)
            model_name = embedder.model_name
            logger.info(f"Selected embedding model", 
                       extra={"bot_id": bot_id, "model_name": model_name})
            
            # ✅ Log embedding model selection
            ai_logger.info("Embedding model selected", extra={
                "ai_task": {
                    "event_type": "embedding_model_selected",
                    "bot_id": bot_id,
                    "user_id": user_id,
                    "model_name": model_name,
                    "selection_method": "user_subscription"
                }
            })
        else:
            # Otherwise get from bot config
            logger.debug(f"Getting bot configuration", 
                        extra={"bot_id": bot_id})
            model_name = get_bot_config(bot_id)
            logger.info(f"Using embedding model from bot config", 
                       extra={"bot_id": bot_id, "model_name": model_name})
            
            # ✅ Log embedding model from bot config
            ai_logger.info("Embedding model from bot config", extra={
                "ai_task": {
                    "event_type": "embedding_model_selected",
                    "bot_id": bot_id,
                    "user_id": user_id,
                    "model_name": model_name,
                    "selection_method": "bot_config"
                }
            })
            
            # Initialize embedding manager
            logger.debug(f"Initializing embedding manager", 
                        extra={"bot_id": bot_id, "model_name": model_name})
            try:
                embedder = EmbeddingManager(model_name=model_name)
            except Exception as e:
                logger.error(f"Error initializing embedder", 
                            extra={"bot_id": bot_id, "model_name": model_name, "error": str(e)})
                
                # ✅ Log embedder initialization failure
                ai_logger.error("Embedding manager initialization failed", extra={
                    "ai_task": {
                        "event_type": "embedder_init_error",
                        "bot_id": bot_id,
                        "user_id": user_id,
                        "model_name": model_name,
                        "error": str(e)
                    }
                })
                
                # Try to find any previous collection for this bot
                logger.warning(f"Falling back to any available collection", 
                              extra={"bot_id": bot_id})
                return fallback_retrieve_similar_docs(bot_id, query_text, top_k)
        
        # Get embedding for query
        logger.debug(f"Generating query embedding", 
                    extra={"bot_id": bot_id})
        try:
            query_embedding = embedder.embed_query(query_text)
            
            # ✅ Log successful embedding generation
            ai_logger.info("Query embedding generated", extra={
                "ai_task": {
                    "event_type": "query_embedding_generated",
                    "bot_id": bot_id,
                    "user_id": user_id,
                    "model_name": model_name,
                    "embedding_dimension": len(query_embedding),
                    "success": True
                }
            })
        except Exception as e:
            logger.error(f"Error generating query embedding", 
                        extra={"bot_id": bot_id, "error": str(e)})
            
            # ✅ Log embedding generation failure
            ai_logger.error("Query embedding generation failed", extra={
                "ai_task": {
                    "event_type": "query_embedding_error",
                    "bot_id": bot_id,
                    "user_id": user_id,
                    "model_name": model_name,
                    "error": str(e)
                }
            })
            
            return fallback_retrieve_similar_docs(bot_id, query_text, top_k)
        
        # Get the embedding dimension
        embedding_dimension = len(query_embedding)
        logger.debug(f"Query embedding dimension", 
                    extra={"bot_id": bot_id, "dimension": embedding_dimension})
        
        # Sanitize model name for ChromaDB collection naming requirements
        sanitized_model_name = model_name.replace("/", "_").replace(".", "_").replace("-", "_")
        
        # IMPORTANT: Use the same consistent collection naming as in add_document
        collection_name = f"bot_{bot_id}_{sanitized_model_name}"
        logger.info(f"Using consistent collection name", 
                   extra={"bot_id": bot_id, "collection": collection_name})
        
        # ✅ Log collection name determination
        ai_logger.info("Collection name determined", extra={
            "ai_task": {
                "event_type": "collection_name_determined",
                "bot_id": bot_id,
                "user_id": user_id,
                "collection_name": collection_name,
                "model_name": model_name,
                "sanitized_model_name": sanitized_model_name
            }
        })
        
        # Add debug highlighting for query collection name
        logger.info(f"*** QUERYING COLLECTION: {collection_name} ***", 
                   extra={"bot_id": bot_id})
        
        # Try to get the collection
        try:
            logger.info(f"[DEBUG] About to get collection for querying: {collection_name}")
            
            # ✅ Log collection access attempt
            ai_logger.info("Attempting to access collection", extra={
                "ai_task": {
                    "event_type": "collection_access_attempt",
                    "bot_id": bot_id,
                    "user_id": user_id,
                    "collection_name": collection_name
                }
            })
            
            bot_collection = safe_get_collection(collection_name, timeout_seconds=30)
            
            # Check if it has documents
            doc_count = bot_collection.count()
            logger.info(f"Collection has {doc_count} documents", 
                       extra={"bot_id": bot_id, "collection": collection_name})
            
            # ✅ Log collection found and document count
            ai_logger.info("Collection found and accessed", extra={
                "ai_task": {
                    "event_type": "collection_found",
                    "bot_id": bot_id,
                    "user_id": user_id,
                    "collection_name": collection_name,
                    "document_count": doc_count,
                    "collection_exists": True
                }
            })
            
            if doc_count == 0:
                logger.warning(f"Collection {collection_name} is empty, falling back to other collections")
                
                # ✅ Log empty collection
                ai_logger.warning("Collection is empty, falling back", extra={
                    "ai_task": {
                        "event_type": "collection_empty",
                        "bot_id": bot_id,
                        "user_id": user_id,
                        "collection_name": collection_name,
                        "fallback_initiated": True
                    }
                })
                
                return fallback_retrieve_similar_docs(bot_id, query_text, top_k)
        except Exception as e:
            logger.error(f"Error accessing collection {collection_name}", 
                        extra={"bot_id": bot_id, "error": str(e)})
            logger.warning(f"Collection not found, falling back to other collections")
            
            # ✅ Log collection access error
            ai_logger.error("Collection access failed", extra={
                "ai_task": {
                    "event_type": "collection_access_error",
                    "bot_id": bot_id,
                    "user_id": user_id,
                    "collection_name": collection_name,
                    "error": str(e),
                    "collection_exists": False,
                    "fallback_initiated": True
                }
            })
            
            return fallback_retrieve_similar_docs(bot_id, query_text, top_k)
        
        # Query the collection
        try:
            # ✅ Log query execution start
            ai_logger.info("Starting collection query", extra={
                "ai_task": {
                    "event_type": "collection_query_start",
                    "bot_id": bot_id,
                    "user_id": user_id,
                    "collection_name": collection_name,
                    "embedding_dimension": embedding_dimension,
                    "n_results": min(top_k, doc_count)
                }
            })
            
            # Run the query
            results = bot_collection.query(
                query_embeddings=[query_embedding],
                n_results=min(top_k, doc_count),
                include=["documents", "metadatas", "distances"]
            )
            
            # ✅ Log query execution success
            ai_logger.info("Collection query executed successfully", extra={
                "ai_task": {
                    "event_type": "collection_query_success",
                    "bot_id": bot_id,
                    "user_id": user_id,
                    "collection_name": collection_name,
                    "results_returned": len(results["documents"][0]) if results.get("documents") and results["documents"][0] else 0
                }
            })
            
            # Process and return results
            docs = []
            if results["documents"] and len(results["documents"]) > 0 and len(results["documents"][0]) > 0:
                logger.info(f"Found {len(results['documents'][0])} matching documents")
                
                # Process results and prepare detailed logging
                result_details = []
                for i, doc in enumerate(results["documents"][0]):
                    metadata = results["metadatas"][0][i]
                    distance = results["distances"][0][i]
                    score = 1.0 - distance  # Convert distance to similarity score
                    docs.append({
                        "content": doc,
                        "metadata": metadata,
                        "score": score
                    })
                    logger.info(f"Match {i+1}: Score {score:.4f}, Source: {metadata.get('source', 'unknown')}, Name: {metadata.get('file_name', 'unknown')}")
                    
                    # Prepare result detail for logging
                    result_details.append({
                        "index": i,
                        "score": round(score, 4),
                        "distance": round(distance, 4),
                        "content_length": len(doc),
                        "content_preview": doc[:100] + "..." if len(doc) > 100 else doc,
                        "metadata": metadata
                    })
                
                # ✅ Log detailed search results
                ai_logger.info("Search results processed", extra={
                    "ai_task": {
                        "event_type": "search_results_processed",
                        "bot_id": bot_id,
                        "user_id": user_id,
                        "collection_name": collection_name,
                        "results_count": len(docs),
                        "results_details": result_details[:3]  # Log only first 3 for brevity
                    }
                })
            else:
                logger.warning("No documents returned from query")
                
                # ✅ Log no results found
                ai_logger.warning("No documents returned from query", extra={
                    "ai_task": {
                        "event_type": "no_results_found",
                        "bot_id": bot_id,
                        "user_id": user_id,
                        "collection_name": collection_name,
                        "query_executed": True
                    }
                })
            
            # Calculate time taken
            duration_ms = int((time.time() - start_time) * 1000)
            
            # Log the document retrieval if user_id is provided
            if user_id:
                from app.utils.ai_logger import log_document_retrieval
                log_document_retrieval(
                    user_id=user_id,
                    bot_id=bot_id,
                    query=query_text,
                    collection_name=collection_name,
                    results_count=len(docs),
                    results=docs,
                    extra={
                        "duration_ms": duration_ms,
                        "model_name": model_name,
                        "dimension": embedding_dimension
                    }
                )
            
            # ✅ Log final vector search completion
            ai_logger.info("Vector database search completed", extra={
                "ai_task": {
                    "event_type": "vector_search_complete",
                    "bot_id": bot_id,
                    "user_id": user_id,
                    "collection_name": collection_name,
                    "total_duration_ms": duration_ms,
                    "results_count": len(docs),
                    "success": True
                }
            })
            
            return docs
            
        except Exception as e:
            logger.error(f"Error querying collection", 
                        extra={"bot_id": bot_id, "error": str(e)})
            
            # ✅ Log collection query error
            ai_logger.error("Collection query failed", extra={
                "ai_task": {
                    "event_type": "collection_query_error",
                    "bot_id": bot_id,
                    "user_id": user_id,
                    "collection_name": collection_name,
                    "error": str(e),
                    "fallback_initiated": True
                }
            })
            
            if "dimension" in str(e).lower():
                logger.warning(f"Dimension mismatch error, trying fallback")
                
                # ✅ Log dimension mismatch specifically
                ai_logger.warning("Dimension mismatch detected", extra={
                    "ai_task": {
                        "event_type": "dimension_mismatch",
                        "bot_id": bot_id,
                        "user_id": user_id,
                        "collection_name": collection_name,
                        "expected_dimension": embedding_dimension,
                        "error": str(e)
                    }
                })
            
            return fallback_retrieve_similar_docs(bot_id, query_text, top_k)
            
    except Exception as e:
        error_msg = f"Error retrieving similar docs for bot {bot_id}: {str(e)}"
        logger.exception(f"Similarity search failed", 
                        extra={"bot_id": bot_id, "error": str(e)})
        
        # ✅ Log general vector search failure
        ai_logger.error("Vector database search failed", extra={
            "ai_task": {
                "event_type": "vector_search_failed",
                "bot_id": bot_id,
                "user_id": user_id,
                "error": str(e),
                "total_duration_ms": int((time.time() - start_time) * 1000)
            }
        })
        
        return []


def fallback_retrieve_similar_docs(bot_id: int, query_text: str, top_k=5):
    """Fallback method to retrieve documents from any available collection for this bot."""
    logger.info(f"Attempting fallback retrieval for bot {bot_id}")
    
    try:
        # Create new client instance for this operation
        chroma_client = get_chroma_client()
        
        # List all collections
        collections = chroma_client.list_collections()
        
        # Safely determine if we're using new or old API
        try:
            # First, assume we're using the new API (v0.6.0+)
            # If all items in collections are strings, we're using the new API
            is_new_api = all(isinstance(item, str) for item in collections) if collections else True
            
            if not is_new_api:
                # Try to get collection names using old API style
                try:
                    # Just try with the first item
                    if collections and len(collections) > 0:
                        test_name = collections[0].name
                        # If we got here without exception, it's the old API
                        logger.debug("Using old ChromaDB API style (pre-0.6.0)")
                        bot_collections = [collection.name for collection in collections if f"bot_{bot_id}_" in collection.name]
                    else:
                        bot_collections = []
                except Exception as e:
                    # If accessing 'name' causes an error, we're using the new API
                    logger.debug(f"Error checking collection type: {str(e)}")
                    logger.debug("Defaulting to new ChromaDB API style (0.6.0+)")
                    bot_collections = [name for name in collections if f"bot_{bot_id}_" in name]
            else:
                logger.debug("Using new ChromaDB API style (0.6.0+)")
                bot_collections = [name for name in collections if f"bot_{bot_id}_" in name]
        except Exception as e:
            logger.warning(f"Error determining ChromaDB API version: {str(e)}")
            # Safe default - treat as new API
            bot_collections = [name for name in collections if f"bot_{bot_id}_" in name] if isinstance(collections, list) else []
        
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
                logger.info(f"[DEBUG] About to get collection in fallback: {collection_name}")
                collection = safe_get_collection(collection_name, timeout_seconds=30)
                
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
    finally:
        # Clean up the client after we're done
        if 'chroma_client' in locals():
            del chroma_client
            logger.debug("ChromaDB client cleaned up in fallback_retrieve_similar_docs")


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
        # Create new client instance for this operation
        chroma_client = get_chroma_client()
        
        # List all collections
        collections = chroma_client.list_collections()
        
        # Safely determine if we're using new or old API
        try:
            # First, assume we're using the new API (v0.6.0+)
            # If all items in collections are strings, we're using the new API
            is_new_api = all(isinstance(item, str) for item in collections) if collections else True
            
            if not is_new_api:
                # Try to get collection names using old API style
                try:
                    if collections and len(collections) > 0:
                        test_name = collections[0].name
                        logger.debug("Using old ChromaDB API style (pre-0.6.0)")
                        bot_collections = [collection.name for collection in collections if f"bot_{bot_id}_" in collection.name]
                    else:
                        bot_collections = []
                except Exception as e:
                    logger.debug(f"Error checking collection type: {str(e)}")
                    logger.debug("Defaulting to new ChromaDB API style (0.6.0+)")
                    bot_collections = [name for name in collections if f"bot_{bot_id}_" in name]
            else:
                logger.debug("Using new ChromaDB API style (0.6.0+)")
                bot_collections = [name for name in collections if f"bot_{bot_id}_" in name]
        except Exception as e:
            logger.warning(f"Error determining ChromaDB API version: {str(e)}")
            # Safe default - treat as new API
            bot_collections = [name for name in collections if f"bot_{bot_id}_" in name] if isinstance(collections, list) else []
        
        if not bot_collections:
            logger.warning(f"No collections found for bot {bot_id}")
            return
            
        logger.info(f"Found collections for bot {bot_id}: {bot_collections}")
        
        file_id_str = str(file_id)
        
        # Try each collection and delete documents with matching file_id or id
        for collection_name in bot_collections:
            try:
                logger.info(f"Checking collection: {collection_name}")
                collection = chroma_client.get_collection(name=collection_name)
                
                if collection.count() == 0:
                    logger.warning(f"Collection {collection_name} is empty, skipping")
                    continue
                
                # Query to find document IDs with the given file ID in metadata
                # Note: We need to check multiple fields since the metadata structure
                # has been inconsistent across sources
                try:
                    # Try with 'id' field first (our new standardized approach)
                    results = collection.get(
                        where={"id": file_id_str},
                        include=["metadatas", "documents"]
                    )
                    
                    # If no results, try with 'file_id' field (older inconsistent approach)
                    if not results["ids"] or len(results["ids"]) == 0:
                        logger.debug(f"No documents found with id={file_id_str}, trying file_id field")
                        try:
                            results = collection.get(
                                where={"file_id": file_id_str},
                                include=["metadatas", "documents"]
                            )
                        except Exception as where_err:
                            logger.warning(f"Error querying with file_id: {str(where_err)}")
                            # If where query fails, fall back to getting all and filtering
                            try:
                                all_results = collection.get(include=["metadatas", "documents"])
                                # Filter manually
                                matching_indices = []
                                for i, metadata in enumerate(all_results["metadatas"]):
                                    if metadata.get("id") == file_id_str or metadata.get("file_id") == file_id_str:
                                        matching_indices.append(i)
                                
                                if matching_indices:
                                    results = {
                                        "ids": [all_results["ids"][i] for i in matching_indices],
                                        "metadatas": [all_results["metadatas"][i] for i in matching_indices],
                                        "documents": [all_results["documents"][i] for i in matching_indices]
                                    }
                                else:
                                    results = {"ids": [], "metadatas": [], "documents": []}
                            except Exception as fallback_err:
                                logger.error(f"Fallback filtering failed: {str(fallback_err)}")
                                results = {"ids": [], "metadatas": [], "documents": []}
                    
                    if results["ids"] and len(results["ids"]) > 0:
                        logger.info(f"Found {len(results['ids'])} documents to delete in {collection_name}")
                        
                        # Delete the documents
                        collection.delete(ids=results["ids"])
                        logger.info(f"Successfully deleted {len(results['ids'])} documents from {collection_name}")
                    else:
                        logger.info(f"No documents matching file_id {file_id} found in {collection_name}")
                        
                except Exception as query_err:
                    logger.error(f"Error querying collection: {str(query_err)}")
                    continue
                
            except Exception as collection_err:
                logger.error(f"Error with collection {collection_name}: {str(collection_err)}")
                continue
                
        logger.info(f"Document deletion process completed for file_id {file_id}")
        
    except Exception as e:
        logger.error(f"Error in delete_document_from_chroma: {str(e)}")
        # Don't re-raise to prevent disrupting the calling function
    finally:
        # Clean up the client after we're done
        if 'chroma_client' in locals():
            del chroma_client
            logger.debug("ChromaDB client cleaned up in delete_document_from_chroma")


def delete_video_from_chroma(bot_id: int, video_id: str):
    """Deletes YouTube video documents from ChromaDB."""
    logger.info(f"Starting YouTube video deletion process for bot {bot_id}, video_id {video_id}")
    
    try:
        # Format the video ID consistently with how it was stored
        standard_id = f"youtube_{video_id}"
        video_id_str = str(video_id)
        
        # Create new client instance for this operation
        chroma_client = get_chroma_client()
        
        # List all collections
        collections = chroma_client.list_collections()
        
        # Safely determine if we're using new or old API
        try:
            # First, assume we're using the new API (v0.6.0+)
            is_new_api = all(isinstance(item, str) for item in collections) if collections else True
            
            if not is_new_api:
                # Try to get collection names using old API style
                try:
                    if collections and len(collections) > 0:
                        test_name = collections[0].name
                        logger.debug("Using old ChromaDB API style (pre-0.6.0)")
                        bot_collections = [collection.name for collection in collections if f"bot_{bot_id}_" in collection.name]
                    else:
                        bot_collections = []
                except Exception as e:
                    logger.debug(f"Error checking collection type: {str(e)}")
                    logger.debug("Defaulting to new ChromaDB API style (0.6.0+)")
                    bot_collections = [name for name in collections if f"bot_{bot_id}_" in name]
            else:
                logger.debug("Using new ChromaDB API style (0.6.0+)")
                bot_collections = [name for name in collections if f"bot_{bot_id}_" in name]
        except Exception as e:
            logger.warning(f"Error determining ChromaDB API version: {str(e)}")
            bot_collections = [name for name in collections if f"bot_{bot_id}_" in name] if isinstance(collections, list) else []
        
        if not bot_collections:
            logger.warning(f"No collections found for bot {bot_id}")
            return False
            
        logger.info(f"Found collections for bot {bot_id}: {bot_collections}")
        
        # Try each collection and delete matching documents
        for collection_name in bot_collections:
            try:
                logger.info(f"Checking collection: {collection_name}")
                collection = chroma_client.get_collection(name=collection_name)
                
                if collection.count() == 0:
                    logger.warning(f"Collection {collection_name} is empty, skipping")
                    continue
                
                # Try different metadata fields that might contain the video ID
                try:
                    # Try with 'id' field first (our new standardized approach)
                    results = collection.get(
                        where={"id": standard_id},
                        include=["metadatas", "documents"]
                    )
                    
                    # If no results, try with 'video_id' field (older approach)
                    if not results["ids"] or len(results["ids"]) == 0:
                        logger.debug(f"No documents found with id={standard_id}, trying video_id field")
                        results = collection.get(
                            where={"video_id": video_id_str},
                            include=["metadatas", "documents"]
                        )
                    
                    if results["ids"] and len(results["ids"]) > 0:
                        logger.info(f"Found {len(results['ids'])} YouTube documents to delete in {collection_name}")
                        
                        # Delete the documents
                        collection.delete(ids=results["ids"])
                        logger.info(f"Successfully deleted {len(results['ids'])} YouTube documents from {collection_name}")
                    else:
                        logger.info(f"No YouTube documents found with video_id {video_id} in {collection_name}")
                        
                except Exception as e:
                    logger.warning(f"Error querying collection {collection_name}", 
                                  extra={"bot_id": bot_id, "error": str(e)})
                    continue
                
            except Exception as e:
                logger.warning(f"Error with collection {collection_name}", 
                              extra={"bot_id": bot_id, "error": str(e)})
                continue
                
        logger.info(f"YouTube video deletion process completed for bot {bot_id}, video_id {video_id}")
        return True
        
    except Exception as e:
        error_msg = f"Error deleting YouTube documents from ChromaDB for bot {bot_id}, video_id {video_id}: {str(e)}"
        logger.error(f"YouTube document deletion failed", 
                    extra={"bot_id": bot_id, "video_id": video_id, "error": str(e)})
        return False
    finally:
        # Clean up the client after we're done
        if 'chroma_client' in locals():
            del chroma_client
            logger.debug("ChromaDB client cleaned up in delete_video_from_chroma")


def delete_url_from_chroma(bot_id: int, url: str):
    """Deletes website documents from ChromaDB."""
    logger.info(f"Starting website deletion process for bot {bot_id}, url {url}")
    
    try:
        # Create a consistent ID for the URL (MD5 hash, same as in scraper.py)
        import hashlib
        website_id = hashlib.md5(url.encode()).hexdigest()
        url_str = str(url)
        
        # Create new client instance for this operation
        chroma_client = get_chroma_client()
        
        # List all collections
        collections = chroma_client.list_collections()
        
        # Safely determine if we're using new or old API
        try:
            # First, assume we're using the new API (v0.6.0+)
            is_new_api = all(isinstance(item, str) for item in collections) if collections else True
            
            if not is_new_api:
                # Try to get collection names using old API style
                try:
                    if collections and len(collections) > 0:
                        test_name = collections[0].name
                        logger.debug("Using old ChromaDB API style (pre-0.6.0)")
                        bot_collections = [collection.name for collection in collections if f"bot_{bot_id}_" in collection.name]
                    else:
                        bot_collections = []
                except Exception as e:
                    logger.debug(f"Error checking collection type: {str(e)}")
                    logger.debug("Defaulting to new ChromaDB API style (0.6.0+)")
                    bot_collections = [name for name in collections if f"bot_{bot_id}_" in name]
            else:
                logger.debug("Using new ChromaDB API style (0.6.0+)")
                bot_collections = [name for name in collections if f"bot_{bot_id}_" in name]
        except Exception as e:
            logger.warning(f"Error determining ChromaDB API version: {str(e)}")
            bot_collections = [name for name in collections if f"bot_{bot_id}_" in name] if isinstance(collections, list) else []
        
        if not bot_collections:
            logger.warning(f"No collections found for bot {bot_id}")
            return False
            
        logger.info(f"Found collections for bot {bot_id}: {bot_collections}")
        
        # Try each collection and delete matching documents
        for collection_name in bot_collections:
            try:
                logger.info(f"Checking collection: {collection_name}")
                collection = chroma_client.get_collection(name=collection_name)
                
                if collection.count() == 0:
                    logger.warning(f"Collection {collection_name} is empty, skipping")
                    continue
                
                # Try different metadata fields that might contain the URL
                try:
                    # Try with 'id' field first (our new standardized approach)
                    results = collection.get(
                        where={"id": website_id},
                        include=["metadatas", "documents"]
                    )
                    
                    # If no results, try with 'website_url' field (older approach)
                    if not results["ids"] or len(results["ids"]) == 0:
                        logger.debug(f"No documents found with id={website_id}, trying website_url field")
                        try:
                            results = collection.get(
                                where={"website_url": url_str},
                                include=["metadatas", "documents"]
                            )
                        except Exception as web_err:
                            logger.debug(f"Error querying with website_url: {str(web_err)}, trying url field")
                            results = collection.get(
                                where={"url": url_str},
                                include=["metadatas", "documents"]
                            )
                    
                    if results["ids"] and len(results["ids"]) > 0:
                        logger.info(f"Found {len(results['ids'])} website documents to delete in {collection_name}")
                        
                        # Delete the documents
                        collection.delete(ids=results["ids"])
                        logger.info(f"Successfully deleted {len(results['ids'])} website documents from {collection_name}")
                    else:
                        logger.info(f"No website documents found with URL {url} in {collection_name}")
                        
                except Exception as e:
                    logger.warning(f"Error querying collection {collection_name}", 
                                  extra={"bot_id": bot_id, "error": str(e)})
                    continue
                
            except Exception as e:
                logger.warning(f"Error with collection {collection_name}", 
                              extra={"bot_id": bot_id, "error": str(e)})
                continue
                
        logger.info(f"Website deletion process completed for bot {bot_id}, URL {url}")
        return True
        
    except Exception as e:
        error_msg = f"Error deleting website documents from ChromaDB for bot {bot_id}, URL {url}: {str(e)}"
        logger.error(f"Website document deletion failed", 
                    extra={"bot_id": bot_id, "url": url, "error": str(e)})
        return False
    finally:
        # Clean up the client after we're done
        if 'chroma_client' in locals():
            del chroma_client
            logger.debug("ChromaDB client cleaned up in delete_url_from_chroma")


def delete_bot_collections(bot_id: int):
    """Deletes all Chroma collections for a specific bot."""
    logger.info(f"Starting Chroma collection deletion for bot {bot_id}")
    
    try:
        # Create new client instance for this operation
        chroma_client = get_chroma_client()
        
        # List all collections
        collections = chroma_client.list_collections()
        
        # Safely determine if we're using new or old API
        try:
            # First, assume we're using the new API (v0.6.0+)
            is_new_api = all(isinstance(item, str) for item in collections) if collections else True
            
            if not is_new_api:
                # Try to get collection names using old API style
                try:
                    if collections and len(collections) > 0:
                        test_name = collections[0].name
                        logger.debug("Using old ChromaDB API style (pre-0.6.0)")
                        bot_collections = [collection.name for collection in collections if f"bot_{bot_id}_" in collection.name]
                    else:
                        bot_collections = []
                except Exception as e:
                    logger.debug(f"Error checking collection type: {str(e)}")
                    logger.debug("Defaulting to new ChromaDB API style (0.6.0+)")
                    bot_collections = [name for name in collections if f"bot_{bot_id}_" in name]
            else:
                logger.debug("Using new ChromaDB API style (0.6.0+)")
                bot_collections = [name for name in collections if f"bot_{bot_id}_" in name]
        except Exception as e:
            logger.warning(f"Error determining ChromaDB API version: {str(e)}")
            bot_collections = [name for name in collections if f"bot_{bot_id}_" in name] if isinstance(collections, list) else []
        
        if not bot_collections:
            logger.warning(f"No collections found for bot {bot_id}")
            return False
            
        logger.info(f"Found {len(bot_collections)} collections for bot {bot_id}: {bot_collections}")
        
        # Delete each collection
        for collection_name in bot_collections:
            try:
                logger.info(f"Deleting collection: {collection_name}")
                chroma_client.delete_collection(name=collection_name)
                logger.info(f"Successfully deleted collection {collection_name}")
            except Exception as e:
                logger.error(f"Error deleting collection {collection_name}: {str(e)}")
                continue
                
        logger.info(f"Chroma collection deletion completed for bot {bot_id}")
        return True
        
    except Exception as e:
        error_msg = f"Error deleting Chroma collections for bot {bot_id}: {str(e)}"
        logger.error(f"Chroma collection deletion failed", 
                    extra={"bot_id": bot_id, "error": str(e)})
        return False
    finally:
        # Clean up the client after we're done
        if 'chroma_client' in locals():
            del chroma_client
            logger.debug("ChromaDB client cleaned up in delete_bot_collections")


def delete_user_collections(bot_ids: list):
    """Deletes all Chroma collections for all bots belonging to a user."""
    logger.info(f"Starting Chroma collection deletion for user's bots: {bot_ids}")
    
    success = True
    for bot_id in bot_ids:
        try:
            result = delete_bot_collections(bot_id)
            if not result:
                logger.warning(f"Failed to delete collections for bot {bot_id}")
                success = False
        except Exception as e:
            logger.error(f"Error in delete_bot_collections for bot {bot_id}: {str(e)}")
            success = False
            
    return success
