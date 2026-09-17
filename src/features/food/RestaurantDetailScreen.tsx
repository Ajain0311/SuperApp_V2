import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { AppColors } from '../../theme/colors';
import { AppRadius } from '../../theme/spacing';
import { AppConstants } from '../../constants/app';
import { RatingBadge } from '../../components/common/RatingBadge';
import { VegBadge } from '../../components/common/VegBadge';
import { ItemCustomizationSheet } from './ItemCustomizationSheet';
import { CartSummarySheet } from './CartSummarySheet';
import { useCartStore } from '../../store/cartStore';
import { CartItem } from '../../models/food';
import { apiClient } from '../../services/apiClient';
import { ApiEndpoints } from '../../constants/api';

interface RestaurantDetailScreenProps {
  route: {
    params: {
      restaurantId: string;
    };
  };
  navigation: any;
}

interface FoodItemRow {
  id: number;
  name: string;
  category: string;
  price: number;
  description: string;
  isVeg: boolean;
  isBestseller: boolean;
  isCustomizable: boolean;
  image: string;
}

const MENU_CATEGORIES = ['All', 'Biryani Specials', 'Starters', 'Desserts'];

const FOOD_ITEMS: FoodItemRow[] = [
  {
    id: 1,
    name: 'Meghana Special Chicken Biryani',
    category: 'Biryani Specials',
    price: 340.0,
    description:
      'Fragrant Basmati rice topped with boneless spiced chicken marinated in Andhra green chili paste.',
    isVeg: false,
    isBestseller: true,
    isCustomizable: true,
    image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=300',
  },
  {
    id: 2,
    name: 'Paneer 65 Biryani (Dum Style)',
    category: 'Biryani Specials',
    price: 290.0,
    description: 'Spiced golden paneer cubes layered with saffron long grain basmati rice.',
    isVeg: true,
    isBestseller: true,
    isCustomizable: true,
    image: 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=300',
  },
  {
    id: 3,
    name: 'Crispy Boneless Chicken 65',
    category: 'Starters',
    price: 310.0,
    description:
      'Tender chicken bites tossed with south curry leaves, mustard seeds, and Andhra red chili glaze.',
    isVeg: false,
    isBestseller: true,
    isCustomizable: false,
    image: 'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?w=300',
  },
  {
    id: 4,
    name: 'Apollo Fish Fry',
    category: 'Starters',
    price: 360.0,
    description: 'Flaky fillets fried crisp and tossed in spiced yogurt seasoning.',
    isVeg: false,
    isBestseller: false,
    isCustomizable: false,
    image: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=300',
  },
  {
    id: 5,
    name: 'Gulab Jamun with Rabri',
    category: 'Desserts',
    price: 110.0,
    description: 'Warm reduced milk dumplings served with chilled saffron rabri.',
    isVeg: true,
    isBestseller: false,
    isCustomizable: false,
    image: 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?w=300',
  },
];

