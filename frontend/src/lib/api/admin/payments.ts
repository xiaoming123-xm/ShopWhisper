import adminApiClient from './client';
import { ApiResponse } from '@/types';
import {
  BillInfo,
  PendingBillInfo,
  PaymentOrderInfo,
  BillQueryParams,
  AdminPaginatedResponse,
} from '@/types/admin';

export interface PaymentOrderQueryParams {
  page?: number;
  size?: number;
  status?: string;
  tenant_id?: string;
}

export const adminPaymentsApi = {
  // Get payment orders list
  listOrders: async (params?: PaymentOrderQueryParams): Promise<ApiResponse<AdminPaginatedResponse<PaymentOrderInfo>>> => {
    const response = await adminApiClient.get<ApiResponse<AdminPaginatedResponse<PaymentOrderInfo>>>(
      '/payment/orders',
      { params }
    );
    return response.data;
  },

  // Get pending bills
  getPendingBills: async (
    page: number = 1,
    pageSize: number = 20
  ): Promise<ApiResponse<{ total: number; page: number; page_size: number; items: PendingBillInfo[] }>> => {
    const response = await adminApiClient.get<ApiResponse<{ total: number; page: number; page_size: number; items: PendingBillInfo[] }>>(
      '/admin/bills/pending',
      { params: { page, page_size: pageSize } }
    );
    return response.data;
  },

  // Get all bills
  listBills: async (params?: BillQueryParams): Promise<ApiResponse<AdminPaginatedResponse<BillInfo>>> => {
    const response = await adminApiClient.get<ApiResponse<AdminPaginatedResponse<BillInfo>>>(
      '/admin/bills',
      { params }
    );
    return response.data;
  },

  // Approve bill
  approveBill: async (billId: string): Promise<ApiResponse<{ message: string }>> => {
    const response = await adminApiClient.post<ApiResponse<{ message: string }>>(
      `/admin/bills/${billId}/approve`
    );
    return response.data;
  },

  // Reject bill
  rejectBill: async (billId: string, reason: string): Promise<ApiResponse<{ message: string; reason: string }>> => {
    const response = await adminApiClient.post<ApiResponse<{ message: string; reason: string }>>(
      `/admin/bills/${billId}/reject`,
      null,
      { params: { reason } }
    );
    return response.data;
  },

  // Process refund
  refund: async (billId: string, reason: string, amount?: number): Promise<ApiResponse<{ message: string }>> => {
    const response = await adminApiClient.post<ApiResponse<{ message: string }>>(
      `/admin/billing/${billId}/refund`,
      { reason, amount }
    );
    return response.data;
  },

  // Sync order status from Alipay
  syncOrder: async (orderNumber: string): Promise<ApiResponse<{ message: string; order: unknown }>> => {
    const response = await adminApiClient.post<ApiResponse<{ message: string; order: unknown }>>(
      `/payment/admin/orders/${orderNumber}/sync`
    );
    return response.data;
  },
};
