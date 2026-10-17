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
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { AppColors } from '../../theme/colors';
import { AppRadius, spacing } from '../../theme/spacing';
import { AppTypography } from '../../theme/typography';
import { AppSearchBar } from '../../components/common/AppSearchBar';
import { useAuthStore } from '../../store/authStore';
import { useCartStore } from '../../store/cartStore';
import { apiClient } from '../../services/apiClient';
import { ApiEndpoints } from '../../constants/api';
import { AppEnvironment } from '../../config/environment';
import { RestaurantSummary, FoodItem } from '../../models/food';
import { ListingSummary } from '../../models/marketplace';
import { DEFAULT_RESTAURANTS, resolveRestaurantImage } from '../food/FoodHomeScreen';

const SCREEN_WIDTH = typeof Dimensions !== 'undefined' && Dimensions.get ? (Dimensions.get('window')?.width || 375) : 375;

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

export interface TodayDealItem {
  id: number;
  restaurantId: number;
  restaurantName: string;
  name: string;
  description: string;
  imageUrl: string;
  basePrice: number;
  discountedPrice: number;
  discountPercent: number;
  isVeg: boolean;
  isCustomizable: boolean;
  tag: string;
}

const CUISINE_RECOMMENDATIONS = [
  { id: 'biryani', name: 'Biryani', icon: 'flame', count: '12+ spots' },
  { id: 'north_indian', name: 'North Indian', icon: 'restaurant', count: '18+ spots' },
  { id: 'south_indian', name: 'South Indian', icon: 'leaf', count: '10+ spots' },
  { id: 'burgers', name: 'Burgers', icon: 'fast-food', count: '8+ spots' },
  { id: 'desserts', name: 'Desserts', icon: 'ice-cream', count: '14+ spots' },
  { id: 'rolls', name: 'Rolls & Wraps', icon: 'nutrition', count: '9+ spots' },
];

