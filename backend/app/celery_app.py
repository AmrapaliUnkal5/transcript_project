from celery import Celery
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Redis URL, default to localhost if not specified
redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379/0')

# Create Celery instance
celery_app = Celery(
    'chatbot',
    broker=redis_url,
    backend=redis_url,
    include=['app.celery_tasks']  # Include tasks module
)

# Optional configuration
celery_app.conf.update(
    result_expires=3600,  # Results expire after 1 hour
    worker_prefetch_multiplier=1,  # Prefetch one task at a time
    task_acks_late=True,  # Acknowledge tasks after execution
    task_track_started=True,  # Track task started status
    task_time_limit=14400,  # 4 hour time limit
    task_soft_time_limit=14100,  # 3 hour 55 minute soft time limit
)

if __name__ == '__main__':
    celery_app.start() 

# Ensure tasks are imported and registered
import app.celery_tasks 