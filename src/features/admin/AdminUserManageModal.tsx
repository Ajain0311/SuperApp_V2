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
import { FormKeyboardAvoid } from '../../components/common/FormKeyboardAvoid';
import { AdminUser } from './types';

interface AdminUserManageModalProps {
  visible: boolean;
  user: AdminUser | null;
  onClose: () => void;
  onUserUpdated: (updatedUser: AdminUser) => void;
}

const AVAILABLE_ROLES = [
  { key: 'CUSTOMER', label: 'Customer', icon: 'person-outline' as const },
  { key: 'RESTAURANT_OWNER', label: 'Restaurant Owner / Chef', icon: 'restaurant-outline' as const },
  { key: 'DRIVER', label: 'Delivery Partner / Rider', icon: 'bicycle-outline' as const },
  { key: 'MARKETPLACE_SELLER', label: 'Seller', icon: 'pricetag-outline' as const },
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
      await apiClient.post('/admin/users', {
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
      await apiClient.post('/admin/users', {
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
      await apiClient.post('/admin/users/assign', {
        userId: user.id,
        mobileNumber: user.mobileNumber,
        fullName: user.fullName || 'Admin User',
        role: 'ADMIN',
        roles: ['ADMIN'],
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
      <FormKeyboardAvoid>
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

            {/* Roles Management Card — checkboxes, save immediately */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionHeader}>ASSIGNED ROLES</Text>
              <Text style={styles.sectionNote}>
                Check or uncheck a role to assign or remove it immediately.
              </Text>
              <View style={styles.rolesList}>
                {AVAILABLE_ROLES.map((role) => {
                  const isAssigned = currentRoles.includes(role.key);
                  const isLoading = loadingRole === role.key;
                  const lockedCustomer = role.key === 'CUSTOMER' && isAssigned;

                  return (
                    <TouchableOpacity
                      key={role.key}
                      style={styles.roleItem}
                      onPress={() => !isLoading && handleToggleRole(role.key)}
                      disabled={isLoading || lockedCustomer}
                      activeOpacity={0.7}
                    >
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
                      {isLoading ? (
                        <ActivityIndicator size="small" color={AppColors.primary} />
                      ) : (
                        <View
                          style={[
                            styles.checkbox,
                            isAssigned && styles.checkboxChecked,
                            lockedCustomer && styles.checkboxLocked,
                          ]}
                        >
                          {isAssigned ? (
                            <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                          ) : null}
                        </View>
                      )}
                    </TouchableOpacity>
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
      </FormKeyboardAvoid>
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
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: AppColors.border,
    backgroundColor: AppColors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: AppColors.primary,
    borderColor: AppColors.primary,
  },
  checkboxLocked: {
    opacity: 0.55,
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
