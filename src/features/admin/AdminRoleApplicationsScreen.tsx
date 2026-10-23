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

export const AdminRoleApplicationsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [items, setItems] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<'PENDING' | 'ALL'>('PENDING');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (pull = false) => {
    if (pull) setRefreshing(true);
    else setLoading(true);
    try {
      const url =
        statusFilter === 'PENDING'
          ? `${ApiEndpoints.admin.roleApplications}?status=PENDING`
          : ApiEndpoints.admin.roleApplications;
      const res = await apiClient.get<any>(url);
      const data = res.data?.data ?? res.data;
      setItems(Array.isArray(data) ? data : []);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not load applications');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter]);

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
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Role Applications</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.tabBar}>
        {(['PENDING', 'ALL'] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tabItem, statusFilter === t && styles.tabItemActive]}
            onPress={() => setStatusFilter(t)}
          >
            <Text style={[styles.tabText, statusFilter === t && styles.tabTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={AppColors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={AppColors.primary} />}
        >
          {items.length === 0 ? (
            <View style={styles.center}>
              <Ionicons name="checkmark-done-outline" size={42} color={AppColors.textSecondary} />
              <Text style={styles.empty}>No applications in this filter.</Text>
            </View>
          ) : (
            items.map((a) => {
              const docUrl = absUrl(a.licenseImageUrl || a.businessDocumentImageUrl);
              return (
                <View key={a.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{a.userName || 'Citizen'} • {a.userMobile}</Text>
                      <Text style={styles.role}>{a.requestedRole}</Text>
                    </View>
                    <View style={styles.statusPill}>
                      <Text style={styles.statusText}>{a.status}</Text>
                    </View>
                  </View>

                  {a.requestedRole === 'DRIVER' ? (
                    <Text style={styles.meta}>
                      License {a.licenseNumber} • {a.vehicleType} • {a.vehicleRegistrationNumber}
                    </Text>
                  ) : (
                    <Text style={styles.meta}>
                      {a.hotelName} • {a.hotelCity} • {a.hotelPhone}
                      {'\n'}
                      {a.hotelAddress}
                    </Text>
                  )}

                  {docUrl ? (
                    <TouchableOpacity onPress={() => Linking.openURL(docUrl)}>
                      <Text style={styles.docLink}>View uploaded document</Text>
                    </TouchableOpacity>
                  ) : null}

                  {a.status === 'PENDING' ? (
                    <View style={styles.actions}>
                      <TouchableOpacity style={styles.rejectBtn} onPress={() => reject(a.id)}>
                        <Text style={styles.btnText}>Reject</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.approveBtn} onPress={() => approve(a.id)}>
                        <Text style={styles.btnText}>Approve</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: AppColors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 16,
    backgroundColor: AppColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.border,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFF' },
  tabBar: { flexDirection: 'row', backgroundColor: AppColors.surface },
  tabItem: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabItemActive: { borderBottomWidth: 2, borderBottomColor: AppColors.primary },
  tabText: { color: AppColors.textSecondary, fontWeight: '700' },
  tabTextActive: { color: AppColors.primary },
  center: { alignItems: 'center', justifyContent: 'center', padding: 40 },
  empty: { color: AppColors.textSecondary, marginTop: 10 },
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
  statusPill: { backgroundColor: '#F59E0B20', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusText: { color: '#F59E0B', fontSize: 11, fontWeight: '800' },
  meta: { color: AppColors.textSecondary, fontSize: 12, marginTop: 10, lineHeight: 18 },
  docLink: { color: '#60A5FA', marginTop: 10, fontWeight: '700', fontSize: 13 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  rejectBtn: { flex: 1, backgroundColor: '#EF4444', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  approveBtn: { flex: 1, backgroundColor: '#10B981', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  btnText: { color: '#FFF', fontWeight: '800' },
});
