import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { AppColors } from '../../theme/colors';
import { AppRadius } from '../../theme/spacing';
import { AppSearchBar } from '../../components/common/AppSearchBar';
import { RatingBadge } from '../../components/common/RatingBadge';
import { apiClient } from '../../services/apiClient';
import { ApiEndpoints } from '../../constants/api';
import { FoodCatalogItem, RestaurantSummary } from '../../models/food';
import { useFocusEffect } from '@react-navigation/native';
import { absoluteImageUrl } from '../../services/documentService';
import { useCartStore } from '../../store/cartStore';

const DEFAULT_RESTAURANT_IMAGE = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600';
const DEFAULT_DISH_IMAGE = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600';

export function resolveRestaurantImage(url?: string): string {
  if (!url || !url.trim()) return DEFAULT_RESTAURANT_IMAGE;
  return absoluteImageUrl(url);
}

function resolveDishImage(url?: string): string {
  if (!url || !url.trim()) return DEFAULT_DISH_IMAGE;
  return absoluteImageUrl(url);
}

interface FoodHomeScreenProps {
  navigation: any;
}

export const DEFAULT_RESTAURANTS: RestaurantSummary[] = [
  {
    id: 1,
    name: 'Meghana Foods (Special Biryani)',
    cuisines: 'Biryani • Hyderabadi • Andhra • Kebabs',
    addressLine: '₹500 for two • 1.8 km',
    rating: 4.6,
    totalRatings: 1840,
    avgDeliveryTimeMinutes: 22,
    offerText: '60% OFF UPTO ₹120',
    isVeg: false,
    minOrderAmount: 200,
    deliveryFee: 0,
    isFeatured: true,
    imageUrl: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=600',
  },
  {
    id: 2,
    name: "Haldiram's Sweets & Thali",
    cuisines: 'North Indian • Chaat • Pure Veg • Mithai',
    addressLine: '₹350 for two • 1.2 km',
    rating: 4.5,
    totalRatings: 920,
    avgDeliveryTimeMinutes: 18,
    offerText: 'FLAT 20% OFF',
    isVeg: true,
    minOrderAmount: 150,
    deliveryFee: 0,
    isFeatured: false,
    imageUrl: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=600',
  },
  {
    id: 3,
    name: 'Burger King (Gourmet Burgers)',
    cuisines: 'Burgers • American • Fast Food • Shakes',
    addressLine: '₹400 for two • 2.5 km',
    rating: 4.3,
    totalRatings: 2150,
    avgDeliveryTimeMinutes: 25,
    offerText: 'FREE DELIVERY',
    isVeg: false,
    minOrderAmount: 150,
    deliveryFee: 0,
    isFeatured: false,
    imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600',
  },
  {
    id: 4,
    name: 'Sagar Ratna (Authentic South Indian)',
    cuisines: 'South Indian • Dosa • Idli • Filter Coffee • Pure Veg',
    addressLine: '₹300 for two • 1.5 km',
    rating: 4.7,
    totalRatings: 3420,
    avgDeliveryTimeMinutes: 20,
    offerText: 'FLAT 15% OFF',
    isVeg: true,
    minOrderAmount: 120,
    deliveryFee: 0,
    isFeatured: true,
    imageUrl: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=600',
  },
  {
    id: 5,
    name: 'Rolls King & Wraps',
    cuisines: 'Rolls • Kathi Rolls • Wraps • Fast Food',
    addressLine: '₹250 for two • 1.9 km',
    rating: 4.4,
    totalRatings: 1100,
    avgDeliveryTimeMinutes: 20,
    offerText: '20% OFF',
    isVeg: false,
    minOrderAmount: 100,
    deliveryFee: 0,
    isFeatured: false,
    imageUrl: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=600',
  },
];

const CATEGORIES = [
  'All',
  'Biryani',
  'North Indian',
  'South Indian',
  'Burgers',
  'Rolls',
  'Desserts',
];

