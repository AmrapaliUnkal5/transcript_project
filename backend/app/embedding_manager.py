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
            
        self.embedder = self._initialize_embedder(test_embedder=False)
        
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
                return OpenAIEmbeddings(model=model_name)
                
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
        return self.embedder.embed_query(text)

    def embed_document(self, text: str) -> list[float]:
        if hasattr(self.embedder, 'embed_documents'):
            return self.embedder.embed_documents([text])[0]
        else:
            return self.embedder.embed_query(text)
