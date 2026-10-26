import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
  Platform,
  Modal,
  TextInput,
  ActivityIndicator,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../store/authStore';
import { useRoleStore, ROLE_CONFIGS } from '../../store/roleStore';
import { RoleSwitchModal } from '../../components/RoleSwitchModal';
import { apiClient } from '../../services/apiClient';
import { ApiEndpoints } from '../../constants/api';
import { FormKeyboardAvoid } from '../../components/common/FormKeyboardAvoid';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

interface MenuItemProps {
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  subtitle: string;
  color: string;
  onPress: () => void;
  badgeLabel?: string | null;
  badgeColor?: string;
}

const MenuItem: React.FC<MenuItemProps> = ({
  icon,
  title,
  subtitle,
  color,
  onPress,
  badgeLabel,
  badgeColor,
}) => {
  return (
    <TouchableOpacity activeOpacity={0.7} style={styles.menuItem} onPress={onPress}>
      <View style={[styles.menuIconContainer, { backgroundColor: `${color}26` }]}>
        <MaterialIcons name={icon} size={22} color={color} />
      </View>
      <View style={styles.menuContent}>
        <View style={styles.menuTitleRow}>
          <Text style={styles.menuTitle}>{title}</Text>
          {badgeLabel ? (
            <View style={[styles.roleBadge, { backgroundColor: `${badgeColor || color}33` }]}>
              <Text style={[styles.roleBadgeText, { color: badgeColor || color }]}>{badgeLabel}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.menuSubtitle}>{subtitle}</Text>
      </View>
      <MaterialIcons name="chevron-right" size={20} color={colors.textTertiary} />
    </TouchableOpacity>
  );
};

function latestStatusForRole(
  apps: Array<{ requestedRole?: string; status?: string; createdAt?: string }>,
  role: string
): string | null {
  const forRole = apps
    .filter((a) => String(a.requestedRole || '').toUpperCase() === role)
    .sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });
  return forRole[0]?.status ? String(forRole[0].status).toUpperCase() : null;
}

function roleAppBadge(status: string | null): { label: string; color: string; subtitle: string } | null {
  if (!status) return null;
  if (status === 'PENDING') {
    return {
      label: 'Pending',
      color: '#F59E0B',
      subtitle: 'Application under admin review — tap to view status',
    };
  }
  if (status === 'APPROVED') {
    return {
      label: 'Approved',
      color: '#10B981',
      subtitle: 'Approved — tap to add another vehicle or outlet',
    };
  }
  if (status === 'REJECTED') {
    return {
      label: 'Rejected',
      color: '#EF4444',
      subtitle: 'Rejected — tap to see reason and apply again',
    };
  }
  if (status === 'CANCELLED') {
    return {
      label: 'Cancelled',
      color: '#94A3B8',
      subtitle: 'Cancelled — tap to submit again',
    };
  }
  return { label: status, color: colors.textSecondary, subtitle: `Status: ${status}` };
}

