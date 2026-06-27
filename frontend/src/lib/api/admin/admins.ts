import adminApiClient from './client';
import { ApiResponse } from '@/types';
import {
  AdminInfo,
  AdminCreateRequest,
  AdminUpdateRequest,
  AdminQueryParams,
  AdminPaginatedResponse,
} from '@/types/admin';

export const adminManagementApi = {
  // Get admin list
  list: async (params?: AdminQueryParams): Promise<ApiResponse<AdminPaginatedResponse<AdminInfo>>> => {
    const response = await adminApiClient.get<ApiResponse<AdminPaginatedResponse<AdminInfo>>>(
      '/admin/admins',
      { params }
    );
    return response.data;
  },

  // Get admin detail
  get: async (adminId: string): Promise<ApiResponse<AdminInfo>> => {
    const response = await adminApiClient.get<ApiResponse<AdminInfo>>(
      `/admin/admins/${adminId}`
    );
    return response.data;
  },

  // Create admin
  create: async (data: AdminCreateRequest): Promise<ApiResponse<AdminInfo>> => {
    const response = await adminApiClient.post<ApiResponse<AdminInfo>>(
      '/admin/admins',
      data
    );
    return response.data;
  },

  // Update admin
  update: async (adminId: string, data: AdminUpdateRequest): Promise<ApiResponse<AdminInfo>> => {
    const response = await adminApiClient.put<ApiResponse<AdminInfo>>(
      `/admin/admins/${adminId}`,
      data
    );
    return response.data;
  },

  // Delete admin
  delete: async (adminId: string): Promise<ApiResponse<{ message: string }>> => {
    const response = await adminApiClient.delete<ApiResponse<{ message: string }>>(
      `/admin/admins/${adminId}`
    );
    return response.data;
  },
};
