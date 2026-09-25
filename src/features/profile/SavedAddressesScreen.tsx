import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  TextInput,
  Modal,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';
import { apiClient, ApiError } from '../../services/apiClient';
import { ApiEndpoints } from '../../constants/api';

type SavedAddress = {
  id: number;
  label?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pinCode: string;
  isDefault: boolean;
};

const LABELS = ['Home', 'Work', 'Other'];

const emptyForm = {
  label: 'Home',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  pinCode: '',
  isDefault: false,
};

export const SavedAddressesScreen: React.FC = () => {
  const navigation = useNavigation();
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<any>(ApiEndpoints.common.addresses);
      const payload = res?.data ?? res;
      const items = Array.isArray(payload) ? payload : [];
      setAddresses(items);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Could not load addresses';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...emptyForm, isDefault: addresses.length === 0 });
    setModalOpen(true);
  };

  const openEdit = (item: SavedAddress) => {
    setEditingId(item.id);
    setForm({
      label: item.label || 'Home',
      addressLine1: item.addressLine1,
      addressLine2: item.addressLine2 || '',
      city: item.city,
      state: item.state,
      pinCode: item.pinCode,
      isDefault: item.isDefault,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.addressLine1.trim() || !form.city.trim() || !form.state.trim() || !form.pinCode.trim()) {
      Alert.alert('Missing fields', 'Address, city, state and PIN are required.');
      return;
    }
    if (!/^\d{6}$/.test(form.pinCode.trim())) {
      Alert.alert('Invalid PIN', 'Enter a 6-digit Indian PIN code.');
      return;
    }
    setSaving(true);
    try {
      const body = {
        label: form.label,
        addressLine1: form.addressLine1.trim(),
        addressLine2: form.addressLine2.trim() || null,
        city: form.city.trim(),
        state: form.state.trim(),
        pinCode: form.pinCode.trim(),
        isDefault: form.isDefault,
      };
      if (editingId) {
        await apiClient.put(ApiEndpoints.common.address(editingId), body);
      } else {
        await apiClient.post(ApiEndpoints.common.addresses, body);
      }
      setModalOpen(false);
      await load();
    } catch (e) {
      Alert.alert('Could not save', e instanceof ApiError ? e.message : 'Please log in and try again.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (item: SavedAddress) => {
    const run = async () => {
      try {
        await apiClient.delete(ApiEndpoints.common.address(item.id));
        await load();
      } catch (e) {
        Alert.alert('Could not delete', e instanceof ApiError ? e.message : 'Try again.');
      }
    };
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined' || window.confirm('Remove this address?')) void run();
      return;
    }
    Alert.alert('Remove address', 'Remove this saved address?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => void run() },
    ]);
  };

  const setDefault = async (item: SavedAddress) => {
    try {
      await apiClient.put(ApiEndpoints.common.setDefaultAddress(item.id));
      await load();
    } catch (e) {
      Alert.alert('Could not update', e instanceof ApiError ? e.message : 'Try again.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <MaterialIcons name="chevron-left" size={28} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Saved Addresses</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} /> : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {!loading && addresses.length === 0 && !error ? (
          <Text style={styles.emptyText}>No saved addresses yet. Add Home or Work to use at checkout.</Text>
        ) : null}

        {addresses.map((item) => (
          <View key={item.id} style={styles.card}>
            <View style={styles.cardTop}>
              <View style={styles.labelPill}>
                <MaterialIcons
                  name={item.label === 'Work' ? 'work' : item.label === 'Other' ? 'place' : 'home'}
                  size={16}
                  color={colors.yellow}
                />
                <Text style={styles.labelText}>{item.label || 'Home'}</Text>
              </View>
              {item.isDefault ? <Text style={styles.defaultBadge}>DEFAULT</Text> : null}
            </View>
            <Text style={styles.line}>{item.addressLine1}</Text>
            {item.addressLine2 ? <Text style={styles.lineMuted}>{item.addressLine2}</Text> : null}
            <Text style={styles.lineMuted}>
              {item.city}, {item.state} {item.pinCode}
            </Text>
            <View style={styles.actions}>
              {!item.isDefault ? (
                <TouchableOpacity onPress={() => void setDefault(item)}>
                  <Text style={styles.actionLink}>Set default</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity onPress={() => openEdit(item)}>
                <Text style={styles.actionLink}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => confirmDelete(item)}>
                <Text style={[styles.actionLink, { color: colors.error }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        <TouchableOpacity style={styles.addBtn} onPress={openAdd} activeOpacity={0.85}>
          <MaterialIcons name="add" size={20} color="#fff" />
          <Text style={styles.addBtnText}>Add new address</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={modalOpen} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>{editingId ? 'Edit address' : 'Add address'}</Text>
              <View style={styles.labelRow}>
                {LABELS.map((label) => (
                  <TouchableOpacity
                    key={label}
                    style={[styles.chip, form.label === label && styles.chipOn]}
                    onPress={() => setForm((f) => ({ ...f, label }))}
                  >
                    <Text style={[styles.chipText, form.label === label && styles.chipTextOn]}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={styles.input}
                placeholder="House / street"
                placeholderTextColor={colors.textTertiary}
                value={form.addressLine1}
                onChangeText={(addressLine1) => setForm((f) => ({ ...f, addressLine1 }))}
              />
              <TextInput
                style={styles.input}
                placeholder="Landmark (optional)"
                placeholderTextColor={colors.textTertiary}
                value={form.addressLine2}
                onChangeText={(addressLine2) => setForm((f) => ({ ...f, addressLine2 }))}
              />
              <TextInput
                style={styles.input}
                placeholder="City"
                placeholderTextColor={colors.textTertiary}
                value={form.city}
                onChangeText={(city) => setForm((f) => ({ ...f, city }))}
              />
              <TextInput
                style={styles.input}
                placeholder="State"
                placeholderTextColor={colors.textTertiary}
                value={form.state}
                onChangeText={(state) => setForm((f) => ({ ...f, state }))}
              />
              <TextInput
                style={styles.input}
                placeholder="PIN code"
                placeholderTextColor={colors.textTertiary}
                keyboardType="number-pad"
                maxLength={6}
                value={form.pinCode}
                onChangeText={(pinCode) => {
                  const next = pinCode.replace(/\D/g, '').slice(0, 6);
                  setForm((f) => ({ ...f, pinCode: next }));
                }}
              />
              <TouchableOpacity
                style={styles.defaultRow}
                onPress={() => setForm((f) => ({ ...f, isDefault: !f.isDefault }))}
              >
                <MaterialIcons
                  name={form.isDefault ? 'check-box' : 'check-box-outline-blank'}
                  size={22}
                  color={colors.primary}
                />
                <Text style={styles.defaultRowText}>Use as default delivery address</Text>
              </TouchableOpacity>
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalOpen(false)}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={() => void handleSave()} disabled={saving}>
                  {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  backButton: { padding: spacing.xs },
  headerTitle: { ...typography.h2, color: colors.textPrimary },
  scroll: { padding: spacing.md, paddingBottom: spacing.xxxl },
  errorText: { color: colors.error, marginBottom: spacing.md },
  emptyText: { color: colors.textSecondary, marginBottom: spacing.md, lineHeight: 20 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  labelPill: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  labelText: { color: colors.textPrimary, fontWeight: '700' },
  defaultBadge: { color: colors.secondary, fontSize: 11, fontWeight: '700' },
  line: { color: colors.textPrimary, marginTop: 2 },
  lineMuted: { color: colors.textSecondary, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 16, marginTop: 12 },
  actionLink: { color: colors.blue, fontWeight: '600' },
  addBtn: {
    marginTop: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  modalTitle: { ...typography.h2, color: colors.textPrimary, marginBottom: 12 },
  labelRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textSecondary, fontWeight: '600' },
  chipTextOn: { color: '#fff' },
  input: {
    backgroundColor: colors.surfaceLight,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.textPrimary,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  defaultRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 8 },
  defaultRowText: { color: colors.textPrimary },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelText: { color: colors.textSecondary, fontWeight: '700' },
  saveBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: colors.primary,
  },
  saveText: { color: '#fff', fontWeight: '700' },
});
