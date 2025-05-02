# Chatbot Backend

This is the backend for the Chatbot application, which handles YouTube video processing with Celery and Redis for background tasks.

## Architecture

The application uses:
- FastAPI for the web API
- Celery for background task processing
- Redis as the broker and result backend for Celery
- Flower for monitoring Celery tasks

## Setup

### Environment Variables

Create a `.env` file in the `backend` directory with the following content:

```
# Redis configuration
REDIS_URL=redis://localhost:6379/0

# Other environment variables
```

### Directory Structure

The key files for the background task processing are:

- `app/celery_app.py` - Celery configuration
- `app/celery_tasks.py` - Task definitions
- `app/youtube.py` - YouTube video processing logic

## Starting the Services

### 1. Start Redis Server

Redis should be running on localhost port 6379. You mentioned Redis is already installed.

### 2. Start Celery Worker

From the `backend` directory, run the Celery worker:

```bash
cd backend
celery -A app.celery_app worker --loglevel=info
```

### 3. Start Flower (Monitoring Dashboard)

From the `backend` directory, run Flower:

```bash
cd backend
celery -A app.celery_app flower
```

Flower will be available at http://localhost:5555

### 4. Start FastAPI Server

From the `backend` directory, run the FastAPI server:

```bash
cd backend
uvicorn app.main:app --reload
```

## Using the Background Tasks

The application now uses Celery for YouTube video processing. The API endpoints:

- `/process-videos` - Processes YouTube videos in the background
- `/scrape-youtube` - Scrapes and processes YouTube content

Both endpoints return a `task_id` that can be used to track the status of the background processing task.

## Monitoring Tasks

You can monitor the status of tasks using Flower at http://localhost:5555.

## Checking Task Status Programmatically

You can check the status of a Celery task programmatically using the task_id returned by the API:

```python
from app.celery_app import celery_app

def get_task_status(task_id):
    """Get the status of a Celery task."""
    task = celery_app.AsyncResult(task_id)
    
    result = {
        "task_id": task_id,
        "status": task.status,
        "done": task.ready()
    }
    
    # If task is complete, add the result
    if task.ready():
        if task.successful():
            result["result"] = task.result
        else:
            result["error"] = str(task.result)
    
    return result
```

You can use this function to create an API endpoint to check task status:

```python
@app.get("/task/{task_id}")
def check_task_status(task_id: str):
    """API endpoint to check the status of a task."""
    return get_task_status(task_id)
```

## Additional Features

### Task Scheduling

You can schedule tasks to run at specific times using Celery's beat scheduler:

```python
# In celery_app.py
celery_app.conf.beat_schedule = {
    'process-youtube-daily': {
        'task': 'process_youtube_videos',
        'schedule': 86400.0,  # 24 hours in seconds
        'args': (bot_id, video_urls)
    },
}
```

### Celery Task Priorities

You can set different priorities for tasks:

```python
@celery_app.task(bind=True, name='high_priority_task', priority=10)
def high_priority_task(self):
    pass

@celery_app.task(bind=True, name='low_priority_task', priority=1)
def low_priority_task(self):
    pass
```

## Benefits of Celery over FastAPI Background Tasks

1. **Scalability** - Celery workers can be distributed across multiple machines
2. **Monitoring** - Flower provides a dashboard for monitoring tasks
3. **Reliability** - Failed tasks can be retried automatically
4. **Task Queuing** - Tasks can be prioritized and scheduled
5. **Task Result Storage** - Results are stored in Redis for later retrieval 