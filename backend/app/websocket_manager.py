import json
from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        self.active_connections = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        print("I am called")
        print("length",len(self.active_connections))
        for connection in self.active_connections:
            await connection.send_text(message)
            
    async def broadcast_json(self, data: dict):
        """Helper method to broadcast JSON data"""
        await self.broadcast(json.dumps(data))

# ✅ Create an instance (not the class itself!)
manager = ConnectionManager()
