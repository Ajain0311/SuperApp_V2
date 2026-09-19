import { NavigatorScreenParams } from '@react-navigation/native';

export type MainTabParamList = {
  // Customer tabs
  Home: undefined;
  Food: undefined;
  Rides: undefined;
  Bazaar: undefined;
  // Shared profile tab
  ProfileTab: undefined;
  // Driver tabs
  DriverHome: undefined;
  DriverRides: undefined;
  DriverEarnings: undefined;
  // Vendor tabs
  VendorDashboard: undefined;
  VendorOrders: undefined;
  VendorMenu: undefined;
  // Seller tabs
  SellerDashboard: undefined;
  SellerAddListing: undefined;
  // Admin tabs
  AdminDashboard: undefined;
};

export type RootStackParamList = {
  Splash: undefined;
  PhoneEntry: undefined;
  OtpVerification: {
    mobileNumber: string;
    isNewUser?: boolean;
    isAdmin?: boolean;
    devOtp?: string;
  };
  AdminPortal: undefined;
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  RestaurantDetail: {
    restaurantId: string;
  };
  FoodOrderTracking: {
    orderId: string;
    orderNumericId?: number;
  };
  ActiveRide: {
    rideId: string;
    rideNumericId?: number;
    rideData?: any;
  };
  ListingDetail: {
    listingId: string;
  };
  AddListing: undefined;
  Profile: undefined;
  SavedAddresses: undefined;
  PaymentTest: undefined;
  Notifications: undefined;
  Activity: {
    initialTab?: number;
  };
  KitchenOrders: undefined;
  VendorMenu: undefined;
  DriverRides: undefined;
  DriverEarnings: undefined;
};
