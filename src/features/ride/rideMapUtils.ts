/**
 * Pure helpers for Rapido-style in-app ride map phases.
 * Phase must follow authoritative backend ride status (not a local button press).
 */

export type LatLng = { latitude: number; longitude: number };

export type RideMapPhase = 'searching' | 'to_pickup' | 'to_destination' | 'terminal';

const TERMINAL = new Set(['COMPLETED', 'CANCELLED', 'EXPIRED', 'FAILED']);

export function isValidLatLng(c: LatLng | null | undefined): c is LatLng {
  if (!c) return false;
  const lat = Number(c.latitude);
  const lng = Number(c.longitude);
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

export function normalizeRideStatus(status: string | null | undefined): string {
  return String(status || '').trim().toUpperCase();
}

export function isTerminalRideStatus(status: string | null | undefined): boolean {
  return TERMINAL.has(normalizeRideStatus(status));
}

/** Map navigation phase from backend ride status. */
export function getRideMapPhase(status: string | null | undefined): RideMapPhase {
  const s = normalizeRideStatus(status);
  if (TERMINAL.has(s)) return 'terminal';
  if (s === 'STARTED') return 'to_destination';
  if (s === 'ACCEPTED' || s === 'ARRIVING') return 'to_pickup';
  return 'searching';
}

/** Destination must stay hidden until the ride has legitimately started (OTP verified). */
export function shouldRevealDestination(phase: RideMapPhase): boolean {
  return phase === 'to_destination' || phase === 'terminal';
}

export function haversineMeters(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Resolve Mapbox directions origin/destination for the current phase.
 * Phase A (to_pickup): driver → pickup
 * Phase B (to_destination): driver → dropoff (fallback pickup → dropoff)
 */
export function resolveRouteEndpoints(args: {
  phase: RideMapPhase;
  driver: LatLng | null;
  pickup: LatLng | null;
  dropoff: LatLng | null;
}): { origin: LatLng; destination: LatLng } | null {
  const { phase, driver, pickup, dropoff } = args;

  if (phase === 'terminal' || phase === 'searching') {
    return null;
  }

  if (phase === 'to_pickup') {
    if (!isValidLatLng(pickup)) return null;
    if (!isValidLatLng(driver)) return null;
    return { origin: driver, destination: pickup };
  }

  // to_destination
  if (!isValidLatLng(dropoff)) return null;
  if (isValidLatLng(driver)) return { origin: driver, destination: dropoff };
  if (isValidLatLng(pickup)) return { origin: pickup, destination: dropoff };
  return null;
}

export type RouteRecalcSnapshot = {
  origin: LatLng;
  destination: LatLng;
  at: number;
};

/** Throttle Mapbox Directions calls: interval + minimum movement, always allow destination jump (phase switch). */
export function shouldRecalculateRoute(
  last: RouteRecalcSnapshot | null,
  next: { origin: LatLng; destination: LatLng },
  nowMs: number,
  opts?: { minIntervalMs?: number; minMoveMeters?: number }
): boolean {
  const minIntervalMs = opts?.minIntervalMs ?? 15000;
  const minMoveMeters = opts?.minMoveMeters ?? 45;

  if (!last) return true;

  const destMoved = haversineMeters(last.destination, next.destination);
  if (destMoved > 25) return true; // phase switch or new target

  if (nowMs - last.at < minIntervalMs) return false;

  const originMoved = haversineMeters(last.origin, next.origin);
  return originMoved >= minMoveMeters;
}

export type LineFeature = {
  type: 'Feature';
  properties: Record<string, unknown>;
  geometry: { type: 'LineString'; coordinates: [number, number][] };
};

export function buildLineGeoJson(
  coordinates: [number, number][] | null,
  fallback?: { origin: LatLng; destination: LatLng } | null
): LineFeature | null {
  if (coordinates && coordinates.length > 1) {
    return {
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates },
    };
  }
  if (fallback && isValidLatLng(fallback.origin) && isValidLatLng(fallback.destination)) {
    return {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: [
          [fallback.origin.longitude, fallback.origin.latitude],
          [fallback.destination.longitude, fallback.destination.latitude],
        ],
      },
    };
  }
  return null;
}

/** Camera bounds padding helper for fitting driver + targets. */
export function collectMapPoints(args: {
  phase: RideMapPhase;
  driver: LatLng | null;
  pickup: LatLng | null;
  dropoff: LatLng | null;
}): LatLng[] {
  const pts: LatLng[] = [];
  if (isValidLatLng(args.driver)) pts.push(args.driver);
  if (isValidLatLng(args.pickup)) pts.push(args.pickup);
  if (shouldRevealDestination(args.phase) && isValidLatLng(args.dropoff)) {
    pts.push(args.dropoff);
  }
  return pts;
}

export function boundsFromPoints(points: LatLng[]): {
  ne: [number, number];
  sw: [number, number];
} | null {
  if (!points.length) return null;
  let minLat = points[0].latitude;
  let maxLat = points[0].latitude;
  let minLng = points[0].longitude;
  let maxLng = points[0].longitude;
  for (const p of points) {
    minLat = Math.min(minLat, p.latitude);
    maxLat = Math.max(maxLat, p.latitude);
    minLng = Math.min(minLng, p.longitude);
    maxLng = Math.max(maxLng, p.longitude);
  }
  // Pad tiny bounds so Camera.fitBounds does not explode zoom
  if (Math.abs(maxLat - minLat) < 0.002) {
    minLat -= 0.004;
    maxLat += 0.004;
  }
  if (Math.abs(maxLng - minLng) < 0.002) {
    minLng -= 0.004;
    maxLng += 0.004;
  }
  return {
    ne: [maxLng, maxLat],
    sw: [minLng, minLat],
  };
}
