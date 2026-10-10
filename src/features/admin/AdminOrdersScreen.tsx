import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppColors } from '../../theme/colors';
import { apiClient } from '../../services/apiClient';
import { AdminFoodOrder, AdminRide } from './types';

interface AdminOrdersScreenProps {
  navigation: any;
}

type OrderType = 'FOOD' | 'RIDES';

export const AdminOrdersScreen: React.FC<AdminOrdersScreenProps> = ({ navigation }) => {
  const [orderType, setOrderType] = useState<OrderType>('FOOD');
  const [foodOrders, setFoodOrders] = useState<AdminFoodOrder[]>([]);
  const [rides, setRides] = useState<AdminRide[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const fetchOrders = useCallback(async () => {
    try {
      if (orderType === 'FOOD') {
        const res = await apiClient.get<any>('/api/admin/food-orders', {
          params: { search: search.trim() || undefined },
        });
        const payload = res.data?.data || res.data || [];
        setFoodOrders(payload);
      } else {
        const res = await apiClient.get<any>('/api/admin/rides', {
          params: { search: search.trim() || undefined },
        });
        const payload = res.data?.data || res.data || [];
        setRides(payload);
      }
    } catch (err: any) {
      console.warn('[AdminOrdersScreen] Error fetching orders:', err.message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [orderType, search]);

  useEffect(() => {
    setIsLoading(true);
    const delay = setTimeout(() => {
      fetchOrders();
    }, 250);
    return () => clearTimeout(delay);
  }, [fetchOrders]);

  const getStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'DELIVERED':
      case 'COMPLETED':
        return AppColors.secondary;
      case 'CANCELLED':
      case 'REJECTED':
        return AppColors.red;
      case 'PENDING':
      case 'SEARCHING':
        return AppColors.yellow;
      case 'ACCEPTED':
      case 'PREPARING':
      case 'IN_TRANSIT':
      case 'ON_GOING':
        return AppColors.primary;
      default:
        return AppColors.blue;
    }
  };

  const renderFoodOrderCard = ({ item }: { item: AdminFoodOrder }) => {
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.headerLeft}>
            <Text style={styles.orderNumber}>Order #{item.orderNumber}</Text>
            <Text style={styles.restaurantName}>
              <Ionicons name="restaurant-outline" size={12} color={AppColors.yellow} />{' '}
              {item.restaurantName}
            </Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.priceHighlight}>₹{item.grandTotal}</Text>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: getStatusColor(item.status) + '20' },
              ]}
            >
              <Text
                style={[
                  styles.statusBadgeText,
                  { color: getStatusColor(item.status) },
                ]}
              >
                {item.status}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.customerBox}>
          <Text style={styles.customerText}>
            Customer: {item.customerName} ({item.customerPhone})
          </Text>
          <Text style={styles.metaText}>
            {item.itemsCount} items • Paid via {item.paymentMethod} ({item.paymentStatus})
          </Text>
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.timeText}>
            {new Date(item.createdAt).toLocaleString([], {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
      </View>
    );
  };

  const renderRideCard = ({ item }: { item: AdminRide }) => {
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.headerLeft}>
            <Text style={styles.orderNumber}>{item.vehicleType} • {item.rideNumber}</Text>
            <Text style={styles.restaurantName}>
              <Ionicons name="person-outline" size={12} color={AppColors.primary} />{' '}
              {item.customerName} ({item.customerPhone})
            </Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.priceHighlight}>₹{item.actualFare || item.estimatedFare}</Text>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: getStatusColor(item.status) + '20' },
              ]}
            >
              <Text
                style={[
                  styles.statusBadgeText,
                  { color: getStatusColor(item.status) },
                ]}
              >
                {item.status}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.routeBox}>
          <Text style={styles.routeLine} numberOfLines={1}>
            <Ionicons name="radio-button-on" size={12} color={AppColors.secondary} /> From: {item.pickupAddress}
          </Text>
          <Text style={styles.routeLine} numberOfLines={1}>
            <Ionicons name="location" size={12} color={AppColors.red} /> To: {item.dropoffAddress}
          </Text>
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.driverText}>
            Driver: {item.driverName ? `${item.driverName} (${item.driverPhone})` : 'Searching'}
          </Text>
          <Text style={styles.timeText}>{item.distanceKm} km</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Live Activity & Orders</Text>
        <View style={{ width: 38 }} />
      </View>

      {/* Segmented Switch */}
      <View style={styles.segmentContainer}>
        <TouchableOpacity
          style={[styles.segmentBtn, orderType === 'FOOD' && styles.segmentBtnActive]}
          onPress={() => setOrderType('FOOD')}
        >
          <Ionicons
            name="fast-food-outline"
            size={16}
            color={orderType === 'FOOD' ? '#FFFFFF' : AppColors.textSecondary}
          />
          <Text style={[styles.segmentText, orderType === 'FOOD' && styles.segmentTextActive]}>
            Food Orders
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.segmentBtn, orderType === 'RIDES' && styles.segmentBtnActive]}
          onPress={() => setOrderType('RIDES')}
        >
          <Ionicons
            name="car-outline"
            size={16}
            color={orderType === 'RIDES' ? '#FFFFFF' : AppColors.textSecondary}
          />
          <Text style={[styles.segmentText, orderType === 'RIDES' && styles.segmentTextActive]}>
            Ride Bookings
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={AppColors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder={`Search ${orderType === 'FOOD' ? 'food orders' : 'rides'}...`}
            placeholderTextColor={AppColors.textSecondary}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color={AppColors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Orders List */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={AppColors.primary} />
          <Text style={styles.loadingText}>Loading {orderType.toLowerCase()} records...</Text>
        </View>
      ) : orderType === 'FOOD' ? (
        <FlatList
          data={foodOrders}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderFoodOrderCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => {
                setIsRefreshing(true);
                fetchOrders();
              }}
              tintColor={AppColors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="receipt-outline" size={48} color={AppColors.border} />
              <Text style={styles.emptyTitle}>No Food Orders</Text>
              <Text style={styles.emptySubtitle}>No matching food orders found in system</Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={rides}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderRideCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => {
                setIsRefreshing(true);
                fetchOrders();
              }}
              tintColor={AppColors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="car-outline" size={48} color={AppColors.border} />
              <Text style={styles.emptyTitle}>No Rides Found</Text>
              <Text style={styles.emptySubtitle}>No matching ride bookings found in system</Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: AppColors.border,
    backgroundColor: AppColors.surface,
  },
  backBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: AppColors.surfaceLight,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: AppColors.textPrimary,
  },
  segmentContainer: {
    flexDirection: 'row',
    padding: 14,
    gap: 10,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: AppColors.surface,
    borderWidth: 1,
    borderColor: AppColors.border,
    gap: 8,
  },
  segmentBtnActive: {
    backgroundColor: AppColors.primary,
    borderColor: AppColors.primary,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '700',
    color: AppColors.textSecondary,
  },
  segmentTextActive: {
    color: '#FFFFFF',
  },
  searchContainer: {
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: AppColors.border,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    color: AppColors.textPrimary,
  },
  listContent: {
    padding: 14,
    gap: 12,
  },
  card: {
    backgroundColor: AppColors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  headerLeft: {
    flex: 1,
  },
  orderNumber: {
    fontSize: 15,
    fontWeight: '700',
    color: AppColors.textPrimary,
  },
  restaurantName: {
    fontSize: 12,
    color: AppColors.textSecondary,
    marginTop: 2,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  priceHighlight: {
    fontSize: 16,
    fontWeight: '800',
    color: AppColors.textPrimary,
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  customerBox: {
    backgroundColor: AppColors.surfaceLight,
    padding: 8,
    borderRadius: 8,
    marginBottom: 10,
  },
  customerText: {
    fontSize: 12,
    color: AppColors.textPrimary,
    fontWeight: '600',
  },
  metaText: {
    fontSize: 11,
    color: AppColors.textSecondary,
    marginTop: 2,
  },
  routeBox: {
    backgroundColor: AppColors.surfaceLight,
    padding: 8,
    borderRadius: 8,
    marginBottom: 10,
    gap: 4,
  },
  routeLine: {
    fontSize: 12,
    color: AppColors.textPrimary,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: AppColors.border,
    paddingTop: 8,
  },
  driverText: {
    fontSize: 12,
    color: AppColors.textSecondary,
  },
  timeText: {
    fontSize: 11,
    color: AppColors.textSecondary,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: AppColors.textSecondary,
    fontSize: 13,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: AppColors.textPrimary,
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: AppColors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
});
