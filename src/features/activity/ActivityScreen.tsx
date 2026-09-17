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

  const initialFoodOrders = [
    {
      id: '#FO-1002',
      restaurant: 'Meghana Foods (Special Biryani)',
      items: '1x Meghana Special Chicken Biryani, 1x Boondi Raita',
      total: '₹375',
      status: 'DELIVERED',
      date: 'Today, 8:15 PM',
    },
    {
      id: '#FO-0984',
      restaurant: "Haldiram's Sweets & Thali",
      items: '2x Special Thali, 1x Gulab Jamun',
      total: '₹520',
      status: 'DELIVERED',
      date: 'Yesterday, 1:30 PM',
    },
  ];

  const rides = [
    {
      id: '#RD-5021',
      vehicle: 'Rapido Bike (DL 04 AB 9821)',
      route: 'Connaught Place ➔ Terminal 3, IGI Airport',
      distance: '16.4 km • ~34 mins',
      fare: '₹45',
      status: 'COMPLETED',
      date: 'Today, 6:45 PM',
    },
    {
      id: '#RD-4890',
      vehicle: 'Auto Rickshaw (DL 1R 4410)',
      route: 'Cyber City ➔ Sector 29 Market',
      distance: '4.2 km • ~12 mins',
      fare: '₹65',
      status: 'COMPLETED',
      date: '14 Sep 2026',
    },
  ];

  const initialListings = [
    {
      id: '1',
      title: 'iPhone 15 Pro Max 256GB - Natural Titanium',
      price: '₹94,000',
      views: '124 views',
      status: 'ACTIVE',
      date: 'Listed 2 hours ago',
    },
    {
      id: '2',
      title: 'MacBook Pro 14" M3 (16GB, 512GB)',
      price: '₹1,32,000',
      views: '310 views',
      status: 'SOLD',
      date: 'Listed 3 days ago',
    },
  ];

  const [foodOrders, setFoodOrders] = useState(initialFoodOrders);
  const [listings, setListings] = useState(initialListings);

  useEffect(() => {
    // Fetch user food orders
    apiClient
      .get<any>(ApiEndpoints.food.orders)
      .then((res) => {
        const data = res.data?.data || res.data;
        if (Array.isArray(data) && data.length > 0) {
          const mapped = data.map((o: any) => ({
            id: `#${o.orderNumber || `FO-${o.id}`}`,
            restaurant: o.restaurantName || 'Restaurant',
            items: o.items?.map((i: any) => `${i.quantity}x ${i.itemName}`).join(', ') || 'Items ordered',
            total: `₹${o.grandTotal || 0}`,
            status: String(o.status || 'PENDING').toUpperCase(),
            date: o.createdAt ? new Date(o.createdAt).toLocaleDateString() : 'Recent',
          }));
          setFoodOrders(mapped);
        }
      })
      .catch(() => {});

    // Fetch user marketplace listings
    apiClient
      .get<any>(ApiEndpoints.marketplace.myListings)
      .then((res) => {
        const data = res.data?.data || res.data;
        if (Array.isArray(data) && data.length > 0) {
          const mapped = data.map((l: any) => ({
            id: String(l.id),
            title: l.title,
            price: `₹${l.price}`,
            views: `${l.viewCount || 0} views`,
            status: String(l.status || 'ACTIVE').toUpperCase(),
            date: l.createdAt ? new Date(l.createdAt).toLocaleDateString() : 'Recent',
          }));
          setListings(mapped);
        }
      })
      .catch(() => {});
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
            renderItem={({ item }) => (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{item.restaurant}</Text>
                  <StatusBadge status={item.status} />
                </View>
                <Text style={styles.cardSubtitle}>{item.items}</Text>
                <View style={styles.cardFooter}>
                  <Text style={styles.cardDate}>{item.date}</Text>
                  <Text style={styles.cardAmount}>{item.total}</Text>
                </View>
              </View>
            )}
          />
        )}

        {activeTab === 1 && (
          <FlatList
            data={rides}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <View style={styles.card}>
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
              </View>
            )}
          />
        )}

        {activeTab === 2 && (
          <FlatList
            data={listings}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <View style={styles.card}>
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
              </View>
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
});
