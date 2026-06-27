import apiClient from './client';
import {
  ApiResponse,
  PaginatedResponse,
  Conversation,
  ConversationDetail,
  ConversationCreateRequest,
  Message,
  MessageCreateRequest,
} from '@/types';

export const conversationApi = {
  create: async (data: ConversationCreateRequest): Promise<ApiResponse<Conversation>> => {
    const response = await apiClient.post<ApiResponse<Conversation>>('/conversation/create', data);
    return response.data;
  },

  list: async (params?: {
    user_id?: string;
    status?: string;
    platform_type?: string;
    page?: number;
    size?: number;
  }): Promise<ApiResponse<PaginatedResponse<Conversation>>> => {
    const response = await apiClient.get<ApiResponse<PaginatedResponse<Conversation>>>('/conversation/list', {
      params,
    });
    return response.data;
  },

  get: async (conversationId: string): Promise<ApiResponse<ConversationDetail>> => {
    const response = await apiClient.get<ApiResponse<ConversationDetail>>(`/conversation/${conversationId}`);
    return response.data;
  },

  sendMessage: async (
    conversationId: string,
    data: MessageCreateRequest
  ): Promise<ApiResponse<Message>> => {
    const response = await apiClient.post<ApiResponse<Message>>(
      `/conversation/${conversationId}/messages`,
      data
    );
    return response.data;
  },

  getMessages: async (
    conversationId: string,
    limit?: number
  ): Promise<ApiResponse<Message[]>> => {
    const response = await apiClient.get<ApiResponse<Message[]>>(
      `/conversation/${conversationId}/messages`,
      { params: { limit } }
    );
    return response.data;
  },

  close: async (
    conversationId: string,
    data?: { satisfaction_score?: number; feedback?: string }
  ): Promise<ApiResponse<Conversation>> => {
    const response = await apiClient.put<ApiResponse<Conversation>>(
      `/conversation/${conversationId}`,
      { status: 'closed', ...data }
    );
    return response.data;
  },

  takeover: async (
    conversationId: string,
    reason?: string
  ): Promise<ApiResponse<Conversation>> => {
    const response = await apiClient.put<ApiResponse<Conversation>>(
      `/conversation/${conversationId}/takeover`,
      { reason }
    );
    return response.data;
  },
};
