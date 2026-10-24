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
import { FormKeyboardAvoid } from '../../components/common/FormKeyboardAvoid';
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

const DISPLAY_HOUR_OPTIONS = [
  { hours: 1, label: '1h' },
  { hours: 6, label: '6h' },
  { hours: 12, label: '12h' },
  { hours: 24, label: '24h' },
  { hours: 48, label: '48h' },
  { hours: 168, label: '7d' },
];

export const AdminSettingsScreen: React.FC<AdminSettingsScreenProps> = ({ navigation }) => {
  const [settings, setSettings] = useState<AdminSetting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Broadcast state
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [targetRole, setTargetRole] = useState('ALL');
  const [displayHours, setDisplayHours] = useState(24);
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  // Edit setting modal
  const [editingSetting, setEditingSetting] = useState<AdminSetting | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isSavingSetting, setIsSavingSetting] = useState(false);

  // Help & Support (admin-configurable)
  const [supportPhone, setSupportPhone] = useState('');
  const [supportWhatsApp, setSupportWhatsApp] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [supportHours, setSupportHours] = useState('');
  const [supportFaq, setSupportFaq] = useState('');
  const [isSavingSupport, setIsSavingSupport] = useState(false);

  const applySupportFromSettings = (payload: AdminSetting[]) => {
    const map = new Map(payload.map((s) => [s.key, s.value || '']));
    setSupportPhone(map.get('support_phone') || '');
    setSupportWhatsApp(map.get('support_whatsapp') || '');
    setSupportEmail(map.get('support_email') || '');
    setSupportHours(map.get('support_hours') || '');
    setSupportFaq(map.get('support_faq') || '');
    const defaultHoursRaw = map.get('broadcast_default_display_hours');
    const parsed = defaultHoursRaw ? parseInt(defaultHoursRaw, 10) : NaN;
    if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 168) {
      setDisplayHours(parsed);
    }
  };

  const fetchSettings = useCallback(async () => {
    try {
      const res = await apiClient.get<any>('/admin/settings');
      const payload = res.data?.data || res.data || [];
      setSettings(payload);
      applySupportFromSettings(Array.isArray(payload) ? payload : []);
    } catch (err: any) {
      console.warn('[AdminSettingsScreen] Error fetching settings:', err.message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  const handleSaveSupport = async () => {
    setIsSavingSupport(true);
    try {
      const rows = [
        { key: 'support_phone', value: supportPhone.trim(), description: 'Help & Support phone' },
        { key: 'support_whatsapp', value: supportWhatsApp.trim(), description: 'Help & Support WhatsApp (country code, no +)' },
        { key: 'support_email', value: supportEmail.trim(), description: 'Help & Support email' },
        { key: 'support_hours', value: supportHours.trim(), description: 'Support hours label' },
        { key: 'support_faq', value: supportFaq.trim(), description: 'FAQ text (Q:/A: blocks)' },
      ];
      for (const row of rows) {
        if (row.key === 'support_faq' && row.value.length > 1000) {
          Alert.alert('FAQ Too Long', 'FAQ must be 1000 characters or fewer.');
          return;
        }
        await apiClient.post('/admin/settings', row);
      }
      Alert.alert('Support Saved', 'Help & Support details updated for all users.');
      await fetchSettings();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not save Help & Support settings');
    } finally {
      setIsSavingSupport(false);
    }
  };

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
      await apiClient.post('/admin/notifications/broadcast', {
        title: broadcastTitle.trim(),
        message: broadcastMessage.trim(),
        targetRole: targetRole === 'ALL' ? null : targetRole,
        displayHours,
      });

      setBroadcastTitle('');
      setBroadcastMessage('');
      Alert.alert(
        'Broadcast Pushed 📢',
        `Sent to target users. Home marquee will show for ${displayHours} hour(s).`,
      );
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
      await apiClient.post('/admin/settings', {
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
        data={settings.filter((s) => !String(s.key || '').startsWith('support_'))}
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
          <View>
          <View style={styles.broadcastCard}>
            <View style={styles.broadcastHeader}>
              <Ionicons name="headset" size={18} color={AppColors.primary} />
              <Text style={styles.broadcastTitle}>HELP & SUPPORT (USER APP)</Text>
            </View>
            <Text style={styles.broadcastSub}>
              These values appear on Profile → Help & Support for customers (call, WhatsApp, email, hours, FAQ).
            </Text>

            <Text style={styles.inputLabel}>Support Phone</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 18001234567"
              placeholderTextColor={AppColors.textSecondary}
              value={supportPhone}
              onChangeText={setSupportPhone}
              keyboardType="phone-pad"
            />

            <Text style={styles.inputLabel}>WhatsApp (with country code, no +)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 919876543210"
              placeholderTextColor={AppColors.textSecondary}
              value={supportWhatsApp}
              onChangeText={setSupportWhatsApp}
              keyboardType="phone-pad"
            />

            <Text style={styles.inputLabel}>Support Email</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. support@makemytree.com"
              placeholderTextColor={AppColors.textSecondary}
              value={supportEmail}
              onChangeText={setSupportEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <Text style={styles.inputLabel}>Support Hours</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 24x7 Customer Support"
              placeholderTextColor={AppColors.textSecondary}
              value={supportHours}
              onChangeText={setSupportHours}
            />

            <Text style={styles.inputLabel}>FAQ (use Q: / A: blocks, max 1000 chars)</Text>
            <TextInput
              style={[styles.input, styles.textArea, { minHeight: 120 }]}
              placeholder={'Q: How do I track my order?\nA: Open Activity for live tracking.'}
              placeholderTextColor={AppColors.textSecondary}
              value={supportFaq}
              onChangeText={setSupportFaq}
              multiline
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>{supportFaq.length}/1000</Text>

            <TouchableOpacity
              style={styles.broadcastBtn}
              onPress={handleSaveSupport}
              disabled={isSavingSupport}
            >
              {isSavingSupport ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.broadcastBtnText}>Save Help & Support</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.broadcastCard}>
            <View style={styles.broadcastHeader}>
              <Ionicons name="megaphone" size={18} color={AppColors.primary} />
              <Text style={styles.broadcastTitle}>BROADCAST PUSH ANNOUNCEMENT</Text>
            </View>
            <Text style={styles.broadcastSub}>
              Push announcements to users. Home shows a scrolling marquee for the duration you pick.
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

            <Text style={styles.inputLabel}>Home marquee duration</Text>
            <View style={styles.roleFilterRow}>
              {DISPLAY_HOUR_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.hours}
                  style={[
                    styles.roleChip,
                    displayHours === opt.hours && styles.roleChipActive,
                  ]}
                  onPress={() => setDisplayHours(opt.hours)}
                >
                  <Text
                    style={[
                      styles.roleChipText,
                      displayHours === opt.hours && styles.roleChipTextActive,
                    ]}
                  >
                    {opt.label}
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
        <FormKeyboardAvoid>
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
        </FormKeyboardAvoid>
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
  charCount: {
    fontSize: 11,
    color: AppColors.textSecondary,
    textAlign: 'right',
    marginTop: -6,
    marginBottom: 10,
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
