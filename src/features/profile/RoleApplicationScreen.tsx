import React, { useMemo, useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { AppColors } from '../../theme/colors';
import { apiClient } from '../../services/apiClient';
import { documentService } from '../../services/documentService';
import { ApiEndpoints } from '../../constants/api';
import { FormKeyboardAvoid } from '../../components/common/FormKeyboardAvoid';

type RoleKind = 'DRIVER' | 'RESTAURANT_OWNER';

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

  const title = useMemo(
    () => (isDriver ? 'Become a Rider / Captain' : 'Open a Hotel / Restaurant'),
    [isDriver]
  );

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
      Alert.alert('Document required', isDriver ? 'Please upload your driving license photo.' : 'Please upload business / FSSAI document.');
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
        'Your application is pending admin approval. You will get the role after approval.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (e: any) {
      Alert.alert('Could not submit', e?.response?.data?.message || e?.message || 'Try again');
    } finally {
      setSubmitting(false);
    }
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
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.intro}>
          Default mode is Citizen. Admin must approve this request before the new role is added to your
          account. Marketplace selling does not need approval — anyone can list items.
        </Text>

        {isDriver ? (
          <>
            <Text style={styles.label}>Driving License Number *</Text>
            <TextInput style={styles.input} value={licenseNumber} onChangeText={setLicenseNumber} autoCapitalize="characters" placeholder="e.g. RJ-14201100XXXX" placeholderTextColor="#777" />

            <Text style={styles.label}>Vehicle Type *</Text>
            <View style={styles.chipRow}>
              {(['BIKE', 'AUTO', 'CAB'] as const).map((t) => (
                <TouchableOpacity key={t} style={[styles.chip, vehicleType === t && styles.chipActive]} onPress={() => setVehicleType(t)}>
                  <Text style={[styles.chipText, vehicleType === t && styles.chipTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Vehicle Registration *</Text>
            <TextInput style={styles.input} value={vehicleReg} onChangeText={setVehicleReg} autoCapitalize="characters" placeholder="RJ14AB1234" placeholderTextColor="#777" />

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Make</Text>
                <TextInput style={styles.input} value={vehicleMake} onChangeText={setVehicleMake} placeholder="Hero" placeholderTextColor="#777" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Model</Text>
                <TextInput style={styles.input} value={vehicleModel} onChangeText={setVehicleModel} placeholder="Splendor" placeholderTextColor="#777" />
              </View>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.label}>Hotel / Restaurant Name *</Text>
            <TextInput style={styles.input} value={hotelName} onChangeText={setHotelName} placeholder="Spice Hub" placeholderTextColor="#777" />
            <Text style={styles.label}>Address *</Text>
            <TextInput style={[styles.input, { minHeight: 70 }]} value={hotelAddress} onChangeText={setHotelAddress} multiline placeholder="Full address" placeholderTextColor="#777" />
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>City</Text>
                <TextInput style={styles.input} value={hotelCity} onChangeText={setHotelCity} placeholder="Jaipur" placeholderTextColor="#777" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Phone *</Text>
                <TextInput style={styles.input} value={hotelPhone} onChangeText={setHotelPhone} keyboardType="phone-pad" placeholder="98XXXXXXXX" placeholderTextColor="#777" />
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
        <TextInput style={[styles.input, { minHeight: 70 }]} value={notes} onChangeText={setNotes} multiline placeholder="Anything admin should know" placeholderTextColor="#777" />

        <TouchableOpacity style={[styles.submitBtn, submitting && { opacity: 0.7 }]} onPress={handleSubmit} disabled={submitting || uploading}>
          {submitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitText}>Submit for Admin Approval</Text>}
        </TouchableOpacity>
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
