import { create } from 'zustand';
import { CartItem } from '../models/food';

interface CartState {
  restaurantId: number | null;
  restaurantName: string;
  items: CartItem[];

  addItem: (restaurantId: number, restaurantName: string, item: CartItem) => void;
  updateQuantity: (foodItemId: number, delta: number) => void;
  getItemQuantity: (foodItemId: number) => number;
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
      set({
        restaurantId,
        restaurantName,
        items: [item],
      });
      return;
    }

    set({
      restaurantId,
      restaurantName,
      items: [...state.items, item],
    });
  },

  getItemQuantity: (foodItemId: number) => {
    const items = get().items.filter((i) => i.foodItemId === foodItemId);
    return items.reduce((sum, item) => sum + item.quantity, 0);
  },

  updateQuantity: (foodItemId: number, delta: number) => {
    const state = get();
    const existingIndex = state.items.findIndex((i) => i.foodItemId === foodItemId);
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
    const delivery = get().getDeliveryFee();
    const taxes = get().getTaxesAndPackaging();
    return itemTotal + delivery + taxes;
  },
}));
