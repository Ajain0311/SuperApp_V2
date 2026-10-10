export interface AdminDashboardData {
  totalUsers: number;
  activeDrivers: number;
  totalRestaurants: number;
  totalFoodOrders: number;
  totalRides: number;
  activeListings: number;
  grossFoodSales: number;
  grossRideFares: number;
  platformRevenue: number;
  recentActivities: AdminActivity[];
}

export interface AdminActivity {
  id: string;
  module: 'FOOD' | 'RIDE' | 'BAZAAR' | 'AUTH';
  description: string;
  amount?: number;
  status?: string;
  timestamp: string;
}

export interface AdminUser {
  id: number;
  mobileNumber: string;
  fullName?: string;
  email?: string;
  isActive: boolean;
  createdAt: string;
  roles: string[];
}

export interface AdminRestaurant {
  id: number;
  name: string;
  description?: string;
  phone?: string;
  city?: string;
  addressLine?: string;
  isVeg: boolean;
  isActive: boolean;
  isFeatured: boolean;
  minOrderAmount: number;
  deliveryFee: number;
  rating?: number;
  totalOrders?: number;
  createdAt: string;
}

export interface AdminDriver {
  id: number;
  userId: number;
  driverName: string;
  mobileNumber: string;
  licenseNumber?: string;
  isVerified: boolean;
  isOnline: boolean;
  isActive: boolean;
  rating: number;
  totalRides: number;
  vehicle?: {
    type: string;
    registrationNumber: string;
    make: string;
    model: string;
  };
}

export interface AdminFoodOrder {
  id: number;
  orderNumber: string;
  restaurantId: number;
  restaurantName: string;
  userId: number;
  customerName: string;
  customerPhone: string;
  itemTotal: number;
  deliveryFee: number;
  discountAmount: number;
  grandTotal: number;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  createdAt: string;
  itemsCount: number;
}

export interface AdminRide {
  id: number;
  rideNumber: string;
  vehicleType: string;
  userId: number;
  customerName: string;
  customerPhone: string;
  driverId?: number;
  driverName?: string;
  driverPhone?: string;
  pickupAddress: string;
  dropoffAddress: string;
  distanceKm: number;
  estimatedFare: number;
  actualFare?: number;
  status: string;
  createdAt: string;
}

export interface AdminSetting {
  key: string;
  value: string;
  description?: string;
  isPublic?: boolean;
}

export type AdminStackParamList = {
  AdminDashboardHome: undefined;
  AdminUsers: undefined;
  AdminRestaurants: undefined;
  AdminDrivers: undefined;
  AdminOrders: undefined;
  AdminPayments: undefined;
  AdminSettings: undefined;
};
