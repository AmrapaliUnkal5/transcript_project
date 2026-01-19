# app/llm_manager.py - Simplified for Transcript Project
import os
from openai import OpenAI
from app.config import settings
from app.utils.logger import get_module_logger
from typing import Dict

logger = get_module_logger(__name__)

class LLMManager:
    def __init__(self, model_name: str = "gpt-4o-mini", bot_id: int = None, user_id: int = None, unanswered_message: str = ""):
        self.model_name = model_name
        self.user_id = user_id
        self.bot_id = bot_id  # Not used but kept for compatibility

        api_key = os.getenv("OPENAI_API_KEY") or settings.OPENAI_API_KEY
        if not api_key:
            raise ValueError("OPENAI_API_KEY not configured")

        self.client = OpenAI(api_key=api_key)
        logger.info(f"LLMManager initialized with model: {model_name}")

    def generate(self, context: str, user_message: str, use_external_knowledge: bool = False, temperature: float = 0.7, chat_history: str = "", role: str = "Service Assistant", tone: str = "Friendly") -> Dict[str, str]:
        """
        Generate a response using OpenAI.
        
        Args:
            context: The context from retrieved documents
            user_message: The user's query
            use_external_knowledge: Not used (kept for compatibility)
            temperature: The temperature value to control randomness
            chat_history: Not used (kept for compatibility)
            role: Not used (kept for compatibility)
            tone: Not used (kept for compatibility)
        
        Returns:
            Dict with "message" key containing the response
        """
        try:
            system_content = "You are a helpful assistant. Answer based on the provided context."

            if context:
                user_content = f"Context:\n{context}\n\nQuestion: {user_message}"
            else:
                user_content = user_message

            logger.info(f"Generating response with {self.model_name}, temperature={temperature}")

            response = self.client.chat.completions.create(
                model=self.model_name,
                messages=[
                    {"role": "system", "content": system_content},
                    {"role": "user", "content": user_content}
                ],
                temperature=temperature,
                max_tokens=2000
            )

            response_text = response.choices[0].message.content if response.choices else ""

            logger.info(f"Response generated successfully, length: {len(response_text)}")

            return {
                "message": response_text.strip() if response_text else "",
                "used_external": False,
                "is_greeting_response": False,
                "is_farewell_response": False,
                "not_answered": False
            }
        except Exception as e:
            logger.error(f"Error generating LLM response: {str(e)}")
            return {
                "message": f"Error generating response: {str(e)}",
                "used_external": False,
                "is_greeting_response": False,
                "is_farewell_response": False,
                "not_answered": True
            }
