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
 
}

export interface FileUploadInterface {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadDate: Date;
  url: string;
  file?:File;
}

export interface CreateBotInterface {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadDate: Date;
  url: string;
  file: File;
}

export interface BotSettings {
  name: string;
  icon: string;
  fontSize: string;
  fontStyle: string;
  position: string;
  maxMessageLength: number;
  botColor: string;
  userColor: string;
  appearance:string;
  temperature:number;
}

export interface ApiFile {
  file_id: string | number;
  file_name: string;
  file_type: string;
  file_size: string; 
  upload_date: string; 
  file_path: string;
}