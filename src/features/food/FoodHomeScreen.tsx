import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { AppColors } from '../../theme/colors';
import { AppRadius } from '../../theme/spacing';
import { AppSearchBar } from '../../components/common/AppSearchBar';
import { RatingBadge } from '../../components/common/RatingBadge';
import { apiClient } from '../../services/apiClient';
import { ApiEndpoints } from '../../constants/api';
import { RestaurantSummary } from '../../models/food';

interface FoodHomeScreenProps {
  navigation: any;
}

const DEFAULT_RESTAURANTS: RestaurantSummary[] = [
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
  const [searchQuery, setSearchQuery] = useState('');
  const [restaurants, setRestaurants] = useState<RestaurantSummary[]>(DEFAULT_RESTAURANTS);

  useEffect(() => {
    // Attempt backend fetch; defaults gracefully to seeded data
    apiClient
      .get<any>(ApiEndpoints.food.restaurants)
      .then((res) => {
        if (res.data?.items && res.data.items.length > 0) {
          setRestaurants(res.data.items);
        }
      })
      .catch(() => {
        // Safe offline default
      });
  }, []);

  const filteredRestaurants = restaurants.filter((r) => {
    if (filterVegOnly && !r.isVeg) return false;
    if (filterRating4Plus && r.rating < 4.5) return false;
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase();
      const matchName = r.name.toLowerCase().includes(q);
      const matchCuisine = (r.cuisines || '').toLowerCase().includes(q);
      if (!matchName && !matchCuisine) return false;
    }
    return true;
  });

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
            <Text style={styles.avatarInitials}>JD</Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchWrapper}>
          <AppSearchBar
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
          <TouchableOpacity style={styles.filterChip} activeOpacity={0.8}>
            <Ionicons name="flash" size={14} color={AppColors.textSecondary} style={styles.chipIcon} />
            <Text style={styles.filterChipText}>Fast Delivery</Text>
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
          <TouchableOpacity style={styles.filterChip} activeOpacity={0.8}>
            <Ionicons name="pricetag" size={14} color={AppColors.textSecondary} style={styles.chipIcon} />
            <Text style={styles.filterChipText}>Offers</Text>
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
            POPULAR SPOTS NEAR YOU ({filteredRestaurants.length})
          </Text>
          <Text style={styles.sortByText}>Sort by ▼</Text>
        </View>

        {/* Restaurant Cards */}
        {filteredRestaurants.map((restaurant) => (
          <TouchableOpacity
            key={restaurant.id}
            style={styles.restaurantCard}
            activeOpacity={0.9}
            onPress={() =>
              navigation.navigate('RestaurantDetail', {
                restaurantId: restaurant.id.toString(),
              })
            }
          >
            {/* Image Header with overlays */}
            <View style={styles.imageHeader}>
              <Image
                source={{ uri: restaurant.imageUrl }}
                style={styles.restaurantImage}
                resizeMode="cover"
              />
              <LinearGradient
                colors={['transparent', 'rgba(0, 0, 0, 0.75)']}
                style={StyleSheet.absoluteFill}
              />

              {/* Delivery Time Badge */}
              <View style={styles.deliveryTimeBadge}>
                <Ionicons name="time" size={13} color="#FFFFFF" />
                <Text style={styles.deliveryTimeText}>
                  {restaurant.avgDeliveryTimeMinutes || 20} mins
                </Text>
              </View>

              {/* Pure Veg Tag */}
              {restaurant.isVeg && (
                <View style={styles.pureVegTag}>
                  <Ionicons name="leaf" size={12} color="#FFFFFF" />
                  <Text style={styles.pureVegTagText}>PURE VEG</Text>
                </View>
              )}

              {/* Offer Banner */}
              <View style={styles.offerBanner}>
                <Ionicons name="pricetag" size={12} color="#FFFFFF" />
                <Text style={styles.offerBannerText}>
                  {restaurant.offerText || '60% OFF UPTO ₹120'}
                </Text>
              </View>
            </View>

            {/* Restaurant Info */}
            <View style={styles.infoSection}>
              <View style={styles.nameRatingRow}>
                <Text style={styles.restaurantName} numberOfLines={1}>
                  {restaurant.name}
                </Text>
                <RatingBadge rating={restaurant.rating} />
              </View>

              <Text style={styles.cuisinesText} numberOfLines={1}>
                {restaurant.cuisines}
              </Text>

              <View style={styles.bottomInfoRow}>
                <Text style={styles.priceForTwoText}>
                  {restaurant.addressLine || '₹500 for two • 1.8 km'}
                </Text>
                <View style={styles.viewMenuLink}>
                  <Text style={styles.viewMenuText}>View Menu</Text>
                  <Ionicons name="arrow-forward" size={13} color={AppColors.primary} />
                </View>
              </View>
            </View>
          </TouchableOpacity>
        ))}
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
