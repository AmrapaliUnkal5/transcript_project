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
  website: string;
  country: string;
  name: string;
  email: string;
  password: string;
}

export interface LoginData {
	email: string;
	password: string;
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
};