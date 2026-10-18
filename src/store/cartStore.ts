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

    const lineKey = item.cartLineKey || `${item.foodItemId}-${item.variantId ?? ''}-${(item.selectedAddonIds || []).sort().join(',')}`;
    const existingIndex = state.items.findIndex((i) => {
      const iKey = i.cartLineKey || `${i.foodItemId}-${i.variantId ?? ''}-${(i.selectedAddonIds || []).sort().join(',')}`;
      return iKey === lineKey;
    });

    if (existingIndex > -1) {
      const updated = [...state.items];
      const existing = { ...updated[existingIndex] };
      const newQty = existing.quantity + item.quantity;
      const unitPrice = existing.totalPrice / existing.quantity;
      existing.quantity = newQty;
      existing.totalPrice = Math.round(unitPrice * newQty * 100) / 100;
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

  updateQuantity: (foodItemIdOrId: number, delta: number) => {
    const state = get();
    // Find either by exact cart item id, or fallback to first matching foodItemId
    let existingIndex = state.items.findIndex((i) => i.id === foodItemIdOrId);
    if (existingIndex === -1) {
      existingIndex = state.items.findIndex((i) => i.foodItemId === foodItemIdOrId);
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
    const delivery = get().getDeliveryFee();
    const taxes = get().getTaxesAndPackaging();
    return itemTotal + delivery + taxes;
  },
}));
