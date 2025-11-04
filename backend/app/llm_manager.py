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
            
        elif provider == "deepseek":
            # DeepSeek via OpenAI-compatible API
            deepseek_api_key = getattr(settings, "DEEPSEEK_API_KEY", None) or os.getenv("DEEPSEEK_API_KEY")
            if not deepseek_api_key:
                raise ValueError("DEEPSEEK_API_KEY is not set")

            print(f"🔄 Using DeepSeek with model: {model_name}")
            # OpenAI SDK with base_url to DeepSeek's OpenAI-compatible endpoint
            return OpenAI(api_key=deepseek_api_key, base_url="https://api.deepseek.com/v1")

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

    def _build_prompt(self, context: str, user_message: str, use_external_knowledge: bool, chat_history: str, role: str, tone: str):
        """Build shared system and user content used across providers."""
        tone_descriptions = {
            "Professional": "Maintain a formal, polite, and technical style. Use complete sentences and avoid contractions.",
            "Casual": "Write in a friendly, conversational style. Use contractions and light humor if appropriate.",
            "Friendly": "Be warm, supportive, and approachable. Use encouraging and friendly language.",
            "Concise": "Provide short, clear, and direct answers. Eliminate unnecessary words while keeping meaning intact.",
            "Empathetic": "Respond with compassion and understanding. Acknowledge the user's feelings and provide reassurance."
        }
        tone_description = tone_descriptions.get(tone, "")

        if use_external_knowledge:
            system_content = (
                "You are a {tone} {role}. {tone_description}\n\n"
                "### Response Guidelines:\n"
                "- Answer the user's question using the provided Context.\n"
                "- If the Context does not contain the needed information, you MUST use your general knowledge.\n"
                "- IMPORTANT: If ANY part of the answer comes from outside the Context (even basic facts), you MUST add '[EXT_KNOWLEDGE_USED]' on a NEW LINE at the VERY END of your response.\n"
                "- These metadata lines MUST be plain text only (never inside code blocks, tables, or markdown). Append them AFTER the main answer, each on its own line.\n"
                "- Keep answers concise and clear, with a hard limit of 120 words.\n"
                "- Use the full length only when necessary for step-by-step instructions, recipes, or detailed guides.\n"
                "- No introductions, no preamble, and no disclaimers — start directly with the answer.\n"
                "- Tone effects (casual, empathy, friendly closers) may be included, but ONLY after the main answer, never before it.\n\n"

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
                "- ONLY append {{\"is_greeting_response\": true}} if the user INPUT is a pure greeting with NO questions.\n"
                "- ONLY append {{\"is_farewell_response\": true}} if the user INPUT is a pure farewell with NO questions.\n"
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
            ).format(tone=tone, role=role, tone_description=tone_description)
        else:
            system_content = (
                "You are a {tone} {role}. {tone_description}\n\n"
                "### Response Guidelines:\n"
                "- Answer the user's question based on the provided context. "
                f"If the context does not contain relevant information, respond with exactly: \"{self.unanswered_message}\". "
                "Do not use external knowledge under any circumstances.\n"
                "- Keep answers concise and clear, with a hard limit of 120 words.\n"
                "- Use the full length only when necessary for step-by-step instructions, recipes, or detailed guides.\n"
                "- No introductions, no preamble, and no disclaimers — start directly with the answer.\n"
                "- Tone effects (casual, empathy, friendly closers) may be included, but ONLY after the main answer, never before it.\n\n"

                "### Social Interactions:\n"
                "- Handle greetings/farewells with short, natural replies (max 1 short sentence).\n"
                "- CRITICAL: A greeting is ONLY a simple hello/hi WITHOUT any question or request.\n"
                "  Examples of pure greetings: 'hi', 'hello', 'hey', 'good morning'\n"
                "  NOT greetings: 'hi, what is soccer?', 'hello, tell me about X', 'when was the World Cup?'\n"
                "- CRITICAL: A farewell is ONLY a simple goodbye WITHOUT any question or request.\n"
                "  Examples of pure farewells: 'bye', 'goodbye', 'see you', 'take care'\n"
                "  NOT farewells: 'bye, but first tell me X', 'goodbye and thanks for the info'\n"
                "- ONLY append {{\"is_greeting_response\": true}} if the user INPUT is a pure greeting with NO questions.\n"
                "- ONLY append {{\"is_farewell_response\": true}} if the user INPUT is a pure farewell with NO questions.\n"
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
            ).format(tone=tone, role=role, tone_description=tone_description)

        user_content = (
            "Context (each block shows the text and attached provenance in [METADATA]):\n"
            f"{context}\n\n"
            "Provenance policy: If and only if you used ANY information from the Context above, append a plain text block titled 'Provenance' listing ONLY the sources actually used. If you relied solely on external knowledge, DO NOT include any 'Provenance' block.\nAlways spell the header exactly 'Provenance' (NOT 'Providence' or 'Provience')."
            "Format each line EXACTLY as follows (case-insensitive for keys is OK, but use these field names):\n"
            "- For YouTube: 'source: YouTube url: <URL>; chunk_number: <N>; section_hierarchy: <[...]>'\n"
            "- For Website: 'source: Website url: <URL>; chunk_number: <N>; section_hierarchy: <[...]>'\n"
            "- For Files: 'source: File filename: <FILE_NAME>; chunk_number: <N>; section_hierarchy: <[...]>'\n"
            "Rules: Do NOT output 'file_name: unknown'. Do NOT include extra fields. Only include items actually used. If you used any fact not supported by the Context, append '[EXT_KNOWLEDGE_USED]' on a new line at the end."
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
                                "not_answered": True,
                                "is_default_response": True
                            }
            finally:
                db.close()
        
        try:
            if provider in ("openai", "deepseek"):
                system_content, user_content = self._build_prompt(
                    context=context,
                    user_message=user_message,
                    use_external_knowledge=use_external_knowledge,
                    chat_history=chat_history,
                    role=role,
                    tone=tone
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
                    use_external_knowledge=use_external_knowledge,
                    chat_history_msgs=len(chat_history.split('\n')) if chat_history else 0,
                    extra={
                        "system_prompt": system_content[:200] + "..." if len(system_content) > 200 else system_content,
                        "user_content_length": len(user_content),
                        "max_tokens": 300
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
                        "max_output_tokens": 300
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
                _cap = 3000  if _is_gpt5_small else 300
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

                # Check for flag (case-insensitive) — support both legacy bracket tag and JSON flag
                used_external = False
                lower_resp = response_content.lower()
                if '"is_ext_response": true' in lower_resp or '[ext_knowledge_used]' in lower_resp:
                    used_external = True
                print(f"External knowledge flag detected: {used_external}")

                # Clean response (remove flags if present)
                clean_response = re.sub(r'\{.*?"is_(ext)_response":\s*(true|false).*?\}', '', response_content or "", flags=re.IGNORECASE | re.DOTALL).strip()
                clean_response = re.sub(r'\[ext_knowledge_used\]', '', clean_response, flags=re.IGNORECASE).strip()
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

                return {
                    "message": final_message,
                    "used_external": used_external,
                    "is_greeting_response": is_greeting_response,
                    "is_farewell_response": is_farewell_response
                }
                
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
            elif provider in ("anthropic", "claude"):
                # Anthropic Claude (messages API)
                # Reuse shared prompt builder
                system_content, user_content = self._build_prompt(
                    context=context,
                    user_message=user_message,
                    use_external_knowledge=use_external_knowledge,
                    chat_history=chat_history,
                    role=role,
                    tone=tone
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
                        "max_output_tokens": 300
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
                    "max_tokens": 300,
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
                if "[ext_knowledge_used]" in (response_text or "").lower():
                    used_external = True

                # Remove external-knowledge flags: full-line or inline, any casing
                clean_response = re.sub(r"(?im)^\s*\[ext_knowledge_used\]\s*$", "", response_text or "")
                clean_response = re.sub(r"\[ext_knowledge_used\]", "", clean_response, flags=re.IGNORECASE)
                # Remove optional JSON ext flag if present
                clean_response = re.sub(r"\{.*?\"is_(ext)_response\"\s*:\s*(true|false).*?\}", "", clean_response, flags=re.IGNORECASE | re.DOTALL)
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
                return {
                    "message": final_message,
                    "used_external": used_external,
                    "is_greeting_response": is_greeting_response,
                    "is_farewell_response": is_farewell_response
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
                    use_external_knowledge=use_external_knowledge,
                    chat_history=chat_history,
                    role=role,
                    tone=tone
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
                        "max_tokens": 300
                    }
                )

                # Generate
                llm_request_start = time.time()
                generation_config = {
                    "temperature": temperature,
                    "max_output_tokens": 300
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
                # Remove any JSON metadata blocks containing those flags
                clean_response = re.sub(
                    r"\{[^{}]*\"is_(greeting|farewell)_response\"\s*:\s*(true|false)[^{}]*\}",
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
                return {
                    "message": final_message,
                    "used_external": used_external,
                    "is_greeting_response": is_greeting_response,
                    "is_farewell_response": is_farewell_response
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