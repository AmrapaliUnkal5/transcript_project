import logging
import json
from typing import Dict, Any, Optional, List, Union
from app.utils.logging_config import get_logger

# Create a dedicated logger for AI tasks
ai_logger = get_logger("ai_tasks")

def log_embedding_request(user_id: int, bot_id: int, text: str, model_name: str, extra: Optional[Dict[str, Any]] = None):
    """
    Log an embedding request
    
    Args:
        user_id: The user ID
        bot_id: The bot ID
        text: The text being embedded (truncated for logging)
        model_name: The embedding model name
        extra: Additional context to include
    """
    log_data = {
        "event_type": "embedding_request",
        "user_id": user_id,
        "bot_id": bot_id,
        "model_name": model_name,
        "text_length": len(text),
        "text_preview": text[:100] + "..." if len(text) > 100 else text
    }
    
    if extra:
        log_data.update(extra)
    
    ai_logger.info("Embedding request", extra={"ai_task": log_data})

def log_embedding_result(user_id: int, bot_id: int, model_name: str, dimension: int, duration_ms: int, success: bool, error: Optional[str] = None, extra: Optional[Dict[str, Any]] = None):
    """
    Log an embedding result
    
    Args:
        user_id: The user ID
        bot_id: The bot ID
        model_name: The embedding model name
        dimension: The embedding dimension
        duration_ms: The duration in milliseconds
        success: Whether the embedding was successful
        error: Error message if not successful
        extra: Additional context to include
    """
    log_data = {
        "event_type": "embedding_result",
        "user_id": user_id,
        "bot_id": bot_id,
        "model_name": model_name,
        "dimension": dimension,
        "duration_ms": duration_ms,
        "success": success
    }
    
    if error:
        log_data["error"] = error
    
    if extra:
        log_data.update(extra)
    
    ai_logger.info("Embedding result", extra={"ai_task": log_data})

def log_document_storage(user_id: int, bot_id: int, collection_name: str, document_count: int, metadata: Dict[str, Any], extra: Optional[Dict[str, Any]] = None):
    """
    Log document storage in vector database
    
    Args:
        user_id: The user ID
        bot_id: The bot ID
        collection_name: The name of the collection
        document_count: The number of documents stored
        metadata: The document metadata
        extra: Additional context to include
    """
    log_data = {
        "event_type": "document_storage",
        "user_id": user_id,
        "bot_id": bot_id,
        "collection_name": collection_name,
        "document_count": document_count,
        "metadata": metadata
    }
    
    if extra:
        log_data.update(extra)
    
    ai_logger.info("Vector DB document storage", extra={"ai_task": log_data})

def log_document_retrieval(user_id: int, bot_id: int, query: str, collection_name: str, results_count: int, results: List[Dict[str, Any]], extra: Optional[Dict[str, Any]] = None):
    """
    Log document retrieval from vector database
    
    Args:
        user_id: The user ID
        bot_id: The bot ID
        query: The search query (truncated for logging)
        collection_name: The name of the collection
        results_count: The number of results retrieved
        results: The retrieval results (metadata only)
        extra: Additional context to include
    """
    # Prepare a safe version of results with just metadata and scores
    safe_results = []
    for r in results[:5]:  # Only log first 5 results to avoid excessive logging
        safe_result = {
            "score": r.get("score", 0),
            "metadata": r.get("metadata", {})
        }
        safe_results.append(safe_result)
    
    log_data = {
        "event_type": "document_retrieval",
        "user_id": user_id,
        "bot_id": bot_id,
        "query_preview": query[:100] + "..." if len(query) > 100 else query,
        "collection_name": collection_name,
        "results_count": results_count,
        "top_results": safe_results
    }
    
    if extra:
        log_data.update(extra)
    
    ai_logger.info("Vector DB document retrieval", extra={"ai_task": log_data})

