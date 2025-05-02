#!/bin/bash

# Exit on any error
set -e

echo "Starting Flower monitoring dashboard for Celery tasks..."
echo "======================================================="

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

# Start Flower on port 5555 (default)
echo "Starting Flower dashboard..."
celery -A app.celery_app flower \
    --port=5555 \
    --address=0.0.0.0 \
    --logfile=logs/flower.log

# Note: Flower will be available at http://localhost:5555
# Control+C to stop the dashboard 