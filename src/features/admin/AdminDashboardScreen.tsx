import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  TextInput,
  Alert,
  RefreshControl,
  SafeAreaView,
  Platform,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { apiClient } from '../../services/apiClient';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';
import { useAuthStore } from '../../store/authStore';

type AdminTab = 'OVERVIEW' | 'ORDERS' | 'RIDES' | 'USERS' | 'BAZAAR' | 'CONFIG';

export const AdminDashboardScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('OVERVIEW');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const logout = useAuthStore((state) => state.logout);

  // Data states
  const [overview, setOverview] = useState<any>(null);
  const [foodOrders, setFoodOrders] = useState<any[]>([]);
  const [rides, setRides] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [listings, setListings] = useState<any[]>([]);
  const [settings, setSettings] = useState<any[]>([]);

  // Search & input states
  const [searchQuery, setSearchQuery] = useState('');
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [broadcastRole, setBroadcastRole] = useState('ALL');
  const [isSendingBroadcast, setIsSendingBroadcast] = useState(false);

  const loadData = useCallback(async () => {
    try {
      if (activeTab === 'OVERVIEW') {
        const res = await apiClient.get<any>('/api/admin/dashboard');
        setOverview(res.data?.data || res.data);
      } else if (activeTab === 'ORDERS') {
        const res = await apiClient.get<any>('/api/admin/food-orders');
        setFoodOrders(res.data?.data || res.data || []);
      } else if (activeTab === 'RIDES') {
        const res = await apiClient.get<any>('/api/admin/rides');
        setRides(res.data?.data || res.data || []);
      } else if (activeTab === 'USERS') {
        const res = await apiClient.get<any>('/api/admin/users');
        const data = res.data?.data || res.data;
        setUsers(data?.items || data || []);
      } else if (activeTab === 'BAZAAR') {
        const res = await apiClient.get<any>('/api/admin/marketplace/listings');
        setListings(res.data?.data || res.data || []);
      } else if (activeTab === 'CONFIG') {
        const res = await apiClient.get<any>('/api/admin/settings');
        setSettings(res.data?.data || res.data || []);
      }
    } catch (e: any) {
      console.warn('[AdminDashboard] Error loading tab data:', e.message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [activeTab]);

  useEffect(() => {
    setIsLoading(true);
    loadData();
  }, [loadData]);

  const handleToggleUserStatus = async (userId: number, currentActive: boolean) => {
    try {
      await apiClient.post('/api/admin/users', {
        action: 'STATUS',
        userId,
        isActive: !currentActive,
      });
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, isActive: !currentActive } : u))
      );
      Alert.alert('Success', `User #${userId} status updated`);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update user status');
    }
  };

  const handleListingAction = async (listingId: number, action: 'STATUS' | 'FEATURED' | 'DELETE', value?: any) => {
    try {
      await apiClient.post('/api/admin/marketplace/listings', {
        action,
        listingId,
        status: action === 'STATUS' ? value : undefined,
        isFeatured: action === 'FEATURED' ? value : undefined,
      });
      if (action === 'DELETE') {
        setListings((prev) => prev.filter((l) => l.id !== listingId));
      } else if (action === 'STATUS') {
        setListings((prev) => prev.map((l) => (l.id === listingId ? { ...l, status: value } : l)));
      } else if (action === 'FEATURED') {
        setListings((prev) => prev.map((l) => (l.id === listingId ? { ...l, isFeatured: value } : l)));
      }
      Alert.alert('Success', 'Listing updated successfully');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Action failed');
    }
  };

  const handleUpdateSetting = (key: string, currentValue: string) => {
    Alert.prompt
      ? Alert.prompt('Update Setting', `Enter new value for ${key}:`, [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Save',
            onPress: async (val?: string) => {
              if (val !== undefined) {
                try {
                  await apiClient.post('/api/admin/settings', { key, value: val });
                  setSettings((prev) =>
                    prev.map((s) => (s.key === key ? { ...s, value: val } : s))
                  );
                  Alert.alert('Saved', `Setting ${key} updated.`);
                } catch (err: any) {
                  Alert.alert('Error', err.message || 'Could not update setting');
                }
              }
            },
          },
        ], 'plain-text', currentValue)
      : Alert.alert('Notice', 'Setting configuration can be edited directly via Web Admin Portal.');
  };

  const handleBroadcast = async () => {
    if (!broadcastTitle.trim() || !broadcastMsg.trim()) {
      Alert.alert('Missing Info', 'Please enter title and message to broadcast.');
      return;
    }
    setIsSendingBroadcast(true);
    try {
      await apiClient.post('/api/admin/notifications/broadcast', {
        title: broadcastTitle.trim(),
        message: broadcastMsg.trim(),
        targetRole: broadcastRole === 'ALL' ? null : broadcastRole,
      });
      setBroadcastTitle('');
      setBroadcastMsg('');
      Alert.alert('Broadcast Sent', 'Announcement successfully pushed to all target users.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to broadcast notification');
    } finally {
      setIsSendingBroadcast(false);
    }
  };

  const renderOverviewTab = () => {
    if (!overview) return null;
    return (
      <ScrollView
        contentContainerStyle={styles.tabContent}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => { setIsRefreshing(true); loadData(); }} tintColor="#EC4899" />}
      >
        <Text style={styles.sectionTitle}>Platform Key Performance Indicators</Text>

        <View style={styles.kpiGrid}>
          <View style={[styles.kpiCard, { borderColor: '#3B82F6' }]}>
            <Ionicons name="people" size={24} color="#3B82F6" />
            <Text style={styles.kpiValue}>{overview.totalUsers}</Text>
            <Text style={styles.kpiLabel}>Registered Users</Text>
          </View>
          <View style={[styles.kpiCard, { borderColor: '#10B981' }]}>
            <Ionicons name="car" size={24} color="#10B981" />
            <Text style={styles.kpiValue}>{overview.activeDrivers}</Text>
            <Text style={styles.kpiLabel}>Active Drivers</Text>
          </View>
          <View style={[styles.kpiCard, { borderColor: '#F59E0B' }]}>
            <Ionicons name="restaurant" size={24} color="#F59E0B" />
            <Text style={styles.kpiValue}>{overview.totalRestaurants}</Text>
            <Text style={styles.kpiLabel}>Restaurants</Text>
          </View>
          <View style={[styles.kpiCard, { borderColor: '#8B5CF6' }]}>
            <Ionicons name="bag-handle" size={24} color="#8B5CF6" />
            <Text style={styles.kpiValue}>{overview.activeListings}</Text>
            <Text style={styles.kpiLabel}>Bazaar Ads</Text>
          </View>
        </View>

        <View style={styles.revenueCard}>
          <View style={styles.revCol}>
            <Text style={styles.revLabel}>Gross Food Volume</Text>
            <Text style={styles.revAmount}>₹{overview.grossFoodSales?.toLocaleString()}</Text>
          </View>
          <View style={styles.revDivider} />
          <View style={styles.revCol}>
            <Text style={styles.revLabel}>Gross Ride Volume</Text>
            <Text style={styles.revAmount}>₹{overview.grossRideFares?.toLocaleString()}</Text>
          </View>
          <View style={styles.revDivider} />
          <View style={styles.revCol}>
            <Text style={[styles.revLabel, { color: '#EC4899' }]}>Platform Net Take</Text>
            <Text style={[styles.revAmount, { color: '#EC4899' }]}>₹{overview.platformRevenue?.toLocaleString()}</Text>
          </View>
        </View>

        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Recent Platform Activities</Text>
        {overview.recentActivities?.map((act: any) => (
          <View key={act.id} style={styles.activityRow}>
            <View style={[styles.moduleBadge, { backgroundColor: getModuleColor(act.module) + '20' }]}>
              <Text style={[styles.moduleBadgeText, { color: getModuleColor(act.module) }]}>{act.module}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.activityDesc}>{act.description}</Text>
              <Text style={styles.activityTime}>{new Date(act.timestamp).toLocaleTimeString()}</Text>
            </View>
            {act.amount && <Text style={styles.activityAmount}>₹{act.amount}</Text>}
          </View>
        ))}
      </ScrollView>
    );
  };

  const renderOrdersTab = () => (
    <FlatList
      data={foodOrders}
      keyExtractor={(item) => item.id.toString()}
      contentContainerStyle={styles.listContainer}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => { setIsRefreshing(true); loadData(); }} tintColor="#EC4899" />}
      renderItem={({ item }) => (
        <View style={styles.cardItem}>
          <View style={styles.cardRow}>
            <View>
              <Text style={styles.cardTitle}>Order #{item.orderNumber}</Text>
              <Text style={styles.cardSub}>{item.restaurantName} • {item.customerName} ({item.customerPhone})</Text>
            </View>
            <View style={styles.cardRight}>
              <Text style={styles.priceHighlight}>₹{item.grandTotal}</Text>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
                <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>{item.status}</Text>
              </View>
            </View>
          </View>
          <Text style={styles.metaText}>{item.itemsCount} items • Paid via {item.paymentMethod} ({item.paymentStatus})</Text>
        </View>
      )}
      ListEmptyComponent={<Text style={styles.emptyText}>No food orders recorded yet.</Text>}
    />
  );

  const renderRidesTab = () => (
    <FlatList
      data={rides}
      keyExtractor={(item) => item.id.toString()}
      contentContainerStyle={styles.listContainer}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => { setIsRefreshing(true); loadData(); }} tintColor="#EC4899" />}
      renderItem={({ item }) => (
        <View style={styles.cardItem}>
          <View style={styles.cardRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{item.vehicleType} • {item.rideNumber}</Text>
              <Text style={styles.cardSub}>Passenger: {item.customerName} ({item.customerPhone})</Text>
              <Text style={styles.routeText} numberOfLines={1}>From: {item.pickupAddress}</Text>
              <Text style={styles.routeText} numberOfLines={1}>To: {item.dropoffAddress}</Text>
            </View>
            <View style={styles.cardRight}>
              <Text style={styles.priceHighlight}>₹{item.actualFare || item.estimatedFare}</Text>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
                <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>{item.status}</Text>
              </View>
            </View>
          </View>
          <Text style={styles.metaText}>
            Driver: {item.driverName ? `${item.driverName} (${item.driverPhone})` : 'Searching / Unassigned'} • {item.distanceKm} km
          </Text>
        </View>
      )}
      ListEmptyComponent={<Text style={styles.emptyText}>No rides found.</Text>}
    />
  );

  const renderUsersTab = () => {
    const filtered = users.filter((u) =>
      !searchQuery ||
      u.mobileNumber.includes(searchQuery) ||
      (u.fullName && u.fullName.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return (
      <View style={{ flex: 1 }}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or phone..."
            placeholderTextColor={colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContainer}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => { setIsRefreshing(true); loadData(); }} tintColor="#EC4899" />}
          renderItem={({ item }) => (
            <View style={styles.cardItem}>
              <View style={styles.cardRow}>
                <View>
                  <Text style={styles.cardTitle}>{item.fullName || 'User'} (#{item.id})</Text>
                  <Text style={styles.cardSub}>{item.mobileNumber} • {item.email || 'No email'}</Text>
                  <View style={styles.rolesRow}>
                    {item.roles?.map((r: string) => (
                      <View key={r} style={styles.roleTag}>
                        <Text style={styles.roleTagText}>{r}</Text>
                      </View>
                    ))}
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.statusBtnSmall, { backgroundColor: item.isActive ? '#EF444420' : '#10B98120' }]}
                  onPress={() => handleToggleUserStatus(item.id, item.isActive)}
                >
                  <Text style={{ color: item.isActive ? '#EF4444' : '#10B981', fontWeight: '700', fontSize: 12 }}>
                    {item.isActive ? 'Suspend' : 'Activate'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>No users matched your query.</Text>}
        />
      </View>
    );
  };

  const renderBazaarTab = () => (
    <FlatList
      data={listings}
      keyExtractor={(item) => item.id.toString()}
      contentContainerStyle={styles.listContainer}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => { setIsRefreshing(true); loadData(); }} tintColor="#EC4899" />}
      renderItem={({ item }) => (
        <View style={styles.cardItem}>
          <View style={styles.cardRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardSub}>{item.categoryName} • {item.location || 'Local'}</Text>
              <Text style={styles.priceHighlight}>₹{item.price}</Text>
            </View>
            <View style={styles.cardRight}>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
                <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>{item.status}</Text>
              </View>
            </View>
          </View>
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.actionPill}
              onPress={() => handleListingAction(item.id, 'STATUS', item.status === 'ACTIVE' ? 'SOLD' : 'ACTIVE')}
            >
              <Text style={styles.actionPillText}>{item.status === 'ACTIVE' ? 'Mark Sold' : 'Activate'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionPill}
              onPress={() => handleListingAction(item.id, 'FEATURED', !item.isFeatured)}
            >
              <Text style={styles.actionPillText}>{item.isFeatured ? 'Unfeature' : 'Feature'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionPill, { borderColor: '#EF4444' }]}
              onPress={() => handleListingAction(item.id, 'DELETE')}
            >
              <Text style={[styles.actionPillText, { color: '#EF4444' }]}>Remove</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      ListEmptyComponent={<Text style={styles.emptyText}>No marketplace listings.</Text>}
    />
  );

  const renderConfigTab = () => (
    <ScrollView
      contentContainerStyle={styles.tabContent}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => { setIsRefreshing(true); loadData(); }} tintColor="#EC4899" />}
    >
      <Text style={styles.sectionTitle}>Global System Parameters</Text>
      {settings.map((s) => (
        <TouchableOpacity
          key={s.key}
          style={styles.settingRow}
          onPress={() => handleUpdateSetting(s.key, s.value)}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.settingKey}>{s.key}</Text>
            <Text style={styles.settingDesc}>{s.description}</Text>
          </View>
          <View style={styles.settingValBadge}>
            <Text style={styles.settingValText}>{s.value}</Text>
          </View>
        </TouchableOpacity>
      ))}

      <Text style={[styles.sectionTitle, { marginTop: 28 }]}>Broadcast Push Announcement</Text>
      <View style={styles.broadcastBox}>
        <TextInput
          style={styles.inputField}
          placeholder="Announcement Title..."
          placeholderTextColor={colors.textTertiary}
          value={broadcastTitle}
          onChangeText={setBroadcastTitle}
        />
        <TextInput
          style={[styles.inputField, { height: 72, textAlignVertical: 'top' }]}
          placeholder="Message to all active platform users..."
          placeholderTextColor={colors.textTertiary}
          value={broadcastMsg}
          onChangeText={setBroadcastMsg}
          multiline
        />
        <View style={styles.targetRoleRow}>
          {['ALL', 'CUSTOMER', 'DRIVER', 'RESTAURANT_OWNER'].map((role) => (
            <TouchableOpacity
              key={role}
              style={[styles.roleSelectPill, broadcastRole === role && styles.roleSelectPillActive]}
              onPress={() => setBroadcastRole(role)}
            >
              <Text style={[styles.roleSelectText, broadcastRole === role && styles.roleSelectTextActive]}>{role}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity
          style={[styles.broadcastBtn, isSendingBroadcast && { opacity: 0.6 }]}
          disabled={isSendingBroadcast}
          onPress={handleBroadcast}
        >
          {isSendingBroadcast ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.broadcastBtnText}>Send Push Broadcast</Text>}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  function getModuleColor(mod: string) {
    switch (mod) {
      case 'FOOD': return '#F59E0B';
      case 'RIDE': return '#3B82F6';
      case 'MARKETPLACE': return '#8B5CF6';
      default: return '#10B981';
    }
  }

  function getStatusColor(status: string) {
    switch (status?.toUpperCase()) {
      case 'DELIVERED':
      case 'COMPLETED':
      case 'ACTIVE': return '#10B981';
      case 'PREPARING':
      case 'STARTED': return '#3B82F6';
      case 'ACCEPTED':
      case 'ARRIVING': return '#8B5CF6';
      case 'PENDING':
      case 'REQUESTED': return '#F59E0B';
      case 'CANCELLED':
      case 'REMOVED': return '#EF4444';
      default: return '#94A3B8';
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Admin Header */}
      <View style={styles.header}>
        <View>
          <View style={styles.titleRow}>
            <Ionicons name="shield-checkmark" size={20} color="#EC4899" />
            <Text style={styles.headerTitle}>Admin Command</Text>
          </View>
          <Text style={styles.headerSubtitle}>SuperApp Central Governance</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.webPortalBtn}
            onPress={() => navigation.navigate('AdminPortal')}
          >
            <Ionicons name="globe-outline" size={16} color="#FFFFFF" />
            <Text style={styles.webPortalText}>Web</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
            <Ionicons name="log-out-outline" size={18} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs Row */}
      <View style={styles.tabScroll}>
        {(['OVERVIEW', 'ORDERS', 'RIDES', 'USERS', 'BAZAAR', 'CONFIG'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabChip, activeTab === tab && styles.tabChipActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabChipText, activeTab === tab && styles.tabChipTextActive]}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#EC4899" />
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {activeTab === 'OVERVIEW' && renderOverviewTab()}
          {activeTab === 'ORDERS' && renderOrdersTab()}
          {activeTab === 'RIDES' && renderRidesTab()}
          {activeTab === 'USERS' && renderUsersTab()}
          {activeTab === 'BAZAAR' && renderBazaarTab()}
          {activeTab === 'CONFIG' && renderConfigTab()}
        </View>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  webPortalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EC489925',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EC489960',
  },
  webPortalText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  logoutBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#EF444420',
  },
  tabScroll: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 8,
  },
  tabChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  tabChipActive: {
    backgroundColor: '#EC4899',
  },
  tabChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  tabChipTextActive: {
    color: '#FFFFFF',
  },
  tabContent: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  kpiCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.surface,
    padding: 14,
    borderRadius: 12,
    borderLeftWidth: 4,
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 8,
  },
  kpiLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  revenueCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  revCol: {
    flex: 1,
    alignItems: 'center',
  },
  revDivider: {
    width: 1,
    height: 36,
    backgroundColor: colors.border,
  },
  revLabel: {
    fontSize: 11,
    color: colors.textTertiary,
    fontWeight: '600',
  },
  revAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 4,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  moduleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  moduleBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  activityDesc: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  activityTime: {
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: 2,
  },
  activityAmount: {
    fontSize: 13,
    fontWeight: '700',
    color: '#10B981',
  },
  listContainer: {
    padding: 16,
    paddingBottom: 40,
    gap: 12,
  },
  cardItem: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cardSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 3,
  },
  cardRight: {
    alignItems: 'flex-end',
  },
  priceHighlight: {
    fontSize: 16,
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
  },
  metaText: {
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: 8,
  },
  routeText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  rolesRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  roleTag: {
    backgroundColor: '#3B82F620',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  roleTagText: {
    fontSize: 10,
    color: '#3B82F6',
    fontWeight: '700',
  },
  statusBtnSmall: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    justifyContent: 'flex-end',
  },
  actionPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    color: '#FFFFFF',
    fontSize: 13,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  settingKey: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  settingDesc: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  settingValBadge: {
    backgroundColor: '#EC489920',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  settingValText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#EC4899',
  },
  broadcastBox: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  inputField: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 10,
    color: '#FFFFFF',
    fontSize: 13,
    borderWidth: 1,
    borderColor: colors.border,
  },
  targetRoleRow: {
    flexDirection: 'row',
    gap: 6,
  },
  roleSelectPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  roleSelectPillActive: {
    borderColor: '#EC4899',
    backgroundColor: '#EC489920',
  },
  roleSelectText: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  roleSelectTextActive: {
    color: '#EC4899',
  },
  broadcastBtn: {
    backgroundColor: '#EC4899',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  broadcastBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 30,
    fontSize: 13,
  },
});