def log_llm_request(user_id: int, bot_id: int, model_name: str, provider: str, temperature: float, 
                   query: str, context_length: int, use_external_knowledge: bool, 
                   chat_history_msgs: Optional[int] = None, extra: Optional[Dict[str, Any]] = None):
    """
    Log an LLM request
    
    Args:
        user_id: The user ID
        bot_id: The bot ID
        model_name: The LLM model name
        provider: The LLM provider (openai, huggingface, etc.)
        temperature: The temperature setting
        query: The user query (truncated for logging)
        context_length: The length of the context provided
        use_external_knowledge: Whether external knowledge was allowed
        chat_history_msgs: Number of chat history messages included
        extra: Additional context to include
    """
    log_data = {
        "event_type": "llm_request",
        "user_id": user_id,
        "bot_id": bot_id,
        "model_name": model_name,
        "provider": provider,
        "temperature": temperature,
        "query_preview": query[:100] + "..." if len(query) > 100 else query,
        "context_length": context_length,
        "use_external_knowledge": use_external_knowledge,
    }
    
    if chat_history_msgs is not None:
        log_data["chat_history_msgs"] = chat_history_msgs
    
    if extra:
        log_data.update(extra)
    
    ai_logger.info("LLM request", extra={"ai_task": log_data})

def log_llm_response(user_id: int, bot_id: int, model_name: str, provider: str, 
                    duration_ms: int, response_length: int, success: bool, 
                    response: Optional[str] = None, error: Optional[str] = None, 
                    token_usage: Optional[Dict[str, int]] = None, extra: Optional[Dict[str, Any]] = None):
    """
    Log an LLM response
    
    Args:
        user_id: The user ID
        bot_id: The bot ID
        model_name: The LLM model name
        provider: The LLM provider (openai, huggingface, etc.)
        duration_ms: The duration in milliseconds
        response_length: The length of the response
        success: Whether the request was successful
        response: The LLM response (truncated for logging)
        error: Error message if not successful
        token_usage: Token usage information if available
        extra: Additional context to include
    """
    log_data = {
        "event_type": "llm_response",
        "user_id": user_id,
        "bot_id": bot_id,
        "model_name": model_name,
        "provider": provider,
        "duration_ms": duration_ms,
        "response_length": response_length,
        "success": success
    }
    
    if response:
        log_data["response_preview"] = response[:150] + "..." if len(response) > 150 else response
    
    if error:
        log_data["error"] = error
    
    if token_usage:
        log_data["token_usage"] = token_usage
    
    if extra:
        log_data.update(extra)
    
    ai_logger.info("LLM response", extra={"ai_task": log_data})

def log_chat_completion(user_id: int, bot_id: int, user_query: str, bot_response: str, similar_docs_count: int, 
                      interaction_id: Optional[int] = None, extra: Optional[Dict[str, Any]] = None):
    """
    Log a complete chat interaction
    
    Args:
        user_id: The user ID
        bot_id: The bot ID
        user_query: The user query (truncated for logging)
        bot_response: The bot response (truncated for logging)
        similar_docs_count: The number of similar documents retrieved
        interaction_id: The interaction ID if available
        extra: Additional context to include
    """
    log_data = {
        "event_type": "chat_completion",
        "user_id": user_id,
        "bot_id": bot_id,
        "query_preview": user_query[:100] + "..." if len(user_query) > 100 else user_query,
        "response_preview": bot_response[:150] + "..." if len(bot_response) > 150 else bot_response,
        "similar_docs_count": similar_docs_count
    }
    
    if interaction_id:
        log_data["interaction_id"] = interaction_id
    
    if extra:
        log_data.update(extra)
    
    ai_logger.info("Chat completion", extra={"ai_task": log_data})

def log_chunking_operation(user_id: int, bot_id: int, text_length: int, chunk_size: int, chunk_overlap: int,
                         chunks_count: int, file_info: Optional[Dict[str, Any]] = None, extra: Optional[Dict[str, Any]] = None):
    """
    Log a text chunking operation
    
    Args:
        user_id: The user ID
        bot_id: The bot ID
        text_length: The length of the original text
        chunk_size: The chunk size used
        chunk_overlap: The chunk overlap used
        chunks_count: The number of chunks created
        file_info: Information about the file being chunked
        extra: Additional context to include
    """
    log_data = {
        "event_type": "chunking_operation",
        "user_id": user_id,
        "bot_id": bot_id,
        "text_length": text_length,
        "chunk_size": chunk_size,
        "chunk_overlap": chunk_overlap,
        "chunks_count": chunks_count
    }
    
    if file_info:
        log_data["file_info"] = file_info
    
    if extra:
        log_data.update(extra)
    
    ai_logger.info("Text chunking", extra={"ai_task": log_data}) 