import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { AppColors } from '../../theme/colors';
import { useAuthStore } from '../../store/authStore';

interface SplashScreenProps {
  navigation: any;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ navigation }) => {
  const checkAuth = useAuthStore((state) => state.checkAuth);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    // Smooth intro animation matching Flutter SingleTickerProviderStateMixin
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    // Verify authentication and route
    const timer = setTimeout(async () => {
      const isAuthenticated = await checkAuth();
      if (isAuthenticated) {
        navigation.replace('MainTabs');
      } else {
        navigation.replace('PhoneEntry');
      }
    }, 1800);

    return () => clearTimeout(timer);
  }, [navigation, checkAuth, fadeAnim, scaleAnim]);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <LinearGradient
          colors={[AppColors.primary, AppColors.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.logoContainer}
        >
          <Ionicons name="rocket-outline" size={48} color="#FFFFFF" />
        </LinearGradient>

        <Text style={styles.appName}>Super App</Text>
        <Text style={styles.tagline}>Food • Rides • Marketplace</Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: AppColors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
    marginBottom: 24,
  },
  appName: {
    fontSize: 28,
    fontWeight: '800',
    color: AppColors.textPrimary,
    letterSpacing: 1,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 13,
    color: AppColors.textSecondary,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
});
