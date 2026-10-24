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
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppColors } from '../../theme/colors';
import { apiClient } from '../../services/apiClient';
import { FormKeyboardAvoid } from '../../components/common/FormKeyboardAvoid';

export const AdminCouponsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [coupons, setCoupons] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<any | null>(null);

  // Form State
  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState<'FLAT' | 'PERCENTAGE'>('FLAT');
  const [discountValue, setDiscountValue] = useState('');
  const [minOrderAmount, setMinOrderAmount] = useState('');
  const [maxDiscountAmount, setMaxDiscountAmount] = useState('');
  const [perUserLimit, setPerUserLimit] = useState('1');
  const [totalUsageLimit, setTotalUsageLimit] = useState('');
  const [applicableModule, setApplicableModule] = useState('FOOD');
  const [restaurantId, setRestaurantId] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchCoupons = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get<any>('/admin/coupons');
      const payload = res.data?.data || res.data;
      setCoupons(Array.isArray(payload) ? payload : []);
    } catch (err: any) {
      console.warn('[AdminCoupons] Error loading coupons:', err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCoupons();
  }, [fetchCoupons]);

  const openCreateModal = () => {
    setEditingCoupon(null);
    setCode('');
    setDiscountType('FLAT');
    setDiscountValue('');
    setMinOrderAmount('');
    setMaxDiscountAmount('');
    setPerUserLimit('1');
    setTotalUsageLimit('');
    setApplicableModule('FOOD');
    setRestaurantId('');
    setIsActive(true);
    setModalVisible(true);
  };

  const openEditModal = (c: any) => {
    setEditingCoupon(c);
    setCode(c.code || '');
    setDiscountType(c.discountType === 'PERCENTAGE' ? 'PERCENTAGE' : 'FLAT');
    setDiscountValue(String(c.discountValue || ''));
    setMinOrderAmount(String(c.minOrderAmount || ''));
    setMaxDiscountAmount(c.maxDiscountAmount ? String(c.maxDiscountAmount) : '');
    setPerUserLimit(String(c.perUserLimit || '1'));
    setTotalUsageLimit(c.totalUsageLimit ? String(c.totalUsageLimit) : '');
    setApplicableModule(c.applicableModule || 'FOOD');
    setRestaurantId(c.applicableRestaurantId ? String(c.applicableRestaurantId) : '');
    setIsActive(c.isActive !== false);
    setModalVisible(true);
  };

  const handleSaveCoupon = async () => {
    if (!code.trim()) {
      Alert.alert('Validation Error', 'Coupon code is required.');
      return;
    }
    const val = parseFloat(discountValue);
    if (isNaN(val) || val <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid positive discount value.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        action: editingCoupon ? 'EDIT' : 'ADD',
        id: editingCoupon?.id,
        code: code.trim().toUpperCase(),
        discountType,
        discountValue: val,
        minOrderAmount: parseFloat(minOrderAmount) || 0,
        maxDiscountAmount: maxDiscountAmount ? parseFloat(maxDiscountAmount) : null,
        perUserLimit: parseInt(perUserLimit, 10) || 1,
        totalUsageLimit: totalUsageLimit ? parseInt(totalUsageLimit, 10) : null,
        applicableModule,
        applicableRestaurantId: restaurantId ? parseInt(restaurantId, 10) : null,
        isActive,
      };

      const res = await apiClient.post<any>('/admin/coupons', payload);
      const data = res.data;
      if (data?.success || res.status === 200) {
        Alert.alert('Success', `Coupon ${editingCoupon ? 'updated' : 'created'} successfully!`);
        setModalVisible(false);
        fetchCoupons();
      } else {
        Alert.alert('Error', data?.message || 'Could not save coupon');
      }
    } catch (err: any) {
      Alert.alert('Save Failed', err?.response?.data?.message || err?.message || 'Request failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (c: any) => {
    try {
      await apiClient.post<any>('/admin/coupons', {
        action: 'STATUS',
        id: c.id,
        isActive: !c.isActive,
      });
      fetchCoupons();
    } catch (err: any) {
      Alert.alert('Status Update Failed', err?.message);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Coupon Management</Text>
        <TouchableOpacity onPress={openCreateModal} style={styles.addBtn}>
          <Ionicons name="add" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* List */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={AppColors.primary} />
          <Text style={styles.loadingText}>Loading coupons...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {coupons.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="pricetag-outline" size={48} color={AppColors.textSecondary} />
              <Text style={styles.emptyText}>No coupons configured yet.</Text>
            </View>
          ) : (
            coupons.map((c) => (
              <View key={c.id} style={styles.couponCard}>
                <View style={styles.couponTop}>
                  <View>
                    <Text style={styles.couponCode}>{c.code}</Text>
                    <Text style={styles.couponDesc}>
                      {c.discountType === 'PERCENTAGE' ? `${c.discountValue}% OFF` : `₹${c.discountValue} FLAT OFF`}
                      {c.maxDiscountAmount ? ` (Up to ₹${c.maxDiscountAmount})` : ''} • Min ₹{c.minOrderAmount}
                    </Text>
                  </View>
                  <Switch
                    value={c.isActive}
                    onValueChange={() => handleToggleStatus(c)}
                    thumbColor={c.isActive ? AppColors.primary : '#ccc'}
                  />
                </View>

                <View style={styles.couponMeta}>
                  <Text style={styles.metaBadge}>{c.applicableModule || 'ALL'}</Text>
                  {c.applicableRestaurantId && (
                    <Text style={[styles.metaBadge, { backgroundColor: AppColors.yellow + '30', color: AppColors.yellow }]}>
                      Hotel #{c.applicableRestaurantId}
                    </Text>
                  )}
                  <Text style={styles.metaText}>
                    Used: {c.currentUsageCount || 0} {c.totalUsageLimit ? `/ ${c.totalUsageLimit}` : ''}
                  </Text>
                </View>

                <View style={styles.couponActions}>
                  <TouchableOpacity style={styles.editBtn} onPress={() => openEditModal(c)}>
                    <Ionicons name="create-outline" size={16} color={AppColors.primary} />
                    <Text style={styles.editBtnText}>Edit</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* Create / Edit Modal */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <FormKeyboardAvoid>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingCoupon ? 'Edit Coupon' : 'Create New Coupon'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.formScroll}>
              <Text style={styles.inputLabel}>Coupon Code *</Text>
              <TextInput
                style={styles.input}
                value={code}
                onChangeText={setCode}
                placeholder="e.g. SAVE50"
                placeholderTextColor="#777"
                autoCapitalize="characters"
              />

              <Text style={styles.inputLabel}>Discount Type</Text>
              <View style={styles.typeSelector}>
                <TouchableOpacity
                  style={[styles.typeBtn, discountType === 'FLAT' && styles.typeBtnActive]}
                  onPress={() => setDiscountType('FLAT')}
                >
                  <Text style={[styles.typeText, discountType === 'FLAT' && styles.typeTextActive]}>Flat (₹)</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.typeBtn, discountType === 'PERCENTAGE' && styles.typeBtnActive]}
                  onPress={() => setDiscountType('PERCENTAGE')}
                >
                  <Text style={[styles.typeText, discountType === 'PERCENTAGE' && styles.typeTextActive]}>Percentage (%)</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>Discount Value *</Text>
              <TextInput
                style={styles.input}
                value={discountValue}
                onChangeText={setDiscountValue}
                placeholder={discountType === 'FLAT' ? 'e.g. 50' : 'e.g. 10'}
                placeholderTextColor="#777"
                keyboardType="numeric"
              />

              <Text style={styles.inputLabel}>Min Order Amount (₹)</Text>
              <TextInput
                style={styles.input}
                value={minOrderAmount}
                onChangeText={setMinOrderAmount}
                placeholder="0"
                placeholderTextColor="#777"
                keyboardType="numeric"
              />

              {discountType === 'PERCENTAGE' && (
                <>
                  <Text style={styles.inputLabel}>Max Discount Cap (₹)</Text>
                  <TextInput
                    style={styles.input}
                    value={maxDiscountAmount}
                    onChangeText={setMaxDiscountAmount}
                    placeholder="Optional cap amount"
                    placeholderTextColor="#777"
                    keyboardType="numeric"
                  />
                </>
              )}

              <Text style={styles.inputLabel}>Module</Text>
              <View style={styles.typeSelector}>
                {['FOOD', 'RIDE', 'ALL'].map((m) => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.typeBtn, applicableModule === m && styles.typeBtnActive]}
                    onPress={() => setApplicableModule(m)}
                  >
                    <Text style={[styles.typeText, applicableModule === m && styles.typeTextActive]}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {applicableModule === 'FOOD' && (
                <>
                  <Text style={styles.inputLabel}>Hotel Scope (Optional Restaurant ID)</Text>
                  <TextInput
                    style={styles.input}
                    value={restaurantId}
                    onChangeText={setRestaurantId}
                    placeholder="Leave empty for all restaurants"
                    placeholderTextColor="#777"
                    keyboardType="numeric"
                  />
                </>
              )}

              <Text style={styles.inputLabel}>Per User Limit</Text>
              <TextInput
                style={styles.input}
                value={perUserLimit}
                onChangeText={setPerUserLimit}
                placeholder="1"
                placeholderTextColor="#777"
                keyboardType="numeric"
              />

              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveCoupon} disabled={isSubmitting}>
                {isSubmitting ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.saveBtnText}>{editingCoupon ? 'Update Coupon' : 'Create Coupon'}</Text>
                )}
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
  addBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFF' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: AppColors.textSecondary, fontSize: 14 },
  scrollContent: { padding: 16 },
  emptyContainer: { alignItems: 'center', marginTop: 60 },
  emptyText: { marginTop: 12, color: AppColors.textSecondary, fontSize: 14 },
  couponCard: {
    backgroundColor: AppColors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  couponTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  couponCode: { fontSize: 16, fontWeight: '800', color: AppColors.primary, letterSpacing: 1 },
  couponDesc: { fontSize: 13, color: AppColors.textSecondary, marginTop: 4 },
  couponMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 12, flexWrap: 'wrap', gap: 8 },
  metaBadge: {
    backgroundColor: AppColors.primary + '20',
    color: AppColors.primary,
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  metaText: { fontSize: 12, color: AppColors.textSecondary },
  couponActions: { marginTop: 12, borderTopWidth: 1, borderTopColor: AppColors.border, paddingTop: 8, alignItems: 'flex-end' },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  editBtnText: { color: AppColors.primary, fontSize: 13, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: AppColors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '90%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#FFF' },
  formScroll: { paddingBottom: 24 },
  inputLabel: { fontSize: 13, color: AppColors.textSecondary, marginTop: 12, marginBottom: 6 },
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
  typeSelector: { flexDirection: 'row', gap: 8 },
  typeBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: AppColors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  typeBtnActive: { borderColor: AppColors.primary, backgroundColor: AppColors.primary + '20' },
  typeText: { color: AppColors.textSecondary, fontSize: 13, fontWeight: '600' },
  typeTextActive: { color: AppColors.primary },
  saveBtn: {
    backgroundColor: AppColors.primary,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24,
  },
  saveBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
});
