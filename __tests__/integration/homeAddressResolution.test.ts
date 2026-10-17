import { resolveDeliveryAddress } from '../../src/features/home/HomeScreen';
import { LocationService } from '../../src/services/locationService';

describe('HomeScreen Address Resolution & Fallback Safety', () => {
  it('1. selects the default saved address when multiple addresses exist', () => {
    const addresses = [
      { id: 1, addressLine1: 'Flat 101, Green Heights', city: 'Noida', isDefault: false },
      { id: 2, addressLine1: 'Tower B, Tech Park', city: 'Gurugram', isDefault: true },
      { id: 3, addressLine1: 'House 5, Civil Lines', city: 'Delhi', isDefault: false },
    ];

    const result = resolveDeliveryAddress(addresses);
    expect(result).toBe('Tower B, Tech Park, Gurugram');
  });

  it('2. falls back to the first address when no address is marked as default', () => {
    const addresses = [
      { id: 10, addressLine1: 'Shop 4, Market Square', city: 'Chandigarh', isDefault: false },
      { id: 11, addressLine1: 'Plot 12, Industrial Area', city: 'Mohali', isDefault: false },
    ];

    const result = resolveDeliveryAddress(addresses);
    expect(result).toBe('Shop 4, Market Square, Chandigarh');
  });

  it('3. displays neutral "Add delivery address" label when saved addresses list is empty', () => {
    expect(resolveDeliveryAddress([])).toBe('Add delivery address');
  });

  it('4. displays neutral "Add delivery address" label when API payload is null or undefined (e.g. failed request)', () => {
    expect(resolveDeliveryAddress(null)).toBe('Add delivery address');
    expect(resolveDeliveryAddress(undefined)).toBe('Add delivery address');
    expect(resolveDeliveryAddress({})).toBe('Add delivery address');
    expect(resolveDeliveryAddress('invalid string')).toBe('Add delivery address');
  });

  it('5. never outputs Connaught Place or fabricated address for an empty or failed address lookup', () => {
    const emptyResult = resolveDeliveryAddress([]);
    expect(emptyResult).not.toContain('Connaught Place');
    expect(emptyResult).toBe('Add delivery address');

    const failResult = resolveDeliveryAddress(null);
    expect(failResult).not.toContain('Connaught Place');
    expect(failResult).toBe('Add delivery address');
  });

  it('6. refreshes displayed address when an address is added or changed', () => {
    let mockBackendPayload: any[] = [];
    expect(resolveDeliveryAddress(mockBackendPayload)).toBe('Add delivery address');

    // User adds new address
    mockBackendPayload = [{ id: 1, addressLine1: 'Sector 62', city: 'Noida', isDefault: true }];
    expect(resolveDeliveryAddress(mockBackendPayload)).toBe('Sector 62, Noida');

    // User updates default address to new location
    mockBackendPayload = [
      { id: 1, addressLine1: 'Sector 62', city: 'Noida', isDefault: false },
      { id: 2, addressLine1: 'Cyber City', city: 'Gurugram', isDefault: true },
    ];
    expect(resolveDeliveryAddress(mockBackendPayload)).toBe('Cyber City, Gurugram');
  });

  it('7. ensures LocationService.defaultLocation is explicitly marked as a fallback', () => {
    expect(LocationService.defaultLocation.isFallback).toBe(true);
    expect(LocationService.defaultLocation.latitude).toBe(28.6304);
    expect(LocationService.defaultLocation.longitude).toBe(77.2177);
  });
});
