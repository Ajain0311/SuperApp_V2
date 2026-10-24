import { AppEnvironment } from '../config/environment';

export type MapPlaceSuggestion = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  city?: string;
  state?: string;
  pinCode?: string;
};

export type SelectedMapPlace = {
  latitude: number;
  longitude: number;
  address: string;
  city?: string;
  state?: string;
  pinCode?: string;
};

type MapboxContextItem = {
  id?: string;
  text?: string;
  short_code?: string;
};

type MapboxFeature = {
  id?: string;
  place_name?: string;
  text?: string;
  center?: [number, number];
  context?: MapboxContextItem[];
  address?: string;
};

const GEOCODE_BASE = 'https://api.mapbox.com/geocoding/v5/mapbox.places';

const parseContext = (context: MapboxContextItem[] | undefined) => {
  let localityOrNeighborhood: string | undefined;
  let city: string | undefined;
  let district: string | undefined;
  let state: string | undefined;
  let pinCode: string | undefined;

  for (const item of context || []) {
    const id = String(item.id || '');
    if (id.startsWith('neighborhood.') || id.startsWith('locality.')) {
      if (!localityOrNeighborhood) {
        localityOrNeighborhood = item.text;
      }
    } else if (id.startsWith('place.')) {
      city = city || item.text;
    } else if (id.startsWith('district.')) {
      district = district || item.text;
    } else if (id.startsWith('region.')) {
      state = item.text;
    } else if (id.startsWith('postcode.')) {
      pinCode = item.text;
    }
  }

  const resolvedCity = city || localityOrNeighborhood || district;
  return { localityOrNeighborhood, city: resolvedCity, district, state, pinCode };
};

export const formatDetailedMapboxAddress = (feature: MapboxFeature): string => {
  const title = (feature.text || '').trim();
  const ctx = parseContext(feature.context);

  const parts: string[] = [];
  const seen = new Set<string>();

  const addPart = (val?: string) => {
    if (!val) return;
    const clean = val.trim();
    if (!clean) return;
    const lower = clean.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      parts.push(clean);
    }
  };

  // 1. Specific Street, Colony, or Place name
  addPart(title);

  // 2. Village / Mohalla / Locality / Neighborhood (e.g. Hiran Magri, Uparala Para)
  addPart(ctx.localityOrNeighborhood);

  // 3. City / Town (e.g. Udaipur, Bassi)
  addPart(ctx.city);

  // 4. District (e.g. Chittorgarh if different from city)
  if (ctx.district && ctx.district.toLowerCase() !== ctx.city?.toLowerCase()) {
    addPart(ctx.district);
  }

  // 5. Pincode
  addPart(ctx.pinCode);

  if (parts.length > 0) {
    return parts.join(', ');
  }

  return feature.place_name || title;
};

const featureToSuggestion = (feature: MapboxFeature): MapPlaceSuggestion | null => {
  const lng = feature.center?.[0];
  const lat = feature.center?.[1];
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  const ctx = parseContext(feature.context);
  const detailedAddress = formatDetailedMapboxAddress(feature);
  return {
    id: String(feature.id || `${lat},${lng}`),
    name: feature.text || feature.place_name || 'Selected place',
    address: detailedAddress,
    latitude: lat,
    longitude: lng,
    city: ctx.city,
    state: ctx.state,
    pinCode: ctx.pinCode,
  };
};

export const mapboxService = {
  getAccessToken(): string {
    return AppEnvironment.mapboxAccessToken;
  },

  isConfigured(): boolean {
    return AppEnvironment.hasMapboxToken;
  },

  async searchPlaces(
    query: string,
    proximity?: { latitude: number; longitude: number }
  ): Promise<MapPlaceSuggestion[]> {
    const token = this.getAccessToken();
    const q = query.trim();
    if (!token || q.length < 2) return [];

    const params = new URLSearchParams({
      access_token: token,
      autocomplete: 'true',
      country: 'IN',
      limit: '6',
      types: 'address,poi,place,locality,neighborhood,district',
      language: 'en',
    });
    if (proximity) {
      params.set('proximity', `${proximity.longitude},${proximity.latitude}`);
    }

    const url = `${GEOCODE_BASE}/${encodeURIComponent(q)}.json?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Mapbox search failed (${res.status})`);
    }
    const data = await res.json();
    const features: MapboxFeature[] = Array.isArray(data?.features) ? data.features : [];
    return features.map(featureToSuggestion).filter((x): x is MapPlaceSuggestion => !!x);
  },

  async reverseGeocode(latitude: number, longitude: number): Promise<SelectedMapPlace> {
    const token = this.getAccessToken();
    if (!token) {
      return {
        latitude,
        longitude,
        address: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
      };
    }

    const params = new URLSearchParams({
      access_token: token,
      limit: '1',
      types: 'address,poi,place,locality',
      language: 'en',
    });
    const url = `${GEOCODE_BASE}/${longitude},${latitude}.json?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) {
      return {
        latitude,
        longitude,
        address: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
      };
    }
    const data = await res.json();
    const feature: MapboxFeature | undefined = Array.isArray(data?.features) ? data.features[0] : undefined;
    if (!feature) {
      return {
        latitude,
        longitude,
        address: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
      };
    }
    const suggestion = featureToSuggestion(feature);
    return {
      latitude,
      longitude,
      address: suggestion?.address || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
      city: suggestion?.city,
      state: suggestion?.state,
      pinCode: suggestion?.pinCode,
    };
  },

  async getDirectionsRoute(
    origin: { latitude: number; longitude: number },
    destination: { latitude: number; longitude: number }
  ): Promise<{
    coordinates: [number, number][];
    distanceKm: number;
    durationMinutes: number;
  } | null> {
    const token = this.getAccessToken();
    if (!token) return null;

    try {
      const coords = `${origin.longitude.toFixed(6)},${origin.latitude.toFixed(6)};${destination.longitude.toFixed(6)},${destination.latitude.toFixed(6)}`;
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?geometries=geojson&overview=full&access_token=${token}`;
      const res = await fetch(url);
      if (!res.ok) return null;

      const data = await res.json();
      const route = data?.routes?.[0];
      if (!route || !route.geometry?.coordinates) return null;

      return {
        coordinates: route.geometry.coordinates as [number, number][],
        distanceKm: Number((route.distance / 1000).toFixed(2)),
        durationMinutes: Math.round(route.duration / 60),
      };
    } catch {
      return null;
    }
  },
};
