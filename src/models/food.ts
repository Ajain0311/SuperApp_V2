export interface RestaurantSummary {
  id: number;
  name: string;
  description?: string;
  imageUrl?: string;
  addressLine?: string;
  city?: string;
  rating: number;
  totalRatings: number;
  isVeg: boolean;
  minOrderAmount: number;
  deliveryFee: number;
  avgDeliveryTimeMinutes: number;
  isFeatured: boolean;
  cuisines?: string;
  offerText?: string;
}

export interface FoodItemVariant {
  id: number;
  name: string;
  additionalPrice: number;
  isDefault: boolean;
}

export interface FoodItemAddon {
  id: number;
  groupName: string;
  name: string;
  price: number;
  isDefault: boolean;
  selected?: boolean;
}

export interface FoodItem {
  id: number;
  restaurantId: number;
  restaurantCategoryId: number;
  name: string;
  description?: string;
  imageUrl?: string;
  basePrice: number;
  discountPercent?: number;
  discountedPrice: number;
  isVeg: boolean;
  isAvailable: boolean;
  isBestseller: boolean;
  isCustomizable: boolean;
  variants: FoodItemVariant[];
  addons: FoodItemAddon[];
}

export interface RestaurantCategory {
  id: number;
  name: string;
  description?: string;
  sortOrder: number;
  items: FoodItem[];
}

export interface RestaurantDetail {
  id: number;
  name: string;
  description?: string;
  imageUrl?: string;
  addressLine?: string;
  city?: string;
  rating: number;
  totalRatings: number;
  isVeg: boolean;
  minOrderAmount: number;
  deliveryFee: number;
  avgDeliveryTimeMinutes: number;
  isFeatured: boolean;
  openingTime?: string;
  closingTime?: string;
  categories: RestaurantCategory[];
}

export interface CartItem {
  id: number;
  foodItemId: number;
  name: string;
  basePrice: number;
  quantity: number;
  portionName?: string;
  portionPrice?: number;
  addons: string[];
  totalPrice: number;
}

export interface PlaceFoodOrderRequest {
  restaurantId: number;
  addressId?: number;
  couponCode?: string;
  paymentMethod: string;
  notes?: string;
  items: {
    foodItemId: number;
    quantity: number;
    variantId?: number;
    selectedAddonIds?: number[];
  }[];
}

export interface FoodOrderItemDto {
  id: number;
  foodItemId: number;
  itemName: string;
  quantity: number;
  unitPrice: number;
  variantName?: string;
  variantPrice?: number;
  addonsSummary?: string;
  totalPrice: number;
}

export interface FoodOrderDto {
  id: number;
  orderNumber: string;
  restaurantId: number;
  restaurantName: string;
  restaurantImageUrl?: string;
  status: string;
  subTotal: number;
  discountAmount: number;
  couponDiscount: number;
  deliveryFee: number;
  taxAmount: number;
  grandTotal: number;
  paymentMethod: string;
  paymentStatus: string;
  notes?: string;
  estimatedDeliveryMinutes: number;
  createdAt: string;
  items: FoodOrderItemDto[];
}