export const RestaurantDetailScreen: React.FC<RestaurantDetailScreenProps> = ({
  route,
  navigation,
}) => {
  const [selectedCategoryIndex, setSelectedCategoryIndex] = useState(0);
  const [activeItemForCustomization, setActiveItemForCustomization] = useState<FoodItemRow | null>(null);
  const [isCartVisible, setIsCartVisible] = useState(false);
  const [restaurantName, setRestaurantName] = useState('Meghana Foods (Special Biryani)');
  const [foodItems, setFoodItems] = useState<FoodItemRow[]>(FOOD_ITEMS);
  const [menuCategories, setMenuCategories] = useState<string[]>(MENU_CATEGORIES);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);

  const cartItems = useCartStore((state) => state.items);
  const addItemToCart = useCartStore((state) => state.addItem);
  const clearCart = useCartStore((state) => state.clearCart);
  const getItemTotal = useCartStore((state) => state.getItemTotal);

  useEffect(() => {
    const rId = Number(route.params?.restaurantId) || 1;
    apiClient
      .get<any>(ApiEndpoints.food.restaurantDetail(rId))
      .then((res) => {
        const data = res.data?.data || res.data;
        if (data) {
          if (data.name) setRestaurantName(data.name);
          if (data.items && data.items.length > 0) {
            const mapped: FoodItemRow[] = data.items.map((it: any) => ({
              id: it.id,
              name: it.name,
              category: it.category || 'Specials',
              price: it.discountedPrice || it.price,
              description: it.description || '',
              isVeg: Boolean(it.isVeg),
              isBestseller: Boolean(it.isBestseller),
              isCustomizable: Boolean(it.variants?.length || it.addons?.length),
              image: it.imageUrl || 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=300',
            }));
            setFoodItems(mapped);
            const cats = ['All', ...Array.from(new Set(mapped.map((m: FoodItemRow) => m.category)))];
            setMenuCategories(cats as string[]);
          }
        }
      })
      .catch(() => {
        // Safe offline default
      });
  }, [route.params?.restaurantId]);

  const filteredItems =
    selectedCategoryIndex === 0
      ? foodItems
      : foodItems.filter((f) => f.category === menuCategories[selectedCategoryIndex]);

  const handlePlaceOrder = async () => {
    setIsPlacingOrder(true);
    try {
      const restId = Number(route.params?.restaurantId) || 1;
      const payload = {
        restaurantId: restId,
        items: cartItems.map((c) => ({
          foodItemId: c.foodItemId,
          quantity: c.quantity,
          variantId: null,
          selectedAddonIds: [],
        })),
        addressId: null,
        paymentMethod: 'CASH_ON_DELIVERY',
        deliveryInstructions: 'Leave at front door',
      };
      const res = await apiClient.post<any>(ApiEndpoints.food.orders, payload);
      const data = res.data?.data || res.data;
      const orderId = data?.orderNumber || `FO-${Math.floor(1000 + Math.random() * 9000)}`;
      const orderNumericId = data?.id;
      clearCart();
      setIsCartVisible(false);
      navigation.navigate('FoodOrderTracking', { orderId, orderNumericId });
    } catch (err) {
      // Graceful offline fallback
      const fallbackId = `FO-${Math.floor(1000 + Math.random() * 9000)}`;
      clearCart();
      setIsCartVisible(false);
      navigation.navigate('FoodOrderTracking', { orderId: fallbackId });
    } finally {
      setIsPlacingOrder(false);
    }
  };

  const handleAddItem = (item: FoodItemRow) => {
    if (item.isCustomizable) {
      setActiveItemForCustomization(item);
    } else {
      const cartItem: CartItem = {
        id: Date.now(),
        foodItemId: item.id,
        name: item.name,
        basePrice: item.price,
        quantity: 1,
        addons: [],
        totalPrice: item.price,
      };
      addItemToCart(1, restaurantName, cartItem);
    }
  };

  const handleCustomizationComplete = (
    quantity: number,
    portionName: string,
    portionPrice: number,
    addons: string[],
    grandTotal: number
  ) => {
    if (!activeItemForCustomization) return;
    const cartItem: CartItem = {
      id: Date.now(),
      foodItemId: activeItemForCustomization.id,
      name: activeItemForCustomization.name,
      basePrice: activeItemForCustomization.price,
      quantity,
      portionName,
      portionPrice,
      addons,
      totalPrice: grandTotal,
    };
    addItemToCart(1, restaurantName, cartItem);
    setActiveItemForCustomization(null);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header Bar */}
      <View style={styles.appBar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          activeOpacity={0.8}
        >
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.titleCol}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {restaurantName}
          </Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            Biryani • Hyderabadi • Andhra • Kebabs • ₹500 for two • 22m
          </Text>
        </View>

        <RatingBadge rating={4.6} />
      </View>

      <View style={styles.contentContainer}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Search Dishes */}
          <View style={styles.searchBarBox}>
            <Ionicons name="search-outline" size={18} color={AppColors.textTertiary} style={styles.searchIcon} />
            <Text style={styles.searchPlaceholder}>Search dishes...</Text>
          </View>

          {/* Category Pills */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesRow}
          >
            {MENU_CATEGORIES.map((cat, idx) => {
              const isSelected = idx === selectedCategoryIndex;
              return (
                <TouchableOpacity
                  key={idx}
                  style={[styles.categoryPill, isSelected ? styles.categoryPillActive : null]}
                  onPress={() => setSelectedCategoryIndex(idx)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[styles.categoryText, isSelected ? styles.categoryTextActive : null]}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Dishes List */}
          {filteredItems.map((item) => (
            <View key={item.id} style={styles.dishCard}>
              {/* Left Details */}
              <View style={styles.dishDetails}>
                <View style={styles.badgesRow}>
                  <VegBadge isVeg={item.isVeg} size={15} />
                  {item.isBestseller && (
                    <View style={styles.bestsellerTag}>
                      <Text style={styles.bestsellerText}>BESTSELLER</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.dishName}>{item.name}</Text>
                <Text style={styles.dishPrice}>
                  {AppConstants.currency}
                  {item.price.toFixed(0)}
                </Text>
                <Text style={styles.dishDesc} numberOfLines={2}>
                  {item.description}
                </Text>
              </View>

              {/* Right Image + Add Button */}
              <View style={styles.dishActionCol}>
                <Image source={{ uri: item.image }} style={styles.dishImage} />
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={() => handleAddItem(item)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.addButtonText}>ADD +</Text>
                </TouchableOpacity>
                {item.isCustomizable && (
                  <Text style={styles.customizableLabel}>CUSTOMISABLE</Text>
                )}
              </View>
            </View>
          ))}

          {/* Bottom spacing for floating cart */}
          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Floating Cart Bar */}
        {cartItems.length > 0 && (
          <View style={styles.floatingCartContainer}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => setIsCartVisible(true)}
              style={styles.floatingCartTouch}
            >
              <LinearGradient
                colors={[AppColors.primary, AppColors.primaryDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.floatingCartGradient}
              >
                <View>
                  <Text style={styles.cartItemsCount}>
                    {cartItems.length} ITEM{cartItems.length > 1 ? 'S' : ''}
                  </Text>
                  <Text style={styles.cartTotalAmount}>
                    {AppConstants.currency}
                    {getItemTotal().toFixed(0)} plus taxes
                  </Text>
                </View>

                <View style={styles.viewCartRight}>
                  <Text style={styles.viewCartText}>View Cart</Text>
                  <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Item Customization Modal */}
      {activeItemForCustomization && (
        <ItemCustomizationSheet
          visible={Boolean(activeItemForCustomization)}
          itemName={activeItemForCustomization.name}
          basePrice={activeItemForCustomization.price}
          onClose={() => setActiveItemForCustomization(null)}
          onAddToCart={handleCustomizationComplete}
        />
      )}

      {/* Cart Summary Modal */}
      <CartSummarySheet
        visible={isCartVisible}
        onClose={() => setIsCartVisible(false)}
        restaurantName={restaurantName}
        cartItems={cartItems}
        onClear={clearCart}
        isSubmitting={isPlacingOrder}
        onOrderPlaced={handlePlaceOrder}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.border,
  },
  backButton: {
    padding: 6,
    marginRight: 8,
  },
  titleCol: {
    flex: 1,
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: AppColors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 11,
    color: AppColors.textSecondary,
    marginTop: 2,
  },
  contentContainer: {
    flex: 1,
    position: 'relative',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  searchBarBox: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.surfaceLight,
    borderRadius: AppRadius.md,
    borderWidth: 1,
    borderColor: AppColors.border,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchPlaceholder: {
    color: AppColors.textHint,
    fontSize: 13,
  },
  categoriesRow: {
    paddingRight: 16,
    marginBottom: 18,
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
  categoryText: {
    color: AppColors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  categoryTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  dishCard: {
    flexDirection: 'row',
    backgroundColor: AppColors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: AppColors.border,
    padding: 16,
    marginBottom: 14,
  },
  dishDetails: {
    flex: 1,
    marginRight: 14,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  bestsellerTag: {
    backgroundColor: `${AppColors.yellow}33`,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
  },
  bestsellerText: {
    color: AppColors.yellow,
    fontSize: 9,
    fontWeight: '800',
  },
  dishName: {
    fontSize: 15,
    fontWeight: '700',
    color: AppColors.textPrimary,
    marginBottom: 4,
  },
  dishPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: AppColors.textPrimary,
    marginBottom: 6,
  },
  dishDesc: {
    fontSize: 12,
    color: AppColors.textSecondary,
    lineHeight: 16,
  },
  dishActionCol: {
    alignItems: 'center',
  },
  dishImage: {
    width: 96,
    height: 84,
    borderRadius: 14,
    backgroundColor: AppColors.surfaceLight,
    marginBottom: 8,
  },
  addButton: {
    width: 96,
    height: 36,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: AppColors.primary,
    backgroundColor: AppColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    color: AppColors.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  customizableLabel: {
    color: AppColors.textTertiary,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: 3,
  },
  floatingCartContainer: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
  },
  floatingCartTouch: {
    borderRadius: 16,
    shadowColor: AppColors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 18,
    elevation: 8,
  },
  floatingCartGradient: {
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cartItemsCount: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  cartTotalAmount: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  viewCartRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewCartText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    marginRight: 4,
  },
});
