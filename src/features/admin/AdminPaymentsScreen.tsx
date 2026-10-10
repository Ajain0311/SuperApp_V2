import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppColors } from '../../theme/colors';
import { apiClient } from '../../services/apiClient';
import { AdminActivity, AdminDashboardData } from './types';

interface AdminPaymentsScreenProps {
  navigation: any;
}

export const AdminPaymentsScreen: React.FC<AdminPaymentsScreenProps> = ({ navigation }) => {
  const [dashboardData, setDashboardData] = useState<AdminDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedModule, setSelectedModule] = useState<string>('ALL');

  const fetchPayments = useCallback(async () => {
    try {
      const res = await apiClient.get<any>('/api/admin/dashboard');
      const payload = res.data?.data || res.data;
      setDashboardData(payload);
    } catch (err: any) {
      console.warn('[AdminPaymentsScreen] Error fetching payment analytics:', err.message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const activities = (dashboardData?.recentActivities || []).filter((a) => {
    if (selectedModule === 'FOOD') return a.module === 'FOOD';
    if (selectedModule === 'RIDE') return a.module === 'RIDE';
    return true;
  });

  const renderTransactionItem = ({ item }: { item: AdminActivity }) => {
    const isFood = item.module === 'FOOD';
    return (
      <View style={styles.card}>
        <View style={styles.cardLeft}>
          <View
            style={[
              styles.iconWrapper,
              { backgroundColor: isFood ? '#00C85315' : '#2196F315' },
            ]}
          >
            <Ionicons
              name={isFood ? 'fast-food' : 'car'}
              size={20}
              color={isFood ? AppColors.secondary : AppColors.blue}
            />
          </View>
          <View style={styles.itemInfo}>
            <Text style={styles.itemTitle}>{item.description}</Text>
            <Text style={styles.itemSub}>
              Ref #{item.id} • {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        </View>
        <View style={styles.cardRight}>
          <Text style={styles.amountText}>₹{item.amount ?? 0}</Text>
          <View style={styles.settledBadge}>
            <Text style={styles.settledBadgeText}>SETTLED</Text>
          </View>
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
        <Text style={styles.headerTitle}>Payments & Settlements</Text>
        <View style={{ width: 38 }} />
      </View>

      {/* Gateway Status Banner */}
      <View style={styles.gatewayBanner}>
        <View style={styles.gatewayRow}>
          <Ionicons name="checkmark-circle" size={16} color={AppColors.secondary} />
          <Text style={styles.gatewayText}>Gateway: Easebuzz Payment Gateway (Production)</Text>
        </View>
        <Text style={styles.gatewaySub}>Direct UPI, Cards, and NetBanking Settlements</Text>
      </View>

      {/* Financial Summary KPI Cards */}
      <View style={styles.kpiContainer}>
        <View style={styles.kpiRow}>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Food GMV</Text>
            <Text style={styles.kpiValue}>₹{dashboardData?.grossFoodSales?.toLocaleString() ?? 0}</Text>
          </View>
          <View style={styles.kpiDivider} />
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Ride GMV</Text>
            <Text style={styles.kpiValue}>₹{dashboardData?.grossRideFares?.toLocaleString() ?? 0}</Text>
          </View>
          <View style={styles.kpiDivider} />
          <View style={styles.kpiBox}>
            <Text style={[styles.kpiLabel, { color: AppColors.primary }]}>Platform Net</Text>
            <Text style={[styles.kpiValue, { color: AppColors.primary }]}>
              ₹{dashboardData?.platformRevenue?.toLocaleString() ?? 0}
            </Text>
          </View>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {(['ALL', 'FOOD', 'RIDE'] as const).map((m) => (
          <TouchableOpacity
            key={m}
            style={[styles.filterChip, selectedModule === m && styles.filterChipActive]}
            onPress={() => setSelectedModule(m)}
          >
            <Text style={[styles.filterChipText, selectedModule === m && styles.filterChipTextActive]}>
              {m === 'ALL' ? 'All Transactions' : m === 'FOOD' ? 'Food Payments' : 'Ride Fares'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Transactions List */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={AppColors.primary} />
          <Text style={styles.loadingText}>Fetching payment transactions...</Text>
        </View>
      ) : (
        <FlatList
          data={activities}
          keyExtractor={(item) => item.id}
          renderItem={renderTransactionItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => {
                setIsRefreshing(true);
                fetchPayments();
              }}
              tintColor={AppColors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="card-outline" size={48} color={AppColors.border} />
              <Text style={styles.emptyTitle}>No Transactions Found</Text>
              <Text style={styles.emptySubtitle}>Platform transactions will appear here</Text>
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
  gatewayBanner: {
    margin: 14,
    backgroundColor: AppColors.surface,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  gatewayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  gatewayText: {
    fontSize: 13,
    fontWeight: '700',
    color: AppColors.textPrimary,
  },
  gatewaySub: {
    fontSize: 11,
    color: AppColors.textSecondary,
    marginLeft: 22,
  },
  kpiContainer: {
    marginHorizontal: 14,
    marginBottom: 14,
    backgroundColor: AppColors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  kpiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  kpiBox: {
    flex: 1,
    alignItems: 'center',
  },
  kpiDivider: {
    width: 1,
    height: 30,
    backgroundColor: AppColors.border,
  },
  kpiLabel: {
    fontSize: 11,
    color: AppColors.textSecondary,
    marginBottom: 4,
  },
  kpiValue: {
    fontSize: 16,
    fontWeight: '800',
    color: AppColors.textPrimary,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    gap: 8,
    marginBottom: 10,
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
    backgroundColor: AppColors.primary,
    borderColor: AppColors.primary,
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
    gap: 10,
  },
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: AppColors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  itemInfo: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: AppColors.textPrimary,
  },
  itemSub: {
    fontSize: 11,
    color: AppColors.textSecondary,
    marginTop: 2,
  },
  cardRight: {
    alignItems: 'flex-end',
    marginLeft: 10,
  },
  amountText: {
    fontSize: 16,
    fontWeight: '800',
    color: AppColors.secondary,
    marginBottom: 4,
  },
  settledBadge: {
    backgroundColor: '#00C85315',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  settledBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: AppColors.secondary,
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
