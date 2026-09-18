import { NavigatorScreenParams } from '@react-navigation/native';

export type MainTabParamList = {
  Home: undefined;
  Food: undefined;
  Rides: undefined;
  Bazaar: undefined;
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
};
