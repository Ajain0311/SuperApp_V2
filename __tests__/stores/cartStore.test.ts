import { useCartStore } from '../../src/store/cartStore';
import { CartItem } from '../../src/models/food';

describe('CartStore - Order Price Calculation & Multi-Restaurant Logic', () => {
  beforeEach(() => {
    useCartStore.getState().clearCart();
  });

  it('should initialize with empty cart', () => {
    const state = useCartStore.getState();
    expect(state.items).toHaveLength(0);
    expect(state.restaurantId).toBeNull();
    expect(state.restaurantName).toBe('');
    expect(state.getItemTotal()).toBe(0);
    expect(state.getGrandTotal()).toBe(0);
  });

  it('should add item and calculate totals correctly', () => {
    const item: CartItem = {
      id: 1,
      foodItemId: 101,
      name: 'Special Biryani',
      basePrice: 340,
      quantity: 2,
      portionName: 'Full Handi',
      portionPrice: 50,
      addons: ['Extra Gravy (+₹30)'],
      totalPrice: 840, // (340 + 50 + 30) * 2
    };

    useCartStore.getState().addItem(1, 'Meghana Foods', item);

    const state = useCartStore.getState();
    expect(state.items).toHaveLength(1);
    expect(state.restaurantId).toBe(1);
    expect(state.restaurantName).toBe('Meghana Foods');
    expect(state.getItemTotal()).toBe(840);
    expect(state.getDeliveryFee()).toBe(0); // Free delivery
    expect(state.getTaxesAndPackaging()).toBe(42); // 5% GST on 840 = 42
    expect(state.getGrandTotal()).toBe(882); // 840 + 42
  });

  it('should reset cart when adding an item from a different restaurant', () => {
    const item1: CartItem = {
      id: 1,
      foodItemId: 101,
      name: 'Biryani',
      basePrice: 300,
      quantity: 1,
      addons: [],
      totalPrice: 300,
    };
    useCartStore.getState().addItem(1, 'Meghana Foods', item1);

    const item2: CartItem = {
      id: 2,
      foodItemId: 201,
      name: 'Burger',
      basePrice: 150,
      quantity: 1,
      addons: [],
      totalPrice: 150,
    };
    useCartStore.getState().addItem(2, 'Burger King', item2);

    const state = useCartStore.getState();
    expect(state.items).toHaveLength(1);
    expect(state.restaurantId).toBe(2);
    expect(state.restaurantName).toBe('Burger King');
    expect(state.getItemTotal()).toBe(150);
  });

  it('should remove item and clear cart when last item removed', () => {
    const item1: CartItem = {
      id: 1,
      foodItemId: 101,
      name: 'Biryani',
      basePrice: 300,
      quantity: 1,
      addons: [],
      totalPrice: 300,
    };
    const item2: CartItem = {
      id: 2,
      foodItemId: 102,
      name: 'Raita',
      basePrice: 50,
      quantity: 1,
      addons: [],
      totalPrice: 50,
    };
    useCartStore.getState().addItem(1, 'Meghana Foods', item1);
    useCartStore.getState().addItem(1, 'Meghana Foods', item2);

    expect(useCartStore.getState().items).toHaveLength(2);

    // Remove first item
    useCartStore.getState().removeItem(0);
    expect(useCartStore.getState().items).toHaveLength(1);
    expect(useCartStore.getState().getItemTotal()).toBe(50);

    // Remove last item
    useCartStore.getState().removeItem(0);
    expect(useCartStore.getState().items).toHaveLength(0);
    expect(useCartStore.getState().restaurantId).toBeNull();
  });
});
