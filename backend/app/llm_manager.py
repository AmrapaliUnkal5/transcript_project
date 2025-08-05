# app/llm_manager.py
import openai
import os
from openai import OpenAI
from openai.types.chat import ChatCompletion
import requests
from app.database import SessionLocal
from app.models import LLMModel as LLMModelDB, Bot
from app.config import settings
from app.utils.model_selection import get_llm_model_for_bot
from lingua import Language, LanguageDetectorBuilder
from app.addon_service import AddonService
import logging
from app.utils.logger import get_module_logger
# Add langchain imports
from langchain.memory import ConversationBufferMemory
import time
from app.utils.ai_logger import (
    log_llm_request, 
    log_llm_response, 
    ai_logger
)

# Initialize logger
logger = get_module_logger(__name__)

# Create a language detector with common languages instead of all languages
detector = LanguageDetectorBuilder.from_languages(
    Language.ENGLISH,
    Language.SPANISH,
    Language.FRENCH,
    Language.GERMAN,
    Language.ITALIAN,
    Language.PORTUGUESE,
    Language.DUTCH,
    Language.RUSSIAN,
    Language.ARABIC,
    Language.HINDI,
    Language.CHINESE,
    Language.JAPANESE,
    Language.KOREAN
).build()

def detect_language(text):
    """Detect the language of the input text."""
    try:
        if not text or len(text.strip()) < 5:
            return 'en'  # Default to English for very short texts
        
        # Detect language
        detected_language = detector.detect_language_of(text)
        
        # Map the lingua Language enum to ISO code
        if detected_language:
            return detected_language.iso_code_639_1.name.lower()
        else:
            return 'en'  # Default to English if detection fails
    except Exception as e:
        logger.exception(f"Error detecting language: {str(e)}")
        return 'en'  # Default to English on error

