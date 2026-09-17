import { apiClient } from '../../src/services/apiClient';
import { signalRService, DriverLocationEvent, RideStatusEvent } from '../../src/services/signalr';
import { ApiEndpoints } from '../../src/constants/api';

jest.mock('../../src/services/apiClient');
jest.mock('@microsoft/signalr', () => {
  const listeners: Record<string, Function[]> = {};
  const mockHubConnection = {
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
    invoke: jest.fn().mockResolvedValue(undefined),
    on: jest.fn((event: string, cb: Function) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(cb);
    }),
    off: jest.fn((event: string, cb: Function) => {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter((fn) => fn !== cb);
      }
    }),
    state: 'Connected',
    _emit: (event: string, data: any) => {
      if (listeners[event]) {
        listeners[event].forEach((cb) => cb(data));
      }
    },
  };

  const mockBuilder = {
    withUrl: jest.fn().mockReturnThis(),
    withAutomaticReconnect: jest.fn().mockReturnThis(),
    configureLogging: jest.fn().mockReturnThis(),
    build: jest.fn().mockReturnValue(mockHubConnection),
  };

  return {
    HubConnectionBuilder: jest.fn(() => mockBuilder),
    HubConnectionState: { Connected: 'Connected' },
    LogLevel: { None: 0, Information: 2 },
  };
});

describe('Integration Flow: End-to-End Ride Estimation, Booking, & Driver Tracking', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('completes the entire ride cycle: estimate -> booking -> OTP -> driver location -> cancel', async () => {
    // 1. Get Fare Estimate
    const mockEstimateResponse = {
      distanceKm: 16.4,
      estimatedMinutes: 34,
      trafficCondition: 'Moderate Traffic',
      vehicleOptions: [
        { vehicleType: 'BIKE', title: 'Bike Taxi', estimatedFare: 45.0, etaMinutes: 3 },
        { vehicleType: 'AUTO', title: 'Auto Rickshaw', estimatedFare: 66.0, etaMinutes: 5 },
        { vehicleType: 'CAB', title: 'Economy Cab', estimatedFare: 127.0, etaMinutes: 7 },
      ],
    };

    (apiClient.post as jest.Mock).mockResolvedValueOnce({
      data: { success: true, data: mockEstimateResponse },
    });

    const estimateRes = await apiClient.post(ApiEndpoints.ride.estimate, {
      pickupLat: 28.6304,
      pickupLng: 77.2177,
      pickupAddress: 'Connaught Place, Central Delhi',
      destinationLat: 28.5562,
      destinationLng: 77.1000,
      destinationAddress: 'Terminal 3, IGI Airport (DEL)',
    });

    expect(estimateRes.data.data.distanceKm).toBe(16.4);
    expect(estimateRes.data.data.vehicleOptions).toHaveLength(3);

    // 2. Book Bike Ride
    const mockBookResponse = {
      id: 777,
      rideNumber: 'RD-8842',
      vehicleType: 'BIKE',
      estimatedFare: 45.0,
      status: 'ACCEPTED',
      otpCode: '6194',
      driver: {
        id: 1,
        fullName: 'Amit Singh',
        phone: '+91 98765 01928',
        rating: 4.9,
        vehicleModel: 'Hero Splendor Plus (Black)',
        registrationNumber: 'DL 04 AB 9821',
      },
    };

    (apiClient.post as jest.Mock).mockResolvedValueOnce({
      data: { success: true, data: mockBookResponse },
    });

    const bookRes = await apiClient.post(ApiEndpoints.ride.book, {
      vehicleType: 'BIKE',
      pickupAddress: 'Connaught Place, Central Delhi',
      pickupLatitude: 28.6304,
      pickupLongitude: 77.2177,
      dropoffAddress: 'Terminal 3, IGI Airport (DEL)',
      dropoffLatitude: 28.5562,
      dropoffLongitude: 77.1000,
      paymentMethod: 'CASH',
    });

    expect(bookRes.data.data.rideNumber).toBe('RD-8842');
    expect(bookRes.data.data.otpCode).toBe('6194');
    expect(bookRes.data.data.driver.fullName).toBe('Amit Singh');

    // 3. Connect to SignalR Ride Hub and receive live driver updates
    const conn = await signalRService.connectRideHub();
    await signalRService.joinRide(777);
    expect(conn.invoke).toHaveBeenCalledWith('JoinRide', 777);

    const locationEvents: DriverLocationEvent[] = [];
    const statusEvents: RideStatusEvent[] = [];

    const unsubLoc = signalRService.onDriverLocationUpdated((e) => locationEvents.push(e));
    const unsubStatus = signalRService.onRideStatusChanged((e) => statusEvents.push(e));

    // Simulate driver moving towards pickup
    (conn as any)._emit('DriverLocationUpdated', {
      rideId: 777,
      latitude: 28.6334,
      longitude: 77.2197,
      updatedAt: new Date().toISOString(),
    });

    expect(locationEvents).toHaveLength(1);
    expect(locationEvents[0].latitude).toBe(28.6334);

    // Simulate ride status update
    (conn as any)._emit('RideStatusChanged', {
      rideId: 777,
      status: 'STARTED',
      updatedAt: new Date().toISOString(),
    });

    expect(statusEvents).toHaveLength(1);
    expect(statusEvents[0].status).toBe('STARTED');

    // 4. Cancel Ride
    (apiClient.post as jest.Mock).mockResolvedValueOnce({
      data: { success: true, message: 'Ride cancelled' },
    });

    const cancelRes = await apiClient.post(ApiEndpoints.ride.cancel(777));
    expect(cancelRes.data.success).toBe(true);

    // 5. Cleanup
    unsubLoc();
    unsubStatus();
    await signalRService.leaveRide(777);
    expect(conn.invoke).toHaveBeenCalledWith('LeaveRide', 777);
  });
});
