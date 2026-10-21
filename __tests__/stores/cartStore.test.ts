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

  it('should treat different variants of the same dish as distinct cart line items', () => {
    const regularItem: CartItem = {
      id: 10,
      foodItemId: 101,
      name: 'Special Biryani',
      basePrice: 340,
      quantity: 1,
      variantId: 1,
      portionName: 'Regular',
      portionPrice: 0,
      selectedAddonIds: [],
      addons: [],
      totalPrice: 340,
    };

    const jumboItem: CartItem = {
      id: 11,
      foodItemId: 101,
      name: 'Special Biryani',
      basePrice: 340,
      quantity: 1,
      variantId: 2,
      portionName: 'Jumbo Pack',
      portionPrice: 200,
      selectedAddonIds: [5],
      addons: ['Extra Gravy (+₹40)'],
      totalPrice: 580, // 340 + 200 + 40
    };

    useCartStore.getState().addItem(1, 'Meghana Foods', regularItem);
    useCartStore.getState().addItem(1, 'Meghana Foods', jumboItem);

    const state = useCartStore.getState();
    expect(state.items).toHaveLength(2);
    expect(state.getItemQuantity(101)).toBe(2);
    expect(state.getItemTotal()).toBe(920); // 340 + 580
    expect(state.getTaxesAndPackaging()).toBe(46); // 5% GST
    expect(state.getGrandTotal()).toBe(966);
  });

  it('should update and query exact cart line items without interfering with other variants/add-ons of same foodItemId', () => {
    const regularItem: CartItem = {
      id: 10,
      foodItemId: 101,
      name: 'Special Biryani',
      basePrice: 340,
      quantity: 1,
      variantId: 1,
      portionName: 'Regular',
      portionPrice: 0,
      selectedAddonIds: [],
      addons: [],
      totalPrice: 340,
    };

    const jumboItem: CartItem = {
      id: 11,
      foodItemId: 101,
      name: 'Special Biryani',
      basePrice: 340,
      quantity: 1,
      variantId: 2,
      portionName: 'Jumbo Pack',
      portionPrice: 200,
      selectedAddonIds: [5],
      addons: ['Extra Gravy (+₹40)'],
      totalPrice: 580,
    };

    useCartStore.getState().addItem(1, 'Meghana Foods', regularItem);
    useCartStore.getState().addItem(1, 'Meghana Foods', jumboItem);

    const items = useCartStore.getState().items;
    expect(items).toHaveLength(2);

    const regularKey = items[0].cartLineKey!;
    const jumboKey = items[1].cartLineKey!;
    expect(regularKey).not.toEqual(jumboKey);

    // Increment ONLY the jumbo variant by line key
    useCartStore.getState().updateQuantity(jumboKey, 1);
    expect(useCartStore.getState().getLineQuantity(jumboKey)).toBe(2);
    expect(useCartStore.getState().getLineQuantity(regularKey)).toBe(1);
    expect(useCartStore.getState().getItemQuantity(101)).toBe(3);

    // Decrement regular variant to 0 -> should remove regular without touching jumbo
    useCartStore.getState().updateQuantity(regularKey, -1);
    expect(useCartStore.getState().getLineQuantity(regularKey)).toBe(0);
    expect(useCartStore.getState().getLineQuantity(jumboKey)).toBe(2);
    expect(useCartStore.getState().items).toHaveLength(1);
    expect(useCartStore.getState().items[0].cartLineKey).toBe(jumboKey);
  });
});
