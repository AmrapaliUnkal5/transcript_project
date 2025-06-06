import axios from 'axios';
import { ApiFile, DemoRequestData, GetWeeklyConversationsParams, TeamMember, TeamInvitation, TeamMemberRole, UserUsageResponse } from '../types';
import { AddonPlan } from '../types';

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
  activeRequests++;
  updateLoadingState();
  
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
  return config;
}, (error) => {
  activeRequests--;
  updateLoadingState();
  console.error("API Request error:", error);
  return Promise.reject(error);
});

// Add response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => {
    activeRequests--;
    updateLoadingState();
    
    // Log successful responses (but not file downloads which could be large)
    if (!response.config.responseType || response.config.responseType !== 'blob') {
      console.log(`API Response: ${response.config.method?.toUpperCase()} ${response.config.url} (${response.status})`);
    }
    
    // Check if the response contains a new token
    const newToken = response.headers['x-new-token'];
    if (newToken) {
      // Update the token in localStorage
      localStorage.setItem('token', newToken);
    }
    
    return response;
  },
  (error) => {
    activeRequests--;
    updateLoadingState();
    
    console.error("API Response error:", error);
    console.error("Request that failed:", error.config);
    
    if (error.response) {
      console.error("Error response status:", error.response.status);
      console.error("Error response data:", error.response.data);
    }
    
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
  window_bg_color: string;
  welcome_message: string;
  input_bg_color: string;
  // New customization fields
  header_bg_color?: string;
  header_text_color?: string;
  chat_text_color?: string;
  user_text_color?: string;
  button_color?: string;
  button_text_color?: string;
  timestamp_color?: string;
  border_radius?: string;
  border_color?: string;
  chat_font_family?: string;
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
  currentAvatarUrl ?:string;
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
export interface ReactionData {
  interaction_id: number;
  session_id: string;
  bot_id: number;
  reaction: "like" | "dislike";
  message_id: number;
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
  getAccountInfo: async (email: string) => {
    const response = await api.get(`/account?email=${email}`);
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

  updateBotDomain: async (botId: number, selectedDomain: string) => {
  const response = await api.put("/widget/bots/update-domain", {
    bot_id: botId,
    selected_domain: selectedDomain,
  });
  return response.data;
  },

  getBotDomain: async (botId: number) => {
    const response = await api.get(`widget/bots/${botId}/domain`);
    return response.data;
  },

  checkWhiteLabelingAddon: async (botId: number) => {
  const response = await api.get("/addon/white-labeling-check", {
    params: {
      bot_id: botId,
    },
  });
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
  
  facebookLogin: async (accessToken: string) => {
  const response = await api.post("/auth/facebook", {
    access_token: accessToken
  });
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

  scrapeNodesAsync: async (selectedNodes: string[], botId: number) => {
    const response = await api.post(`/scrape-async`, {
      selected_nodes: selectedNodes,
      bot_id: botId
    }, {
      headers: { "Content-Type": "application/json" }
    });
    return response.data;
  },

  scrapeYoutubeVideos: async (selectedVideos: string[], botId: number) => {
    const response = await api.post(`/scrape-youtube`, {
      selected_videos: selectedVideos, 
      bot_id: botId
    }, {
      headers: { "Content-Type": "application/json" }
    });
    return response.data;
  },

  validatecaptcha: async (data: string, captchaId: string) => {
    const response = await api.post('/validate-captcha', 
        { user_input: data },
        { headers: { 'X-Captcha-ID': captchaId } }
    );
    return response.data;
},

// Update fetchCaptcha to return both the URL and headers
fetchCaptcha: async () => {    
    const response = await api.get('/captcha', { 
        responseType: 'blob',
          // This ensures we get access to headers
        transformResponse: (res, headers) => {
            return {
                data: res,
                headers: headers
            };
        }
   });
    const imageUrl = URL.createObjectURL(response.data.data);
    return {
        imageUrl,
        captchaId: response.data.headers['x-captcha-id']
    };
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

  sendMessage: async (interactionId: number, sender: string, message: string, isAddonMessage: boolean) => {
    const response = await api.post("/chat/send_message", { interaction_id: interactionId, sender, message_text: message,is_addon_message: isAddonMessage });
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

  updateBotTheme: async (botId: number, themeData: { theme_id: string }) => {
  const response = await api.put(`/botsettings/theme/${botId}`, themeData);  // API endpoint to update bot theme
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
  fetchVideosFromYouTube: async (youtubeUrl: string) => {
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
  deleteAccount: async () => {
    const response = await api.delete('/user/delete-account');
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
  deleteVideo: async (botId: number, videoId: string, wordCount: number = 0) => {
    return await api.delete(`/chatbot/bot/${botId}/videos`, {
      params: { 
        video_id: videoId,
        word_count: wordCount
      },
    });
  },

deleteScrapedUrl: async (botId: number, url: string, wordcount: number = 0) => {
    return await api.delete(`/chatbot/bot/${botId}/scraped-urls`, {
      params: { url: url,
        word_count:wordcount
      },
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
    const response = await api.get('/last-seven-days-conversations', {
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
    const response = await api.get("/subscriptionplans/");
    return response.data;
  },

  endInteraction: async (interaction_id: number) => {
    const response = await api.put(`/chat/interactions/${interaction_id}/end`);
    return response.data; // API response format: { message: "Session ended successfully", end_time: "timestamp" }
  },

  checkUserSubscription: async (userId: number) => {
  const response = await api.get(`/check-user-subscription/${userId}`);
  return response.data; // Expected format: { exists: true/false }
  },


  getUserUsage: async (): Promise<UserUsageResponse> => {
    const response = await api.get('/user/usage');
    return response.data;
  },

  updateBotWordCount: async (data: { bot_id: number; word_count: number;file_size?:number }):
    Promise<{ success: boolean }> => {
    const response = await api.post('/bot/update_word_count', data);
    return response.data;
  },
  
  getUsageMetrics: async () => {
    const response = await api.get('/usage-metrics');
    return response.data;
  },

  submitReaction: async (data: ReactionData) => {
    const response = await api.post("/botsettings/interactions/reaction", data);
    return response.data;
  },
  fetchNotifications: async () => {
    const response = await api.get("/notifications");
    return response.data;
  },

  markNotificationAsRead: async (notif_id: number) => {
    const response = await api.post(`/notifications/${notif_id}/mark-read`);
    return response.data;
  },

  markAllNotificationsAsRead: async () => {
    const response = await api.post("/notifications/mark-all-read");
    return response.data;
  },

  getFAQ: async (params: { bot_id: number }) => {
    try {
      const response = await api.get(`/chat/analytics/faqs/${params.bot_id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching FAQ data:', error);
      throw error;
    }
  },

  getWordCloud: async (params: { bot_id: number }) => {
    try {
      const response = await api.get(`/chat/analytics/word_cloud/${params.bot_id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching FAQ data:', error);
      throw error;
    }
  },

  fetchAddons: async (): Promise<AddonPlan[]> => {
    try {
      const response = await api.get('/subscriptionaddons/');
      return response.data;
    } catch (error) {
      console.error('Error fetching addons:', error);
      throw error;
    }
  },  

  // Fetch user-specific active addons
  fetchUserAddons: async (userId: number): Promise<AddonPlan[]> => {
    try {
      const response = await api.get(`/subscriptionaddons/user/${userId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching user addons:', error);
      throw error;
    }
  },

  updateAddonUsage: async (addonId: number, messagesUsed: number) => {
    return api.post(`/user-addons/update-usage`, {
      addon_id: addonId,
      messages_used: messagesUsed
    });
  },

  recordAddonUsage: async (addonId: number, messagesUsed: number) => {
    return api.post(`/subscriptionaddons/record-usage`, {
      addon_id: addonId,
      messages_used: messagesUsed,
    });
  },

  // Add these to your authApi service
  getBotExternalKnowledge: async (botId: number) => {
    const response = await api.get(`/get-bot-external-knowledge/${botId}`);
    return response.data;
  },

updateBotExternalKnowledge: async (botId: number) => {
  const response = await api.put(`/update-bot-external-knowledge/${botId}`);
  return response.data;
},
  getUserMessageCount: async (): Promise<{
    addons: {
      total_limit: number;
      used: number;
      remaining: number;
      items: Array<{
        used: number;
        addon_id: number;
        name: string;
        limit: number;
        remaining: number;

      }>;
    };
    effective_remaining: number;
    base_plan: {
      limit: number;
      used: number;
      remaining: number;
    };
    userMessageCount: number;
    total_messages_used: number;
    remainingMessages: number;
    planLimit: number;
  }> => {
    const response = await api.get('/user/msgusage');
    return response.data;
  },

  getBotToken: async (botId: number): Promise<{ token: string }> => {
    const response = await api.get(`/widget/bot/${botId}/token`);
    return response.data;
  },
 
  getCurrentBillingMetrics: async (params: { bot_id: number }) => {
    const response = await api.get('/current-billing-metrics', {
      params: {
        bot_id: params.bot_id,
      },
    });
    return response.data;
  },
 
};

export const subscriptionApi = {
  getPlans: async () => {
    const response = await api.get("/subscriptionplans/");
    return response.data;
  },
  
  getAddons: async () => {
    try {
      console.log("Calling GET /subscriptionaddons/ API endpoint");
      const response = await api.get("/subscriptionaddons/");
      console.log("Addons API response:", response.status, response.data);
      return response.data;
    } catch (error: any) {
      console.error("Error fetching addons:", error);
      if (error.response) {
        console.error("Error details:", error.response.status, error.response.data);
      }
      return []; // Return empty array on error instead of throwing
    }
  },

  // In your subscriptionApi service
  getCurrentPlan: async (userId: number) => {
    const response = await api.get(`/subscription/user/${userId}/current`);
    return response.data;
  },
  
  getUserAddons: async (userId: number) => {
    const response = await api.get(`/user/${userId}/addons`);
    return response.data;
  },

  purchaseAddon: async (addonId: number, quantity: number = 1): Promise<string> => {
    try {
      console.log(`DEBUG - API - Creating addon checkout for addon ${addonId} with quantity ${quantity}`);
      
      const payload = {
        addon_id: addonId,
        quantity: quantity
      };
      console.log(`DEBUG - API - Addon checkout payload:`, JSON.stringify(payload));
      
      const response = await api.post("/addons/checkout", payload);
      
      console.log("DEBUG - API - Addon checkout API response status:", response.status);
      console.log("DEBUG - API - Addon checkout API response data:", response.data);
      
      if (response?.data?.checkout_url) {
        console.log("DEBUG - API - Addon checkout URL received:", response.data.checkout_url);
        return response.data.checkout_url;
      } else {
        console.error("DEBUG - API - No checkout URL in response:", response.data);
        throw new Error('No checkout URL returned from the server');
      }
    } catch (error: any) {
      console.error("DEBUG - API - Error in addon checkout API:", error);
      
      if (error.response?.data?.detail) {
        // Extract the error message from the API response if available
        throw new Error(error.response.data.detail);
      }
      
      throw error;
    }
  },
  
  createCheckout: async (planId: number, addonIds?: number[]): Promise<string> => {
    const response = await api.post("/subscription/checkout", { planId, addonIds });
    return response.data.url;
  },

  // New endpoints for Zoho subscription
  syncPlansWithZoho: async () => {
    const response = await api.post("/zoho/sync/plans");
    return response.data;
  },
  
  syncAddonsWithZoho: async () => {
    const response = await api.post("/zoho/sync/addons");
    return response.data;
  },
  
  createSubscriptionCheckout: async (planId: number, addonIds?: number[]) => {
    try {
      console.log(`DEBUG - API - Creating checkout for plan ${planId}`);
      console.log(`DEBUG - API - Addon IDs being sent to backend:`, addonIds || []);
      
      // Log the exact payload being sent
      const payload = {
        plan_id: planId,
        addon_ids: addonIds || []
      };
      console.log(`DEBUG - API - Exact payload being sent to backend:`, JSON.stringify(payload));
      
      const response = await api.post("/zoho/checkout", payload);
      
      console.log("DEBUG - API - Checkout API response status:", response.status);
      console.log("DEBUG - API - Checkout API response data:", response.data);
      
      if (response?.data?.checkout_url) {
        console.log("DEBUG - API - Checkout URL received:", response.data.checkout_url);
        return response.data.checkout_url;
      } else {
        console.error("DEBUG - API - No checkout URL in response:", response.data);
        throw new Error('No checkout URL returned from the server');
      }
    } catch (error: any) {
      console.error("DEBUG - API - Error in subscription checkout API:", error);
      console.error("DEBUG - API - Error message:", error.message);
      
      if (error.response) {
        console.error("DEBUG - API - Error response status:", error.response.status);
        console.error("DEBUG - API - Error response data:", error.response.data);
        
        // Check if this is the phone number required error
        if (error.response.status === 422 && error.response.data?.detail === "phone_number_required") {
          // Create a special error object with a type property
          const phoneRequiredError = new Error(error.response.data.message || "Phone number is required for subscription");
          phoneRequiredError.name = "PhoneNumberRequiredError";
          throw phoneRequiredError;
        }
      }
      
      if (error.request) {
        console.error("DEBUG - API - Error request:", error.request);
      }
      
      if (error.response?.data?.detail) {
        // Extract the error message from the API response if available
        throw new Error(error.response.data.detail);
      }
      
      throw error;
    }
  },  

  // New method to get subscription status (including pending status)
  getSubscriptionStatus: async (userId: number) => {
    try {
      const response = await api.get(`/zoho/status/${userId}`);
      return response.data;
    } catch (error) {
      console.error('Error getting subscription status:', error);
      throw error;
    }
  },
  
  // Method to resume a pending checkout
  resumeCheckout: async (subscriptionId: number) => {
    try {
      const response = await api.post(`/zoho/resume-checkout/${subscriptionId}`);
      return response.data.checkout_url;
    } catch (error) {
      console.error('Error resuming checkout:', error);
      throw error;
    }
  },
  
  // Method to cancel a pending subscription
  cancelPendingSubscription: async (subscriptionId: number) => {
    try {
      await api.post(`/zoho/cancel-pending/${subscriptionId}`);
      return true;
    } catch (error) {
      console.error('Error canceling pending subscription:', error);
      throw error;
    }
  },

  // Get pending addon purchases for a user
  getPendingAddonPurchases: async (userId: number) => {
    try {
      const response = await api.get(`/addons/pending/${userId}`);
      return response.data.pendingAddons;
    } catch (error) {
      console.error('Error getting pending addon purchases:', error);
      throw error;
    }
  },
  
  // Cancel a pending addon purchase
  cancelPendingAddonPurchase: async (addonId: number) => {
    try {
      const response = await api.post(`/addons/cancel-pending/${addonId}`);
      return response.data;
    } catch (error) {
      console.error('Error canceling pending addon purchase:', error);
      throw error;
    }
  },
};