export const FoodHomeScreen: React.FC<FoodHomeScreenProps> = ({ navigation }) => {
  const [selectedCategoryIndex, setSelectedCategoryIndex] = useState(0);
  const [filterVegOnly, setFilterVegOnly] = useState(false);
  const [filterRating4Plus, setFilterRating4Plus] = useState(false);
  const [filterFastDelivery, setFilterFastDelivery] = useState(false);
  const [filterOffers, setFilterOffers] = useState(false);
  const [sortBy, setSortBy] = useState<'rating' | 'deliveryTime' | 'default'>('default');
  const [searchQuery, setSearchQuery] = useState('');
  const [foods, setFoods] = useState<FoodCatalogItem[]>([]);
  const [deliverTo, setDeliverTo] = useState('Add delivery address');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const cartCount = useCartStore((s) => s.items.reduce((n, i) => n + i.quantity, 0));

  const loadFoods = () => {
    setIsLoading(true);
    setLoadError(null);
    apiClient
      .get<any>(ApiEndpoints.food.foods, { params: { page: 1, pageSize: 40 } })
      .then((res) => {
        const payload = res?.data ?? res;
        const items = payload?.items || payload;
        if (Array.isArray(items)) {
          setFoods(items);
        } else {
          setFoods([]);
        }
      })
      .catch((err) => {
        const msg = err?.response?.data?.message || err?.message || 'Unable to load dishes. Please check your network connection.';
        setLoadError(msg);
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  useEffect(() => {
    loadFoods();
  }, []);

  useFocusEffect(
    useCallback(() => {
      apiClient
        .get<any>(ApiEndpoints.common.addresses)
        .then((res) => {
          const payload = res?.data?.data ?? res?.data ?? res;
          const items = Array.isArray(payload) ? payload : [];
          const def = items.find((a: any) => a.isDefault) || items[0];
          if (def) {
            const line = [def.addressLine1, def.city].filter(Boolean).join(', ');
            setDeliverTo(line || 'Add delivery address');
          } else {
            setDeliverTo('Add delivery address');
          }
        })
        .catch(() => {
          setDeliverTo('Add delivery address');
        });
    }, [])
  );

  const filteredFoods = foods
    .filter((f) => {
      if (filterVegOnly && !f.isVeg) return false;
      if (filterRating4Plus && (f.restaurantRating || 0) < 4.0) return false;
      if (filterFastDelivery && (f.avgDeliveryTimeMinutes || 30) > 25) return false;
      if (filterOffers && !(f.discountPercent && f.discountPercent > 0)) return false;

      const activeCategory = CATEGORIES[selectedCategoryIndex];
      if (activeCategory && activeCategory !== 'All') {
        const catNorm = activeCategory.trim().toLowerCase();
        const hay = `${f.name} ${f.categoryName || ''} ${f.cuisines || ''} ${f.restaurantName || ''}`.toLowerCase();
        let matchesCategory = hay.includes(catNorm);
        if (!matchesCategory && catNorm === 'burgers') matchesCategory = hay.includes('burger');
        if (!matchesCategory && catNorm === 'rolls') matchesCategory = hay.includes('roll') || hay.includes('wrap');
        if (!matchesCategory && catNorm === 'desserts') {
          matchesCategory = hay.includes('dessert') || hay.includes('sweet') || hay.includes('mithai') || hay.includes('ice cream');
        }
        if (!matchesCategory) return false;
      }

      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase().trim();
        const hay = `${f.name} ${f.restaurantName} ${f.categoryName || ''} ${f.cuisines || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'rating') {
        return (b.restaurantRating || 0) - (a.restaurantRating || 0);
      }
      if (sortBy === 'deliveryTime') {
        return (a.avgDeliveryTimeMinutes || 30) - (b.avgDeliveryTimeMinutes || 30);
      }
      return 0;
    });

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
            activeOpacity={0.8}
          >
            <View style={styles.locationIconBox}>
              <Ionicons name="location-sharp" size={20} color={AppColors.error} />
            </View>
            <View style={styles.locationTextColumn}>
              <Text style={styles.deliverToCaption}>DELIVER TO</Text>
              <View style={styles.cityRow}>
                <Text style={styles.cityName} numberOfLines={1}>
                  {deliverTo}
                </Text>
                <Ionicons name="chevron-down" size={16} color={AppColors.textSecondary} />
              </View>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.profileAvatar}
            onPress={() => navigation.navigate('Profile')}
            activeOpacity={0.8}
          >
            <Text style={styles.avatarInitials}>JD</Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchWrapper}>
          <AppSearchBar
            testID="food-search-input"
            placeholder="Search Biryani, Burgers, Domino's..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterChipsRow}
        >
          {/* Rating 4.0+ */}
          <TouchableOpacity
            style={[styles.filterChip, filterRating4Plus ? styles.filterChipActive : null]}
            onPress={() => setFilterRating4Plus(!filterRating4Plus)}
            activeOpacity={0.8}
          >
            <Ionicons
              name="star"
              size={14}
              color={filterRating4Plus ? '#FFFFFF' : AppColors.textSecondary}
              style={styles.chipIcon}
            />
            <Text style={[styles.filterChipText, filterRating4Plus ? styles.filterChipTextActive : null]}>
              Rating 4.0+
            </Text>
          </TouchableOpacity>

          {/* Fast Delivery */}
          <TouchableOpacity
            style={[styles.filterChip, filterFastDelivery ? styles.filterChipActive : null]}
            onPress={() => setFilterFastDelivery(!filterFastDelivery)}
            activeOpacity={0.8}
          >
            <Ionicons
              name="flash"
              size={14}
              color={filterFastDelivery ? '#FFFFFF' : AppColors.textSecondary}
              style={styles.chipIcon}
            />
            <Text style={[styles.filterChipText, filterFastDelivery ? styles.filterChipTextActive : null]}>
              Fast Delivery (≤25m)
            </Text>
          </TouchableOpacity>

          {/* Pure Veg */}
          <TouchableOpacity
            style={[styles.filterChip, filterVegOnly ? styles.filterChipActive : null]}
            onPress={() => setFilterVegOnly(!filterVegOnly)}
            activeOpacity={0.8}
          >
            <Ionicons
              name="leaf"
              size={14}
              color={filterVegOnly ? '#FFFFFF' : AppColors.textSecondary}
              style={styles.chipIcon}
            />
            <Text style={[styles.filterChipText, filterVegOnly ? styles.filterChipTextActive : null]}>
              Pure Veg
            </Text>
          </TouchableOpacity>

          {/* Offers */}
          <TouchableOpacity
            style={[styles.filterChip, filterOffers ? styles.filterChipActive : null]}
            onPress={() => setFilterOffers(!filterOffers)}
            activeOpacity={0.8}
          >
            <Ionicons
              name="pricetag"
              size={14}
              color={filterOffers ? '#FFFFFF' : AppColors.textSecondary}
              style={styles.chipIcon}
            />
            <Text style={[styles.filterChipText, filterOffers ? styles.filterChipTextActive : null]}>
              Offers
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Category Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryPillsRow}
        >
          {CATEGORIES.map((cat, index) => {
            const isSelected = index === selectedCategoryIndex;
            return (
              <TouchableOpacity
                key={index}
                style={[styles.categoryPill, isSelected ? styles.categoryPillActive : null]}
                onPress={() => setSelectedCategoryIndex(index)}
                activeOpacity={0.8}
              >
                <Text
                  style={[styles.categoryPillText, isSelected ? styles.categoryPillTextActive : null]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Section Header */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionHeaderTitle}>
            POPULAR DISHES NEAR YOU ({filteredFoods.length})
          </Text>
          <TouchableOpacity
            onPress={() => {
              if (sortBy === 'default') setSortBy('rating');
              else if (sortBy === 'rating') setSortBy('deliveryTime');
              else setSortBy('default');
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.sortByText}>
              Sort by: {sortBy === 'rating' ? 'Rating ★' : sortBy === 'deliveryTime' ? 'Fast Delivery ⏱' : 'Default'} ▼
            </Text>
          </TouchableOpacity>
        </View>

        {/* Loading State */}
        {isLoading && (
          <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 48 }}>
            <ActivityIndicator size="large" color={AppColors.primary} />
            <Text style={{ ...styles.restaurantName, marginTop: 12, color: AppColors.textSecondary }}>
              Finding great dishes near you...
            </Text>
          </View>
        )}

        {/* Error State */}
        {loadError && !isLoading && (
          <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 40, paddingHorizontal: 24 }}>
            <Ionicons name="alert-circle-outline" size={48} color={AppColors.error} />
            <Text style={{ ...styles.restaurantName, marginTop: 12, color: AppColors.error, textAlign: 'center' }}>
              {loadError}
            </Text>
            <TouchableOpacity
              style={[styles.filterChipActive, { marginTop: 14, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 16 }]}
              onPress={loadFoods}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Empty State */}
        {!isLoading && !loadError && filteredFoods.length === 0 && (
          <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 48 }}>
            <Ionicons name="fast-food-outline" size={48} color={AppColors.textTertiary} />
            <Text style={{ ...styles.restaurantName, marginTop: 12, color: AppColors.textSecondary }}>
              No dishes currently available
            </Text>
            <Text style={{ fontSize: 13, color: AppColors.textTertiary, marginTop: 4 }}>
              Please check back soon or try another filter.
            </Text>
          </View>
        )}

        {/* Food Cards (direct dishes — tap opens that hotel menu) */}
        {filteredFoods.map((food) => (
          <TouchableOpacity
            key={`${food.restaurantId}-${food.id}`}
            style={styles.restaurantCard}
            activeOpacity={0.9}
            accessibilityRole="button"
            accessibilityLabel={`Dish ${food.name} from ${food.restaurantName}`}
            testID={`food-card-${food.id}`}
            onPress={() =>
              navigation.navigate('RestaurantDetail', {
                restaurantId: food.restaurantId.toString(),
              })
            }
          >
            <View style={styles.imageHeader}>
              <Image
                source={{ uri: resolveDishImage(food.imageUrl || food.restaurantImageUrl) }}
                style={styles.restaurantImage}
                resizeMode="cover"
              />
              <LinearGradient
                colors={['transparent', 'rgba(0, 0, 0, 0.75)']}
                style={StyleSheet.absoluteFill}
              />

              <View style={styles.deliveryTimeBadge}>
                <Ionicons name="time" size={13} color="#FFFFFF" />
                <Text style={styles.deliveryTimeText}>
                  {food.avgDeliveryTimeMinutes || 20} mins
                </Text>
              </View>

              {food.isVeg && (
                <View style={styles.pureVegTag}>
                  <Ionicons name="leaf" size={12} color="#FFFFFF" />
                  <Text style={styles.pureVegTagText}>PURE VEG</Text>
                </View>
              )}

              <View style={styles.offerBanner}>
                <Ionicons name="pricetag" size={12} color="#FFFFFF" />
                <Text style={styles.offerBannerText}>
                  {food.discountPercent && food.discountPercent > 0
                    ? `${food.discountPercent}% OFF`
                    : food.isBestseller
                      ? 'BESTSELLER'
                      : 'ORDER NOW'}
                </Text>
              </View>
            </View>

            <View style={styles.infoSection}>
              <View style={styles.nameRatingRow}>
                <Text style={styles.restaurantName} numberOfLines={1}>
                  {food.name}
                </Text>
                <RatingBadge rating={food.restaurantRating} />
              </View>

              <Text style={styles.cuisinesText} numberOfLines={1}>
                {food.restaurantName}
                {food.categoryName ? ` • ${food.categoryName}` : ''}
              </Text>

              <View style={styles.bottomInfoRow}>
                <Text style={styles.priceForTwoText}>
                  ₹{Number(food.discountedPrice || food.basePrice || 0).toFixed(0)}
                </Text>
                <View style={styles.viewMenuLink}>
                  <Text style={styles.viewMenuText}>Add from menu</Text>
                  <Ionicons name="arrow-forward" size={13} color={AppColors.primary} />
                </View>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
      {cartCount > 0 && (
        <TouchableOpacity
          style={{
            position: 'absolute',
            left: 16,
            right: 16,
            bottom: 16,
            backgroundColor: AppColors.primary,
            borderRadius: 14,
            paddingVertical: 14,
            alignItems: 'center',
          }}
          onPress={() => {
            const rid = useCartStore.getState().restaurantId;
            if (rid) {
              navigation.navigate('RestaurantDetail', { restaurantId: String(rid) });
            }
          }}
          activeOpacity={0.9}
        >
          <Text style={{ color: '#fff', fontWeight: '700' }}>View cart ({cartCount})</Text>
        </TouchableOpacity>
      )}
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
    paddingBottom: 24,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
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
    marginBottom: 14,
  },
  filterChipsRow: {
    paddingRight: 16,
    marginBottom: 14,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.surfaceLight,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: AppColors.border,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginRight: 10,
  },
  filterChipActive: {
    backgroundColor: AppColors.primary,
    borderColor: AppColors.primary,
  },
  chipIcon: {
    marginRight: 5,
  },
  filterChipText: {
    color: AppColors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  categoryPillsRow: {
    paddingRight: 16,
    marginBottom: 20,
  },
  categoryPill: {
    backgroundColor: AppColors.surfaceLight,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: AppColors.border,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
  },
  categoryPillActive: {
    backgroundColor: AppColors.primary,
    borderColor: AppColors.primary,
  },
  categoryPillText: {
    color: AppColors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  categoryPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionHeaderTitle: {
    color: AppColors.textPrimary,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  sortByText: {
    color: AppColors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  restaurantCard: {
    backgroundColor: AppColors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: AppColors.border,
    overflow: 'hidden',
    marginBottom: 18,
  },
  imageHeader: {
    height: 180,
    width: '100%',
    position: 'relative',
    backgroundColor: AppColors.surfaceLight,
  },
  restaurantImage: {
    width: '100%',
    height: '100%',
  },
  deliveryTimeBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  deliveryTimeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 4,
  },
  pureVegTag: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#047857',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  pureVegTagText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    marginLeft: 4,
  },
  offerBanner: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.primary,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  offerBannerText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    marginLeft: 4,
  },
  infoSection: {
    padding: 16,
  },
  nameRatingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  restaurantName: {
    flex: 1,
    color: AppColors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginRight: 8,
  },
  cuisinesText: {
    color: AppColors.textSecondary,
    fontSize: 13,
    marginBottom: 12,
  },
  bottomInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceForTwoText: {
    color: AppColors.textTertiary,
    fontSize: 13,
    fontWeight: '500',
  },
  viewMenuLink: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewMenuText: {
    color: AppColors.primary,
    fontSize: 13,
    fontWeight: '700',
    marginRight: 2,
  },
});
