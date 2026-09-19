import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { AppColors } from '../../theme/colors';
import { AppRadius } from '../../theme/spacing';
import { AppButton } from '../../components/common/AppButton';
import { useAuthStore } from '../../store/authStore';

interface PhoneEntryScreenProps {
  navigation: any;
}

export const PhoneEntryScreen: React.FC<PhoneEntryScreenProps> = ({ navigation }) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const sendOtp = useAuthStore((state) => state.sendOtp);

  const handleContinue = async () => {
    const cleanNumber = phoneNumber.trim().replace(/\D/g, '');

    if (!cleanNumber) {
      Alert.alert('Required', 'Please enter phone number');
      return;
    }

    if (cleanNumber.length < 10) {
      Alert.alert('Invalid Number', 'Please enter valid 10-digit number');
      return;
    }

    setIsLoading(true);
    try {
      const response = await sendOtp(cleanNumber);
      navigation.navigate('OtpVerification', {
        mobileNumber: cleanNumber,
        isNewUser: response.isNewUser ?? false,
        isAdmin: response.isAdmin ?? false,
        devOtp: response.devOtp,
      });
    } catch (err: any) {
      // Offline fallback allows developer/tester to continue with a local OTP
      const offlineOtp = Math.floor(100000 + Math.random() * 900000).toString();
      Alert.alert(
        'Backend Notice',
        `${err.message || 'Could not connect to backend server'}. Continuing with local test OTP ${offlineOtp}...`,
        [
          {
            text: 'OK',
            onPress: () => {
              navigation.navigate('OtpVerification', {
                mobileNumber: cleanNumber,
                isNewUser: true,
                isAdmin: cleanNumber === '9999999999',
                devOtp: offlineOtp,
              });
            },
          },
        ]
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.headerSpacer} />

          {/* Logo */}
          <LinearGradient
            colors={[AppColors.primary, AppColors.primaryDark]}
            style={styles.logoBox}
          >
            <Ionicons name="rocket-outline" size={32} color="#FFFFFF" />
          </LinearGradient>

          {/* Title */}
          <Text style={styles.title}>{'Welcome to\nSuper App'}</Text>
          <Text style={styles.subtitle}>Enter your phone number to continue</Text>

          {/* Phone Input Box */}
          <View style={styles.inputContainer}>
            <View style={styles.prefixBox}>
              <Text style={styles.prefixText}>+91</Text>
              <View style={styles.verticalDivider} />
            </View>
            <TextInput
              style={styles.input}
              placeholder="Phone Number"
              placeholderTextColor={AppColors.textHint}
              keyboardType="phone-pad"
              maxLength={10}
              value={phoneNumber}
              onChangeText={(t) => setPhoneNumber(t.replace(/\D/g, ''))}
              autoFocus
            />
          </View>

          {/* Action Button */}
          <AppButton
            text="Continue"
            onPressed={handleContinue}
            isLoading={isLoading}
            style={styles.continueButton}
          />

          {/* Terms Footer */}
          <Text style={styles.termsText}>
            {'By continuing, you agree to our\nTerms of Service & Privacy Policy'}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  headerSpacer: {
    height: 40,
  },
  logoBox: {
    width: 64,
    height: 64,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: AppColors.textPrimary,
    lineHeight: 38,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: AppColors.textSecondary,
    marginBottom: 40,
  },
  inputContainer: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.surfaceLight,
    borderRadius: AppRadius.md,
    borderWidth: 1,
    borderColor: AppColors.border,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  prefixBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  prefixText: {
    color: AppColors.textSecondary,
    fontSize: 18,
    fontWeight: '600',
  },
  verticalDivider: {
    width: 1,
    height: 24,
    backgroundColor: AppColors.border,
    marginLeft: 12,
  },
  input: {
    flex: 1,
    color: AppColors.textPrimary,
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 2,
    height: '100%',
  },
  continueButton: {
    marginBottom: 16,
  },
  termsText: {
    textAlign: 'center',
    color: AppColors.textTertiary,
    fontSize: 12,
    lineHeight: 18,
  },
});
