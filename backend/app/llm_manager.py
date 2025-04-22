# app/llm_manager.py
import openai
import os
from openai import OpenAI
from openai.types.chat import ChatCompletion
import requests
from app.database import SessionLocal
from app.models import LLMModel as LLMModelDB
from app.config import settings
from app.utils.model_selection import get_llm_model_for_bot

class HuggingFaceLLM:
    """Class for generating text using HuggingFace Inference API."""
    
    def __init__(self, model_name: str, api_key: str):
        self.model_name = model_name
        self.api_key = api_key
        self.api_url = f"https://api-inference.huggingface.co/models/{model_name}"
        self.headers = {"Authorization": f"Bearer {api_key}"}
        
        print(f"🔄 Initialized HuggingFace LLM with model: {model_name}")
    
    def generate(self, context: str, user_message: str, temperature: float = 0.7) -> str:
        """Generate a response using the HuggingFace model."""
        try:
            # Construct the prompt based on the type of model
            # Check if there's an instruction about external knowledge in the context
            use_external_knowledge = "general knowledge" in context.lower()
            
            # For chat models like Llama and Mistral
            if use_external_knowledge:
                # If context contains instruction about external knowledge
                prompt = f"<s>[INST] You are a helpful assistant. Answer based on the provided context, but you can use your general knowledge if needed.\n\nContext: {context}\n\nUser: {user_message} [/INST]</s>"
            else:
                # Standard strict context prompt
                prompt = f"<s>[INST] You are a helpful assistant. Only answer based on the provided context. If the context doesn't have relevant information, say you don't know.\n\nContext: {context}\n\nUser: {user_message} [/INST]</s>"
            
            # Make request to the Hugging Face Inference API
            print(f"🔄 Sending request to HuggingFace Inference API for model: {self.model_name}")
            response = requests.post(
                self.api_url,
                headers=self.headers,
                json={
                    "inputs": prompt,
                    "parameters": {
                        "max_new_tokens": 250,
                        "temperature": temperature,
                        "do_sample": True,
                        "return_full_text": False
                    },
                    "options": {
                        "wait_for_model": True,
                        "use_cache": True
                    }
                }
            )
            
            # Handle response
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
            
            # Extract the generated text
            result = response.json()
            if isinstance(result, list) and len(result) > 0:
                generated_text = result[0].get("generated_text", "")
                print(f"✅ Successfully generated response with HuggingFace")
                return generated_text
            else:
                print(f"❌ Unexpected response format: {result}")
                return "I'm sorry, I'm experiencing some technical difficulties at the moment. Please try again later."
                
        except Exception as e:
            print(f"❌ Error generating response with HuggingFace LLM: {str(e)}")
            return "I'm sorry, I'm experiencing some technical difficulties at the moment. Please try again later."

