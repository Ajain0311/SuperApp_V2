import { useRoleStore, normalizeRole, ROLE_CONFIGS, AppRole } from '../../src/store/roleStore';
import { storage } from '../../src/services/storage';

describe('RoleStore - Multi-Role State & Switching Logic', () => {
  beforeEach(async () => {
    await useRoleStore.getState().resetRoles();
    await storage.clearActiveRole();
    jest.clearAllMocks();
  });

  it('should initialize with default CUSTOMER role and single availability', () => {
    const state = useRoleStore.getState();
    expect(state.activeRole).toBe('CUSTOMER');
    expect(state.availableRoles).toEqual(['CUSTOMER']);
    expect(state.hasMultipleRoles).toBe(false);
    expect(state.isRoleSwitching).toBe(false);
  });

  it('should normalize various role string formats correctly', () => {
    expect(normalizeRole('driver')).toBe('DRIVER');
    expect(normalizeRole('Citizen')).toBe('CUSTOMER');
    expect(normalizeRole('vendor')).toBe('RESTAURANT_OWNER');
    expect(normalizeRole('restaurant_owner')).toBe('RESTAURANT_OWNER');
    expect(normalizeRole('seller')).toBe('MARKETPLACE_SELLER');
    expect(normalizeRole('marketplace-seller')).toBe('MARKETPLACE_SELLER');
    expect(normalizeRole('admin')).toBe('ADMIN');
    expect(normalizeRole('unknown_role')).toBeNull();
  });

  it('should sync with user roles and detect multi-role users', async () => {
    const targetRole = await useRoleStore.getState().syncWithUserRoles(['Customer', 'Driver', 'Vendor']);
    
    const state = useRoleStore.getState();
    expect(state.availableRoles).toContain('CUSTOMER');
    expect(state.availableRoles).toContain('DRIVER');
    expect(state.availableRoles).toContain('RESTAURANT_OWNER');
    expect(state.hasMultipleRoles).toBe(true);
    expect(targetRole).toBe('CUSTOMER');
    expect(state.activeRole).toBe('CUSTOMER');
  });

  it('should switch active role if the role is authorized', async () => {
    await useRoleStore.getState().syncWithUserRoles(['Customer', 'Driver']);
    
    const success = await useRoleStore.getState().switchRole('DRIVER');
    expect(success).toBe(true);

    const state = useRoleStore.getState();
    expect(state.activeRole).toBe('DRIVER');

    const saved = await storage.getActiveRole();
    expect(saved).toBe('DRIVER');
  });

  it('should reject switching to an unauthorized role', async () => {
    await useRoleStore.getState().syncWithUserRoles(['Customer']);
    
    const success = await useRoleStore.getState().switchRole('DRIVER');
    expect(success).toBe(false);

    const state = useRoleStore.getState();
    expect(state.activeRole).toBe('CUSTOMER');
  });

  it('should restore previously saved active role on sync if still authorized', async () => {
    await storage.setActiveRole('DRIVER');
    
    const target = await useRoleStore.getState().syncWithUserRoles(['Customer', 'Driver']);
    expect(target).toBe('DRIVER');
    expect(useRoleStore.getState().activeRole).toBe('DRIVER');
  });

  it('should fall back to CUSTOMER if saved role is no longer authorized', async () => {
    await storage.setActiveRole('ADMIN');
    
    // User only has Customer and Driver roles now
    const target = await useRoleStore.getState().syncWithUserRoles(['Customer', 'Driver']);
    expect(target).toBe('CUSTOMER');
    expect(useRoleStore.getState().activeRole).toBe('CUSTOMER');
  });

  it('should provide complete ROLE_CONFIGS for each role', () => {
    const roles: AppRole[] = ['CUSTOMER', 'DRIVER', 'RESTAURANT_OWNER', 'MARKETPLACE_SELLER', 'ADMIN'];
    roles.forEach((r) => {
      const config = ROLE_CONFIGS[r];
      expect(config).toBeDefined();
      expect(config.key).toBe(r);
      expect(config.label.length).toBeGreaterThan(0);
      expect(config.badge.length).toBeGreaterThan(0);
      expect(config.color.startsWith('#')).toBe(true);
    });
  });

  it('should reset store back to default CUSTOMER state on resetRoles()', async () => {
    await useRoleStore.getState().syncWithUserRoles(['Customer', 'Driver', 'Admin']);
    await useRoleStore.getState().switchRole('DRIVER');
    expect(useRoleStore.getState().activeRole).toBe('DRIVER');

    await useRoleStore.getState().resetRoles();
    expect(useRoleStore.getState().activeRole).toBe('CUSTOMER');
    expect(useRoleStore.getState().availableRoles).toEqual(['CUSTOMER']);
    expect(useRoleStore.getState().hasMultipleRoles).toBe(false);
  });
});
