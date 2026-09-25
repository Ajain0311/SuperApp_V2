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
  let city: string | undefined;
  let state: string | undefined;
  let pinCode: string | undefined;
  for (const item of context || []) {
    const id = String(item.id || '');
    if (id.startsWith('place.') || id.startsWith('locality.') || id.startsWith('district.')) {
      city = city || item.text;
    } else if (id.startsWith('region.')) {
      state = item.text;
    } else if (id.startsWith('postcode.')) {
      pinCode = item.text;
    }
  }
  return { city, state, pinCode };
};

const featureToSuggestion = (feature: MapboxFeature): MapPlaceSuggestion | null => {
  const lng = feature.center?.[0];
  const lat = feature.center?.[1];
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  const ctx = parseContext(feature.context);
  return {
    id: String(feature.id || `${lat},${lng}`),
    name: feature.text || feature.place_name || 'Selected place',
    address: feature.place_name || feature.text || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
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
};
