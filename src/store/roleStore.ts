import { create } from 'zustand';
import { storage } from '../services/storage';

export type AppRole = 'CUSTOMER' | 'ADMIN' | 'DRIVER' | 'RESTAURANT_OWNER' | 'MARKETPLACE_SELLER';

export interface RoleConfig {
  key: AppRole;
  label: string;
  badge: string;
  icon: string;
  tagline: string;
  color: string;
}

export const ROLE_CONFIGS: Record<AppRole, RoleConfig> = {
  CUSTOMER: {
    key: 'CUSTOMER',
    label: 'Citizen',
    badge: '👤 Citizen',
    icon: 'person-circle-outline',
    tagline: 'Ride, Food & Community Services',
    color: '#10B981',
  },
  DRIVER: {
    key: 'DRIVER',
    label: 'Driver',
    badge: '🚗 Driver',
    icon: 'car-sport-outline',
    tagline: 'Accept Trips & Track Live Navigation',
    color: '#3B82F6',
  },
  RESTAURANT_OWNER: {
    key: 'RESTAURANT_OWNER',
    label: 'Restaurant Owner',
    badge: '🏪 Restaurant Owner',
    icon: 'restaurant-outline',
    tagline: 'Kitchen Queue, Menu & Live Orders',
    color: '#F59E0B',
  },
  MARKETPLACE_SELLER: {
    key: 'MARKETPLACE_SELLER',
    label: 'Marketplace Seller',
    badge: '🛍️ Marketplace Seller',
    icon: 'bag-handle-outline',
    tagline: 'Publish & Manage Bazaar Listings',
    color: '#8B5CF6',
  },
  ADMIN: {
    key: 'ADMIN',
    label: 'Administrator',
    badge: '🛡️ Admin',
    icon: 'shield-checkmark-outline',
    tagline: 'Platform KPIs & Oversight Management',
    color: '#EF4444',
  },
};

const ALL_ROLES: AppRole[] = ['CUSTOMER', 'ADMIN', 'DRIVER', 'RESTAURANT_OWNER', 'MARKETPLACE_SELLER'];

export function normalizeRole(roleStr: string): AppRole | null {
  if (!roleStr) return null;
  const upper = roleStr.trim().toUpperCase().replace(/[\s-]/g, '_');
  if (upper === 'CITIZEN' || upper === 'USER') return 'CUSTOMER';
  if (upper === 'VENDOR' || upper === 'RESTAURANT') return 'RESTAURANT_OWNER';
  if (upper === 'SELLER' || upper === 'BAZAAR_SELLER') return 'MARKETPLACE_SELLER';
  if (ALL_ROLES.includes(upper as AppRole)) {
    return upper as AppRole;
  }
  return null;
}

interface RoleState {
  activeRole: AppRole;
  availableRoles: AppRole[];
  hasMultipleRoles: boolean;
  isRoleSwitching: boolean;

  syncWithUserRoles: (userRoles?: string[]) => Promise<AppRole>;
  switchRole: (role: AppRole) => Promise<boolean>;
  resetRoles: () => Promise<void>;
}

export const useRoleStore = create<RoleState>((set, get) => ({
  activeRole: 'CUSTOMER',
  availableRoles: ['CUSTOMER'],
  hasMultipleRoles: false,
  isRoleSwitching: false,

  syncWithUserRoles: async (userRoles?: string[]) => {
    // 1. Normalize and filter valid roles
    const parsedRoles: AppRole[] = [];
    if (userRoles && Array.isArray(userRoles)) {
      for (const r of userRoles) {
        const norm = normalizeRole(r);
        if (norm && !parsedRoles.includes(norm)) {
          parsedRoles.push(norm);
        }
      }
    }

    const available = parsedRoles.length > 0 ? parsedRoles : (['CUSTOMER'] as AppRole[]);
    const hasMultiple = available.length > 1;

    // 2. Check previously saved active role from local storage
    const savedRoleRaw = await storage.getActiveRole();
    const savedRole = savedRoleRaw ? normalizeRole(savedRoleRaw) : null;

    let targetRole: AppRole;
    if (savedRole && available.includes(savedRole)) {
      targetRole = savedRole;
    } else if (available.includes('CUSTOMER')) {
      targetRole = 'CUSTOMER';
    } else {
      targetRole = available[0];
    }

    await storage.setActiveRole(targetRole);

    set({
      activeRole: targetRole,
      availableRoles: available,
      hasMultipleRoles: hasMultiple,
    });

    return targetRole;
  },

  switchRole: async (role: AppRole) => {
    const { availableRoles } = get();
    if (!availableRoles.includes(role)) {
      console.warn(`[RoleStore] Cannot switch to role '${role}'. Not in available roles:`, availableRoles);
      return false;
    }

    set({ isRoleSwitching: true });
    await storage.setActiveRole(role);
    set({ activeRole: role, isRoleSwitching: false });
    return true;
  },

  resetRoles: async () => {
    await storage.clearActiveRole();
    set({
      activeRole: 'CUSTOMER',
      availableRoles: ['CUSTOMER'],
      hasMultipleRoles: false,
      isRoleSwitching: false,
    });
  },
}));
