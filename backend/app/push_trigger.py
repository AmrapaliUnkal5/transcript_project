import asyncio
from app.websocket_manager import manager

async def push_update_loop():
    counter = 0
    while True:
        message = f"Real-time update {counter}"
        print(f"Sending: {message}")
        await manager.broadcast(message)
        counter += 1
        await asyncio.sleep(5)  # Push every 5 seconds
