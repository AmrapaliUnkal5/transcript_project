#!/bin/bash

# Exit on any error
set -e

echo "Setting up development environment for Chatbot YouTube Processing"
echo "================================================================"

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
    echo "Virtual environment created."
else
    echo "Virtual environment already exists."
fi

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Install Python dependencies
echo "Installing Python dependencies..."
pip install -r requirements.txt

# Check if Redis is installed
if ! command -v redis-server &> /dev/null; then
    echo "Redis not found. Installing Redis..."
    sudo apt update
    sudo apt install -y redis-server
    
    # Configure Redis to start on boot
    sudo systemctl enable redis-server
    
    # Start Redis service
    sudo systemctl start redis-server
    
    echo "Redis installed and started."
else
    echo "Redis is already installed."
    # Ensure Redis is running
    if ! systemctl is-active --quiet redis-server; then
        echo "Starting Redis server..."
        sudo systemctl start redis-server
    else
        echo "Redis server is already running."
    fi
fi

echo "Setup complete! You can now run the development server using the provided scripts."
echo "================================================================"
echo "Usage:"
echo "  ./scripts/run_redis.sh    - Start Redis server"
echo "  ./scripts/run_celery.sh   - Start Celery worker"
echo "  ./scripts/run_flower.sh   - Start Flower monitoring dashboard"
echo "================================================================" 