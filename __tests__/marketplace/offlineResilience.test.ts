import { apiClient, ApiError } from '../../src/services/apiClient';

describe('Marketplace API and Offline Resilience Tests', () => {
  beforeEach(() => {
    apiClient.setDeviceOnline(true);
  });

  afterEach(() => {
    apiClient.setDeviceOnline(true);
  });

  it('distinguishes device offline from server downtime error messages', () => {
    // 1. Device is offline
    apiClient.setDeviceOnline(false);
    const mockAxiosOfflineErr = {
      isAxiosError: true,
      message: 'Network Error',
      response: undefined,
    };
    const offlineErr = apiClient.normalizeError(mockAxiosOfflineErr);
    expect(offlineErr.isOffline).toBe(true);
    expect(offlineErr.isNetworkError).toBe(true);
    expect(offlineErr.message).toContain('No internet connection');
    expect(offlineErr.message).not.toContain('API server is running');

    // 2. Device is online, but backend server is unreachable
    apiClient.setDeviceOnline(true);
    const mockAxiosServerDownErr = {
      isAxiosError: true,
      message: 'Network Error',
      response: undefined,
    };
    const serverDownErr = apiClient.normalizeError(mockAxiosServerDownErr);
    expect(serverDownErr.isOffline).toBeFalsy();
    expect(serverDownErr.isServerDown).toBe(true);
    expect(serverDownErr.isNetworkError).toBe(true);
    expect(serverDownErr.message).toContain('Unable to reach the SuperApp server');
  });

  it('translates request timeouts accurately without logging the user out', () => {
    const timeoutErr = {
      isAxiosError: true,
      code: 'ECONNABORTED',
      message: 'timeout of 30000ms exceeded',
      response: undefined,
    };
    const normalized = apiClient.normalizeError(timeoutErr);
    expect(normalized.isTimeout).toBe(true);
    expect(normalized.statusCode).toBe(408);
    expect(normalized.isUnauthorized).toBeFalsy();
    expect(normalized.message).toContain('Request timed out');
  });

  it('blocks outgoing requests immediately when device is confirmed offline', async () => {
    apiClient.setDeviceOnline(false);
    await expect(apiClient.get('/marketplace')).rejects.toThrow(
      'No internet connection'
    );
  });
});
