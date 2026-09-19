import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { vendorService, VendorDashboardStats } from '../../services/vendorService';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

export const VendorDashboardScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [dashboard, setDashboard] = useState<VendorDashboardStats | null>(null);
  const [restaurant, setRestaurant] = useState<any | null>(null);
  const [isOpen, setIsOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [dash, rest] = await Promise.all([
        vendorService.getDashboard(),
        vendorService.getMyRestaurant(),
      ]);
      setDashboard(dash);
      setRestaurant(rest);
      setIsOpen(rest.isActive ?? true);
    } catch (e: any) {
      console.warn('[VendorDashboard] Error loading data:', e.message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleToggleStatus = async (val: boolean) => {
    setIsTogglingStatus(true);
    try {
      const updated = await vendorService.toggleStatus(val);
      setIsOpen(updated);
      Alert.alert(
        updated ? 'Restaurant Open' : 'Restaurant Closed',
        updated ? 'Customers can now place orders from your menu.' : 'Your restaurant is marked closed in the customer app.'
      );
    } catch (e: any) {
      Alert.alert('Status Error', e.message || 'Could not update restaurant status');
      setIsOpen(!val);
    } finally {
      setIsTogglingStatus(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.centerBox}>
        <ActivityIndicator size="large" color="#F59E0B" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => { setIsRefreshing(true); loadData(); }} tintColor="#F59E0B" />}
      >
        {/* Restaurant Header Card */}
        <View style={styles.headerCard}>
          <View style={styles.restaurantRow}>
            <View style={styles.iconBox}>
              <Ionicons name="restaurant" size={26} color="#FFFFFF" />
            </View>
            <View style={styles.restaurantInfo}>
              <Text style={styles.restaurantName}>{dashboard?.restaurantName || restaurant?.name || 'My Kitchen'}</Text>
              <Text style={styles.restaurantAddress}>{restaurant?.city || 'Operational Hub'}</Text>
            </View>

            {/* Open / Closed Duty Switch */}
            <View style={styles.switchBox}>
              <Text style={[styles.switchLabel, { color: isOpen ? '#10B981' : '#EF4444' }]}>
                {isOpen ? 'OPEN' : 'CLOSED'}
              </Text>
              {isTogglingStatus ? (
                <ActivityIndicator size="small" color="#F59E0B" />
              ) : (
                <Switch
                  value={isOpen}
                  onValueChange={handleToggleStatus}
                  trackColor={{ false: '#334155', true: '#10B98150' }}
                  thumbColor={isOpen ? '#10B981' : '#EF4444'}
                />
              )}
            </View>
          </View>
        </View>

        {/* Live Metrics Grid */}
        <View style={styles.kpiGrid}>
          <View style={styles.kpiCard}>
            <View style={[styles.kpiIcon, { backgroundColor: '#F59E0B20' }]}>
              <Ionicons name="cash" size={20} color="#F59E0B" />
            </View>
            <Text style={styles.kpiValue}>₹{dashboard?.todaySalesAmount.toFixed(0) || '0'}</Text>
            <Text style={styles.kpiLabel}>Today's Gross Sales</Text>
          </View>

          <View style={styles.kpiCard}>
            <View style={[styles.kpiIcon, { backgroundColor: '#3B82F620' }]}>
              <Ionicons name="receipt" size={20} color="#3B82F6" />
            </View>
            <Text style={styles.kpiValue}>{dashboard?.todayOrdersCount || 0}</Text>
            <Text style={styles.kpiLabel}>Orders Today</Text>
          </View>

          <View style={styles.kpiCard}>
            <View style={[styles.kpiIcon, { backgroundColor: '#EF444420' }]}>
              <Ionicons name="flame" size={20} color="#EF4444" />
            </View>
            <Text style={[styles.kpiValue, { color: '#EF4444' }]}>{dashboard?.pendingOrdersCount || 0}</Text>
            <Text style={styles.kpiLabel}>Pending in Kitchen</Text>
          </View>

          <View style={styles.kpiCard}>
            <View style={[styles.kpiIcon, { backgroundColor: '#10B98120' }]}>
              <Ionicons name="fast-food" size={20} color="#10B981" />
            </View>
            <Text style={styles.kpiValue}>{dashboard?.activeMenuItemsCount || 0}</Text>
            <Text style={styles.kpiLabel}>Active Menu Items</Text>
          </View>
        </View>

        {/* Quick Operational Actions */}
        <View style={styles.actionsSection}>
          <Text style={styles.sectionTitle}>Kitchen Management</Text>

          <TouchableOpacity
            style={styles.actionRow}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('KitchenOrders')}
          >
            <View style={[styles.actionIconBox, { backgroundColor: '#EF444420' }]}>
              <Ionicons name="list" size={22} color="#EF4444" />
            </View>
            <View style={styles.actionText}>
              <Text style={styles.actionTitle}>Kitchen Orders Queue</Text>
              <Text style={styles.actionSubtitle}>Accept incoming orders, update prep progress</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionRow}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('VendorMenu')}
          >
            <View style={[styles.actionIconBox, { backgroundColor: '#F59E0B20' }]}>
              <Ionicons name="book" size={22} color="#F59E0B" />
            </View>
            <View style={styles.actionText}>
              <Text style={styles.actionTitle}>Menu & Stock Management</Text>
              <Text style={styles.actionSubtitle}>Toggle item availability, update prices</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerBox: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  headerCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  restaurantRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  restaurantInfo: {
    flex: 1,
  },
  restaurantName: {
    ...typography.h4,
    color: colors.textPrimary,
  },
  restaurantAddress: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  switchBox: {
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  switchLabel: {
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  kpiCard: {
    width: '48%',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  kpiIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  kpiLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 4,
  },
  actionsSection: {
    marginTop: spacing.xs,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  actionText: {
    flex: 1,
  },
  actionTitle: {
    ...typography.h4,
    color: colors.textPrimary,
  },
  actionSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
