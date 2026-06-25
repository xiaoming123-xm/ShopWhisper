import adminApiClient from './client';
import { ApiResponse } from '@/types';
import {
  PlatformStatistics,
  RevenueStatistics,
  UsageStatistics,
} from '@/types/admin';

export const adminStatisticsApi = {
  // Get platform overview statistics
  getOverview: async (): Promise<ApiResponse<PlatformStatistics>> => {
    const response = await adminApiClient.get<ApiResponse<PlatformStatistics>>(
      '/admin/statistics/overview'
    );
    return response.data;
  },

  // Get revenue statistics
  getRevenue: async (
    period: 'day' | 'week' | 'month' | 'year' = 'month'
  ): Promise<ApiResponse<RevenueStatistics>> => {
    const response = await adminApiClient.get<ApiResponse<RevenueStatistics>>(
      '/admin/statistics/revenue',
      { params: { period } }
    );
    return response.data;
  },

  // Get usage statistics
  getUsage: async (
    period: 'day' | 'week' | 'month' | 'year' = 'month'
  ): Promise<ApiResponse<UsageStatistics>> => {
    const response = await adminApiClient.get<ApiResponse<UsageStatistics>>(
      '/admin/statistics/usage',
      { params: { period } }
    );
    return response.data;
  },

  // Get tenant growth data
  getTenantGrowth: async (
    startDate?: string,
    endDate?: string
  ): Promise<ApiResponse<{ growth: Array<{ date: string; count: number }> }>> => {
    const response = await adminApiClient.get<ApiResponse<{ growth: Array<{ date: string; count: number }> }>>(
      '/admin/statistics/tenant-growth',
      { params: { start_date: startDate, end_date: endDate } }
    );
    return response.data;
  },
};
