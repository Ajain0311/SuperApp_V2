import {
  mapHotelCommission,
  mapSettlementBatch,
  extractRideFareRules,
  money,
} from '../../src/features/admin/adminFinanceMappers';

describe('adminFinanceMappers', () => {
  it('maps hotel commission DTO fields without crashing on missing amounts', () => {
    const h = mapHotelCommission({
      restaurantId: 2,
      restaurantName: 'UNCLE JOHNS',
      configuredRatePercent: 15,
      grossDeliveredSales: 1200.5,
      totalCommissionEarned: 180,
      pendingCommissionBalance: 90,
      settledCommissionAmount: 90,
      deliveredOrdersCount: 4,
    });
    expect(h.ratePercent).toBe(15);
    expect(h.grossSales).toBe(1200.5);
    expect(h.pendingBalance).toBe(90);
    expect(money(h.grossSales)).toBe('1200.50');
    expect(money(undefined)).toBe('0');
  });

  it('does not throw when legacy wrong field names are missing (blank-page crash case)', () => {
    const h = mapHotelCommission({ restaurantId: 1, restaurantName: 'Test' });
    expect(() => money(h.grossSales)).not.toThrow();
    expect(h.grossSales).toBe(0);
    expect(h.pendingBalance).toBe(0);
  });

  it('maps settlement batch totalCommissionAmount and nested restaurant', () => {
    const b = mapSettlementBatch({
      id: 9,
      restaurantId: 2,
      restaurant: { name: 'UNCLE JOHNS' },
      batchNumber: 'SB-ABC',
      totalCommissionAmount: 500,
      status: 'PENDING_APPROVAL',
      referenceProof: 'CASH-1',
      createdAt: '2026-04-01T00:00:00Z',
      orderCount: 3,
    });
    expect(b.restaurantName).toBe('UNCLE JOHNS');
    expect(b.amount).toBe(500);
    expect(b.status).toBe('PENDING_APPROVAL');
  });

  it('extracts ride fare rules from { rules, options } API envelope', () => {
    const rules = extractRideFareRules({
      rules: [
        {
          vehicleType: 'BIKE',
          baseFare: 25,
          minimumFare: 35,
          includedDistanceKm: 1.5,
          perKmRate: 8,
          perMinuteRate: 1,
          bookingFee: 5,
          platformFee: 4,
          nightSurchargePercent: 10,
          peakMultiplier: 1,
          taxPercentage: 0,
        },
      ],
      options: [{ code: 'PRIORITY' }],
    });
    expect(rules).toHaveLength(1);
    expect(rules[0].vehicleType).toBe('BIKE');
    expect(rules[0].includedDistanceKm).toBe(1.5);
    expect(rules[0].nightSurchargePercent).toBe(10);
  });

  it('returns empty rules for bare object without rules (old UI bug)', () => {
    expect(extractRideFareRules({ options: [] })).toEqual([]);
    expect(extractRideFareRules(null)).toEqual([]);
  });
});
