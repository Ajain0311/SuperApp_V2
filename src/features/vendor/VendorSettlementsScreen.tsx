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
import { vendorService } from '../../services/vendorService';
import { ScreenBackButton } from '../../components/common/ScreenBackButton';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

export const VendorSettlementsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'BATCHES' | 'LEDGER'>('BATCHES');

  const loadData = useCallback(async () => {
    try {
      const res = await vendorService.getSettlements();
      setData(res);
    } catch (e: any) {
      console.warn('[VendorSettlementsScreen] Error fetching settlements:', e?.message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const batches = data?.batches || [];
  const ledger = data?.ledger || [];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <ScreenBackButton accessibilityLabel="Back" />
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Hotel Settlements & Payouts</Text>
          <Text style={styles.headerSub}>Admin commission clearance & statements</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={() => { setIsRefreshing(true); loadData(); }}>
          <Ionicons name="refresh" size={18} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* KPI Cards Strip */}
      <View style={styles.kpiContainer}>
        <View style={styles.kpiBox}>
          <Text style={styles.kpiLabel}>Total Delivered</Text>
          <Text style={styles.kpiVal}>₹{(data?.grossSales || 0).toLocaleString()}</Text>
          <Text style={styles.kpiSub}>{data?.totalOrders || 0} orders</Text>
        </View>
        <View style={styles.kpiDivider} />
        <View style={styles.kpiBox}>
          <Text style={styles.kpiLabel}>Commission Paid</Text>
          <Text style={[styles.kpiVal, { color: '#F87171' }]}>
            ₹{(data?.commissionDeducted || 0).toLocaleString()}
          </Text>
          <Text style={styles.kpiSub}>15% platform rate</Text>
        </View>
        <View style={styles.kpiDivider} />
        <View style={styles.kpiBox}>
          <Text style={styles.kpiLabel}>Pending Dues</Text>
          <Text style={[styles.kpiVal, { color: (data?.pendingCommissionDues || 0) > 0 ? '#F59E0B' : '#10B981' }]}>
            ₹{(data?.pendingCommissionDues || 0).toLocaleString()}
          </Text>
          <Text style={styles.kpiSub}>
            {(data?.pendingCommissionDues || 0) > 0 ? 'To be batched' : 'Settled'}
          </Text>
        </View>
      </View>

      {/* Tab Selector */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'BATCHES' && styles.tabItemActive]}
          onPress={() => setActiveTab('BATCHES')}
        >
          <Text style={[styles.tabText, activeTab === 'BATCHES' && styles.tabTextActive]}>
            Settlement Batches ({batches.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'LEDGER' && styles.tabItemActive]}
          onPress={() => setActiveTab('LEDGER')}
        >
          <Text style={[styles.tabText, activeTab === 'LEDGER' && styles.tabTextActive]}>
            Order Ledger ({ledger.length})
          </Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#F59E0B" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollList}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => { setIsRefreshing(true); loadData(); }}
              tintColor="#F59E0B"
            />
          }
        >
          {activeTab === 'BATCHES' ? (
            batches.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="receipt-outline" size={44} color="#64748B" />
                <Text style={styles.emptyTitle}>No Settlement Batches Yet</Text>
                <Text style={styles.emptySub}>Admin collection and settlement batches will show here.</Text>
              </View>
            ) : (
              batches.map((b: any) => (
                <View key={b.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View>
                      <Text style={styles.batchNum}>{b.batchNumber}</Text>
                      <Text style={styles.batchDate}>
                        {new Date(b.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.badge,
                        { backgroundColor: b.status === 'APPROVED' ? '#10B98120' : '#F59E0B20' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.badgeText,
                          { color: b.status === 'APPROVED' ? '#10B981' : '#F59E0B' },
                        ]}
                      >
                        {b.status}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.cardDetails}>
                    <View>
                      <Text style={styles.detailLabel}>Settled Commission</Text>
                      <Text style={styles.amount}>₹{Number(b.settledAmount).toFixed(2)}</Text>
                    </View>
                    {b.orderCount > 0 && (
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.detailLabel}>Orders Covered</Text>
                        <Text style={styles.detailVal}>{b.orderCount} orders</Text>
                      </View>
                    )}
                  </View>

                  {b.referenceProof && (
                    <View style={styles.proofRow}>
                      <Ionicons name="document-text-outline" size={14} color="#94A3B8" />
                      <Text style={styles.proofText}>Ref / Receipt: {b.referenceProof}</Text>
                    </View>
                  )}
                </View>
              ))
            )
          ) : (
            ledger.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="file-tray-outline" size={44} color="#64748B" />
                <Text style={styles.emptyTitle}>No Ledger Entries</Text>
                <Text style={styles.emptySub}>Order commission deductions will appear after deliveries.</Text>
              </View>
            ) : (
              ledger.map((l: any) => (
                <View key={l.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.batchNum}>Order #{l.orderNumber}</Text>
                    <View
                      style={[
                        styles.badge,
                        { backgroundColor: l.status === 'SETTLED' ? '#10B98120' : '#F59E0B20' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.badgeText,
                          { color: l.status === 'SETTLED' ? '#10B981' : '#F59E0B' },
                        ]}
                      >
                        {l.status}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.ledgerRow}>
                    <View>
                      <Text style={styles.detailLabel}>Order Bill</Text>
                      <Text style={styles.detailVal}>₹{Number(l.grossAmount).toFixed(2)}</Text>
                    </View>
                    <View>
                      <Text style={styles.detailLabel}>Comm ({l.commissionRate}%)</Text>
                      <Text style={[styles.detailVal, { color: '#F87171' }]}>
                        -₹{Number(l.commissionAmount).toFixed(2)}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.detailLabel}>Net Hotel Payout</Text>
                      <Text style={[styles.detailVal, { color: '#10B981' }]}>
                        ₹{Number(l.netProceeds).toFixed(2)}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.batchDate}>
                    {new Date(l.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} •{' '}
                    {new Date(l.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </Text>
                </View>
              ))
            )
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
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  tabItem: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabItemActive: { borderBottomWidth: 2, borderBottomColor: '#F59E0B' },
  tabText: { color: '#94A3B8', fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: '#F59E0B', fontWeight: '700' },
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
  batchNum: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  batchDate: { fontSize: 11, color: '#64748B', marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  cardDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  amount: { fontSize: 16, fontWeight: '800', color: '#F59E0B', marginTop: 2 },
  detailLabel: { fontSize: 11, color: '#94A3B8' },
  detailVal: { fontSize: 13, fontWeight: '700', color: '#FFF', marginTop: 2 },
  proofRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    backgroundColor: '#1E293B50',
    padding: 8,
    borderRadius: 6,
  },
  proofText: { fontSize: 11, color: '#94A3B8' },
  ledgerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#1E293B',
  },
  emptyBox: { alignItems: 'center', marginTop: 60, paddingHorizontal: 20 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#FFF', marginTop: 12 },
  emptySub: { fontSize: 12, color: '#64748B', textAlign: 'center', marginTop: 4 },
});
