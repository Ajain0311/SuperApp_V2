# Role Switching System — SuperApp

## 1. Overview

SuperApp enables multi-role users (e.g., an individual who is both a Citizen consumer and a registered Driver or Kitchen Owner) to seamlessly toggle between operational modes within a single mobile app installation without logging out or re-authenticating.

---

## 2. Role Switching Flow

```
[ User in Citizen Mode ]
           |
           v
[ Tap Profile Tab ]
           |
           v
[ Tap "Switch Mode" Card ]
           |
           v
[ RoleSwitchModal Opens ]
  - Lists only authorized roles for this user
  - Displays mode badges, icons, and descriptions
  - Highlights currently active mode
           |
           v
[ Select Target Mode (e.g., Driver) ]
           |
           v
[ useRoleStore.switchRole("DRIVER") ]
  - Validates role against availableRoles
  - Persists to AsyncStorage ('superapp_active_role')
  - Updates activeRole state
           |
           v
[ MainTabNavigator Reacts Dynamically ]
  - Swaps bottom tabs to [Duty/Home, Rides, Earnings, Profile]
  - No app restart or re-login required
```

---

## 3. UI Components & Presentation

### 1. `ProfileScreen` Mode Card
A prominent gradient card on the `ProfileScreen` displays:
- Current active mode badge (e.g., `🚗 Driver Mode` or `👤 Citizen Mode`).
- Quick switcher button (`Switch Mode`).
- Summary of other roles available on this account.

### 2. `RoleSwitchModal`
- **Slide-up bottom sheet modal** presenting selectable roles.
- Each role item shows:
  - Mode Icon (Ionicons / MaterialIcons).
  - Mode Label (e.g., `Driver`, `Restaurant Owner`, `Marketplace Seller`, `Admin`).
  - Short functional tagline (e.g., `Kitchen Queue, Menu & Live Orders`).
  - Checkmark indicator on the currently active mode.
- Non-authorized roles are hidden automatically to prevent confusion.

---

## 4. Role Persistence & Auto-Recovery

1. **Local Storage**:
   When the user switches modes, `storage.setActiveRole(role)` persists the choice to key `superapp_active_role`.
2. **App Launch / Token Rehydration**:
   On app startup, `authStore.checkAuth()` fetches the saved user profile and calls `roleStore.syncWithUserRoles(user.roles)`:
   - If the stored active role exists and is still authorized for this user, it is immediately restored.
   - If the role is no longer authorized (e.g., driver privileges revoked), the app automatically falls back to `CUSTOMER`.
   - If no role was previously stored, it defaults to `CUSTOMER`.

---

## 5. Test Accounts for Rapid Multi-Role Verification

| Account Mobile | Available Roles | Use Cases Tested |
|----------------|-----------------|------------------|
| `6375002348` | `CUSTOMER`, `DRIVER`, `RESTAURANT_OWNER`, `MARKETPLACE_SELLER` | Full multi-mode testing: Consumer booking, Driver fulfillment, Kitchen management, Seller catalog |
| `9999999999` | `ADMIN`, `CUSTOMER` | Administrative oversight, Platform KPIs, switching back to consumer view |
| Any standard user | `CUSTOMER` | Single-role consumer experience (Switch Mode button gracefully hidden or shows single mode) |
