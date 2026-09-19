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
  Modal,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { apiClient } from '../../services/apiClient';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';
import { useAuthStore } from '../../store/authStore';

type AdminTab = 'OVERVIEW' | 'USERS' | 'RESTAURANTS' | 'ORDERS' | 'RIDES' | 'BAZAAR' | 'CONFIG';

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
  const [restaurants, setRestaurants] = useState<any[]>([]);

  // Add Restaurant modal states
  const [showAddRestModal, setShowAddRestModal] = useState(false);
  const [restName, setRestName] = useState('');
  const [restDesc, setRestDesc] = useState('');
  const [restPhone, setRestPhone] = useState('');
  const [restCity, setRestCity] = useState('Chandigarh');
  const [restAddress, setRestAddress] = useState('');
  const [restIsVeg, setRestIsVeg] = useState(false);
  const [restMinOrder, setRestMinOrder] = useState('100');
  const [restDeliveryFee, setRestDeliveryFee] = useState('30');
  const [isSavingRest, setIsSavingRest] = useState(false);

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
      } else if (activeTab === 'RESTAURANTS') {
        const res = await apiClient.get<any>('/api/admin/restaurants');
        setRestaurants(res.data?.data || res.data || []);
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

  const handleToggleUserRole = async (userId: number, roleName: string, currentRoles: string[] = []) => {
    const hasRole = currentRoles.includes(roleName);
    try {
      await apiClient.post('/api/admin/users', {
        action: 'ROLE',
        userId,
        roleName,
      });
      const updatedRoles = hasRole
        ? currentRoles.filter((r) => r !== roleName)
        : [...currentRoles, roleName];

      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, roles: updatedRoles } : u))
      );
      Alert.alert(
        'Role Updated',
        hasRole
          ? `Removed ${roleName} role from user #${userId}`
          : `Assigned ${roleName} to user #${userId}. They can now access this mode in their app.`
      );
    } catch (e: any) {
      Alert.alert('Role Update Failed', e.message || 'Could not update user role');
    }
  };

  const handleAddRestaurant = async () => {
    if (!restName.trim()) {
      Alert.alert('Required', 'Please enter restaurant name');
      return;
    }
    setIsSavingRest(true);
    try {
      const res = await apiClient.post<any>('/api/admin/restaurants', {
        action: 'ADD',
        name: restName.trim(),
        description: restDesc.trim() || restName.trim(),
        phone: restPhone.trim() || '9876543210',
        city: restCity.trim() || 'Chandigarh',
        addressLine: restAddress.trim() || 'Main Market',
        isVeg: restIsVeg,
        minOrderAmount: parseFloat(restMinOrder) || 100,
        deliveryFee: parseFloat(restDeliveryFee) || 30,
        isFeatured: false,
      });
      const created = res.data?.data || res.data;
      if (created?.id) {
        setRestaurants((prev) => [created, ...prev]);
      }
      setShowAddRestModal(false);
      setRestName('');
      setRestDesc('');
      setRestPhone('');
      setRestAddress('');
      Alert.alert('Success 🎉', `Restaurant "${restName.trim()}" added and published successfully!`);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not add restaurant');
    } finally {
      setIsSavingRest(false);
    }
  };

  const handleToggleRestaurantStatus = async (id: number, currentActive: boolean) => {
    try {
      await apiClient.post('/api/admin/restaurants', {
        action: 'STATUS',
        id,
        isActive: !currentActive,
      });
      setRestaurants((prev) =>
        prev.map((r) => (r.id === id ? { ...r, isActive: !currentActive } : r))
      );
      Alert.alert('Updated', `Restaurant is now ${!currentActive ? 'ACTIVE' : 'INACTIVE'}`);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not update status');
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
                <View style={{ flex: 1 }}>
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

              {/* Admin Role Assignment Controls */}
              <View style={styles.roleAdminSection}>
                <Text style={styles.roleAdminLabel}>ASSIGN ROLES (ADMIN CONTROL):</Text>
                <View style={styles.roleButtonsRow}>
                  {/* DRIVER */}
                  <TouchableOpacity
                    style={[
                      styles.roleToggleBtn,
                      item.roles?.includes('DRIVER') ? styles.roleToggleBtnActive : styles.roleToggleBtnInactive,
                    ]}
                    onPress={() => handleToggleUserRole(item.id, 'DRIVER', item.roles || [])}
                  >
                    <Ionicons
                      name={item.roles?.includes('DRIVER') ? 'checkmark-circle' : 'add-circle-outline'}
                      size={14}
                      color={item.roles?.includes('DRIVER') ? '#FFFFFF' : '#3B82F6'}
                      style={{ marginRight: 4 }}
                    />
                    <Text
                      style={[
                        styles.roleToggleText,
                        item.roles?.includes('DRIVER') ? styles.roleToggleTextActive : { color: '#3B82F6' },
                      ]}
                    >
                      Rider / Driver
                    </Text>
                  </TouchableOpacity>

                  {/* RESTAURANT_OWNER */}
                  <TouchableOpacity
                    style={[
                      styles.roleToggleBtn,
                      item.roles?.includes('RESTAURANT_OWNER') ? styles.roleToggleBtnActiveOwner : styles.roleToggleBtnInactive,
                    ]}
                    onPress={() => handleToggleUserRole(item.id, 'RESTAURANT_OWNER', item.roles || [])}
                  >
                    <Ionicons
                      name={item.roles?.includes('RESTAURANT_OWNER') ? 'checkmark-circle' : 'add-circle-outline'}
                      size={14}
                      color={item.roles?.includes('RESTAURANT_OWNER') ? '#FFFFFF' : '#F59E0B'}
                      style={{ marginRight: 4 }}
                    />
                    <Text
                      style={[
                        styles.roleToggleText,
                        item.roles?.includes('RESTAURANT_OWNER') ? styles.roleToggleTextActive : { color: '#F59E0B' },
                      ]}
                    >
                      Restaurant Owner
                    </Text>
                  </TouchableOpacity>

                  {/* MARKETPLACE_SELLER */}
                  <TouchableOpacity
                    style={[
                      styles.roleToggleBtn,
                      item.roles?.includes('MARKETPLACE_SELLER') ? styles.roleToggleBtnActiveSeller : styles.roleToggleBtnInactive,
                    ]}
                    onPress={() => handleToggleUserRole(item.id, 'MARKETPLACE_SELLER', item.roles || [])}
                  >
                    <Ionicons
                      name={item.roles?.includes('MARKETPLACE_SELLER') ? 'checkmark-circle' : 'add-circle-outline'}
                      size={14}
                      color={item.roles?.includes('MARKETPLACE_SELLER') ? '#FFFFFF' : '#8B5CF6'}
                      style={{ marginRight: 4 }}
                    />
                    <Text
                      style={[
                        styles.roleToggleText,
                        item.roles?.includes('MARKETPLACE_SELLER') ? styles.roleToggleTextActive : { color: '#8B5CF6' },
                      ]}
                    >
                      Seller
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>No users matched your query.</Text>}
        />
      </View>
    );
  };

  const renderRestaurantsTab = () => {
    const q = searchQuery.toLowerCase().trim();
    const filtered = restaurants.filter(
      (r) =>
        !q ||
        r.name?.toLowerCase().includes(q) ||
        r.city?.toLowerCase().includes(q) ||
        r.addressLine?.toLowerCase().includes(q)
    );

    return (
      <View style={{ flex: 1 }}>
        <View style={styles.filterBar}>
          <View style={[styles.searchBar, { flex: 1, marginHorizontal: 0, marginTop: 0, marginRight: 8 }]}>
            <Ionicons name="search" size={16} color={colors.textTertiary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search restaurants or city..."
              placeholderTextColor={colors.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
          <TouchableOpacity
            style={styles.addPartnerHeaderBtn}
            onPress={() => setShowAddRestModal(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={16} color="#FFFFFF" />
            <Text style={styles.addPartnerHeaderBtnText}>Add</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => {
                setIsRefreshing(true);
                loadData();
              }}
              tintColor="#EC4899"
            />
          }
          renderItem={({ item }) => (
            <View style={styles.cardItem}>
              <View style={styles.cardRow}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.cardTitle}>{item.name}</Text>
                    <View
                      style={[
                        styles.vegBadge,
                        { backgroundColor: item.isVeg ? '#10B98120' : '#EF444420' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.vegBadgeText,
                          { color: item.isVeg ? '#10B981' : '#EF4444' },
                        ]}
                      >
                        {item.isVeg ? 'Veg' : 'Non-Veg'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.cardSub}>
                    {item.city} • {item.addressLine || 'Operational Hub'}
                  </Text>
                  {item.phone ? (
                    <Text style={[styles.cardSub, { color: colors.textSecondary }]}>
                      📞 {item.phone}
                    </Text>
                  ) : null}
                  <Text style={styles.priceHighlight}>
                    Min Order: ₹{item.minOrderAmount || 100} • Delivery: ₹{item.deliveryFee || 30}
                  </Text>
                </View>
                <View style={styles.cardRight}>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: (item.isActive ? '#10B981' : '#EF4444') + '20' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        { color: item.isActive ? '#10B981' : '#EF4444' },
                      ]}
                    >
                      {item.isActive ? 'ACTIVE' : 'INACTIVE'}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[
                    styles.actionPill,
                    item.isActive && { borderColor: '#EF4444' },
                  ]}
                  onPress={() => handleToggleRestaurantStatus(item.id, item.isActive)}
                >
                  <Text
                    style={[
                      styles.actionPillText,
                      item.isActive && { color: '#EF4444' },
                    ]}
                  >
                    {item.isActive ? 'Deactivate' : 'Activate Partner'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={{ padding: 30, alignItems: 'center' }}>
              <Ionicons name="restaurant-outline" size={44} color="#94A3B8" />
              <Text style={styles.emptyText}>No restaurants found.</Text>
            </View>
          }
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
        {(['OVERVIEW', 'USERS', 'RESTAURANTS', 'ORDERS', 'RIDES', 'BAZAAR', 'CONFIG'] as const).map((tab) => (
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
          {activeTab === 'USERS' && renderUsersTab()}
          {activeTab === 'RESTAURANTS' && renderRestaurantsTab()}
          {activeTab === 'ORDERS' && renderOrdersTab()}
          {activeTab === 'RIDES' && renderRidesTab()}
          {activeTab === 'BAZAAR' && renderBazaarTab()}
          {activeTab === 'CONFIG' && renderConfigTab()}
        </View>
      )}

      {/* Add Restaurant Modal */}
      <Modal
        visible={showAddRestModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddRestModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add Restaurant Partner</Text>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              <Text style={styles.fieldLabel}>Restaurant Name *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. Royal Punjab Dhaba"
                placeholderTextColor={colors.textTertiary}
                value={restName}
                onChangeText={setRestName}
              />

              <Text style={styles.fieldLabel}>Description</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. Best North Indian & Tandoori in town"
                placeholderTextColor={colors.textTertiary}
                value={restDesc}
                onChangeText={setRestDesc}
              />

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Phone</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="9876543210"
                    placeholderTextColor={colors.textTertiary}
                    value={restPhone}
                    onChangeText={setRestPhone}
                    keyboardType="phone-pad"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>City</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Chandigarh"
                    placeholderTextColor={colors.textTertiary}
                    value={restCity}
                    onChangeText={setRestCity}
                  />
                </View>
              </View>

              <Text style={styles.fieldLabel}>Address / Area</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Sector 17 Market"
                placeholderTextColor={colors.textTertiary}
                value={restAddress}
                onChangeText={setRestAddress}
              />

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Min Order (₹)</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="100"
                    placeholderTextColor={colors.textTertiary}
                    value={restMinOrder}
                    onChangeText={setRestMinOrder}
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Delivery Fee (₹)</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="30"
                    placeholderTextColor={colors.textTertiary}
                    value={restDeliveryFee}
                    onChangeText={setRestDeliveryFee}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <Text style={styles.fieldLabel}>Food Type</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 4, marginBottom: 12 }}>
                <TouchableOpacity
                  style={[styles.vegToggleBtn, restIsVeg && styles.vegToggleBtnActive]}
                  onPress={() => setRestIsVeg(true)}
                >
                  <Text style={[styles.vegToggleText, restIsVeg && { color: '#10B981', fontWeight: '800' }]}>
                    🌱 Pure Veg
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.vegToggleBtn, !restIsVeg && styles.vegToggleBtnActive]}
                  onPress={() => setRestIsVeg(false)}
                >
                  <Text style={[styles.vegToggleText, !restIsVeg && { color: '#EF4444', fontWeight: '800' }]}>
                    🍗 Veg & Non-Veg
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowAddRestModal(false)}
                disabled={isSavingRest}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveBtn, isSavingRest && { opacity: 0.6 }]}
                onPress={handleAddRestaurant}
                disabled={isSavingRest}
              >
                {isSavingRest ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSaveText}>Add Restaurant</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
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
  roleAdminSection: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  roleAdminLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  roleButtonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  roleToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  roleToggleBtnInactive: {
    backgroundColor: '#1E293B',
    borderColor: '#475569',
  },
  roleToggleBtnActive: {
    backgroundColor: '#2563EB',
    borderColor: '#3B82F6',
  },
  roleToggleBtnActiveOwner: {
    backgroundColor: '#D97706',
    borderColor: '#F59E0B',
  },
  roleToggleBtnActiveSeller: {
    backgroundColor: '#7C3AED',
    borderColor: '#8B5CF6',
  },
  roleToggleText: {
    fontSize: 12,
    fontWeight: '700',
  },
  roleToggleTextActive: {
    color: '#FFFFFF',
  },
  addPartnerHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EC4899',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
  },
  addPartnerHeaderBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  vegBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  vegBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    marginBottom: 4,
    marginTop: 8,
  },
  modalInput: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 13,
  },
  vegToggleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0F172A',
  },
  vegToggleBtnActive: {
    borderColor: '#EC4899',
    backgroundColor: '#EC489915',
  },
  vegToggleText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  modalCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#475569',
  },
  modalCancelText: {
    color: '#94A3B8',
    fontWeight: '700',
    fontSize: 13,
  },
  modalSaveBtn: {
    backgroundColor: '#EC4899',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  modalSaveText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
});
