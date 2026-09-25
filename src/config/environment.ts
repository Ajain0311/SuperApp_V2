import { Platform } from 'react-native';

/**
 * Environment-driven configuration for SuperApp React Native + Expo client.
 * Decoupled from hardcoded URLs, supporting dev, staging, and production.
 */
export class AppEnvironment {
  /** Target environment: 'dev', 'staging', 'prod' */
  static get environment(): string {
    return (process.env.EXPO_PUBLIC_ENV || 'dev').toLowerCase();
  }

  static get isProduction(): boolean {
    return this.environment === 'prod' || this.environment === 'production';
  }

  static get isStaging(): boolean {
    return this.environment === 'staging' || this.environment === 'stage';
  }

  static get isDevelopment(): boolean {
    return !this.isProduction && !this.isStaging;
  }

  /**
   * Primary API Base URL resolved from EXPO_PUBLIC_API_BASE_URL or platform defaults
   */
  static get baseUrl(): string {
    // 1. Explicit override from env
    const explicitUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
    if (explicitUrl && explicitUrl.trim().length > 0) {
      return explicitUrl.trim();
    }

    // 2. Select default based on environment
    if (this.isProduction) {
      return 'https://api.superapp.com/api';
    }
    if (this.isStaging) {
      return 'https://staging-api.superapp.com/api';
    }

    // 3. Dev fallbacks (Android emulator maps localhost to 10.0.2.2)
    if (Platform.OS === 'android') {
      return 'http://10.0.2.2:5000/api';
    }
    return 'http://localhost:5000/api';
  }

  /**
   * Root host URL for SignalR hubs (strips /api suffix)
   */
  static get hubBaseUrl(): string {
    const explicitHub = process.env.EXPO_PUBLIC_SIGNALR_HUB_URL;
    if (explicitHub && explicitHub.trim().length > 0) {
      return explicitHub.trim().replace(/\/$/, '');
    }

    const currentBase = this.baseUrl;
    if (currentBase.endsWith('/api')) {
      return currentBase.substring(0, currentBase.length - 4);
    }
    return currentBase.replace(/\/$/, '');
  }

  static get rideHubUrl(): string {
    return `${this.hubBaseUrl}/hubs/ride`;
  }

  static get orderHubUrl(): string {
    return `${this.hubBaseUrl}/hubs/order`;
  }

  static get chatHubUrl(): string {
    return `${this.hubBaseUrl}/hubs/chat`;
  }

  static get enableLogging(): boolean {
    const envLog = process.env.EXPO_PUBLIC_ENABLE_LOGS;
    if (envLog !== undefined) {
      return envLog === 'true' || envLog === '1';
    }
    return this.isDevelopment;
  }

  static get testOtp(): string {
    return process.env.EXPO_PUBLIC_TEST_OTP || '123456';
  }

  static get showTestOtp(): boolean {
    const show = process.env.EXPO_PUBLIC_SHOW_TEST_OTP;
    if (show !== undefined) {
      return show === 'true' || show === '1';
    }
    return !this.isProduction;
  }

  /** Mapbox public access token (pk.*) for maps + geocoding search */
  static get mapboxAccessToken(): string {
    return (process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || '').trim();
  }

  static get hasMapboxToken(): boolean {
    return this.mapboxAccessToken.length > 0;
  }
}
