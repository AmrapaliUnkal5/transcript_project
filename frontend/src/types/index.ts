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

   // ✅ Add new customization fields
  headerBgColor: string;
  headerTextColor: string;
  chatTextColor: string;
  userTextColor: string;
  buttonColor: string;
  buttonTextColor: string;
  timestampColor: string;
  borderRadius: string;
  borderColor: string;
  chatFontFamily: string;
  userTimestampColor: string;
  theme_id?: string;
  lead_generation_enabled?: boolean;
  lead_form_config?: Array<{field: "name" | "email" | "phone" | "address";required: boolean;}>;
  showSources: boolean;
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

  export interface Theme {
  id: string;
  name: string;
  botColor: string;
  userColor: string;
  chatTextColor: string;
  userTextColor: string;
  windowBgColor: string;
  inputBgColor: string;
  headerBgColor: string;
  headerTextColor: string;
  buttonColor: string;
  buttonTextColor: string;
  timestampColor: string;
  userTimestampColor: string;
  borderColor: string;
}

// Add this constant with your themes (before the component)
export const THEMES: Theme[] = [
  {
    id: 'custom',
    name: 'Custom',
    botColor: '#F9FAFB',
    userColor: '#F9FAFB',
    chatTextColor: '#1F2937',
    userTextColor: '#121111',
    windowBgColor: '#121111',
    inputBgColor: '#FFFFFF',
    headerBgColor: '#FFFFFF',
    headerTextColor: '#121111',
    buttonColor: '#121111',
    buttonTextColor: '#FFFFFF',
    timestampColor: '#1F2937',
    userTimestampColor: '#121111',
    borderColor: '#121111'
  },
  {
    id: 'basic',
    name: 'Basic',
    botColor: '#cfcfcf',
    userColor: '#9e9e9e',
    chatTextColor: '#1F2937',
    userTextColor: '#171616',
    windowBgColor: '#F9FAFB',
    inputBgColor: '#FFFFFF',
    headerBgColor: '#292929',
    headerTextColor: '#efebeb',
    buttonColor: '#0f0f0f',
    buttonTextColor: '#faf9f9',
    timestampColor: '#1F2937',
    userTimestampColor: '#121111',
    borderColor: '#0a0a0a'
  },
  {
    id: 'ocean',
    name: 'Ocean Blue',
    botColor: '#E0F7FA',
    userColor: '#9ddcfb',
    chatTextColor: '#01579B',
    userTextColor: '#0D47A1',
    windowBgColor: '#E3F2FD',
    inputBgColor: '#FFFFFF',
    headerBgColor: '#0288D1',
    headerTextColor: '#FFFFFF',
    buttonColor: '#0288D1',
    buttonTextColor: '#FFFFFF',
    timestampColor: '#01579B',
    userTimestampColor: '#0D47A1',
    borderColor: '#B3E5FC'
  },
  {
    id: 'forest',
    name: 'Forest Green',
    botColor: '#E8F5E9',
    userColor: '#d3eeb4',
    chatTextColor: '#1B5E20',
    userTextColor: '#33691E',
    windowBgColor: '#F1F8E9',
    inputBgColor: '#FFFFFF',
    headerBgColor: '#43A047',
    headerTextColor: '#FFFFFF',
    buttonColor: '#43A047',
    buttonTextColor: '#FFFFFF',
    timestampColor: '#1B5E20',
    userTimestampColor: '#33691E',
    borderColor: '#C8E6C9'
  },
  {
    id: 'sunset',
    name: 'Sunset Orange',
    botColor: '#FFF3E0',
    userColor: '#f2bbb5',
    chatTextColor: '#E65100',
    userTextColor: '#BF360C',
    windowBgColor: '#FBE9E7',
    inputBgColor: '#FFFFFF',
    headerBgColor: '#FF7043',
    headerTextColor: '#FFFFFF',
    buttonColor: '#FF7043',
    buttonTextColor: '#FFFFFF',
    timestampColor: '#E65100',
    userTimestampColor: '#BF360C',
    borderColor: '#FFCCBC'
  },
  {
    id: 'midnight',
    name: 'Midnight Dark',
    botColor: '#424242',
    userColor: '#616161',
    chatTextColor: '#E0E0E0',
    userTextColor: '#FFFFFF',
    windowBgColor: '#212121',
    inputBgColor: '#424242',
    headerBgColor: '#000000',
    headerTextColor: '#FFFFFF',
    buttonColor: '#616161',
    buttonTextColor: '#FFFFFF',
    timestampColor: '#BDBDBD',
    userTimestampColor: '#EEEEEE',
    borderColor: '#616161'
  },
  {
    id: 'lavender',
    name: 'Lavender Purple',
    botColor: '#F3E5F5',
    userColor: '#dac9f3',
    chatTextColor: '#4A148C',
    userTextColor: '#311B92',
    windowBgColor: '#EDE7F6',
    inputBgColor: '#FFFFFF',
    headerBgColor: '#7E57C2',
    headerTextColor: '#FFFFFF',
    buttonColor: '#7E57C2',
    buttonTextColor: '#FFFFFF',
    timestampColor: '#4A148C',
    userTimestampColor: '#311B92',
    borderColor: '#D1C4E9'
  }
];