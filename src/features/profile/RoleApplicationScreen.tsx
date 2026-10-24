import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { AppColors } from '../../theme/colors';
import { apiClient } from '../../services/apiClient';
import { documentService } from '../../services/documentService';
import { ApiEndpoints } from '../../constants/api';
import { FormKeyboardAvoid } from '../../components/common/FormKeyboardAvoid';

type RoleKind = 'DRIVER' | 'RESTAURANT_OWNER';

type RoleApp = {
  id: number;
  requestedRole?: string;
  status?: string;
  licenseNumber?: string;
  vehicleType?: string;
  vehicleRegistrationNumber?: string;
  vehicleMake?: string;
  vehicleModel?: string;
  hotelName?: string;
  hotelAddress?: string;
  hotelCity?: string;
  hotelPhone?: string;
  applicantNotes?: string;
  adminNotes?: string;
  reviewedByAdminName?: string;
  reviewedAt?: string;
  createdAt?: string;
};

function statusMeta(status?: string) {
  const s = (status || '').toUpperCase();
  if (s === 'PENDING') {
    return {
      label: 'Pending review',
      color: '#F59E0B',
      bg: '#F59E0B22',
      icon: 'time-outline' as const,
      hint: 'Admin is reviewing your application. You will get a notification when it is decided.',
    };
  }
  if (s === 'APPROVED') {
    return {
      label: 'Approved',
      color: '#10B981',
      bg: '#10B98122',
      icon: 'checkmark-circle-outline' as const,
      hint: 'Role granted. Open Profile and switch role to start using it.',
    };
  }
  if (s === 'REJECTED') {
    return {
      label: 'Rejected',
      color: '#EF4444',
      bg: '#EF444422',
      icon: 'close-circle-outline' as const,
      hint: 'You can fix details and submit a new application below.',
    };
  }
  if (s === 'CANCELLED') {
    return {
      label: 'Cancelled',
      color: '#94A3B8',
      bg: '#94A3B822',
      icon: 'ban-outline' as const,
      hint: 'You cancelled this application. Submit again anytime.',
    };
  }
  return {
    label: status || 'Unknown',
    color: AppColors.textSecondary,
    bg: AppColors.surface,
    icon: 'help-circle-outline' as const,
    hint: '',
  };
}

function formatDate(value?: string) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

