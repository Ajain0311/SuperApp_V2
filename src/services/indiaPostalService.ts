const PINCODE_API = 'https://aniket-thapa.github.io/india-pincode-api';

export type IndiaState = {
  name: string;
  slug: string;
  displayName: string;
};

export type IndiaDistrict = {
  name: string;
  slug: string;
  displayName: string;
};

export type PinLookup = {
  valid: boolean;
  state?: string;
  stateSlug?: string;
  district?: string;
  postOffice?: string;
  latitude?: number;
  longitude?: number;
  message?: string;
};

const titleCase = (value: string) =>
  value
    .toLowerCase()
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

export const indiaPostalService = {
  async getStates(): Promise<IndiaState[]> {
    const res = await fetch(`${PINCODE_API}/states.json`);
    if (!res.ok) throw new Error('Could not load states');
    const rows: Array<{ name: string; slug: string }> = await res.json();
    return rows
      .filter((s) => s.slug && s.slug !== 'na' && s.name && s.name !== 'NA')
      .map((s) => ({
        name: s.name,
        slug: s.slug,
        displayName: titleCase(s.name),
      }));
  },

  async getDistricts(stateSlug: string): Promise<IndiaDistrict[]> {
    const res = await fetch(`${PINCODE_API}/states/${stateSlug}.json`);
    if (!res.ok) throw new Error('Could not load districts');
    const data = await res.json();
    const districts: Array<{ name: string; slug: string }> = data.districts || [];
    return districts.map((d) => ({
      name: d.name,
      slug: d.slug,
      displayName: titleCase(d.name),
    }));
  },

  slugFromDisplay(displayName: string, states: IndiaState[]): string | undefined {
    const needle = displayName.trim().toLowerCase();
    return states.find(
      (s) =>
        s.displayName.toLowerCase() === needle ||
        s.name.toLowerCase() === needle ||
        s.slug === needle.replace(/\s+/g, '-')
    )?.slug;
  },

  async lookupPincode(pin: string): Promise<PinLookup> {
    if (!/^\d{6}$/.test(pin)) {
      return { valid: false, message: 'PIN must be 6 digits' };
    }
    const res = await fetch(`${PINCODE_API}/pincodes/${pin}.json`);
    if (res.status === 404) {
      return { valid: false, message: 'This PIN code was not found' };
    }
    if (!res.ok) {
      return { valid: false, message: 'Could not verify PIN right now' };
    }
    const data = await res.json();
    const offices = Array.isArray(data.offices) ? data.offices : [];
    const withCoords = offices.find((o: any) => o.latitude && o.longitude) || offices[0];
    if (!data.state && !data.district) {
      return { valid: false, message: 'This PIN code was not found' };
    }
    return {
      valid: true,
      state: titleCase(String(data.state || '')),
      stateSlug: String(data.state || '')
        .toLowerCase()
        .replace(/\s+/g, '-'),
      district: titleCase(String(data.district || '')),
      postOffice: withCoords?.officeName,
      latitude: withCoords?.latitude,
      longitude: withCoords?.longitude,
      message: withCoords?.officeName ? `Verified · ${withCoords.officeName}` : 'PIN verified',
    };
  },
};
