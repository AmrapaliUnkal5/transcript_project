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
  displaySize: string;
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
  appearance: string;
  temperature: number;
  windowBgColor: string;
  welcomeMessage: string;
  inputBgColor: string;
}

export interface ApiFile {
  original_file_size_bytes: number;
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
  issueType: string;
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


  export interface SubscriptionPlan {
    id: number;
    name: string;
    wordCountLimit: number;
    fileSizeLimitMB: number;
    maxFiles: number;
    maxWebPages: number;
    analytics: string;
    chatbot_limit:number;
    storage_limit:string;
    message_limit:number;
    
  }
  
  export interface UserUsage {
    globalWordsUsed: number;
    currentSessionWords: number;
    planLimit: number;
    remainingWords?:number;
    globalStorageUsed: number; 
    currentSessionStorage: number;  
    storageLimit: number;
  }
  
  export interface UserUsageResponse {
    totalStorageUsed: number;
    totalWordsUsed: number;  
    planLimit: number;
    botWords?: number;  
    globalStorageUsed: number;  
    currentSessionStorage: number;  
    storageLimit: number;    
  }

  export interface BillingMetricsResponse {
    total_sessions: number;
    total_user_messages: number;
    total_likes: number;
    total_dislikes: number;
    total_chat_duration: string;
    billing_cycle_start: string;
    billing_cycle_end: string;
  }

  export interface AddonPlan {
    id: number;
    name: string;
    price: number;
    description: string;
    addon_type: string;
    additional_word_limit: number;
    additional_message_limit: number;
    additional_admin_users: number;
    zoho_addon_id: string;
    zoho_addon_code: string;
  }