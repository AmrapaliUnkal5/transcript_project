from sqlalchemy.orm import Session
from app.utils.logger import get_module_logger
# Create a logger for this module
logger = get_module_logger(__name__)

# in vectorization_utils.py
async def trigger_vectorization_if_needed(bot_id: int, db: Session):
    """
    Celery tasks removed - transcript project doesn't use Celery.
    This function is disabled for transcript project.
    """
    logger.warning(f"trigger_vectorization_if_needed called but Celery is not available in transcript project")
    return False
