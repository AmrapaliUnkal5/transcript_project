# app/embedding_manager.py
from langchain_openai import OpenAIEmbeddings
from langchain_community.embeddings import HuggingFaceInferenceAPIEmbeddings
import os
from app.database import SessionLocal
from app.models import EmbeddingModel as EmbeddingModelDB
from app.config import settings
import requests
import numpy as np
from app.utils.model_selection import get_embedding_model_for_bot
from app.utils.ai_logger import log_embedding_request, log_embedding_result
import time

class HuggingFaceAPIEmbedder:
    """Custom HuggingFace API embedder that uses the Inference API"""
    
    def __init__(self, model_name, api_key):
        self.model_name = model_name
        self.api_key = api_key
        self.api_url = f"https://api-inference.huggingface.co/pipeline/feature-extraction/{model_name}"
        self.headers = {"Authorization": f"Bearer {api_key}"}
        
        # Skip direct validation - we'll test with actual embedding instead
        print(f"🔄 Initialized HuggingFace embedder for model: {model_name}")
        
    def embed_query(self, text):
        """Get embeddings for a query text"""
        return self._get_embedding(text)
        
    def embed_documents(self, texts):
        """Get embeddings for a list of documents"""
        return [self._get_embedding(text) for text in texts]
        
    def _get_embedding(self, text):
        """Call Hugging Face Inference API to get embedding"""
        if not self.api_key:
            raise ValueError("Hugging Face API key not configured")
            
        try:
            print(f"🔄 Getting embedding from HuggingFace API for model: {self.model_name}")
            response = requests.post(
                self.api_url,
                headers=self.headers,
                json={"inputs": text, "options": {"wait_for_model": True, "use_cache": True}}
            )
            
            if response.status_code != 200:
                error_message = f"Error from HuggingFace API: {response.status_code}"
                try:
                    error_json = response.json()
                    if 'error' in error_json:
                        error_message = f"Error from HuggingFace API: {error_json['error']}"
                except:
                    pass
                print(f"❌ {error_message}")
                print(f"API Response: {response.text}")
                raise ValueError(error_message)
                
            # The API returns the embedding as a list of floats
            embedding = response.json()
            
            # If embedding is a nested structure (sentences, tokens), flatten to get a single vector
            if isinstance(embedding, list) and isinstance(embedding[0], list):
                # Average sentence embeddings (if model returns embeddings per sentence)
                embedding = np.mean(embedding, axis=0).tolist()
                
            if embedding:
                print(f"✅ Successfully got embedding with length: {len(embedding)}")
                
            return embedding
            
        except Exception as e:
            print(f"❌ Error getting embedding from HuggingFace API: {str(e)}")
            raise e

