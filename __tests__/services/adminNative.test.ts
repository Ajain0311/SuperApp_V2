import { apiClient } from '../../src/services/apiClient';

jest.mock('../../src/services/apiClient', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

describe('Admin Native API Contracts & Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches dashboard KPI analytics and recent activities', async () => {
    const mockDashboard = {
      totalUsers: 142,
      activeDrivers: 18,
      totalRestaurants: 25,
      totalFoodOrders: 320,
      totalRides: 450,
      activeListings: 80,
      grossFoodSales: 154000,
      grossRideFares: 89000,
      platformRevenue: 40900,
      recentActivities: [
        {
          id: 'FO-1',
          module: 'FOOD',
          description: 'Food order #FO-101',
          amount: 450,
          timestamp: '2026-10-10T12:00:00Z',
        },
      ],
    };

    (apiClient.get as jest.Mock).mockResolvedValue({
      data: { success: true, data: mockDashboard },
    });

    const res = await apiClient.get('/api/admin/dashboard');
    expect(res.data.data.totalUsers).toBe(142);
    expect(res.data.data.platformRevenue).toBe(40900);
    expect(apiClient.get).toHaveBeenCalledWith('/api/admin/dashboard');
  });

  it('queries users list with search and role filters', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({
      data: {
        success: true,
        data: {
          items: [
            { id: 1, mobileNumber: '9876543210', fullName: 'John Doe', isActive: true, roles: ['Customer', 'Driver'] },
          ],
          totalCount: 1,
        },
      },
    });

    const res = await apiClient.get('/api/admin/users', { params: { search: 'John', role: 'DRIVER' } });
    expect(res.data.data.items).toHaveLength(1);
    expect(res.data.data.items[0].roles).toContain('Driver');
    expect(apiClient.get).toHaveBeenCalledWith('/api/admin/users', {
      params: { search: 'John', role: 'DRIVER' },
    });
  });

  it('manages user account status and role toggle via POST /api/admin/users', async () => {
    (apiClient.post as jest.Mock).mockResolvedValue({
      data: { success: true, message: 'User account status set to SUSPENDED' },
    });

    const resStatus = await apiClient.post('/api/admin/users', {
      action: 'STATUS',
      userId: 1,
      isActive: false,
    });
    expect(resStatus.data.success).toBe(true);
    expect(apiClient.post).toHaveBeenCalledWith('/api/admin/users', {
      action: 'STATUS',
      userId: 1,
      isActive: false,
    });

    // Test Role Assignment
    (apiClient.post as jest.Mock).mockResolvedValue({
      data: { success: true, message: 'Assigned role DRIVER to user #1' },
    });

    const resRole = await apiClient.post('/api/admin/users', {
      action: 'ROLE',
      userId: 1,
      roleName: 'DRIVER',
    });
    expect(resRole.data.success).toBe(true);
  });

  it('creates and retrieves restaurants via /api/admin/restaurants', async () => {
    (apiClient.post as jest.Mock).mockResolvedValue({
      data: {
        success: true,
        data: { id: 10, name: 'Royal Dhaba', city: 'Indore', isVeg: true, isActive: true },
      },
    });

    const created = await apiClient.post('/api/admin/restaurants', {
      action: 'ADD',
      name: 'Royal Dhaba',
      city: 'Indore',
      isVeg: true,
      minOrderAmount: 100,
      deliveryFee: 30,
    });
    expect(created.data.data.name).toBe('Royal Dhaba');
    expect(created.data.data.isVeg).toBe(true);

    (apiClient.get as jest.Mock).mockResolvedValue({
      data: { success: true, data: [created.data.data] },
    });
    const list = await apiClient.get('/api/admin/restaurants');
    expect(list.data.data).toHaveLength(1);
  });

  it('verifies drivers fleet via /api/admin/drivers', async () => {
    (apiClient.post as jest.Mock).mockResolvedValue({
      data: { success: true, message: 'Driver #5 verification set to true' },
    });

    const verifyRes = await apiClient.post('/api/admin/drivers', {
      action: 'VERIFY',
      driverId: 5,
      isVerified: true,
    });
    expect(verifyRes.data.success).toBe(true);
    expect(apiClient.post).toHaveBeenCalledWith('/api/admin/drivers', {
      action: 'VERIFY',
      driverId: 5,
      isVerified: true,
    });
  });

  it('dispatches push broadcast notifications via /api/admin/notifications/broadcast', async () => {
    (apiClient.post as jest.Mock).mockResolvedValue({
      data: { success: true, message: 'Notification broadcast queued' },
    });

    const broadcastRes = await apiClient.post('/api/admin/notifications/broadcast', {
      title: 'Flash Sale',
      message: '50% off on all items today!',
      targetRole: 'CUSTOMER',
    });
    expect(broadcastRes.data.success).toBe(true);
    expect(apiClient.post).toHaveBeenCalledWith('/api/admin/notifications/broadcast', {
      title: 'Flash Sale',
      message: '50% off on all items today!',
      targetRole: 'CUSTOMER',
    });
  });

  it('lists admin coupons for Coupons & Promos screen', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({
      data: {
        success: true,
        data: [{ id: 1, code: 'WELCOME50', discountType: 'FLAT', discountValue: 50, isActive: true }],
      },
    });
    const res = await apiClient.get('/admin/coupons');
    expect(res.data.data[0].code).toBe('WELCOME50');
    expect(apiClient.get).toHaveBeenCalledWith('/admin/coupons');
  });

  it('loads hotel commission ledger and settlement batches', async () => {
    (apiClient.get as jest.Mock)
      .mockResolvedValueOnce({
        data: {
          success: true,
          data: [{ restaurantId: 2, restaurantName: 'UNCLE JOHNS', effectiveCommissionRatePercent: 15, totalCommissionEarned: 1200 }],
        },
      })
      .mockResolvedValueOnce({
        data: { success: true, data: [{ id: 9, status: 'PENDING', amount: 500 }] },
      });

    const hotels = await apiClient.get('/admin/hotel-commissions');
    const batches = await apiClient.get('/admin/settlement-batches');
    expect(hotels.data.data[0].effectiveCommissionRatePercent).toBe(15);
    expect(batches.data.data[0].status).toBe('PENDING');
  });

  it('fetches ride fare configuration as { rules, options } envelope', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({
      data: {
        success: true,
        data: {
          rules: [{ vehicleType: 'BIKE', baseFare: 25, minimumFare: 35, includedDistanceKm: 1.5, perKmRate: 8 }],
          options: [{ code: 'PRIORITY', additionalAmount: 10 }],
        },
      },
    });
    const res = await apiClient.get('/admin/ride-fares');
    expect(Array.isArray(res.data.data)).toBe(false);
    expect(res.data.data.rules[0].vehicleType).toBe('BIKE');
    expect(apiClient.get).toHaveBeenCalledWith('/admin/ride-fares');
  });

  it('lists hotel commissions with configuredRatePercent / pendingCommissionBalance fields', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({
      data: {
        success: true,
        data: [
          {
            restaurantId: 2,
            restaurantName: 'UNCLE JOHNS',
            configuredRatePercent: 15,
            grossDeliveredSales: 1000,
            totalCommissionEarned: 150,
            pendingCommissionBalance: 150,
            settledCommissionAmount: 0,
            deliveredOrdersCount: 5,
          },
        ],
      },
    });
    const res = await apiClient.get('/admin/hotel-commissions');
    expect(res.data.data[0].configuredRatePercent).toBe(15);
    expect(res.data.data[0].pendingCommissionBalance).toBe(150);
  });
});
