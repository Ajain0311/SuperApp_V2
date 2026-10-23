import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppColors } from '../../theme/colors';
import { apiClient } from '../../services/apiClient';

export const AdminHotelCommissionsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [hotels, setHotels] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'HOTELS' | 'BATCHES'>('HOTELS');
  const [isLoading, setIsLoading] = useState(true);

  // Rate Edit Modal
  const [rateModalVisible, setRateModalVisible] = useState(false);
  const [selectedHotel, setSelectedHotel] = useState<any | null>(null);
  const [newRate, setNewRate] = useState('');
  const [isSavingRate, setIsSavingRate] = useState(false);

  // Settlement Creation Modal
  const [settlementModalVisible, setSettlementModalVisible] = useState(false);
  const [settlementHotel, setSettlementHotel] = useState<any | null>(null);
  const [settleAmount, setSettleAmount] = useState('');
  const [collectionRef, setCollectionRef] = useState('');
  const [isCreatingBatch, setIsCreatingBatch] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [hotelsRes, batchesRes] = await Promise.all([
        apiClient.get<any>('/admin/hotel-commissions'),
        apiClient.get<any>('/admin/settlement-batches'),
      ]);
      const hotelsData = hotelsRes.data?.data || hotelsRes.data;
      const batchesData = batchesRes.data?.data || batchesRes.data;
      setHotels(Array.isArray(hotelsData) ? hotelsData : []);
      setBatches(Array.isArray(batchesData) ? batchesData : []);
    } catch (err: any) {
      console.warn('[AdminHotelCommissions] Fetch error:', err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openRateModal = (h: any) => {
    setSelectedHotel(h);
    setNewRate(String(h.effectiveCommissionRatePercent || '15'));
    setRateModalVisible(true);
  };

  const handleSaveRate = async () => {
    const rate = parseFloat(newRate);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      Alert.alert('Invalid Rate', 'Commission rate must be between 0% and 100%.');
      return;
    }
    setIsSavingRate(true);
    try {
      await apiClient.put<any>(`/admin/restaurants/${selectedHotel.restaurantId}/commission-rate`, {
        commissionRatePercent: rate,
      });
      Alert.alert('Success', `Prospective commission rate updated to ${rate}%`);
      setRateModalVisible(false);
      fetchData();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || err?.message || 'Could not update rate');
    } finally {
      setIsSavingRate(false);
    }
  };

  const openSettlementModal = (h: any) => {
    setSettlementHotel(h);
    setSettleAmount(String(h.pendingBalance || '0'));
    setCollectionRef(`COL-${Date.now().toString(36).toUpperCase()}`);
    setSettlementModalVisible(true);
  };

  const handleCreateSettlement = async () => {
    const amt = parseFloat(settleAmount);
    if (isNaN(amt) || amt <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid settlement amount.');
      return;
    }
    setIsCreatingBatch(true);
    try {
      await apiClient.post<any>('/admin/settlement-batches', {
        restaurantId: settlementHotel.restaurantId,
        amount: amt,
        collectionReference: collectionRef.trim(),
        periodStart: new Date(Date.now() - 7 * 86400000).toISOString(),
        periodEnd: new Date().toISOString(),
      });
      Alert.alert('Batch Created', 'Settlement batch created. You can now approve it.');
      setSettlementModalVisible(false);
      fetchData();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || err?.message || 'Could not create settlement');
    } finally {
      setIsCreatingBatch(false);
    }
  };

  const handleApproveBatch = (batchId: number) => {
    Alert.alert(
      'Approve Settlement Batch',
      'Approving this batch will mark associated ledger entries as SETTLED and deduct the collected amount from the pending balance. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          style: 'default',
          onPress: async () => {
            try {
              await apiClient.post<any>(`/admin/settlement-batches/${batchId}/approve`, {});
              Alert.alert('Success', 'Batch approved and settled successfully.');
              fetchData();
            } catch (err: any) {
              Alert.alert('Approval Failed', err?.response?.data?.message || err?.message);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Hotel Commissions & Settlement</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'HOTELS' && styles.tabItemActive]}
          onPress={() => setActiveTab('HOTELS')}
        >
          <Text style={[styles.tabText, activeTab === 'HOTELS' && styles.tabTextActive]}>Hotels Ledger</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'BATCHES' && styles.tabItemActive]}
          onPress={() => setActiveTab('BATCHES')}
        >
          <Text style={[styles.tabText, activeTab === 'BATCHES' && styles.tabTextActive]}>Settlement Batches</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={AppColors.primary} />
          <Text style={styles.loadingText}>Loading ledger records...</Text>
        </View>
      ) : activeTab === 'HOTELS' ? (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {hotels.map((h) => (
            <View key={h.restaurantId} style={styles.card}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.hotelName}>{h.restaurantName}</Text>
                  <Text style={styles.hotelPhone}>{h.restaurantPhone || 'No phone'}</Text>
                </View>
                <TouchableOpacity style={styles.ratePill} onPress={() => openRateModal(h)}>
                  <Text style={styles.ratePillText}>{h.effectiveCommissionRatePercent}% Rate</Text>
                  <Ionicons name="pencil" size={12} color={AppColors.primary} />
                </TouchableOpacity>
              </View>

              <View style={styles.statsRow}>
                <View style={styles.statCol}>
                  <Text style={styles.statLabel}>Delivered Orders</Text>
                  <Text style={styles.statVal}>{h.deliveredOrdersCount}</Text>
                </View>
                <View style={styles.statCol}>
                  <Text style={styles.statLabel}>Gross Sales</Text>
                  <Text style={styles.statVal}>₹{h.grossSalesAmount.toFixed(0)}</Text>
                </View>
                <View style={styles.statCol}>
                  <Text style={styles.statLabel}>Commission</Text>
                  <Text style={[styles.statVal, { color: AppColors.primary }]}>₹{h.totalCommissionEarned.toFixed(0)}</Text>
                </View>
              </View>

              <View style={styles.balanceRow}>
                <View>
                  <Text style={styles.balLabel}>Pending Collectible Balance</Text>
                  <Text style={styles.balVal}>₹{h.pendingBalance.toFixed(2)}</Text>
                </View>
                {h.pendingBalance > 0 && (
                  <TouchableOpacity style={styles.settleBtn} onPress={() => openSettlementModal(h)}>
                    <Text style={styles.settleBtnText}>Create Batch</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {batches.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="documents-outline" size={48} color={AppColors.textSecondary} />
              <Text style={styles.emptyText}>No settlement batches created yet.</Text>
            </View>
          ) : (
            batches.map((b) => (
              <View key={b.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View>
                    <Text style={styles.hotelName}>{b.restaurantName || `Restaurant #${b.restaurantId}`}</Text>
                    <Text style={styles.hotelPhone}>Ref: {b.collectionReference || `BATCH-${b.id}`}</Text>
                  </View>
                  <View
                    style={[
                      styles.statusPill,
                      { backgroundColor: b.status === 'APPROVED' ? '#10B98120' : '#F59E0B20' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        { color: b.status === 'APPROVED' ? '#10B981' : '#F59E0B' },
                      ]}
                    >
                      {b.status}
                    </Text>
                  </View>
                </View>

                <View style={styles.batchMeta}>
                  <Text style={styles.batchAmount}>₹{b.amount.toFixed(2)}</Text>
                  <Text style={styles.batchDate}>
                    {new Date(b.createdAt).toLocaleDateString()}
                  </Text>
                </View>

                {b.status !== 'APPROVED' && (
                  <TouchableOpacity style={styles.approveBtn} onPress={() => handleApproveBatch(b.id)}>
                    <Ionicons name="checkmark-circle-outline" size={16} color="#FFF" />
                    <Text style={styles.approveBtnText}>Approve & Settle</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* Edit Rate Modal */}
      <Modal visible={rateModalVisible} transparent animationType="fade" onRequestClose={() => setRateModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalHeading}>Set Prospective Commission Rate</Text>
            <Text style={styles.modalSub}>{selectedHotel?.restaurantName}</Text>
            <TextInput
              style={styles.modalInput}
              value={newRate}
              onChangeText={setNewRate}
              keyboardType="numeric"
              placeholder="e.g. 15.0"
              placeholderTextColor="#777"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setRateModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={handleSaveRate} disabled={isSavingRate}>
                {isSavingRate ? <ActivityIndicator color="#FFF" /> : <Text style={styles.confirmBtnText}>Save Rate</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Settlement Batch Modal */}
      <Modal visible={settlementModalVisible} transparent animationType="fade" onRequestClose={() => setSettlementModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalHeading}>Create Collection Batch</Text>
            <Text style={styles.modalSub}>{settlementHotel?.restaurantName}</Text>

            <Text style={styles.inputLabel}>Collected Amount (₹)</Text>
            <TextInput
              style={styles.modalInput}
              value={settleAmount}
              onChangeText={setSettleAmount}
              keyboardType="numeric"
            />

            <Text style={styles.inputLabel}>Collection Reference / Receipt</Text>
            <TextInput
              style={styles.modalInput}
              value={collectionRef}
              onChangeText={setCollectionRef}
              placeholder="e.g. CHEQUE-10294 or CASH-REC"
              placeholderTextColor="#777"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setSettlementModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={handleCreateSettlement} disabled={isCreatingBatch}>
                {isCreatingBatch ? <ActivityIndicator color="#FFF" /> : <Text style={styles.confirmBtnText}>Create Batch</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: AppColors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 16,
    backgroundColor: AppColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.border,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFF' },
  tabBar: { flexDirection: 'row', backgroundColor: AppColors.surface, borderBottomWidth: 1, borderBottomColor: AppColors.border },
  tabItem: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabItemActive: { borderBottomWidth: 2, borderBottomColor: AppColors.primary },
  tabText: { color: AppColors.textSecondary, fontSize: 14, fontWeight: '600' },
  tabTextActive: { color: AppColors.primary },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: AppColors.textSecondary },
  scrollContent: { padding: 16 },
  card: {
    backgroundColor: AppColors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  hotelName: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  hotelPhone: { fontSize: 12, color: AppColors.textSecondary, marginTop: 2 },
  ratePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: AppColors.primary + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  ratePillText: { color: AppColors.primary, fontSize: 12, fontWeight: '700' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, borderTopWidth: 1, borderTopColor: AppColors.border, paddingTop: 12 },
  statCol: { alignItems: 'center' },
  statLabel: { fontSize: 11, color: AppColors.textSecondary },
  statVal: { fontSize: 15, fontWeight: '700', color: '#FFF', marginTop: 4 },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, backgroundColor: AppColors.background, padding: 12, borderRadius: 8 },
  balLabel: { fontSize: 11, color: AppColors.textSecondary },
  balVal: { fontSize: 16, fontWeight: '800', color: AppColors.yellow, marginTop: 2 },
  settleBtn: { backgroundColor: AppColors.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6 },
  settleBtnText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  statusPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusText: { fontSize: 11, fontWeight: '700' },
  batchMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  batchAmount: { fontSize: 18, fontWeight: '800', color: '#FFF' },
  batchDate: { fontSize: 12, color: AppColors.textSecondary },
  approveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#10B981', paddingVertical: 10, borderRadius: 8, marginTop: 12 },
  approveBtnText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  emptyContainer: { alignItems: 'center', marginTop: 60 },
  emptyText: { marginTop: 12, color: AppColors.textSecondary },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalBox: { width: '100%', backgroundColor: AppColors.surface, borderRadius: 16, padding: 20 },
  modalHeading: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  modalSub: { fontSize: 13, color: AppColors.primary, marginTop: 4, marginBottom: 12 },
  inputLabel: { fontSize: 12, color: AppColors.textSecondary, marginTop: 8, marginBottom: 4 },
  modalInput: { backgroundColor: AppColors.background, borderWidth: 1, borderColor: AppColors.border, borderRadius: 8, color: '#FFF', paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 20 },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 16 },
  cancelBtnText: { color: AppColors.textSecondary, fontWeight: '600' },
  confirmBtn: { backgroundColor: AppColors.primary, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 },
  confirmBtnText: { color: '#FFF', fontWeight: '700' },
});
