import { useAuthStore } from '../../src/store/authStore';
import { apiClient } from '../../src/services/apiClient';
import { storage } from '../../src/services/storage';

jest.mock('../../src/services/apiClient');

describe('AuthStore - State Transitions & Fallback Hardening', () => {
  beforeEach(async () => {
    useAuthStore.getState().logout();
    await storage.clearAll();
    jest.clearAllMocks();
  });

  it('should initialize with logged-out state', () => {
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.token).toBeNull();
    expect(state.user).toBeNull();
    expect(state.isFallbackSession).toBe(false);
  });

  it('should request OTP successfully via real API contract', async () => {
    (apiClient.post as jest.Mock).mockResolvedValueOnce({
      success: true,
      message: 'OTP sent successfully',
      isNewUser: true,
      isAdmin: false,
      devOtp: '123456',
    });

    const res = await useAuthStore.getState().sendOtp('+919876543210');
    expect(res.success).toBe(true);
    expect(res.devOtp).toBe('123456');
    expect(res.isNewUser).toBe(true);
  });

  it('should authenticate user and store token on successful OTP verification', async () => {
    (apiClient.post as jest.Mock).mockResolvedValueOnce({
      success: true,
      token: 'jwt_test_token_123',
      user: {
        id: 1,
        mobileNumber: '+919876543210',
        fullName: 'Test Customer',
        roles: ['Customer'],
      },
    });

    const res = await useAuthStore.getState().verifyOtp('+919876543210', '123456');
    expect(res.success).toBe(true);

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.token).toBe('jwt_test_token_123');
    expect(state.user?.fullName).toBe('Test Customer');
    expect(state.isFallbackSession).toBe(false);

    // Verify token saved to storage
    const savedToken = await storage.getToken();
    expect(savedToken).toBe('jwt_test_token_123');
  });

  it('should activate fallback dev session when backend fails with dev OTP 123456', async () => {
    (apiClient.post as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    const res = await useAuthStore.getState().verifyOtp('+919876543210', '123456');
    expect(res.success).toBe(true);

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.isFallbackSession).toBe(true);
    expect(state.user?.mobileNumber).toBe('+919876543210');
  });

  it('should authenticate admin directly via admin-login endpoint', async () => {
    (apiClient.post as jest.Mock).mockResolvedValueOnce({
      success: true,
      token: 'admin_jwt_token_888',
      user: {
        id: 99,
        mobileNumber: '+919999999999',
        fullName: 'System Administrator',
        roles: ['Admin'],
      },
    });

    const res = await useAuthStore.getState().adminLogin('9999999999', 'Admin@123', '123456');
    expect(res.success).toBe(true);

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.token).toBe('admin_jwt_token_888');
    expect(state.user?.roles).toContain('Admin');
  });

  it('should clear state and storage on logout', async () => {
    await storage.setToken('jwt_test_token_123');
    useAuthStore.setState({
      isAuthenticated: true,
      token: 'jwt_test_token_123',
      user: { id: 1, mobileNumber: '+919876543210', fullName: 'Test', roles: ['Customer'] },
    });

    await useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.token).toBeNull();
    expect(state.user).toBeNull();

    const savedToken = await storage.getToken();
    expect(savedToken).toBeNull();
  });
});
