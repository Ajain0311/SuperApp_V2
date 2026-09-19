import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { driverService, DriverRideItem } from '../../services/driverService';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

export const DriverRidesScreen: React.FC = () => {
  const [rides, setRides] = useState<DriverRideItem[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'COMPLETED' | 'CANCELLED'>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadHistory = useCallback(async () => {
    try {
      const data = await driverService.getHistory();
      setRides(data);
    } catch (e: any) {
      console.warn('[DriverRides] Error loading history:', e.message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const filteredRides = rides.filter((r) => {
    if (filter === 'COMPLETED') return r.status === 'COMPLETED';
    if (filter === 'CANCELLED') return r.status === 'CANCELLED';
    return true;
  });

  const renderRideItem = ({ item }: { item: DriverRideItem }) => {
    const isCompleted = item.status === 'COMPLETED';
    const statusColor = isCompleted ? '#10B981' : '#EF4444';

    return (
      <View style={styles.rideCard}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.rideNumber}>Ride #{item.rideNumber}</Text>
            <Text style={styles.passengerText}>Passenger: {item.customerName}</Text>
          </View>
          <View style={styles.rightHeader}>
            <Text style={styles.fareText}>₹{item.fare}</Text>
            <View style={[styles.statusPill, { backgroundColor: `${statusColor}20` }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>{item.status}</Text>
            </View>
          </View>
        </View>

        <View style={styles.routeBox}>
          <View style={styles.routeRow}>
            <Ionicons name="radio-button-on" size={14} color="#10B981" />
            <Text style={styles.addressText} numberOfLines={1}>{item.pickupAddress}</Text>
          </View>
          <View style={styles.routeRow}>
            <Ionicons name="location" size={14} color="#EF4444" />
            <Text style={styles.addressText} numberOfLines={1}>{item.dropoffAddress}</Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <Ionicons name="calendar-outline" size={13} color={colors.textTertiary} />
          <Text style={styles.dateText}>{new Date(item.createdAt).toLocaleDateString()} at {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.title}>Trip History</Text>
        <Text style={styles.subtitle}>All your completed and past trips</Text>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterBar}>
        {(['ALL', 'COMPLETED', 'CANCELLED'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.filterTab, filter === tab && styles.filterTabActive]}
            onPress={() => setFilter(tab)}
          >
            <Text style={[styles.filterTabText, filter === tab && styles.filterTabTextActive]}>
              {tab === 'ALL' ? 'All Trips' : tab === 'COMPLETED' ? 'Completed' : 'Cancelled'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      ) : (
        <FlatList
          data={filteredRides}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderRideItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => { setIsRefreshing(true); loadHistory(); }} tintColor="#3B82F6" />}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons name="car-sport-outline" size={48} color={colors.textTertiary} />
              <Text style={styles.emptyTitle}>No Trips Found</Text>
              <Text style={styles.emptySubtitle}>Completed trips will appear here with full fare receipts.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
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
  filterBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    marginVertical: spacing.sm,
  },
  filterTab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterTabActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  filterTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  rideCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  rideNumber: {
    ...typography.h4,
    color: colors.textPrimary,
  },
  passengerText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  rightHeader: {
    alignItems: 'flex-end',
  },
  fareText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#10B981',
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  routeBox: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 10,
    padding: spacing.sm,
    gap: 6,
    marginBottom: spacing.sm,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addressText: {
    ...typography.bodySm,
    color: colors.textPrimary,
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateText: {
    fontSize: 11,
    color: colors.textTertiary,
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyTitle: {
    ...typography.h4,
    color: colors.textPrimary,
    marginTop: spacing.md,
  },
  emptySubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 240,
  },
});
