import { useEffect, useState, useRef } from 'react';
import { useBot } from '../context/BotContext';

interface GridStatus {
  files: Record<string, number>;
  youtube: Record<string, number>;
  websites: Record<string, number>;
}

export const useGridRefreshWebSocket = () => {
  const { selectedBot } = useBot();
  const [gridStatus, setGridStatus] = useState<GridStatus | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const VITE_BACKEND_WS_URL = import.meta.env.VITE_BACKEND_WS_URL;

  useEffect(() => {
    if (!selectedBot?.id) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${VITE_BACKEND_WS_URL}/ws/grid-refresh?bot_id=${selectedBot.id}`;
    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;

    console.log("🔌 Grid WebSocket started", socket);

    socket.onopen = () => {
      setIsConnected(true);
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "GridStatus") {
          setGridStatus({
            files: data.files,
            youtube: data.youtube,
            websites: data.websites,
          });
        }
      } catch (error) {
        console.error('❌ Error parsing grid WebSocket message:', error);
      }
    };

    socket.onclose = () => {
      setIsConnected(false);
      console.warn("⚠️ Grid WebSocket closed");
    };

    socket.onerror = (error) => {
      console.error('❌ Grid WebSocket error:', error);
      setIsConnected(false);
    };

    // Keep-alive ping every 30 seconds
    const pingInterval = setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send('ping');
      }
    }, 30000);

    return () => {
      clearInterval(pingInterval);
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close();
      }
    };
  }, [selectedBot?.id]);

  return { gridStatus, isConnected };
};
