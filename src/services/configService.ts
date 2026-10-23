import { apiClient } from './apiClient';
import { ApiEndpoints } from '../constants/api';
import { AppEnvironment } from '../config/environment';

export interface RemoteClientConfig {
  mapProvider: string;
  mapboxAccessToken: string;
  paymentProvider: string;
  paymentKeyId?: string;
  environment: string;
  showTestOtp: boolean;
  apiBaseUrl: string;
  signalRHubUrl: string;
}

let cachedRemoteConfig: RemoteClientConfig | null = null;
let fetchPromise: Promise<RemoteClientConfig | null> | null = null;

export const configService = {
  async fetchConfig(): Promise<RemoteClientConfig | null> {
    if (cachedRemoteConfig) {
      return cachedRemoteConfig;
    }

    if (fetchPromise) {
      return fetchPromise;
    }

    fetchPromise = (async () => {
      try {
        const response = await apiClient.get<any>(ApiEndpoints.common.config);
        const data = response.data || response;
        if (data && data.success && data.data) {
          cachedRemoteConfig = data.data as RemoteClientConfig;
          if (cachedRemoteConfig.mapboxAccessToken) {
            AppEnvironment.setRuntimeMapboxToken(cachedRemoteConfig.mapboxAccessToken);
          }
          return cachedRemoteConfig;
        } else if (data && data.mapboxAccessToken) {
          cachedRemoteConfig = data as RemoteClientConfig;
          if (cachedRemoteConfig.mapboxAccessToken) {
            AppEnvironment.setRuntimeMapboxToken(cachedRemoteConfig.mapboxAccessToken);
          }
          return cachedRemoteConfig;
        }
      } catch (err) {
        console.warn('[ConfigService] Could not fetch remote config, using environment defaults:', err);
      } finally {
        fetchPromise = null;
      }
      return cachedRemoteConfig;
    })();

    return fetchPromise;
  },

  getCachedConfig(): RemoteClientConfig | null {
    return cachedRemoteConfig;
  },
};
