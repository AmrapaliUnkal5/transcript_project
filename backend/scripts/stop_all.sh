#!/bin/bash

# Exit on any error
set -e

echo "Stopping all services for YouTube video processing..."
echo "===================================================="

# Navigate to the backend directory if script is run from elsewhere
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR/.."

# Find and kill Celery worker processes
echo "Stopping Celery workers..."
pkill -f "celery -A app.celery_app worker" || echo "No Celery workers found running."

# Find and kill Flower processes
echo "Stopping Flower monitoring dashboard..."
pkill -f "celery -A app.celery_app flower" || echo "No Flower instances found running."

# Stop Redis server
echo "Stopping Redis server..."
./scripts/run_redis.sh stop || echo "Could not stop Redis server."

echo "All services stopped successfully!"
echo "====================================================" 