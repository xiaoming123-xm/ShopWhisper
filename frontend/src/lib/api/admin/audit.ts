import adminApiClient from './client';
import { ApiResponse } from '@/types';
import {
  AuditLog,
  SecurityAlert,
  AuditStatistics,
  AuditLogQueryParams,
  AdminPaginatedResponse,
} from '@/types/admin';

// Backend response format for audit logs
interface AuditLogsResponse {
  logs: AuditLog[];
  total: number;
  limit: number;
  offset: number;
}

// Backend response format for security alerts
interface SecurityAlertsResponse {
  alerts: SecurityAlert[];
  event_counts: Record<string, number>;
  period_days: number;
  total_alerts: number;
}

export const adminAuditApi = {
  // Get audit logs
  getLogs: async (params?: AuditLogQueryParams): Promise<ApiResponse<AdminPaginatedResponse<AuditLog>>> => {
    // Convert page/size to limit/offset for backend
    const backendParams = {
      ...params,
      limit: params?.size || 20,
      offset: ((params?.page || 1) - 1) * (params?.size || 20),
    };
    delete (backendParams as Record<string, unknown>).page;
    delete (backendParams as Record<string, unknown>).size;

    const response = await adminApiClient.get<ApiResponse<AuditLogsResponse>>(
      '/audit/logs',
      { params: backendParams }
    );

    // Transform backend response to frontend format
    const data = response.data.data;
    const page = params?.page || 1;
    const size = params?.size || 20;

    return {
      ...response.data,
      data: {
        items: data?.logs || [],
        total: data?.total || 0,
        page,
        size,
        pages: Math.ceil((data?.total || 0) / size),
      },
    };
  },

  // Get audit statistics (using events endpoint)
  getStatistics: async (): Promise<ApiResponse<AuditStatistics>> => {
    const response = await adminApiClient.get<ApiResponse<AuditStatistics>>(
      '/audit/statistics/events'
    );
    return response.data;
  },

  // Get security alerts
  getSecurityAlerts: async (
    page: number = 1,
    pageSize: number = 20,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _severity?: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _status?: string
  ): Promise<ApiResponse<AdminPaginatedResponse<SecurityAlert>>> => {
    const response = await adminApiClient.get<ApiResponse<SecurityAlertsResponse>>(
      '/audit/statistics/security-alerts',
      { params: { days: 7, limit: pageSize } }
    );

    // Transform backend response to frontend format
    const data = response.data.data;

    return {
      ...response.data,
      data: {
        items: data?.alerts || [],
        total: data?.total_alerts || 0,
        page,
        size: pageSize,
        pages: Math.ceil((data?.total_alerts || 0) / pageSize),
      },
    };
  },

  // Update alert status - not implemented in backend yet
  updateAlertStatus: async (
    alertId: string,
    status: 'investigating' | 'resolved' | 'dismissed'
  ): Promise<ApiResponse<{ message: string }>> => {
    const response = await adminApiClient.put<ApiResponse<{ message: string }>>(
      `/audit/alerts/${alertId}/status`,
      { status }
    );
    return response.data;
  },
};