export const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, logout, updateUser } = useAuthStore();
  const { activeRole, hasMultipleRoles } = useRoleStore();
  const [roleModalVisible, setRoleModalVisible] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [driverAppStatus, setDriverAppStatus] = useState<string | null>(null);
  const [hotelAppStatus, setHotelAppStatus] = useState<string | null>(null);
  const activeConfig = ROLE_CONFIGS[activeRole] || ROLE_CONFIGS.CUSTOMER;

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const res = await apiClient.get<any>(ApiEndpoints.roleApplications.mine);
          const data = res?.data?.data ?? res?.data;
          const list = Array.isArray(data) ? data : [];
          if (cancelled) return;
          setDriverAppStatus(latestStatusForRole(list, 'DRIVER'));
          setHotelAppStatus(latestStatusForRole(list, 'RESTAURANT_OWNER'));
        } catch {
          if (!cancelled) {
            setDriverAppStatus(null);
            setHotelAppStatus(null);
          }
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const driverBadge = roleAppBadge(driverAppStatus);
  const hotelBadge = roleAppBadge(hotelAppStatus);

  const openEditName = () => {
    setEditName(String(user?.fullName || '').trim());
    setEditVisible(true);
  };

  const handleSaveName = async () => {
    const next = editName.trim().replace(/\s+/g, ' ');
    if (!next) {
      Alert.alert('Name Required', 'Please enter your name.');
      return;
    }
    if (next.length < 2) {
      Alert.alert('Too Short', 'Name must be at least 2 characters.');
      return;
    }
    if (next.length > 100) {
      Alert.alert('Too Long', 'Name must be 100 characters or fewer.');
      return;
    }
    if (next === String(user?.fullName || '').trim()) {
      setEditVisible(false);
      return;
    }

    setSavingName(true);
    try {
      const res = await apiClient.put<any>(ApiEndpoints.auth.profile, { fullName: next });
      const data = res?.data?.data || res?.data || {};
      const savedName = String(data.fullName || data.FullName || next).trim();
      updateUser({ fullName: savedName });
      setEditVisible(false);
      Alert.alert('Updated', 'Your name has been saved.');
    } catch (e: any) {
      Alert.alert('Update Failed', e?.message || 'Could not update your name. Please try again.');
    } finally {
      setSavingName(false);
    }
  };

  const performLogout = async () => {
    try {
      await logout();
    } finally {
      navigation.reset({
        index: 0,
        routes: [{ name: 'PhoneEntry' }],
      });
    }
  };

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: () => {
          void performLogout();
        },
      },
    ]);
  };

  const name = user?.fullName || 'John Doe';
  const phone = user?.mobileNumber ? `+91 ${user.mobileNumber}` : '+91 98765 43210';
  const initials =
    name
      .split(' ')
      .filter(Boolean)
      .map((n: string) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase() || 'JD';

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <MaterialIcons name="chevron-left" size={28} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Account</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarGradient}>
            <Text style={styles.avatarInitials}>{initials}</Text>
          </View>

          <View style={styles.profileMeta}>
            <Text style={styles.profileName}>{name}</Text>
            <Text style={styles.profilePhone}>{phone}</Text>
            <View style={styles.verifiedBadge}>
              <Text style={styles.verifiedBadgeText}>Verified Member</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.editBtn}
            onPress={openEditName}
            accessibilityRole="button"
            accessibilityLabel="Edit name"
          >
            <MaterialIcons name="edit" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Multi-Role Switcher Card */}
        {hasMultipleRoles && (
          <TouchableOpacity
            style={[styles.roleSwitchCard, { borderColor: `${activeConfig.color}60` }]}
            activeOpacity={0.8}
            onPress={() => setRoleModalVisible(true)}
          >
            <View style={[styles.roleIconBox, { backgroundColor: `${activeConfig.color}25` }]}>
              <Ionicons name={activeConfig.icon as any} size={24} color={activeConfig.color} />
            </View>
            <View style={styles.roleTextCol}>
              <View style={styles.roleHeaderRow}>
                <Text style={styles.roleLabel}>CURRENT APP MODE</Text>
                <View style={[styles.switchBadge, { backgroundColor: activeConfig.color }]}>
                  <Text style={styles.switchBadgeText}>SWITCH</Text>
                </View>
              </View>
              <Text style={[styles.roleTitle, { color: activeConfig.color }]}>{activeConfig.badge}</Text>
              <Text style={styles.roleSubtitle}>{activeConfig.tagline}</Text>
            </View>
            <MaterialIcons name="swap-horiz" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        )}

        {/* Section 1: Activity & Orders */}
        <Text style={styles.sectionHeader}>Activity & Orders</Text>
        <View style={styles.sectionCard}>
          <MenuItem
            icon="fastfood"
            title="Food Orders"
            subtitle="Past deliveries & tracking"
            color={colors.secondary}
            onPress={() => navigation.navigate('Activity', { initialTab: 0 })}
          />
          <View style={styles.itemDivider} />
          <MenuItem
            icon="directions-bike"
            title="My Rides"
            subtitle="Trip receipts & ride history"
            color={colors.blue}
            onPress={() => navigation.navigate('Activity', { initialTab: 1 })}
          />
          <View style={styles.itemDivider} />
          <MenuItem
            icon="store"
            title="Marketplace Listings"
            subtitle="Your active and sold items"
            color={colors.primary}
            onPress={() => navigation.navigate('Activity', { initialTab: 2 })}
          />
        </View>

        {/* Grow with SuperApp — role requests */}
        <Text style={styles.sectionHeader}>Grow with SuperApp</Text>
        <View style={styles.sectionCard}>
          <MenuItem
            icon="two-wheeler"
            title="Become a Rider / Captain"
            subtitle={
              driverBadge?.subtitle ||
              'Bike, Auto, or Car/Taxi — admin approves each vehicle'
            }
            color={colors.blue}
            badgeLabel={driverBadge?.label}
            badgeColor={driverBadge?.color}
            onPress={() => navigation.navigate('RoleApplication', { role: 'DRIVER' })}
          />
          <View style={styles.itemDivider} />
          <MenuItem
            icon="restaurant"
            title="Open a Hotel / Cafe"
            subtitle={
              hotelBadge?.subtitle ||
              'Hotel, restaurant, or cafe — admin approves each outlet'
            }
            color={colors.secondary}
            badgeLabel={hotelBadge?.label}
            badgeColor={hotelBadge?.color}
            onPress={() => navigation.navigate('RoleApplication', { role: 'RESTAURANT_OWNER' })}
          />
          <View style={styles.itemDivider} />
          <MenuItem
            icon="storefront"
            title="Sell on Bazaar"
            subtitle="Anyone can sell — no admin approval needed"
            color={colors.primary}
            onPress={() =>
              Alert.alert(
                'Marketplace',
                'Any citizen can sell on Bazaar. Open the Bazaar tab and tap Post Ad / Add Listing. Seller role is granted automatically when you publish.',
                [
                  { text: 'OK', style: 'cancel' },
                  {
                    text: 'Go to Bazaar',
                    onPress: () => navigation.navigate('MainTabs', { screen: 'Bazaar' } as any),
                  },
                ]
              )
            }
          />
        </View>

        {/* Section 2: Account Settings */}
        <Text style={styles.sectionHeader}>Account Settings</Text>
        <View style={styles.sectionCard}>
          <MenuItem
            icon="location-on"
            title="Saved Addresses"
            subtitle="Home, Work, and other addresses"
            color={colors.yellow}
            onPress={() => navigation.navigate('SavedAddresses')}
          />
          <View style={styles.itemDivider} />
          <MenuItem
            icon="notifications"
            title="Notifications"
            subtitle="Order updates & promotional alerts"
            color={colors.blue}
            onPress={() => navigation.navigate('Notifications')}
          />
          <View style={styles.itemDivider} />
          <MenuItem
            icon="credit-card"
            title="Payment Methods"
            subtitle="Cards, UPI, & Netbanking via Razorpay"
            color={colors.secondary}
            onPress={() => Alert.alert('Payment Methods', 'UPI, Cards, and Netbanking are available directly at checkout via Razorpay.')}
          />
          <View style={styles.itemDivider} />
          <MenuItem
            icon="headset-mic"
            title="Help & Support"
            subtitle="FAQ, call, WhatsApp & email"
            color={colors.purple}
            onPress={() => navigation.navigate('HelpSupport')}
          />
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <MaterialIcons name="logout" size={20} color={colors.error} />
          <Text style={styles.logoutButtonText}>Log Out</Text>
        </TouchableOpacity>

        {/* App Version Info */}
        <Text style={styles.versionText}>RJ09 SEWA v1.0.0 (Unified Multi-Role)</Text>
      </ScrollView>

      <RoleSwitchModal
        visible={roleModalVisible}
        onClose={() => setRoleModalVisible(false)}
      />

      <Modal
        visible={editVisible}
        transparent
        animationType="slide"
        onRequestClose={() => !savingName && setEditVisible(false)}
      >
        <FormKeyboardAvoid style={styles.editKeyboardRoot}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <View style={styles.editOverlay}>
              <View style={styles.editSheet}>
                <View style={styles.editHeader}>
                  <Text style={styles.editTitle}>Edit name</Text>
                  <TouchableOpacity
                    onPress={() => !savingName && setEditVisible(false)}
                    disabled={savingName}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <MaterialIcons name="close" size={22} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.editHint}>
                  Only your display name can be changed. Phone number stays fixed.
                </Text>
                <Text style={styles.editLabel}>Name</Text>
                <TextInput
                  style={styles.editInput}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Your name"
                  placeholderTextColor={colors.textTertiary}
                  maxLength={100}
                  autoFocus
                  editable={!savingName}
                  returnKeyType="done"
                  onSubmitEditing={() => void handleSaveName()}
                />
                <Text style={styles.editLabel}>Phone</Text>
                <View style={styles.editPhoneBox}>
                  <Text style={styles.editPhoneText}>{phone}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.editSaveBtn, savingName && { opacity: 0.7 }]}
                  onPress={() => void handleSaveName()}
                  disabled={savingName}
                  activeOpacity={0.85}
                >
                  {savingName ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.editSaveText}>Save name</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </FormKeyboardAvoid>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarGradient: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  profileMeta: {
    marginLeft: 16,
    flex: 1,
  },
  profileName: {
    ...typography.bodyLarge,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  profilePhone: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 3,
  },
  verifiedBadge: {
    backgroundColor: 'rgba(0, 200, 83, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  verifiedBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.secondary,
  },
  editBtn: {
    padding: spacing.xs,
  },
  sectionHeader: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    fontWeight: '700',
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuContent: {
    flex: 1,
    marginLeft: 14,
  },
  menuTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  menuTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  menuSubtitle: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: 2,
  },
  itemDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginLeft: 68,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 83, 80, 0.1)',
    borderRadius: 14,
    height: 50,
    marginTop: spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(239, 83, 80, 0.25)',
    gap: 8,
  },
  logoutButtonText: {
    ...typography.bodyMedium,
    color: colors.error,
    fontWeight: '700',
  },
  versionText: {
    textAlign: 'center',
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: spacing.lg,
  },
  roleSwitchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: spacing.md,
    marginTop: spacing.md,
    borderWidth: 1.5,
  },
  roleIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  roleTextCol: {
    flex: 1,
  },
  roleHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  roleLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textTertiary,
    letterSpacing: 0.5,
  },
  switchBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  switchBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#000000',
  },
  roleTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  roleSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  editKeyboardRoot: {
    flex: 1,
  },
  editOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  editSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: Platform.OS === 'ios' ? 34 : spacing.lg,
    borderTopWidth: 1,
    borderColor: colors.border,
    maxHeight: '92%',
  },
  editHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  editTitle: {
    ...typography.h4,
    color: colors.textPrimary,
  },
  editHint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  editLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '700',
    marginBottom: 6,
  },
  editInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    color: colors.textPrimary,
    fontSize: 16,
    marginBottom: spacing.md,
  },
  editPhoneBox: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: spacing.lg,
    opacity: 0.85,
  },
  editPhoneText: {
    color: colors.textSecondary,
    fontSize: 15,
  },
  editSaveBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editSaveText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
});
