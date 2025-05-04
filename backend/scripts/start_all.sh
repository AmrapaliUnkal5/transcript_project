#!/bin/bash

# Exit on any error
set -e

echo "Starting all services for YouTube video processing..."
echo "===================================================="

# Navigate to the backend directory if script is run from elsewhere
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR/.."

# Make sure scripts are executable
chmod +x scripts/run_redis.sh
chmod +x scripts/run_celery.sh
chmod +x scripts/run_flower.sh

# Ensure Redis is running
echo "Starting Redis..."
./scripts/run_redis.sh start

# Create logs directory if it doesn't exist
mkdir -p logs

# Start Celery worker in background
echo "Starting Celery worker in background..."
nohup ./scripts/run_celery.sh > /dev/null 2>&1 &
CELERY_PID=$!
echo "Celery worker started with PID: $CELERY_PID"

# Start Flower in background
echo "Starting Flower monitoring dashboard in background..."
nohup ./scripts/run_flower.sh > /dev/null 2>&1 &
FLOWER_PID=$!
echo "Flower started with PID: $FLOWER_PID"

echo "All services started successfully!"
echo "===================================================="
echo "To monitor Celery tasks, visit: http://localhost:5555"
echo "To stop the services:"
echo "  1. Kill Celery worker: kill $CELERY_PID"
echo "  2. Kill Flower: kill $FLOWER_PID"
echo "  3. Stop Redis: ./scripts/run_redis.sh stop"
echo "====================================================" 