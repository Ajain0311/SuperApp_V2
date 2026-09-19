import { driverService } from '../../src/services/driverService';
import { apiClient } from '../../src/services/apiClient';

jest.mock('../../src/services/apiClient');

describe('DriverService - Backend API Contracts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches driver profile including vehicle information', async () => {
    (apiClient.get as jest.Mock).mockResolvedValueOnce({
      success: true,
      data: {
        id: 10,
        userId: 42,
        fullName: 'Test Driver',
        mobileNumber: '6375002348',
        isVerified: true,
        isOnline: true,
        rating: 4.85,
        totalRides: 150,
        vehicle: {
          id: 5,
          type: 'Sedan',
          make: 'Maruti',
          model: 'Dzire',
          registrationNumber: 'DL01AB1234',
        },
      },
    });

    const profile = await driverService.getProfile();
    expect(profile.id).toBe(10);
    expect(profile.fullName).toBe('Test Driver');
    expect(profile.vehicle?.registrationNumber).toBe('DL01AB1234');
    expect(apiClient.get).toHaveBeenCalledWith('/driver/profile');
  });

  it('toggles duty status to online/offline', async () => {
    (apiClient.post as jest.Mock).mockResolvedValueOnce({
      success: true,
      data: true,
    });

    const result = await driverService.toggleOnline(true);
    expect(result).toBe(true);
    expect(apiClient.post).toHaveBeenCalledWith('/driver/toggle-online', { isOnline: true });
  });

  it('fetches available rides for dispatch', async () => {
    (apiClient.get as jest.Mock).mockResolvedValueOnce({
      success: true,
      data: [
        {
          id: 101,
          rideNumber: 'RD-00101',
          pickupAddress: 'Connaught Place',
          dropoffAddress: 'Terminal 3, IGI',
          fare: 450,
          status: 'SEARCHING',
          customerName: 'Aman Sharma',
          customerPhone: '9876543210',
        },
      ],
    });

    const rides = await driverService.getAvailableRides();
    expect(rides).toHaveLength(1);
    expect(rides[0].rideNumber).toBe('RD-00101');
    expect(apiClient.get).toHaveBeenCalledWith('/driver/available-rides');
  });

  it('accepts a ride request', async () => {
    (apiClient.post as jest.Mock).mockResolvedValueOnce({
      success: true,
      data: { id: 101, status: 'ACCEPTED' },
    });

    const ride = await driverService.acceptRide(101);
    expect(ride.status).toBe('ACCEPTED');
    expect(apiClient.post).toHaveBeenCalledWith('/driver/rides/101/accept');
  });

  it('marks arriving at pickup', async () => {
    (apiClient.post as jest.Mock).mockResolvedValueOnce({ success: true });

    await driverService.markArriving(101);
    expect(apiClient.post).toHaveBeenCalledWith('/driver/rides/101/arriving');
  });

  it('starts ride with valid customer OTP', async () => {
    (apiClient.post as jest.Mock).mockResolvedValueOnce({ success: true });

    await driverService.startRide(101, '4321');
    expect(apiClient.post).toHaveBeenCalledWith('/driver/rides/101/start', { otpCode: '4321' });
  });

  it('completes ride upon reaching destination', async () => {
    (apiClient.post as jest.Mock).mockResolvedValueOnce({ success: true });

    await driverService.completeRide(101);
    expect(apiClient.post).toHaveBeenCalledWith('/driver/rides/101/complete');
  });

  it('cancels ride with reason', async () => {
    (apiClient.post as jest.Mock).mockResolvedValueOnce({ success: true });

    await driverService.cancelRide(101, 'Customer not reachable');
    expect(apiClient.post).toHaveBeenCalledWith('/driver/rides/101/cancel', {
      reason: 'Customer not reachable',
    });
  });

  it('updates driver location telemetry', async () => {
    (apiClient.post as jest.Mock).mockResolvedValueOnce({ success: true });

    await driverService.updateLocation(28.6139, 77.2090, 101, 180, 25);
    expect(apiClient.post).toHaveBeenCalledWith('/driver/location', {
      latitude: 28.6139,
      longitude: 77.2090,
      rideId: 101,
      heading: 180,
      speed: 25,
    });
  });

  it('fetches driver earnings summary', async () => {
    (apiClient.get as jest.Mock).mockResolvedValueOnce({
      success: true,
      data: {
        todayEarnings: 1250,
        todayRides: 4,
        weeklyEarnings: 8500,
        weeklyRides: 28,
        totalEarnings: 34200,
        totalRides: 112,
        recentTrips: [],
      },
    });

    const earnings = await driverService.getEarnings();
    expect(earnings.todayEarnings).toBe(1250);
    expect(earnings.todayRides).toBe(4);
    expect(apiClient.get).toHaveBeenCalledWith('/driver/earnings');
  });
});
