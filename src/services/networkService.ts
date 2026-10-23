import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { apiClient } from './apiClient';
import { signalRService } from './signalr';

export interface NetworkStatus {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  type: string;
}

class NetworkService {
  private isConnected: boolean = true;
  private isInternetReachable: boolean | null = true;
  private listeners: Set<(status: NetworkStatus) => void> = new Set();
  private unsubscribeNetInfo: (() => void) | null = null;

  constructor() {
    this.init();
  }

  private init() {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      this.isConnected = typeof navigator !== 'undefined' ? navigator.onLine : true;
      this.isInternetReachable = this.isConnected;
      apiClient.setDeviceOnline(this.isConnected);

      window.addEventListener('online', () => this.handleConnectionChange(true, true));
      window.addEventListener('offline', () => this.handleConnectionChange(false, false));
      return;
    }

    try {
      this.unsubscribeNetInfo = NetInfo.addEventListener((state: NetInfoState) => {
        const connected = state.isConnected ?? true;
        const reachable = state.isInternetReachable ?? connected;
        this.handleConnectionChange(connected, reachable, state.type);
      });

      NetInfo.fetch().then((state) => {
        const connected = state.isConnected ?? true;
        const reachable = state.isInternetReachable ?? connected;
        this.handleConnectionChange(connected, reachable, state.type);
      }).catch(() => {});
    } catch {
      // Fallback if native module not linked
      this.isConnected = true;
      this.isInternetReachable = true;
      apiClient.setDeviceOnline(true);
    }
  }

  private handleConnectionChange(connected: boolean, reachable: boolean | null, type: string = 'unknown') {
    const wasOffline = !this.isConnected || this.isInternetReachable === false;
    this.isConnected = connected;
    this.isInternetReachable = reachable;
    const isNowOnline = connected && reachable !== false;

    apiClient.setDeviceOnline(isNowOnline);

    const status: NetworkStatus = {
      isConnected: connected,
      isInternetReachable: reachable,
      type,
    };

    this.listeners.forEach((listener) => {
      try {
        listener(status);
      } catch (err) {
        console.warn('[NetworkService] Listener error:', err);
      }
    });

    if (wasOffline && isNowOnline) {
      // Reconnected! Reconnect SignalR automatically
      signalRService.reconnectAll();
    }
  }

  public getStatus(): NetworkStatus {
    return {
      isConnected: this.isConnected,
      isInternetReachable: this.isInternetReachable,
      type: 'cellular_or_wifi',
    };
  }

  public isOnline(): boolean {
    return this.isConnected && this.isInternetReachable !== false;
  }

  public addListener(listener: (status: NetworkStatus) => void): () => void {
    this.listeners.add(listener);
    // Initial call
    listener(this.getStatus());
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const networkService = new NetworkService();

export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>(networkService.getStatus());

  useEffect(() => {
    return networkService.addListener(setStatus);
  }, []);

  return status;
}
