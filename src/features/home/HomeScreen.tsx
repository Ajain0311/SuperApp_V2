import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  Linking,
  Modal,
  ActivityIndicator,
  FlatList,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { LinearGradient } from 'expo-linear-gradient';
import { AppColors } from '../../theme/colors';
import { AppRadius } from '../../theme/spacing';
import { AppTypography } from '../../theme/typography';
import { AppSearchBar } from '../../components/common/AppSearchBar';
import { useAuthStore } from '../../store/authStore';
import { apiClient } from '../../services/apiClient';
import { ApiEndpoints } from '../../constants/api';
import { AppEnvironment } from '../../config/environment';

function resolveBannerImage(url: string) {
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const origin = AppEnvironment.hubBaseUrl.replace(/\/$/, '');
  return `${origin}${url.startsWith('/') ? url : `/${url}`}`;
}

export function resolveDeliveryAddress(payload: any): string {
  const items = Array.isArray(payload) ? payload : [];
  if (items.length > 0) {
    const def = items.find((a: any) => a.isDefault) || items[0];
    const line = [def.addressLine1, def.city].filter(Boolean).join(', ');
    return line || 'Add delivery address';
  }
  return 'Add delivery address';
}

interface HomeScreenProps {
  navigation: any;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {

  const user = useAuthStore((state) => state.user);
  const [activeRide, setActiveRide] = useState<any>(null);
  const [banners, setBanners] = useState<any[]>([]);
  const [deliverTo, setDeliverTo] = useState<string>('Add delivery address');

  // Multi-Category Search Overlay State
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFilter, setSearchFilter] = useState<'ALL' | 'FOOD' | 'BAZAAR'>('ALL');
  const [searchLoading, setSearchLoading] = useState(false);
  const [foodPool, setFoodPool] = useState<any[]>([]);
  const [bazaarPool, setBazaarPool] = useState<any[]>([]);

