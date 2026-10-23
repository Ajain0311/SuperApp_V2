/**
 * Ensures Coupons, Hotel Commission, and Ride Fare admin screens
 * are registered in both AdminNavigator and Root stack route maps.
 */
import { AdminStackParamList } from '../../src/features/admin/types';
import { RootStackParamList } from '../../src/navigation/types';

describe('Admin finance & pricing screen registration', () => {
  const adminRoutes: (keyof AdminStackParamList)[] = [
    'AdminCoupons',
    'AdminHotelCommissions',
    'AdminRideFares',
  ];

  const rootRoutes: (keyof RootStackParamList)[] = [
    'AdminCoupons',
    'AdminHotelCommissions',
    'AdminRideFares',
  ];

  it('AdminStackParamList includes coupons, hotel commissions, and ride fares', () => {
    for (const route of adminRoutes) {
      expect(adminRoutes).toContain(route);
      // Compile-time shape: assigning undefined is valid for these screens
      const params: AdminStackParamList[typeof route] = undefined;
      expect(params).toBeUndefined();
    }
  });

  it('RootStackParamList includes the same three admin finance screens', () => {
    for (const route of rootRoutes) {
      const params: RootStackParamList[typeof route] = undefined;
      expect(params).toBeUndefined();
    }
  });

  it('screen modules export the expected React components', () => {
    const { AdminCouponsScreen } = require('../../src/features/admin/AdminCouponsScreen');
    const { AdminHotelCommissionsScreen } = require('../../src/features/admin/AdminHotelCommissionsScreen');
    const { AdminRideFaresScreen } = require('../../src/features/admin/AdminRideFaresScreen');
    expect(typeof AdminCouponsScreen).toBe('function');
    expect(typeof AdminHotelCommissionsScreen).toBe('function');
    expect(typeof AdminRideFaresScreen).toBe('function');
  });

  it('AdminNavigator and RootNavigator register all three Stack.Screen names', () => {
    // Source-level guard: navigator must list the route names (prevents import-only regressions).
    const fs = require('fs');
    const path = require('path');
    const rootDir = process.cwd();
    const navSrc = fs.readFileSync(path.join(rootDir, 'src/features/admin/AdminNavigator.tsx'), 'utf8');
    const rootSrc = fs.readFileSync(path.join(rootDir, 'src/navigation/RootNavigator.tsx'), 'utf8');

    expect(navSrc).toMatch(/name=["']AdminCoupons["']/);
    expect(navSrc).toMatch(/name=["']AdminHotelCommissions["']/);
    expect(navSrc).toMatch(/name=["']AdminRideFares["']/);

    expect(rootSrc).toMatch(/name=["']AdminCoupons["']/);
    expect(rootSrc).toMatch(/name=["']AdminHotelCommissions["']/);
    expect(rootSrc).toMatch(/name=["']AdminRideFares["']/);
  });
});
