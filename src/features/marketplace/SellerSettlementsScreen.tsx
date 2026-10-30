import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../../services/apiClient';
import { ApiEndpoints } from '../../constants/api';
import { ScreenBackButton } from '../../components/common/ScreenBackButton';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

export const SellerSettlementsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const res = await apiClient.get<any>(ApiEndpoints.marketplace.sellerSettlements);
      setData(res.data?.data || res.data || {});
    } catch (e: any) {
      console.warn('[SellerSettlementsScreen] Error:', e?.message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const records = data?.records || [];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <ScreenBackButton accessibilityLabel="Back" />
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Marketplace Sales & Dues</Text>
          <Text style={styles.headerSub}>Sold listings, platform fee & dues</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={() => { setIsRefreshing(true); loadData(); }}>
          <Ionicons name="refresh" size={18} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* KPI Cards */}
      <View style={styles.kpiContainer}>
        <View style={styles.kpiBox}>
          <Text style={styles.kpiLabel}>Total Sold Items</Text>
          <Text style={styles.kpiVal}>{data?.soldItemsCount || 0}</Text>
          <Text style={styles.kpiSub}>₹{(data?.totalSoldValue || 0).toLocaleString()} value</Text>
        </View>
        <View style={styles.kpiDivider} />
        <View style={styles.kpiBox}>
          <Text style={styles.kpiLabel}>Platform Fee (2%)</Text>
          <Text style={[styles.kpiVal, { color: '#F87171' }]}>
            ₹{(data?.totalPlatformFees || 0).toLocaleString()}
          </Text>
          <Text style={styles.kpiSub}>Listing success fee</Text>
        </View>
        <View style={styles.kpiDivider} />
        <View style={styles.kpiBox}>
          <Text style={styles.kpiLabel}>Pending Dues</Text>
          <Text style={[styles.kpiVal, { color: (data?.pendingFeesDue || 0) > 0 ? '#F59E0B' : '#10B981' }]}>
            ₹{(data?.pendingFeesDue || 0).toLocaleString()}
          </Text>
          <Text style={styles.kpiSub}>
            {(data?.pendingFeesDue || 0) > 0 ? 'Due to Admin' : 'All Clear'}
          </Text>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollList}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => { setIsRefreshing(true); loadData(); }}
              tintColor="#3B82F6"
            />
          }
        >
          {records.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="pricetag-outline" size={48} color="#64748B" />
              <Text style={styles.emptyTitle}>No Sold Items Yet</Text>
              <Text style={styles.emptySub}>
                When you mark your listings as 'SOLD' after closing a deal, your sales ledger and nominal 2% platform fee will appear here.
              </Text>
            </View>
          ) : (
            records.map((r: any) => (
              <View key={r.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.itemTitle} numberOfLines={1}>{r.title}</Text>
                  <View
                    style={[
                      styles.badge,
                      { backgroundColor: r.status === 'SETTLED' ? '#10B98120' : '#F59E0B20' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.badgeText,
                        { color: r.status === 'SETTLED' ? '#10B981' : '#F59E0B' },
                      ]}
                    >
                      {r.status}
                    </Text>
                  </View>
                </View>

                <View style={styles.row}>
                  <View>
                    <Text style={styles.detailLabel}>Selling Price</Text>
                    <Text style={styles.detailVal}>₹{Number(r.soldPrice).toFixed(0)}</Text>
                  </View>
                  <View>
                    <Text style={styles.detailLabel}>Fee ({r.commissionRate}%)</Text>
                    <Text style={[styles.detailVal, { color: '#F87171' }]}>
                      ₹{Number(r.platformFee).toFixed(2)}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.detailLabel}>Net Seller Proceeds</Text>
                    <Text style={[styles.detailVal, { color: '#10B981' }]}>
                      ₹{Number(r.netProceeds).toFixed(0)}
                    </Text>
                  </View>
                </View>

                <Text style={styles.dateText}>
                  Marked Sold: {new Date(r.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                </Text>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  headerSub: { fontSize: 11, color: '#94A3B8' },
  refreshBtn: { padding: 8, borderRadius: 8, backgroundColor: '#1E293B' },
  kpiContainer: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    margin: spacing.md,
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  kpiBox: { flex: 1, alignItems: 'center' },
  kpiLabel: { fontSize: 11, color: '#94A3B8' },
  kpiVal: { fontSize: 15, fontWeight: '800', color: '#FFF', marginTop: 4 },
  kpiSub: { fontSize: 10, color: '#64748B', marginTop: 2 },
  kpiDivider: { width: 1, height: 28, backgroundColor: '#1E293B' },
  centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollList: { padding: spacing.md, paddingBottom: 40 },
  card: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemTitle: { fontSize: 14, fontWeight: '700', color: '#FFF', flex: 1, marginRight: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#1E293B',
  },
  detailLabel: { fontSize: 11, color: '#94A3B8' },
  detailVal: { fontSize: 13, fontWeight: '700', color: '#FFF', marginTop: 2 },
  dateText: { fontSize: 11, color: '#64748B' },
  emptyBox: { alignItems: 'center', marginTop: 60, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#FFF', marginTop: 12 },
  emptySub: { fontSize: 12, color: '#64748B', textAlign: 'center', marginTop: 6, lineHeight: 18 },
});