export const RoleApplicationScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'RoleApplication'>>();
  const requestedRole: RoleKind = route.params?.role === 'RESTAURANT_OWNER' ? 'RESTAURANT_OWNER' : 'DRIVER';
  const isDriver = requestedRole === 'DRIVER';

  const [licenseNumber, setLicenseNumber] = useState('');
  const [vehicleType, setVehicleType] = useState<'BIKE' | 'AUTO' | 'CAB'>('BIKE');
  const [vehicleReg, setVehicleReg] = useState('');
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [hotelName, setHotelName] = useState('');
  const [hotelAddress, setHotelAddress] = useState('');
  const [hotelCity, setHotelCity] = useState('');
  const [hotelPhone, setHotelPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [docUri, setDocUri] = useState<string | null>(null);
  const [docNo, setDocNo] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadingApp, setLoadingApp] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [apps, setApps] = useState<RoleApp[]>([]);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const title = useMemo(
    () => (isDriver ? 'Become a Rider / Captain' : 'Open a Hotel / Cafe'),
    [isDriver]
  );

  const loadMine = useCallback(
    async (pull = false) => {
      if (pull) setRefreshing(true);
      else setLoadingApp(true);
      setLoadError(null);
      try {
        const res = await apiClient.get<any>(ApiEndpoints.roleApplications.mine);
        const data = res?.data?.data ?? res?.data;
        const list: RoleApp[] = Array.isArray(data) ? data : [];
        const forRole = list
          .filter((a) => String(a.requestedRole || '').toUpperCase() === requestedRole)
          .sort((a, b) => {
            const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return tb - ta;
          });
        setApps(forRole);
        // Prefill license from latest driver app when adding another vehicle
        if (isDriver) {
          const withLicense = forRole.find((a) => a.licenseNumber);
          if (withLicense?.licenseNumber) {
            setLicenseNumber((prev) => prev || withLicense.licenseNumber || '');
          }
        }
      } catch (e: any) {
        setLoadError(e?.response?.data?.message || e?.message || 'Could not load application status');
      } finally {
        setLoadingApp(false);
        setRefreshing(false);
      }
    },
    [requestedRole, isDriver]
  );

  useFocusEffect(
    useCallback(() => {
      loadMine();
    }, [loadMine])
  );

  const hasApproved = apps.some((a) => String(a.status || '').toUpperCase() === 'APPROVED');
  const pendingCount = apps.filter((a) => String(a.status || '').toUpperCase() === 'PENDING').length;
  const formTitle = isDriver
    ? hasApproved
      ? 'Add another vehicle'
      : 'Submit rider application'
    : hasApproved
    ? 'Add another hotel / cafe'
    : 'Submit outlet application';

  const pickDocument = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Please allow photo library access to upload documents.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;

    setDocUri(result.assets[0].uri);
    setUploading(true);
    try {
      const uploaded = await documentService.upload(
        result.assets[0].uri,
        isDriver ? 'driving-license.jpg' : 'business-document.jpg'
      );
      setDocNo(uploaded.documentNo);
    } catch (e: any) {
      setDocUri(null);
      setDocNo(null);
      Alert.alert('Upload failed', e?.message || 'Could not upload document');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!docNo) {
      Alert.alert(
        'Document required',
        isDriver ? 'Please upload your driving license photo.' : 'Please upload business / FSSAI document.'
      );
      return;
    }
    setSubmitting(true);
    try {
      const body = isDriver
        ? {
            requestedRole: 'DRIVER',
            licenseNumber: licenseNumber.trim(),
            licenseDocumentNo: docNo,
            vehicleType,
            vehicleRegistrationNumber: vehicleReg.trim(),
            vehicleMake: vehicleMake.trim() || undefined,
            vehicleModel: vehicleModel.trim() || undefined,
            applicantNotes: notes.trim() || undefined,
          }
        : {
            requestedRole: 'RESTAURANT_OWNER',
            hotelName: hotelName.trim(),
            hotelAddress: hotelAddress.trim(),
            hotelCity: hotelCity.trim() || undefined,
            hotelPhone: hotelPhone.trim(),
            businessDocumentNo: docNo,
            applicantNotes: notes.trim() || undefined,
          };

      await apiClient.post(ApiEndpoints.roleApplications.submit, body);
      Alert.alert(
        'Submitted',
        isDriver
          ? 'Vehicle application is pending admin approval. You can add more vehicles after this one is reviewed, or cancel and resubmit.'
          : 'Outlet application is pending admin approval. You can add another hotel/cafe after review, or cancel this one.'
      );
      setVehicleReg('');
      setVehicleMake('');
      setVehicleModel('');
      setHotelName('');
      setHotelAddress('');
      setHotelCity('');
      setHotelPhone('');
      setNotes('');
      setDocUri(null);
      setDocNo(null);
      await loadMine();
    } catch (e: any) {
      Alert.alert('Could not submit', e?.response?.data?.message || e?.message || 'Try again');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = (appId: number) => {
    Alert.alert('Cancel application?', 'You can submit again later from this same screen.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel application',
        style: 'destructive',
        onPress: async () => {
          setCancellingId(appId);
          try {
            await apiClient.post(ApiEndpoints.roleApplications.cancel(appId), {});
            Alert.alert('Cancelled', 'Your application was cancelled.');
            await loadMine();
          } catch (e: any) {
            Alert.alert('Could not cancel', e?.response?.data?.message || e?.message || 'Try again');
          } finally {
            setCancellingId(null);
          }
        },
      },
    ]);
  };

  const vehicleLabel = (t?: string) => {
    const v = String(t || '').toUpperCase();
    if (v === 'BIKE') return 'Bike / Scooty';
    if (v === 'AUTO') return 'Auto';
    if (v === 'CAB') return 'Car / Taxi';
    return t || 'Vehicle';
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={{ width: 32 }} />
      </View>

      <FormKeyboardAvoid>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadMine(true)}
              tintColor={AppColors.primary}
            />
          }
        >
          <Text style={styles.intro}>
            {isDriver
              ? 'Apply for Bike/Scooty, Auto, or Car/Taxi. Already approved? Submit again to add another vehicle — admin must approve each one.'
              : 'Apply for a hotel, restaurant, or cafe. Already have one outlet? Submit again to add another — admin must approve each outlet.'}
          </Text>

          {loadingApp ? (
            <View style={styles.statusLoading}>
              <ActivityIndicator color={AppColors.primary} />
              <Text style={styles.statusLoadingText}>Checking your applications…</Text>
            </View>
          ) : loadError ? (
            <View style={styles.statusCard}>
              <Text style={styles.errorText}>{loadError}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={() => loadMine()}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : apps.length > 0 ? (
            <View style={styles.appsList}>
              <Text style={styles.appsListTitle}>
                Your applications{pendingCount > 0 ? ` · ${pendingCount} pending` : ''}
              </Text>
              {apps.map((app) => {
                const st = String(app.status || '').toUpperCase();
                const m = statusMeta(st);
                return (
                  <View
                    key={app.id}
                    style={[styles.statusCard, { borderColor: m.color + '55', backgroundColor: m.bg }]}
                  >
                    <View style={styles.statusHeader}>
                      <Ionicons name={m.icon} size={20} color={m.color} />
                      <Text style={[styles.statusLabel, { color: m.color }]}>{m.label}</Text>
                    </View>
                    {isDriver ? (
                      <Text style={styles.summaryLine}>
                        {vehicleLabel(app.vehicleType)}
                        {app.vehicleRegistrationNumber ? ` · ${app.vehicleRegistrationNumber}` : ''}
                      </Text>
                    ) : (
                      <Text style={styles.summaryLine}>{app.hotelName || 'Outlet'}</Text>
                    )}
                    <Text style={styles.statusMeta}>Submitted: {formatDate(app.createdAt)}</Text>
                    {app.adminNotes ? (
                      <Text style={styles.adminNotes}>Admin note: {app.adminNotes}</Text>
                    ) : null}
                    {st === 'PENDING' ? (
                      <TouchableOpacity
                        style={[styles.cancelBtn, cancellingId === app.id && { opacity: 0.7 }]}
                        onPress={() => handleCancel(app.id)}
                        disabled={cancellingId != null}
                      >
                        {cancellingId === app.id ? (
                          <ActivityIndicator color="#FFF" />
                        ) : (
                          <Text style={styles.cancelText}>Cancel</Text>
                        )}
                      </TouchableOpacity>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyStatus}>
              <Ionicons name="document-text-outline" size={20} color={AppColors.textSecondary} />
              <Text style={styles.emptyStatusText}>
                No application yet. Fill the form below to get started.
              </Text>
            </View>
          )}

          <>
              <Text style={styles.reapplyTitle}>{formTitle}</Text>
              {pendingCount >= 5 ? (
                <Text style={styles.adminNotes}>
                  You already have 5 pending requests. Cancel one or wait for admin review before adding more.
                </Text>
              ) : null}

              {isDriver ? (
                <>
                  <Text style={styles.label}>Driving License Number *</Text>
                  <TextInput
                    style={styles.input}
                    value={licenseNumber}
                    onChangeText={setLicenseNumber}
                    autoCapitalize="characters"
                    placeholder="e.g. RJ-14201100XXXX"
                    placeholderTextColor="#777"
                  />

                  <Text style={styles.label}>Vehicle Type *</Text>
                  <View style={styles.chipRow}>
                    {(
                      [
                        { id: 'BIKE' as const, label: 'Bike / Scooty' },
                        { id: 'AUTO' as const, label: 'Auto' },
                        { id: 'CAB' as const, label: 'Car / Taxi' },
                      ] as const
                    ).map((t) => (
                      <TouchableOpacity
                        key={t.id}
                        style={[styles.chip, vehicleType === t.id && styles.chipActive]}
                        onPress={() => setVehicleType(t.id)}
                      >
                        <Text style={[styles.chipText, vehicleType === t.id && styles.chipTextActive]}>
                          {t.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.label}>Vehicle Registration *</Text>
                  <TextInput
                    style={styles.input}
                    value={vehicleReg}
                    onChangeText={setVehicleReg}
                    autoCapitalize="characters"
                    placeholder="RJ14AB1234"
                    placeholderTextColor="#777"
                  />

                  <View style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>Make</Text>
                      <TextInput
                        style={styles.input}
                        value={vehicleMake}
                        onChangeText={setVehicleMake}
                        placeholder="Hero"
                        placeholderTextColor="#777"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>Model</Text>
                      <TextInput
                        style={styles.input}
                        value={vehicleModel}
                        onChangeText={setVehicleModel}
                        placeholder="Splendor"
                        placeholderTextColor="#777"
                      />
                    </View>
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.label}>Hotel / Cafe / Restaurant Name *</Text>
                  <TextInput
                    style={styles.input}
                    value={hotelName}
                    onChangeText={setHotelName}
                    placeholder="Spice Hub Cafe"
                    placeholderTextColor="#777"
                  />
                  <Text style={styles.label}>Outlet Address *</Text>
                  <TextInput
                    style={[styles.input, { minHeight: 70 }]}
                    value={hotelAddress}
                    onChangeText={setHotelAddress}
                    multiline
                    placeholder="Full address"
                    placeholderTextColor="#777"
                  />
                  <View style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>City</Text>
                      <TextInput
                        style={styles.input}
                        value={hotelCity}
                        onChangeText={setHotelCity}
                        placeholder="Jaipur"
                        placeholderTextColor="#777"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>Phone *</Text>
                      <TextInput
                        style={styles.input}
                        value={hotelPhone}
                        onChangeText={setHotelPhone}
                        keyboardType="phone-pad"
                        placeholder="98XXXXXXXX"
                        placeholderTextColor="#777"
                      />
                    </View>
                  </View>
                </>
              )}

              <Text style={styles.label}>{isDriver ? 'License Photo *' : 'Business / FSSAI Document *'}</Text>
              <TouchableOpacity style={styles.uploadBtn} onPress={pickDocument} disabled={uploading}>
                {uploading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="cloud-upload-outline" size={20} color="#FFF" />
                    <Text style={styles.uploadText}>{docNo ? 'Replace document' : 'Upload document photo'}</Text>
                  </>
                )}
              </TouchableOpacity>
              {docUri ? <Image source={{ uri: docUri }} style={styles.preview} /> : null}
              {docNo ? <Text style={styles.docOk}>Uploaded ✓ ({docNo})</Text> : null}

              <Text style={styles.label}>Notes (optional)</Text>
              <TextInput
                style={[styles.input, { minHeight: 70 }]}
                value={notes}
                onChangeText={setNotes}
                multiline
                placeholder="Anything admin should know"
                placeholderTextColor="#777"
              />

              <TouchableOpacity
                style={[styles.submitBtn, (submitting || uploading || pendingCount >= 5) && { opacity: 0.7 }]}
                onPress={handleSubmit}
                disabled={submitting || uploading || pendingCount >= 5}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.submitText}>
                    {isDriver
                      ? hasApproved
                        ? 'Submit Another Vehicle'
                        : 'Submit for Admin Approval'
                      : hasApproved
                      ? 'Submit Another Outlet'
                      : 'Submit for Admin Approval'}
                  </Text>
                )}
              </TouchableOpacity>
          </>
        </ScrollView>
      </FormKeyboardAvoid>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: AppColors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.border,
    backgroundColor: AppColors.surface,
  },
  backBtn: { padding: 4 },
  headerTitle: { color: '#FFF', fontSize: 16, fontWeight: '700', flexShrink: 1, textAlign: 'center' },
  content: { padding: 16, paddingBottom: 40 },
  intro: { color: AppColors.textSecondary, fontSize: 13, lineHeight: 19, marginBottom: 16 },
  statusLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    backgroundColor: AppColors.surface,
    marginBottom: 16,
  },
  statusLoadingText: { color: AppColors.textSecondary, fontSize: 13 },
  appsList: { marginBottom: 12, gap: 10 },
  appsListTitle: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  statusCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  statusHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  statusLabel: { fontSize: 16, fontWeight: '800' },
  statusHint: { color: AppColors.textSecondary, fontSize: 13, lineHeight: 18, marginBottom: 8 },
  statusMeta: { color: '#94A3B8', fontSize: 12, marginTop: 2 },
  adminNotes: { color: '#FCA5A5', fontSize: 13, marginTop: 8, lineHeight: 18 },
  summaryBox: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(148,163,184,0.25)',
    gap: 4,
  },
  summaryLine: { color: '#E2E8F0', fontSize: 13 },
  cancelBtn: {
    marginTop: 14,
    backgroundColor: '#7F1D1D',
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  emptyStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: AppColors.surface,
    marginBottom: 16,
  },
  emptyStatusText: { color: AppColors.textSecondary, fontSize: 13, flex: 1 },
  errorText: { color: '#FCA5A5', fontSize: 13, marginBottom: 8 },
  retryBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#334155',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryText: { color: '#FFF', fontWeight: '700', fontSize: 12 },
  reapplyTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
    marginTop: 4,
  },
  label: { color: AppColors.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 10 },
  input: {
    backgroundColor: AppColors.surface,
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: 10,
    color: '#FFF',
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 14,
  },
  row: { flexDirection: 'row', gap: 10 },
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: AppColors.border,
    backgroundColor: AppColors.surface,
  },
  chipActive: { borderColor: AppColors.primary, backgroundColor: AppColors.primary + '30' },
  chipText: { color: AppColors.textSecondary, fontWeight: '700', fontSize: 12 },
  chipTextActive: { color: AppColors.primary },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#334155',
    paddingVertical: 12,
    borderRadius: 10,
  },
  uploadText: { color: '#FFF', fontWeight: '700' },
  preview: { width: '100%', height: 160, borderRadius: 10, marginTop: 10 },
  docOk: { color: '#10B981', marginTop: 8, fontSize: 12, fontWeight: '600' },
  submitBtn: {
    marginTop: 24,
    backgroundColor: AppColors.primary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  submitText: { color: '#FFF', fontWeight: '800', fontSize: 15 },
});
