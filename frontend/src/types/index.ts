export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
}

export interface ChatMetrics {
  totalConversations: number;
  averageRating: number;
  responseTime: number;
  userSatisfaction: number;
}

export interface FileUpload {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadDate: Date;
  url: string;
}

export interface BotSettings {
  name: string;
  icon: string;
  fontSize: string;
  fontStyle: string;
  position: {
    x: number;
    y: number;
  };
  maxMessageLength: number;
  botColor: string;
  userColor: string;
}