export const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const user = useAuthStore((state) => state.user);
  const addItemToCart = useCartStore((state) => state.addItem);
  const cartRestaurantId = useCartStore((state) => state.restaurantId);
  const cartRestaurantName = useCartStore((state) => state.restaurantName);

  const [activeRide, setActiveRide] = useState<any>(null);
  const [banners, setBanners] = useState<any[]>([]);
  const [deliverTo, setDeliverTo] = useState<string>('Add delivery address');
  const [restaurants, setRestaurants] = useState<RestaurantSummary[]>(DEFAULT_RESTAURANTS);
  const [todayDeals, setTodayDeals] = useState<TodayDealItem[]>([]);
  const [bazaarListings, setBazaarListings] = useState<ListingSummary[]>([]);
  const [isLoadingHome, setIsLoadingHome] = useState<boolean>(true);

  // Multi-Category Search Overlay State
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFilter, setSearchFilter] = useState<'ALL' | 'FOOD' | 'BAZAAR'>('ALL');
  const [searchLoading, setSearchLoading] = useState(false);
  const [foodPool, setFoodPool] = useState<any[]>([]);
  const [bazaarPool, setBazaarPool] = useState<any[]>([]);

  const loadHomeData = useCallback(async () => {
    setIsLoadingHome(true);
    try {
      const [bannersRes, restsRes, listingsRes, ridesRes] = await Promise.allSettled([
        apiClient.get<any>(ApiEndpoints.common.banners),
        apiClient.get<any>(ApiEndpoints.food.restaurants),
        apiClient.get<any>(ApiEndpoints.marketplace.listings),
        apiClient.get<any>(ApiEndpoints.ride.myRides),
      ]);

      // 1. Banners
      if (bannersRes.status === 'fulfilled') {
        const data = bannersRes.value?.data?.data || bannersRes.value?.data;
        if (Array.isArray(data) && data.length > 0) {
          setBanners(data);
        }
      }

      // 2. Restaurants & Food Deals
      let loadedRests: RestaurantSummary[] = DEFAULT_RESTAURANTS;
      if (restsRes.status === 'fulfilled') {
        const payload = restsRes.value?.data?.data || restsRes.value?.data;
        const items = payload?.items || payload;
        if (Array.isArray(items) && items.length > 0) {
          loadedRests = items;
          setRestaurants(items);
        }
      }

      // Extract actual deals/combos from top restaurant detail menus
      if (loadedRests.length > 0) {
        const topRest = loadedRests[0];
        try {
          const detailRes = await apiClient.get<any>(ApiEndpoints.food.restaurantDetail(topRest.id));
          const detailData = detailRes?.data?.data || detailRes?.data;
          if (detailData && Array.isArray(detailData.categories)) {
            const deals: TodayDealItem[] = [];
            for (const cat of detailData.categories) {
              const catItems: FoodItem[] = cat.items || [];
              for (const item of catItems) {
                if (item.isAvailable) {
                  const discountPct = Number(item.discountPercent) || 0;
                  const isDealOrCombo =
                    item.isBestseller ||
                    discountPct > 0 ||
                    item.name.toLowerCase().includes('combo') ||
                    item.name.toLowerCase().includes('thali') ||
                    item.name.toLowerCase().includes('special');

                  if (isDealOrCombo && deals.length < 6) {
                    deals.push({
                      id: item.id,
                      restaurantId: topRest.id,
                      restaurantName: detailData.name || topRest.name,
                      name: item.name,
                      description: item.description || '',
                      imageUrl: item.imageUrl || topRest.imageUrl || '',
                      basePrice: Number(item.basePrice) || 0,
                      discountedPrice: Number(item.discountedPrice) || Number(item.basePrice) || 0,
                      discountPercent: discountPct,
                      isVeg: Boolean(item.isVeg),
                      isCustomizable: Boolean(item.isCustomizable),
                      tag: discountPct > 0 ? `${discountPct}% OFF` : item.isBestseller ? 'BESTSELLER' : 'SPECIAL',
                    });
                  }
                }
              }
            }
            if (deals.length > 0) {
              setTodayDeals(deals);
            }
          }
        } catch {
          // Keep existing or empty deals safely
        }
      }

      // 3. Bazaar Listings
      if (listingsRes.status === 'fulfilled') {
        const payload = listingsRes.value?.data?.data || listingsRes.value?.data;
        const items = payload?.items || payload;
        if (Array.isArray(items)) {
          setBazaarListings(items.slice(0, 6));
        }
      }

      // 4. Live Ride
      if (ridesRes.status === 'fulfilled') {
        const data = ridesRes.value?.data?.data || ridesRes.value?.data;
        if (Array.isArray(data) && data.length > 0) {
          const live = data.find(
            (r: any) => r.status === 'PENDING' || r.status === 'ACCEPTED' || r.status === 'STARTED'
          );
          setActiveRide(live || null);
        }
      }
    } finally {
      setIsLoadingHome(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      apiClient
        .get<any>(ApiEndpoints.common.addresses)
        .then((res) => {
          const payload = res?.data?.data ?? res?.data ?? res;
          setDeliverTo(resolveDeliveryAddress(payload));
        })
        .catch(() => {
          setDeliverTo('Add delivery address');
        });

      loadHomeData();

      const onBackPress = () => {
        if (isSearchOpen) {
          setIsSearchOpen(false);
          return true;
        }
        return false;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [isSearchOpen, loadHomeData])
  );

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

  const handleAddDealToCart = (deal: TodayDealItem) => {
    if (deal.isCustomizable) {
      // Navigate to Restaurant Detail so user can customize variants and addons safely
      navigation.navigate('RestaurantDetail', { restaurantId: deal.restaurantId.toString() });
      return;
    }

    // Guard against silent mixed restaurant cart corruption
    if (cartRestaurantId !== null && cartRestaurantId !== deal.restaurantId) {
      Alert.alert(
        'Replace Cart?',
        `Your cart contains items from "${cartRestaurantName}". Do you want to discard them and add this deal from "${deal.restaurantName}"?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Yes, Replace',
            style: 'destructive',
            onPress: () => {
              addItemToCart(deal.restaurantId, deal.restaurantName, {
                id: Date.now(),
                foodItemId: deal.id,
                name: deal.name,
                basePrice: deal.discountedPrice,
                quantity: 1,
                addons: [],
                totalPrice: deal.discountedPrice,
              });
              Alert.alert('Added to Cart', `${deal.name} added to your cart.`);
            },
          },
        ]
      );
      return;
    }

    addItemToCart(deal.restaurantId, deal.restaurantName, {
      id: Date.now(),
      foodItemId: deal.id,
      name: deal.name,
      basePrice: deal.discountedPrice,
      quantity: 1,
      addons: [],
      totalPrice: deal.discountedPrice,
    });
    Alert.alert('Added to Cart', `${deal.name} added to your cart.`);
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
        {/* 1. TOP HEADER: Address, Notification Button & Profile */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.locationGroup}
            onPress={() => navigation.navigate('SavedAddresses')}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Select delivery address"
          >
            <View style={styles.locationIconBox}>
              <Ionicons name="location-sharp" size={18} color={AppColors.primary} />
            </View>
            <View style={styles.locationTextColumn}>
              <Text style={styles.deliverToCaption}>DELIVER TO</Text>
              <View style={styles.cityRow}>
                <Text style={styles.cityName} numberOfLines={1}>{deliverTo}</Text>
                <Ionicons name="chevron-down" size={15} color={AppColors.textSecondary} />
              </View>
            </View>
          </TouchableOpacity>

          <View style={styles.headerRightActions}>
            <TouchableOpacity
              style={styles.headerIconButton}
              onPress={() => navigation.navigate('Notifications')}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="View notifications"
            >
              <Ionicons name="notifications-outline" size={20} color={AppColors.textPrimary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.profileAvatar}
              onPress={() => navigation.navigate('Profile')}
              activeOpacity={0.8}
            >
              <Text style={styles.avatarInitials}>{getInitials()}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 2. UNIFIED SEARCH BAR */}
        <View style={styles.searchWrapper}>
          <AppSearchBar
            placeholder="Search food, restaurants, dishes & marketplace..."
            editable={false}
            onPress={openSearch}
          />
        </View>

        {/* 3. ACTIVE RIDE STATUS CARD (If user has a live ride in transit) */}
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
                    {activeRide.driver?.fullName ? `Captain: ${activeRide.driver.fullName} • ` : ''}OTP:{' '}
                  </Text>
                  <Text style={styles.otpHighlight}>{activeRide.otpCode || '----'}</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.trackButton}
                onPress={() =>
                  navigation.navigate('ActiveRide', {
                    rideId: activeRide.rideNumber || 'RD-LIVE',
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

        {/* 4. PROMOTIONAL BANNERS CAROUSEL */}
        {banners.length > 0 && (
          <View style={styles.bannerSection}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.bannersScroll}
              decelerationRate="fast"
              snapToInterval={SCREEN_WIDTH - 48}
            >
              {banners.map((banner) => (
                <TouchableOpacity
                  key={String(banner.id)}
                  style={styles.bannerCard}
                  activeOpacity={0.9}
                  onPress={() => openBanner(banner)}
                >
                  {banner.imageUrl ? (
                    <Image
                      source={{ uri: resolveBannerImage(banner.imageUrl) }}
                      style={styles.bannerImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.bannerImagePlaceholder}>
                      <Ionicons name="sparkles" size={28} color={AppColors.primary} />
                    </View>
                  )}
                  <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.8)']}
                    style={styles.bannerOverlay}
                  >
                    <Text style={styles.bannerTitle} numberOfLines={1}>{banner.title}</Text>
                    {banner.subtitle ? (
                      <Text style={styles.bannerSubtitle} numberOfLines={1}>{banner.subtitle}</Text>
                    ) : null}
                    {banner.ctaText ? (
                      <View style={styles.bannerCtaBadge}>
                        <Text style={styles.bannerCtaText}>{banner.ctaText} →</Text>
                      </View>
                    ) : null}
                  </LinearGradient>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* 5. QUICK RIDE SHORTCUT STRIP */}
        <TouchableOpacity
          style={styles.rideShortcutStrip}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('Rides')}
        >
          <View style={styles.rideShortcutLeft}>
            <View style={styles.rideShortcutIconBox}>
              <Ionicons name="car-sport" size={20} color="#FFFFFF" />
            </View>
            <View style={styles.rideShortcutTextCol}>
              <Text style={styles.rideShortcutTitle}>Need a quick ride?</Text>
              <Text style={styles.rideShortcutSubtitle}>Bike, Auto & Cabs nearby • Tap to book</Text>
            </View>
          </View>
          <View style={styles.rideShortcutActionBtn}>
            <Text style={styles.rideShortcutActionText}>Book Ride</Text>
            <Ionicons name="arrow-forward" size={14} color={AppColors.primary} />
          </View>
        </TouchableOpacity>

        {/* 6. TODAY'S DEALS & COMBOS SECTION */}
        {todayDeals.length > 0 && (
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={styles.sectionHeading}>Today's Deals & Combos</Text>
                <Text style={styles.sectionSubheading}>Freshly discounted items from verified restaurants</Text>
              </View>
              <TouchableOpacity onPress={() => navigation.navigate('Food')}>
                <Text style={styles.seeAllText}>See all</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalCardList}
            >
              {todayDeals.map((deal) => (
                <View key={deal.id} style={styles.dealCard}>
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => navigation.navigate('RestaurantDetail', { restaurantId: deal.restaurantId.toString() })}
                  >
                    <Image
                      source={{ uri: resolveRestaurantImage(deal.imageUrl) }}
                      style={styles.dealCardImage}
                      resizeMode="cover"
                    />
                    <View style={styles.dealTagBadge}>
                      <Text style={styles.dealTagText}>{deal.tag}</Text>
                    </View>
                  </TouchableOpacity>

                  <View style={styles.dealCardContent}>
                    <Text style={styles.dealRestName} numberOfLines={1}>{deal.restaurantName}</Text>
                    <Text style={styles.dealItemName} numberOfLines={1}>{deal.name}</Text>

                    <View style={styles.dealPriceRow}>
                      <Text style={styles.dealPrice}>₹{deal.discountedPrice.toFixed(0)}</Text>
                      {deal.basePrice > deal.discountedPrice && (
                        <Text style={styles.dealBasePrice}>₹{deal.basePrice.toFixed(0)}</Text>
                      )}
                    </View>

                    <TouchableOpacity
                      style={styles.addDealBtn}
                      activeOpacity={0.8}
                      onPress={() => handleAddDealToCart(deal)}
                    >
                      <Ionicons name="add" size={16} color="#FFFFFF" />
                      <Text style={styles.addDealBtnText}>ADD</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* 7. FOOD DISCOVERY CUISINES */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionHeading}>Explore Cuisines</Text>
              <Text style={styles.sectionSubheading}>Curated culinary selections</Text>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('Food')}>
              <Text style={styles.seeAllText}>Explore Menu</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.cuisinesScroll}
          >
            {CUISINE_RECOMMENDATIONS.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={styles.cuisinePill}
                activeOpacity={0.8}
                onPress={() => navigation.navigate('Food')}
              >
                <View style={styles.cuisineIconCircle}>
                  <Ionicons name={c.icon as any} size={20} color={AppColors.primary} />
                </View>
                <Text style={styles.cuisineName}>{c.name}</Text>
                <Text style={styles.cuisineCount}>{c.count}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* 8. POPULAR RESTAURANTS NEAR YOU */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionHeading}>Popular Near You</Text>
              <Text style={styles.sectionSubheading}>Top-rated restaurants delivered to your doorstep</Text>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('Food')}>
              <Text style={styles.seeAllText}>View all ({restaurants.length})</Text>
            </TouchableOpacity>
          </View>

          {restaurants.slice(0, 4).map((restaurant) => (
            <TouchableOpacity
              key={restaurant.id}
              style={styles.restCard}
              activeOpacity={0.9}
              onPress={() =>
                navigation.navigate('RestaurantDetail', {
                  restaurantId: restaurant.id.toString(),
                })
              }
            >
              <Image
                source={{ uri: resolveRestaurantImage(restaurant.imageUrl) }}
                style={styles.restImage}
                resizeMode="cover"
              />
              <View style={styles.restInfo}>
                <View style={styles.restTitleRow}>
                  <Text style={styles.restName} numberOfLines={1}>{restaurant.name}</Text>
                  <View style={styles.ratingBadge}>
                    <Ionicons name="star" size={11} color="#FFFFFF" />
                    <Text style={styles.ratingText}>{Number(restaurant.rating || 4.5).toFixed(1)}</Text>
                  </View>
                </View>

                <Text style={styles.restCuisines} numberOfLines={1}>
                  {restaurant.cuisines || restaurant.description || 'Multi-cuisine • Fast Food'}
                </Text>

                <View style={styles.restMetaRow}>
                  <View style={styles.restMetaItem}>
                    <Ionicons name="time-outline" size={13} color={AppColors.textSecondary} />
                    <Text style={styles.restMetaText}>
                      {restaurant.avgDeliveryTimeMinutes || 25} mins
                    </Text>
                  </View>
                  <Text style={styles.metaDot}>•</Text>
                  <View style={styles.restMetaItem}>
                    <Ionicons name="bicycle-outline" size={13} color={AppColors.textSecondary} />
                    <Text style={styles.restMetaText}>
                      {restaurant.deliveryFee === 0 ? 'Free Delivery' : `₹${restaurant.deliveryFee} drop`}
                    </Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* 9. COMPACT BAZAAR PICKS */}
        {bazaarListings.length > 0 && (
          <View style={[styles.sectionContainer, { marginBottom: 16 }]}>
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={styles.sectionHeading}>Community Bazaar</Text>
                <Text style={styles.sectionSubheading}>Fresh pre-loved items from verified local sellers</Text>
              </View>
              <TouchableOpacity onPress={() => navigation.navigate('Bazaar')}>
                <Text style={styles.seeAllText}>Browse Bazaar</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalCardList}
            >
              {bazaarListings.map((listing) => (
                <TouchableOpacity
                  key={listing.id}
                  style={styles.bazaarCard}
                  activeOpacity={0.85}
                  onPress={() => navigation.navigate('ListingDetail', { listingId: String(listing.id) })}
                >
                  <Image
                    source={{
                      uri:
                        listing.primaryImageUrl ||
                        'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=400',
                    }}
                    style={styles.bazaarCardImage}
                    resizeMode="cover"
                  />
                  <View style={styles.bazaarCardContent}>
                    <Text style={styles.bazaarPrice}>₹{Number(listing.price || 0).toFixed(0)}</Text>
                    <Text style={styles.bazaarTitle} numberOfLines={1}>{listing.title}</Text>
                    <Text style={styles.bazaarCategory} numberOfLines={1}>
                      {listing.categoryName || 'General'} • {listing.location || 'Local'}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>

      {/* GLOBAL SEARCH OVERLAY MODAL */}
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
    paddingBottom: 32,
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
    flex: 1,
    marginRight: 12,
  },
  locationIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: `${AppColors.primary}22`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  locationTextColumn: {
    flex: 1,
    justifyContent: 'center',
  },
  deliverToCaption: {
    fontSize: 10,
    fontWeight: '800',
    color: AppColors.textTertiary,
    letterSpacing: 1.1,
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
    maxWidth: '85%',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: AppColors.surface,
    borderWidth: 1,
    borderColor: AppColors.border,
    alignItems: 'center',
    justifyContent: 'center',
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
    marginBottom: 20,
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
  bannerSection: {
    marginBottom: 20,
  },
  bannersScroll: {
    paddingRight: 16,
    gap: 12,
  },
  bannerCard: {
    width: SCREEN_WIDTH - 64,
    height: 140,
    borderRadius: AppRadius.md,
    overflow: 'hidden',
    backgroundColor: AppColors.surface,
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  bannerImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: `${AppColors.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
    justifyContent: 'flex-end',
  },
  bannerTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  bannerSubtitle: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 11,
    marginTop: 2,
  },
  bannerCtaBadge: {
    alignSelf: 'flex-start',
    backgroundColor: AppColors.primary,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 6,
  },
  bannerCtaText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  rideShortcutStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: AppColors.surface,
    borderWidth: 1,
    borderColor: `${AppColors.primary}33`,
    borderRadius: AppRadius.md,
    padding: 14,
    marginBottom: 24,
  },
  rideShortcutLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  rideShortcutIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: AppColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rideShortcutTextCol: {
    flex: 1,
  },
  rideShortcutTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: AppColors.textPrimary,
  },
  rideShortcutSubtitle: {
    fontSize: 11,
    color: AppColors.textSecondary,
    marginTop: 2,
  },
  rideShortcutActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: `${AppColors.primary}1A`,
  },
  rideShortcutActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: AppColors.primary,
  },
  sectionContainer: {
    marginBottom: 24,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionHeading: {
    fontSize: 17,
    fontWeight: '800',
    color: AppColors.textPrimary,
  },
  sectionSubheading: {
    fontSize: 12,
    color: AppColors.textTertiary,
    marginTop: 2,
  },
  seeAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: AppColors.primary,
    marginTop: 2,
  },
  horizontalCardList: {
    paddingRight: 16,
    gap: 12,
  },
  dealCard: {
    width: 170,
    backgroundColor: AppColors.surface,
    borderRadius: AppRadius.md,
    borderWidth: 1,
    borderColor: AppColors.border,
    overflow: 'hidden',
  },
  dealCardImage: {
    width: '100%',
    height: 105,
  },
  dealTagBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: AppColors.primary,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  dealTagText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  dealCardContent: {
    padding: 10,
  },
  dealRestName: {
    fontSize: 10,
    color: AppColors.textSecondary,
    fontWeight: '600',
    marginBottom: 2,
  },
  dealItemName: {
    fontSize: 13,
    fontWeight: '700',
    color: AppColors.textPrimary,
    marginBottom: 6,
  },
  dealPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  dealPrice: {
    fontSize: 14,
    fontWeight: '800',
    color: AppColors.textPrimary,
  },
  dealBasePrice: {
    fontSize: 11,
    color: AppColors.textTertiary,
    textDecorationLine: 'line-through',
  },
  addDealBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppColors.primary,
    borderRadius: 6,
    paddingVertical: 5,
    gap: 4,
  },
  addDealBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  cuisinesScroll: {
    paddingRight: 16,
    gap: 10,
  },
  cuisinePill: {
    alignItems: 'center',
    width: 82,
    paddingVertical: 10,
    backgroundColor: AppColors.surface,
    borderRadius: AppRadius.md,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  cuisineIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${AppColors.primary}18`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  cuisineName: {
    fontSize: 11,
    fontWeight: '700',
    color: AppColors.textPrimary,
    textAlign: 'center',
  },
  cuisineCount: {
    fontSize: 9,
    color: AppColors.textTertiary,
    marginTop: 2,
  },
  restCard: {
    flexDirection: 'row',
    backgroundColor: AppColors.surface,
    borderRadius: AppRadius.md,
    borderWidth: 1,
    borderColor: AppColors.border,
    padding: 12,
    marginBottom: 10,
    alignItems: 'center',
  },
  restImage: {
    width: 74,
    height: 74,
    borderRadius: 10,
    marginRight: 12,
  },
  restInfo: {
    flex: 1,
  },
  restTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  restName: {
    fontSize: 14,
    fontWeight: '700',
    color: AppColors.textPrimary,
    flex: 1,
    marginRight: 6,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16A34A',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    gap: 3,
  },
  ratingText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  restCuisines: {
    fontSize: 11,
    color: AppColors.textSecondary,
    marginBottom: 6,
  },
  restMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  restMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  restMetaText: {
    fontSize: 11,
    color: AppColors.textSecondary,
    fontWeight: '500',
  },
  metaDot: {
    marginHorizontal: 6,
    color: AppColors.textTertiary,
    fontSize: 11,
  },
  bazaarCard: {
    width: 140,
    backgroundColor: AppColors.surface,
    borderRadius: AppRadius.md,
    borderWidth: 1,
    borderColor: AppColors.border,
    overflow: 'hidden',
  },
  bazaarCardImage: {
    width: '100%',
    height: 95,
  },
  bazaarCardContent: {
    padding: 8,
  },
  bazaarPrice: {
    fontSize: 13,
    fontWeight: '800',
    color: AppColors.textPrimary,
  },
  bazaarTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: AppColors.textSecondary,
    marginTop: 2,
  },
  bazaarCategory: {
    fontSize: 10,
    color: AppColors.textTertiary,
    marginTop: 3,
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
