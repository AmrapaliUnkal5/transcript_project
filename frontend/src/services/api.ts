import axios from 'axios';
import { ApiFile, DemoRequestData, GetWeeklyConversationsParams, TeamMember, TeamInvitation, TeamMemberRole } from '../types';


const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

let activeRequests = 0;
let setLoadingState: ((loading: boolean) => void) | null = null;

// Function to set loading state from external components
export const setLoadingHandler = (handler: (loading: boolean) => void) => {
  setLoadingState = handler;
};

// Function to update loading state
const updateLoadingState = () => {
  if (setLoadingState) {
    setLoadingState(activeRequests > 0);
  }
};



// Add request interceptor to add auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Add response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => {
    activeRequests--;
    updateLoadingState();
    return response;
  },
  (error) => {
    activeRequests--;
    updateLoadingState();
    if (error.response?.status === 401) {
      // Clear auth data and redirect to login
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export interface SignUpData {
  company_name: string;
  //website: string;
  //country: string;
  name: string;
  phone_no: string;
  email: string;
  password: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface ForgotPasswordData {
  email: string;
}

export interface PasswordResetData {

  token: string;
  password: string;
}

export interface BotSettingsData {
  user_id: number;
  bot_name: string;
  bot_icon: string;
  font_style: string;
  font_size: number;
  position: string;
  max_words_per_message: number;
  bot_color: string;
  user_color: string;
  is_active: boolean;
  appearance: string;
  temperature: number;
}

export interface uploadAvatar {
  user_id: number;
  avatar_url: string;
}

export interface deleteBot {
  status: string;
}

export interface UserUpdate {
  name?: string;
  company_name?: string;
  communication_email?: string;
  phone_no?: string;
}

export interface BotStatusUpdate {
  status: string;
  is_active: boolean;
}

export interface BotMetrics {
  bot_id: number;
  reactions: {
    likes: number;
    dislikes: number;
    neutral: number;
  };
  average_time_spent: {
    day: string;
    average_time_spent: number;
  }[];
}

// Team management interfaces
export interface TeamMemberInvite {
  email: string;
  role: TeamMemberRole;
}

export interface TeamMemberUpdate {
  role?: TeamMemberRole;
  invitation_status?: string;
}

export const authApi = {
  signup: async (data: SignUpData) => {
    const response = await api.post('/register', data);
    return response.data;
  },
  login: async (data: LoginData) => {
    const response = await api.post('/login', data);
    return response.data;
  },
  logout: async () => {
    const response = await api.post('/auth/logout');
    return response.data;
  },
  socialLogin: async (provider: string, token: string) => {
    const response = await api.post(`/auth/${provider}/callback`, { token });
    return response.data;
  },

  forgotPassword: async (data: ForgotPasswordData) => {
    const response = await api.post("/forgot-password/", data);
    return response.data;
  },
  saveBotSettings: async (data: BotSettingsData) => {
    const response = await api.post('/botsettings', data);  // API endpoint to save bot settings
    return response.data;
  },
  getBotSettings: async (bot_id: number) => {
    const response = await api.get(`/botsettings/${bot_id}`);
    return response.data;
  },
  getBotSettingsByUserId: async (user_id: number): Promise<BotSettingsData[]> => {
    const response = await api.get(`/botsettings/user/${user_id}`);
    return response.data;  // This is not used currently Expecting an array of bot settings
  },
  // New function to update bot settings
  updateBotSettings: async (botId: number, data: BotSettingsData) => {
    const response = await api.put(`/botsettings/${botId}`, data);  // API endpoint to update bot settings
    return response.data;
  },
  resetPassword: async (data: PasswordResetData) => {

    const response = await api.post("/reset-password/", data); // API endpoint to reset password
    return response.data; // Return the response from the backend


  },

  uploadBotIcon: async (fileData: FormData) => {
    const response = await api.post("/botsettings/upload_bot", fileData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },

  uploadAvatar: async (formData: FormData) => {
    const response = await api.post("/upload-avatar/", formData, {
      headers: {
        "Content-Type": "multipart/form-data", // Make sure to set the Content-Type header
      },
    });
    return response.data;
  },

  getBotConversations: async () => {
    const response = await api.get('/dashboard_consumables');
    return response.data;
  },

  updateAvatar: async (data: uploadAvatar) => {
    const response = await api.put("/update-avatar/", data);
    return response.data;
  },

  googleLogin: async (credential: string) => {
    const response = await api.post("/auth/google", { credential });
    return response.data;
  },

  getWebsiteNodes: async (websiteUrl: string) => {
    const response = await api.get(`/get_nodes`, { params: { website_url: websiteUrl } });
    return response.data;
  },

  scrapeNodes: async (selectedNodes: string[], botId: number) => {
    const response = await api.post(`/scrape`, {
      selected_nodes: selectedNodes,  // ✅ Change from array to object
      bot_id: botId  // ✅ Include bot_id
    }, {
      headers: { "Content-Type": "application/json" }
    });
    return response.data;
  },

  validatecaptcha: async (data: string) => {
    const response = await api.post('/validate-captcha', { user_input: data });
    return response.data;
  },

  fetchCaptcha: async () => {
    const response = await api.get('/captcha', { responseType: 'blob' }); // Set response type to blob
    return URL.createObjectURL(response.data); // Convert blob data to URL
  },

  uploadFiles: async (files: File[], botId: number) => {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append("files", file);
    });
    formData.append("bot_id", botId.toString());

    const response = await api.post('/upload', formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  },

  startChat: async (botId: number, userId: number) => {
    const response = await api.post("/chat/start_chat", { bot_id: botId, user_id: userId });
    return response.data;
  },

  sendMessage: async (interactionId: number, sender: string, message: string) => {
    const response = await api.post("/chat/send_message", { interaction_id: interactionId, sender, message_text: message });
    return response.data;
  },

  getChatMessages: async (interactionId: number) => {
    const response = await api.get(`/chat/get_chat_messages?interaction_id=${interactionId}`);
    return response.data;
  },

  getFiles: async (botId: number): Promise<ApiFile[]> => {
    const response = await api.get<ApiFile[]>('/files', {
      params: { bot_id: botId },
    });
    return response.data;
  },

  createBot: async (botData: {
    bot_name: string;
    status: string;
    is_active: boolean;
    external_knowledge: boolean;
  }) => {
    const response = await api.post("/create-bot", botData);
    return response.data;
  },


  updateBotStatus: async (botId: number, statusData: { status?: string; is_active?: boolean }) => {
    const response = await api.patch(`/bots/${botId}`, statusData);
    return response.data;
  },

  updateBotName: async (botData: { bot_id: number; bot_name: string }) => {
    const response = await api.put("/update-bot-name/" + botData.bot_id, { bot_name: botData.bot_name });
    return response.data;
  },
  getBotSettingsBotId: async (botId: number) => {
    const response = await api.get(`/botsettings/bot/${botId}`);  // API endpoint to fetch bot settings
    return response.data;
  },
  getConversationTrends: async (userId: number) => {
    const response = await api.get(`/conversation-trends?user_id=${userId}`);
    return response.data;
  },

  deletebot: async (botId: number, data: deleteBot) => {
    const response = await api.put(`/botsettings/del/${botId}`, data);  // API endpoint to update bot settings
    return response.data;
  },

  deleteFile: async (fileId: string) => {
    const response = await api.delete(`/files/${fileId}`);
    return response.data;
  },

  getEmailVerify: async (token: string) => {
    const response = await api.get(`/verify-email?token=${token}`); // Send the token as a query parameter
    return response.data; // Return the response from the backend
  },
  resendVerificationEmail: async (token: string) => {
    const response = await api.post("/resend-verification-email", { token });
    return response.data;
  },
  fetchVideosFromPlaylist: async (youtubeUrl: string) => {
    const response = await api.post("/chatbot/fetch-videos", { url: youtubeUrl }); // Change 'playlist_url' to 'url'
    return response.data; // Returns list of video details
  },

  storeSelectedYouTubeTranscripts: async (videoUrls: string[], botId: number) => {
    const response = await api.post("/chatbot/process-videos", {
      bot_id: botId,
      video_urls: videoUrls
    });
    return response.data; // Returns success message after storing transcripts
  },
  getUserDetails: async () => {
    const response = await api.get("/user/me"); // Fetch logged-in user details
    return response.data;
  },
  updateUserDetails: async (data: Partial<UserUpdate>) => {
    const response = await api.put('/user/me', data); // Update user details
    return response.data;
  },

  fetchVideosForBot: async (botId: number) => {
    const response = await api.get(`/chatbot/bot/${botId}/videos`);
    return response.data; // Returns list of video URLs
  },
  updateBotStatusActive: async (botId: number, data: BotStatusUpdate) => {
    const response = await api.put(`/botsettings/bots/${botId}`, data);  // API endpoint to update bot settings
    return response.data;
  },
  fetchBotMetrics: async (botId: number): Promise<BotMetrics> => {
    const response = await api.get(`/bot/${botId}/metrics`);
    return response.data;
  },
  getScrapedUrls: async (botId: number) => {
    const response = await api.get(`/scraped-urls/${botId}`);  // API endpoint to fetch scraped URLs
    return response.data;
  },
  deleteVideo: async (botId: number, videoId: string) => {
    return await api.delete(`/chatbot/bot/${botId}/videos`, {
      params: { video_id: videoId },  // Pass video_id as query param
    });
  },

  deleteScrapedUrl: async (botId: number, url: string) => {
    return await api.delete(`/chatbot/bot/${botId}/scraped-urls`, {
      params: { url: url },
    });
  },


  submitIssueRequest: async (data: FormData) => {
    const response = await api.post('/submit-issue-request', data, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  submitDemoRequest: async (data: FormData) => {
    const response = await api.post("/submit-demo-request", data, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  },


  getWordCount: async (formData: FormData) => {
    const response = await api.post('/word_count/', formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  },

  uploadFilesWithCounts: async (formData: FormData) => {
    const response = await api.post('/upload', formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  },


  getWeeklyConversations: async (params: { bot_id: number }) => {
    const response = await api.get('/weekly-conversations', {
      params: {
        bot_id: params.bot_id,
      },
    });
    return response.data;
  },

  // Team Management APIs
  inviteTeamMember: async (data: TeamMemberInvite) => {
    const response = await api.post('/team/invite', data);
    return response.data;
  },

  getTeamMembers: async () => {
    const response = await api.get('/team/members');
    return response.data;
  },

  getPendingInvitations: async () => {
    const response = await api.get('/team/invitations');
    return response.data;
  },

  getMyTeams: async () => {
    const response = await api.get('/team/teams');
    return response.data;
  },

  respondToInvitation: async (invitation_token: string, response: string) => {
    const responseData = await api.post(`/team/respond/${invitation_token}?response=${response}`);
    return responseData.data;
  },

  updateTeamMember: async (member_id: number, data: TeamMemberUpdate) => {
    const response = await api.put(`/team/members/${member_id}`, data);
    return response.data;
  },

  removeTeamMember: async (member_id: number) => {
    const response = await api.delete(`/team/members/${member_id}`);
    return response.data;
  },

  // Password change interface and function
  changePassword: async (data: { current_password: string; new_password: string }) => {
    const response = await api.post('/user/change-password', data);
    return response.data;
  },

  fetchPlans: async () => {

    const response = await api.get("/subscriptionplans");
    return response.data;

  },

  endInteraction: async (interaction_id: number) => {
    const response = await api.put(`/chat/interactions/${interaction_id}/end`);
    return response.data; // API response format: { message: "Session ended successfully", end_time: "timestamp" }
  },
  getUserUsage: async (): Promise<{
    totalWordsUsed: number;
    remainingWords: number;
    planLimit: number;
  }> => {
    const response = await api.get('/user/usage'); return response.data;
  },

  updateBotWordCount: async (data: { bot_id: number; word_count: number }):
    Promise<{ success: boolean }> => {
    const response = await api.post('/bot/update_word_count', data);
    return response.data;
  }

};
