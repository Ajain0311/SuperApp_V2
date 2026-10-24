import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AppColors } from '../../theme/colors';
import { apiClient } from '../../services/apiClient';
import { ApiEndpoints } from '../../constants/api';
import { AppEnvironment } from '../../config/environment';

function absUrl(path?: string | null) {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  const origin = AppEnvironment.baseUrl.replace(/\/api\/?$/, '');
  return `${origin}${path.startsWith('/') ? path : `/${path}`}`;
}

function roleLabel(role?: string) {
  if (role === 'DRIVER') return 'Delivery Partner / Rider';
  if (role === 'RESTAURANT_OWNER') return 'Restaurant Owner / Chef';
  return role || 'Role';
}

function formatDate(value?: string) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

export const AdminRoleApplicationsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [items, setItems] = useState<any[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState<'PENDING' | 'ALL'>('PENDING');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (pull = false) => {
      if (pull) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const url =
          statusFilter === 'PENDING'
            ? `${ApiEndpoints.admin.roleApplications}?status=PENDING`
            : ApiEndpoints.admin.roleApplications;
        const [res, pendingRes] = await Promise.all([
          apiClient.get<any>(url),
          statusFilter === 'PENDING'
            ? Promise.resolve(null)
            : apiClient.get<any>(`${ApiEndpoints.admin.roleApplications}?status=PENDING`),
        ]);
        const data = res.data?.data ?? res.data;
        const list = Array.isArray(data) ? data : [];
        setItems(list);
        if (statusFilter === 'PENDING') {
          setPendingCount(list.length);
        } else {
          const pendingData = pendingRes?.data?.data ?? pendingRes?.data;
          setPendingCount(Array.isArray(pendingData) ? pendingData.length : 0);
        }
      } catch (e: any) {
        const msg =
          e?.response?.data?.message ||
          e?.message ||
          'Could not load role applications';
        setError(msg);
        setItems([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [statusFilter]
  );

  useEffect(() => {
    load();
  }, [load]);

  const approve = (id: number) => {
    Alert.alert('Approve application?', 'User will receive the requested role immediately.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Approve',
        onPress: async () => {
          try {
            await apiClient.post(ApiEndpoints.admin.approveRoleApplication(id), {});
            Alert.alert('Approved', 'Role granted.');
            load(true);
          } catch (e: any) {
            Alert.alert('Failed', e?.response?.data?.message || e?.message);
          }
        },
      },
    ]);
  };

  const reject = (id: number) => {
    Alert.alert('Reject application?', 'User will stay on Citizen mode.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiClient.post(ApiEndpoints.admin.rejectRoleApplication(id), {
              adminNotes: 'Rejected by admin',
            });
            load(true);
          } catch (e: any) {
            Alert.alert('Failed', e?.response?.data?.message || e?.message);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Text style={styles.headerTitle}>Role Applications</Text>
            {pendingCount > 0 ? (
              <View style={styles.headerBadge}>
                <Text style={styles.headerBadgeText}>{pendingCount > 99 ? '99+' : pendingCount}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.headerSub}>
            {pendingCount > 0
              ? `${pendingCount} waiting for approval — approve to grant role`
              : 'Citizen requests for Rider or Hotel Owner — approve to grant role'}
          </Text>
        </View>
      </View>

      <View style={styles.tabBar}>
        {(['PENDING', 'ALL'] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tabItem, statusFilter === t && styles.tabItemActive]}
            onPress={() => setStatusFilter(t)}
          >
            <Text style={[styles.tabText, statusFilter === t && styles.tabTextActive]}>{t}</Text>
            {t === 'PENDING' && pendingCount > 0 ? (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{pendingCount > 99 ? '99+' : pendingCount}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={AppColors.primary} />
          <Text style={styles.empty}>Loading applications…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={42} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => load()}>
            <Text style={styles.btnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor={AppColors.primary}
            />
          }
        >
          {items.length === 0 ? (
            <View style={styles.center}>
              <Ionicons name="checkmark-done-outline" size={42} color={AppColors.textSecondary} />
              <Text style={styles.empty}>
                {statusFilter === 'PENDING'
                  ? 'No pending applications right now.'
                  : 'No role applications yet.'}
              </Text>
              <Text style={styles.hint}>
                When a citizen applies from Profile → Become Rider / Open Hotel, their name, phone,
                documents, and vehicle or hotel details appear here for Approve / Reject.
              </Text>
            </View>
          ) : (
            items.map((a) => {
              const docUrl = absUrl(a.licenseImageUrl || a.businessDocumentImageUrl);
              return (
                <View key={a.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>
                        {a.userName || 'Citizen'} • {a.userMobile || '—'}
                      </Text>
                      <Text style={styles.role}>{roleLabel(a.requestedRole)}</Text>
                      <Text style={styles.submitted}>Submitted {formatDate(a.createdAt)}</Text>
                    </View>
                    <View
                      style={[
                        styles.statusPill,
                        a.status === 'APPROVED' && styles.statusApproved,
                        a.status === 'REJECTED' && styles.statusRejected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          a.status === 'APPROVED' && { color: '#10B981' },
                          a.status === 'REJECTED' && { color: '#EF4444' },
                        ]}
                      >
                        {a.status}
                      </Text>
                    </View>
                  </View>

                  {a.requestedRole === 'DRIVER' ? (
                    <Text style={styles.meta}>
                      License: {a.licenseNumber || '—'}
                      {'\n'}
                      Vehicle: {a.vehicleType || '—'} • {a.vehicleRegistrationNumber || '—'}
                      {(a.vehicleMake || a.vehicleModel)
                        ? `\n${[a.vehicleMake, a.vehicleModel].filter(Boolean).join(' ')}`
                        : ''}
                    </Text>
                  ) : (
                    <Text style={styles.meta}>
                      {a.hotelName || 'Hotel'}
                      {'\n'}
                      {[a.hotelCity, a.hotelPhone].filter(Boolean).join(' • ') || '—'}
                      {a.hotelAddress ? `\n${a.hotelAddress}` : ''}
                    </Text>
                  )}

                  {a.applicantNotes ? (
                    <Text style={styles.notes}>Notes: {a.applicantNotes}</Text>
                  ) : null}

                  {docUrl ? (
                    <TouchableOpacity onPress={() => Linking.openURL(docUrl)}>
                      <Text style={styles.docLink}>View uploaded document</Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={styles.meta}>No document link available</Text>
                  )}

                  {a.status === 'PENDING' ? (
                    <View style={styles.actions}>
                      <TouchableOpacity style={styles.rejectBtn} onPress={() => reject(a.id)}>
                        <Text style={styles.btnText}>Reject</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.approveBtn} onPress={() => approve(a.id)}>
                        <Text style={styles.btnText}>Approve</Text>
                      </TouchableOpacity>
                    </View>
                  ) : a.reviewedByAdminName || a.adminNotes ? (
                    <Text style={styles.notes}>
                      Reviewed by {a.reviewedByAdminName || 'admin'}
                      {a.adminNotes ? ` — ${a.adminNotes}` : ''}
                    </Text>
                  ) : null}
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: AppColors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: AppColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.border,
  },
  backBtn: { padding: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFF' },
  headerBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  headerBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '800' },
  headerSub: { fontSize: 11, color: AppColors.textSecondary, marginTop: 2 },
  tabBadge: {
    marginLeft: 6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  tabBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '800' },
  tabBar: { flexDirection: 'row', backgroundColor: AppColors.surface },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  tabItemActive: { borderBottomWidth: 2, borderBottomColor: AppColors.primary },
  tabText: { color: AppColors.textSecondary, fontWeight: '700' },
  tabTextActive: { color: AppColors.primary },
  center: { alignItems: 'center', justifyContent: 'center', padding: 40 },
  empty: { color: AppColors.textSecondary, marginTop: 10, textAlign: 'center', fontWeight: '600' },
  hint: {
    color: AppColors.textTertiary,
    marginTop: 10,
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
  },
  errorText: { color: '#EF4444', marginTop: 10, textAlign: 'center', paddingHorizontal: 12 },
  retryBtn: {
    marginTop: 14,
    backgroundColor: AppColors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  scroll: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: AppColors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  name: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  role: { color: AppColors.primary, fontWeight: '700', marginTop: 2 },
  submitted: { color: AppColors.textTertiary, fontSize: 11, marginTop: 4 },
  statusPill: {
    backgroundColor: '#F59E0B20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusApproved: { backgroundColor: '#10B98120' },
  statusRejected: { backgroundColor: '#EF444420' },
  statusText: { color: '#F59E0B', fontSize: 11, fontWeight: '800' },
  meta: { color: AppColors.textSecondary, fontSize: 12, marginTop: 10, lineHeight: 18 },
  notes: { color: AppColors.textTertiary, fontSize: 12, marginTop: 8, fontStyle: 'italic' },
  docLink: { color: '#60A5FA', marginTop: 10, fontWeight: '700', fontSize: 13 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  rejectBtn: {
    flex: 1,
    backgroundColor: '#EF4444',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  approveBtn: {
    flex: 1,
    backgroundColor: '#10B981',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnText: { color: '#FFF', fontWeight: '800' },
});
