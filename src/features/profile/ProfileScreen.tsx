import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Alert,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../store/authStore';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

interface MenuItemProps {
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  subtitle: string;
  color: string;
  onPress: () => void;
}

const MenuItem: React.FC<MenuItemProps> = ({ icon, title, subtitle, color, onPress }) => {
  return (
    <TouchableOpacity activeOpacity={0.7} style={styles.menuItem} onPress={onPress}>
      <View style={[styles.menuIconContainer, { backgroundColor: `${color}26` }]}>
        <MaterialIcons name={icon} size={22} color={color} />
      </View>
      <View style={styles.menuContent}>
        <Text style={styles.menuTitle}>{title}</Text>
        <Text style={styles.menuSubtitle}>{subtitle}</Text>
      </View>
      <MaterialIcons name="chevron-right" size={20} color={colors.textTertiary} />
    </TouchableOpacity>
  );
};

export const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, logout } = useAuthStore();

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
    // RN Web Alert.alert does not run button callbacks, so confirm() is required on web.
    if (Platform.OS === 'web') {
      const confirmed =
        typeof window === 'undefined' ||
        window.confirm('Are you sure you want to log out?');
      if (confirmed) {
        void performLogout();
      }
      return;
    }

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
            onPress={() => Alert.alert('Edit Profile', 'Profile editing coming soon')}
          >
            <MaterialIcons name="edit" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

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

        {/* Section 2: Account Settings */}
        <Text style={styles.sectionHeader}>Account Settings</Text>
        <View style={styles.sectionCard}>
          <MenuItem
            icon="location-on"
            title="Saved Addresses"
            subtitle="Home, Work, and other addresses"
            color={colors.yellow}
            onPress={() => Alert.alert('Addresses', 'Manage saved locations')}
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
            subtitle="Cards, UPI, & Wallet balance"
            color={colors.secondary}
            onPress={() => navigation.navigate('PaymentTest')}
          />
          <View style={styles.itemDivider} />
          <MenuItem
            icon="headset-mic"
            title="Help & Support"
            subtitle="FAQ, live chat & dispute resolution"
            color={colors.purple}
            onPress={() => Alert.alert('Support', '24x7 Customer Support available')}
          />
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <MaterialIcons name="logout" size={20} color={colors.error} />
          <Text style={styles.logoutButtonText}>Log Out</Text>
        </TouchableOpacity>

        {/* App Version Info */}
        <Text style={styles.versionText}>SuperApp v1.0.0 (Build 2026.09.16)</Text>
      </ScrollView>
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
  menuTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '600',
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
});
