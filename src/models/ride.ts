export type VehicleType = 'BIKE' | 'AUTO' | 'CAB';

export interface VehicleEstimate {
  vehicleType: VehicleType;
  title: string;
  tag: string;
  subtitle: string;
  estimatedFare: number;
  etaMinutes: number;
  iconName: string;
}

export interface RideEstimateResponse {
  distanceKm: number;
  estimatedMinutes: number;
  trafficCondition: string;
  vehicleOptions: VehicleEstimate[];
}

export interface DriverSummary {
  id: number;
  fullName: string;
  phone: string;
  rating: number;
  totalRides: number;
  vehicleModel: string;
  registrationNumber: string;
  vehicleColor?: string;
  currentLatitude?: number;
  currentLongitude?: number;
}

export interface BookRideRequest {
  vehicleType: string;
  pickupAddress: string;
  pickupLatitude: number;
  pickupLongitude: number;
  dropoffAddress: string;
  dropoffLatitude: number;
  dropoffLongitude: number;
  paymentMethod: string;
}

export interface RideDto {
  id: number;
  rideNumber: string;
  vehicleType: string;
  pickupAddress: string;
  dropoffAddress: string;
  distanceKm: number;
  estimatedFare: number;
  actualFare?: number;
  status: string;
  otpCode: string;
  paymentMethod: string;
  paymentStatus: string;
  createdAt: string;
  driver?: DriverSummary;
}
