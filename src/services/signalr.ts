import * as signalR from '@microsoft/signalr';
import { AppEnvironment } from '../config/environment';
import { storage } from './storage';

export interface DriverLocationEvent {
  rideId: number;
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
  updatedAt: string;
}

export interface RideStatusEvent {
  rideId: number;
  status: string;
  updatedAt: string;
}

export interface OrderStatusEvent {
  orderId: number;
  status: string;
  message?: string;
  estimatedMinutes?: number;
  updatedAt: string;
}

export interface ChatMessageEvent {
  conversationId: string;
  senderId: number;
  senderName: string;
  messageText: string;
  timestamp: string;
}

class SignalRService {
  private rideHubConnection: signalR.HubConnection | null = null;
  private orderHubConnection: signalR.HubConnection | null = null;
  private chatHubConnection: signalR.HubConnection | null = null;

  private createConnection(hubUrl: string): signalR.HubConnection {
    return new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: async () => {
          const token = await storage.getToken();
          return token || '';
        },
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(AppEnvironment.enableLogging ? signalR.LogLevel.Information : signalR.LogLevel.None)
      .build();
  }

  // --- Ride Tracking Hub ---
  async connectRideHub(): Promise<signalR.HubConnection> {
    if (this.rideHubConnection && this.rideHubConnection.state === signalR.HubConnectionState.Connected) {
      return this.rideHubConnection;
    }

    this.rideHubConnection = this.createConnection(AppEnvironment.rideHubUrl);
    try {
      await this.rideHubConnection.start();
      if (AppEnvironment.enableLogging) {
        console.log('[SignalR] Connected to RideTrackingHub at', AppEnvironment.rideHubUrl);
      }
    } catch (err) {
      if (AppEnvironment.enableLogging) {
        console.warn('[SignalR] RideHub connection error:', err);
      }
    }
    return this.rideHubConnection;
  }

  async joinRide(rideId: number): Promise<void> {
    const conn = await this.connectRideHub();
    if (conn.state === signalR.HubConnectionState.Connected) {
      await conn.invoke('JoinRide', rideId);
    }
  }

  async leaveRide(rideId: number): Promise<void> {
    if (this.rideHubConnection && this.rideHubConnection.state === signalR.HubConnectionState.Connected) {
      await this.rideHubConnection.invoke('LeaveRide', rideId);
    }
  }

  onDriverLocationUpdated(callback: (data: DriverLocationEvent) => void): () => void {
    if (!this.rideHubConnection) {
      this.rideHubConnection = this.createConnection(AppEnvironment.rideHubUrl);
    }
    this.rideHubConnection.on('DriverLocationUpdated', callback);
    return () => this.rideHubConnection?.off('DriverLocationUpdated', callback);
  }

  onRideStatusChanged(callback: (data: RideStatusEvent) => void): () => void {
    if (!this.rideHubConnection) {
      this.rideHubConnection = this.createConnection(AppEnvironment.rideHubUrl);
    }
    this.rideHubConnection.on('RideStatusChanged', callback);
    return () => this.rideHubConnection?.off('RideStatusChanged', callback);
  }

  onDriverAssigned(callback: (driver: any) => void): () => void {
    if (!this.rideHubConnection) {
      this.rideHubConnection = this.createConnection(AppEnvironment.rideHubUrl);
    }
    this.rideHubConnection.on('DriverAssigned', callback);
    return () => this.rideHubConnection?.off('DriverAssigned', callback);
  }

  // --- Order Status Hub ---
  async connectOrderHub(): Promise<signalR.HubConnection> {
    if (this.orderHubConnection && this.orderHubConnection.state === signalR.HubConnectionState.Connected) {
      return this.orderHubConnection;
    }

    this.orderHubConnection = this.createConnection(AppEnvironment.orderHubUrl);
    try {
      await this.orderHubConnection.start();
      if (AppEnvironment.enableLogging) {
        console.log('[SignalR] Connected to OrderStatusHub at', AppEnvironment.orderHubUrl);
      }
    } catch (err) {
      if (AppEnvironment.enableLogging) {
        console.warn('[SignalR] OrderHub connection error:', err);
      }
    }
    return this.orderHubConnection;
  }

  async joinOrder(orderId: number): Promise<void> {
    const conn = await this.connectOrderHub();
    if (conn.state === signalR.HubConnectionState.Connected) {
      await conn.invoke('JoinOrder', orderId);
    }
  }

  async leaveOrder(orderId: number): Promise<void> {
    if (this.orderHubConnection && this.orderHubConnection.state === signalR.HubConnectionState.Connected) {
      await this.orderHubConnection.invoke('LeaveOrder', orderId);
    }
  }

  onOrderStatusUpdated(callback: (data: OrderStatusEvent) => void): () => void {
    if (!this.orderHubConnection) {
      this.orderHubConnection = this.createConnection(AppEnvironment.orderHubUrl);
    }
    this.orderHubConnection.on('OrderStatusUpdated', callback);
    return () => this.orderHubConnection?.off('OrderStatusUpdated', callback);
  }

  // --- Chat Hub ---
  async connectChatHub(): Promise<signalR.HubConnection> {
    if (this.chatHubConnection && this.chatHubConnection.state === signalR.HubConnectionState.Connected) {
      return this.chatHubConnection;
    }

    this.chatHubConnection = this.createConnection(AppEnvironment.chatHubUrl);
    try {
      await this.chatHubConnection.start();
      if (AppEnvironment.enableLogging) {
        console.log('[SignalR] Connected to ChatHub at', AppEnvironment.chatHubUrl);
      }
    } catch (err) {
      if (AppEnvironment.enableLogging) {
        console.warn('[SignalR] ChatHub connection error:', err);
      }
    }
    return this.chatHubConnection;
  }

  async joinChat(conversationId: string): Promise<void> {
    const conn = await this.connectChatHub();
    if (conn.state === signalR.HubConnectionState.Connected) {
      await conn.invoke('JoinChat', conversationId);
    }
  }

  async leaveChat(conversationId: string): Promise<void> {
    if (this.chatHubConnection && this.chatHubConnection.state === signalR.HubConnectionState.Connected) {
      await this.chatHubConnection.invoke('LeaveChat', conversationId);
    }
  }

  async sendMessage(conversationId: string, senderId: number, senderName: string, messageText: string): Promise<void> {
    const conn = await this.connectChatHub();
    if (conn.state === signalR.HubConnectionState.Connected) {
      await conn.invoke('SendMessage', conversationId, senderId, senderName, messageText);
    }
  }

  onChatMessageReceived(callback: (data: ChatMessageEvent) => void): () => void {
    if (!this.chatHubConnection) {
      this.chatHubConnection = this.createConnection(AppEnvironment.chatHubUrl);
    }
    this.chatHubConnection.on('MessageReceived', callback);
    return () => this.chatHubConnection?.off('MessageReceived', callback);
  }

  async disconnectAll(): Promise<void> {
    await this.rideHubConnection?.stop();
    await this.orderHubConnection?.stop();
    await this.chatHubConnection?.stop();
    this.rideHubConnection = null;
    this.orderHubConnection = null;
    this.chatHubConnection = null;
  }
}

export const signalRService = new SignalRService();
