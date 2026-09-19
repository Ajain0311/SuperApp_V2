import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { vendorService } from '../../services/vendorService';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

export const VendorMenuScreen: React.FC = () => {
  const [categories, setCategories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [togglingItemId, setTogglingItemId] = useState<number | null>(null);

  const loadMenu = useCallback(async () => {
    try {
      const data = await vendorService.getMenu();
      setCategories(data);
    } catch (e: any) {
      console.warn('[VendorMenu] Error loading menu:', e.message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadMenu();
  }, [loadMenu]);

  const handleToggleAvailability = async (item: any) => {
    const nextAvailable = !item.isAvailable;
    setTogglingItemId(item.id);

    try {
      await vendorService.manageFoodItem('STATUS', {
        id: item.id,
        isAvailable: nextAvailable,
      });

      setCategories((prev) =>
        prev.map((cat) => ({
          ...cat,
          items: cat.items.map((i: any) =>
            i.id === item.id ? { ...i, isAvailable: nextAvailable } : i
          ),
        }))
      );
    } catch (e: any) {
      Alert.alert('Update Failed', e.message || 'Could not update item stock availability');
    } finally {
      setTogglingItemId(null);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.centerBox}>
        <ActivityIndicator size="large" color="#F59E0B" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => { setIsRefreshing(true); loadMenu(); }} tintColor="#F59E0B" />}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Menu & Stock</Text>
          <Text style={styles.subtitle}>Toggle out-of-stock items in real time</Text>
        </View>

        {categories.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="restaurant-outline" size={48} color={colors.textTertiary} />
            <Text style={styles.emptyTitle}>No Menu Categories</Text>
            <Text style={styles.emptySubtitle}>Menu items will appear here once loaded.</Text>
          </View>
        ) : (
          categories.map((cat) => (
            <View key={cat.id} style={styles.categorySection}>
              <View style={styles.categoryHeader}>
                <Text style={styles.categoryName}>{cat.name}</Text>
                <Text style={styles.itemCountText}>{cat.items?.length || 0} items</Text>
              </View>

              {cat.items?.map((item: any) => {
                const isToggling = togglingItemId === item.id;

                return (
                  <View key={item.id} style={styles.dishCard}>
                    <View style={styles.dishDetails}>
                      <View style={styles.dishNameRow}>
                        <View style={[styles.vegBadge, { borderColor: item.isVeg ? '#10B981' : '#EF4444' }]}>
                          <View style={[styles.vegDot, { backgroundColor: item.isVeg ? '#10B981' : '#EF4444' }]} />
                        </View>
                        <Text style={styles.dishName}>{item.name}</Text>
                      </View>
                      <Text style={styles.dishPrice}>₹{item.basePrice}</Text>
                    </View>

                    <View style={styles.stockToggleBox}>
                      <Text style={[styles.stockLabel, { color: item.isAvailable ? '#10B981' : '#EF4444' }]}>
                        {item.isAvailable ? 'IN STOCK' : 'OUT'}
                      </Text>
                      {isToggling ? (
                        <ActivityIndicator size="small" color="#F59E0B" />
                      ) : (
                        <Switch
                          value={item.isAvailable}
                          onValueChange={() => handleToggleAvailability(item)}
                          trackColor={{ false: '#334155', true: '#10B98150' }}
                          thumbColor={item.isAvailable ? '#10B981' : '#EF4444'}
                        />
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerBox: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  header: {
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.bodySm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  categorySection: {
    marginBottom: spacing.lg,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
    paddingBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  categoryName: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  itemCountText: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  dishCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dishDetails: {
    flex: 1,
    marginRight: spacing.md,
  },
  dishNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  vegBadge: {
    width: 14,
    height: 14,
    borderRadius: 3,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vegDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dishName: {
    ...typography.h4,
    color: colors.textPrimary,
    flex: 1,
  },
  dishPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: '#10B981',
    marginTop: 4,
    marginLeft: 22,
  },
  stockToggleBox: {
    alignItems: 'center',
  },
  stockLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyTitle: {
    ...typography.h4,
    color: colors.textPrimary,
    marginTop: spacing.md,
  },
  emptySubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
});
