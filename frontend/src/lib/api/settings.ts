import apiClient from './client';
import { ApiResponse } from '@/types';

export interface TenantInfo {
  id: number;
  tenant_id: string;
  company_name: string;
  contact_name: string | null;
  contact_email: string;
  contact_phone: string | null;
  status: string;
  current_plan: string;
  api_key_prefix: string | null;
}

export const settingsApi = {
  // Get tenant info (includes api_key_prefix)
  getTenantInfo: async (): Promise<ApiResponse<TenantInfo>> => {
    const response = await apiClient.get<ApiResponse<TenantInfo>>('/tenant/info-token');
    return response.data;
  },

  // Get API Key plaintext
  getApiKey: async (): Promise<ApiResponse<{ api_key: string | null; api_key_prefix: string | null; message?: string }>> => {
    const response = await apiClient.get<ApiResponse<{ api_key: string | null; api_key_prefix: string | null; message?: string }>>('/tenant/api-key');
    return response.data;
  },

  // Reset tenant API Key (returns new key once)
  resetApiKey: async (): Promise<ApiResponse<{ api_key: string; api_key_prefix: string; message: string }>> => {
    const response = await apiClient.post<ApiResponse<{ api_key: string; api_key_prefix: string; message: string }>>('/tenant/reset-api-key');
    return response.data;
  },
};
