import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppColors } from '../../theme/colors';
import { apiClient } from '../../services/apiClient';
import { AdminUser } from './types';

interface AdminUserManageModalProps {
  visible: boolean;
  user: AdminUser | null;
  onClose: () => void;
  onUserUpdated: (updatedUser: AdminUser) => void;
}

const AVAILABLE_ROLES = [
  { key: 'CUSTOMER', label: 'Customer', icon: 'person-outline' as const },
  { key: 'DRIVER', label: 'Driver / Captain', icon: 'car-outline' as const },
  { key: 'RESTAURANT_OWNER', label: 'Restaurant Owner', icon: 'restaurant-outline' as const },
  { key: 'ADMIN', label: 'Admin', icon: 'shield-checkmark-outline' as const },
];

export const AdminUserManageModal: React.FC<AdminUserManageModalProps> = ({
  visible,
  user,
  onClose,
  onUserUpdated,
}) => {
  const [loadingRole, setLoadingRole] = useState<string | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  if (!user) return null;

  const currentRoles = (user.roles || []).map((r) => r.toUpperCase());

  const handleToggleRole = async (roleName: string) => {
    const hasRole = currentRoles.includes(roleName);
    const action = hasRole ? 'REMOVE_ROLE' : 'ROLE';

    if (hasRole && roleName === 'CUSTOMER') {
      Alert.alert('Notice', 'Customer role cannot be removed from accounts.');
      return;
    }

    setLoadingRole(roleName);
    try {
      await apiClient.post('/api/admin/users', {
        action,
        userId: user.id,
        roleName,
      });

      const updatedRoles = hasRole
        ? currentRoles.filter((r) => r !== roleName)
        : [...currentRoles, roleName];

      const updated = { ...user, roles: updatedRoles };
      onUserUpdated(updated);
      Alert.alert(
        'Role Updated',
        hasRole
          ? `Removed ${roleName} from user #${user.id}`
          : `Assigned ${roleName} to user #${user.id}`
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not update role');
    } finally {
      setLoadingRole(null);
    }
  };

  const handleToggleStatus = async () => {
    setLoadingStatus(true);
    const newStatus = !user.isActive;
    try {
      await apiClient.post('/api/admin/users', {
        action: 'STATUS',
        userId: user.id,
        isActive: newStatus,
      });

      const updated = { ...user, isActive: newStatus };
      onUserUpdated(updated);
      Alert.alert('Status Updated', `User account is now ${newStatus ? 'ACTIVE' : 'SUSPENDED'}`);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not change account status');
    } finally {
      setLoadingStatus(false);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword.trim() || newPassword.length < 6) {
      Alert.alert('Invalid Password', 'Password must be at least 6 characters.');
      return;
    }

    setIsResettingPassword(true);
    try {
      await apiClient.post('/api/admin/users/assign', {
        mobileNumber: user.mobileNumber,
        fullName: user.fullName || 'Admin User',
        role: 'ADMIN',
        adminPassword: newPassword.trim(),
      });
      setNewPassword('');
      Alert.alert('Password Updated', `Admin password for user #${user.id} has been reset.`);
    } catch (err: any) {
      Alert.alert('Reset Failed', err.message || 'Could not reset password');
    } finally {
      setIsResettingPassword(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Manage User #{user.id}</Text>
              <Text style={styles.subtitle}>{user.fullName || 'User'} • {user.mobileNumber}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Account Status Card */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionHeader}>ACCOUNT STATUS</Text>
              <View style={styles.statusRow}>
                <View style={styles.statusInfo}>
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: user.isActive ? AppColors.secondary : AppColors.red },
                    ]}
                  />
                  <Text style={styles.statusLabel}>
                    {user.isActive ? 'Active & Authorized' : 'Suspended / Banned'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.actionBtn,
                    { backgroundColor: user.isActive ? '#371818' : '#143820' },
                  ]}
                  onPress={handleToggleStatus}
                  disabled={loadingStatus}
                >
                  {loadingStatus ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text
                      style={[
                        styles.actionBtnText,
                        { color: user.isActive ? AppColors.red : AppColors.secondary },
                      ]}
                    >
                      {user.isActive ? 'Suspend User' : 'Unban User'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Roles Management Card */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionHeader}>ASSIGNED ROLES</Text>
              <Text style={styles.sectionNote}>
                Toggle user roles below. Users will instantly gain access to the respective mode in the SuperApp.
              </Text>
              <View style={styles.rolesList}>
                {AVAILABLE_ROLES.map((role) => {
                  const isAssigned = currentRoles.includes(role.key);
                  const isLoading = loadingRole === role.key;

                  return (
                    <View key={role.key} style={styles.roleItem}>
                      <View style={styles.roleLeft}>
                        <Ionicons
                          name={role.icon}
                          size={18}
                          color={isAssigned ? AppColors.primary : AppColors.textSecondary}
                        />
                        <Text style={[styles.roleLabel, isAssigned && styles.roleLabelActive]}>
                          {role.label}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={[
                          styles.roleToggleBtn,
                          isAssigned ? styles.roleToggleActive : styles.roleToggleInactive,
                        ]}
                        onPress={() => handleToggleRole(role.key)}
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Text
                            style={[
                              styles.roleToggleText,
                              isAssigned ? styles.roleToggleTextActive : styles.roleToggleTextInactive,
                            ]}
                          >
                            {isAssigned ? 'Active' : 'Grant'}
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Reset Admin Password Card */}
            {currentRoles.includes('ADMIN') && (
              <View style={styles.sectionCard}>
                <Text style={styles.sectionHeader}>SET / RESET ADMIN PASSWORD</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter new admin password"
                  placeholderTextColor={AppColors.textSecondary}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                />
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={handleResetPassword}
                  disabled={isResettingPassword}
                >
                  {isResettingPassword ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Save Admin Password</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: AppColors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    borderTopWidth: 1,
    borderColor: AppColors.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderColor: AppColors.border,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: AppColors.textPrimary,
  },
  subtitle: {
    fontSize: 13,
    color: AppColors.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: AppColors.surface,
  },
  body: {
    padding: 20,
  },
  sectionCard: {
    backgroundColor: AppColors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: AppColors.primary,
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  sectionNote: {
    fontSize: 12,
    color: AppColors.textSecondary,
    marginBottom: 14,
    lineHeight: 18,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: AppColors.textPrimary,
  },
  actionBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  rolesList: {
    gap: 10,
  },
  roleItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: AppColors.border + '50',
  },
  roleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  roleLabel: {
    fontSize: 14,
    color: AppColors.textSecondary,
  },
  roleLabelActive: {
    color: AppColors.textPrimary,
    fontWeight: '600',
  },
  roleToggleBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    minWidth: 70,
    alignItems: 'center',
  },
  roleToggleActive: {
    backgroundColor: AppColors.primary + '25',
    borderWidth: 1,
    borderColor: AppColors.primary,
  },
  roleToggleInactive: {
    backgroundColor: AppColors.surfaceLight,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  roleToggleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  roleToggleTextActive: {
    color: AppColors.primary,
  },
  roleToggleTextInactive: {
    color: AppColors.textSecondary,
  },
  input: {
    backgroundColor: AppColors.surfaceLight,
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: AppColors.textPrimary,
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: AppColors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
