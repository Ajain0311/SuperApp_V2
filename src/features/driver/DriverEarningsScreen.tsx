import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { driverService, DriverEarnings } from '../../services/driverService';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

export const DriverEarningsScreen: React.FC = () => {
  const [earnings, setEarnings] = useState<DriverEarnings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

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
      <SafeAreaView style={styles.centerBox}>
        <ActivityIndicator size="large" color="#10B981" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => { setIsRefreshing(true); loadEarnings(); }} tintColor="#10B981" />}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Earnings & Payouts</Text>
          <Text style={styles.subtitle}>Direct settlements from your completed rides</Text>
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
            <Text style={styles.statLabel}>All-Time Gross</Text>
            <Text style={styles.statSub}>{earnings?.totalRides || 0} trips</Text>
          </View>
        </View>

        {/* Recent Trips Receipts */}
        <View style={styles.recentSection}>
          <Text style={styles.sectionTitle}>Recent Trip Receipts</Text>

          {(!earnings?.recentTrips || earnings.recentTrips.length === 0) ? (
            <View style={styles.emptyCard}>
              <Ionicons name="receipt-outline" size={32} color={colors.textTertiary} />
              <Text style={styles.emptyText}>No completed trips yet today.</Text>
            </View>
          ) : (
            earnings.recentTrips.map((trip) => (
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
          )}
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
  header: {
    marginBottom: spacing.md,
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
    fontSize: 20,
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
  recentSection: {
    marginTop: spacing.xs,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
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
