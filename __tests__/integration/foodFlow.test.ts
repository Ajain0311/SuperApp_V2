import { useCartStore } from '../../src/store/cartStore';
import { apiClient } from '../../src/services/apiClient';
import { signalRService, OrderStatusEvent } from '../../src/services/signalr';
import { ApiEndpoints } from '../../src/constants/api';

jest.mock('../../src/services/apiClient');
jest.mock('@microsoft/signalr', () => {
  const listeners: Record<string, Function[]> = {};
  const mockHubConnection = {
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
    invoke: jest.fn().mockResolvedValue(undefined),
    on: jest.fn((event: string, cb: Function) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(cb);
    }),
    off: jest.fn((event: string, cb: Function) => {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter((fn) => fn !== cb);
      }
    }),
    state: 'Connected',
    _emit: (event: string, data: any) => {
      if (listeners[event]) {
        listeners[event].forEach((cb) => cb(data));
      }
    },
  };

  const mockBuilder = {
    withUrl: jest.fn().mockReturnThis(),
    withAutomaticReconnect: jest.fn().mockReturnThis(),
    configureLogging: jest.fn().mockReturnThis(),
    build: jest.fn().mockReturnValue(mockHubConnection),
  };

  return {
    HubConnectionBuilder: jest.fn(() => mockBuilder),
    HubConnectionState: { Connected: 'Connected' },
    LogLevel: { None: 0, Information: 2 },
  };
});

describe('Integration Flow: End-to-End Food Ordering & SignalR Tracking', () => {
  beforeEach(() => {
    useCartStore.getState().clearCart();
    jest.clearAllMocks();
  });

  it('completes the entire food cycle: cart -> order placement -> live status -> cancellation', async () => {
    // 1. Build Cart
    useCartStore.getState().addItem(1, 'Meghana Foods', {
      id: 1,
      foodItemId: 101,
      name: 'Special Biryani',
      basePrice: 340,
      quantity: 1,
      addons: [],
      totalPrice: 340,
    });
    expect(useCartStore.getState().getGrandTotal()).toBe(357); // 340 + 17 (5% GST)

    // 2. Place Order via API
    const mockOrderResponse = {
      id: 501,
      orderNumber: 'FO-9921',
      restaurantId: 1,
      restaurantName: 'Meghana Foods',
      status: 'PENDING',
      subTotal: 340,
      grandTotal: 357,
      items: [{ foodItemId: 101, itemName: 'Special Biryani', quantity: 1, unitPrice: 340 }],
    };

    (apiClient.post as jest.Mock).mockResolvedValueOnce({
      data: { success: true, data: mockOrderResponse },
    });

    const payload = {
      restaurantId: useCartStore.getState().restaurantId,
      items: useCartStore.getState().items.map((i) => ({
        foodItemId: i.foodItemId,
        quantity: i.quantity,
      })),
      paymentMethod: 'CASH_ON_DELIVERY',
    };

    const res = await apiClient.post(ApiEndpoints.food.orders, payload);
    expect(res.data.data.orderNumber).toBe('FO-9921');

    // 3. Clear cart after successful placement
    useCartStore.getState().clearCart();
    expect(useCartStore.getState().items).toHaveLength(0);

    // 4. Connect to Order Hub and receive live status updates
    const conn = await signalRService.connectOrderHub();
    await signalRService.joinOrder(501);
    expect(conn.invoke).toHaveBeenCalledWith('JoinOrder', 501);

    const receivedEvents: OrderStatusEvent[] = [];
    const unsubscribe = signalRService.onOrderStatusUpdated((event) => {
      receivedEvents.push(event);
    });

    // Simulate backend sending preparing event
    (conn as any)._emit('OrderStatusUpdated', {
      orderId: 501,
      status: 'PREPARING',
      estimatedMinutes: 20,
      updatedAt: new Date().toISOString(),
    });

    expect(receivedEvents).toHaveLength(1);
    expect(receivedEvents[0].status).toBe('PREPARING');
    expect(receivedEvents[0].estimatedMinutes).toBe(20);

    // 5. Cancel Order via API
    (apiClient.post as jest.Mock).mockResolvedValueOnce({
      data: { success: true, message: 'Order cancelled successfully' },
    });

    const cancelRes = await apiClient.post(ApiEndpoints.food.cancelOrder(501));
    expect(cancelRes.data.success).toBe(true);

    // 6. Cleanup & teardown
    unsubscribe();
    await signalRService.leaveOrder(501);
    expect(conn.invoke).toHaveBeenCalledWith('LeaveOrder', 501);
  });
});
