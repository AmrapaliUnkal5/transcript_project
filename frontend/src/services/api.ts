import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

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
  (response) => response,
  (error) => {
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
  phone_no:string;
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
  appearance:string;
  temperature:number;
}

export interface uploadAvatar{
  user_id: number;
  avatar_url: string;
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

  scrapeNodes: async (selectedNodes: string[]) => {
    const response = await api.post(`/scrape`, selectedNodes, {
        headers: { "Content-Type": "application/json" }
    });
    return response.data; 
  },

  validatecaptcha: async (data: string) => {
    const response = await api.post('/validate-captcha',{ user_input: data });
    return response.data;
  },
  fetchCaptcha: async () => {
    const response = await api.get('/captcha', { responseType: 'blob' }); // Set response type to blob
    return URL.createObjectURL(response.data); // Convert blob data to URL
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
  }
};