import { apiClient } from './apiClient';
import { ApiEndpoints } from '../constants/api';

export interface VendorDashboardStats {
  restaurantName: string;
  todayOrdersCount: number;
  pendingOrdersCount: number;
  completedOrdersCount: number;
  todaySalesAmount: number;
  activeMenuItemsCount: number;
}

export interface VendorOrderSummary {
  id: number;
  orderNumber: string;
  restaurantId: number;
  restaurantName?: string;
  status: string;
  subTotal?: number;
  discountAmount?: number;
  couponDiscount?: number;
  deliveryFee?: number;
  taxAmount?: number;
  grandTotal: number;
  paymentMethod?: string;
  paymentStatus?: string;
  notes?: string;
  estimatedDeliveryMinutes?: number;
  createdAt: string;
  items: Array<{
    id: number;
    itemName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
}

class VendorService {
  async getMyRestaurant(): Promise<any> {
    const res = await apiClient.get<{ success: boolean; data: any }>(ApiEndpoints.vendor.myRestaurant);
    return res.data;
  }

  async getProfile(): Promise<any> {
    return this.getMyRestaurant();
  }

  async getDashboard(): Promise<VendorDashboardStats> {
    const res = await apiClient.get<{ success: boolean; data: VendorDashboardStats }>(ApiEndpoints.vendor.dashboard);
    return res.data;
  }

  async toggleStatus(isOpen: boolean): Promise<boolean> {
    const res = await apiClient.post<{ success: boolean; data: boolean }>(ApiEndpoints.vendor.toggleStatus, {
      isOpen,
    });
    return res.data;
  }

  async getMenu(): Promise<any[]> {
    const res = await apiClient.get<{ success: boolean; data: any[] }>(ApiEndpoints.vendor.menu);
    return res.data || [];
  }

  async getOrders(status?: string): Promise<VendorOrderSummary[]> {
    const url = status ? `${ApiEndpoints.vendor.orders}?status=${status}` : ApiEndpoints.vendor.orders;
    const res = await apiClient.get<{ success: boolean; data: VendorOrderSummary[] }>(url);
    return res.data || [];
  }

  async updateOrderStatus(orderId: number | string, status: string): Promise<void> {
    await apiClient.put(ApiEndpoints.vendor.updateOrderStatus(orderId), { status });
  }

  async manageFoodItem(action: 'ADD' | 'EDIT' | 'DELETE' | 'STATUS', payload: any): Promise<void> {
    await apiClient.post(ApiEndpoints.vendor.manageFoodItems, {
      action,
      ...payload,
    });
  }

  async getEarnings(): Promise<any> {
    const res = await apiClient.get<{ success: boolean; data: any }>(ApiEndpoints.vendor.earnings);
    return res.data;
  }
}

export const vendorService = new VendorService();
