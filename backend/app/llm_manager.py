# app/llm_manager.py
import re
import openai
import os
from openai import OpenAI
from openai.types.chat import ChatCompletion
import requests
from app.database import SessionLocal
from app.models import LLMModel as LLMModelDB, Bot
from app.config import settings
from app.utils.model_selection import get_llm_model_for_bot, get_secondary_llm_for_bot, get_multilingual_llm_for_bot
from app.models import UserAddon
from datetime import datetime
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
from typing import Optional, Tuple

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
        print("The language is=>", detected_language)
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
            # Load secondary model info for fallback (from bot.secondary_llm or default qwen)
            try:
                if bot_id and user_id:
                    secondary_llm = get_secondary_llm_for_bot(db, bot_id, user_id)
                    if secondary_llm:
                        self.secondary_model_info = {
                            "name": secondary_llm.name,
                            "provider": secondary_llm.provider,
                            "model_type": secondary_llm.model_type,
                            "endpoint": secondary_llm.endpoint,
                            "max_input_tokens": secondary_llm.max_input_tokens,
                            "max_output_tokens": secondary_llm.max_output_tokens
                        }
                    else:
                        self.secondary_model_info = None
                else:
                    self.secondary_model_info = None
            except Exception:
                self.secondary_model_info = None
        finally:
            db.close()
            
        self.llm = self._initialize_llm()
    
    def _get_model_info(self, model_name):
        """Get model information from the database."""
        db = SessionLocal()
        try:
            # Hard-coded support for OpenAI models used by transcript project without touching Evolra DB
            _mn = (model_name or "").strip().lower()
            if _mn in ("gpt-4o-mini", "gpt-4o mini", "openai-gpt-4o-mini"):
                # Reasonable defaults for 4o mini
                return {
                    "name": "gpt-4o-mini",
                    "provider": "openai",
                    "model_type": "chat",
                    "endpoint": None,
                    "max_input_tokens": 128000,
                    "max_output_tokens": 4096,
                }

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
            
        elif provider == "deepseek":
            # DeepSeek via OpenAI-compatible API
            deepseek_api_key = getattr(settings, "DEEPSEEK_API_KEY", None) or os.getenv("DEEPSEEK_API_KEY")
            if not deepseek_api_key:
                raise ValueError("DEEPSEEK_API_KEY is not set")

            print(f"🔄 Using DeepSeek with model: {model_name}")
            # OpenAI SDK with base_url to DeepSeek's OpenAI-compatible endpoint
            return OpenAI(api_key=deepseek_api_key, base_url="https://api.deepseek.com/v1")

        elif provider == "groq":
            # Groq via OpenAI-compatible API
            groq_api_key = getattr(settings, "GROQ_API_KEY", None) or os.getenv("GROQ_API_KEY")
            if not groq_api_key:
                raise ValueError("GROQ_API_KEY is not set")

            print(f"🔄 Using Groq with model: {model_name}")
            return OpenAI(api_key=groq_api_key, base_url="https://api.groq.com/openai/v1")

        elif provider == "grok":
            # xAI Grok via OpenAI-compatible API
            xai_api_key = getattr(settings, "XAI_API_KEY", None) or os.getenv("XAI_API_KEY")
            if not xai_api_key:
                raise ValueError("XAI_API_KEY is not set")

            print(f"🔄 Using Grok (xAI) with model: {model_name}")
            return OpenAI(api_key=xai_api_key, base_url="https://api.x.ai/v1")

        elif provider in ("google", "gemini"):
            # For Google Gemini models
            try:
                import google.generativeai as genai  # Local import to avoid hard dependency when unused
            except Exception as import_err:
                raise ValueError(f"google-generativeai package is not installed: {import_err}")

            gemini_api_key = settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY")
            if not gemini_api_key:
                raise ValueError("GEMINI_API_KEY is not set")
            # Dynamic API selection:
            # - For 1.5 models, force API v1 so IDs like gemini-1.5-*-001 resolve for generateContent
            # - For 2.0/2.5 models, use default configuration
            _mn = (model_name or "").lower()
            if _mn.startswith("gemini-1.5"):
                genai.configure(
                    api_key=gemini_api_key,
                    client_options={"api_endpoint": "https://generativelanguage.googleapis.com/v1"}
                )
            else:
                # Defaults to current SDK base (compatible with 2.0/2.5)
                genai.configure(api_key=gemini_api_key)

            print(f"🔄 Using Google Gemini with model: {model_name}")
            # Return the configured GenerativeModel instance
            return genai.GenerativeModel(model_name=model_name)

        elif provider in ("anthropic", "claude"):
            # For Anthropic Claude models
            try:
                import anthropic  # Local import to avoid hard dependency when unused
            except Exception as import_err:
                raise ValueError(f"anthropic package is not installed: {import_err}")

            anthropic_api_key = getattr(settings, "ANTHROPIC_API_KEY", None) or os.getenv("ANTHROPIC_API_KEY")
            if not anthropic_api_key:
                raise ValueError("ANTHROPIC_API_KEY is not set")

            print(f"🔄 Using Anthropic Claude with model: {model_name}")
            # Return configured Anthropic client; message creation will be done in generate()
            return anthropic.Anthropic(api_key=anthropic_api_key)

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

    def _build_prompt(self, context: str, user_message: str, use_external_knowledge: bool, chat_history: str, role: str, tone: str, response_language: str = None):
        """Build shared system and user content used across providers, with stricter controls for certain models (Llama, Grok, Qwen)."""
        # Detect model families from name
        model_name_lower = (self.model_name or "").lower()
        is_llama = ("llama" in model_name_lower)
        is_grok = ("grok" in model_name_lower)
        tone_descriptions = {
            "Professional": "Maintain a formal, polite, and technical style. Use complete sentences and avoid contractions.",
            "Casual": "Write in a friendly, conversational style. Use contractions and light humor if appropriate.",
            "Friendly": "Be warm, supportive, and approachable. Use encouraging and friendly language.",
            "Concise": "Provide short, clear, and direct answers. Eliminate unnecessary words while keeping meaning intact.",
            "Empathetic": "Respond with compassion and understanding. Acknowledge the user's feelings and provide reassurance."
        }
        tone_description = tone_descriptions.get(tone, "")

        # Language directive to force responses in the detected language
        language_directive = ""
        if response_language:
            language_directive = (
                f"IMPORTANT: Respond strictly in '{response_language}'. Do not switch languages unless explicitly asked.\n"
                f"The Context may contain text in a different language; translate or interpret it internally as needed, but keep your final answer in '{response_language}'.\n\n"
            )

        # CRITICAL: Add explicit instructions for Qwen models
        # qwen_specific_directive = (
        #     "CRITICAL FOR QWEN MODELS: You MUST NOT output any thinking process, reasoning steps, analysis, "
        #     "or internal monologue. Completely skip all <think> tags, reasoning blocks, or step-by-step analysis. "
        #     "Go directly from reading the input to providing the final answer."
        # )
        qwen_specific_directive = (
            "CRITICAL FOR QWEN MODELS: You MUST NOT output ANY thinking tags AT ALL - not even empty <think></think> tags. "
            "Completely omit ALL thinking-related XML tags including: <think>, </think>, <reasoning>, </reasoning>, etc. "
            "Do NOT output empty thinking tags. Do NOT output thinking tags with just whitespace. "
            "Your output should contain ONLY the final answer with no XML tags of any kind for thinking or reasoning."
        )
        # Llama-specific strict directive (only applies when external knowledge is disabled)
        llama_strict_directive = ""
        if is_llama and not use_external_knowledge:
            llama_strict_directive = (
                "\n### ⚠️ CRITICAL LLAMA-SPECIFIC INSTRUCTIONS - READ CAREFULLY ⚠️\n"
                "YOU ARE IN MAXIMUM SECURITY CONTEXT-ONLY MODE, DO NOT HALLUCINATE:\n"
                "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
                "1. YOUR TRAINING DATA IS COMPLETELY DISABLED\n"
                "   - You CANNOT use any knowledge from your training\n"
                "   - Even if you're 100% certain about a fact, if it's not in the Context, you MUST refuse\n"
                "   - Think of yourself as having amnesia - you only know what's in the Context\n\n"
                "   EXCEPTION FOR SOCIAL INTERACTIONS:\n"
                "   - If the user's input is a PURE greeting (e.g., 'hi', 'hello', 'hey', 'good morning') with NO question or request,\n"
                "     you MUST respond with a short, natural greeting (max 1 short sentence), even if the Context is empty or irrelevant.\n"
                "   - If the user's input is a PURE farewell (e.g., 'bye', 'goodbye', 'see you', 'take care') with NO question or request,\n"
                "     you MUST respond with a short, natural farewell (max 1 short sentence), even if the Context is empty or irrelevant.\n"
                "   - Do NOT include provenance for greetings/farewells. These do NOT count as external knowledge.\n\n"
                "2. MANDATORY VERIFICATION PROCESS (DO THIS MENTALLY, DON'T OUTPUT):\n"
                "   Step A: Read the user's question\n"
                "   Step B: Search the Context for EXACT information\n"
                "   Step C: If you find explicit support → Answer using ONLY that info\n"
                "   Step D: If you DON'T find explicit support → Output the unanswered message\n\n"
                "3. WHAT COUNTS AS 'EXPLICIT SUPPORT'?\n"
                "   ✓ VALID: Context says 'The sky is blue' → You can say the sky is blue\n"
                "   ✗ INVALID: Context mentions 'sky' → You CANNOT explain why it's blue\n"
                "   ✗ INVALID: Context talks about colors → You CANNOT list rainbow colors\n"
                "   ✗ INVALID: You know the answer → Doesn't matter if it's not in Context!\n\n"
                "4. PROVENANCE RULES:\n"
                "   - You MUST cite actual sources from the Context metadata\n"
                "   - NEVER write 'source: None' or 'source: unknown'\n"
                "   - If you can't find a real source, use the unanswered message instead\n"
                "   - Writing 'source: None' is PROOF of hallucination!\n\n"
                "5. FORBIDDEN BEHAVIORS (INSTANT FAIL):\n"
                "   ✗ Answering from memory\n"
                "   ✗ Making logical inferences\n"
                "   ✗ Providing general knowledge\n"
                "   ✗ Using phrases like 'it is known that', 'commonly', 'generally'\n"
                "   ✗ Writing 'source: None' or any variant\n\n"
                "6. WHEN IN DOUBT:\n"
                f"   → ALWAYS output: \"{self.unanswered_message}\"\n"
                "   → Better to refuse than to hallucinate\n"
                "   → Your reputation depends on ZERO hallucinations\n"
                "\nSTRICT OUTPUT RULE FOR UNANSWERED CASE:\n"
                f"- If you cannot find explicit Context support, output EXACTLY: \"{self.unanswered_message}\" and NOTHING ELSE.\n"
                "- Do NOT add provenance, explanations, extra sentences, formatting, or metadata in this case.\n"
                "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            )

        # Grok-specific strict directive: primary, context-only mode must NOT use training data
        grok_strict_directive = ""
        if is_grok and not use_external_knowledge:
            grok_strict_directive = (
                "\n### ⚠️ CRITICAL GROK-SPECIFIC INSTRUCTIONS (PRIMARY CONTEXT-ONLY MODE) ⚠️\n"
                "YOU MUST TREAT YOUR TRAINING DATA AND GENERAL WORLD KNOWLEDGE AS DISABLED:\n"
                "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
                "1. ALLOWED KNOWLEDGE:\n"
                "   - You may ONLY use information explicitly present in the Context blocks above.\n"
                "   - If a fact, definition, date, or explanation is NOT clearly stated in the Context, you MUST NOT include it in your answer.\n\n"
                "2. WHEN CONTEXT IS INSUFFICIENT:\n"
                f"   - If the Context does NOT clearly answer the question, you MUST reply with exactly: \"{self.unanswered_message}\" and NOTHING ELSE.\n"
                "   - Do NOT try to be helpful by using your own knowledge about the world.\n"
                "   - Do NOT guess or infer from general understanding of the topic.\n\n"
                "3. FORBIDDEN SOURCES:\n"
                "   - Do NOT use training data, prior knowledge, or internet information.\n"
                "   - Even if you are 100% sure from your training, if the Context does not show it, you MUST act as if you do not know.\n\n"
                "4. SAFETY RULE:\n"
                f"   - When in doubt, ALWAYS respond with exactly: \"{self.unanswered_message}\".\n"
                "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            )

        if use_external_knowledge:
            system_content = (
                "{language_directive}You are a {tone} {role}. {tone_description}\n\n"
                "### CRITICAL RESPONSE RULES:\n"
                "- **ABSOLUTELY NO THINKING PROCESS**: Do NOT show any reasoning, analysis, step-by-step thinking, or internal monologue.\n"
                "- **NO TAGS**: Do NOT use <think>, <reasoning>, <analysis>, or any other thinking tags.\n"
                "- **DIRECT ANSWER ONLY**: Start immediately with the final answer - no planning, no preamble, no chain-of-thought.\n"
                "- **NO GREETINGS OR FLUFF**: Do NOT start with greetings or phrases like \"I'm happy to help\", \"Sure\", \"Of course\", \"Hello\", \"Hi\" or apologies. Begin your first sentence directly with the factual answer content.\n"
                "- **INTERNAL PROCESSING ONLY**: All thinking and reasoning must happen internally and never be shown in the output.\n"
                "{qwen_directive}\n"
                "{llama_directive}\n"
                "{grok_directive}\n\n"
                "### Response Guidelines:\n"
                "- Answer the user's question using the provided Context.\n"
                #"- No introductions, no preamble, no chain-of-thought, no reasoning notes, no planning, or any tags like <think>, 'Reasoning:', 'Thoughts:', or 'Analysis:' and no disclaimers — start directly with the answer.\n"
                "- If the Context does not contain the needed information, you MUST use your general knowledge.\n"
                "- NEVER say you don't know, never say the information is unavailable.\n"
                "- IMPORTANT: If ANY part of the answer comes from outside the Context (even basic facts), you MUST add '[EXT_KNOWLEDGE_USED]' on a NEW LINE at the VERY END of your response.\n"
                "- These metadata lines MUST be plain text only (never inside code blocks, tables, or markdown). Append them AFTER the main answer, each on its own line.\n"
                "- Keep answers concise and clear, with a hard limit of 120 words.\n"
                "- Use the full length only when necessary for step-by-step instructions, recipes, or detailed guides.\n"
                #"- No introductions, no preamble, and no disclaimers — start directly with the answer.\n"
                "- Tone effects (casual, empathy, friendly closers) may be included, but ONLY after the main answer, never before it.\n\n"

                "### Metadata Flags:\n"
                "- ALWAYS append exactly one JSON line at the VERY END in plain text (not in a code block): {{\"not_answered\": true|false}}.\n"
                "- This JSON MUST use lowercase booleans and ASCII characters regardless of the answer language.\n"
                f"- Set \"not_answered\": true ONLY if you could not answer and therefore output the exact unanswered message: \"{self.unanswered_message}\"; otherwise set it to false.\n\n"

                "### External Knowledge Decision Rules:\n"
                "- DO NOT add '[EXT_KNOWLEDGE_USED]' if every factual element in your answer can be found in the Context text, even if you paraphrase, summarize, combine, or reorganize it.\n"
                "- ONLY add '[EXT_KNOWLEDGE_USED]' if you introduce any fact/number/date/definition/claim that is NOT present in the Context.\n"
                "- Rewriting, simplifying, adding transitions, or basic politeness does NOT count as external knowledge.\n"
                "- IMPORTANT: Common knowledge still counts as external if it is not explicitly present in the Context.\n"
                "- The presence of a greeting or farewell does NOT imply external knowledge.\n"
                "- SELF-CHECK BEFORE SENDING: Compare your answer to the Context. If ALL key facts are supported by the Context, DO NOT add the external flag; otherwise, DO add it.\n\n"

                "### Quick Mental Checklist (Do NOT output):\n"
                "1) Identify 2–3 key facts in your answer.\n"
                "2) For each fact, verify the exact information appears in the Context.\n"
                "3) If ANY fact is not in the Context, append '[EXT_KNOWLEDGE_USED]'.\n\n"

                "### Social Interactions:\n"
                "- Handle greetings/farewells with short, natural replies (max 1 short sentence).\n"
                "- CRITICAL: A greeting is ONLY a simple hello/hi WITHOUT any question or request.\n"
                "  Examples of pure greetings: 'hi', 'hello', 'hey', 'good morning'\n"
                "  NOT greetings: 'hi, what is soccer?', 'hello, tell me about X', 'when was the World Cup?'\n"
                "- CRITICAL: A farewell is ONLY a simple goodbye WITHOUT any question or request.\n"
                "  Examples of pure farewells: 'bye', 'goodbye', 'see you', 'take care'\n"
                "  NOT farewells: 'bye, but first tell me X', 'goodbye and thanks for the info'\n"
                "- ONLY append {{\"is_greeting_response\": true}} if the user INPUT is a pure greeting.\n"
                "- ONLY append {{\"is_farewell_response\": true}} if the user INPUT is a pure farewell.\n"
                "- If the user asks ANY question (even with 'hi'), DO NOT add greeting/farewell metadata.\n"
                "- These metadata lines are independent: greeting/farewell does NOT imply external knowledge.\n\n"

                "### Formatting:\n"
                "- For lists or multiple points: Use bullet points with '• ' (do NOT use '*').\n"
                "- For step-by-step instructions: Use numbered lists ('1.', '2.', etc.).\n"
                "- For comparisons or data: Use Markdown tables (| col | col |).\n"
                "- For code examples: Use fenced code blocks ```language.\n"
                "- For hyperlinks: ALWAYS use [display text](URL). Do NOT bold URLs.\n"
                "- For emphasis: Use **bold** text.\n"
                "- Keep formatting consistent and clear.\n\n"
            ).format(
                tone=tone,
                role=role,
                tone_description=tone_description,
                qwen_directive=qwen_specific_directive,
                llama_directive=llama_strict_directive,
                grok_directive=grok_strict_directive,
                language_directive=language_directive
            )
        else:
            system_content = (
                "{language_directive}You are a {tone} {role}. {tone_description}\n\n"
                "### CRITICAL RESPONSE RULES:\n"
                "- **ABSOLUTELY NO THINKING PROCESS**: Do NOT show any reasoning, analysis, step-by-step thinking, or internal monologue.\n"
                "- **NO TAGS**: Do NOT use <think>, <reasoning>, <analysis>, or any other thinking tags.\n"
                "- **DIRECT ANSWER ONLY**: Start immediately with the final answer - no planning, no preamble, no chain-of-thought.\n"
                "- **NO GREETINGS OR FLUFF**: Do NOT start with greetings or phrases like \"I'm happy to help\", \"Sure\", \"Of course\", \"Hello\", \"Hi\" or apologies. Begin your first sentence directly with the factual answer content.\n"
                "- **INTERNAL PROCESSING ONLY**: All thinking and reasoning must happen internally and never be shown in the output.\n"
                "{qwen_directive}\n"
                "{llama_directive}\n\n"
                "### Response Guidelines:\n"
                "- Answer the user's question based on the provided context. "
                #"- No introductions, no preamble, no chain-of-thought, no reasoning notes, no planning, or any tags like <think>, 'Reasoning:', 'Thoughts:', or 'Analysis:' and no disclaimers — start directly with the answer.\n"
                f"If the context does not contain relevant information, respond with exactly: \"{self.unanswered_message}\". "
                "Do not use external knowledge under any circumstances.\n"
                "\n### Relevance and Evidence Rules (STRICT):\n"
                "- Before answering, internally locate 1–3 exact sentences in the Context that DIRECTLY answer the user's question.\n"
                "- If you cannot locate at least one exact supporting sentence that clearly answers the question, reply with exactly: \"" + self.unanswered_message + "\".\n"
                "- Do NOT guess, infer, generalize, or define terms not explicitly covered by the Context.\n"
                "- Ignore tangential or loosely related sections; they do NOT justify an answer.\n"
                "- If the user asks for a definition or concept that the Context does not define or explain, reply with exactly: \"" + self.unanswered_message + "\".\n"
                "- Your final answer must be fully supported by the Context; introducing any fact, number, definition, or claim not present in the Context is strictly forbidden.\n"
                "- If you are uncertain, or cannot find precise support, reply with exactly: \"" + self.unanswered_message + "\". Do not attempt a partial or best-guess answer.\n"
                "- Never produce any content from general knowledge, training data, or prior knowledge when the Context is insufficient.\n"
                "- Keep answers concise and clear, with a hard limit of 120 words.\n"
                "- Use the full length only when necessary for step-by-step instructions, recipes, or detailed guides.\n"
                #"- No introductions, no preamble, and no disclaimers — start directly with the answer.\n"
                "- Tone effects (casual, empathy, friendly closers) may be included, but ONLY after the main answer, never before it.\n\n"

                "### Social Interactions:\n"
                "- Handle greetings/farewells with short, natural replies (max 1 short sentence).\n"
                "- CRITICAL: A greeting is ONLY a simple hello/hi WITHOUT any question or request.\n"
                "  Examples of pure greetings: 'hi', 'hello', 'hey', 'good morning'\n"
                "  NOT greetings: 'hi, what is soccer?', 'hello, tell me about X', 'when was the World Cup?'\n"
                "- CRITICAL: A farewell is ONLY a simple goodbye WITHOUT any question or request.\n"
                "  Examples of pure farewells: 'bye', 'goodbye', 'see you', 'take care'\n"
                "  NOT farewells: 'bye, but first tell me X', 'goodbye and thanks for the info'\n"
                "- ONLY append {{\"is_greeting_response\": true}} if the user INPUT is a pure greeting.\n"
                "- ONLY append {{\"is_farewell_response\": true}} if the user INPUT is a pure farewell.\n"
                "- If the user asks ANY question (even with 'hi'), DO NOT add greeting/farewell metadata.\n"
                "- These JSON lines MUST appear as plain text only (never inside code blocks, tables, or markdown formatting).\n\n"

                "### Formatting:\n"
                "- For lists or multiple points: Use bullet points with '• ' (do NOT use '*').\n"
                "- For step-by-step instructions: Use numbered lists ('1.', '2.', etc.).\n"
                "- For comparisons or data: Use Markdown tables (| col | col |).\n"
                "- For code examples: Use fenced code blocks ```language.\n"
                "- For hyperlinks: ALWAYS use [display text](URL). Do NOT bold URLs.\n"
                "- For emphasis: Use **bold** text.\n"
                "- Keep formatting consistent and clear.\n\n"
            ).format(
                tone=tone,
                role=role,
                tone_description=tone_description,
                qwen_directive=qwen_specific_directive,
                llama_directive=llama_strict_directive,
                language_directive=language_directive
            )

        user_content = (
            "Context (each block shows the text and attached provenance in [METADATA]):\n"
            f"{context}\n\n"
            "Provenance policy: If and only if you used ANY information from the Context above, append a plain text block titled 'Provenance' listing ONLY the sources actually used. If you relied solely on external knowledge, DO NOT include any 'Provenance' block.\nAlways spell the header exactly 'Provenance' (NOT 'Providence' or 'Provience')."
            "Format each line EXACTLY as follows (case-insensitive for keys is OK, but use these field names):\n"
            "- For YouTube: 'source: YouTube url: <URL>; chunk_number: <N>; section_hierarchy: <[...]>'\n"
            "- For Website: 'source: Website url: <URL>; chunk_number: <N>; section_hierarchy: <[...]>'\n"
            "- For Files: 'source: File filename: <FILE_NAME>; chunk_number: <N>; section_hierarchy: <[...]>'\n"
            "Rules: Do NOT output 'file_name: unknown'. Do NOT include extra fields. Only include items actually used. If you used any fact not supported by the Context, append '[EXT_KNOWLEDGE_USED]' on a new line at the end."
            "### Metadata Flags:\n"
            "- ALWAYS append exactly one JSON line at the VERY END in plain text (not in a code block): {{\"not_answered\": true|false}}.\n"
            "- This JSON MUST use lowercase booleans and ASCII characters regardless of the answer language.\n"
            f"- Set \"not_answered\": true ONLY if you could not answer and therefore output the exact unanswered message: \"{self.unanswered_message}\"; otherwise set it to false.\n\n"

        )
        # Add extra verification instruction for Llama in strict mode
        if is_llama and not use_external_knowledge:
            user_content += (
                "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
                "⚠️ FINAL VERIFICATION CHECKPOINT:\n"
                "Before you respond, answer these questions to yourself:\n"
                "1. Did I find the answer in the Context above? (YES/NO)\n"
                "2. Can I point to exact sentences in the Context that support my answer? (YES/NO)\n"
                "3. Am I using ANY information from my training? (YES/NO)\n"
                "\n"
                "If answers are: YES, YES, NO → Provide the answer with real provenance\n"
                f"If ANY other combination → Output exactly: \"{self.unanswered_message}\"\n"
                "\n"
                "REMEMBER: Writing 'source: None' means you failed! If you can't cite a real source, use the unanswered message!\n"
                "\nSTRICT OUTPUT RULE FOR UNANSWERED CASE:\n"
                f"- If you cannot find explicit Context support, output EXACTLY: \"{self.unanswered_message}\" and NOTHING ELSE.\n"
                "- Do NOT add provenance, explanations, extra sentences, formatting, or metadata in this case.\n"
                "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
            )
        if chat_history:
            user_content += f"{chat_history}"
        user_content += f"\nUser: {user_message}\nBot:"
        return system_content, user_content

    def generate(self, context: str, user_message: str, use_external_knowledge: bool = False, temperature: float = 0.7, chat_history: str = "", role: str = "Service Assistant",tone: str = "Friendly") -> str:
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
                # Explicitly check for Multilingual Support addon by id = 1
                has_multilingual = db.query(UserAddon).filter(
                    UserAddon.user_id == self.user_id,
                    UserAddon.addon_id == 1,
                    UserAddon.is_active == True,
                    UserAddon.status == "active",
                    UserAddon.expiry_date > datetime.now()
                ).first() is not None
                
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
                        "message": "Multilingual support is not enabled for your account. Please purchase the addon to enable multilingual support.",
                        "not_answered": True,
                        "is_default_response": True
                    }

                # User has multilingual support; try to switch to bot's multilingual LLM
                multilingual_llm = get_multilingual_llm_for_bot(db, self.bot_id)
                if multilingual_llm:
                    # Override current model to multilingual model for this response
                    self.model_name = multilingual_llm.name
                    self.model_info = {
                        "name": multilingual_llm.name,
                        "provider": multilingual_llm.provider,
                        "model_type": multilingual_llm.model_type,
                        "endpoint": multilingual_llm.endpoint,
                        "max_input_tokens": multilingual_llm.max_input_tokens,
                        "max_output_tokens": multilingual_llm.max_output_tokens
                    }
                    # Re-initialize provider client with the new model
                    self.llm = self._initialize_llm()
            finally:
                db.close()
            
            # IMPORTANT: After potential model switch above, refresh provider/model_name
            provider = (self.model_info.get("provider", "") or "").lower()
            model_name = self.model_info.get("name", "") or model_name
        else:
            # Cross-lingual scenario: user asked in English but context may be non-English (e.g., Hindi)
            # Detect dominant language of the context (ignoring metadata lines)
            try:
                text_lines = []
                for _line in (context or "").splitlines():
                    if _line.startswith("[METADATA]") or _line.startswith("[CHUNK"):
                        continue
                    text_lines.append(_line)
                context_text_only = "\n".join(text_lines).strip()
                context_lang = detect_language(context_text_only) if context_text_only else 'en'
            except Exception:
                context_lang = 'en'

            # Log cross-lingual detection
            ai_logger.info("Cross-lingual context check", extra={
                "ai_task": {
                    "event_type": "crosslingual_context_check",
                    "user_id": self.user_id,
                    "bot_id": self.bot_id,
                    "detected_user_language": detected_lang,
                    "detected_context_language": context_lang
                }
            })

            # If user language is English but context is not, and addon is active, switch to multilingual LLM
            if detected_lang == 'en' and context_lang != 'en' and self.user_id:
                db = SessionLocal()
                try:
                    has_multilingual = db.query(UserAddon).filter(
                        UserAddon.user_id == self.user_id,
                        UserAddon.addon_id == 1,
                        UserAddon.is_active == True,
                        UserAddon.status == "active",
                        UserAddon.expiry_date > datetime.now()
                    ).first() is not None

                    ai_logger.info("Cross-lingual multilingual switch check", extra={
                        "ai_task": {
                            "event_type": "crosslingual_multilingual_switch_check",
                            "user_id": self.user_id,
                            "bot_id": self.bot_id,
                            "has_multilingual_addon": has_multilingual,
                            "context_language": context_lang
                        }
                    })

                    if has_multilingual:
                        multilingual_llm = get_multilingual_llm_for_bot(db, self.bot_id)
                        if multilingual_llm:
                            self.model_name = multilingual_llm.name
                            self.model_info = {
                                "name": multilingual_llm.name,
                                "provider": multilingual_llm.provider,
                                "model_type": multilingual_llm.model_type,
                                "endpoint": multilingual_llm.endpoint,
                                "max_input_tokens": multilingual_llm.max_input_tokens,
                                "max_output_tokens": multilingual_llm.max_output_tokens
                            }
                            self.llm = self._initialize_llm()
                finally:
                    db.close()

                # Refresh provider/model_name after switch
                provider = (self.model_info.get("provider", "") or "").lower()
                model_name = self.model_info.get("name", "") or model_name
        
        try:
            if provider in ("openai", "deepseek", "groq", "grok"):
                system_content, user_content = self._build_prompt(
                    context=context,
                    user_message=user_message,
                    use_external_knowledge=False,
                    chat_history=chat_history,
                    role=role,
                    tone=tone,
                    response_language=detected_lang
                )

                # Log the final prompt being sent to OpenAI
                final_prompt = {
                    "system": system_content,
                    "user": user_content
                }
                logger.debug("final_prompt: %s", final_prompt)
                
                # For GPT-5 variants, add a fast-answer directive (does not disable internal reasoning, but biases brevity)
                if (model_name or "").lower().startswith("gpt-5"):
                    fast_directive = (
                        "CRITICAL: Respond with the final answer only. Do NOT provide step-by-step reasoning, "
                        "self-reflection, or lengthy planning. Keep the response as short as possible while "
                        "remaining correct and helpful."
                    )
                    system_content = fast_directive + "\n\n" + system_content

                # ✅ Log OpenAI/DeepSeek LLM request details
                log_llm_request(
                    user_id=self.user_id,
                    bot_id=self.bot_id,
                    model_name=model_name,
                    provider=provider,
                    temperature=temperature,
                    query=user_message,
                    context_length=len(context),
                    use_external_knowledge=False,
                    chat_history_msgs=len(chat_history.split('\n')) if chat_history else 0,
                    extra={
                        "system_prompt": system_content[:200] + "..." if len(system_content) > 200 else system_content,
                        "user_content_length": len(user_content),
                        "max_tokens": 400
                    }
                )
                
                # ✅ Log detailed prompt structure
                ai_logger.info("OpenAI-compatible prompt prepared", extra={
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
                        "max_output_tokens": 400
                    }
                })
                
                def _token_param_key(pvd: str, model: str) -> str:
                    p = (pvd or "").lower()
                    m = (model or "").lower()
                    # OpenAI/DeepSeek: newer OpenAI GPT-5 models may require max_completion_tokens; classic chat uses max_tokens
                    if p == "openai":
                        if m.startswith("gpt-5"):
                            return "max_completion_tokens"
                        return "max_tokens"
                    # Anthropic / Google (if added later) typically use max_output_tokens
                    if p in ("anthropic", "google"):
                        return "max_output_tokens"
                    return "max_tokens"

                def _should_send_temperature(pvd: str, model: str) -> bool:
                    p = (pvd or "").lower()
                    m = (model or "").lower()
                    # Some OpenAI gpt-5 models only support the default temperature and reject overrides
                    if p == "openai" and m.startswith("gpt-5"):
                        return False
                    return True

                llm_request_start = time.time()
                request_payload = {
                    "model": model_name,
                    "messages": [
                        {"role": "system", "content": system_content},
                        {"role": "user", "content": user_content}
                    ]
                }
                if _should_send_temperature(provider, model_name):
                    request_payload["temperature"] = temperature
                # Set output token cap: 3000 for GPT-5 mini/nano, else 300
                _mn = (model_name or "").lower()
                _is_gpt5_small = _mn.startswith("gpt-5") and ("mini" in _mn or "nano" in _mn)
                _cap = 3000  if _is_gpt5_small else 400
                _max_key = _token_param_key(provider, model_name)
                request_payload[_max_key] = _cap

                # --- Print/log request parameters so they show up in logs ---
                _prompt_chars = len(system_content) + len(user_content)
                _temp_val = request_payload.get("temperature")
                print(
                    f"LLM request params -> provider={provider} model={model_name} stream=False "
                    f"{_max_key}={_cap} temperature={'n/a' if _temp_val is None else _temp_val} "
                    f"prompt_chars={_prompt_chars}"
                )
                logger.info(
                    f"LLM request params | provider={provider} model={model_name} stream=False "
                    f"{_max_key}={_cap} temperature={'n/a' if _temp_val is None else _temp_val} "
                    f"system_len={len(system_content)} user_len={len(user_content)} prompt_chars={_prompt_chars}"
                )

                response = self.llm.chat.completions.create(**request_payload)
                llm_duration = int((time.time() - llm_request_start) * 1000)
                
                # --- Robust extraction of assistant text ---
                def _extract_text(msg):
                    try:
                        content = getattr(msg, "content", None)
                    except Exception:
                        content = None
                    # Direct string
                    if isinstance(content, str):
                        return content
                    # Newer SDKs may return list of content parts
                    if isinstance(content, list):
                        parts = []
                        for part in content:
                            if isinstance(part, dict):
                                if isinstance(part.get("text"), str):
                                    parts.append(part.get("text"))
                                elif part.get("type") == "text" and isinstance(part.get("text"), str):
                                    parts.append(part.get("text"))
                            elif isinstance(part, str):
                                parts.append(part)
                        return "".join(parts)
                    return content or ""

                response_message = response.choices[0].message if response.choices else None
                response_content = _extract_text(response_message) if response_message else ""

                # Debug prints (ALWAYS show for troubleshooting)
                print("\n=== DEBUG: RAW LLM RESPONSE ===")
                print(response_content)  # Show exactly what the LLM returned

                # CRITICAL: Strip ALL thinking tags for Qwen models
                if "qwen" in self.model_name.lower():
                    response_content = self._strip_all_thinking_tags(response_content)
                    print("=== AFTER THINKING TAG REMOVAL ===")
                    print(response_content)

                # Check for flag (case-insensitive) — support both legacy bracket tag and JSON flag
                used_external = False
                not_answered_flag = False
                lower_resp = response_content.lower()
                if '"is_ext_response": true' in lower_resp or '[ext_knowledge_used]' in lower_resp:
                    used_external = True
                if '"not_answered": true' in lower_resp:
                    not_answered_flag = True
                elif '"not_answered": false' in lower_resp:
                    not_answered_flag = False
                print(f"External knowledge flag detected: {used_external}")

                # Clean response (remove flags if present)
                clean_response = re.sub(r'\{.*?"is_(ext)_response":\s*(true|false).*?\}', '', response_content or "", flags=re.IGNORECASE | re.DOTALL).strip()
                clean_response = re.sub(r'\[ext_knowledge_used\]', '', clean_response, flags=re.IGNORECASE).strip()
                # Remove any JSON block carrying not_answered
                clean_response = re.sub(r'\{.*?"not_answered"\s*:\s*(true|false).*?\}', '', clean_response, flags=re.IGNORECASE | re.DOTALL).strip()
                # Default flags
                is_greeting_response = False
                is_farewell_response = False

                # 1. Check if LLM explicitly set metadata flag in JSON-like text
                if '"is_greeting_response": true' in response_content.lower():
                    is_greeting_response = True
                    # Remove metadata JSON if present

                if '"is_farewell_response": true' in response_content.lower():
                    is_farewell_response = True

                # 2. Fallback: detect by common greeting/farewell phrases if no explicit flag
                if not (is_greeting_response or is_farewell_response):
                    greeting_keywords = ["hi", "hello", "hey", "good morning", "good evening", "good afternoon"]
                    farewell_keywords = ["bye", "goodbye", "see you", "take care", "farewell"]
                    lower_resp = clean_response.lower()

                    if any(lower_resp.startswith(greet) for greet in greeting_keywords):
                        is_greeting_response = True
                    elif any(lower_resp.startswith(farewell) for farewell in farewell_keywords):
                        is_farewell_response = True
                # Remove any JSON metadata blocks like {"is_greeting_response": true} or {"is_farewell_response": false}

                clean_response = re.sub(r'\{.*?"is_(greeting|farewell)_response":\s*(true|false).*?\}', '', clean_response, flags=re.IGNORECASE | re.DOTALL).strip()

                # If the LLM emitted only metadata (e.g., {"is_greeting_response": true}) with no actual text,
                # provide a sensible default reply instead of falling back to the unanswered message.
                if not clean_response:
                    if is_greeting_response:
                        clean_response = "Hello! How can I help you today?"
                    elif is_farewell_response:
                        clean_response = "Goodbye! Have a great day!"


                # Backend safeguard: if external knowledge is enabled and Context is empty, force used_external=True
                try:
                    context_is_empty = (context is None) or (len(context.strip()) == 0)
                except Exception:
                    context_is_empty = False
                if use_external_knowledge and context_is_empty and not used_external:
                    print("External knowledge override: Context empty and external allowed -> used_external=True")
                    used_external = True

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
                    response_length=len(clean_response),
                    success=True,
                    response=clean_response,
                    token_usage=token_usage,
                    extra={
                        "finish_reason": response.choices[0].finish_reason if response.choices else None,
                        "response_id": response.id if hasattr(response, 'id') else None
                    }
                )
                
                # If model returns empty content, provide a safe fallback message
                final_message = clean_response if clean_response else (self.unanswered_message or "I'm sorry, I don't have an answer for this question.")

                # Secondary fallback: call configured secondary LLM with only user history
                if use_external_knowledge and (not_answered_flag or ((self.unanswered_message or "").lower() in (final_message or "").lower())):
                    try:
                        info = getattr(self, "secondary_model_info", None) or {}
                        print(f"⚡ Secondary LLM fallback triggered | provider={info.get('provider')} model={info.get('name')}")
                    except Exception:
                        print("⚡ Secondary LLM fallback triggered")
                    secondary = self._secondary_general_knowledge_answer(user_message=user_message, chat_history=chat_history, role=role, tone=tone, temperature=temperature)
                    return secondary

                return {
                    "message": final_message,
                    "used_external": used_external,
                    "is_greeting_response": is_greeting_response,
                    "is_farewell_response": is_farewell_response,
                    "not_answered": not_answered_flag
                }
                
            elif provider == "huggingface":
                # HuggingFaceLLM handles the API call
                # Add external knowledge flag to prompt
                if use_external_knowledge:
                    # Modify the prompt to include instructions about external knowledge
                    language_directive = f"Respond strictly in '{detected_lang}'. Do not switch languages unless explicitly asked.\n\n"
                    enhanced_context = language_directive + f"{context}"
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
                    language_directive = f"Respond strictly in '{detected_lang}'. Do not switch languages unless explicitly asked.\n\n"
                    enhanced_context = language_directive + context
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
                
                # Fallback to secondary LLM if unanswered and external knowledge enabled
                if use_external_knowledge and isinstance(response_content, str) and ((self.unanswered_message or "").lower() in (response_content or "").lower()):
                    try:
                        info = getattr(self, "secondary_model_info", None) or {}
                        print(f"⚡ Secondary LLM fallback triggered | provider={info.get('provider')} model={info.get('name')}")
                    except Exception:
                        print("⚡ Secondary LLM fallback triggered")
                    secondary = self._secondary_general_knowledge_answer(user_message=user_message, chat_history=chat_history, role=role, tone=tone, temperature=temperature)
                    return secondary

                return response_content
            elif provider in ("anthropic", "claude"):
                # Anthropic Claude (messages API)
                # Reuse shared prompt builder
                system_content, user_content = self._build_prompt(
                    context=context,
                    user_message=user_message,
                    use_external_knowledge=False,
                    chat_history=chat_history,
                    role=role,
                    tone=tone,
                    response_language=detected_lang
                )

                # Log request
                log_llm_request(
                    user_id=self.user_id,
                    bot_id=self.bot_id,
                    model_name=model_name,
                    provider=provider,
                    temperature=temperature,
                    query=user_message,
                    context_length=len(context),
                    use_external_knowledge=False,
                    chat_history_msgs=len(chat_history.split('\n')) if chat_history else 0,
                    extra={
                        "system_prompt": system_content[:200] + "..." if len(system_content) > 200 else system_content,
                        "user_content_length": len(user_content),
                        "max_output_tokens": 400
                    }
                )

                # Prepare and send Anthropic request
                llm_request_start = time.time()
                request_payload = {
                    "model": model_name,
                    "system": system_content,
                    "messages": [
                        {"role": "user", "content": user_content}
                    ],
                    "max_tokens": 400,
                    "temperature": temperature,
                }

                _prompt_chars_a = len(system_content) + len(user_content)
                print(
                    f"LLM request params -> provider=anthropic model={model_name} stream=False "
                    f"max_tokens={request_payload['max_tokens']} temperature={request_payload['temperature']} "
                    f"prompt_chars={_prompt_chars_a}"
                )
                logger.info(
                    f"LLM request params | provider={provider} model={model_name} stream=False "
                    f"max_tokens={request_payload['max_tokens']} temperature={request_payload['temperature']} "
                    f"system_len={len(system_content)} user_len={len(user_content)} prompt_chars={_prompt_chars_a}"
                )

                # self.llm is an anthropic.Anthropic client
                response = self.llm.messages.create(**request_payload)
                llm_duration = int((time.time() - llm_request_start) * 1000)

                # Extract text from Anthropic response
                def _anthropic_extract_text(resp):
                    try:
                        parts = getattr(resp, "content", []) or []
                    except Exception:
                        parts = []
                    texts = []
                    for part in parts:
                        # SDK objects have .text; dicts use ['text']
                        t = getattr(part, "text", None)
                        if not isinstance(t, str) and isinstance(part, dict):
                            t = part.get("text")
                        if isinstance(t, str):
                            texts.append(t)
                    return "".join(texts)

                response_text = _anthropic_extract_text(response)

                # Debug prints (match other branches)
                print("\n=== DEBUG: RAW LLM RESPONSE ===")
                print(response_text)

                # External knowledge flag
                used_external = False
                not_answered_flag = False
                if "[ext_knowledge_used]" in (response_text or "").lower():
                    used_external = True

                # Remove external-knowledge flags: full-line or inline, any casing
                clean_response = re.sub(r"(?im)^\s*\[ext_knowledge_used\]\s*$", "", response_text or "")
                clean_response = re.sub(r"\[ext_knowledge_used\]", "", clean_response, flags=re.IGNORECASE)
                # Remove optional JSON ext flag if present
                clean_response = re.sub(r"\{.*?\"is_(ext)_response\"\s*:\s*(true|false).*?\}", "", clean_response, flags=re.IGNORECASE | re.DOTALL)
                # Detect and strip not_answered JSON metadata
                lower_resp_meta = (response_text or "").lower()
                if '"not_answered": true' in lower_resp_meta:
                    not_answered_flag = True
                elif '"not_answered": false' in lower_resp_meta:
                    not_answered_flag = False
                clean_response = re.sub(r"\{[^{}]*\"not_answered\"\s*:\s*(true|false)[^{}]*\}", "", clean_response, flags=re.IGNORECASE).strip()
                # Tidy excessive blank lines after removals
                clean_response = re.sub(r"\n{3,}", "\n\n", clean_response).strip()

                # Greeting/Farewell flags appended by LLM as JSON; detect and strip
                is_greeting_response = False
                is_farewell_response = False
                lower_resp = (response_text or "").lower()
                if '"is_greeting_response": true' in lower_resp:
                    is_greeting_response = True
                if '"is_farewell_response": true' in lower_resp:
                    is_farewell_response = True

                clean_response = re.sub(
                    r"\{[^{}]*\"is_(greeting|farewell)_response\"\s*:\s*(true|false)[^{}]*\}",
                    "",
                    clean_response,
                    flags=re.IGNORECASE,
                ).strip()

                # Log response
                log_llm_response(
                    user_id=self.user_id,
                    bot_id=self.bot_id,
                    model_name=model_name,
                    provider=provider,
                    duration_ms=llm_duration,
                    response_length=len(clean_response),
                    success=True,
                    response=clean_response,
                )

                final_message = clean_response if clean_response else (self.unanswered_message or "I'm sorry, I don't have an answer for this question.")
                if use_external_knowledge and (not_answered_flag or ((self.unanswered_message or "").lower() in (final_message or "").lower())):
                    try:
                        info = getattr(self, "secondary_model_info", None) or {}
                        print(f"⚡ Secondary LLM fallback triggered | provider={info.get('provider')} model={info.get('name')}")
                    except Exception:
                        print("⚡ Secondary LLM fallback triggered")
                    secondary = self._secondary_general_knowledge_answer(user_message=user_message, chat_history=chat_history, role=role, tone=tone, temperature=temperature)
                    return secondary
                return {
                    "message": final_message,
                    "used_external": used_external,
                    "is_greeting_response": is_greeting_response,
                    "is_farewell_response": is_farewell_response,
                    "not_answered": not_answered_flag
                }
            elif provider in ("google", "gemini"):
                # Google Gemini (Generative AI)
                try:
                    import google.generativeai as genai  # local import
                except Exception as import_err:
                    raise ValueError(f"google-generativeai package is not installed: {import_err}")

                # Reuse shared prompt builder
                system_content, user_content = self._build_prompt(
                    context=context,
                    user_message=user_message,
                    use_external_knowledge=False,
                    chat_history=chat_history,
                    role=role,
                    tone=tone,
                    response_language=detected_lang
                )

                # Log request
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
                        "max_tokens": 400
                    }
                )

                # Generate
                llm_request_start = time.time()
                generation_config = {
                    "temperature": temperature,
                    "max_output_tokens": 400
                }
                # Print/log request parameters for Gemini
                _prompt_chars_g = len(system_content) + len(user_content)
                print(
                    f"LLM request params -> provider=gemini model={model_name} stream=False "
                    f"max_output_tokens={generation_config['max_output_tokens']} temperature={generation_config['temperature']} "
                    f"prompt_chars={_prompt_chars_g}"
                )
                logger.info(
                    f"LLM request params | provider={provider} model={model_name} stream=False "
                    f"max_output_tokens={generation_config['max_output_tokens']} temperature={generation_config['temperature']} "
                    f"system_len={len(system_content)} user_len={len(user_content)} prompt_chars={_prompt_chars_g}"
                )
                # Some Gemini SDK versions support system_instruction; otherwise include as first part
                try:
                    response = self.llm.generate_content(
                        [system_content, user_content],
                        generation_config=generation_config
                    )
                except TypeError:
                    # Fallback without config in older SDKs
                    response = self.llm.generate_content([system_content, user_content])
                llm_duration = int((time.time() - llm_request_start) * 1000)

                response_text = getattr(response, "text", None) or ""

                # Debug prints (match OpenAI branch)
                print("\n=== DEBUG: RAW LLM RESPONSE ===")
                print(response_text)

                # External knowledge flag
                used_external = False
                not_answered_flag = False
                if "[ext_knowledge_used]" in (response_text or "").lower():
                    used_external = True

                clean_response = re.sub(r"\[ext_knowledge_used\]", "", response_text or "", flags=re.IGNORECASE).strip()
                # Greeting/Farewell flags appended by LLM as JSON; detect and strip
                is_greeting_response = False
                is_farewell_response = False
                lower_resp = (response_text or "").lower()
                if '"is_greeting_response": true' in lower_resp:
                    is_greeting_response = True
                if '"is_farewell_response": true' in lower_resp:
                    is_farewell_response = True
                # Detect and strip not_answered JSON metadata
                if '"not_answered": true' in lower_resp:
                    not_answered_flag = True
                elif '"not_answered": false' in lower_resp:
                    not_answered_flag = False
                # Remove any JSON metadata blocks containing those flags
                clean_response = re.sub(
                    r"\{[^{}]*(\"is_(greeting|farewell)_response\"|\"not_answered\")\s*:\s*(true|false)[^{}]*\}",
                    "",
                    clean_response,
                    flags=re.IGNORECASE,
                ).strip()
                # Defensive cleanup for Gemini outputs
                # 1) Remove any echoed [METADATA] lines anywhere
                clean_response = re.sub(r"(?im)^\s*\[METADATA\][^\n]*\n?", "", clean_response)
                # 2) Normalize bullet markers: replace leading '*' with '• '
                clean_response = re.sub(r"(?m)^[ \t]*\*[ \t]+", "• ", clean_response)
                # 3) Collapse excessive blank lines
                clean_response = re.sub(r"\n{3,}", "\n\n", clean_response)

                # Log response
                log_llm_response(
                    user_id=self.user_id,
                    bot_id=self.bot_id,
                    model_name=model_name,
                    provider=provider,
                    duration_ms=llm_duration,
                    response_length=len(clean_response),
                    success=True,
                    response=clean_response,
                )

                final_message = clean_response if clean_response else (self.unanswered_message or "I'm sorry, I don't have an answer for this question.")
                if use_external_knowledge and (not_answered_flag or ((self.unanswered_message or "").lower() in (final_message or "").lower())):
                    try:
                        info = getattr(self, "secondary_model_info", None) or {}
                        print(f"⚡ Secondary LLM fallback triggered | provider={info.get('provider')} model={info.get('name')}")
                    except Exception:
                        print("⚡ Secondary LLM fallback triggered")
                    secondary = self._secondary_general_knowledge_answer(user_message=user_message, chat_history=chat_history, role=role, tone=tone, temperature=temperature)
                    return secondary
                return {
                    "message": final_message,
                    "used_external": used_external,
                    "is_greeting_response": is_greeting_response,
                    "is_farewell_response": is_farewell_response,
                    "not_answered": not_answered_flag
                }
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
        
    def _strip_all_thinking_tags(self, text: str) -> str:
        """Remove ALL thinking tags (including empty ones) from model output."""
        if not text:
            return text
        
        cleaned = text
        
        # Remove ALL thinking tags - including empty ones, any casing, any whitespace
        thinking_patterns = [
            # Empty think tags with various whitespace
            r'(?is)<\s*think\s*>\s*<\s*/\s*think\s*>',
            r'(?is)<\s*think\s*>\s*<\s*/\s*think\s*>\s*',
            # Individual opening and closing think tags
            r'(?is)<\s*think\s*>',
            r'(?is)<\s*/\s*think\s*>',
            # Any think tags with minimal content (just whitespace/newlines)
            r'(?is)<\s*think\s*>\s*\n*\s*<\s*/\s*think\s*>',
            # Other thinking-related tags
            r'(?is)<\s*reasoning\s*>[\s\S]*?<\s*/\s*reasoning\s*>',
            r'(?is)<\s*analysis\s*>[\s\S]*?<\s*/\s*analysis\s*>',
        ]
        
        for pattern in thinking_patterns:
            cleaned = re.sub(pattern, "", cleaned)
        
        # Remove any leading/trailing whitespace that results from tag removal
        cleaned = cleaned.strip()
        
        # Remove any double newlines caused by tag removal
        cleaned = re.sub(r'\n{3,}', '\n\n', cleaned)
        
        return cleaned

    def _secondary_general_knowledge_answer(self, user_message: str, chat_history: str = "", role: str = "Service Assistant", tone: str = "Friendly", temperature: float = 0.7) -> dict:
        """
        Answer using only general knowledge via the bot's secondary LLM. Sends no context or metadata.
        """
        model_info = getattr(self, "secondary_model_info", None)
        if not model_info:
            print("⚠️ Secondary LLM not configured; returning unanswered message")
            return {
                "message": self.unanswered_message,
                "used_external": False,
                "not_answered": True,
                "is_default_response": True
            }

        provider = (model_info.get("provider") or "").lower()
        model_name = model_info.get("name") or ""
        print(f"🔁 Secondary LLM starting | provider={provider} model={model_name}")

        qwen_directive = (
            "CRITICAL FOR QWEN MODELS: Do NOT output any <think> or reasoning tags; output only the final answer."
        )
        system_content = (
            f"You are a {tone} {role}. Answer accurately using your general-world knowledge.\n"
            "- Keep the reply under 180 words.\n"
            "- Do NOT mention missing tools or browsing; just answer.\n"
            '- If you genuinely do not know, respond with "I\'m not sure about that."\n'
            "- Never invent citations. Do not include chain-of-thought.\n"
            + qwen_directive
        )
        user_content = (f"{chat_history}" if chat_history else "") + f"\nUser: {user_message}\nBot:"
        default_message = self.unanswered_message or "I'm sorry, I don't have an answer for this question."
        uncertain_markers = [
            "i'm not sure",
            "i am not sure",
            "i do not know",
            "i don't know",
            "as an ai language model",
            "cannot help with that",
            "don't have information",
            "no information on that",
        ]

        def _finalize_secondary_output(raw_text: Optional[str]) -> Tuple[str, bool]:
            """Return cleaned message and whether it should be treated as unanswered."""
            if not raw_text:
                return default_message, True

            cleaned = raw_text.strip()
            cleaned = self._strip_all_thinking_tags(cleaned)
            cleaned = re.sub(r"\s+\n", "\n", cleaned)
            cleaned = re.sub(r"\n{3,}", "\n\n", cleaned).strip()

            lower_cleaned = cleaned.lower()
            if any(marker in lower_cleaned for marker in uncertain_markers):
                return default_message, True

            cleaned = re.sub(r"(?i)\b(as an ai language model|i do not have access to external resources)[^.\n]*\.*", "", cleaned).strip()
            if not cleaned:
                return default_message, True

            return cleaned, False

        # OpenAI-compatible providers (OpenAI/DeepSeek/Groq) plus Grok with special handling
        if provider in ("openai", "deepseek", "groq", "grok"):
            # Special-case Grok: call xAI HTTP API directly with Live Search enabled
            if provider == "grok":
                try:
                    xai_api_key = getattr(settings, "XAI_API_KEY", None) or os.getenv("XAI_API_KEY")
                    if not xai_api_key:
                        print("❌ XAI_API_KEY not set for Grok secondary LLM")
                        return {
                            "message": default_message,
                            "used_external": False,
                            "not_answered": True,
                            "is_default_response": True,
                        }

                    headers = {
                        "Authorization": f"Bearer {xai_api_key}",
                        "Content-Type": "application/json",
                    }
                    payload = {
                        "model": model_name,
                        "messages": [
                            {"role": "system", "content": system_content},
                            {"role": "user", "content": user_content},
                        ],
                        "temperature": temperature,
                        "search_parameters": {
                            "mode": "auto",
                            "return_citations": True,
                        },
                    }
                    print("📨 Sending prompt to Grok secondary model with live search")
                    resp = requests.post(
                        "https://api.x.ai/v1/chat/completions",
                        headers=headers,
                        json=payload,
                        timeout=60,
                    )
                    if resp.status_code != 200:
                        print(f"❌ Grok secondary HTTP error: {resp.status_code} {resp.text}")
                        return {
                            "message": default_message,
                            "used_external": False,
                            "not_answered": True,
                            "is_default_response": True,
                        }
                    data = resp.json()
                    choices = data.get("choices") or []
                    if not choices:
                        print("❌ Grok secondary response missing choices")
                        return {
                            "message": default_message,
                            "used_external": False,
                            "not_answered": True,
                            "is_default_response": True,
                        }
                    msg = choices[0].get("message") or {}
                    response_text = msg.get("content") or ""
                    final_message, flagged_unanswered = _finalize_secondary_output(response_text)
                    print(
                        f"✅ Secondary Grok response received | length={len(final_message)} "
                        f"unanswered={flagged_unanswered}"
                    )
                    return {
                        "message": final_message,
                        "used_external": not flagged_unanswered,
                        "not_answered": flagged_unanswered,
                    }
                except Exception as e:
                    print(f"❌ Grok secondary LLM error: {str(e)}")
                    return {
                        "message": default_message,
                        "used_external": False,
                        "not_answered": True,
                        "is_default_response": True,
                    }

            # Default OpenAI-compatible path for OpenAI / DeepSeek / Groq
            try:
                client = None
                if provider == "openai":
                    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
                elif provider == "deepseek":
                    client = OpenAI(api_key=(getattr(settings, "DEEPSEEK_API_KEY", None) or os.getenv("DEEPSEEK_API_KEY")), base_url="https://api.deepseek.com/v1")
                elif provider == "groq":
                    client = OpenAI(api_key=(getattr(settings, "GROQ_API_KEY", None) or os.getenv("GROQ_API_KEY")), base_url="https://api.groq.com/openai/v1")

                def _token_param_key(pvd: str, model: str) -> str:
                    p = (pvd or "").lower()
                    m = (model or "").lower()
                    if p == "openai" and m.startswith("gpt-5"):
                        return "max_completion_tokens"
                    return "max_tokens"

                def _should_send_temperature(pvd: str, model: str) -> bool:
                    p = (pvd or "").lower()
                    m = (model or "").lower()
                    if p == "openai" and m.startswith("gpt-5"):
                        return False
                    return True

                request_payload = {
                    "model": model_info.get("name"),
                    "messages": [
                        {"role": "system", "content": system_content},
                        {"role": "user", "content": user_content}
                    ],
                }
                if _should_send_temperature(provider, model_name):
                    request_payload["temperature"] = temperature

                _mn = (model_name or "").lower()
                _is_gpt5_small = _mn.startswith("gpt-5") and ("mini" in _mn or "nano" in _mn)
                _token_cap = 3000 if _is_gpt5_small else 400
                request_payload[_token_param_key(provider, model_name)] = _token_cap

                response = client.chat.completions.create(**request_payload)
                print("✅ Secondary LLM request sent")

                def _extract_text(msg):
                    try:
                        content = getattr(msg, "content", None)
                    except Exception:
                        content = None
                    if isinstance(content, str):
                        return content
                    if isinstance(content, list):
                        parts = []
                        for part in content:
                            if isinstance(part, dict):
                                if isinstance(part.get("text"), str):
                                    parts.append(part.get("text"))
                                elif part.get("type") == "text" and isinstance(part.get("text"), str):
                                    parts.append(part.get("text"))
                            elif isinstance(part, str):
                                parts.append(part)
                        return "".join(parts)
                    return content or ""

                response_message = response.choices[0].message if response.choices else None
                response_text = _extract_text(response_message) if response_message else ""
                final_message, flagged_unanswered = _finalize_secondary_output(response_text)
                print(
                    f"✅ Secondary LLM response received | length={len(final_message)} "
                    f"unanswered={flagged_unanswered}"
                )
                return {
                    "message": final_message,
                    "used_external": not flagged_unanswered,
                    "not_answered": flagged_unanswered,
                }
            except Exception as e:
                print(f"❌ Secondary LLM error: {str(e)}")
                return {
                    "message": self.unanswered_message,
                    "used_external": False,
                    "not_answered": True,
                    "is_default_response": True
                }

        elif provider in ("google", "gemini"):
            try:
                import google.generativeai as genai  # local import
            except Exception as import_err:
                print(f"❌ Gemini SDK import failed: {import_err}")
                return {
                    "message": default_message,
                    "used_external": False,
                    "not_answered": True,
                    "is_default_response": True
                }

            gemini_api_key = getattr(settings, "GEMINI_API_KEY", None) or os.getenv("GEMINI_API_KEY")
            if not gemini_api_key:
                print("❌ GEMINI_API_KEY not set for secondary LLM")
                return {
                    "message": default_message,
                    "used_external": False,
                    "not_answered": True,
                    "is_default_response": True
                }

            _mn = (model_name or "").lower()
            endpoint_overrides = {
                "gemini-pro": "https://generativelanguage.googleapis.com/v1",
                "gemini-1.0": "https://generativelanguage.googleapis.com/v1",
                "gemini-1.5": "https://generativelanguage.googleapis.com/v1",
                "gemini-ultra": "https://generativelanguage.googleapis.com/v1",
            }
            try:
                override_endpoint = next(
                    (endpoint for prefix, endpoint in endpoint_overrides.items() if _mn.startswith(prefix)),
                    None
                )
                if override_endpoint:
                    genai.configure(api_key=gemini_api_key, client_options={"api_endpoint": override_endpoint})
                else:
                    genai.configure(api_key=gemini_api_key)
            except Exception as cfg_err:
                print(f"❌ Gemini configuration failed: {cfg_err}")
                return {
                    "message": default_message,
                    "used_external": False,
                    "not_answered": True,
                    "is_default_response": True
                }

            generation_config = {
                "temperature": temperature,
                "max_output_tokens": min(model_info.get("max_output_tokens") or 400, 512),
            }

            try:
                model = genai.GenerativeModel(model_name=model_name)
                print("📨 Sending prompt to Gemini secondary model")
                prompt_parts = [system_content, user_content]
                try:
                    response = model.generate_content(prompt_parts, generation_config=generation_config)
                except TypeError:
                    response = model.generate_content(prompt_parts)

                response_text = getattr(response, "text", "") or ""
                final_message, flagged_unanswered = _finalize_secondary_output(response_text)
                print(f"✅ Secondary Gemini response received | length={len(final_message)} unanswered={flagged_unanswered}")
                return {
                    "message": final_message,
                    "used_external": not flagged_unanswered,
                    "not_answered": flagged_unanswered
                }
            except Exception as e:
                print(f"❌ Secondary Gemini error: {e}")
                return {
                    "message": default_message,
                    "used_external": False,
                    "not_answered": True,
                    "is_default_response": True
                }

        # Unsupported provider for secondary path
        return {
            "message": self.unanswered_message,
            "used_external": False,
            "not_answered": True,
            "is_default_response": True
        }