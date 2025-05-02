#!/bin/bash

# Exit on any error
set -e

echo "Managing Redis server for Celery tasks..."
echo "========================================"

# Function to check if Redis is running
check_redis() {
    if systemctl is-active --quiet redis-server; then
        echo "Redis is currently running."
        return 0
    else
        echo "Redis is not running."
        return 1
    fi
}

# Function to start Redis
start_redis() {
    echo "Starting Redis server..."
    sudo systemctl start redis-server
    if [ $? -eq 0 ]; then
        echo "Redis server started successfully."
    else
        echo "Failed to start Redis server."
        exit 1
    fi
}

# Function to stop Redis
stop_redis() {
    echo "Stopping Redis server..."
    sudo systemctl stop redis-server
    if [ $? -eq 0 ]; then
        echo "Redis server stopped successfully."
    else
        echo "Failed to stop Redis server."
        exit 1
    fi
}

# Function to restart Redis
restart_redis() {
    echo "Restarting Redis server..."
    sudo systemctl restart redis-server
    if [ $? -eq 0 ]; then
        echo "Redis server restarted successfully."
    else
        echo "Failed to restart Redis server."
        exit 1
    fi
}

# Function to display Redis status
redis_status() {
    echo "Redis server status:"
    echo "-------------------"
    sudo systemctl status redis-server | head -n 20
}

# Process command line arguments
case "$1" in
    start)
        check_redis || start_redis
        ;;
    stop)
        check_redis && stop_redis
        ;;
    restart)
        restart_redis
        ;;
    status)
        redis_status
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status}"
        echo "  start   - Start Redis server if not running"
        echo "  stop    - Stop Redis server if running"
        echo "  restart - Restart Redis server"
        echo "  status  - Show Redis server status"
        exit 1
        ;;
esac

echo "Done." 