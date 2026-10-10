import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppColors } from '../../theme/colors';
import { apiClient } from '../../services/apiClient';
import { AdminDriver } from './types';

interface AdminDriversScreenProps {
  navigation: any;
}

type DriverFilter = 'ALL' | 'VERIFIED' | 'PENDING' | 'ONLINE';

export const AdminDriversScreen: React.FC<AdminDriversScreenProps> = ({ navigation }) => {
  const [drivers, setDrivers] = useState<AdminDriver[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filter, setFilter] = useState<DriverFilter>('ALL');

  const fetchDrivers = useCallback(async () => {
    try {
      const res = await apiClient.get<any>('/api/admin/drivers');
      const payload = res.data?.data || res.data || [];
      setDrivers(payload);
    } catch (err: any) {
      console.warn('[AdminDriversScreen] Error fetching drivers:', err.message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDrivers();
  }, [fetchDrivers]);

  const handleToggleVerification = async (driver: AdminDriver) => {
    const updated = !driver.isVerified;
    try {
      await apiClient.post('/api/admin/drivers', {
        action: 'VERIFY',
        driverId: driver.id,
        isVerified: updated,
      });

      setDrivers((prev) =>
        prev.map((d) => (d.id === driver.id ? { ...d, isVerified: updated } : d))
      );
      Alert.alert(
        'Verification Updated',
        `Driver ${driver.driverName} is now ${updated ? 'VERIFIED' : 'UNVERIFIED'}`
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not update verification');
    }
  };

  const handleToggleActive = async (driver: AdminDriver) => {
    const updated = !driver.isActive;
    try {
      await apiClient.post('/api/admin/drivers', {
        action: 'STATUS',
        driverId: driver.id,
        isActive: updated,
      });

      setDrivers((prev) =>
        prev.map((d) => (d.id === driver.id ? { ...d, isActive: updated } : d))
      );
      Alert.alert('Status Updated', `Driver ${driver.driverName} duty status updated`);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not update driver status');
    }
  };

  const filteredDrivers = drivers.filter((d) => {
    if (filter === 'VERIFIED') return d.isVerified;
    if (filter === 'PENDING') return !d.isVerified;
    if (filter === 'ONLINE') return d.isOnline;
    return true;
  });

  const renderDriverCard = ({ item }: { item: AdminDriver }) => {
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.avatarBox}>
            <Ionicons name="car" size={20} color={AppColors.secondary} />
          </View>
          <View style={styles.headerInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.driverName}>{item.driverName}</Text>
              <View
                style={[
                  styles.onlineBadge,
                  { backgroundColor: item.isOnline ? '#00C85320' : '#8E8E9320' },
                ]}
              >
                <Text
                  style={[
                    styles.onlineBadgeText,
                    { color: item.isOnline ? AppColors.secondary : AppColors.textSecondary },
                  ]}
                >
                  {item.isOnline ? 'ONLINE' : 'OFFLINE'}
                </Text>
              </View>
            </View>
            <Text style={styles.phoneText}>{item.mobileNumber}</Text>
          </View>
          <Switch
            value={item.isActive}
            onValueChange={() => handleToggleActive(item)}
            trackColor={{ false: AppColors.surfaceLight, true: AppColors.secondary }}
            thumbColor="#FFFFFF"
          />
        </View>

        {/* Vehicle Information */}
        <View style={styles.vehicleBox}>
          <View style={styles.vehicleRow}>
            <Ionicons name="shield-outline" size={14} color={AppColors.textSecondary} />
            <Text style={styles.vehicleText}>
              {item.vehicle
                ? `${item.vehicle.make} ${item.vehicle.model} (${item.vehicle.registrationNumber}) • ${item.vehicle.type}`
                : `License: ${item.licenseNumber || 'Verified'}`}
            </Text>
          </View>
        </View>

        {/* Metrics & Verification */}
        <View style={styles.cardFooter}>
          <View style={styles.statsCol}>
            <Text style={styles.statsLabel}>Rating</Text>
            <Text style={[styles.statsValue, { color: AppColors.yellow }]}>★ {item.rating ?? 5.0}</Text>
          </View>
          <View style={styles.statsCol}>
            <Text style={styles.statsLabel}>Total Rides</Text>
            <Text style={styles.statsValue}>{item.totalRides ?? 0}</Text>
          </View>
          <TouchableOpacity
            style={[
              styles.verifyBtn,
              item.isVerified ? styles.verifyBtnApproved : styles.verifyBtnPending,
            ]}
            onPress={() => handleToggleVerification(item)}
          >
            <Ionicons
              name={item.isVerified ? 'checkmark-circle' : 'time-outline'}
              size={14}
              color={item.isVerified ? AppColors.secondary : AppColors.yellow}
            />
            <Text
              style={[
                styles.verifyBtnText,
                { color: item.isVerified ? AppColors.secondary : AppColors.yellow },
              ]}
            >
              {item.isVerified ? 'Verified' : 'Verify Driver'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Driver Fleet</Text>
        <View style={{ width: 38 }} />
      </View>

      {/* Filter Chips */}
      <View style={styles.filterRow}>
        {(['ALL', 'ONLINE', 'VERIFIED', 'PENDING'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>
              {f}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Drivers List */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={AppColors.primary} />
          <Text style={styles.loadingText}>Loading driver fleet...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredDrivers}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderDriverCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => {
                setIsRefreshing(true);
                fetchDrivers();
              }}
              tintColor={AppColors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="car-outline" size={48} color={AppColors.border} />
              <Text style={styles.emptyTitle}>No Drivers Found</Text>
              <Text style={styles.emptySubtitle}>No drivers currently match this filter criteria</Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: AppColors.border,
    backgroundColor: AppColors.surface,
  },
  backBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: AppColors.surfaceLight,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: AppColors.textPrimary,
  },
  filterRow: {
    flexDirection: 'row',
    padding: 14,
    gap: 8,
  },
  filterChip: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: AppColors.surface,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  filterChipActive: {
    backgroundColor: AppColors.secondary,
    borderColor: AppColors.secondary,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: AppColors.textSecondary,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    padding: 14,
    gap: 12,
  },
  card: {
    backgroundColor: AppColors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  avatarBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#00C85315',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  driverName: {
    fontSize: 15,
    fontWeight: '700',
    color: AppColors.textPrimary,
  },
  onlineBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  onlineBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  phoneText: {
    fontSize: 12,
    color: AppColors.textSecondary,
    marginTop: 2,
  },
  vehicleBox: {
    backgroundColor: AppColors.surfaceLight,
    padding: 8,
    borderRadius: 8,
    marginBottom: 12,
  },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  vehicleText: {
    fontSize: 12,
    color: AppColors.textPrimary,
    fontWeight: '500',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: AppColors.border,
    paddingTop: 10,
  },
  statsCol: {
    alignItems: 'center',
  },
  statsLabel: {
    fontSize: 11,
    color: AppColors.textSecondary,
    marginBottom: 2,
  },
  statsValue: {
    fontSize: 13,
    fontWeight: '700',
    color: AppColors.textPrimary,
  },
  verifyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
    borderWidth: 1,
  },
  verifyBtnApproved: {
    backgroundColor: '#00C85315',
    borderColor: AppColors.secondary,
  },
  verifyBtnPending: {
    backgroundColor: '#FFD74015',
    borderColor: AppColors.yellow,
  },
  verifyBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: AppColors.textSecondary,
    fontSize: 13,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: AppColors.textPrimary,
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: AppColors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
});
