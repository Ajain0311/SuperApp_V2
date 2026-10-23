/** Shared normalizers for admin hotel commission + ride fare API payloads. */

export function num(n: unknown, fallback = 0): number {
  const v = Number(n);
  return Number.isFinite(v) ? v : fallback;
}

export function money(n: unknown): string {
  const v = Number(n);
  if (!Number.isFinite(v)) return '0';
  return v.toFixed(v % 1 === 0 ? 0 : 2);
}

export function mapHotelCommission(raw: any) {
  return {
    restaurantId: Number(raw?.restaurantId ?? raw?.RestaurantId ?? 0),
    restaurantName: String(raw?.restaurantName ?? raw?.RestaurantName ?? 'Restaurant'),
    ratePercent: num(
      raw?.configuredRatePercent ??
        raw?.ConfiguredRatePercent ??
        raw?.effectiveCommissionRatePercent ??
        15
    ),
    deliveredOrdersCount: num(raw?.deliveredOrdersCount ?? raw?.DeliveredOrdersCount),
    grossSales: num(raw?.grossDeliveredSales ?? raw?.GrossDeliveredSales ?? raw?.grossSalesAmount),
    totalCommission: num(raw?.totalCommissionEarned ?? raw?.TotalCommissionEarned),
    pendingBalance: num(
      raw?.pendingCommissionBalance ?? raw?.PendingCommissionBalance ?? raw?.pendingBalance
    ),
    settledAmount: num(raw?.settledCommissionAmount ?? raw?.SettledCommissionAmount),
  };
}

export function mapSettlementBatch(raw: any) {
  const restaurant = raw?.restaurant ?? raw?.Restaurant;
  return {
    id: Number(raw?.id ?? raw?.Id ?? 0),
    restaurantId: Number(raw?.restaurantId ?? raw?.RestaurantId ?? 0),
    restaurantName: String(
      restaurant?.name ?? restaurant?.Name ?? raw?.restaurantName ?? `Restaurant #${raw?.restaurantId ?? ''}`
    ),
    batchNumber: String(raw?.batchNumber ?? raw?.BatchNumber ?? `BATCH-${raw?.id ?? ''}`),
    amount: num(
      raw?.totalCommissionAmount ??
        raw?.TotalCommissionAmount ??
        raw?.totalSettledAmount ??
        raw?.amount
    ),
    status: String(raw?.status ?? raw?.Status ?? 'PENDING'),
    reference: String(raw?.referenceProof ?? raw?.ReferenceProof ?? raw?.collectionReference ?? ''),
    createdAt: String(raw?.createdAt ?? raw?.CreatedAt ?? ''),
    orderCount: num(raw?.orderCount ?? raw?.OrderCount),
  };
}

export interface MappedFareRule {
  vehicleType: string;
  baseFare: number;
  minimumFare: number;
  includedDistanceKm: number;
  perKmRate: number;
  perMinuteRate: number;
  bookingFee: number;
  platformFee: number;
  taxPercentage: number;
  nightSurchargePercent: number;
  peakMultiplier: number;
  isActive: boolean;
}

export function mapRideFareRule(raw: any): MappedFareRule {
  return {
    vehicleType: String(raw?.vehicleType ?? raw?.VehicleType ?? '').toUpperCase(),
    baseFare: num(raw?.baseFare ?? raw?.BaseFare),
    minimumFare: num(raw?.minimumFare ?? raw?.MinimumFare),
    includedDistanceKm: num(raw?.includedDistanceKm ?? raw?.IncludedDistanceKm ?? raw?.baseDistanceKm),
    perKmRate: num(raw?.perKmRate ?? raw?.PerKmRate),
    perMinuteRate: num(raw?.perMinuteRate ?? raw?.PerMinuteRate),
    bookingFee: num(raw?.bookingFee ?? raw?.BookingFee),
    platformFee: num(raw?.platformFee ?? raw?.PlatformFee),
    taxPercentage: num(raw?.taxPercentage ?? raw?.TaxPercentage ?? raw?.taxPercent),
    nightSurchargePercent: num(
      raw?.nightSurchargePercent ?? raw?.NightSurchargePercent ?? raw?.nightSurchargeMultiplier
    ),
    peakMultiplier: num(raw?.peakMultiplier ?? raw?.PeakMultiplier ?? raw?.surgeMultiplier, 1),
    isActive: raw?.isActive !== false && raw?.IsActive !== false,
  };
}

/** GET /admin/ride-fares returns { rules, options } inside data. */
export function extractRideFareRules(payload: any): MappedFareRule[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload.map(mapRideFareRule);
  const rules = payload.rules ?? payload.Rules;
  if (Array.isArray(rules)) return rules.map(mapRideFareRule);
  return [];
}