  useFocusEffect(
    useCallback(() => {
      apiClient
        .get<any>(ApiEndpoints.common.addresses)
        .then((res) => {
          const payload = res?.data?.data ?? res?.data ?? res;
          setDeliverTo(resolveDeliveryAddress(payload));
        })
        .catch(() => {
          // Never substitute Connaught Place or fabricated address on failure
          setDeliverTo('Add delivery address');
        });

      const onBackPress = () => {
        if (isSearchOpen) {
          setIsSearchOpen(false);
          return true;
        }
        return false;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [isSearchOpen])
  );



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

  const openSearch = () => {
    setIsSearchOpen(true);
    if (foodPool.length === 0 || bazaarPool.length === 0) {
      setSearchLoading(true);
      Promise.all([
        apiClient
          .get<any>(ApiEndpoints.food.restaurants)
          .then((res) => {
            const payload = res.data?.data || res.data;
            const items = payload?.items || payload;
            if (Array.isArray(items)) setFoodPool(items);
          })
          .catch(() => {}),
        apiClient
          .get<any>(ApiEndpoints.marketplace.listings)
          .then((res) => {
            const payload = res.data?.data || res.data;
            const items = payload?.items || payload;
            if (Array.isArray(items)) setBazaarPool(items);
          })
          .catch(() => {}),
      ]).finally(() => {
        setSearchLoading(false);
      });
    }
  };

  const openBanner = async (banner: any) => {
    if (!banner) return;
    const targetType = String(banner.targetType || '').toUpperCase().trim();
    const targetId = banner.targetId != null ? String(banner.targetId).trim() : '';
    const moduleName = String(banner.module || '').toUpperCase().trim();
    const ctaUrl = String(banner.ctaUrl || banner.url || banner.link || '').trim();

    // 1. External URL banner
    if (targetType === 'URL' || targetType === 'EXTERNAL' || ctaUrl.startsWith('http://') || ctaUrl.startsWith('https://')) {
      const urlToOpen = ctaUrl || (targetId.startsWith('http') ? targetId : '');
      if (urlToOpen) {
        try {
          const supported = await Linking.canOpenURL(urlToOpen);
          if (supported) {
            await Linking.openURL(urlToOpen);
            return;
          }
        } catch {}
      }
      if (targetType === 'URL' || targetType === 'EXTERNAL') {
        Alert.alert('Link Unavailable', 'This promotional link is currently not available.');
        return;
      }
    }

    // 2. Marketplace Product / Listing advertisement
    if (
      targetType === 'LISTING' ||
      targetType === 'PRODUCT' ||
      targetType === 'MARKETPLACE_ITEM' ||
      targetType === 'BAZAAR_ITEM'
    ) {
      if (targetId) {
        navigation.navigate('ListingDetail', { listingId: targetId });
        return;
      }
      navigation.navigate('Bazaar');
      return;
    }

    // 3. Food / Restaurant advertisement
    if (targetType === 'RESTAURANT' || targetType === 'FOOD_ITEM' || targetType === 'FOOD') {
      if (targetId) {
        navigation.navigate('RestaurantDetail', { restaurantId: targetId });
        return;
      }
      navigation.navigate('Food');
      return;
    }

    // 4. Category advertisement
    if (targetType === 'CATEGORY') {
      if (moduleName === 'FOOD' || targetId.toLowerCase().includes('food') || targetId.toLowerCase().includes('restaurant')) {
        navigation.navigate('Food');
        return;
      }
      if (moduleName === 'MARKETPLACE' || moduleName === 'BAZAAR') {
        navigation.navigate('Bazaar');
        return;
      }
      if (moduleName === 'RIDE' || moduleName === 'RIDES') {
        navigation.navigate('Rides');
        return;
      }
    }

    // 5. Ride advertisement
    if (targetType === 'RIDE' || targetType === 'RIDE_PROMO') {
      navigation.navigate('Rides');
      return;
    }

    // 6. Fallback based on banner placement module
    if (moduleName === 'FOOD') {
      navigation.navigate('Food');
      return;
    }
    if (moduleName === 'RIDE' || moduleName === 'RIDES') {
      navigation.navigate('Rides');
      return;
    }
    if (moduleName === 'MARKETPLACE' || moduleName === 'BAZAAR') {
      navigation.navigate('Bazaar');
      return;
    }

    // 7. General / Unconfigured banner fallback
    if (banner.title) {
      Alert.alert(banner.title, banner.subtitle || 'Offer available on SuperApp services.');
    }
  };

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const results: Array<{
      type: 'FOOD' | 'BAZAAR';
      id: string | number;
      title: string;
      subtitle: string;
      price?: number;
    }> = [];

    // Food Results
    if (searchFilter === 'ALL' || searchFilter === 'FOOD') {
      foodPool.forEach((item) => {
        const name = (item.name || '').toLowerCase();
        const cuisines = (item.cuisines || item.description || '').toLowerCase();
        if (!q || name.includes(q) || cuisines.includes(q)) {
          results.push({
            type: 'FOOD',
            id: item.id,
            title: item.name,
            subtitle: item.cuisines || item.addressLine || 'Restaurant',
          });
        }
      });
    }

    // Bazaar Results
    if (searchFilter === 'ALL' || searchFilter === 'BAZAAR') {
      bazaarPool.forEach((item) => {
        const title = (item.title || '').toLowerCase();
        const category = (item.categoryName || '').toLowerCase();
        const location = (item.location || '').toLowerCase();
        if (!q || title.includes(q) || category.includes(q) || location.includes(q)) {
          results.push({
            type: 'BAZAAR',
            id: item.id,
            title: item.title,
            subtitle: `${item.categoryName || 'General'} • ${item.location || 'Local'}`,
            price: item.price,
          });
        }
      });
    }

    return results;
  }, [searchQuery, searchFilter, foodPool, bazaarPool]);

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
          <TouchableOpacity
            style={styles.locationGroup}
            onPress={() => navigation.navigate('SavedAddresses')}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Select delivery address"
          >
            <View style={styles.locationIconBox}>
              <Ionicons name="location-sharp" size={20} color={AppColors.error} />
            </View>
            <View style={styles.locationTextColumn}>
              <Text style={styles.deliverToCaption}>DELIVER TO</Text>
              <View style={styles.cityRow}>
                <Text style={styles.cityName} numberOfLines={1}>{deliverTo}</Text>
                <Ionicons name="chevron-down" size={16} color={AppColors.textSecondary} />
              </View>
            </View>
          </TouchableOpacity>


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
            onPress={openSearch}
          />
        </View>

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

        {banners.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dealsScroll}>
            {banners.map((banner) => (
              <TouchableOpacity
                key={String(banner.id)}
                style={styles.promoCard}
                activeOpacity={0.85}
                onPress={() => openBanner(banner)}
              >
                {banner.imageUrl ? (
                  <Image source={{ uri: resolveBannerImage(banner.imageUrl) }} style={styles.promoImage} />
                ) : null}
                <Text style={styles.dealTitle}>{banner.title}</Text>
                {banner.subtitle ? <Text style={styles.dealSubtitle}>{banner.subtitle}</Text> : null}
                {banner.ctaText ? <Text style={styles.promoCta}>{banner.ctaText}</Text> : null}
              </TouchableOpacity>
            ))}
          </ScrollView>
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
      </ScrollView>

      {/* Global Search Overlay Modal */}
      <Modal visible={isSearchOpen} animationType="slide" onRequestClose={() => setIsSearchOpen(false)}>
        <SafeAreaView style={styles.searchModalContainer}>
          <View style={styles.searchModalHeader}>
            <TouchableOpacity onPress={() => setIsSearchOpen(false)} style={styles.searchBackBtn}>
              <Ionicons name="arrow-back" size={24} color={AppColors.textPrimary} />
            </TouchableOpacity>
            <View style={styles.searchModalInputWrapper}>
              <AppSearchBar
                placeholder="Search food, dishes, marketplace ads..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                onClear={() => setSearchQuery('')}
                editable={true}
              />
            </View>
          </View>

