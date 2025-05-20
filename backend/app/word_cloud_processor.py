# word_cloud_processor.py
import re
from typing import Dict
from collections import defaultdict
from sqlalchemy.orm import Session
from app.models import WordCloudData
from app.utils.logger import get_module_logger
from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize
import nltk

# Download NLTK data if not already present
try:
    nltk.data.find('corpora/stopwords')
    nltk.data.find('tokenizers/punkt')
    nltk.data.find('tokenizers/punkt_tab')
except LookupError:
    nltk.download('stopwords')
    nltk.download('punkt')
    nltk.download('punkt_tab')

logger = get_module_logger(__name__)

class WordCloudProcessor:
    # Cache stop words for better performance
    _stop_words = set(stopwords.words('english'))
    
    # Add custom stop words specific to your domain
    _custom_stop_words = {
        'hi', 'hello', 'hey', 'greetings', 'thanks', 'thank', 'please',
        'ok', 'okay', 'yes', 'no', 'maybe', 'would', 'could', 'should',
        'can', 'will', 'bot', 'bots', 'chatbot', 'assistant'
    }
    
    @classmethod
    def get_stop_words(cls):
        """Return combined set of NLTK and custom stop words"""
        return cls._stop_words.union(cls._custom_stop_words)

    @staticmethod
    def clean_text(text: str) -> str:
        """Enhanced text cleaning with better URL and special character handling"""
        # Remove URLs
        text = re.sub(r'http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+', '', text)
        # Remove email addresses
        text = re.sub(r'\S+@\S+', '', text)
        # Remove special characters except apostrophes and hyphens between words
        text = re.sub(r"(?<!\w)[\-'](?!\w)|(?<!\w)[^\w\s'-](?!\w)", '', text)
        # Remove standalone numbers
        text = re.sub(r'\b\d+\b', '', text)
        return text.lower()

    @staticmethod
    def process_message(text: str) -> Dict[str, int]:
        """Process a single message using NLTK for better tokenization"""
        cleaned = WordCloudProcessor.clean_text(text)
        words = word_tokenize(cleaned)
        stop_words = WordCloudProcessor.get_stop_words()
        
        frequencies = defaultdict(int)
        for word in words:
            # Skip stop words and very short words
            if len(word) > 2 and word not in stop_words:
                frequencies[word] += 1
                
        return frequencies

    @staticmethod
    def update_word_cloud(bot_id: int, message_text: str, db: Session):
        """Optimized version with proper merging of new words"""
        try:
            # Process the new message first
            new_frequencies = WordCloudProcessor.process_message(message_text)
            if not new_frequencies:
                return

            # Start a new transaction explicitly
            db.begin()

            # Get existing data with lock to prevent concurrent modifications
            word_cloud = db.query(WordCloudData)\
                          .filter_by(bot_id=bot_id)\
                          .with_for_update()\
                          .first()

            if word_cloud:
                # Ensure we have a dictionary (handle case where word_frequencies might be None)
                current_frequencies = word_cloud.word_frequencies or {}
            
                # Deep copy to ensure we're working with fresh data
                merged_frequencies = dict(current_frequencies)
            
                # Merge new frequencies
                for word, count in new_frequencies.items():
                    merged_frequencies[word] = merged_frequencies.get(word, 0) + count
            
                # Update only if there are changes
                if merged_frequencies != current_frequencies:
                    word_cloud.word_frequencies = merged_frequencies
                    db.flush()  # Explicit flush to ensure changes are pending
            else:
                # Create new entry if none exists
                word_cloud = WordCloudData(
                    bot_id=bot_id, 
                    word_frequencies=new_frequencies
                )
                db.add(word_cloud)
        
            db.commit()  # Explicit commit
        
        except Exception as e:
            db.rollback()  # Ensure rollback on error
            logger.error(f"Error updating word cloud for bot {bot_id}: {str(e)}")
            raise