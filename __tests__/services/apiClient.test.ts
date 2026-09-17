import { apiClient, ApiError } from '../../src/services/apiClient';
import { storage } from '../../src/services/storage';

describe('ApiClient - Interceptors & Error Translation', () => {
  beforeEach(async () => {
    await storage.clearAll();
    jest.clearAllMocks();
  });

  it('should format ApiError with appropriate metadata', () => {
    const error = new ApiError('Unauthorized resource', {
      statusCode: 401,
      isUnauthorized: true,
      errors: ['Invalid or expired JWT token'],
    });

    expect(error.message).toBe('Unauthorized resource');
    expect(error.statusCode).toBe(401);
    expect(error.isUnauthorized).toBe(true);
    expect(error.errors).toEqual(['Invalid or expired JWT token']);
  });

  it('should inject Authorization Bearer header when token exists in storage', async () => {
    await storage.setToken('test_jwt_session_token');

    const interceptor = (apiClient as any).client.interceptors.request.handlers[0];
    const mockConfig: any = { headers: {} };

    const modifiedConfig = await interceptor.fulfilled(mockConfig);
    expect(modifiedConfig.headers.Authorization).toBe('Bearer test_jwt_session_token');
  });

  it('should not attach Authorization header when no token is present', async () => {
    const interceptor = (apiClient as any).client.interceptors.request.handlers[0];
    const mockConfig: any = { headers: {} };

    const modifiedConfig = await interceptor.fulfilled(mockConfig);
    expect(modifiedConfig.headers.Authorization).toBeUndefined();
  });
});
