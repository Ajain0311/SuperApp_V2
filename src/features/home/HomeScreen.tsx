import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { AppColors } from '../../theme/colors';
import { AppRadius } from '../../theme/spacing';
import { AppTypography } from '../../theme/typography';
import { AppSearchBar } from '../../components/common/AppSearchBar';
import { useAuthStore } from '../../store/authStore';
import { apiClient } from '../../services/apiClient';
import { ApiEndpoints } from '../../constants/api';

interface HomeScreenProps {
  navigation: any;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const user = useAuthStore((state) => state.user);
  const [activeRide, setActiveRide] = useState<any>(null);
  const [banners, setBanners] = useState<any[]>([]);

  useEffect(() => {
    // Fetch live promotional banners
    apiClient
      .get<any>(ApiEndpoints.common.banners)
      .then((res) => {
        const data = res.data?.data || res.data;
        if (Array.isArray(data) && data.length > 0) {
          setBanners(data);
        }
      })
      .catch(() => {});

    // Check for real active ride in transit
    apiClient
      .get<any>(ApiEndpoints.ride.myRides)
      .then((res) => {
        const data = res.data?.data || res.data;
        if (Array.isArray(data) && data.length > 0) {
          const live = data.find(
            (r: any) =>
              r.status === 'PENDING' ||
              r.status === 'ACCEPTED' ||
              r.status === 'STARTED'
          );
          if (live) {
            setActiveRide(live);
          } else {
            setActiveRide(null);
          }
        }
      })
      .catch(() => {});
  }, []);

