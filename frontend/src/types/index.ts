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
  
  export const SUBSCRIPTION_PLANS: Record<number, SubscriptionPlan> = {
    1: { // Explorer Plan (Free)
      id: 1,
      name: "Explorer",
      wordCountLimit: 50000,
      fileSizeLimitMB: 20,
      maxFiles: 10,
      maxWebPages: 1,
      analytics: "None",
      chatbot_limit:1,
      storage_limit:"20 MB",
      message_limit:100
    },
    2: { // Starter Plan
      id: 2,
      name: "Starter",
      wordCountLimit: 1000000,
      fileSizeLimitMB: 500,
      maxFiles: 50,
      maxWebPages: 1,
      analytics: "Standard",
      chatbot_limit:1,
      storage_limit:"500 MB",
      message_limit:1000
    },
    3: { // Growth Plan
      id: 3,
      name: "Growth",
      wordCountLimit: 2000000,
      fileSizeLimitMB: 1024,
      maxFiles: 100,
      maxWebPages: 5,
      analytics: "Standard",
      chatbot_limit:2,
      storage_limit:"1 GB",
      message_limit:2500
    },
    4: { // Professional Plan
      id: 4,
      name: "Professional",
      wordCountLimit: 3000000,
      fileSizeLimitMB: 2048,
      maxFiles: 200,
      maxWebPages: 10,
      analytics: "Advanced",
      chatbot_limit:5,
      storage_limit:"5 GB",
      message_limit:6000
    }
  };
  
  export const DEFAULT_PLAN_ID = 1;
  
  export const getPlanById = (planId: number): SubscriptionPlan => {
    return SUBSCRIPTION_PLANS[planId] || SUBSCRIPTION_PLANS[DEFAULT_PLAN_ID];
  };

  export interface UserUsage {
    globalWordsUsed: number;
    currentSessionWords: number;
    planLimit: number;
    remainingWords:number;
  }
  
  export interface UserUsageResponse {
    totalWordsUsed: number;  
    planLimit: number;
    botWords?: number;      
  }
  