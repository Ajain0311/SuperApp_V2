import {
  getRideMapPhase,
  shouldRevealDestination,
  resolveRouteEndpoints,
  shouldRecalculateRoute,
  isValidLatLng,
  isTerminalRideStatus,
  buildLineGeoJson,
  collectMapPoints,
} from '../../src/features/ride/rideMapUtils';

describe('rideMapUtils', () => {
  const driver = { latitude: 26.91, longitude: 75.78 };
  const pickup = { latitude: 26.92, longitude: 75.79 };
  const dropoff = { latitude: 26.95, longitude: 75.82 };

  it('rejects invalid / zero coordinates', () => {
    expect(isValidLatLng(null)).toBe(false);
    expect(isValidLatLng({ latitude: 0, longitude: 0 })).toBe(false);
    expect(isValidLatLng({ latitude: 91, longitude: 75 })).toBe(false);
    expect(isValidLatLng(driver)).toBe(true);
  });

  it('maps backend status to ride map phases', () => {
    expect(getRideMapPhase('REQUESTED')).toBe('searching');
    expect(getRideMapPhase('ACCEPTED')).toBe('to_pickup');
    expect(getRideMapPhase('ARRIVING')).toBe('to_pickup');
    expect(getRideMapPhase('STARTED')).toBe('to_destination');
    expect(getRideMapPhase('COMPLETED')).toBe('terminal');
    expect(getRideMapPhase('CANCELLED')).toBe('terminal');
    expect(getRideMapPhase('EXPIRED')).toBe('terminal');
  });

  it('hides destination until ride is STARTED (OTP verified)', () => {
    expect(shouldRevealDestination(getRideMapPhase('ACCEPTED'))).toBe(false);
    expect(shouldRevealDestination(getRideMapPhase('ARRIVING'))).toBe(false);
    expect(shouldRevealDestination(getRideMapPhase('STARTED'))).toBe(true);
  });

  it('Phase A: after accept, route is driver → pickup (not destination)', () => {
    const endpoints = resolveRouteEndpoints({
      phase: 'to_pickup',
      driver,
      pickup,
      dropoff,
    });
    expect(endpoints).toEqual({ origin: driver, destination: pickup });
    expect(endpoints?.destination).not.toEqual(dropoff);
  });

  it('OTP not verified yet: missing driver coords yields no fabricated route', () => {
    expect(
      resolveRouteEndpoints({ phase: 'to_pickup', driver: null, pickup, dropoff })
    ).toBeNull();
  });

  it('Phase B: after STARTED, route switches toward destination', () => {
    const endpoints = resolveRouteEndpoints({
      phase: 'to_destination',
      driver,
      pickup,
      dropoff,
    });
    expect(endpoints).toEqual({ origin: driver, destination: dropoff });
  });

  it('terminal statuses stop active navigation routing', () => {
    expect(isTerminalRideStatus('CANCELLED')).toBe(true);
    expect(resolveRouteEndpoints({ phase: 'terminal', driver, pickup, dropoff })).toBeNull();
  });

  it('throttles recalculation for tiny GPS jitter', () => {
    const last = { origin: driver, destination: pickup, at: 1_000_000 };
    const almostSame = {
      origin: { latitude: driver.latitude + 0.00001, longitude: driver.longitude },
      destination: pickup,
    };
    expect(shouldRecalculateRoute(last, almostSame, 1_005_000)).toBe(false);
  });

  it('recalculates when destination jumps (phase switch)', () => {
    const last = { origin: driver, destination: pickup, at: 1_000_000 };
    const next = { origin: driver, destination: dropoff };
    expect(shouldRecalculateRoute(last, next, 1_001_000)).toBe(true);
  });

  it('does not cross rides: collect points honor destination reveal rules', () => {
    const pre = collectMapPoints({ phase: 'to_pickup', driver, pickup, dropoff });
    expect(pre).toHaveLength(2);
    expect(pre.some((p) => p.latitude === dropoff.latitude)).toBe(false);

    const post = collectMapPoints({ phase: 'to_destination', driver, pickup, dropoff });
    expect(post.some((p) => p.latitude === dropoff.latitude)).toBe(true);
  });

  it('buildLineGeoJson prefers road geometry over straight fallback', () => {
    const road = buildLineGeoJson(
      [
        [75.78, 26.91],
        [75.785, 26.915],
        [75.79, 26.92],
      ],
      { origin: driver, destination: pickup }
    );
    expect(road?.geometry.coordinates).toHaveLength(3);
  });

  it('missing Mapbox geometry falls back to straight line without inventing points', () => {
    const line = buildLineGeoJson(null, { origin: driver, destination: pickup });
    expect(line?.geometry.coordinates).toEqual([
      [driver.longitude, driver.latitude],
      [pickup.longitude, pickup.latitude],
    ]);
    expect(buildLineGeoJson(null, null)).toBeNull();
  });
});
