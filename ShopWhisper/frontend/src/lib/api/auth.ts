import apiClient from './client';
import {
  ApiResponse,
  ChangePasswordRequest,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
} from '@/types';

export const authApi = {
  login: async (data: LoginRequest): Promise<ApiResponse<LoginResponse>> => {
    const response = await apiClient.post<ApiResponse<LoginResponse>>('/auth/login', data);
    return response.data;
  },

  register: async (data: RegisterRequest): Promise<ApiResponse<RegisterResponse>> => {
    const response = await apiClient.post<ApiResponse<RegisterResponse>>('/auth/register', data);
    return response.data;
  },

  logout: async (refreshToken?: string): Promise<ApiResponse<{ message: string }>> => {
    const response = await apiClient.post<ApiResponse<{ message: string }>>('/auth/logout', {
      refresh_token: refreshToken,
    });
    return response.data;
  },

  changePassword: async (data: ChangePasswordRequest): Promise<ApiResponse<{ message: string }>> => {
    const response = await apiClient.post<ApiResponse<{ message: string }>>('/auth/change-password', data);
    return response.data;
  },

  refreshToken: async (refreshToken: string): Promise<ApiResponse<{ access_token: string; token_type: string; expires_in: number }>> => {
    const response = await apiClient.post<ApiResponse<{ access_token: string; token_type: string; expires_in: number }>>('/auth/refresh', {
      refresh_token: refreshToken,
    });
    return response.data;
  },
};