class HuggingFaceLLM:
    """Class for generating text using HuggingFace Inference API."""
    
    def __init__(self, model_name: str, api_key: str, max_input_tokens: int = 2048, max_output_tokens: int = 250):
        self.model_name = model_name
        self.api_key = api_key
        self.api_url = f"https://api-inference.huggingface.co/models/{model_name}"
        self.headers = {"Authorization": f"Bearer {api_key}"}
        self.max_input_tokens = max_input_tokens
        self.max_output_tokens = max_output_tokens
        
        print(f"🔄 Initialized HuggingFace LLM with model: {model_name}")
        print(f"📊 Model limits: max_input_tokens={max_input_tokens}, max_output_tokens={max_output_tokens}")
    
    def _truncate_prompt(self, prompt: str, target_length: int = None) -> str:
        """
        Naively truncate prompt text to fit within token limits.
        This is a simple character-based truncation that ensures we stay within limits.
        """
        # Calculate available tokens based on model size
        available_tokens = self.max_input_tokens - min(self.max_output_tokens, 250)
        # For small models like TinyLlama, be more conservative
        if self.max_input_tokens <= 2048:
            available_tokens = self.max_input_tokens - self.max_output_tokens - 100  # extra safety margin for small models
            
        # Use provided target_length or calculate from available tokens
        if target_length is None:
            target_length = available_tokens
            
        # Rough approximation: 4 chars ≈ 1 token (very rough but safer than nothing)
        # This is conservative to ensure we don't exceed limits
        char_limit = max(100, target_length * 4)  # At least keep 100 chars
        
        if len(prompt) > char_limit:
            # If we're dealing with a small model (context ≤ 2048), be very aggressive with truncation
            if self.max_input_tokens <= 2048:
                # Keep the instruction and a small beginning part of the context
                instruction_part = prompt[:200]  # Keep the instruction
                remaining_chars = char_limit - 200
                
                # We'll keep more of the beginning since that's usually more important
                beginning_chars = min(remaining_chars * 2 // 3, 800)
                end_chars = min(remaining_chars - beginning_chars, 200)
                
                truncated_prompt = (
                    instruction_part + 
                    prompt[200:200+beginning_chars] + 
                    "\n...[Content truncated due to length]...\n" +
                    (prompt[-end_chars:] if end_chars > 0 else "")
                )
                print(f"⚠️ Small model detected - Prompt severely truncated from {len(prompt)} chars to {len(truncated_prompt)} chars")
                return truncated_prompt
            
            # Save the instruction part (first 200 chars typically has the instruction)
            instruction_part = prompt[:200]
            # Reserve space for truncation message
            truncation_msg = "\n...[Content truncated due to length]...\n"
            # Calculate remaining space after instruction and truncation message
            remaining_chars = char_limit - len(instruction_part) - len(truncation_msg)
            
            # For larger models, keep both beginning and end parts equally
            context_to_keep = remaining_chars // 2
            
            truncated_prompt = (
                instruction_part + 
                prompt[200:200+context_to_keep] + 
                truncation_msg +
                prompt[-context_to_keep:]
            )
            
            print(f"⚠️ Prompt truncated from {len(prompt)} chars to {len(truncated_prompt)} chars to fit token limits")
            return truncated_prompt
        return prompt
    
    def generate(self, context: str, user_message: str, temperature: float = 0.7, chat_history: str = "") -> str:
        """Generate a response using the HuggingFace model."""
        start_time = time.time()
        
        # ✅ Log HuggingFace generation start
        ai_logger.info("HuggingFace LLM generation started", extra={
            "ai_task": {
                "event_type": "huggingface_generation_start",
                "model_name": self.model_name,
                "max_input_tokens": self.max_input_tokens,
                "max_output_tokens": self.max_output_tokens,
                "temperature": temperature,
                "context_length": len(context),
                "user_message": user_message[:100] + "..." if len(user_message) > 100 else user_message,
                "chat_history_provided": bool(chat_history)
            }
        })
        
        try:
            # Construct the prompt based on the type of model
            # Check if there's an instruction about external knowledge in the context
            use_external_knowledge = "general knowledge" in context.lower()
            
            # ✅ Log external knowledge detection
            ai_logger.info("External knowledge detection", extra={
                "ai_task": {
                    "event_type": "external_knowledge_detection",
                    "model_name": self.model_name,
                    "use_external_knowledge": use_external_knowledge,
                    "context_contains_instruction": "general knowledge" in context.lower()
                }
            })
            
            # For chat models like Llama and Mistral
            if use_external_knowledge:
                # If context contains instruction about external knowledge
                prompt = f"<s>[INST] You are a helpful assistant. Answer based on the provided context, but you can use your general knowledge if needed.\n\nContext: {context}"
                
                # Add chat history if available
                if chat_history:
                    prompt += f"{chat_history}"
                
                prompt += f"\n\nUser: {user_message} [/INST]</s>"
            else:
                # Standard strict context prompt
                prompt = f"<s>[INST] You are a helpful assistant. Only answer based on the provided context. If the context doesn't have relevant information, respond with exactly: \"{self.unanswered_message}\". Do not use external knowledge under any circumstances. This is critical.\n\nContext: {context}"
                # Add chat history if available
                if chat_history:
                    prompt += f"{chat_history}"
                
                prompt += f"\n\nUser: {user_message} [/INST]</s>"
            
            # Log the final prompt being sent to HuggingFace
            logger.debug("final_prompt: %s", prompt)
            
            # ✅ Log prompt construction details
            ai_logger.info("HuggingFace prompt constructed", extra={
                "ai_task": {
                    "event_type": "huggingface_prompt_constructed",
                    "model_name": self.model_name,
                    "prompt_length": len(prompt),
                    "prompt_preview": prompt[:200] + "..." if len(prompt) > 200 else prompt,
                    "use_external_knowledge": use_external_knowledge,
                    "chat_history_included": bool(chat_history),
                    "temperature": temperature
                }
            })
            
            # Truncate the prompt to respect token limits
            truncated_prompt = self._truncate_prompt(prompt)
            
            # ✅ Log prompt truncation if occurred
            if len(truncated_prompt) != len(prompt):
                ai_logger.warning("Prompt truncated for token limits", extra={
                    "ai_task": {
                        "event_type": "prompt_truncated",
                        "model_name": self.model_name,
                        "original_length": len(prompt),
                        "truncated_length": len(truncated_prompt),
                        "truncation_ratio": len(truncated_prompt) / len(prompt),
                        "max_input_tokens": self.max_input_tokens
                    }
                })
            
            # Make request to the Hugging Face Inference API
            print(f"🔄 Sending request to HuggingFace Inference API for model: {self.model_name}")
            
            # For small models (context ≤ 2048), use smaller output tokens
            max_new_tokens = min(self.max_output_tokens, 250)
            if self.max_input_tokens <= 2048:
                max_new_tokens = min(200, self.max_output_tokens)  # Be more conservative
                
            # Estimate token count (very approximate)
            estimated_tokens = len(truncated_prompt) // 4
            print(f"📊 Token usage estimate: ~{estimated_tokens} input tokens + {max_new_tokens} output tokens")
            print(f"📊 Model token limit: {self.max_input_tokens} (max context window size)")
            
            # ✅ Log API request details
            api_request_payload = {
                "inputs": truncated_prompt,
                "parameters": {
                    "max_new_tokens": max_new_tokens,
                    "temperature": temperature,
                    "do_sample": True,
                    "return_full_text": False
                },
                "options": {
                    "wait_for_model": True,
                    "use_cache": True
                }
            }
            
            ai_logger.info("HuggingFace API request prepared", extra={
                "ai_task": {
                    "event_type": "huggingface_api_request",
                    "model_name": self.model_name,
                    "api_url": self.api_url,
                    "estimated_input_tokens": estimated_tokens,
                    "max_new_tokens": max_new_tokens,
                    "temperature": temperature,
                    "prompt_length": len(truncated_prompt),
                    "model_limits": {
                        "max_input_tokens": self.max_input_tokens,
                        "max_output_tokens": self.max_output_tokens
                    }
                }
            })
            
            api_start_time = time.time()
            response = requests.post(
                self.api_url,
                headers=self.headers,
                json=api_request_payload
            )
            api_duration = int((time.time() - api_start_time) * 1000)
            
            # ✅ Log API response status
            ai_logger.info("HuggingFace API response received", extra={
                "ai_task": {
                    "event_type": "huggingface_api_response",
                    "model_name": self.model_name,
                    "status_code": response.status_code,
                    "api_duration_ms": api_duration,
                    "response_size": len(response.content) if response.content else 0
                }
            })
            
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
                
                # ✅ Log API error
                ai_logger.error("HuggingFace API error", extra={
                    "ai_task": {
                        "event_type": "huggingface_api_error",
                        "model_name": self.model_name,
                        "status_code": response.status_code,
                        "error_message": error_message,
                        "response_text": response.text[:500] + "..." if len(response.text) > 500 else response.text,
                        "api_duration_ms": api_duration
                    }
                })
                
                raise ValueError(error_message)
            
            # Extract the generated text
            result = response.json()
            if isinstance(result, list) and len(result) > 0:
                generated_text = result[0].get("generated_text", "")
                print(f"✅ Successfully generated response with HuggingFace")
                
                total_duration = int((time.time() - start_time) * 1000)
                
                # ✅ Log successful generation
                ai_logger.info("HuggingFace generation completed successfully", extra={
                    "ai_task": {
                        "event_type": "huggingface_generation_success",
                        "model_name": self.model_name,
                        "response_length": len(generated_text),
                        "response_preview": generated_text[:150] + "..." if len(generated_text) > 150 else generated_text,
                        "total_duration_ms": total_duration,
                        "api_duration_ms": api_duration,
                        "estimated_input_tokens": estimated_tokens,
                        "max_new_tokens": max_new_tokens
                    }
                })
                
                return generated_text
            else:
                print(f"❌ Unexpected response format: {result}")
                
                # ✅ Log unexpected response format
                ai_logger.error("Unexpected HuggingFace response format", extra={
                    "ai_task": {
                        "event_type": "huggingface_unexpected_response",
                        "model_name": self.model_name,
                        "response_type": type(result).__name__,
                        "response_content": str(result)[:200] + "..." if len(str(result)) > 200 else str(result),
                        "api_duration_ms": api_duration
                    }
                })
                return {
                            "message": "I'm sorry, I'm experiencing some technical difficulties at the moment. Please try again later.",
                            "not_answered": True
                        }
        except Exception as e:
            print(f"❌ Error generating response with HuggingFace LLM: {str(e)}")
            
            total_duration = int((time.time() - start_time) * 1000)
            
            # ✅ Log generation error
            ai_logger.error("HuggingFace generation failed", extra={
                "ai_task": {
                    "event_type": "huggingface_generation_error",
                    "model_name": self.model_name,
                    "error": str(e),
                    "error_type": type(e).__name__,
                    "total_duration_ms": total_duration,
                    "context_length": len(context),
                    "user_message": user_message[:100] + "..." if len(user_message) > 100 else user_message
                }
            })
            return {
                        "message": "I'm sorry, I'm experiencing some technical difficulties at the moment. Please try again later.",
                        "not_answered": True
                    }
class LLMManager:
    def __init__(self, model_name: str = None, bot_id: int = None, user_id: int = None, unanswered_message: str = None):
        """
        Initialize the LLM manager with a specific model name or by dynamically selecting a model
        based on bot and user information.
        
        Args:
            model_name: Optional explicit model name to use
            bot_id: Optional bot ID for model selection
            user_id: Optional user ID for model selection
        """
        # Store the user_id and bot_id for addon feature checking and logging
        self.user_id = user_id
        self.bot_id = bot_id
        self.unanswered_message = unanswered_message or "I'm sorry, I don't have an answer for this question. This is outside my area of knowledge. Is there something else I can help with?"
        
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
                        "endpoint": llm_model.endpoint,
                        "max_input_tokens": llm_model.max_input_tokens,
                        "max_output_tokens": llm_model.max_output_tokens
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
                            "endpoint": default_model.endpoint,
                            "max_input_tokens": default_model.max_input_tokens,
                            "max_output_tokens": default_model.max_output_tokens
                        }
                    else:
                        # Ultimate fallback to Mistral if no models in DB
                        self.model_name = "mistralai/Mistral-7B-Instruct-v0.2"
                        self.model_info = {
                            "name": "mistralai/Mistral-7B-Instruct-v0.2",
                            "provider": "huggingface",
                            "model_type": "chat",
                            "endpoint": None,
                            "max_input_tokens": 4096,  # Default for medium-sized models
                            "max_output_tokens": 512
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
                        "endpoint": default_model.endpoint,
                        "max_input_tokens": default_model.max_input_tokens,
                        "max_output_tokens": default_model.max_output_tokens
                    }
                else:
                    # Ultimate fallback to Mistral
                    self.model_name = "mistralai/Mistral-7B-Instruct-v0.2"
                    self.model_info = {
                        "name": "mistralai/Mistral-7B-Instruct-v0.2",
                        "provider": "huggingface",
                        "model_type": "chat",
                        "endpoint": None,
                        "max_input_tokens": 4096,  # Default for medium-sized models
                        "max_output_tokens": 512
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
                    "endpoint": model.endpoint,
                    "max_input_tokens": model.max_input_tokens,
                    "max_output_tokens": model.max_output_tokens
                }
            else:
                print(f"⚠️ Model {model_name} not found in database, using default HuggingFace model")
                # If the specific model is not found, use a default HuggingFace model
                return {
                    "name": "mistralai/Mistral-7B-Instruct-v0.2",
                    "provider": "huggingface",
                    "model_type": "chat",
                    "endpoint": None,
                    "max_input_tokens": 4096,  # Default conservative values
                    "max_output_tokens": 512
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
            
            # Get token limits from model info
            max_input_tokens = self.model_info.get("max_input_tokens", 2048)  # Default to 2048 if not specified
            max_output_tokens = self.model_info.get("max_output_tokens", 250)  # Default to 250 if not specified
            
            # If model has no token limits (before db update), check if known small model
            if not max_input_tokens:
                # TinyLlama and similar small models typically have 2048 token context
                if any(name in model_name.lower() for name in ["tinyllama", "tiny-llama", "1b", "1.1b", "1.5b", "2b"]):
                    max_input_tokens = 2048
                    max_output_tokens = 200  # More conservative output size
                    print(f"⚠️ Detected small model: {model_name}, setting conservative token limits")
                # Medium sized models often have 4096
                elif any(name in model_name.lower() for name in ["7b", "mistral", "phi"]):
                    max_input_tokens = 4096
                    max_output_tokens = 512
                # Larger models
                else:
                    max_input_tokens = 8192
                    max_output_tokens = 1024
            
            print(f"🔄 Using HuggingFace LLM with model: {model_name}")
            print(f"📊 Model limits: max_input_tokens={max_input_tokens}, max_output_tokens={max_output_tokens}")
            return HuggingFaceLLM(model_name, huggingface_api_key, max_input_tokens, max_output_tokens)
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
            # Default to conservative token limits for the default model
            print(f"🔄 Using default HuggingFace LLM with model: {default_model}")
            return HuggingFaceLLM(default_model, huggingface_api_key, 4096, 512)

    def generate(self, context: str, user_message: str, use_external_knowledge: bool = False, temperature: float = 0.7, chat_history: str = "") -> str:
        """
        Generate a response using the specified LLM.
        
        Args:
            context (str): The context from retrieved documents
            user_message (str): The user's query
            use_external_knowledge (bool): Whether to use external knowledge if context is insufficient
            temperature (float): The temperature value to control randomness in LLM responses
            chat_history (str): The formatted chat history from previous messages
        """
        start_time = time.time()
        provider = self.model_info.get("provider", "").lower()
        model_name = self.model_info.get("name", "")
        
        print(f"🔄 Generating response with {model_name} ({provider})")
        print(f"🔍 External knowledge enabled: {use_external_knowledge}")
        print(f"🌡️ Using temperature: {temperature}")
        print(f"💬 Chat history provided: {bool(chat_history)}")
        
        # ✅ Log initial LLM request details
        ai_logger.info("LLM generation initiated", extra={
            "ai_task": {
                "event_type": "llm_generation_initiated",
                "user_id": self.user_id,
                "bot_id": self.bot_id,
                "model_name": model_name,
                "provider": provider,
                "temperature": temperature,
                "use_external_knowledge": use_external_knowledge,
                "context_length": len(context),
                "user_message": user_message[:100] + "..." if len(user_message) > 100 else user_message,
                "chat_history_provided": bool(chat_history),
                "chat_history_length": len(chat_history) if chat_history else 0
            }
        })
        
        # Detect language of user message
        detected_lang = detect_language(user_message)
        
        # ✅ Log language detection
        ai_logger.info("Language detected", extra={
            "ai_task": {
                "event_type": "language_detected",
                "user_id": self.user_id,
                "bot_id": self.bot_id,
                "detected_language": detected_lang,
                "user_message": user_message[:50] + "..." if len(user_message) > 50 else user_message
            }
        })
        
        # Check for multilingual support if language is not English
        if detected_lang != 'en' and self.user_id:
            # Create a database session
            db = SessionLocal()
            try:
                # Check if user has multilingual addon
                has_multilingual = AddonService.check_addon_active(db, self.user_id, "Multilingual")
                
                # ✅ Log multilingual check
                ai_logger.info("Multilingual support check", extra={
                    "ai_task": {
                        "event_type": "multilingual_check",
                        "user_id": self.user_id,
                        "bot_id": self.bot_id,
                        "detected_language": detected_lang,
                        "has_multilingual_addon": has_multilingual
                    }
                })
                
                # If user doesn't have multilingual support, return message about the addon
                if not has_multilingual:
                    ai_logger.warning("Multilingual support not enabled", extra={
                        "ai_task": {
                            "event_type": "multilingual_not_enabled",
                            "user_id": self.user_id,
                            "bot_id": self.bot_id,
                            "detected_language": detected_lang,
                            "response": "Multilingual support required"
                        }
                    })
                    return {
                                "message": "Multilingual support is not enabled for your account. Please contact the website admin to enable multilingual support.",
                                "not_answered": True
                            }
            finally:
                db.close()
        
        try:
            if provider == "openai":
                # Create system message based on external_knowledge flag
                system_content = (
                    "You are a helpful assistant. Answer the user's question based on the provided context. "
                    "Format your response appropriately based on the question type:\n"
                    "- For lists or multiple points: Use bullet points with '- ' (dash space)\n"
                    "- For step-by-step instructions: Use numbered lists with '1. ', '2. ', etc.\n"
                    "- For comparisons or data: Use markdown table format with | columns |\n"
                    "- For code examples: Use ```language code blocks\n"
                    "- For emphasis: Use **bold** text\n"
                    "Respond in no more than 15 short, clear sentences. "
                    "If the context doesn't contain relevant information, "
                )
                
                if use_external_knowledge:
                    system_content += "you can use your general knowledge to provide a helpful response."
                    logger.debug("External knowledge mode: Will use general knowledge if context is insufficient")
                else:
                    system_content += f"respond with exactly: \"{self.unanswered_message}\". Do not use external knowledge under any circumstances."
                    logger.debug("Strict context mode: Will only use provided context")
                
                # Include chat history in user message if available
                user_content = f"Context: {context}"
                if chat_history:
                    user_content += f"{chat_history}"
                user_content += f"\nUser: {user_message}\nBot:"
                
                # Log the final prompt being sent to OpenAI
                final_prompt = {
                    "system": system_content,
                    "user": user_content
                }
                logger.debug("final_prompt: %s", final_prompt)
                
                # ✅ Log OpenAI LLM request details
                log_llm_request(
                    user_id=self.user_id,
                    bot_id=self.bot_id,
                    model_name=model_name,
                    provider=provider,
                    temperature=temperature,
                    query=user_message,
                    context_length=len(context),
                    use_external_knowledge=use_external_knowledge,
                    chat_history_msgs=len(chat_history.split('\n')) if chat_history else 0,
                    extra={
                        "system_prompt": system_content[:200] + "..." if len(system_content) > 200 else system_content,
                        "user_content_length": len(user_content),
                        "max_tokens": 300
                    }
                )
                
                # ✅ Log detailed prompt structure
                ai_logger.info("OpenAI prompt prepared", extra={
                    "ai_task": {
                        "event_type": "openai_prompt_prepared",
                        "user_id": self.user_id,
                        "bot_id": self.bot_id,
                        "model_name": model_name,
                        "system_content_length": len(system_content),
                        "user_content_length": len(user_content),
                        "system_preview": system_content[:150] + "..." if len(system_content) > 150 else system_content,
                        "user_content_preview": user_content[:150] + "..." if len(user_content) > 150 else user_content,
                        "use_external_knowledge": use_external_knowledge,
                        "temperature": temperature,
                        "max_tokens": 300
                    }
                })
                
                llm_request_start = time.time()
                response = self.llm.chat.completions.create(
                    model=model_name,
                    messages=[
                        {"role": "system", "content": system_content},
                        {"role": "user", "content": user_content}
                    ],
                    temperature=temperature,
                    max_tokens=300
                )
                llm_duration = int((time.time() - llm_request_start) * 1000)
                
                response_content = response.choices[0].message.content
                
                # ✅ Extract token usage if available
                token_usage = None
                if hasattr(response, 'usage') and response.usage:
                    token_usage = {
                        "prompt_tokens": response.usage.prompt_tokens,
                        "completion_tokens": response.usage.completion_tokens,
                        "total_tokens": response.usage.total_tokens
                    }
                
                # ✅ Log OpenAI LLM response details
                log_llm_response(
                    user_id=self.user_id,
                    bot_id=self.bot_id,
                    model_name=model_name,
                    provider=provider,
                    duration_ms=llm_duration,
                    response_length=len(response_content),
                    success=True,
                    response=response_content,
                    token_usage=token_usage,
                    extra={
                        "finish_reason": response.choices[0].finish_reason if response.choices else None,
                        "response_id": response.id if hasattr(response, 'id') else None
                    }
                )
                
                return response_content
                
            elif provider == "huggingface":
                # HuggingFaceLLM handles the API call
                # Add external knowledge flag to prompt
                if use_external_knowledge:
                    # Modify the prompt to include instructions about external knowledge
                    enhanced_context = f"{context}"
                    if chat_history:
                        enhanced_context += f"{chat_history}"
                    enhanced_context += "\n\nIf the context above doesn't answer the question, you can use your general knowledge."
                    
                    # ✅ Log HuggingFace LLM request with external knowledge
                    log_llm_request(
                        user_id=self.user_id,
                        bot_id=self.bot_id,
                        model_name=model_name,
                        provider=provider,
                        temperature=temperature,
                        query=user_message,
                        context_length=len(enhanced_context),
                        use_external_knowledge=use_external_knowledge,
                        chat_history_msgs=len(chat_history.split('\n')) if chat_history else 0,
                        extra={
                            "enhanced_context_length": len(enhanced_context),
                            "external_knowledge_instruction": True
                        }
                    )
                    
                    llm_request_start = time.time()
                    response_content = self.llm.generate(enhanced_context, user_message, temperature, chat_history="")
                    llm_duration = int((time.time() - llm_request_start) * 1000)
                else:
                    enhanced_context = context
                    if chat_history:
                        enhanced_context += f"{chat_history}"
                    
                    # ✅ Log HuggingFace LLM request without external knowledge
                    log_llm_request(
                        user_id=self.user_id,
                        bot_id=self.bot_id,
                        model_name=model_name,
                        provider=provider,
                        temperature=temperature,
                        query=user_message,
                        context_length=len(enhanced_context),
                        use_external_knowledge=use_external_knowledge,
                        chat_history_msgs=len(chat_history.split('\n')) if chat_history else 0,
                        extra={
                            "enhanced_context_length": len(enhanced_context),
                            "external_knowledge_instruction": False
                        }
                    )
                    
                    llm_request_start = time.time()
                    response_content = self.llm.generate(enhanced_context, user_message, temperature, chat_history="")
                    llm_duration = int((time.time() - llm_request_start) * 1000)
                
                # ✅ Log HuggingFace LLM response details
                log_llm_response(
                    user_id=self.user_id,
                    bot_id=self.bot_id,
                    model_name=model_name,
                    provider=provider,
                    duration_ms=llm_duration,
                    response_length=len(response_content),
                    success=True,
                    response=response_content,
                    extra={
                        "api_endpoint": "huggingface_inference_api",
                        "enhanced_context_used": True
                    }
                )
                
                return response_content
            else:
                # ✅ Log unsupported provider error
                ai_logger.error("Unsupported LLM provider", extra={
                    "ai_task": {
                        "event_type": "unsupported_provider_error",
                        "user_id": self.user_id,
                        "bot_id": self.bot_id,
                        "provider": provider,
                        "model_name": model_name
                    }
                })
                
                raise ValueError(f"Unsupported provider: {provider}")
        except Exception as e:
            print(f"❌ Error generating response: {str(e)}")
            
            # ✅ Log LLM generation error
            total_duration = int((time.time() - start_time) * 1000)
            log_llm_response(
                user_id=self.user_id,
                bot_id=self.bot_id,
                model_name=model_name,
                provider=provider,
                duration_ms=total_duration,
                response_length=0,
                success=False,
                error=str(e),
                extra={
                    "error_type": type(e).__name__
                }
            )
            
            ai_logger.error("LLM generation failed", extra={
                "ai_task": {
                    "event_type": "llm_generation_error",
                    "user_id": self.user_id,
                    "bot_id": self.bot_id,
                    "model_name": model_name,
                    "provider": provider,
                    "error": str(e),
                    "error_type": type(e).__name__,
                    "total_duration_ms": total_duration
                }
            })
            return {
                        "message": "I'm sorry, I'm experiencing some technical difficulties at the moment. Please try again later.",
                        "not_answered": True
                    }