import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { vendorService, VendorOrderSummary } from '../../services/vendorService';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

export const VendorOrdersScreen: React.FC = () => {
  const [orders, setOrders] = useState<VendorOrderSummary[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'PREPARING' | 'READY' | 'DELIVERED' | 'CANCELLED'>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState<number | null>(null);

  const loadOrders = useCallback(async () => {
    try {
      const data = await vendorService.getOrders();
      setOrders(data);
    } catch (e: any) {
      console.warn('[VendorOrders] Error loading orders:', e.message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const handleUpdateStatus = async (orderId: number, nextStatus: string) => {
    setUpdatingOrderId(orderId);
    try {
      await vendorService.updateOrderStatus(orderId, nextStatus);
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: nextStatus } : o))
      );
    } catch (e: any) {
      Alert.alert('Update Failed', e.message || 'Could not update order status');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const filteredOrders = orders.filter((o) => {
    if (filter === 'ALL') return true;
    return o.status.toUpperCase() === filter;
  });

  const renderOrderItem = ({ item }: { item: VendorOrderSummary }) => {
    const status = item.status.toUpperCase();
    const isUpdating = updatingOrderId === item.id;

    return (
      <View style={styles.orderCard}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.orderNumber}>Order #{item.orderNumber}</Text>
            <Text style={styles.orderTime}>
              {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.grandTotal}>₹{item.grandTotal}</Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(status) + '20' }]}>
              <Text style={[styles.statusText, { color: getStatusColor(status) }]}>{status}</Text>
            </View>
          </View>
        </View>

        {/* Item List */}
        <View style={styles.itemList}>
          {item.items.map((it) => (
            <View key={it.id} style={styles.itemRow}>
              <Text style={styles.itemQuantity}>{it.quantity}x</Text>
              <Text style={styles.itemName} numberOfLines={1}>{it.itemName}</Text>
              <Text style={styles.itemPrice}>₹{it.totalPrice}</Text>
            </View>
          ))}
        </View>

        {/* Action Progression Buttons */}
        <View style={styles.actionRow}>
          {status === 'PENDING' && (
            <View style={{ flexDirection: 'row', gap: 10, flex: 1 }}>
              <TouchableOpacity
                style={[styles.statusBtn, { backgroundColor: '#F59E0B', flex: 1 }]}
                disabled={isUpdating}
                onPress={() => handleUpdateStatus(item.id, 'ACCEPTED')}
              >
                {isUpdating ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.btnText}>Accept Order</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.statusBtn, { backgroundColor: '#EF444420', borderWidth: 1, borderColor: '#EF4444', paddingHorizontal: 16 }]}
                disabled={isUpdating}
                onPress={() => {
                  Alert.alert('Reject Order', `Are you sure you want to reject order #${item.orderNumber}?`, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Reject', style: 'destructive', onPress: () => handleUpdateStatus(item.id, 'CANCELLED') },
                  ]);
                }}
              >
                <Text style={[styles.btnText, { color: '#EF4444' }]}>Reject</Text>
              </TouchableOpacity>
            </View>
          )}

          {status === 'ACCEPTED' && (
            <TouchableOpacity
              style={[styles.statusBtn, { backgroundColor: '#3B82F6' }]}
              disabled={isUpdating}
              onPress={() => handleUpdateStatus(item.id, 'PREPARING')}
            >
              {isUpdating ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.btnText}>Start Preparing</Text>}
            </TouchableOpacity>
          )}

          {status === 'PREPARING' && (
            <TouchableOpacity
              style={[styles.statusBtn, { backgroundColor: '#10B981' }]}
              disabled={isUpdating}
              onPress={() => handleUpdateStatus(item.id, 'READY')}
            >
              {isUpdating ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.btnText}>Mark Food Ready</Text>}
            </TouchableOpacity>
          )}

          {status === 'READY' && (
            <TouchableOpacity
              style={[styles.statusBtn, { backgroundColor: '#8B5CF6' }]}
              disabled={isUpdating}
              onPress={() => handleUpdateStatus(item.id, 'DELIVERED')}
            >
              {isUpdating ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.btnText}>Handed to Rider</Text>}
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  function getStatusColor(st: string) {
    switch (st) {
      case 'DELIVERED': return '#10B981';
      case 'READY': return '#8B5CF6';
      case 'PREPARING': return '#3B82F6';
      case 'ACCEPTED': return '#F59E0B';
      case 'CANCELLED': return '#EF4444';
      default: return '#94A3B8';
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.title}>Kitchen Orders</Text>
        <Text style={styles.subtitle}>Manage kitchen preparation & dispatch pipeline</Text>
      </View>

      {/* Status Filter Chips */}
      <View style={styles.filterScroll}>
        {(['ALL', 'PENDING', 'PREPARING', 'READY', 'DELIVERED', 'CANCELLED'] as const).map((chip) => (
          <TouchableOpacity
            key={chip}
            style={[styles.filterChip, filter === chip && styles.filterChipActive]}
            onPress={() => setFilter(chip)}
          >
            <Text style={[styles.filterChipText, filter === chip && styles.filterChipTextActive]}>
              {chip}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#F59E0B" />
        </View>
      ) : (
        <FlatList
          data={filteredOrders}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderOrderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => { setIsRefreshing(true); loadOrders(); }} tintColor="#F59E0B" />}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons name="fast-food-outline" size={48} color={colors.textTertiary} />
              <Text style={styles.emptyTitle}>No Orders in this Queue</Text>
              <Text style={styles.emptySubtitle}>Incoming food delivery orders will be displayed here.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
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
  filterScroll: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    marginVertical: spacing.sm,
    gap: spacing.xs,
  },
  filterChip: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: '#F59E0B',
    borderColor: '#F59E0B',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  filterChipTextActive: {
    color: '#000000',
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  orderCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  orderNumber: {
    ...typography.h4,
    color: colors.textPrimary,
  },
  orderTime: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: 2,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  grandTotal: {
    fontSize: 18,
    fontWeight: '800',
    color: '#10B981',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  itemList: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 12,
    padding: spacing.sm,
    marginVertical: spacing.sm,
    gap: 4,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemQuantity: {
    fontSize: 13,
    fontWeight: '800',
    color: '#F59E0B',
    width: 28,
  },
  itemName: {
    ...typography.bodySm,
    color: colors.textPrimary,
    flex: 1,
  },
  itemPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  actionRow: {
    marginTop: spacing.xs,
  },
  statusBtn: {
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    maxWidth: 240,
  },
});