class LLMManager:
    def __init__(self, model_name: str = None, bot_id: int = None, user_id: int = None):
        """
        Initialize the LLM manager with a specific model name or by dynamically selecting a model
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
                llm_model = get_llm_model_for_bot(db, bot_id, user_id)
                if llm_model:
                    self.model_name = llm_model.name
                    self.model_info = {
                        "name": llm_model.name,
                        "provider": llm_model.provider,
                        "model_type": llm_model.model_type,
                        "endpoint": llm_model.endpoint
                    }
                else:
                    # Fallback to default model
                    default_model = db.query(LLMModelDB).filter(LLMModelDB.is_active == True).first()
                    if default_model:
                        self.model_name = default_model.name
                        self.model_info = {
                            "name": default_model.name,
                            "provider": default_model.provider,
                            "model_type": default_model.model_type,
                            "endpoint": default_model.endpoint
                        }
                    else:
                        # Ultimate fallback to Mistral if no models in DB
                        self.model_name = "mistralai/Mistral-7B-Instruct-v0.2"
                        self.model_info = {
                            "name": "mistralai/Mistral-7B-Instruct-v0.2",
                            "provider": "huggingface",
                            "model_type": "chat",
                            "endpoint": None
                        }
            # Otherwise use the specified model name or default
            elif model_name:
                self.model_name = model_name
                self.model_info = self._get_model_info(self.model_name)
            else:
                # If no parameters are provided, use the first active model
                default_model = db.query(LLMModelDB).filter(LLMModelDB.is_active == True).first()
                if default_model:
                    self.model_name = default_model.name
                    self.model_info = {
                        "name": default_model.name,
                        "provider": default_model.provider,
                        "model_type": default_model.model_type,
                        "endpoint": default_model.endpoint
                    }
                else:
                    # Ultimate fallback to Mistral
                    self.model_name = "mistralai/Mistral-7B-Instruct-v0.2"
                    self.model_info = {
                        "name": "mistralai/Mistral-7B-Instruct-v0.2",
                        "provider": "huggingface",
                        "model_type": "chat",
                        "endpoint": None
                    }
        finally:
            db.close()
            
        self.llm = self._initialize_llm()
    
    def _get_model_info(self, model_name):
        """Get model information from the database."""
        db = SessionLocal()
        try:
            # Try to get the model by case-insensitive name
            model = db.query(LLMModelDB).filter(
                LLMModelDB.name.ilike(model_name)
            ).first()
            
            if model:
                print(f"✅ Found LLM model in database: {model.name} ({model.provider})")
                return {
                    "name": model.name,  # Use exact name from database
                    "provider": model.provider,
                    "model_type": model.model_type,
                    "endpoint": model.endpoint
                }
            else:
                print(f"⚠️ Model {model_name} not found in database, using default HuggingFace model")
                # If the specific model is not found, use a default HuggingFace model
                return {
                    "name": "mistralai/Mistral-7B-Instruct-v0.2",
                    "provider": "huggingface",
                    "model_type": "chat",
                    "endpoint": None
                }
        finally:
            db.close()
    
    def _initialize_llm(self):
        """Initialize the appropriate LLM based on model info."""
        provider = self.model_info.get("provider", "").lower()
        model_name = self.model_info.get("name", "")
        
        print(f"🔄 Initializing LLM for {model_name} (provider: {provider})")
        
        if provider == "openai":
            # For OpenAI models
            api_key = os.getenv("OPENAI_API_KEY")
            if not api_key:
                raise ValueError("OPENAI_API_KEY is not set")
            
            print(f"🔄 Using OpenAI with model: {model_name}")
            return OpenAI(api_key=api_key)
            
        elif provider == "huggingface":
            # For HuggingFace models
            huggingface_api_key = settings.HUGGINGFACE_API_KEY
            
            if not huggingface_api_key:
                print("❌ No HuggingFace API key found, falling back to OpenAI")
                # Fall back to OpenAI
                api_key = os.getenv("OPENAI_API_KEY")
                if not api_key:
                    raise ValueError("Neither HUGGINGFACE_API_KEY nor OPENAI_API_KEY is set")
                return OpenAI(api_key=api_key)
            
            print(f"🔄 Using HuggingFace LLM with model: {model_name}")
            return HuggingFaceLLM(model_name, huggingface_api_key)
        else:
            # Default to HuggingFace if provider is unknown
            print(f"⚠️ Unknown provider: {provider}, falling back to HuggingFace")
            huggingface_api_key = settings.HUGGINGFACE_API_KEY
            
            if not huggingface_api_key:
                print("❌ No HuggingFace API key found, falling back to OpenAI")
                # Fall back to OpenAI
                api_key = os.getenv("OPENAI_API_KEY")
                if not api_key:
                    raise ValueError("Neither HUGGINGFACE_API_KEY nor OPENAI_API_KEY is set")
                return OpenAI(api_key=api_key)
            
            default_model = "mistralai/Mistral-7B-Instruct-v0.2"
            print(f"🔄 Using default HuggingFace LLM with model: {default_model}")
            return HuggingFaceLLM(default_model, huggingface_api_key)

    def generate(self, context: str, user_message: str, use_external_knowledge: bool = False, temperature: float = 0.7) -> str:
        """
        Generate a response using the specified LLM.
        
        Args:
            context (str): The context from retrieved documents
            user_message (str): The user's query
            use_external_knowledge (bool): Whether to use external knowledge if context is insufficient
            temperature (float): The temperature value to control randomness in LLM responses
        """
        provider = self.model_info.get("provider", "").lower()
        model_name = self.model_info.get("name", "")
        
        print(f"🔄 Generating response with {model_name} ({provider})")
        print(f"🔍 External knowledge enabled: {use_external_knowledge}")
        print(f"🌡️ Using temperature: {temperature}")
        
        try:
            if provider == "openai":
                # Create system message based on external_knowledge flag
                system_content = (
                    "You are a helpful assistant. Answer the user's question based on the provided context. "
                    "If the context doesn't contain relevant information, "
                )
                
                if use_external_knowledge:
                    system_content += "you can use your general knowledge to provide a helpful response."
                    print("✅ External knowledge mode: Will use general knowledge if context is insufficient")
                else:
                    system_content += "politely say you don't have that information."
                    print("✅ Strict context mode: Will only use provided context")
                
                response = self.llm.chat.completions.create(
                    model=model_name,
                    messages=[
                        {"role": "system", "content": system_content},
                        {"role": "user", "content": f"Context: {context}\nUser: {user_message}\nBot:"}
                    ],
                    temperature=temperature,
                    max_tokens=250
                )
                return response.choices[0].message.content
                
            elif provider == "huggingface":
                # HuggingFaceLLM handles the API call
                # Add external knowledge flag to prompt
                if use_external_knowledge:
                    # Modify the prompt to include instructions about external knowledge
                    enhanced_context = f"{context}\n\nIf the context above doesn't answer the question, you can use your general knowledge."
                    return self.llm.generate(enhanced_context, user_message, temperature)
                else:
                    return self.llm.generate(context, user_message, temperature)
            else:
                raise ValueError(f"Unsupported provider: {provider}")
        except Exception as e:
            print(f"❌ Error generating response: {str(e)}")
            return "I'm sorry, I'm experiencing some technical difficulties at the moment. Please try again later."
