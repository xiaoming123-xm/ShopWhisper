import apiClient from './client';
import type {
  ApiResponse,
  PaginatedResponse,
  Product,
  ProductDemoListingRequest,
  ProductDemoListingResponse,
  ProductPriceEstimate,
  ProductPriceEstimateRequest,
  SyncTask,
  SyncSchedule,
} from '@/types';

export const productApi = {
  // ===== 商品 =====

  async listProducts(params?: {
    keyword?: string;
    category?: string;
    status?: string;
    platform_config_id?: number;
    page?: number;
    size?: number;
  }): Promise<ApiResponse<PaginatedResponse<Product>>> {
    const { data } = await apiClient.get('/products', { params });
    return data;
  },

  async getProduct(productId: number): Promise<ApiResponse<Product>> {
    const { data } = await apiClient.get(`/products/${productId}`);
    return data;
  },

  async deleteProduct(productId: number): Promise<ApiResponse<{ message: string }>> {
    const { data } = await apiClient.delete(`/products/${productId}`);
    return data;
  },

  async listLocalPhotos(): Promise<ApiResponse<Array<{ name: string; url: string; size: number }>>> {
    const { data } = await apiClient.get('/products/local-photos');
    return data;
  },

  async uploadLocalPhoto(file: File): Promise<ApiResponse<{ name: string; url: string; size: number }>> {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await apiClient.post('/products/local-photos/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  async estimateDemoListing(params: ProductPriceEstimateRequest): Promise<ApiResponse<ProductPriceEstimate>> {
    const { data } = await apiClient.post('/products/listing-demo/estimate', params);
    return data;
  },

  async publishDemoListing(params: ProductDemoListingRequest): Promise<ApiResponse<ProductDemoListingResponse>> {
    const { data } = await apiClient.post('/products/listing-demo/publish', params);
    return data;
  },

  // ===== 同步 =====

  async triggerSync(platformConfigId: number, syncType: 'full' | 'incremental' = 'full'): Promise<ApiResponse<SyncTask>> {
    const { data } = await apiClient.post('/products/sync', {
      platform_config_id: platformConfigId,
      sync_type: syncType,
    });
    return data;
  },

  async listSyncTasks(params?: {
    platform_config_id?: number;
    page?: number;
    size?: number;
  }): Promise<ApiResponse<PaginatedResponse<SyncTask>>> {
    const { data } = await apiClient.get('/products/sync/tasks', { params });
    return data;
  },

  // ===== 同步调度 =====

  async getSyncSchedule(platformConfigId: number): Promise<ApiResponse<SyncSchedule | null>> {
    const { data } = await apiClient.get(`/products/sync/schedule/${platformConfigId}`);
    return data;
  },

  async updateSyncSchedule(
    platformConfigId: number,
    params: { interval_minutes?: number; is_active?: boolean }
  ): Promise<ApiResponse<SyncSchedule>> {
    const { data } = await apiClient.put(`/products/sync/schedule/${platformConfigId}`, params);
    return data;
  },
};