          {/* Search Category Filter Tabs */}
          <View style={styles.searchFilterRow}>
            {(['ALL', 'FOOD', 'BAZAAR'] as const).map((filter) => {
              const active = searchFilter === filter;
              return (
                <TouchableOpacity
                  key={filter}
                  style={[styles.searchFilterChip, active ? styles.searchFilterChipActive : null]}
                  onPress={() => setSearchFilter(filter)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.searchFilterText, active ? styles.searchFilterTextActive : null]}>
                    {filter === 'ALL' ? 'All Results' : filter === 'FOOD' ? 'Food & Restaurants' : 'Marketplace'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {searchLoading ? (
            <View style={styles.searchLoaderContainer}>
              <ActivityIndicator size="large" color={AppColors.primary} />
              <Text style={styles.searchLoaderText}>Loading searchable catalog...</Text>
            </View>
          ) : (
            <FlatList
              data={searchResults}
              keyExtractor={(item) => `${item.type}-${item.id}`}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.searchResultsList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.searchResultCard}
                  activeOpacity={0.7}
                  onPress={() => {
                    setIsSearchOpen(false);
                    if (item.type === 'FOOD') {
                      navigation.navigate('RestaurantDetail', { restaurantId: item.id });
                    } else if (item.type === 'BAZAAR') {
                      navigation.navigate('ListingDetail', { listingId: String(item.id) });
                    }
                  }}
                >
                  <View style={styles.searchResultBadge}>
                    <Ionicons
                      name={item.type === 'FOOD' ? 'restaurant' : 'pricetag'}
                      size={14}
                      color={item.type === 'FOOD' ? '#EA580C' : '#2563EB'}
                    />
                    <Text
                      style={[
                        styles.searchResultBadgeText,
                        { color: item.type === 'FOOD' ? '#EA580C' : '#2563EB' },
                      ]}
                    >
                      {item.type === 'FOOD' ? 'RESTAURANT' : 'MARKETPLACE'}
                    </Text>
                  </View>
                  <Text style={styles.searchResultTitle}>{item.title}</Text>
                  {item.subtitle ? <Text style={styles.searchResultSubtitle}>{item.subtitle}</Text> : null}
                  {item.price != null ? (
                    <Text style={styles.searchResultPrice}>₹{Number(item.price).toFixed(0)}</Text>
                  ) : null}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.searchEmptyBox}>
                  <Ionicons name="search-outline" size={48} color={AppColors.textTertiary} />
                  <Text style={styles.searchEmptyTitle}>
                    {searchQuery.trim().length > 0 ? 'No matching items found' : 'Type to search SuperApp'}
                  </Text>
                  <Text style={styles.searchEmptySubtitle}>
                    {searchQuery.trim().length > 0
                      ? 'Try searching for dishes like Biryani or marketplace products'
                      : 'Search across live restaurants, food menus, and verified local listings'}
                  </Text>
                </View>
              }
            />
          )}
        </SafeAreaView>
      </Modal>
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
  promoCard: {
    width: 260,
    marginRight: 12,
    backgroundColor: AppColors.surface,
    borderRadius: AppRadius.md,
    padding: 12,
  },
  promoImage: {
    width: '100%',
    height: 110,
    borderRadius: AppRadius.sm,
    marginBottom: 8,
  },
  promoCta: {
    marginTop: 6,
    color: AppColors.primary,
    fontWeight: '700',
  },
  dealSubtitle: {
    color: AppColors.textSecondary,
    fontSize: 11,
  },
  searchModalContainer: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  searchModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
  },
  searchBackBtn: {
    padding: 8,
    marginRight: 4,
  },
  searchModalInputWrapper: {
    flex: 1,
  },
  searchFilterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: `${AppColors.border}55`,
  },
  searchFilterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: AppColors.surface,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  searchFilterChipActive: {
    backgroundColor: AppColors.primary,
    borderColor: AppColors.primary,
  },
  searchFilterText: {
    fontSize: 12,
    fontWeight: '600',
    color: AppColors.textSecondary,
  },
  searchFilterTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  searchResultsList: {
    padding: 16,
    gap: 12,
  },
  searchResultCard: {
    backgroundColor: AppColors.surface,
    borderRadius: AppRadius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: `${AppColors.border}88`,
  },
  searchResultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  searchResultBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  searchResultTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: AppColors.textPrimary,
    marginBottom: 2,
  },
  searchResultSubtitle: {
    fontSize: 12,
    color: AppColors.textSecondary,
  },
  searchResultPrice: {
    fontSize: 14,
    fontWeight: '800',
    color: AppColors.secondary,
    marginTop: 6,
  },
  searchLoaderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  searchLoaderText: {
    marginTop: 12,
    fontSize: 13,
    color: AppColors.textSecondary,
  },
  searchEmptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    paddingHorizontal: 24,
  },
  searchEmptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: AppColors.textPrimary,
    marginTop: 14,
    marginBottom: 6,
  },
  searchEmptySubtitle: {
    fontSize: 13,
    color: AppColors.textTertiary,
    textAlign: 'center',
    lineHeight: 18,
  },
});