  const getInitials = () => {
    if (!user?.fullName) return 'JD';
    const parts = user.fullName.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return user.fullName.substring(0, 2).toUpperCase();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Location Bar */}
        <View style={styles.topBar}>
          <View style={styles.locationGroup}>
            <View style={styles.locationIconBox}>
              <Ionicons name="location-sharp" size={20} color={AppColors.error} />
            </View>
            <View style={styles.locationTextColumn}>
              <Text style={styles.deliverToCaption}>DELIVER TO</Text>
              <View style={styles.cityRow}>
                <Text style={styles.cityName}>Connaught Place, New Delhi</Text>
                <Ionicons name="chevron-down" size={16} color={AppColors.textSecondary} />
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={styles.profileAvatar}
            onPress={() => navigation.navigate('Profile')}
            activeOpacity={0.8}
          >
            <Text style={styles.avatarInitials}>{getInitials()}</Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchWrapper}>
          <AppSearchBar
            placeholder="Search food, rides, items & groceries..."
            editable={false}
            onPress={() => navigation.navigate('Food')}
          />
        </View>

        <TouchableOpacity
          style={styles.payTestBanner}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('PaymentTest')}
        >
          <View style={styles.payTestIcon}>
            <Ionicons name="card" size={22} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.payTestKicker}>TEST PAYMENT</Text>
            <Text style={styles.payTestTitle}>Pay ₹1 now (no real money)</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={AppColors.textPrimary} />
        </TouchableOpacity>

        {/* Live Ride Card (Rendered only when a real ride is active/in-transit) */}
        {activeRide ? (
          <View style={styles.liveRideCard}>
            <View style={styles.liveRideHeader}>
              <View style={styles.liveRideIndicatorGroup}>
                <View style={styles.livePulseDot} />
                <Text style={styles.liveRideStatusText}>
                  LIVE RIDE • {activeRide.status === 'STARTED' ? 'IN TRANSIT' : 'DRIVER ASSIGNED'}
                </Text>
              </View>
              <View style={styles.etaPill}>
                <Text style={styles.etaPillText}>Active</Text>
              </View>
            </View>

            <View style={styles.liveRideBody}>
              <View style={styles.vehicleIconCircle}>
                <Ionicons
                  name={activeRide.vehicleType === 'CAB' ? 'car' : 'bicycle'}
                  size={24}
                  color={AppColors.secondary}
                />
              </View>
              <View style={styles.liveRideDetails}>
                <Text style={styles.liveRideTitle}>
                  {activeRide.vehicleType || 'Ride'} ({activeRide.rideNumber})
                </Text>
                <View style={styles.driverOtpRow}>
                  <Text style={styles.driverText}>
                    {activeRide.driver?.fullName ? `Driver: ${activeRide.driver.fullName} • ` : ''}OTP:{' '}
                  </Text>
                  <Text style={styles.otpHighlight}>{activeRide.otpCode || '4829'}</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.trackButton}
                onPress={() =>
                  navigation.navigate('ActiveRide', {
                    rideId: activeRide.rideNumber || 'RD-5021',
                    rideNumericId: activeRide.id,
                  })
                }
                activeOpacity={0.8}
              >
                <Text style={styles.trackButtonText}>Track</Text>
                <Ionicons name="chevron-forward" size={14} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {/* Section Title */}
        <Text style={[AppTypography.sectionTitle, styles.sectionMargin]}>
          Super App Services
        </Text>

        {/* Food Delivery Service Card */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => navigation.navigate('Food')}
          style={styles.foodCardContainer}
        >
          <LinearGradient
            colors={['#EA580C', '#C2410C']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.foodCardGradient}
          >
            <View style={styles.foodCardLeft}>
              <View style={styles.dealBadge}>
                <Text style={styles.dealBadgeText}>50% OFF • FAST DROP</Text>
              </View>
              <Text style={styles.serviceTitle}>Food Delivery</Text>
              <Text style={styles.serviceSubtitle}>Biryani, Burgers, Pizzas in 20m</Text>
            </View>
            <View style={styles.serviceIconContainer}>
              <Ionicons name="pizza" size={34} color="#FFFFFF" />
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* Rides & Marketplace Grid */}
        <View style={styles.servicesGrid}>
          {/* Rides Service Card */}
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => navigation.navigate('Rides')}
            style={styles.gridCardContainer}
          >
            <LinearGradient
              colors={['#059669', '#047857']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.gridCardGradient}
            >
              <View style={styles.gridCardTop}>
                <View style={styles.gridIconBox}>
                  <Ionicons name="bicycle" size={22} color="#FFFFFF" />
                </View>
                <View style={styles.gridTag}>
                  <Text style={styles.gridTagText}>Fastest</Text>
                </View>
              </View>
              <View>
                <Text style={styles.gridTitle}>Book Rides</Text>
                <Text style={styles.gridSubtitle}>Bike, Auto, Cabs</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>

          {/* Marketplace Service Card */}
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => navigation.navigate('Bazaar')}
            style={styles.gridCardContainer}
          >
            <LinearGradient
              colors={['#2563EB', '#1D4ED8']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.gridCardGradient}
            >
              <View style={styles.gridCardTop}>
                <View style={styles.gridIconBox}>
                  <Ionicons name="pricetag" size={20} color="#FFFFFF" />
                </View>
                <View style={styles.gridTag}>
                  <Text style={styles.gridTagText}>Direct</Text>
                </View>
              </View>
              <View>
                <Text style={styles.gridTitle}>Marketplace</Text>
                <Text style={styles.gridSubtitle}>Buy & Sell Local</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Spotlight Deals Section */}
        <Text style={[AppTypography.sectionTitle, styles.sectionMargin]}>
          Spotlight Deals
        </Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dealsScroll}
        >
          {/* Deal 1 */}
          <View style={styles.dealCard}>
            <Ionicons name="flash" size={22} color={AppColors.yellow} />
            <Text style={styles.dealTitle}>Express Courier</Text>
            <Text style={styles.dealSubtitle} numberOfLines={1}>
              Send packages in 45m
            </Text>
          </View>

          {/* Deal 2 */}
          <View style={styles.dealCard}>
            <Ionicons name="star" size={22} color={AppColors.primary} />
            <Text style={styles.dealTitle}>450 SuperCoins</Text>
            <Text style={styles.dealSubtitle} numberOfLines={1}>
              Redeem for free rides
            </Text>
          </View>

          {/* Deal 3 */}
          <View style={styles.dealCard}>
            <Ionicons name="shield-checkmark" size={22} color={AppColors.secondary} />
            <Text style={styles.dealTitle}>Verified Sellers</Text>
            <Text style={styles.dealSubtitle} numberOfLines={1}>
              7-day test warranty
            </Text>
          </View>
        </ScrollView>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 28,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  locationGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: `${AppColors.error}33`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  locationTextColumn: {
    justifyContent: 'center',
  },
  deliverToCaption: {
    fontSize: 10,
    fontWeight: '700',
    color: AppColors.textTertiary,
    letterSpacing: 1.2,
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  cityName: {
    fontSize: 14,
    fontWeight: '700',
    color: AppColors.textPrimary,
    marginRight: 4,
  },
  profileAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: AppColors.surfaceLight,
    borderWidth: 1,
    borderColor: AppColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: AppColors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  searchWrapper: {
    marginBottom: 18,
  },
  liveRideCard: {
    backgroundColor: AppColors.surface,
    borderRadius: AppRadius.lg,
    borderWidth: 1,
    borderColor: `${AppColors.secondary}4D`,
    padding: 14,
    marginBottom: 24,
  },
  liveRideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  liveRideIndicatorGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  livePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: AppColors.secondary,
    marginRight: 6,
  },
  liveRideStatusText: {
    color: AppColors.secondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  etaPill: {
    backgroundColor: `${AppColors.secondary}26`,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  etaPillText: {
    color: AppColors.secondary,
    fontSize: 11,
    fontWeight: '600',
  },
  liveRideBody: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vehicleIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: `${AppColors.secondary}26`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  liveRideDetails: {
    flex: 1,
  },
  liveRideTitle: {
    color: AppColors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 3,
  },
  driverOtpRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  driverText: {
    color: AppColors.textSecondary,
    fontSize: 12,
  },
  otpHighlight: {
    color: AppColors.secondary,
    fontSize: 12,
    fontWeight: '700',
  },
  trackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.surfaceLight,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: AppColors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  trackButtonText: {
    color: AppColors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    marginRight: 2,
  },
  payTestBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.surface,
    borderWidth: 1,
    borderColor: AppColors.primary,
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    gap: 12,
  },
  payTestIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: AppColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payTestKicker: {
    color: AppColors.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  payTestTitle: {
    color: AppColors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2,
  },
  sectionMargin: {
    marginBottom: 14,
  },
  foodCardContainer: {
    height: 125,
    borderRadius: 20,
    marginBottom: 12,
    shadowColor: '#EA580C',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
  },
  foodCardGradient: {
    flex: 1,
    borderRadius: 20,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  foodCardLeft: {
    flex: 1,
    justifyContent: 'center',
  },
  dealBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  dealBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  serviceTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  serviceSubtitle: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 12,
    fontWeight: '500',
  },
  serviceIconContainer: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  servicesGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 28,
  },
  gridCardContainer: {
    flex: 1,
    height: 140,
    marginHorizontal: 4,
    borderRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 5,
  },
  gridCardGradient: {
    flex: 1,
    borderRadius: 20,
    padding: 16,
    justifyContent: 'space-between',
  },
  gridCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gridIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridTag: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  gridTagText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  gridTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 2,
  },
  gridSubtitle: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 12,
    fontWeight: '500',
  },
  dealsScroll: {
    paddingRight: 16,
  },
  dealCard: {
    width: 165,
    backgroundColor: AppColors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: `${AppColors.border}99`,
    padding: 14,
    marginRight: 12,
  },
  dealTitle: {
    color: AppColors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 2,
  },
  dealSubtitle: {
    color: AppColors.textSecondary,
    fontSize: 11,
  },
});