class EmbeddingManager:
    def __init__(self, model_name: str = None, bot_id: int = None, user_id: int = None):
        """
        Initialize the embedding manager with a model name or by dynamically selecting a model
        based on bot and user information.
        
        Args:
            model_name: Optional explicit model name to use
            bot_id: Optional bot ID for model selection
            user_id: Optional user ID for model selection
        """
        self.bot_id = bot_id
        self.user_id = user_id
        
        db = SessionLocal()
        try:
            # If bot_id and user_id are provided, get the model dynamically
            if bot_id and user_id:
                embedding_model = get_embedding_model_for_bot(db, bot_id, user_id)
                if embedding_model:
                    self.model_name = embedding_model.name.lower()
                    self.model_info = {
                        "name": embedding_model.name,
                        "provider": embedding_model.provider,
                        "dimension": embedding_model.dimension
                    }
                else:
                    # Fallback to default model
                    default_model = db.query(EmbeddingModelDB).filter(EmbeddingModelDB.is_active == True).first()
                    if default_model:
                        self.model_name = default_model.name.lower()
                        self.model_info = {
                            "name": default_model.name,
                            "provider": default_model.provider,
                            "dimension": default_model.dimension
                        }
                    else:
                        raise ValueError("No active embedding models found in the database")
            # Otherwise use the specified model name
            elif model_name:
                self.model_name = model_name.lower()
                self.model_info = self._get_model_info(self.model_name)
            else:
                # If no parameters are provided, use the first active model
                default_model = db.query(EmbeddingModelDB).filter(EmbeddingModelDB.is_active == True).first()
                if default_model:
                    self.model_name = default_model.name.lower()
                    self.model_info = {
                        "name": default_model.name,
                        "provider": default_model.provider,
                        "dimension": default_model.dimension
                    }
                else:
                    raise ValueError("No active embedding models found in the database")
        finally:
            db.close()
            
        self.target_dimension = self.model_info.get("dimension") if self.model_info else None
        self.embedder = self._initialize_embedder(test_embedder=False)

    def _adjust_dimension(self, embedding):
        """Adjust embedding length to match DB-configured dimension, if provided.

        Rules:
        - If lengths match or no target set, return as-is
        - If embedding is longer and divisible by target, average contiguous blocks
          (e.g., 3072 -> 1536 by averaging pairs)
        - If longer but not divisible, truncate to target
        - If shorter, zero-pad to target
        """
        try:
            if not isinstance(embedding, (list, tuple)):
                return embedding
            if not self.target_dimension or self.target_dimension <= 0:
                return embedding
            current_dim = len(embedding)
            if current_dim == self.target_dimension:
                return embedding
            arr = np.asarray(embedding, dtype=float)
            if current_dim > self.target_dimension:
                factor = current_dim // self.target_dimension
                if factor > 1 and current_dim % self.target_dimension == 0:
                    reshaped = arr.reshape(self.target_dimension, factor)
                    reduced = reshaped.mean(axis=1)
                    return reduced.tolist()
                # Fallback: truncate
                return arr[: self.target_dimension].tolist()
            # current_dim < target: pad with zeros
            padded = np.zeros(self.target_dimension, dtype=float)
            padded[: current_dim] = arr
            return padded.tolist()
        except Exception:
            # On any unexpected issue, return original embedding
            return embedding
        
    def _get_model_info(self, model_name):
        """Get model information from the database"""
        db = SessionLocal()
        try:
            # Try to get the model by case-insensitive name
            model = db.query(EmbeddingModelDB).filter(
                EmbeddingModelDB.name.ilike(model_name)
            ).first()
            
            if model:
                print(f"✅ Found embedding model in database: {model.name} ({model.provider})")
                return {
                    "name": model.name,  # Use exact name from database
                    "provider": model.provider,
                    "dimension": model.dimension
                }
            else:
                print(f"⚠️ Model {model_name} not found in database")
                raise ValueError(f"Embedding model '{model_name}' not found in database")
        finally:
            db.close()
    
    def _initialize_embedder(self, test_embedder=False):
        """Initialize the appropriate embedder based on model info"""
        try:
            provider = self.model_info.get("provider", "").lower()
            model_name = self.model_info.get("name", "")  # Use exact name from database
            
            print(f"🔄 Initializing embedder for {model_name} (provider: {provider})")
            
            if provider == "openai":
                # For OpenAI models
                print(f"🔄 Using OpenAI embeddings with model: {model_name}")
                openai_api_key = settings.OPENAI_API_KEY
                
                if not openai_api_key:
                    print("❌ OpenAI API key not configured in settings")
                    raise ValueError("OpenAI API key not configured")
                
                try:
                    # Create embeddings with explicit API key
                    embedder = OpenAIEmbeddings(
                        model=model_name,
                        openai_api_key=openai_api_key
                    )
                    
                    # Test the embedder if requested
                    if test_embedder:
                        print(f"🔄 Testing OpenAI model with a simple query")
                        test_result = embedder.embed_query("test")
                        
                        if not test_result:
                            print("❌ Got empty embedding from OpenAI API")
                            raise ValueError("Failed to get valid embedding from OpenAI API")
                            
                        print(f"✅ OpenAI model test successful. Embedding length: {len(test_result)}")
                    
                    return embedder
                except Exception as e:
                    print(f"❌ Error initializing OpenAI embedder: {str(e)}")
                    raise ValueError(f"Error initializing OpenAI embedder: {str(e)}")
                
            elif provider == "huggingface":
                # For HuggingFace models using Inference API
                print(f"🔄 Using HuggingFace Inference API with model: {model_name}")
                huggingface_api_key = settings.HUGGINGFACE_API_KEY
                
                if not huggingface_api_key:
                    raise ValueError("HuggingFace API key not configured")
                    
                try:
                    # Create the embedder first
                    embedder = HuggingFaceAPIEmbedder(model_name, huggingface_api_key)
                    
                    # Test the embedder only if requested
                    if test_embedder:
                        print(f"🔄 Testing HuggingFace model with a simple query")
                        test_result = embedder.embed_query("test")
                        
                        if not test_result:
                            print("❌ Got empty embedding from HuggingFace API")
                            raise ValueError("Failed to get valid embedding from HuggingFace API")
                            
                        print(f"✅ HuggingFace model test successful. Embedding length: {len(test_result)}")
                    
                    return embedder
                except Exception as e:
                    print(f"❌ Error initializing HuggingFace embedder: {str(e)}")
                    # Try with alternative model name format
                    if '/' in model_name:
                        try:
                            print(f"🔄 Trying alternate model name format...")
                            # Some models might be registered under different namespaces
                            # For example, BAAI models might be under FlagEmbedding namespace
                            if model_name.startswith("BAAI/"):
                                alt_model_name = model_name.replace("BAAI/", "FlagEmbedding/")
                                print(f"🔄 Trying alternate model name: {alt_model_name}")
                                embedder = HuggingFaceAPIEmbedder(alt_model_name, huggingface_api_key)
                                
                                if test_embedder:
                                    test_result = embedder.embed_query("test")
                                    if test_result:
                                        print(f"✅ Alternative model name worked: {alt_model_name}")
                                
                                return embedder
                        except Exception as alt_e:
                            print(f"❌ Alternative model name also failed: {str(alt_e)}")
                            
                    raise ValueError(f"Error initializing HuggingFace embedder: {str(e)}")
            else:
                raise ValueError(f"Unsupported provider: {provider}")
                
        except Exception as e:
            print(f"❌ Error initializing embedder: {str(e)}")
            raise e  # Re-raise the error to be handled by the caller

    def embed_query(self, text: str) -> list[float]:
        """Embed a query text and log the process"""
        start_time = time.time()
        
        # Log the embedding request
        if self.user_id and self.bot_id:
            log_embedding_request(
                user_id=self.user_id,
                bot_id=self.bot_id,
                text=text,
                model_name=self.model_name
            )
        
        try:
            # Get the embedding
            embedding = self.embedder.embed_query(text)
            embedding = self._adjust_dimension(embedding)
            
            # Calculate duration
            duration_ms = int((time.time() - start_time) * 1000)
            
            # Log the successful result
            if self.user_id and self.bot_id:
                dimension = len(embedding) if embedding else 0
                log_embedding_result(
                    user_id=self.user_id,
                    bot_id=self.bot_id,
                    model_name=self.model_name,
                    dimension=dimension,
                    duration_ms=duration_ms,
                    success=True
                )
            
            return embedding
        except Exception as e:
            # Calculate duration even for failures
            duration_ms = int((time.time() - start_time) * 1000)
            
            # Log the failed result
            if self.user_id and self.bot_id:
                log_embedding_result(
                    user_id=self.user_id,
                    bot_id=self.bot_id,
                    model_name=self.model_name,
                    dimension=0,
                    duration_ms=duration_ms,
                    success=False,
                    error=str(e)
                )
            
            # Re-raise the exception
            raise e

    def embed_document(self, text: str) -> list[float]:
        """Embed a document text and log the process"""
        start_time = time.time()
        
        # Log the embedding request
        if self.user_id and self.bot_id:
            log_embedding_request(
                user_id=self.user_id,
                bot_id=self.bot_id,
                text=text,
                model_name=self.model_name
            )
        
        try:
            # Use embed_documents if available, otherwise use embed_query
            if hasattr(self.embedder, 'embed_documents'):
                embedding = self.embedder.embed_documents([text])[0]
            else:
                embedding = self.embedder.embed_query(text)
            embedding = self._adjust_dimension(embedding)
            
            # Calculate duration
            duration_ms = int((time.time() - start_time) * 1000)
            
            # Log the successful result
            if self.user_id and self.bot_id:
                dimension = len(embedding) if embedding else 0
                log_embedding_result(
                    user_id=self.user_id,
                    bot_id=self.bot_id,
                    model_name=self.model_name,
                    dimension=dimension,
                    duration_ms=duration_ms,
                    success=True
                )
            
            return embedding
        except Exception as e:
            # Calculate duration even for failures
            duration_ms = int((time.time() - start_time) * 1000)
            
            # Log the failed result
            if self.user_id and self.bot_id:
                log_embedding_result(
                    user_id=self.user_id,
                    bot_id=self.bot_id,
                    model_name=self.model_name,
                    dimension=0,
                    duration_ms=duration_ms,
                    success=False,
                    error=str(e)
                )
            
            # Re-raise the exception
            raise e
