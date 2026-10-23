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

interface FareRule {
  vehicleType: string;
  baseFare: number;
  minimumFare: number;
  baseDistanceKm: number;
  perKmRate: number;
  perMinuteRate: number;
  bookingFee: number;
  platformFee: number;
  taxPercent: number;
  nightSurchargeMultiplier: number;
  surgeMultiplier: number;
}

export const AdminRideFaresScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [rules, setRules] = useState<FareRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Edit Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRule, setEditingRule] = useState<FareRule | null>(null);
  const [baseFare, setBaseFare] = useState('');
  const [minimumFare, setMinimumFare] = useState('');
  const [baseDistanceKm, setBaseDistanceKm] = useState('');
  const [perKmRate, setPerKmRate] = useState('');
  const [perMinuteRate, setPerMinuteRate] = useState('');
  const [bookingFee, setBookingFee] = useState('');
  const [platformFee, setPlatformFee] = useState('');
  const [taxPercent, setTaxPercent] = useState('');
  const [nightSurchargeMultiplier, setNightSurchargeMultiplier] = useState('');
  const [surgeMultiplier, setSurgeMultiplier] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const fetchFares = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get<any>('/admin/ride-fares');
      const payload = res.data?.data || res.data;
      setRules(Array.isArray(payload) ? payload : []);
    } catch (err: any) {
      console.warn('[AdminRideFares] Error loading fare rules:', err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFares();
  }, [fetchFares]);

  const openEditModal = (r: FareRule) => {
    setEditingRule(r);
    setBaseFare(String(r.baseFare));
    setMinimumFare(String(r.minimumFare));
    setBaseDistanceKm(String(r.baseDistanceKm));
    setPerKmRate(String(r.perKmRate));
    setPerMinuteRate(String(r.perMinuteRate));
    setBookingFee(String(r.bookingFee));
    setPlatformFee(String(r.platformFee));
    setTaxPercent(String(r.taxPercent));
    setNightSurchargeMultiplier(String(r.nightSurchargeMultiplier));
    setSurgeMultiplier(String(r.surgeMultiplier));
    setModalVisible(true);
  };

  const handleSaveRule = async () => {
    if (!editingRule) return;

    const bFare = parseFloat(baseFare);
    const mFare = parseFloat(minimumFare);
    const bDist = parseFloat(baseDistanceKm);
    const kmRate = parseFloat(perKmRate);
    const minRate = parseFloat(perMinuteRate);
    const bFee = parseFloat(bookingFee);
    const pFee = parseFloat(platformFee);
    const tax = parseFloat(taxPercent);
    const night = parseFloat(nightSurchargeMultiplier);
    const surge = parseFloat(surgeMultiplier);

    if (
      isNaN(bFare) || bFare < 0 ||
      isNaN(mFare) || mFare < 0 ||
      isNaN(bDist) || bDist < 0 ||
      isNaN(kmRate) || kmRate < 0 ||
      isNaN(minRate) || minRate < 0 ||
      isNaN(bFee) || bFee < 0 ||
      isNaN(pFee) || pFee < 0 ||
      isNaN(tax) || tax < 0 ||
      isNaN(night) || night < 1 ||
      isNaN(surge) || surge < 1
    ) {
      Alert.alert('Validation Error', 'Please check your values. Non-negative rates required, multipliers must be >= 1.0.');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        baseFare: bFare,
        minimumFare: mFare,
        baseDistanceKm: bDist,
        perKmRate: kmRate,
        perMinuteRate: minRate,
        bookingFee: bFee,
        platformFee: pFee,
        taxPercent: tax,
        nightSurchargeMultiplier: night,
        surgeMultiplier: surge,
      };

      await apiClient.put<any>(`/admin/ride-fares/rules/${editingRule.vehicleType}`, payload);
      Alert.alert('Success', `Fare configuration for ${editingRule.vehicleType} updated!`);
      setModalVisible(false);
      fetchFares();
    } catch (err: any) {
      Alert.alert('Update Failed', err?.response?.data?.message || err?.message || 'Could not update fare rules');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
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
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {rules.map((r) => (
            <View key={r.vehicleType} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.vehicleRow}>
                  <Ionicons
                    name={r.vehicleType === 'Bike' ? 'bicycle-outline' : r.vehicleType === 'Auto' ? 'car-sport-outline' : 'car-outline'}
                    size={24}
                    color={AppColors.primary}
                  />
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
                  <Text style={styles.gridVal}>₹{r.baseFare} (incl. {r.baseDistanceKm}km)</Text>
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
                  <Text style={styles.gridVal}>₹{r.bookingFee} + ₹{r.platformFee}</Text>
                </View>
                <View style={styles.gridItem}>
                  <Text style={styles.gridLabel}>GST Tax</Text>
                  <Text style={styles.gridVal}>{r.taxPercent}%</Text>
                </View>
                <View style={styles.gridItem}>
                  <Text style={styles.gridLabel}>Night Surcharge</Text>
                  <Text style={styles.gridVal}>{r.nightSurchargeMultiplier}x</Text>
                </View>
                <View style={styles.gridItem}>
                  <Text style={styles.gridLabel}>Surge Multiplier</Text>
                  <Text style={styles.gridVal}>{r.surgeMultiplier}x</Text>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Edit Fare Modal */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
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
                  <TextInput style={styles.input} value={baseDistanceKm} onChangeText={setBaseDistanceKm} keyboardType="numeric" />
                </View>
              </View>

              <View style={styles.twoCol}>
                <View style={styles.col}>
                  <Text style={styles.inputLabel}>Per Km Rate (₹)</Text>
                  <TextInput style={styles.input} value={perKmRate} onChangeText={setPerKmRate} keyboardType="numeric" />
                </View>
                <View style={styles.col}>
                  <Text style={styles.inputLabel}>Per Minute Rate (₹)</Text>
                  <TextInput style={styles.input} value={perMinuteRate} onChangeText={setPerMinuteRate} keyboardType="numeric" />
                </View>
              </View>

              <View style={styles.twoCol}>
                <View style={styles.col}>
                  <Text style={styles.inputLabel}>Minimum Fare (₹)</Text>
                  <TextInput style={styles.input} value={minimumFare} onChangeText={setMinimumFare} keyboardType="numeric" />
                </View>
                <View style={styles.col}>
                  <Text style={styles.inputLabel}>Booking Fee (₹)</Text>
                  <TextInput style={styles.input} value={bookingFee} onChangeText={setBookingFee} keyboardType="numeric" />
                </View>
              </View>

              <View style={styles.twoCol}>
                <View style={styles.col}>
                  <Text style={styles.inputLabel}>Platform Fee (₹)</Text>
                  <TextInput style={styles.input} value={platformFee} onChangeText={setPlatformFee} keyboardType="numeric" />
                </View>
                <View style={styles.col}>
                  <Text style={styles.inputLabel}>Tax (%)</Text>
                  <TextInput style={styles.input} value={taxPercent} onChangeText={setTaxPercent} keyboardType="numeric" />
                </View>
              </View>

              <View style={styles.twoCol}>
                <View style={styles.col}>
                  <Text style={styles.inputLabel}>Night Multiplier</Text>
                  <TextInput style={styles.input} value={nightSurchargeMultiplier} onChangeText={setNightSurchargeMultiplier} keyboardType="numeric" />
                </View>
                <View style={styles.col}>
                  <Text style={styles.inputLabel}>Surge Multiplier</Text>
                  <TextInput style={styles.input} value={surgeMultiplier} onChangeText={setSurgeMultiplier} keyboardType="numeric" />
                </View>
              </View>

              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveRule} disabled={isSaving}>
                {isSaving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>Save Fare Configuration</Text>}
              </TouchableOpacity>
            </ScrollView>
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
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: AppColors.textSecondary },
  scrollContent: { padding: 16 },
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
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: AppColors.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  editBtnText: { color: '#FFF', fontSize: 13, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  gridItem: { width: '47%', backgroundColor: AppColors.background, padding: 10, borderRadius: 8 },
  gridLabel: { fontSize: 11, color: AppColors.textSecondary },
  gridVal: { fontSize: 14, fontWeight: '700', color: '#FFF', marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: AppColors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#FFF' },
  formScroll: { paddingBottom: 24 },
  twoCol: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  col: { flex: 1 },
  inputLabel: { fontSize: 12, color: AppColors.textSecondary, marginBottom: 4 },
  input: { backgroundColor: AppColors.background, borderWidth: 1, borderColor: AppColors.border, borderRadius: 8, color: '#FFF', paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  saveBtn: { backgroundColor: AppColors.primary, paddingVertical: 14, borderRadius: 8, alignItems: 'center', marginTop: 20 },
  saveBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
});
