import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AdminStackParamList } from './types';
import { AdminDashboardHome } from './AdminDashboardHome';
import { AdminUsersScreen } from './AdminUsersScreen';
import { AdminRestaurantsScreen } from './AdminRestaurantsScreen';
import { AdminDriversScreen } from './AdminDriversScreen';
import { AdminOrdersScreen } from './AdminOrdersScreen';
import { AdminPaymentsScreen } from './AdminPaymentsScreen';
import { AdminSettingsScreen } from './AdminSettingsScreen';

const Stack = createNativeStackNavigator<AdminStackParamList>();

export const AdminNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      initialRouteName="AdminDashboardHome"
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="AdminDashboardHome" component={AdminDashboardHome} />
      <Stack.Screen name="AdminUsers" component={AdminUsersScreen} />
      <Stack.Screen name="AdminRestaurants" component={AdminRestaurantsScreen} />
      <Stack.Screen name="AdminDrivers" component={AdminDriversScreen} />
      <Stack.Screen name="AdminOrders" component={AdminOrdersScreen} />
      <Stack.Screen name="AdminPayments" component={AdminPaymentsScreen} />
      <Stack.Screen name="AdminSettings" component={AdminSettingsScreen} />
    </Stack.Navigator>
  );
};
