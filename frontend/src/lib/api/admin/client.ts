import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { ApiResponse } from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000/api/v1';

// Admin token storage keys (separate from regular user tokens)
const ADMIN_ACCESS_TOKEN_KEY = 'admin_access_token';

// Create axios instance for admin API
const adminApiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Admin token management
export const adminTokenManager = {
  getAccessToken: (): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(ADMIN_ACCESS_TOKEN_KEY);
  },

  setToken: (accessToken: string): void => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(ADMIN_ACCESS_TOKEN_KEY, accessToken);
  },

  clearToken: (): void => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(ADMIN_ACCESS_TOKEN_KEY);
  },
};

// Request interceptor - add auth header
adminApiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = adminTokenManager.getAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle 401 errors
adminApiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiResponse<unknown>>) => {
    // Handle 401 errors - redirect to admin login
    if (error.response?.status === 401) {
      adminTokenManager.clearToken();
      if (typeof window !== 'undefined') {
        // Clear admin store and redirect to login
        window.location.href = '/admin-login';
      }
    }

    return Promise.reject(error);
  }
);

export default adminApiClient;
