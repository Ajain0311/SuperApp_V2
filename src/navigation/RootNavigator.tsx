import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';
import { MainTabNavigator } from './MainTabNavigator';
import { SplashScreen } from '../features/splash/SplashScreen';
import { PhoneEntryScreen } from '../features/auth/PhoneEntryScreen';
import { OtpVerificationScreen } from '../features/auth/OtpVerificationScreen';
import { AdminPortalScreen } from '../features/admin/AdminPortalScreen';
import { RestaurantDetailScreen } from '../features/food/RestaurantDetailScreen';
import { FoodOrderTrackingScreen } from '../features/food/FoodOrderTrackingScreen';
import { ActiveRideScreen } from '../features/ride/ActiveRideScreen';
import { ListingDetailScreen } from '../features/marketplace/ListingDetailScreen';
import { AddListingScreen } from '../features/marketplace/AddListingScreen';
import { ProfileScreen } from '../features/profile/ProfileScreen';
import { SavedAddressesScreen } from '../features/profile/SavedAddressesScreen';
import { PaymentTestScreen } from '../features/payments/PaymentTestScreen';
import { NotificationsScreen } from '../features/notifications/NotificationsScreen';
import { ActivityScreen } from '../features/activity/ActivityScreen';
import { VendorOrdersScreen } from '../features/vendor/VendorOrdersScreen';
import { VendorMenuScreen } from '../features/vendor/VendorMenuScreen';
import { DriverRidesScreen } from '../features/driver/DriverRidesScreen';
import { DriverEarningsScreen } from '../features/driver/DriverEarningsScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      initialRouteName="Splash"
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="PhoneEntry" component={PhoneEntryScreen} />
      <Stack.Screen name="OtpVerification" component={OtpVerificationScreen} />
      <Stack.Screen name="AdminPortal" component={AdminPortalScreen} />
      <Stack.Screen name="MainTabs" component={MainTabNavigator} />
      <Stack.Screen name="RestaurantDetail" component={RestaurantDetailScreen} />
      <Stack.Screen name="FoodOrderTracking" component={FoodOrderTrackingScreen} />
      <Stack.Screen name="ActiveRide" component={ActiveRideScreen} />
      <Stack.Screen name="ListingDetail" component={ListingDetailScreen} />
      <Stack.Screen name="AddListing" component={AddListingScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="SavedAddresses" component={SavedAddressesScreen} />
      <Stack.Screen name="PaymentTest" component={PaymentTestScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="Activity" component={ActivityScreen} />
      <Stack.Screen name="KitchenOrders" component={VendorOrdersScreen} />
      <Stack.Screen name="VendorMenu" component={VendorMenuScreen} />
      <Stack.Screen name="DriverRides" component={DriverRidesScreen} />
      <Stack.Screen name="DriverEarnings" component={DriverEarningsScreen} />
    </Stack.Navigator>
  );
};
