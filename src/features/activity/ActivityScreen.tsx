import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../navigation/types';
import { StatusBadge } from '../../components/common/StatusBadge';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';
import { apiClient } from '../../services/apiClient';
import { ApiEndpoints } from '../../constants/api';

const TABS = ['Food Orders', 'Rides', 'Marketplace'];

export const ActivityScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'Activity'>>();
  const initialTab = route.params?.initialTab ?? 0;
  const [activeTab, setActiveTab] = useState(initialTab);

  const [foodOrders, setFoodOrders] = useState<any[]>([]);
  const [ridesList, setRidesList] = useState<any[]>([]);
  const [listings, setListings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    setIsLoading(true);
    // Fetch user food orders
    const fetchOrders = apiClient
      .get<any>(ApiEndpoints.food.orders)
      .then((res) => {
        const data = res.data?.data || res.data;
        if (Array.isArray(data)) {
          const mapped = data.map((o: any) => ({
            id: `#${o.orderNumber || `FO-${o.id}`}`,
            rawId: o.id,
            orderNumber: o.orderNumber,
            restaurant: o.restaurantName || 'Restaurant',
            items: o.items?.map((i: any) => `${i.quantity}x ${i.itemName}`).join(', ') || 'Items ordered',
            total: `₹${o.grandTotal || 0}`,
            status: String(o.status || 'PENDING').toUpperCase(),
            date: o.createdAt ? new Date(o.createdAt).toLocaleDateString() : 'Recent',
          }));
          setFoodOrders(mapped);
        } else {
          setFoodOrders([]);
        }
      })
      .catch(() => {
        setFoodOrders([]);
      });

    // Fetch user rides history
    const fetchRides = apiClient
      .get<any>(ApiEndpoints.ride.myRides)
      .then((res) => {
        const data = res.data?.data || res.data;
        if (Array.isArray(data)) {
          const mapped = data.map((r: any) => ({
            id: `#${r.rideNumber || `RD-${r.id}`}`,
            rawId: r.id,
            vehicle: `${r.vehicleType || 'Ride'} (${r.driver?.registrationNumber || 'Standard'})`,
            route: `${r.pickupAddress || 'Pickup'} ➔ ${r.dropoffAddress || 'Dropoff'}`,
            distance: `${r.distanceKm || 0} km`,
            fare: `₹${r.actualFare || r.estimatedFare || 0}`,
            status: String(r.status || 'PENDING').toUpperCase(),
            date: r.createdAt ? new Date(r.createdAt).toLocaleDateString() : 'Recent',
          }));
          setRidesList(mapped);
        } else {
          setRidesList([]);
        }
      })
      .catch(() => {
        setRidesList([]);
      });

    // Fetch user marketplace listings
    const fetchListings = apiClient
      .get<any>(ApiEndpoints.marketplace.myListings)
      .then((res) => {
        const data = res.data?.data || res.data;
        if (Array.isArray(data)) {
          const mapped = data.map((l: any) => ({
            id: String(l.id),
            title: l.title,
            price: `₹${l.price}`,
            views: `${l.viewCount || 0} views`,
            status: String(l.status || 'ACTIVE').toUpperCase(),
            date: l.createdAt ? new Date(l.createdAt).toLocaleDateString() : 'Recent',
          }));
          setListings(mapped);
        } else {
          setListings([]);
        }
      })
      .catch(() => {
        setListings([]);
      });

    Promise.allSettled([fetchOrders, fetchRides, fetchListings]).finally(() => {
      setIsLoading(false);
    });
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <MaterialIcons name="chevron-left" size={28} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Activity</Text>
        <View style={{ width: 28 }} />
      </View>

      {/* Tab Switcher */}
      <View style={styles.tabBar}>
        {TABS.map((tab, idx) => {
          const isActive = idx === activeTab;
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.tabButton, isActive && styles.tabButtonActive]}
              onPress={() => setActiveTab(idx)}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {tab}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Tab Content */}
      <View style={styles.tabContentContainer}>
        {activeTab === 0 && (
          <FlatList
            data={foodOrders}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              !isLoading ? (
                <View style={styles.emptyContainer}>
                  <MaterialIcons name="fastfood" size={56} color={colors.textTertiary} />
                  <Text style={styles.emptyTitle}>No Food Orders Yet</Text>
                  <Text style={styles.emptySubtitle}>
                    Craving something tasty? Explore verified restaurants and place your order!
                  </Text>
                  <TouchableOpacity
                    style={styles.emptyButton}
                    onPress={() => (navigation as any).navigate('MainTabs', { screen: 'Food' })}
                  >
                    <Text style={styles.emptyButtonText}>Order Food Now</Text>
                  </TouchableOpacity>
                </View>
              ) : null
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.card}
                activeOpacity={0.8}
                onPress={() => {
                  (navigation as any).navigate('FoodOrderTracking', {
                    orderId: item.orderNumber || item.id.replace('#', ''),
                    orderNumericId: item.rawId,
                  });
                }}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{item.restaurant}</Text>
                  <StatusBadge status={item.status} />
                </View>
                <Text style={styles.cardSubtitle}>{item.items}</Text>
                <View style={styles.cardFooter}>
                  <Text style={styles.cardDate}>{item.date}</Text>
                  <Text style={styles.cardAmount}>{item.total}</Text>
                </View>
                <View style={styles.cardActionRow}>
                  <Text style={styles.cardActionText}>Live Tracking & Restaurant Phone →</Text>
                </View>
              </TouchableOpacity>
            )}
          />
        )}

        {activeTab === 1 && (
          <FlatList
            data={ridesList}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              !isLoading ? (
                <View style={styles.emptyContainer}>
                  <MaterialIcons name="directions-car" size={56} color={colors.textTertiary} />
                  <Text style={styles.emptyTitle}>No Rides Yet</Text>
                  <Text style={styles.emptySubtitle}>
                    Need to go somewhere? Book bike, auto, or cab with instant OTP security!
                  </Text>
                  <TouchableOpacity
                    style={styles.emptyButton}
                    onPress={() => (navigation as any).navigate('MainTabs', { screen: 'Rides' })}
                  >
                    <Text style={styles.emptyButtonText}>Book a Ride</Text>
                  </TouchableOpacity>
                </View>
              ) : null
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.card}
                activeOpacity={0.8}
                onPress={() => {
                  (navigation as any).navigate('ActiveRide', {
                    rideId: item.id.replace('#', ''),
                    rideNumericId: item.rawId,
                  });
                }}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{item.vehicle}</Text>
                  <StatusBadge status={item.status} />
                </View>
                <Text style={styles.cardSubtitle}>{item.route}</Text>
                <Text style={styles.cardDistance}>{item.distance}</Text>
                <View style={styles.cardFooter}>
                  <Text style={styles.cardDate}>{item.date}</Text>
                  <Text style={styles.cardAmount}>{item.fare}</Text>
                </View>
              </TouchableOpacity>
            )}
          />
        )}

        {activeTab === 2 && (
          <FlatList
            data={listings}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              !isLoading ? (
                <View style={styles.emptyContainer}>
                  <MaterialIcons name="storefront" size={56} color={colors.textTertiary} />
                  <Text style={styles.emptyTitle}>No Listings Yet</Text>
                  <Text style={styles.emptySubtitle}>
                    Sell your unused electronics, gadgets, and essentials to nearby buyers!
                  </Text>
                  <TouchableOpacity
                    style={styles.emptyButton}
                    onPress={() => (navigation as any).navigate('MainTabs', { screen: 'Bazaar' })}
                  >
                    <Text style={styles.emptyButtonText}>Sell in Bazaar</Text>
                  </TouchableOpacity>
                </View>
              ) : null
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.card}
                activeOpacity={0.8}
                onPress={() => {
                  (navigation as any).navigate('ListingDetail', {
                    listingId: String(item.id),
                  });
                }}
              >
                <View style={styles.cardHeader}>
                  <Text numberOfLines={1} style={[styles.cardTitle, { flex: 1, marginRight: 8 }]}>
                    {item.title}
                  </Text>
                  <StatusBadge status={item.status} />
                </View>
                <Text style={styles.cardPrice}>{item.price}</Text>
                <View style={styles.cardFooter}>
                  <Text style={styles.cardDate}>{item.date}</Text>
                  <Text style={styles.cardViews}>{item.views}</Text>
                </View>
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textTertiary,
  },
  tabTextActive: {
    color: colors.primary,
  },
  tabContentContainer: {
    flex: 1,
  },
  listContent: {
    padding: spacing.md,
    gap: 12,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  cardSubtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 6,
  },
  cardDistance: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 4,
  },
  cardPrice: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.primary,
    marginTop: 8,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  cardDate: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  cardAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  cardViews: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  cardActionRow: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cardActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtitle: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyButton: {
    marginTop: 20,
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
