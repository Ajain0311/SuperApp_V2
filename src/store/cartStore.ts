import { create } from 'zustand';
import { CartItem } from '../models/food';

export const getCartLineKey = (item: {
  foodItemId: number;
  variantId?: number | null;
  selectedAddonIds?: number[];
  cartLineKey?: string;
}): string => {
  if (item.cartLineKey && item.cartLineKey.length > 0) {
    return item.cartLineKey;
  }
  const variant = item.variantId !== undefined && item.variantId !== null ? String(item.variantId) : '';
  const addons = (item.selectedAddonIds || []).slice().sort((a, b) => a - b).join(',');
  return `${item.foodItemId}-${variant}-${addons}`;
};

interface CartState {
  restaurantId: number | null;
  restaurantName: string;
  items: CartItem[];

  addItem: (restaurantId: number, restaurantName: string, item: CartItem) => void;
  updateQuantity: (target: string | number, delta: number) => void;
  updateLineQuantity: (lineKey: string, delta: number) => void;
  getItemQuantity: (foodItemId: number) => number;
  getLineQuantity: (target: string | { foodItemId: number; variantId?: number | null; selectedAddonIds?: number[] }) => number;
  removeItem: (index: number) => void;
  clearCart: () => void;

  getItemTotal: () => number;
  getDeliveryFee: () => number;
  getTaxesAndPackaging: () => number;
  getGrandTotal: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  restaurantId: null,
  restaurantName: '',
  items: [],

  addItem: (restaurantId: number, restaurantName: string, item: CartItem) => {
    const state = get();
    // If ordering from a different restaurant, start fresh
    if (state.restaurantId !== null && state.restaurantId !== restaurantId) {
      const lineKey = getCartLineKey(item);
      set({
        restaurantId,
        restaurantName,
        items: [{ ...item, cartLineKey: lineKey }],
      });
      return;
    }

    const lineKey = getCartLineKey(item);
    const existingIndex = state.items.findIndex((i) => getCartLineKey(i) === lineKey);

    if (existingIndex > -1) {
      const updated = [...state.items];
      const existing = { ...updated[existingIndex] };
      const newQty = existing.quantity + item.quantity;
      const unitPrice = existing.totalPrice / existing.quantity;
      existing.quantity = newQty;
      existing.totalPrice = Math.round(unitPrice * newQty * 100) / 100;
      existing.cartLineKey = lineKey;
      updated[existingIndex] = existing;
      set({ items: updated, restaurantId, restaurantName });
    } else {
      set({
        restaurantId,
        restaurantName,
        items: [...state.items, { ...item, cartLineKey: lineKey }],
      });
    }
  },

  getItemQuantity: (foodItemId: number) => {
    const items = get().items.filter((i) => i.foodItemId === foodItemId);
    return items.reduce((sum, item) => sum + item.quantity, 0);
  },

  getLineQuantity: (target: string | { foodItemId: number; variantId?: number | null; selectedAddonIds?: number[] }) => {
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
      // Exact cartLineKey match
      existingIndex = state.items.findIndex((i) => getCartLineKey(i) === target);
    } else {
      // Number passed: could be cart item id, or foodItemId
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
      set({ items });
    }
  },

  removeItem: (index: number) => {
    const items = [...get().items];
    items.splice(index, 1);
    if (items.length === 0) {
      set({ items: [], restaurantId: null, restaurantName: '' });
    } else {
      set({ items });
    }
  },

  clearCart: () => {
    set({ items: [], restaurantId: null, restaurantName: '' });
  },

  getItemTotal: () => {
    return get().items.reduce((sum, item) => sum + item.totalPrice, 0);
  },

  getDeliveryFee: () => {
    return 0; // Free delivery matching Flutter
  },

  getTaxesAndPackaging: () => {
    const itemTotal = get().getItemTotal();
    return Math.round(itemTotal * 0.05 * 100) / 100; // 5% GST
  },

  getGrandTotal: () => {
    const itemTotal = get().getItemTotal();
    if (itemTotal === 0) return 0;
    const deliveryFee = get().getDeliveryFee();
    const taxes = get().getTaxesAndPackaging();
    return Math.round((itemTotal + deliveryFee + taxes) * 100) / 100;
  },
}));
