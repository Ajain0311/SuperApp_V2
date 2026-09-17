import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  SafeAreaView,
  StatusBar,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { AppSearchBar } from '../../components/common/AppSearchBar';
import { useMarketplaceStore } from '../../store/marketplaceStore';
import { ListingSummary, MarketplaceCategory } from '../../models/marketplace';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

const CATEGORIES: MarketplaceCategory[] = [
  { id: 0, name: 'All' },
  { id: 1, name: 'Mobiles' },
  { id: 2, name: 'Vehicles' },
  { id: 3, name: 'Electronics' },
  { id: 4, name: 'Furniture' },
  { id: 5, name: 'Fashion' },
  { id: 6, name: 'Books' },
  { id: 7, name: 'Sports' },
  { id: 8, name: 'Others' },
];

const QUICK_FILTERS = ['All', 'Featured', 'Under ₹10k', 'Like New'];

export const MarketplaceHomeScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState(0);
  const [selectedFilter, setSelectedFilter] = useState('All');

  const { customListings, favorites, toggleFavorite } = useMarketplaceStore();

  const initialListings: ListingSummary[] = useMemo(() => [
    {
      id: 101,
      title: 'iPhone 14 Pro Max 256GB Deep Purple (Like New)',
      price: 68000,
      condition: 'LIKE_NEW',
      location: 'Koramangala, Bengaluru',
      primaryImageUrl: 'https://images.unsplash.com/photo-1591337676887-a217a6970a8a?w=500',
      isFeatured: true,
      viewCount: 142,
      createdAt: new Date().toISOString(),
      categoryId: 1,
      categoryName: 'Mobiles',
      isFavorite: false,
    },
    {
      id: 102,
      title: 'Royal Enfield Classic 350 (2022 Stealth Black)',
      price: 145000,
      condition: 'USED',
      location: 'Indiranagar, Bengaluru',
      primaryImageUrl: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=500',
      isFeatured: true,
      viewCount: 310,
      createdAt: new Date().toISOString(),
      categoryId: 2,
      categoryName: 'Vehicles',
      isFavorite: true,
    },
    {
      id: 103,
      title: 'Sony PlayStation 5 Disc Edition + 2 Controllers',
      price: 38500,
      condition: 'LIKE_NEW',
      location: 'HSR Layout, Bengaluru',
      primaryImageUrl: 'https://images.unsplash.com/photo-1606813907291-d86efa9b94db?w=500',
      isFeatured: false,
      viewCount: 98,
      createdAt: new Date().toISOString(),
      categoryId: 3,
      categoryName: 'Electronics',
      isFavorite: false,
    },
    {
      id: 104,
      title: 'Solid Sheesham Teak Wood 6-Seater Dining Table',
      price: 22000,
      condition: 'USED',
      location: 'Whitefield, Bengaluru',
      primaryImageUrl: 'https://images.unsplash.com/photo-1617806118233-18e1de247200?w=500',
      isFeatured: false,
      viewCount: 74,
      createdAt: new Date().toISOString(),
      categoryId: 4,
      categoryName: 'Furniture',
      isFavorite: false,
    },
    {
      id: 105,
      title: 'Canon EOS 200D II DSLR with 18-55mm IS STM Lens',
      price: 32000,
      condition: 'LIKE_NEW',
      location: 'Jayanagar, Bengaluru',
      primaryImageUrl: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=500',
      isFeatured: false,
      viewCount: 112,
      createdAt: new Date().toISOString(),
      categoryId: 3,
      categoryName: 'Electronics',
      isFavorite: false,
    },
    {
      id: 106,
      title: 'Zara Genuine Leather Biker Jacket (Black - Size M)',
      price: 3999,
      condition: 'NEW',
      location: 'MG Road, Bengaluru',
      primaryImageUrl: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=500',
      isFeatured: false,
      viewCount: 65,
      createdAt: new Date().toISOString(),
      categoryId: 5,
      categoryName: 'Fashion',
      isFavorite: false,
    },
  ], []);

  const allListings = useMemo(() => {
    return [...customListings, ...initialListings];
  }, [customListings, initialListings]);

  const filteredListings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allListings.filter((item) => {
      const matchesCategory = selectedCategoryId === 0 || item.categoryId === selectedCategoryId;
      const matchesQuery =
        !q ||
        item.title.toLowerCase().includes(q) ||
        (item.location && item.location.toLowerCase().includes(q));

      let matchesFilter = true;
      if (selectedFilter === 'Featured') {
        matchesFilter = item.isFeatured;
      } else if (selectedFilter === 'Under ₹10k') {
        matchesFilter = item.price <= 10000;
      } else if (selectedFilter === 'Like New') {
        matchesFilter = item.condition === 'LIKE_NEW' || item.condition === 'NEW';
      }

      return matchesCategory && matchesQuery && matchesFilter;
    });
  }, [allListings, searchQuery, selectedCategoryId, selectedFilter]);

  const getCategoryIcon = (name: string): keyof typeof MaterialIcons.glyphMap => {
    switch (name) {
      case 'Mobiles': return 'phone-iphone';
      case 'Vehicles': return 'two-wheeler';
      case 'Electronics': return 'laptop-mac';
      case 'Furniture': return 'chair';
      case 'Fashion': return 'checkroom';
      case 'Books': return 'menu-book';
      case 'Sports': return 'fitness-center';
      case 'Others': return 'category';
      default: return 'grid-view';
    }
  };

  const getConditionColor = (cond: string) => {
    switch (cond?.toUpperCase()) {
      case 'NEW': return colors.blue;
      case 'LIKE_NEW': return colors.secondary;
      case 'USED': return colors.primary;
      default: return colors.textSecondary;
    }
  };

  const formatConditionText = (cond: string) => {
    switch (cond?.toUpperCase()) {
      case 'LIKE_NEW': return 'LIKE NEW';
      case 'NEW': return 'BRAND NEW';
      case 'USED': return 'GENTLY USED';
      default: return cond;
    }
  };

  const renderProductCard = ({ item }: { item: ListingSummary }) => {
    const isFav = favorites.includes(item.id) || item.isFavorite;
    const condColor = getConditionColor(item.condition);

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        style={[
          styles.productCard,
          item.isFeatured && styles.productCardFeatured,
        ]}
        onPress={() => navigation.navigate('ListingDetail', { listingId: String(item.id) })}
      >
        <View style={styles.imageWrapper}>
          <Image
            source={{ uri: item.primaryImageUrl || undefined }}
            style={styles.productImage}
            resizeMode="cover"
          />
          {item.isFeatured && (
            <View style={styles.featuredRibbon}>
              <Text style={styles.featuredRibbonText}>FEATURED</Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.heartButton}
            onPress={() => toggleFavorite(item.id)}
          >
            <MaterialIcons
              name={isFav ? 'favorite' : 'favorite-border'}
              size={16}
              color={isFav ? colors.error : '#FFFFFF'}
            />
          </TouchableOpacity>

          <View style={[styles.conditionBadge, { borderColor: `${condColor}80` }]}>
            <Text style={[styles.conditionBadgeText, { color: condColor }]}>
              {formatConditionText(item.condition)}
            </Text>
          </View>
        </View>

        <View style={styles.cardContent}>
          <View>
            <Text style={styles.productPrice}>₹{item.price.toFixed(0)}</Text>
            <Text numberOfLines={2} style={styles.productTitle}>
              {item.title}
            </Text>
          </View>

          <View style={styles.locationRow}>
            <MaterialIcons name="location-on" size={12} color={colors.textTertiary} />
            <Text numberOfLines={1} style={styles.locationText}>
              {item.location || 'Bangalore'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <View style={styles.tagRow}>
            <View style={styles.bazaarBadge}>
              <Text style={styles.bazaarBadgeText}>SUPER BAZAAR</Text>
            </View>
            <MaterialIcons name="verified-user" size={14} color={colors.secondary} />
            <Text style={styles.verifiedText}>Verified Local Sellers</Text>
          </View>
          <Text style={styles.titleText}>Community Marketplace</Text>
        </View>

        <TouchableOpacity
          style={styles.shieldButton}
          onPress={() => Alert.alert('Safety & Trust', 'Safety tip: Always meet sellers in well-lit public spots!')}
        >
          <MaterialIcons name="security" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <AppSearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search pre-loved phones, bikes, sofas..."
          onClear={() => setSearchQuery('')}
        />
      </View>

      {/* Category Horizontal Carousel */}
      <View style={styles.categoriesSection}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesList}
          data={CATEGORIES}
          keyExtractor={(c) => String(c.id)}
          renderItem={({ item }) => {
            const isSelected = item.id === selectedCategoryId;
            return (
              <TouchableOpacity
                style={[
                  styles.categoryPill,
                  isSelected && styles.categoryPillSelected,
                ]}
                onPress={() => setSelectedCategoryId(item.id)}
              >
                <MaterialIcons
                  name={getCategoryIcon(item.name)}
                  size={16}
                  color={isSelected ? '#FFFFFF' : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.categoryText,
                    isSelected && styles.categoryTextSelected,
                  ]}
                >
                  {item.name}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* Quick Filter Chips */}
      <View style={styles.filtersSection}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersList}
          data={QUICK_FILTERS}
          keyExtractor={(f) => f}
          renderItem={({ item }) => {
            const isSelected = selectedFilter === item;
            return (
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  isSelected && styles.filterChipSelected,
                ]}
                onPress={() => setSelectedFilter(item)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    isSelected && styles.filterChipTextSelected,
                  ]}
                >
                  {item}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* Product Grid */}
      <FlatList
        data={filteredListings}
        keyExtractor={(item) => String(item.id)}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.gridContent}
        renderItem={renderProductCard}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <MaterialIcons name="search-off" size={48} color={colors.textTertiary} />
            </View>
            <Text style={styles.emptyTitle}>No items found</Text>
            <Text style={styles.emptySubtitle}>
              Try changing keywords or clearing the category filter
            </Text>
            <TouchableOpacity
              style={styles.resetButton}
              onPress={() => {
                setSearchQuery('');
                setSelectedCategoryId(0);
                setSelectedFilter('All');
              }}
            >
              <Text style={styles.resetButtonText}>Reset All Filters</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* Sell Item FAB */}
      <TouchableOpacity
        activeOpacity={0.85}
        style={styles.fab}
        onPress={() => navigation.navigate('AddListing')}
      >
        <MaterialIcons name="camera-alt" size={20} color="#FFFFFF" />
        <Text style={styles.fabText}>Sell Item</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bazaarBadge: {
    backgroundColor: 'rgba(255, 107, 53, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.3)',
  },
  bazaarBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.8,
  },
  verifiedText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  titleText: {
    ...typography.h2,
    color: colors.textPrimary,
    fontWeight: '800',
    marginTop: 4,
  },
  shieldButton: {
    padding: spacing.xs,
  },
  searchContainer: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  categoriesSection: {
    marginTop: spacing.sm,
    height: 44,
  },
  categoriesList: {
    paddingHorizontal: spacing.md,
    gap: 8,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardDark,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  categoryPillSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryText: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  categoryTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  filtersSection: {
    marginTop: 6,
    marginBottom: spacing.xs,
  },
  filtersList: {
    paddingHorizontal: spacing.md,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    backgroundColor: 'transparent',
  },
  filterChipSelected: {
    backgroundColor: colors.surfaceLight,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  filterChipTextSelected: {
    color: colors.primary,
    fontWeight: '700',
  },
  gridContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: 90,
  },
  gridRow: {
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  productCard: {
    width: '48%',
    backgroundColor: colors.cardDark,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  productCardFeatured: {
    borderColor: 'rgba(255, 107, 53, 0.5)',
    borderWidth: 1.5,
  },
  imageWrapper: {
    width: '100%',
    aspectRatio: 1.15,
    position: 'relative',
    backgroundColor: colors.surfaceLight,
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  featuredRibbon: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  featuredRibbonText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  heartButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(10, 14, 33, 0.7)',
    borderRadius: 16,
    padding: 6,
  },
  conditionBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(10, 14, 33, 0.85)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  conditionBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  cardContent: {
    padding: 10,
    minHeight: 85,
    justifyContent: 'space-between',
  },
  productPrice: {
    ...typography.h3,
    color: colors.primary,
    fontWeight: '800',
  },
  productTitle: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: '600',
    marginTop: 3,
    lineHeight: 16,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 6,
  },
  locationText: {
    fontSize: 10,
    color: colors.textTertiary,
    flex: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    marginTop: spacing.xl,
  },
  emptyIconCircle: {
    padding: 20,
    borderRadius: 50,
    backgroundColor: colors.surfaceLight,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  emptySubtitle: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: spacing.md,
  },
  resetButton: {
    backgroundColor: colors.surfaceLight,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: spacing.radiusMd,
  },
  resetButtonText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '700',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 28,
    gap: 8,
    elevation: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  fabText: {
    ...typography.bodyMedium,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
});
