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

export const useBotStatusWebSocket = (
  isReconfiguring: boolean,
  options?: { userId?: number; allBots?: boolean }
) => {
  const { selectedBot } = useBot();
  const [status, setStatus] = useState<BotTrainingStatus | null>(null);
  const [allBotsStatus, setAllBotsStatus] = useState<any[] | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const VITE_BACKEND_WS_URL = import.meta.env.VITE_BACKEND_WS_URL;

  useEffect(() => {
    let socket: WebSocket | null = null;
    if (options?.allBots && options.userId) {
      // All bots mode for welcome page
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${VITE_BACKEND_WS_URL}/progress/ws/user-bots-status`;
      socket = new WebSocket(wsUrl);
      wsRef.current = socket;
      socket.onopen = () => {
        socket!.send(options.userId!.toString());
        setIsConnected(true);
      };
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setAllBotsStatus(data); // Array of {bot_id, status}
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
    } else if (selectedBot?.id) {
      // Single bot mode
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${VITE_BACKEND_WS_URL}/progress/ws`;
      socket = new WebSocket(wsUrl);
      wsRef.current = socket;
      socket.onopen = () => {
        socket!.send(selectedBot.id.toString());
        setIsConnected(true);
      };
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (!isReconfiguring) {
            setStatus(data);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
    }
    if (socket) {
      socket.onclose = () => {
        setIsConnected(false);
      };
      socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsConnected(false);
      };
      // Add ping/pong to keep connection alive
      const pingInterval = setInterval(() => {
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send('ping');
        }
      }, 30000);
      return () => {
        clearInterval(pingInterval);
        if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
          socket.close();
        }
      };
    }
  }, [selectedBot?.id, options?.userId, options?.allBots]);

  const refreshStatus = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send('refresh');
    }
  }, [selectedBot?.id, isReconfiguring]);

  return options?.allBots ? { allBotsStatus, isConnected, refreshStatus } : { status, isConnected, refreshStatus };
};