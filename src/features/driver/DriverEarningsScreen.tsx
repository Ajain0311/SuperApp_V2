import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { driverService, DriverEarnings } from '../../services/driverService';
import { ScreenBackButton } from '../../components/common/ScreenBackButton';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

export const DriverEarningsScreen: React.FC = () => {
  const [earnings, setEarnings] = useState<DriverEarnings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'SETTLEMENTS' | 'TRIPS'>('SETTLEMENTS');

  const loadEarnings = useCallback(async () => {
    try {
      const data = await driverService.getEarnings();
      setEarnings(data);
    } catch (e: any) {
      console.warn('[DriverEarnings] Error loading earnings:', e.message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadEarnings();
  }, [loadEarnings]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.header, { paddingHorizontal: spacing.md, paddingTop: spacing.sm }]}>
          <View style={styles.headerTop}>
            <ScreenBackButton accessibilityLabel="Back" />
            <Text style={styles.title}>Earnings & Payouts</Text>
          </View>
        </View>
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#10B981" />
        </View>
      </SafeAreaView>
    );
  }

  const settlements = earnings?.settlementHistory || [];
  const trips = earnings?.recentTrips || [];

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => { setIsRefreshing(true); loadEarnings(); }} tintColor="#10B981" />}
      >
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <ScreenBackButton accessibilityLabel="Back" />
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Earnings & Settlements</Text>
              <Text style={styles.subtitle}>Direct settlements from your completed rides & food deliveries</Text>
            </View>
          </View>
        </View>

        {/* Primary Today's Earnings Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <Text style={styles.heroLabel}>TODAY'S EARNINGS</Text>
            <View style={styles.settledBadge}>
              <Text style={styles.settledBadgeText}>DAILY SETTLED</Text>
            </View>
          </View>
          <Text style={styles.heroAmount}>₹{earnings?.todayEarnings.toFixed(0) || '0'}</Text>
          <Text style={styles.heroSubtitle}>{earnings?.todayRides || 0} trips completed today</Text>
        </View>

        {/* Weekly & Total Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={[styles.statIconBox, { backgroundColor: '#3B82F620' }]}>
              <Ionicons name="calendar" size={20} color="#3B82F6" />
            </View>
            <Text style={styles.statVal}>₹{earnings?.weeklyEarnings.toFixed(0) || '0'}</Text>
            <Text style={styles.statLabel}>Past 7 Days</Text>
            <Text style={styles.statSub}>{earnings?.weeklyRides || 0} trips</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIconBox, { backgroundColor: '#8B5CF620' }]}>
              <Ionicons name="trophy" size={20} color="#8B5CF6" />
            </View>
            <Text style={styles.statVal}>₹{earnings?.totalEarnings.toFixed(0) || '0'}</Text>
            <Text style={styles.statLabel}>Gross Lifetime</Text>
            <Text style={styles.statSub}>{earnings?.totalRides || 0} trips</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIconBox, { backgroundColor: '#10B98120' }]}>
              <Ionicons name="checkmark-done" size={20} color="#10B981" />
            </View>
            <Text style={[styles.statVal, { color: '#10B981' }]}>
              ₹{(earnings?.netSettledPayout ?? earnings?.totalEarnings ?? 0).toFixed(0)}
            </Text>
            <Text style={styles.statLabel}>Net Settled</Text>
            <Text style={styles.statSub}>10% fee applied</Text>
          </View>
        </View>

        {/* Switcher Tab */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'SETTLEMENTS' && styles.tabItemActive]}
            onPress={() => setActiveTab('SETTLEMENTS')}
          >
            <Text style={[styles.tabText, activeTab === 'SETTLEMENTS' && styles.tabTextActive]}>
              Settlement Records ({settlements.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'TRIPS' && styles.tabItemActive]}
            onPress={() => setActiveTab('TRIPS')}
          >
            <Text style={[styles.tabText, activeTab === 'TRIPS' && styles.tabTextActive]}>
              Recent Trips ({trips.length})
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'SETTLEMENTS' ? (
          settlements.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="card-outline" size={32} color={colors.textTertiary} />
              <Text style={styles.emptyText}>No settlement payout records found.</Text>
            </View>
          ) : (
            settlements.map((s, idx) => (
              <View key={idx} style={styles.settlementCard}>
                <View style={styles.settlementTop}>
                  <View>
                    <Text style={styles.settlementRef}>{s.referenceId}</Text>
                    <Text style={styles.settlementDate}>
                      {new Date(s.date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} • {s.tripsCount} trips
                    </Text>
                  </View>
                  <View style={styles.settledBadge}>
                    <Text style={styles.settledBadgeText}>{s.status}</Text>
                  </View>
                </View>
                <View style={styles.settlementValues}>
                  <View>
                    <Text style={styles.sLabel}>Gross Fares</Text>
                    <Text style={styles.sVal}>₹{s.grossFares.toFixed(0)}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.sLabel}>Net Payout Settled</Text>
                    <Text style={[styles.sVal, { color: '#10B981', fontWeight: '800' }]}>
                      ₹{s.netPayout.toFixed(0)}
                    </Text>
                  </View>
                </View>
              </View>
            ))
          )
        ) : (
          trips.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="receipt-outline" size={32} color={colors.textTertiary} />
              <Text style={styles.emptyText}>No completed trips yet today.</Text>
            </View>
          ) : (
            trips.map((trip) => (
              <View key={trip.id} style={styles.tripReceiptRow}>
                <View style={styles.receiptLeft}>
                  <Text style={styles.receiptRideNum}>#{trip.rideNumber}</Text>
                  <Text style={styles.receiptRoute} numberOfLines={1}>{trip.dropoffAddress}</Text>
                </View>
                <View style={styles.receiptRight}>
                  <Text style={styles.receiptFare}>+₹{trip.fare}</Text>
                  <Text style={styles.receiptStatus}>Settled</Text>
                </View>
              </View>
            ))
          )
        )}
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
  header: {
    marginBottom: spacing.md,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.bodySm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  heroCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1.5,
    borderColor: '#10B981',
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#10B981',
    letterSpacing: 0.5,
  },
  settledBadge: {
    backgroundColor: '#10B98120',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  settledBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#10B981',
  },
  heroAmount: {
    fontSize: 38,
    fontWeight: '800',
    color: colors.textPrimary,
    marginVertical: 4,
  },
  heroSubtitle: {
    ...typography.bodySm,
    color: colors.textSecondary,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  statVal: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statSub: {
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: 2,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 4,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabItemActive: {
    backgroundColor: '#10B98125',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: '#10B981',
    fontWeight: '700',
  },
  settlementCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  settlementTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settlementRef: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  settlementDate: {
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: 2,
  },
  settlementValues: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  sLabel: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  sVal: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 2,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    padding: spacing.xl,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyText: {
    ...typography.bodySm,
    color: colors.textTertiary,
    marginTop: spacing.sm,
  },
  tripReceiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  receiptLeft: {
    flex: 1,
    marginRight: spacing.md,
  },
  receiptRideNum: {
    ...typography.h4,
    color: colors.textPrimary,
  },
  receiptRoute: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  receiptRight: {
    alignItems: 'flex-end',
  },
  receiptFare: {
    fontSize: 16,
    fontWeight: '800',
    color: '#10B981',
  },
  receiptStatus: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textTertiary,
    marginTop: 2,
  },
});
