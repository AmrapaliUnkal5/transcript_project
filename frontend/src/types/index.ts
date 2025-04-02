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

// Team management types
export enum TeamMemberRole {
  ADMIN = "admin",
  EDITOR = "editor",
  VIEWER = "viewer"
}

export interface TeamMember {
  id: number;
  member_id: number;
  member_name: string;
  member_email: string;
  role: TeamMemberRole;
  invitation_status: string;
  invitation_sent_at: string;
}

export interface TeamInvitation {
  id: number;
  owner_id: number;
  owner_name: string;
  owner_email: string;
  role: TeamMemberRole;
  invitation_sent_at: string;
  invitation_token: string;
}

export interface TeamOwner {
  owner_id: number;
  owner_name: string;
  owner_email: string;
  role: TeamMemberRole;
}

export interface FileUploadInterface {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadDate: Date;
  url: string;
  file?: File;
  wordCount: number;
  charCount: number;
}

export interface CreateBotInterface {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadDate: Date;
  url: string;
  file: File;
  wordCount: number;
  charCount: number;
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
  file_id: number;
  file_path: string;
  file_size: string;
  word_count: number;
  character_count: number;  
  file_name: string;
  bot_id: number;
  file_type: string;
  upload_date: string;
  unique_file_name: string;
}

export interface IssueRequestData {
  botName?: string;
  description: string;
  files: FileUploadInterface[];
}

export interface DemoRequestData {
  name: string;
  email: string;
  country: string;
  company: string; 
  phone?: string; 
  description?: string; 
  requestType: "demo" | "support"; 
}

export interface GetWeeklyConversationsParams {
  bot_id: number;
  }