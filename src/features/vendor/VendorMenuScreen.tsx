import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  ActivityIndicator,
  Alert,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Modal,
  Image,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { vendorService } from '../../services/vendorService';
import { documentService, absoluteImageUrl } from '../../services/documentService';
import { ScreenBackButton } from '../../components/common/ScreenBackButton';
import { FormKeyboardAvoid } from '../../components/common/FormKeyboardAvoid';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

type FoodForm = {
  id?: number;
  name: string;
  description: string;
  basePrice: string;
  discountPercent: string;
  restaurantCategoryId: number | null;
  isVeg: boolean;
  isAvailable: boolean;
  imageUrl: string | null;
};

const emptyForm = (): FoodForm => ({
  name: '',
  description: '',
  basePrice: '',
  discountPercent: '0',
  restaurantCategoryId: null,
  isVeg: true,
  isAvailable: true,
  imageUrl: null,
});

function discountedPrice(base: number, discount: number): number {
  const d = Math.min(100, Math.max(0, discount));
  return Math.round(base * (1 - d / 100) * 100) / 100;
}

export const VendorMenuScreen: React.FC = () => {
  const [categories, setCategories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [togglingItemId, setTogglingItemId] = useState<number | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState<FoodForm>(emptyForm());
  const [categoryModal, setCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);

  const loadMenu = useCallback(async () => {
    try {
      const data = await vendorService.getMenu();
      setCategories(Array.isArray(data) ? data : []);
    } catch (e: any) {
      console.warn('[VendorMenu] Error loading menu:', e.message);
      Alert.alert('Menu', e.message || 'Could not load menu');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadMenu();
  }, [loadMenu]);

  const previewDiscount = useMemo(() => {
    const base = parseFloat(form.basePrice);
    const disc = parseFloat(form.discountPercent || '0');
    if (!Number.isFinite(base) || base < 0) return null;
    if (!Number.isFinite(disc) || disc <= 0) return null;
    return discountedPrice(base, disc);
  }, [form.basePrice, form.discountPercent]);

  const openAdd = () => {
    const firstCat = categories[0]?.id ?? null;
    setForm({ ...emptyForm(), restaurantCategoryId: firstCat });
    setModalVisible(true);
  };

  const openEdit = (item: any, categoryId: number) => {
    setForm({
      id: item.id,
      name: item.name || '',
      description: item.description || '',
      basePrice: String(item.basePrice ?? ''),
      discountPercent: String(item.discountPercent ?? 0),
      restaurantCategoryId: item.restaurantCategoryId || categoryId,
      isVeg: !!item.isVeg,
      isAvailable: item.isAvailable !== false,
      imageUrl: item.imageUrl || null,
    });
    setModalVisible(true);
  };

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission', 'Allow photo access to upload food images.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    setUploading(true);
    try {
      const uploaded = await documentService.upload(result.assets[0].uri, 'food-item.jpg');
      setForm((f) => ({ ...f, imageUrl: uploaded.imageUrl }));
    } catch (e: any) {
      Alert.alert('Upload failed', e?.message || 'Could not upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleSaveItem = async () => {
    const name = form.name.trim();
    const base = parseFloat(form.basePrice);
    const disc = parseFloat(form.discountPercent || '0');
    if (!name) {
      Alert.alert('Validation', 'Food name is required');
      return;
    }
    if (!Number.isFinite(base) || base < 0) {
      Alert.alert('Validation', 'Enter a valid price (>= 0)');
      return;
    }
    if (!Number.isFinite(disc) || disc < 0 || disc > 100) {
      Alert.alert('Validation', 'Discount must be between 0 and 100%');
      return;
    }
    if (!form.restaurantCategoryId) {
      Alert.alert('Validation', 'Create or select a category first');
      return;
    }

    setSaving(true);
    try {
      if (form.id) {
        await vendorService.manageFoodItem('EDIT', {
          id: form.id,
          name,
          description: form.description.trim(),
          basePrice: base,
          discountPercent: disc,
          restaurantCategoryId: form.restaurantCategoryId,
          isVeg: form.isVeg,
          isAvailable: form.isAvailable,
          imageUrl: form.imageUrl,
        });
      } else {
        await vendorService.manageFoodItem('ADD', {
          name,
          description: form.description.trim(),
          basePrice: base,
          discountPercent: disc,
          restaurantCategoryId: form.restaurantCategoryId,
          isVeg: form.isVeg,
          isAvailable: form.isAvailable,
          imageUrl: form.imageUrl,
        });
      }
      setModalVisible(false);
      await loadMenu();
    } catch (e: any) {
      Alert.alert('Save failed', e?.message || 'Could not save food item');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (item: any) => {
    Alert.alert('Delete item?', `${item.name} will be removed from your menu.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await vendorService.manageFoodItem('DELETE', { id: item.id });
            await loadMenu();
          } catch (e: any) {
            Alert.alert('Delete failed', e?.message || 'Could not delete item');
          }
        },
      },
    ]);
  };

  const handleToggleAvailability = async (item: any) => {
    const nextAvailable = !item.isAvailable;
    setTogglingItemId(item.id);
    try {
      await vendorService.manageFoodItem('STATUS', { id: item.id, isAvailable: nextAvailable });
      setCategories((prev) =>
        prev.map((cat) => ({
          ...cat,
          items: (cat.items || []).map((i: any) =>
            i.id === item.id ? { ...i, isAvailable: nextAvailable } : i
          ),
        }))
      );
    } catch (e: any) {
      Alert.alert('Update Failed', e.message || 'Could not update availability');
    } finally {
      setTogglingItemId(null);
    }
  };

  const handleAddCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) {
      Alert.alert('Validation', 'Category name is required');
      return;
    }
    setSavingCategory(true);
    try {
      await vendorService.manageCategory('ADD', { name });
      setNewCategoryName('');
      setCategoryModal(false);
      await loadMenu();
    } catch (e: any) {
      Alert.alert('Failed', e?.message || 'Could not create category');
    } finally {
      setSavingCategory(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.header, { paddingHorizontal: spacing.md, paddingTop: spacing.sm }]}>
          <View style={styles.headerTop}>
            <ScreenBackButton accessibilityLabel="Back" />
            <Text style={styles.title}>Menu Manager</Text>
          </View>
        </View>
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#F59E0B" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => {
              setIsRefreshing(true);
              loadMenu();
            }}
            tintColor="#F59E0B"
          />
        }
      >
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <ScreenBackButton accessibilityLabel="Back" />
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Menu Manager</Text>
              <Text style={styles.subtitle}>Add dishes, set discount, edit or remove anytime</Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => setCategoryModal(true)}>
              <Ionicons name="folder-outline" size={16} color="#FFF" />
              <Text style={styles.secondaryBtnText}>Category</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryBtn} onPress={openAdd}>
              <Ionicons name="add" size={18} color="#FFF" />
              <Text style={styles.primaryBtnText}>Add Food</Text>
            </TouchableOpacity>
          </View>
        </View>

        {categories.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="restaurant-outline" size={48} color={colors.textTertiary} />
            <Text style={styles.emptyTitle}>No menu yet</Text>
            <Text style={styles.emptySubtitle}>Create a category, then tap Add Food.</Text>
            <TouchableOpacity style={[styles.primaryBtn, { marginTop: 16 }]} onPress={() => setCategoryModal(true)}>
              <Text style={styles.primaryBtnText}>Create Category</Text>
            </TouchableOpacity>
          </View>
        ) : (
          categories.map((cat) => (
            <View key={cat.id} style={styles.categorySection}>
              <View style={styles.categoryHeader}>
                <Text style={styles.categoryName}>{cat.name}</Text>
                <Text style={styles.itemCountText}>{cat.items?.length || 0} items</Text>
              </View>

              {(cat.items || []).length === 0 ? (
                <Text style={styles.emptyCat}>No items in this category</Text>
              ) : (
                (cat.items || []).map((item: any) => {
                  const disc = Number(item.discountPercent || 0);
                  const base = Number(item.basePrice || 0);
                  const sale =
                    item.discountedPrice != null
                      ? Number(item.discountedPrice)
                      : discountedPrice(base, disc);
                  const isToggling = togglingItemId === item.id;
                  return (
                    <View key={item.id} style={styles.dishCard}>
                      {item.imageUrl ? (
                        <Image source={{ uri: absoluteImageUrl(item.imageUrl) }} style={styles.thumb} />
                      ) : (
                        <View style={[styles.thumb, styles.thumbPlaceholder]}>
                          <Ionicons name="fast-food-outline" size={20} color={colors.textTertiary} />
                        </View>
                      )}
                      <View style={styles.dishDetails}>
                        <View style={styles.dishNameRow}>
                          <View style={[styles.vegBadge, { borderColor: item.isVeg ? '#10B981' : '#EF4444' }]}>
                            <View style={[styles.vegDot, { backgroundColor: item.isVeg ? '#10B981' : '#EF4444' }]} />
                          </View>
                          <Text style={styles.dishName} numberOfLines={1}>
                            {item.name}
                          </Text>
                        </View>
                        {disc > 0 ? (
                          <View style={styles.priceRow}>
                            <View style={styles.discountBanner}>
                              <Text style={styles.discountBannerText}>{disc}% OFF</Text>
                            </View>
                            <Text style={styles.strike}>₹{base}</Text>
                            <Text style={styles.dishPrice}>₹{sale}</Text>
                          </View>
                        ) : (
                          <Text style={styles.dishPrice}>₹{base}</Text>
                        )}
                        <View style={styles.rowActions}>
                          <TouchableOpacity style={styles.miniBtn} onPress={() => openEdit(item, cat.id)}>
                            <Ionicons name="pencil" size={14} color="#FFF" />
                            <Text style={styles.miniBtnText}>Edit</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={[styles.miniBtn, styles.deleteBtn]} onPress={() => handleDelete(item)}>
                            <Ionicons name="trash-outline" size={14} color="#FFF" />
                            <Text style={styles.miniBtnText}>Delete</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                      <View style={styles.stockToggleBox}>
                        <Text style={[styles.stockLabel, { color: item.isAvailable ? '#10B981' : '#EF4444' }]}>
                          {item.isAvailable ? 'ON' : 'OFF'}
                        </Text>
                        {isToggling ? (
                          <ActivityIndicator size="small" color="#F59E0B" />
                        ) : (
                          <Switch
                            value={!!item.isAvailable}
                            onValueChange={() => handleToggleAvailability(item)}
                            trackColor={{ false: '#334155', true: '#10B98150' }}
                            thumbColor={item.isAvailable ? '#10B981' : '#EF4444'}
                          />
                        )}
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          ))
        )}
      </ScrollView>

      {/* Add / Edit Food Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <FormKeyboardAvoid>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{form.id ? 'Edit Food Item' : 'Add Food Item'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={22} color="#FFF" />
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 }}>
              <Text style={styles.label}>Name *</Text>
              <TextInput
                style={styles.input}
                value={form.name}
                onChangeText={(t) => setForm((f) => ({ ...f, name: t }))}
                placeholder="e.g. Paneer Butter Masala"
                placeholderTextColor="#777"
              />
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, { minHeight: 64 }]}
                value={form.description}
                onChangeText={(t) => setForm((f) => ({ ...f, description: t }))}
                multiline
                placeholder="Short description"
                placeholderTextColor="#777"
              />
              <Text style={styles.label}>Category *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                {categories.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.chip, form.restaurantCategoryId === c.id && styles.chipActive]}
                    onPress={() => setForm((f) => ({ ...f, restaurantCategoryId: c.id }))}
                  >
                    <Text style={[styles.chipText, form.restaurantCategoryId === c.id && styles.chipTextActive]}>
                      {c.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Price (₹) *</Text>
                  <TextInput
                    style={styles.input}
                    value={form.basePrice}
                    onChangeText={(t) => setForm((f) => ({ ...f, basePrice: t }))}
                    keyboardType="decimal-pad"
                    placeholder="120"
                    placeholderTextColor="#777"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Discount %</Text>
                  <TextInput
                    style={styles.input}
                    value={form.discountPercent}
                    onChangeText={(t) => setForm((f) => ({ ...f, discountPercent: t }))}
                    keyboardType="decimal-pad"
                    placeholder="0–100"
                    placeholderTextColor="#777"
                  />
                </View>
              </View>
              {previewDiscount != null ? (
                <View style={styles.previewBanner}>
                  <Text style={styles.previewBannerText}>
                    {form.discountPercent}% OFF → Customer pays ₹{previewDiscount}
                  </Text>
                </View>
              ) : null}
              <View style={styles.switchRow}>
                <Text style={styles.labelInline}>Veg</Text>
                <Switch
                  value={form.isVeg}
                  onValueChange={(v) => setForm((f) => ({ ...f, isVeg: v }))}
                  trackColor={{ false: '#334155', true: '#10B98150' }}
                  thumbColor={form.isVeg ? '#10B981' : '#94A3B8'}
                />
                <Text style={[styles.labelInline, { marginLeft: 16 }]}>Available</Text>
                <Switch
                  value={form.isAvailable}
                  onValueChange={(v) => setForm((f) => ({ ...f, isAvailable: v }))}
                  trackColor={{ false: '#334155', true: '#10B98150' }}
                  thumbColor={form.isAvailable ? '#10B981' : '#EF4444'}
                />
              </View>
              <TouchableOpacity style={styles.uploadBtn} onPress={pickImage} disabled={uploading}>
                {uploading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="image-outline" size={18} color="#FFF" />
                    <Text style={styles.uploadText}>{form.imageUrl ? 'Change image' : 'Add image'}</Text>
                  </>
                )}
              </TouchableOpacity>
              {form.imageUrl ? (
                <Image source={{ uri: absoluteImageUrl(form.imageUrl) }} style={styles.previewImage} />
              ) : null}
              <TouchableOpacity
                style={[styles.saveBtn, (saving || uploading) && { opacity: 0.7 }]}
                onPress={handleSaveItem}
                disabled={saving || uploading}
              >
                {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>Save Item</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
        </FormKeyboardAvoid>
      </Modal>

      {/* Category Modal */}
      <Modal visible={categoryModal} transparent animationType="fade" onRequestClose={() => setCategoryModal(false)}>
        <FormKeyboardAvoid>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: 280 }]}>
            <Text style={styles.modalTitle}>New Category</Text>
            <TextInput
              style={styles.input}
              value={newCategoryName}
              onChangeText={setNewCategoryName}
              placeholder="e.g. Starters, Main Course"
              placeholderTextColor="#777"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setCategoryModal(false)}>
                <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryBtn} onPress={handleAddCategory} disabled={savingCategory}>
                {savingCategory ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.primaryBtnText}>Create</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
        </FormKeyboardAvoid>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { padding: spacing.md, paddingBottom: spacing.xxl },
  header: { marginBottom: spacing.md },
  headerTop: { flexDirection: 'row', alignItems: 'center' },
  title: { ...typography.h2, color: colors.textPrimary },
  subtitle: { ...typography.bodySm, color: colors.textSecondary, marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F59E0B',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  primaryBtnText: { color: '#FFF', fontWeight: '800' },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  secondaryBtnText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  categorySection: { marginBottom: spacing.lg },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
    paddingBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  categoryName: { ...typography.h3, color: colors.textPrimary },
  itemCountText: { ...typography.caption, color: colors.textTertiary },
  emptyCat: { color: colors.textSecondary, fontSize: 12, marginBottom: 8 },
  dishCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  thumb: { width: 56, height: 56, borderRadius: 10 },
  thumbPlaceholder: { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  dishDetails: { flex: 1 },
  dishNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  vegBadge: {
    width: 14,
    height: 14,
    borderRadius: 3,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vegDot: { width: 6, height: 6, borderRadius: 3 },
  dishName: { ...typography.h4, color: colors.textPrimary, flex: 1 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  dishPrice: { fontSize: 15, fontWeight: '800', color: '#10B981', marginTop: 4 },
  strike: { fontSize: 12, color: colors.textTertiary, textDecorationLine: 'line-through', marginTop: 4 },
  discountBanner: {
    backgroundColor: '#EF444420',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  discountBannerText: { color: '#EF4444', fontSize: 10, fontWeight: '800' },
  rowActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  miniBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#3B82F6',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  deleteBtn: { backgroundColor: '#EF4444' },
  miniBtnText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  stockToggleBox: { alignItems: 'center' },
  stockLabel: { fontSize: 10, fontWeight: '800', marginBottom: 2 },
  emptyBox: { alignItems: 'center', paddingVertical: spacing.xxl },
  emptyTitle: { ...typography.h4, color: colors.textPrimary, marginTop: spacing.md },
  emptySubtitle: { ...typography.caption, color: colors.textSecondary, textAlign: 'center', marginTop: 4 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
    maxHeight: '92%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  modalTitle: { color: '#FFF', fontSize: 17, fontWeight: '800' },
  label: { color: colors.textSecondary, fontSize: 12, fontWeight: '600', marginTop: 10, marginBottom: 4 },
  labelInline: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    color: '#FFF',
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 14,
  },
  row: { flexDirection: 'row', gap: 10 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
    backgroundColor: colors.background,
  },
  chipActive: { borderColor: '#F59E0B', backgroundColor: '#F59E0B30' },
  chipText: { color: colors.textSecondary, fontWeight: '700', fontSize: 12 },
  chipTextActive: { color: '#F59E0B' },
  previewBanner: {
    marginTop: 10,
    backgroundColor: '#10B98120',
    padding: 10,
    borderRadius: 8,
  },
  previewBannerText: { color: '#10B981', fontWeight: '800', fontSize: 13 },
  switchRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14, gap: 8 },
  uploadBtn: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#334155',
    paddingVertical: 12,
    borderRadius: 10,
  },
  uploadText: { color: '#FFF', fontWeight: '700' },
  previewImage: { width: '100%', height: 140, borderRadius: 10, marginTop: 10 },
  saveBtn: {
    marginTop: 18,
    backgroundColor: '#F59E0B',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveBtnText: { color: '#FFF', fontWeight: '800', fontSize: 15 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 16, marginTop: 16 },
});
