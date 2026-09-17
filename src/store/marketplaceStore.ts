import { create } from 'zustand';
import { ListingSummary } from '../models/marketplace';

interface MarketplaceState {
  favorites: number[];
  customListings: ListingSummary[];

  toggleFavorite: (id: number) => boolean;
  isFavorite: (id: number) => boolean;
  addListing: (listing: ListingSummary) => void;
}

export const useMarketplaceStore = create<MarketplaceState>((set, get) => ({
  favorites: [102], // Pre-favorited item matching Flutter initial state
  customListings: [],

  toggleFavorite: (id: number) => {
    const current = get().favorites;
    const exists = current.includes(id);
    if (exists) {
      set({ favorites: current.filter((favId) => favId !== id) });
      return false;
    } else {
      set({ favorites: [...current, id] });
      return true;
    }
  },

  isFavorite: (id: number) => {
    return get().favorites.includes(id);
  },

  addListing: (listing: ListingSummary) => {
    set((state) => ({
      customListings: [listing, ...state.customListings],
    }));
  },
}));
