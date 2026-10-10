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
  Alert,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppColors } from '../../theme/colors';
import { apiClient } from '../../services/apiClient';
import { AdminSetting } from './types';

interface AdminSettingsScreenProps {
  navigation: any;
}

const TARGET_ROLES = [
  { key: 'ALL', label: 'All Users' },
  { key: 'CUSTOMER', label: 'Customers Only' },
  { key: 'DRIVER', label: 'Drivers Only' },
  { key: 'RESTAURANT_OWNER', label: 'Restaurant Owners' },
];

export const AdminSettingsScreen: React.FC<AdminSettingsScreenProps> = ({ navigation }) => {
  const [settings, setSettings] = useState<AdminSetting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Broadcast state
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [targetRole, setTargetRole] = useState('ALL');
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  // Edit setting modal
  const [editingSetting, setEditingSetting] = useState<AdminSetting | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isSavingSetting, setIsSavingSetting] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await apiClient.get<any>('/api/admin/settings');
      const payload = res.data?.data || res.data || [];
      setSettings(payload);
    } catch (err: any) {
      console.warn('[AdminSettingsScreen] Error fetching settings:', err.message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSendBroadcast = async () => {
    if (!broadcastTitle.trim() || !broadcastMessage.trim()) {
      Alert.alert('Missing Fields', 'Please enter both broadcast title and message.');
      return;
    }

    setIsBroadcasting(true);
    try {
      await apiClient.post('/api/admin/notifications/broadcast', {
        title: broadcastTitle.trim(),
        message: broadcastMessage.trim(),
        targetRole: targetRole === 'ALL' ? null : targetRole,
      });

      setBroadcastTitle('');
      setBroadcastMessage('');
      Alert.alert('Broadcast Pushed 📢', 'Push notification successfully dispatched to target users.');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not send broadcast notification');
    } finally {
      setIsBroadcasting(false);
    }
  };

  const handleOpenEdit = (item: AdminSetting) => {
    setEditingSetting(item);
    setEditValue(item.value);
  };

  const handleSaveSetting = async () => {
    if (!editingSetting) return;
    setIsSavingSetting(true);
    try {
      await apiClient.post('/api/admin/settings', {
        key: editingSetting.key,
        value: editValue.trim(),
      });

      setSettings((prev) =>
        prev.map((s) => (s.key === editingSetting.key ? { ...s, value: editValue.trim() } : s))
      );
      setEditingSetting(null);
      Alert.alert('Setting Saved', `Configuration for ${editingSetting.key} has been updated.`);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not update setting');
    } finally {
      setIsSavingSetting(false);
    }
  };

  const renderSettingCard = ({ item }: { item: AdminSetting }) => {
    return (
      <View style={styles.card}>
        <View style={styles.cardInfo}>
          <Text style={styles.settingKey}>{item.key}</Text>
          <Text style={styles.settingValue} numberOfLines={2}>
            {item.value || '<empty>'}
          </Text>
          {item.description ? (
            <Text style={styles.settingDesc}>{item.description}</Text>
          ) : null}
        </View>
        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => handleOpenEdit(item)}
          activeOpacity={0.7}
        >
          <Ionicons name="pencil" size={16} color={AppColors.primary} />
        </TouchableOpacity>
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
        <Text style={styles.headerTitle}>Settings & Broadcast</Text>
        <View style={{ width: 38 }} />
      </View>

      <FlatList
        data={settings}
        keyExtractor={(item) => item.key}
        renderItem={renderSettingCard}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => {
              setIsRefreshing(true);
              fetchSettings();
            }}
            tintColor={AppColors.primary}
          />
        }
        ListHeaderComponent={
          <View style={styles.broadcastCard}>
            <View style={styles.broadcastHeader}>
              <Ionicons name="megaphone" size={18} color={AppColors.primary} />
              <Text style={styles.broadcastTitle}>BROADCAST PUSH ANNOUNCEMENT</Text>
            </View>
            <Text style={styles.broadcastSub}>
              Push real-time announcements to app users across iOS, Android, and Web.
            </Text>

            <Text style={styles.inputLabel}>Announcement Title</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 50% Off Mega Diwali Sale!"
              placeholderTextColor={AppColors.textSecondary}
              value={broadcastTitle}
              onChangeText={setBroadcastTitle}
            />

            <Text style={styles.inputLabel}>Message Content</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Enter message details for notification alert..."
              placeholderTextColor={AppColors.textSecondary}
              value={broadcastMessage}
              onChangeText={setBroadcastMessage}
              multiline
              numberOfLines={3}
            />

            <Text style={styles.inputLabel}>Audience</Text>
            <View style={styles.roleFilterRow}>
              {TARGET_ROLES.map((r) => (
                <TouchableOpacity
                  key={r.key}
                  style={[
                    styles.roleChip,
                    targetRole === r.key && styles.roleChipActive,
                  ]}
                  onPress={() => setTargetRole(r.key)}
                >
                  <Text
                    style={[
                      styles.roleChipText,
                      targetRole === r.key && styles.roleChipTextActive,
                    ]}
                  >
                    {r.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.broadcastBtn}
              onPress={handleSendBroadcast}
              disabled={isBroadcasting}
            >
              {isBroadcasting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.broadcastBtnText}>Broadcast Notification</Text>
              )}
            </TouchableOpacity>

            <Text style={[styles.sectionTitle, { marginTop: 24 }]}>PLATFORM CONFIGURATION</Text>
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={AppColors.primary} />
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No configuration parameters found</Text>
            </View>
          )
        }
      />

      {/* Edit Setting Modal */}
      <Modal visible={editingSetting !== null} transparent animationType="slide" onRequestClose={() => setEditingSetting(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit {editingSetting?.key}</Text>
              <TouchableOpacity onPress={() => setEditingSetting(null)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>Setting Value</Text>
              <TextInput
                style={styles.input}
                value={editValue}
                onChangeText={setEditValue}
                placeholder="Value"
                placeholderTextColor={AppColors.textSecondary}
              />
              <TouchableOpacity
                style={styles.saveSettingBtn}
                onPress={handleSaveSetting}
                disabled={isSavingSetting}
              >
                {isSavingSetting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveSettingBtnText}>Save Configuration</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  listContent: {
    padding: 14,
    gap: 10,
  },
  broadcastCard: {
    backgroundColor: AppColors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  broadcastHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  broadcastTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: AppColors.primary,
    letterSpacing: 0.8,
  },
  broadcastSub: {
    fontSize: 12,
    color: AppColors.textSecondary,
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: AppColors.textSecondary,
    marginBottom: 6,
  },
  input: {
    backgroundColor: AppColors.surfaceLight,
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: AppColors.textPrimary,
    marginBottom: 12,
  },
  textArea: {
    height: 70,
    textAlignVertical: 'top',
  },
  roleFilterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  roleChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: AppColors.surfaceLight,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  roleChipActive: {
    backgroundColor: AppColors.primary,
    borderColor: AppColors.primary,
  },
  roleChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: AppColors.textSecondary,
  },
  roleChipTextActive: {
    color: '#FFFFFF',
  },
  broadcastBtn: {
    backgroundColor: AppColors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  broadcastBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: AppColors.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: AppColors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  cardInfo: {
    flex: 1,
    marginRight: 10,
  },
  settingKey: {
    fontSize: 13,
    fontWeight: '700',
    color: AppColors.primary,
  },
  settingValue: {
    fontSize: 13,
    color: AppColors.textPrimary,
    marginTop: 4,
  },
  settingDesc: {
    fontSize: 11,
    color: AppColors.textSecondary,
    marginTop: 2,
  },
  editBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: AppColors.surfaceLight,
  },
  centerContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    color: AppColors.textSecondary,
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: AppColors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderColor: AppColors.border,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderColor: AppColors.border,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: AppColors.textPrimary,
  },
  modalCloseBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: AppColors.surface,
  },
  modalBody: {
    padding: 16,
  },
  saveSettingBtn: {
    backgroundColor: AppColors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 20,
  },
  saveSettingBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
