import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { MainTabParamList } from './types';
import { useRoleStore, ROLE_CONFIGS } from '../store/roleStore';
import { HomeScreen } from '../features/home/HomeScreen';
import { FoodHomeScreen } from '../features/food/FoodHomeScreen';
import { RideBookingScreen } from '../features/ride/RideBookingScreen';
import { MarketplaceHomeScreen } from '../features/marketplace/MarketplaceHomeScreen';
import { ProfileScreen } from '../features/profile/ProfileScreen';
import { DriverHomeScreen } from '../features/driver/DriverHomeScreen';
import { DriverRidesScreen } from '../features/driver/DriverRidesScreen';
import { DriverEarningsScreen } from '../features/driver/DriverEarningsScreen';
import { VendorDashboardScreen } from '../features/vendor/VendorDashboardScreen';
import { VendorOrdersScreen } from '../features/vendor/VendorOrdersScreen';
import { VendorMenuScreen } from '../features/vendor/VendorMenuScreen';
import { SellerDashboardScreen } from '../features/seller/SellerDashboardScreen';
import { AddListingScreen } from '../features/marketplace/AddListingScreen';
import { AdminPortalScreen } from '../features/admin/AdminPortalScreen';
import { AdminDashboardScreen } from '../features/admin/AdminDashboardScreen';
import { colors } from '../theme/colors';

const Tab = createBottomTabNavigator<MainTabParamList>();

