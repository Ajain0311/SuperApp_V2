import * as signalR from '@microsoft/signalr';
import { signalRService } from '../../src/services/signalr';

jest.mock('@microsoft/signalr', () => {
  const mockHubConnection = {
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
    invoke: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
    off: jest.fn(),
    onreconnecting: jest.fn(),
    onreconnected: jest.fn(),
    onclose: jest.fn(),
    state: 'Connected',
  };

  const mockBuilder = {
    withUrl: jest.fn().mockReturnThis(),
    withAutomaticReconnect: jest.fn().mockReturnThis(),
    configureLogging: jest.fn().mockReturnThis(),
    build: jest.fn().mockReturnValue(mockHubConnection),
  };

  return {
    HubConnectionBuilder: jest.fn(() => mockBuilder),
    HubConnectionState: {
      Connected: 'Connected',
      Disconnected: 'Disconnected',
      Connecting: 'Connecting',
      Reconnecting: 'Reconnecting',
    },
    LogLevel: {
      None: 0,
      Information: 2,
    },
  };
});

describe('SignalRService - Connection, Event Subscriptions, and Teardown', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should configure automatic reconnect intervals [0, 2000, 5000, 10000, 30000]', async () => {
    await signalRService.connectRideHub();
    const builder = new signalR.HubConnectionBuilder();
    expect(builder.withAutomaticReconnect).toHaveBeenCalledWith([0, 2000, 5000, 10000, 30000]);
  });

  it('should join and leave ride groups via hub invocations', async () => {
    const conn = await signalRService.connectRideHub();
    await signalRService.joinRide(101);
    expect(conn.invoke).toHaveBeenCalledWith('JoinRide', 101);

    await signalRService.leaveRide(101);
    expect(conn.invoke).toHaveBeenCalledWith('LeaveRide', 101);
  });

  it('should join and leave order groups via hub invocations', async () => {
    const conn = await signalRService.connectOrderHub();
    await signalRService.joinOrder(202);
    expect(conn.invoke).toHaveBeenCalledWith('JoinOrder', 202);

    await signalRService.leaveOrder(202);
    expect(conn.invoke).toHaveBeenCalledWith('LeaveOrder', 202);
  });

  it('should register event listener and return teardown unregister callback to prevent memory leaks', async () => {
    const conn = await signalRService.connectRideHub();
    const mockCallback = jest.fn();

    const unsubscribe = signalRService.onDriverLocationUpdated(mockCallback);
    expect(conn.on).toHaveBeenCalledWith('DriverLocationUpdated', mockCallback);

    // Call teardown
    unsubscribe();
    expect(conn.off).toHaveBeenCalledWith('DriverLocationUpdated', mockCallback);
  });

  it('should unregister OrderStatusUpdated listener on teardown', async () => {
    const conn = await signalRService.connectOrderHub();
    const mockCallback = jest.fn();

    const unsubscribe = signalRService.onOrderStatusUpdated(mockCallback);
    expect(conn.on).toHaveBeenCalledWith('OrderStatusUpdated', mockCallback);

    unsubscribe();
    expect(conn.off).toHaveBeenCalledWith('OrderStatusUpdated', mockCallback);
  });
});
