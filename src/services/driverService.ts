import { apiClient } from './apiClient';
import { ApiEndpoints } from '../constants/api';

export interface VehicleInfo {
  id: number;
  type: string;
  make?: string;
  model?: string;
  registrationNumber: string;
  color?: string;
  year?: number;
}

export interface DriverProfile {
  id: number;
  userId: number;
  fullName: string;
  mobileNumber: string;
  licenseNumber?: string;
  isVerified: boolean;
  isOnline: boolean;
  currentLatitude?: number;
  currentLongitude?: number;
  rating: number;
  totalRides: number;
  vehicle?: VehicleInfo;
}

export interface DriverRideItem {
  id: number;
  rideNumber: string;
  pickupAddress: string;
  dropoffAddress: string;
  fare: number;
  estimatedFare?: number;
  distanceKm?: number;
  vehicleType?: string;
  status: string;
  createdAt: string;
  customerName: string;
  customerPhone: string;
  otpCode?: string;
}

export interface DriverEarnings {
  todayEarnings: number;
  todayRides: number;
  weeklyEarnings: number;
  weeklyRides: number;
  totalEarnings: number;
  totalRides: number;
  recentTrips: DriverRideItem[];
}

class DriverService {
  async getProfile(): Promise<DriverProfile> {
    const res = await apiClient.get<{ success: boolean; data: DriverProfile }>(ApiEndpoints.driver.profile);
    return res.data;
  }

  async toggleOnline(isOnline: boolean): Promise<boolean> {
    const res = await apiClient.post<{ success: boolean; data: boolean }>(ApiEndpoints.driver.toggleOnline, {
      isOnline,
    });
    return res.data;
  }

  async getAvailableRides(): Promise<DriverRideItem[]> {
    const res = await apiClient.get<{ success: boolean; data: DriverRideItem[] }>(ApiEndpoints.driver.availableRides);
    return res.data || [];
  }

  async getActiveRide(): Promise<any | null> {
    const res = await apiClient.get<{ success: boolean; data: any }>(ApiEndpoints.driver.activeRide);
    return res.data;
  }

  async acceptRide(id: number | string): Promise<any> {
    const res = await apiClient.post<{ success: boolean; data: any }>(ApiEndpoints.driver.acceptRide(id));
    return res.data;
  }

  async markArriving(id: number | string): Promise<void> {
    await apiClient.post(ApiEndpoints.driver.arriving(id));
  }

  async startRide(id: number | string, otpCode: string): Promise<void> {
    await apiClient.post(ApiEndpoints.driver.startRide(id), { otpCode });
  }

  async completeRide(id: number | string): Promise<void> {
    await apiClient.post(ApiEndpoints.driver.completeRide(id));
  }

  async cancelRide(id: number | string, reason?: string): Promise<void> {
    await apiClient.post(ApiEndpoints.driver.cancelRide(id), { reason: reason || 'Cancelled by driver' });
  }

  async updateLocation(
    latitude: number,
    longitude: number,
    rideId?: number,
    heading?: number,
    speed?: number
  ): Promise<void> {
    await apiClient.post(ApiEndpoints.driver.updateLocation, {
      latitude,
      longitude,
      rideId,
      heading,
      speed,
    });
  }

  async getHistory(): Promise<DriverRideItem[]> {
    const res = await apiClient.get<{ success: boolean; data: DriverRideItem[] }>(ApiEndpoints.driver.history);
    return res.data || [];
  }

  async getEarnings(): Promise<DriverEarnings> {
    const res = await apiClient.get<{ success: boolean; data: DriverEarnings }>(ApiEndpoints.driver.earnings);
    return res.data;
  }
}

export const driverService = new DriverService();
