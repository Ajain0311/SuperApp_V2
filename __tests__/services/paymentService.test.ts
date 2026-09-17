import { paymentApi } from '../../src/services/paymentApi';
import { apiClient } from '../../src/services/apiClient';

jest.mock('../../src/services/apiClient', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

describe('paymentApi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('unwraps kit envelope from GET /payments/kit', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        activeProvider: 'Mock',
        checkoutMode: 'mock',
        hasCredentials: false,
        testCards: ['4111111111111111'],
      },
    });

    const kit = await paymentApi.getKit();
    expect(kit.activeProvider).toBe('Mock');
    expect(kit.checkoutMode).toBe('mock');
    expect(apiClient.get).toHaveBeenCalledWith('/payments/kit');
  });

  it('posts create-order payload and returns data', async () => {
    (apiClient.post as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        success: true,
        orderId: 'order_mock_1',
        transactionId: 'txn_1',
        amount: 1,
        currency: 'INR',
      },
    });

    const order = await paymentApi.createOrder({ amount: 1, module: 'TEST' });
    expect(order.orderId).toBe('order_mock_1');
    expect(apiClient.post).toHaveBeenCalledWith(
      '/payments/create-order',
      expect.objectContaining({ amount: 1, currency: 'INR', module: 'TEST' })
    );
  });
});
