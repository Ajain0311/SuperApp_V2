import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Platform,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { AppColors } from '../../theme/colors';
import { AppEnvironment } from '../../config/environment';

interface AdminPortalScreenProps {
  navigation: any;
}

export const AdminPortalScreen: React.FC<AdminPortalScreenProps> = ({ navigation }) => {
  const adminUrl = `${AppEnvironment.hubBaseUrl}/admin/`;

  useEffect(() => {
    if (Platform.OS === 'web') {
      // On web, leave the Expo app and open the static admin portal.
      if (typeof window !== 'undefined') {
        window.location.href = adminUrl;
      } else {
        Linking.openURL(adminUrl);
      }
    }
  }, [adminUrl]);

  if (Platform.OS === 'web') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.redirectBox}>
          <Text style={styles.redirectTitle}>Opening Admin Portal…</Text>
          <Text style={styles.redirectUrl}>{adminUrl}</Text>
          <TouchableOpacity style={styles.openButton} onPress={() => Linking.openURL(adminUrl)}>
            <Text style={styles.openButtonText}>Open Admin Portal</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Admin Portal</Text>
        <TouchableOpacity onPress={() => Linking.openURL(adminUrl)}>
          <Ionicons name="open-outline" size={20} color={AppColors.primary} />
        </TouchableOpacity>
      </View>
      <WebView source={{ uri: adminUrl }} style={styles.webview} startInLoadingState />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.border,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: AppColors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: AppColors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  webview: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  redirectBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  redirectTitle: {
    color: AppColors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  redirectUrl: {
    color: AppColors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
  },
  openButton: {
    marginTop: 8,
    backgroundColor: AppColors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  openButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
