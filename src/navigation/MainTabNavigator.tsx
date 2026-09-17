import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';
import { MainTabParamList } from './types';
import { HomeScreen } from '../features/home/HomeScreen';
import { FoodHomeScreen } from '../features/food/FoodHomeScreen';
import { RideBookingScreen } from '../features/ride/RideBookingScreen';
import { MarketplaceHomeScreen } from '../features/marketplace/MarketplaceHomeScreen';
import { colors } from '../theme/colors';

const Tab = createBottomTabNavigator<MainTabParamList>();

export const MainTabNavigator: React.FC = () => {
  return (
    <Tab.Navigator
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
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.iconWrapper}>
              <MaterialIcons name="home" size={24} color={color} />
              {focused && <View style={[styles.dot, { backgroundColor: colors.primary }]} />}
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="Food"
        component={FoodHomeScreen}
        options={{
          tabBarLabel: 'Food',
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.iconWrapper}>
              <MaterialIcons name="restaurant" size={24} color={color} />
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
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.iconWrapper}>
              <MaterialIcons name="directions-bike" size={24} color={color} />
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
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.iconWrapper}>
              <MaterialIcons name="store" size={24} color={color} />
              {focused && <View style={[styles.dot, { backgroundColor: colors.primary }]} />}
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
