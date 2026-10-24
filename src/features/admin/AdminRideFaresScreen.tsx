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
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppColors } from '../../theme/colors';
import { apiClient } from '../../services/apiClient';
import { FormKeyboardAvoid } from '../../components/common/FormKeyboardAvoid';
import { extractRideFareRules, type MappedFareRule } from './adminFinanceMappers';

function vehicleIcon(type: string): keyof typeof Ionicons.glyphMap {
  if (type === 'BIKE') return 'bicycle-outline';
  if (type === 'AUTO') return 'car-sport-outline';
  return 'car-outline';
}

export const AdminRideFaresScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [rules, setRules] = useState<MappedFareRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingRule, setEditingRule] = useState<MappedFareRule | null>(null);
  const [baseFare, setBaseFare] = useState('');
  const [minimumFare, setMinimumFare] = useState('');
  const [includedDistanceKm, setIncludedDistanceKm] = useState('');
  const [perKmRate, setPerKmRate] = useState('');
  const [perMinuteRate, setPerMinuteRate] = useState('');
  const [bookingFee, setBookingFee] = useState('');
  const [platformFee, setPlatformFee] = useState('');
  const [taxPercentage, setTaxPercentage] = useState('');
  const [nightSurchargePercent, setNightSurchargePercent] = useState('');
  const [peakMultiplier, setPeakMultiplier] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const fetchFares = useCallback(async (refreshing = false) => {
    if (refreshing) setIsRefreshing(true);
    else setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await apiClient.get<any>('/admin/ride-fares');
      const payload = res.data?.data ?? res.data;
      const mapped = extractRideFareRules(payload).filter((r) => !!r.vehicleType);
      setRules(mapped);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Could not load fare rules';
      setErrorMessage(msg);
      console.warn('[AdminRideFares] Error loading fare rules:', msg);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchFares();
  }, [fetchFares]);

  const openEditModal = (r: MappedFareRule) => {
    setEditingRule(r);
    setBaseFare(String(r.baseFare));
    setMinimumFare(String(r.minimumFare));
    setIncludedDistanceKm(String(r.includedDistanceKm));
    setPerKmRate(String(r.perKmRate));
    setPerMinuteRate(String(r.perMinuteRate));
    setBookingFee(String(r.bookingFee));
    setPlatformFee(String(r.platformFee));
    setTaxPercentage(String(r.taxPercentage));
    setNightSurchargePercent(String(r.nightSurchargePercent));
    setPeakMultiplier(String(r.peakMultiplier));
    setModalVisible(true);
  };

  const handleSaveRule = async () => {
    if (!editingRule) return;

    const bFare = parseFloat(baseFare);
    const mFare = parseFloat(minimumFare);
    const included = parseFloat(includedDistanceKm);
    const kmRate = parseFloat(perKmRate);
    const minRate = parseFloat(perMinuteRate);
    const bFee = parseFloat(bookingFee);
    const pFee = parseFloat(platformFee);
    const tax = parseFloat(taxPercentage);
    const night = parseFloat(nightSurchargePercent);
    const peak = parseFloat(peakMultiplier);

    if (
      [bFare, mFare, included, kmRate, minRate, bFee, pFee, tax, night, peak].some((v) => isNaN(v) || v < 0) ||
      peak < 1
    ) {
      Alert.alert(
        'Validation Error',
        'Please check your values. Amounts must be non-negative; peak multiplier must be >= 1.0.'
      );
      return;
    }

    setIsSaving(true);
    try {
      // Match backend RideFareRule property names.
      const payload = {
        vehicleType: editingRule.vehicleType,
        baseFare: bFare,
        minimumFare: mFare,
        includedDistanceKm: included,
        perKmRate: kmRate,
        perMinuteRate: minRate,
        bookingFee: bFee,
        platformFee: pFee,
        taxPercentage: tax,
        nightSurchargePercent: night,
        peakMultiplier: peak,
        isActive: true,
      };

      await apiClient.put<any>(`/admin/ride-fares/rules/${editingRule.vehicleType}`, payload);
      Alert.alert('Success', `Fare configuration for ${editingRule.vehicleType} updated!`);
      setModalVisible(false);
      fetchFares(true);
    } catch (err: any) {
      Alert.alert('Update Failed', err?.response?.data?.message || err?.message || 'Could not update fare rules');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityRole="button">
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ride Fare Configuration</Text>
        <View style={{ width: 24 }} />
      </View>

      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={AppColors.primary} />
          <Text style={styles.loadingText}>Loading fare rules...</Text>
        </View>
      ) : errorMessage ? (
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
          <Text style={styles.errorText}>{errorMessage}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => fetchFares()}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={() => fetchFares(true)} tintColor={AppColors.primary} />
          }
        >
          {rules.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="speedometer-outline" size={48} color={AppColors.textSecondary} />
              <Text style={styles.emptyText}>No fare rules returned from the server.</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={() => fetchFares()}>
                <Text style={styles.retryBtnText}>Reload</Text>
              </TouchableOpacity>
            </View>
          ) : (
            rules.map((r) => (
              <View key={r.vehicleType} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.vehicleRow}>
                    <Ionicons name={vehicleIcon(r.vehicleType)} size={24} color={AppColors.primary} />
                    <Text style={styles.vehicleType}>{r.vehicleType} Tier</Text>
                  </View>
                  <TouchableOpacity style={styles.editBtn} onPress={() => openEditModal(r)}>
                    <Ionicons name="pencil" size={16} color="#FFF" />
                    <Text style={styles.editBtnText}>Configure</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.grid}>
                  <View style={styles.gridItem}>
                    <Text style={styles.gridLabel}>Base Fare</Text>
                    <Text style={styles.gridVal}>
                      ₹{r.baseFare} (incl. {r.includedDistanceKm} km)
                    </Text>
                  </View>
                  <View style={styles.gridItem}>
                    <Text style={styles.gridLabel}>Per Km Rate</Text>
                    <Text style={styles.gridVal}>₹{r.perKmRate} / km</Text>
                  </View>
                  <View style={styles.gridItem}>
                    <Text style={styles.gridLabel}>Per Min Rate</Text>
                    <Text style={styles.gridVal}>₹{r.perMinuteRate} / min</Text>
                  </View>
                  <View style={styles.gridItem}>
                    <Text style={styles.gridLabel}>Minimum Fare</Text>
                    <Text style={styles.gridVal}>₹{r.minimumFare}</Text>
                  </View>
                  <View style={styles.gridItem}>
                    <Text style={styles.gridLabel}>Booking & Platform Fee</Text>
                    <Text style={styles.gridVal}>
                      ₹{r.bookingFee} + ₹{r.platformFee}
                    </Text>
                  </View>
                  <View style={styles.gridItem}>
                    <Text style={styles.gridLabel}>Tax</Text>
                    <Text style={styles.gridVal}>{r.taxPercentage}%</Text>
                  </View>
                  <View style={styles.gridItem}>
                    <Text style={styles.gridLabel}>Night Surcharge</Text>
                    <Text style={styles.gridVal}>{r.nightSurchargePercent}%</Text>
                  </View>
                  <View style={styles.gridItem}>
                    <Text style={styles.gridLabel}>Peak Multiplier</Text>
                    <Text style={styles.gridVal}>{r.peakMultiplier}x</Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <FormKeyboardAvoid>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Configure {editingRule?.vehicleType} Fare Rules</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.formScroll}>
              <View style={styles.twoCol}>
                <View style={styles.col}>
                  <Text style={styles.inputLabel}>Base Fare (₹)</Text>
                  <TextInput style={styles.input} value={baseFare} onChangeText={setBaseFare} keyboardType="numeric" />
                </View>
                <View style={styles.col}>
                  <Text style={styles.inputLabel}>Included Dist (km)</Text>
                  <TextInput
                    style={styles.input}
                    value={includedDistanceKm}
                    onChangeText={setIncludedDistanceKm}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.twoCol}>
                <View style={styles.col}>
                  <Text style={styles.inputLabel}>Per Km Rate (₹)</Text>
                  <TextInput style={styles.input} value={perKmRate} onChangeText={setPerKmRate} keyboardType="numeric" />
                </View>
                <View style={styles.col}>
                  <Text style={styles.inputLabel}>Per Minute Rate (₹)</Text>
                  <TextInput
                    style={styles.input}
                    value={perMinuteRate}
                    onChangeText={setPerMinuteRate}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.twoCol}>
                <View style={styles.col}>
                  <Text style={styles.inputLabel}>Minimum Fare (₹)</Text>
                  <TextInput
                    style={styles.input}
                    value={minimumFare}
                    onChangeText={setMinimumFare}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.col}>
                  <Text style={styles.inputLabel}>Booking Fee (₹)</Text>
                  <TextInput style={styles.input} value={bookingFee} onChangeText={setBookingFee} keyboardType="numeric" />
                </View>
              </View>

              <View style={styles.twoCol}>
                <View style={styles.col}>
                  <Text style={styles.inputLabel}>Platform Fee (₹)</Text>
                  <TextInput
                    style={styles.input}
                    value={platformFee}
                    onChangeText={setPlatformFee}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.col}>
                  <Text style={styles.inputLabel}>Tax (%)</Text>
                  <TextInput
                    style={styles.input}
                    value={taxPercentage}
                    onChangeText={setTaxPercentage}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.twoCol}>
                <View style={styles.col}>
                  <Text style={styles.inputLabel}>Night Surcharge (%)</Text>
                  <TextInput
                    style={styles.input}
                    value={nightSurchargePercent}
                    onChangeText={setNightSurchargePercent}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.col}>
                  <Text style={styles.inputLabel}>Peak Multiplier</Text>
                  <TextInput
                    style={styles.input}
                    value={peakMultiplier}
                    onChangeText={setPeakMultiplier}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveRule} disabled={isSaving}>
                {isSaving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>Save Fare Configuration</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
        </FormKeyboardAvoid>
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
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { marginTop: 12, color: AppColors.textSecondary },
  errorText: { marginTop: 12, color: '#FCA5A5', textAlign: 'center' },
  retryBtn: { marginTop: 16, backgroundColor: AppColors.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  retryBtnText: { color: '#FFF', fontWeight: '700' },
  emptyContainer: { alignItems: 'center', marginTop: 60 },
  emptyText: { marginTop: 12, color: AppColors.textSecondary, textAlign: 'center' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: AppColors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  vehicleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  vehicleType: { fontSize: 18, fontWeight: '700', color: '#FFF' },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: AppColors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  editBtnText: { color: '#FFF', fontSize: 13, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  gridItem: { width: '47%', backgroundColor: AppColors.background, padding: 10, borderRadius: 8 },
  gridLabel: { fontSize: 11, color: AppColors.textSecondary },
  gridVal: { fontSize: 14, fontWeight: '700', color: '#FFF', marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: AppColors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '90%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#FFF', flex: 1, paddingRight: 8 },
  formScroll: { paddingBottom: 24 },
  twoCol: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  col: { flex: 1 },
  inputLabel: { fontSize: 12, color: AppColors.textSecondary, marginBottom: 4 },
  input: {
    backgroundColor: AppColors.background,
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: 8,
    color: '#FFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  saveBtn: { backgroundColor: AppColors.primary, paddingVertical: 14, borderRadius: 8, alignItems: 'center', marginTop: 20 },
  saveBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
});