export const MainTabNavigator: React.FC = () => {
  const { activeRole } = useRoleStore();
  const config = ROLE_CONFIGS[activeRole] || ROLE_CONFIGS.CUSTOMER;

  return (
    <Tab.Navigator
      key={activeRole} // Re-mount tabs cleanly when active role changes
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 0.5,
          height: Platform.OS === 'ios' ? 88 : 64,
          paddingBottom: Platform.OS === 'ios' ? 28 : 10,
          paddingTop: 8,
        },
        tabBarActiveTintColor: config.color,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
        },
      }}
    >
      {activeRole === 'CUSTOMER' && (
        <>
          <Tab.Screen
            name="Home"
            component={HomeScreen}
            options={{
              tabBarLabel: 'Home',
              tabBarTestID: 'tab-home',
              tabBarIcon: ({ color, focused }) => (
                <View style={styles.iconWrapper}>
                  <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={color} />
                  {focused && <View style={[styles.dot, { backgroundColor: config.color }]} />}
                </View>
              ),
            }}
          />
          <Tab.Screen
            name="Food"
            component={FoodHomeScreen}
            options={{
              tabBarLabel: 'Food',
              tabBarTestID: 'tab-food',
              tabBarIcon: ({ color, focused }) => (
                <View style={styles.iconWrapper}>
                  <Ionicons name={focused ? 'restaurant' : 'restaurant-outline'} size={22} color={color} />
                  {focused && <View style={[styles.dot, { backgroundColor: colors.secondary }]} />}
                </View>
              ),
            }}
          />
          <Tab.Screen
            name="Rides"
            component={RideBookingScreen}
            options={{
              tabBarLabel: 'Rides',
              tabBarTestID: 'tab-rides',
              tabBarIcon: ({ color, focused }) => (
                <View style={styles.iconWrapper}>
                  <Ionicons name={focused ? 'car-sport' : 'car-sport-outline'} size={22} color={color} />
                  {focused && <View style={[styles.dot, { backgroundColor: colors.blue }]} />}
                </View>
              ),
            }}
          />
          <Tab.Screen
            name="Bazaar"
            component={MarketplaceHomeScreen}
            options={{
              tabBarLabel: 'Bazaar',
              tabBarTestID: 'tab-bazaar',
              tabBarIcon: ({ color, focused }) => (
                <View style={styles.iconWrapper}>
                  <Ionicons name={focused ? 'bag-handle' : 'bag-handle-outline'} size={22} color={color} />
                  {focused && <View style={[styles.dot, { backgroundColor: config.color }]} />}
                </View>
              ),
            }}
          />
        </>
      )}

      {activeRole === 'DRIVER' && (
        <>
          <Tab.Screen
            name="DriverHome"
            component={DriverHomeScreen}
            options={{
              tabBarLabel: 'Duty',
              tabBarIcon: ({ color, focused }) => (
                <View style={styles.iconWrapper}>
                  <Ionicons name={focused ? 'car-sport' : 'car-sport-outline'} size={22} color={color} />
                  {focused && <View style={[styles.dot, { backgroundColor: config.color }]} />}
                </View>
              ),
            }}
          />
          <Tab.Screen
            name="DriverRides"
            component={DriverRidesScreen}
            options={{
              tabBarLabel: 'Trips',
              tabBarIcon: ({ color, focused }) => (
                <View style={styles.iconWrapper}>
                  <Ionicons name={focused ? 'list' : 'list-outline'} size={22} color={color} />
                  {focused && <View style={[styles.dot, { backgroundColor: config.color }]} />}
                </View>
              ),
            }}
          />
          <Tab.Screen
            name="DriverEarnings"
            component={DriverEarningsScreen}
            options={{
              tabBarLabel: 'Earnings',
              tabBarIcon: ({ color, focused }) => (
                <View style={styles.iconWrapper}>
                  <Ionicons name={focused ? 'cash' : 'cash-outline'} size={22} color={color} />
                  {focused && <View style={[styles.dot, { backgroundColor: config.color }]} />}
                </View>
              ),
            }}
          />
        </>
      )}

      {activeRole === 'RESTAURANT_OWNER' && (
        <>
          <Tab.Screen
            name="VendorDashboard"
            component={VendorDashboardScreen}
            options={{
              tabBarLabel: 'Overview',
              tabBarIcon: ({ color, focused }) => (
                <View style={styles.iconWrapper}>
                  <Ionicons name={focused ? 'grid' : 'grid-outline'} size={22} color={color} />
                  {focused && <View style={[styles.dot, { backgroundColor: config.color }]} />}
                </View>
              ),
            }}
          />
          <Tab.Screen
            name="VendorOrders"
            component={VendorOrdersScreen}
            options={{
              tabBarLabel: 'Kitchen',
              tabBarIcon: ({ color, focused }) => (
                <View style={styles.iconWrapper}>
                  <Ionicons name={focused ? 'receipt' : 'receipt-outline'} size={22} color={color} />
                  {focused && <View style={[styles.dot, { backgroundColor: config.color }]} />}
                </View>
              ),
            }}
          />
          <Tab.Screen
            name="VendorMenu"
            component={VendorMenuScreen}
            options={{
              tabBarLabel: 'Menu',
              tabBarIcon: ({ color, focused }) => (
                <View style={styles.iconWrapper}>
                  <Ionicons name={focused ? 'fast-food' : 'fast-food-outline'} size={22} color={color} />
                  {focused && <View style={[styles.dot, { backgroundColor: config.color }]} />}
                </View>
              ),
            }}
          />
        </>
      )}

      {activeRole === 'MARKETPLACE_SELLER' && (
        <>
          <Tab.Screen
            name="SellerDashboard"
            component={SellerDashboardScreen}
            options={{
              tabBarLabel: 'My Store',
              tabBarIcon: ({ color, focused }) => (
                <View style={styles.iconWrapper}>
                  <Ionicons name={focused ? 'storefront' : 'storefront-outline'} size={22} color={color} />
                  {focused && <View style={[styles.dot, { backgroundColor: config.color }]} />}
                </View>
              ),
            }}
          />
          <Tab.Screen
            name="SellerAddListing"
            component={AddListingScreen}
            options={{
              tabBarLabel: 'Post Ad',
              tabBarIcon: ({ color, focused }) => (
                <View style={styles.iconWrapper}>
                  <Ionicons name={focused ? 'add-circle' : 'add-circle-outline'} size={24} color={color} />
                  {focused && <View style={[styles.dot, { backgroundColor: config.color }]} />}
                </View>
              ),
            }}
          />
        </>
      )}

      {activeRole === 'ADMIN' && (
        <>
          <Tab.Screen
            name="AdminDashboard"
            component={AdminDashboardScreen}
            options={{
              tabBarLabel: 'Management',
              tabBarIcon: ({ color, focused }) => (
                <View style={styles.iconWrapper}>
                  <Ionicons name={focused ? 'shield-checkmark' : 'shield-checkmark-outline'} size={22} color={color} />
                  {focused && <View style={[styles.dot, { backgroundColor: config.color }]} />}
                </View>
              ),
            }}
          />
        </>
      )}

      {/* Shared Account / Mode Switch Tab across all roles */}
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Account',
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.iconWrapper}>
              <Ionicons name={focused ? 'person-circle' : 'person-circle-outline'} size={24} color={color} />
              {focused && <View style={[styles.dot, { backgroundColor: config.color }]} />}
            </View>
          ),
        }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 28,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
  },
});
