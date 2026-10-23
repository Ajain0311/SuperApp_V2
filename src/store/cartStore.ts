import { create } from 'zustand';
import { CartItem } from '../models/food';

export const getCartLineKey = (item: {
  foodItemId: number;
  variantId?: number | null;
  selectedAddonIds?: number[];
  cartLineKey?: string;
  restaurantId?: number | null;
}): string => {
  if (item.cartLineKey && item.cartLineKey.length > 0) {
    return item.cartLineKey;
  }
  const restaurant = item.restaurantId != null ? String(item.restaurantId) : '';
  const variant = item.variantId !== undefined && item.variantId !== null ? String(item.variantId) : '';
  const addons = (item.selectedAddonIds || []).slice().sort((a, b) => a - b).join(',');
  return `${restaurant}-${item.foodItemId}-${variant}-${addons}`;
};

interface CartState {
  /** Primary restaurant for UI; null when empty. Multi-hotel carts still set this to last-added. */
  restaurantId: number | null;
  restaurantName: string;
  items: CartItem[];

  addItem: (restaurantId: number, restaurantName: string, item: CartItem) => void;
  updateQuantity: (target: string | number, delta: number) => void;
  updateLineQuantity: (lineKey: string, delta: number) => void;
  getItemQuantity: (foodItemId: number) => number;
  getLineQuantity: (target: string | { foodItemId: number; variantId?: number | null; selectedAddonIds?: number[]; restaurantId?: number }) => number;
  removeItem: (index: number) => void;
  clearCart: () => void;
  getRestaurantIds: () => number[];
  getItemsByRestaurant: () => Record<number, CartItem[]>;

  getItemTotal: () => number;
  getDeliveryFee: () => number;
  getTaxesAndPackaging: () => number;
  getGrandTotal: () => number;
}

const syncPrimaryRestaurant = (items: CartItem[]): { restaurantId: number | null; restaurantName: string } => {
  if (items.length === 0) return { restaurantId: null, restaurantName: '' };
  const last = items[items.length - 1];
  return {
    restaurantId: last.restaurantId ?? null,
    restaurantName: last.restaurantName ?? '',
  };
};

export const useCartStore = create<CartState>((set, get) => ({
  restaurantId: null,
  restaurantName: '',
  items: [],

  addItem: (restaurantId: number, restaurantName: string, item: CartItem) => {
    const state = get();
    const tagged: CartItem = {
      ...item,
      restaurantId,
      restaurantName,
    };
    const lineKey = getCartLineKey(tagged);
    tagged.cartLineKey = lineKey;

    const existingIndex = state.items.findIndex((i) => getCartLineKey({ ...i, restaurantId: i.restaurantId ?? restaurantId }) === lineKey);

    if (existingIndex > -1) {
      const updated = [...state.items];
      const existing = { ...updated[existingIndex] };
      const newQty = existing.quantity + item.quantity;
      const unitPrice = existing.totalPrice / existing.quantity;
      existing.quantity = newQty;
      existing.totalPrice = Math.round(unitPrice * newQty * 100) / 100;
      existing.cartLineKey = lineKey;
      existing.restaurantId = restaurantId;
      existing.restaurantName = restaurantName;
      updated[existingIndex] = existing;
      const primary = syncPrimaryRestaurant(updated);
      set({ items: updated, ...primary });
    } else {
      const items = [...state.items, tagged];
      const primary = syncPrimaryRestaurant(items);
      set({ items, ...primary });
    }
  },

  getRestaurantIds: () => {
    const ids = new Set<number>();
    for (const item of get().items) {
      if (item.restaurantId != null) ids.add(item.restaurantId);
    }
    return Array.from(ids);
  },

  getItemsByRestaurant: () => {
    const map: Record<number, CartItem[]> = {};
    for (const item of get().items) {
      const rid = item.restaurantId;
      if (rid == null) continue;
      if (!map[rid]) map[rid] = [];
      map[rid].push(item);
    }
    return map;
  },

  getItemQuantity: (foodItemId: number) => {
    const items = get().items.filter((i) => i.foodItemId === foodItemId);
    return items.reduce((sum, item) => sum + item.quantity, 0);
  },

  getLineQuantity: (target) => {
    const lineKey = typeof target === 'string' ? target : getCartLineKey(target);
    const match = get().items.find((i) => getCartLineKey(i) === lineKey);
    return match ? match.quantity : 0;
  },

  updateLineQuantity: (lineKey: string, delta: number) => {
    get().updateQuantity(lineKey, delta);
  },

  updateQuantity: (target: string | number, delta: number) => {
    const state = get();
    let existingIndex = -1;

    if (typeof target === 'string') {
      existingIndex = state.items.findIndex((i) => getCartLineKey(i) === target);
    } else {
      existingIndex = state.items.findIndex((i) => i.id === target);
      if (existingIndex === -1) {
        existingIndex = state.items.findIndex((i) => i.foodItemId === target);
      }
    }

    if (existingIndex === -1) return;

    const items = [...state.items];
    const item = { ...items[existingIndex] };
    const newQty = item.quantity + delta;

    if (newQty <= 0) {
      items.splice(existingIndex, 1);
    } else {
      const unitPrice = item.totalPrice / item.quantity;
      item.quantity = newQty;
      item.totalPrice = Math.round(unitPrice * newQty * 100) / 100;
      items[existingIndex] = item;
    }

    if (items.length === 0) {
      set({ items: [], restaurantId: null, restaurantName: '' });
    } else {
      set({ items, ...syncPrimaryRestaurant(items) });
    }
  },

  removeItem: (index: number) => {
    const items = [...get().items];
    items.splice(index, 1);
    if (items.length === 0) {
      set({ items: [], restaurantId: null, restaurantName: '' });
    } else {
      set({ items, ...syncPrimaryRestaurant(items) });
    }
  },

  clearCart: () => {
    set({ items: [], restaurantId: null, restaurantName: '' });
  },

  getItemTotal: () => {
    return get().items.reduce((sum, item) => sum + item.totalPrice, 0);
  },

  getDeliveryFee: () => {
    return 0;
  },

  getTaxesAndPackaging: () => {
    const itemTotal = get().getItemTotal();
    return Math.round(itemTotal * 0.05 * 100) / 100;
  },

  getGrandTotal: () => {
    const itemTotal = get().getItemTotal();
    if (itemTotal === 0) return 0;
    const deliveryFee = get().getDeliveryFee();
    const taxes = get().getTaxesAndPackaging();
    return Math.round((itemTotal + deliveryFee + taxes) * 100) / 100;
  },
}));
