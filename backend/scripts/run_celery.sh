#!/bin/bash

# Exit on any error
set -e

echo "Starting Celery worker for YouTube video processing..."
echo "====================================================="

# Navigate to the backend directory if script is run from elsewhere
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR/.."

# Activate virtual environment
if [ -d "venv" ]; then
    source venv/bin/activate
    echo "Virtual environment activated."
else
    echo "Warning: Virtual environment not found. Using system Python."
fi

# Set environment variable for development
export PYTHONPATH=$(pwd)

# Check if Redis is running
if ! systemctl is-active --quiet redis-server; then
    echo "Warning: Redis server is not running. Starting now..."
    sudo systemctl start redis-server
fi

# Start Celery worker with concurrency of 2 and in foreground mode
echo "Starting Celery worker..."
celery -A app.celery_app worker \
    --loglevel=info \
    --concurrency=2 \
    --logfile=logs/celery.log

# Note: Control+C to stop the worker 