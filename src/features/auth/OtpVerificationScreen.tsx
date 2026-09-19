import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppColors } from '../../theme/colors';
import { AppRadius } from '../../theme/spacing';
import { AppConstants } from '../../constants/app';
import { AppButton } from '../../components/common/AppButton';
import { useAuthStore } from '../../store/authStore';

interface OtpVerificationScreenProps {
  route: {
    params: {
      mobileNumber: string;
      isNewUser?: boolean;
      isAdmin?: boolean;
      devOtp?: string;
    };
  };
  navigation: any;
}

export const OtpVerificationScreen: React.FC<OtpVerificationScreenProps> = ({
  route,
  navigation,
}) => {
  const {
    mobileNumber,
    isNewUser = false,
    isAdmin = false,
    devOtp: initialDevOtp,
  } = route.params;

  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [fullName, setFullName] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [displayedOtp, setDisplayedOtp] = useState<string | undefined>(initialDevOtp);
  const [isLoading, setIsLoading] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState<number>(AppConstants.otpTimeoutSeconds);

  const verifyOtp = useAuthStore((state) => state.verifyOtp);
  const adminLogin = useAuthStore((state) => state.adminLogin);
  const sendOtp = useAuthStore((state) => state.sendOtp);

  const inputRefs = useRef<Array<TextInput | null>>([]);

  useEffect(() => {
    if (isAdmin || timerSeconds <= 0) return;
    const interval = setInterval(() => {
      setTimerSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [timerSeconds, isAdmin]);

  const handleDigitChange = (value: string, index: number) => {
    const clean = value.replace(/\D/g, '');
    const newDigits = [...otpDigits];

    if (clean.length > 1) {
      const pasted = clean.slice(0, 6).split('');
      pasted.forEach((digit, i) => {
        if (i < 6) newDigits[i] = digit;
      });
      setOtpDigits(newDigits);
      const nextFocus = Math.min(pasted.length, 5);
      inputRefs.current[nextFocus]?.focus();
      return;
    }

    newDigits[index] = clean;
    setOtpDigits(newDigits);

    if (clean.length > 0 && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otpDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleAdminLogin = async () => {
    if (!adminPassword.trim()) {
      Alert.alert('Password Required', 'Please enter admin password');
      return;
    }

    const fullOtp = otpDigits.join('');
    if (fullOtp.length < AppConstants.otpLength) {
      Alert.alert('Incomplete OTP', 'Please enter complete 6-digit OTP');
      return;
    }

    setIsLoading(true);
    try {
      await adminLogin(mobileNumber, adminPassword.trim(), fullOtp);
      navigation.reset({
        index: 0,
        routes: [{ name: 'AdminPortal' }],
      });
    } catch (err: any) {
      Alert.alert('Login Failed', err.message || 'Invalid admin credentials or OTP');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async () => {
    const fullOtp = otpDigits.join('');
    if (fullOtp.length < AppConstants.otpLength) {
      Alert.alert('Incomplete', 'Please enter complete 6-digit OTP');
      return;
    }

    const resolvedName = fullName.trim() || (isNewUser ? 'Guest User' : undefined);

    setIsLoading(true);
    try {
      await verifyOtp(mobileNumber, fullOtp, isNewUser ? resolvedName : undefined);
      navigation.reset({
        index: 0,
        routes: [{ name: 'MainTabs' }],
      });
    } catch (err: any) {
      Alert.alert('Verification Failed', err.message || 'Invalid or expired OTP');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      const response = await sendOtp(mobileNumber);
      setDisplayedOtp(response.devOtp);
      setOtpDigits(['', '', '', '', '', '']);
      setTimerSeconds(AppConstants.otpTimeoutSeconds);
      Alert.alert('Success', response.devOtp ? `New OTP: ${response.devOtp}` : 'OTP resent successfully');
    } catch (err: any) {
      setTimerSeconds(AppConstants.otpTimeoutSeconds);
      Alert.alert('Notice', err.message || 'Could not resend OTP');
    }
  };

  const formatTimer = () => {
    const mins = Math.floor(timerSeconds / 60)
      .toString()
      .padStart(2, '0');
    const secs = (timerSeconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
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
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <Text style={styles.title}>{isAdmin ? 'Admin Authentication' : 'Verify OTP'}</Text>
          <Text style={styles.subtitle}>
            {isAdmin
              ? `Enter password & OTP sent to +91 ${mobileNumber}`
              : (
                <>
                  Enter the OTP sent to <Text style={styles.phoneHighlight}>+91 {mobileNumber}</Text>
                </>
              )}
          </Text>

          {displayedOtp ? (
            <Text style={styles.devOtpHint}>Test OTP: {displayedOtp}</Text>
          ) : null}

          {isAdmin ? (
            <>
              <View style={styles.extraInputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color={AppColors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.extraInput}
                  placeholder="Admin Password"
                  placeholderTextColor={AppColors.textHint}
                  secureTextEntry
                  value={adminPassword}
                  onChangeText={setAdminPassword}
                  autoFocus
                />
              </View>

              <Text style={[styles.subtitle, { marginTop: 12, marginBottom: 8 }]}>Enter 6-digit OTP:</Text>
              <View style={styles.otpRow}>
                {otpDigits.map((digit, idx) => (
                  <TextInput
                    key={idx}
                    ref={(el) => {
                      inputRefs.current[idx] = el;
                    }}
                    style={[
                      styles.otpBox,
                      digit ? styles.otpBoxFilled : null,
                    ]}
                    keyboardType="number-pad"
                    maxLength={1}
                    value={digit}
                    onChangeText={(val) => handleDigitChange(val, idx)}
                    onKeyPress={(e) => handleKeyPress(e, idx)}
                    textAlign="center"
                  />
                ))}
              </View>

              <View style={styles.resendContainer}>
                {timerSeconds > 0 ? (
                  <Text style={styles.timerText}>
                    Resend OTP in <Text style={styles.timerCountdown}>{formatTimer()}</Text>
                  </Text>
                ) : (
                  <TouchableOpacity onPress={handleResend}>
                    <Text style={styles.resendAction}>Resend OTP</Text>
                  </TouchableOpacity>
                )}
              </View>

              <AppButton
                text="Verify & Login to Admin Portal"
                onPressed={handleAdminLogin}
                isLoading={isLoading}
                style={styles.verifyButton}
              />
            </>
          ) : (
            <>
              {isNewUser && (
                <View style={styles.extraInputContainer}>
                  <Ionicons name="person-outline" size={20} color={AppColors.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.extraInput}
                    placeholder="Full Name"
                    placeholderTextColor={AppColors.textHint}
                    value={fullName}
                    onChangeText={setFullName}
                  />
                </View>
              )}

              <View style={styles.otpRow}>
                {otpDigits.map((digit, idx) => (
                  <TextInput
                    key={idx}
                    ref={(el) => {
                      inputRefs.current[idx] = el;
                    }}
                    style={[
                      styles.otpBox,
                      digit ? styles.otpBoxFilled : null,
                    ]}
                    keyboardType="number-pad"
                    maxLength={1}
                    value={digit}
                    onChangeText={(val) => handleDigitChange(val, idx)}
                    onKeyPress={(e) => handleKeyPress(e, idx)}
                    textAlign="center"
                  />
                ))}
              </View>

              <View style={styles.resendContainer}>
                {timerSeconds > 0 ? (
                  <Text style={styles.timerText}>
                    Resend OTP in <Text style={styles.timerCountdown}>{formatTimer()}</Text>
                  </Text>
                ) : (
                  <TouchableOpacity onPress={handleResend}>
                    <Text style={styles.resendAction}>Resend OTP</Text>
                  </TouchableOpacity>
                )}
              </View>

              <AppButton
                text="Verify & Continue"
                onPressed={handleVerify}
                isLoading={isLoading}
                style={styles.verifyButton}
              />
            </>
          )}
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
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: AppColors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    marginBottom: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: AppColors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: AppColors.textSecondary,
    marginBottom: 6,
  },
  phoneHighlight: {
    color: AppColors.textPrimary,
    fontWeight: '700',
  },
  devOtpHint: {
    fontSize: 14,
    color: AppColors.secondary,
    fontWeight: '700',
    marginBottom: 28,
    marginTop: 8,
  },
  extraInputContainer: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.surfaceLight,
    borderRadius: AppRadius.md,
    borderWidth: 1,
    borderColor: AppColors.border,
    paddingHorizontal: 16,
    marginBottom: 16,
    marginTop: 16,
  },
  inputIcon: {
    marginRight: 10,
  },
  extraInput: {
    flex: 1,
    color: AppColors.textPrimary,
    fontSize: 15,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    marginTop: 8,
  },
  otpBox: {
    width: 48,
    height: 56,
    backgroundColor: AppColors.surfaceLight,
    borderRadius: AppRadius.md,
    borderWidth: 1.5,
    borderColor: AppColors.border,
    color: AppColors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
  },
  otpBoxFilled: {
    borderColor: AppColors.primary,
  },
  resendContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  timerText: {
    color: AppColors.textSecondary,
    fontSize: 14,
  },
  timerCountdown: {
    color: AppColors.primary,
    fontWeight: '700',
  },
  resendAction: {
    color: AppColors.primary,
    fontWeight: '700',
    fontSize: 14,
  },
  verifyButton: {
    marginTop: 8,
  },
});
