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
import { AdminUser } from './types';
import { AdminUserManageModal } from './AdminUserManageModal';

interface AdminUsersScreenProps {
  navigation: any;
}

const ROLE_FILTERS = [
  { key: '', label: 'All Users' },
  { key: 'CUSTOMER', label: 'Customers' },
  { key: 'DRIVER', label: 'Drivers' },
  { key: 'RESTAURANT_OWNER', label: 'Owners' },
  { key: 'ADMIN', label: 'Admins' },
];

export const AdminUsersScreen: React.FC<AdminUsersScreenProps> = ({ navigation }) => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [managingUser, setManagingUser] = useState<AdminUser | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      const params: any = {};
      if (search.trim()) params.search = search.trim();
      if (selectedRole) params.role = selectedRole;

      const res = await apiClient.get<any>('/admin/users', { params });
      const payload = res.data?.data || res.data;
      const list = payload?.items || payload || [];
      setUsers(list);
    } catch (err: any) {
      console.warn('[AdminUsersScreen] Error fetching users:', err.message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [search, selectedRole]);

  useEffect(() => {
    setIsLoading(true);
    const delay = setTimeout(() => {
      fetchUsers();
    }, 250);
    return () => clearTimeout(delay);
  }, [fetchUsers]);

  const handleUserUpdated = (updatedUser: AdminUser) => {
    setUsers((prev) => prev.map((u) => (u.id === updatedUser.id ? updatedUser : u)));
    setManagingUser(updatedUser);
  };

  const renderUserCard = ({ item }: { item: AdminUser }) => {
    return (
      <View style={styles.userCard}>
        <View style={styles.cardHeader}>
          <View style={styles.avatarBox}>
            <Ionicons name="person" size={20} color={AppColors.textSecondary} />
          </View>
          <View style={styles.userInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.userName}>{item.fullName || 'User #' + item.id}</Text>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: item.isActive ? AppColors.secondary + '20' : '#371818' },
                ]}
              >
                <Text
                  style={[
                    styles.statusBadgeText,
                    { color: item.isActive ? AppColors.secondary : AppColors.red },
                  ]}
                >
                  {item.isActive ? 'ACTIVE' : 'SUSPENDED'}
                </Text>
              </View>
            </View>
            <Text style={styles.userPhone}>{item.mobileNumber}</Text>
          </View>
        </View>

        {/* Roles row */}
        <View style={styles.rolesRow}>
          {(item.roles && item.roles.length > 0 ? item.roles : ['Customer']).map((role) => (
            <View key={role} style={styles.roleTag}>
              <Text style={styles.roleTagText}>{role}</Text>
            </View>
          ))}
        </View>

        {/* Footer actions */}
        <View style={styles.cardFooter}>
          <Text style={styles.userIdText}>ID #{item.id}</Text>
          <TouchableOpacity
            style={styles.manageButton}
            onPress={() => setManagingUser(item)}
            activeOpacity={0.7}
          >
            <Ionicons name="settings-outline" size={14} color="#FFFFFF" />
            <Text style={styles.manageButtonText}>Manage Account</Text>
          </TouchableOpacity>
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
        <Text style={styles.headerTitle}>User Accounts</Text>
        <View style={{ width: 38 }} />
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={AppColors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, phone or ID..."
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

      {/* Role Filter Chips */}
      <View style={styles.filterContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={ROLE_FILTERS}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.filterList}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.filterChip,
                selectedRole === item.key && styles.filterChipActive,
              ]}
              onPress={() => setSelectedRole(item.key)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedRole === item.key && styles.filterChipTextActive,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Users List */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={AppColors.primary} />
          <Text style={styles.loadingText}>Fetching users...</Text>
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderUserCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => {
                setIsRefreshing(true);
                fetchUsers();
              }}
              tintColor={AppColors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={48} color={AppColors.border} />
              <Text style={styles.emptyTitle}>No Users Found</Text>
              <Text style={styles.emptySubtitle}>Try adjusting your search or role filters</Text>
            </View>
          }
        />
      )}

      {/* User Management Modal */}
      <AdminUserManageModal
        visible={managingUser !== null}
        user={managingUser}
        onClose={() => setManagingUser(null)}
        onUserUpdated={handleUserUpdated}
      />
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
  searchContainer: {
    padding: 14,
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
  filterContainer: {
    marginBottom: 8,
  },
  filterList: {
    paddingHorizontal: 14,
    gap: 8,
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: AppColors.surface,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  filterChipActive: {
    backgroundColor: AppColors.primary,
    borderColor: AppColors.primary,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: AppColors.textSecondary,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    padding: 14,
    gap: 12,
  },
  userCard: {
    backgroundColor: AppColors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  avatarBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: AppColors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userName: {
    fontSize: 15,
    fontWeight: '700',
    color: AppColors.textPrimary,
  },
  userPhone: {
    fontSize: 13,
    color: AppColors.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  rolesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  roleTag: {
    backgroundColor: AppColors.surfaceLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  roleTagText: {
    fontSize: 11,
    color: AppColors.primary,
    fontWeight: '600',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: AppColors.border,
    paddingTop: 10,
  },
  userIdText: {
    fontSize: 12,
    color: AppColors.textSecondary,
  },
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  manageButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
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
