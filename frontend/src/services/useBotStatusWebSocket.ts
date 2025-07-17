import { useEffect, useState, useRef, useCallback } from 'react';
import { useBot } from '../context/BotContext';
import { BotTrainingStatus } from './api';

interface BotStatus {
  overall_status: string;
  progress: {
    files: any;
    websites: any;
    youtube: any;
  };
  is_trained: boolean;
}

export const useBotStatusWebSocket = (isReconfiguring: boolean) => {
  const { selectedBot } = useBot();
   const [status, setStatus] = useState<BotTrainingStatus | null>(null);
  const [isConnected, setIsConnected] = useState(false);
   const wsRef = useRef<WebSocket | null>(null);
   const VITE_BACKEND_WS_URL = import.meta.env.VITE_BACKEND_WS_URL;

  useEffect(() => {
    if (!selectedBot?.id) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}/${VITE_BACKEND_WS_URL}/progress/ws`;
    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;

    console.log("Socket started",socket)

    socket.onopen = () => {
      socket.send(selectedBot.id.toString());  // send bot_id first
      setIsConnected(true);
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        // Only update status if not in reconfiguration mode
        if (!isReconfiguring) {
          setStatus(data);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    socket.onclose = () => {
      setIsConnected(false);
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsConnected(false);
    };
    
    // Add ping/pong to keep connection alive
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

  const refreshStatus = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send('refresh');
    }
  }, [selectedBot?.id, isReconfiguring]);

  return { status, isConnected, refreshStatus };
};