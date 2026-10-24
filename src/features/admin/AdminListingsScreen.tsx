import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppColors } from '../../theme/colors';
import { apiClient } from '../../services/apiClient';
import { ApiEndpoints } from '../../constants/api';
import { FormKeyboardAvoid } from '../../components/common/FormKeyboardAvoid';

type TabKey = 'FOOD' | 'MARKETPLACE';

interface AdminListingsScreenProps {
  navigation: any;
}

export const AdminListingsScreen: React.FC<AdminListingsScreenProps> = ({ navigation }) => {
  const [tab, setTab] = useState<TabKey>('FOOD');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [foodItems, setFoodItems] = useState<any[]>([]);
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const [editVisible, setEditVisible] = useState(false);
  const [editKind, setEditKind] = useState<TabKey>('FOOD');
  const [editItem, setEditItem] = useState<any>(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editDiscount, setEditDiscount] = useState('0');
  const [editDesc, setEditDesc] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== 'ALL') params.set('status', statusFilter);
      if (search.trim()) params.set('search', search.trim());
      const qs = params.toString() ? `?${params.toString()}` : '';

      if (tab === 'FOOD') {
        const res = await apiClient.get<any>(`${ApiEndpoints.admin.foodItems}${qs}`);
        setFoodItems(res.data?.data || res.data || []);
      } else {
        const res = await apiClient.get<any>(`${ApiEndpoints.admin.marketplaceListings}${qs}`);
        setListings(res.data?.data || res.data || []);
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not load listings');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab, search, statusFilter]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const filteredHint = useMemo(() => {
    const count = tab === 'FOOD' ? foodItems.length : listings.length;
    return `${count} result${count === 1 ? '' : 's'}`;
  }, [tab, foodItems.length, listings.length]);

  const openEditFood = (item: any) => {
    setEditKind('FOOD');
    setEditItem(item);
    setEditName(item.name || '');
    setEditPrice(String(item.basePrice ?? ''));
    setEditDiscount(String(item.discountPercent ?? 0));
    setEditDesc(item.description || '');
    setEditVisible(true);
  };

  const openEditListing = (item: any) => {
    setEditKind('MARKETPLACE');
    setEditItem(item);
    setEditName(item.title || '');
    setEditPrice(String(item.price ?? ''));
    setEditDiscount('0');
    setEditDesc(item.description || '');
    setEditVisible(true);
  };

  const saveEdit = async () => {
    if (!editItem) return;
    const price = parseFloat(editPrice);
    if (!editName.trim()) {
      Alert.alert('Validation', 'Name is required');
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      Alert.alert('Validation', 'Enter a valid price (>= 0)');
      return;
    }
    if (editKind === 'FOOD') {
      const disc = parseFloat(editDiscount || '0');
      if (!Number.isFinite(disc) || disc < 0 || disc > 100) {
        Alert.alert('Validation', 'Discount must be 0–100%');
        return;
      }
    }

    setSaving(true);
    try {
      if (editKind === 'FOOD') {
        await apiClient.post(ApiEndpoints.admin.foodItems, {
          action: 'EDIT',
          foodItemId: editItem.id,
          name: editName.trim(),
          description: editDesc.trim(),
          basePrice: price,
          discountPercent: parseFloat(editDiscount || '0'),
        });
      } else {
        await apiClient.post(ApiEndpoints.admin.marketplaceListings, {
          action: 'EDIT',
          listingId: editItem.id,
          title: editName.trim(),
          description: editDesc.trim(),
          price,
        });
      }
      setEditVisible(false);
      await load();
      Alert.alert('Saved', 'Listing updated');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (kind: TabKey, id: number, label: string) => {
    Alert.alert('Delete?', `${label} will be deactivated.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusyId(id);
          try {
            if (kind === 'FOOD') {
              await apiClient.post(ApiEndpoints.admin.foodItems, { action: 'DELETE', foodItemId: id });
            } else {
              await apiClient.post(ApiEndpoints.admin.marketplaceListings, {
                action: 'DELETE',
                listingId: id,
              });
            }
            await load();
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'Delete failed');
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  const toggleFoodAvailability = async (item: any) => {
    setBusyId(item.id);
    try {
      await apiClient.post(ApiEndpoints.admin.foodItems, {
        action: 'STATUS',
        foodItemId: item.id,
        isAvailable: !item.isAvailable,
      });
      setFoodItems((prev) =>
        prev.map((f) => (f.id === item.id ? { ...f, isAvailable: !item.isAvailable } : f))
      );
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not update status');
    } finally {
      setBusyId(null);
    }
  };

  const toggleListingStatus = async (item: any) => {
    const next = item.status === 'ACTIVE' ? 'REMOVED' : 'ACTIVE';
    setBusyId(item.id);
    try {
      await apiClient.post(ApiEndpoints.admin.marketplaceListings, {
        action: 'STATUS',
        listingId: item.id,
        status: next,
      });
      setListings((prev) =>
        prev.map((l) =>
          l.id === item.id ? { ...l, status: next, isActive: next === 'ACTIVE' } : l
        )
      );
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not update status');
    } finally {
      setBusyId(null);
    }
  };

  const statusChips =
    tab === 'FOOD'
      ? ['ALL', 'AVAILABLE', 'UNAVAILABLE']
      : ['ALL', 'ACTIVE', 'SOLD', 'REMOVED', 'FLAGGED'];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={AppColors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Listings Management</Text>
          <Text style={styles.subtitle}>Food and Marketplace on one page</Text>
        </View>
      </View>

      <View style={styles.tabs}>
        {(['FOOD', 'MARKETPLACE'] as TabKey[]).map((key) => (
          <TouchableOpacity
            key={key}
            style={[styles.tab, tab === key && styles.tabActive]}
            onPress={() => setTab(key)}
          >
            <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>
              {key === 'FOOD' ? 'Food' : 'Marketplace'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.searchRow}>
        <Ionicons name="search" size={16} color={AppColors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder={tab === 'FOOD' ? 'Search food or restaurant' : 'Search listing or seller'}
          placeholderTextColor={AppColors.textSecondary}
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={() => {
            setLoading(true);
            load();
          }}
          returnKeyType="search"
        />
        <TouchableOpacity
          onPress={() => {
            setLoading(true);
            load();
          }}
        >
          <Text style={styles.searchBtn}>Go</Text>
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {statusChips.map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.chip, statusFilter === s && styles.chipActive]}
            onPress={() => setStatusFilter(s)}
          >
            <Text style={[styles.chipText, statusFilter === s && styles.chipTextActive]}>{s}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={styles.resultHint}>{filteredHint}</Text>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={AppColors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={AppColors.primary}
            />
          }
        >
          {tab === 'FOOD'
            ? foodItems.map((item) => {
                const disc = Number(item.discountPercent || 0);
                const sale = Number(item.discountedPrice ?? item.basePrice);
                return (
                  <View key={item.id} style={styles.card}>
                    <View style={styles.cardTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cardTitle} numberOfLines={1}>
                          {item.name}
                        </Text>
                        <Text style={styles.meta}>
                          {item.restaurantName}
                          {item.categoryName ? ` · ${item.categoryName}` : ''}
                        </Text>
                        <Text style={styles.meta}>
                          Owner: {item.ownerName || '—'}
                          {item.ownerPhone ? ` · ${item.ownerPhone}` : ''}
                        </Text>
                      </View>
                      <View style={styles.badge}>
                        <Text
                          style={[
                            styles.badgeText,
                            { color: item.isAvailable && item.isActive ? '#10B981' : '#EF4444' },
                          ]}
                        >
                          {item.isAvailable && item.isActive ? 'ACTIVE' : 'OFF'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.priceRow}>
                      {disc > 0 ? (
                        <>
                          <View style={styles.discountBanner}>
                            <Text style={styles.discountText}>{disc}% OFF</Text>
                          </View>
                          <Text style={styles.strike}>₹{item.basePrice}</Text>
                          <Text style={styles.price}>₹{sale}</Text>
                        </>
                      ) : (
                        <Text style={styles.price}>₹{item.basePrice}</Text>
                      )}
                    </View>
                    <View style={styles.actions}>
                      <TouchableOpacity style={styles.actionBtn} onPress={() => openEditFood(item)}>
                        <Ionicons name="pencil" size={14} color="#FFF" />
                        <Text style={styles.actionText}>Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.secondaryAction]}
                        onPress={() => toggleFoodAvailability(item)}
                        disabled={busyId === item.id}
                      >
                        {busyId === item.id ? (
                          <ActivityIndicator size="small" color="#FFF" />
                        ) : (
                          <>
                            <Ionicons
                              name={item.isAvailable ? 'pause' : 'play'}
                              size={14}
                              color="#FFF"
                            />
                            <Text style={styles.actionText}>
                              {item.isAvailable ? 'Disable' : 'Enable'}
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.dangerAction]}
                        onPress={() => confirmDelete('FOOD', item.id, item.name)}
                      >
                        <Ionicons name="trash-outline" size={14} color="#FFF" />
                        <Text style={styles.actionText}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            : listings.map((item) => (
                <View key={item.id} style={styles.card}>
                  <View style={styles.cardTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <Text style={styles.meta}>
                        {item.categoryName || 'General'}
                        {item.location ? ` · ${item.location}` : ''}
                      </Text>
                      <Text style={styles.meta}>
                        Seller: {item.sellerName || '—'}
                        {item.sellerPhone ? ` · ${item.sellerPhone}` : ''}
                      </Text>
                    </View>
                    <View style={styles.badge}>
                      <Text
                        style={[
                          styles.badgeText,
                          {
                            color:
                              item.status === 'ACTIVE' || item.isActive ? '#10B981' : '#F59E0B',
                          },
                        ]}
                      >
                        {item.status || (item.isActive ? 'ACTIVE' : 'OFF')}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.price}>₹{item.price}</Text>
                  <View style={styles.actions}>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => openEditListing(item)}>
                      <Ionicons name="pencil" size={14} color="#FFF" />
                      <Text style={styles.actionText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.secondaryAction]}
                      onPress={() => toggleListingStatus(item)}
                      disabled={busyId === item.id}
                    >
                      {busyId === item.id ? (
                        <ActivityIndicator size="small" color="#FFF" />
                      ) : (
                        <>
                          <Switch
                            value={item.status === 'ACTIVE' || !!item.isActive}
                            onValueChange={() => toggleListingStatus(item)}
                            trackColor={{ false: '#334155', true: '#10B98150' }}
                            thumbColor={
                              item.status === 'ACTIVE' || item.isActive ? '#10B981' : '#EF4444'
                            }
                          />
                        </>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.dangerAction]}
                      onPress={() => confirmDelete('MARKETPLACE', item.id, item.title)}
                    >
                      <Ionicons name="trash-outline" size={14} color="#FFF" />
                      <Text style={styles.actionText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

          {(tab === 'FOOD' ? foodItems : listings).length === 0 && (
            <View style={styles.empty}>
              <Ionicons name="file-tray-outline" size={40} color={AppColors.textSecondary} />
              <Text style={styles.emptyText}>No listings found</Text>
            </View>
          )}
        </ScrollView>
      )}

      <Modal visible={editVisible} transparent animationType="slide" onRequestClose={() => setEditVisible(false)}>
        <FormKeyboardAvoid>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Edit {editKind === 'FOOD' ? 'Food Item' : 'Marketplace Listing'}
              </Text>
              <TouchableOpacity onPress={() => setEditVisible(false)}>
                <Ionicons name="close" size={22} color={AppColors.textPrimary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.label}>Name</Text>
            <TextInput style={styles.input} value={editName} onChangeText={setEditName} />
            <Text style={styles.label}>Price (₹)</Text>
            <TextInput
              style={styles.input}
              value={editPrice}
              onChangeText={setEditPrice}
              keyboardType="decimal-pad"
            />
            {editKind === 'FOOD' && (
              <>
                <Text style={styles.label}>Discount %</Text>
                <TextInput
                  style={styles.input}
                  value={editDiscount}
                  onChangeText={setEditDiscount}
                  keyboardType="decimal-pad"
                />
              </>
            )}
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, { minHeight: 70 }]}
              value={editDesc}
              onChangeText={setEditDesc}
              multiline
            />
            <TouchableOpacity style={styles.saveBtn} onPress={saveEdit} disabled={saving}>
              {saving ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.saveBtnText}>Save Changes</Text>
              )}
            </TouchableOpacity>
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
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: AppColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 18, fontWeight: '700', color: AppColors.textPrimary },
  subtitle: { fontSize: 12, color: AppColors.textSecondary, marginTop: 2 },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: AppColors.surface,
    borderRadius: 12,
    padding: 4,
  },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  tabActive: { backgroundColor: AppColors.primary },
  tabText: { color: AppColors.textSecondary, fontWeight: '600', fontSize: 13 },
  tabTextActive: { color: '#FFF' },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: AppColors.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  searchInput: { flex: 1, color: AppColors.textPrimary, paddingVertical: 12, fontSize: 14 },
  searchBtn: { color: AppColors.primary, fontWeight: '700', paddingHorizontal: 6 },
  chips: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: AppColors.surface,
    borderWidth: 1,
    borderColor: AppColors.border,
    marginRight: 8,
  },
  chipActive: { backgroundColor: AppColors.primary + '25', borderColor: AppColors.primary },
  chipText: { color: AppColors.textSecondary, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: AppColors.primary },
  resultHint: {
    marginHorizontal: 16,
    marginBottom: 6,
    color: AppColors.textSecondary,
    fontSize: 12,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: AppColors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  cardTop: { flexDirection: 'row', gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: AppColors.textPrimary },
  meta: { fontSize: 12, color: AppColors.textSecondary, marginTop: 2 },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: AppColors.surfaceLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: { fontSize: 11, fontWeight: '700' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  price: { fontSize: 16, fontWeight: '700', color: AppColors.textPrimary, marginTop: 6 },
  strike: { fontSize: 13, color: AppColors.textSecondary, textDecorationLine: 'line-through' },
  discountBanner: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  discountText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: AppColors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  secondaryAction: { backgroundColor: '#334155' },
  dangerAction: { backgroundColor: '#EF4444' },
  actionText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  empty: { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyText: { color: AppColors.textSecondary },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: AppColors.background,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: AppColors.textPrimary },
  label: { color: AppColors.textSecondary, fontSize: 12, marginBottom: 6, marginTop: 8 },
  input: {
    backgroundColor: AppColors.surface,
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: AppColors.textPrimary,
  },
  saveBtn: {
    marginTop: 16,
    backgroundColor: AppColors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnText: { color: '#FFF', fontWeight: '700' },
});
