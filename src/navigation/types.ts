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
  };
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  RestaurantDetail: {
    restaurantId: string;
  };
  FoodOrderTracking: {
    orderId: string;
  };
  ActiveRide: {
    rideId: string;
  };
  ListingDetail: {
    listingId: string;
  };
  AddListing: undefined;
  Profile: undefined;
  Notifications: undefined;
  Activity: {
    initialTab?: number;
  };
};
