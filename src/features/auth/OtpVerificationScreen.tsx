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
import { AppEnvironment } from '../../config/environment';

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

  const [displayedOtp, setDisplayedOtp] = useState<string | undefined>(initialDevOtp);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [timerSeconds, setTimerSeconds] = useState<number>(AppConstants.otpTimeoutSeconds);

  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [fullName, setFullName] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

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

  const handleAutoFill = (code: string) => {
    const clean = code.trim().replace(/\D/g, '');
    const digits = clean.slice(0, 6).split('');
    while (digits.length < 6) digits.push('');
    setOtpDigits(digits);
    setErrorMessage(null);
    inputRefs.current[Math.min(clean.length - 1, 5)]?.focus();
  };

  const handleDigitChange = (value: string, index: number) => {
    setErrorMessage(null);
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
    setErrorMessage(null);
    if (e.nativeEvent.key === 'Backspace' && !otpDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleAdminLogin = async () => {
    setErrorMessage(null);
    if (!adminPassword.trim()) {
      const msg = 'Please enter your admin password';
      setErrorMessage(msg);
      Alert.alert('Password Required', msg);
      return;
    }

    const fullOtp = otpDigits.join('');
    if (fullOtp.length < AppConstants.otpLength) {
      const msg = 'Please enter the complete 6-digit OTP code';
      setErrorMessage(msg);
      Alert.alert('Incomplete OTP', msg);
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
      const msg = err.message || 'Invalid admin credentials or OTP. Please check and try again.';
      setErrorMessage(msg);
      Alert.alert('Login Failed', msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async () => {
    setErrorMessage(null);
    const fullOtp = otpDigits.join('');
    if (fullOtp.length < AppConstants.otpLength) {
      const msg = 'Please enter the complete 6-digit OTP code';
      setErrorMessage(msg);
      Alert.alert('Incomplete', msg);
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
      const msg = err.message || 'Invalid or expired OTP. Please enter the correct code.';
      setErrorMessage(msg);
      Alert.alert('Verification Failed', msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    setErrorMessage(null);
    try {
      const response = await sendOtp(mobileNumber);
      const newOtp = response.devOtp || '123456';
      setDisplayedOtp(newOtp);
      setOtpDigits(['', '', '', '', '', '']);
      setTimerSeconds(AppConstants.otpTimeoutSeconds);
      Alert.alert('Success', `New OTP sent: ${newOtp}`);
    } catch (err: any) {
      setTimerSeconds(AppConstants.otpTimeoutSeconds);
      const msg = err.message || 'Could not resend OTP';
      setErrorMessage(msg);
      Alert.alert('Notice', msg);
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

          {/* Prominent Inline Error Validation Banner */}
          {errorMessage ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={20} color="#DC2626" style={{ marginRight: 8 }} />
              <Text style={styles.errorBannerText}>{errorMessage}</Text>
            </View>
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
                  onChangeText={(val) => {
                    setErrorMessage(null);
                    setAdminPassword(val);
                  }}
                  autoFocus
                />
              </View>

              <Text style={[styles.subtitle, { marginTop: 8, marginBottom: 8 }]}>Enter 6-digit OTP:</Text>
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
                      errorMessage ? styles.otpBoxError : null,
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
                    onChangeText={(val) => {
                      setErrorMessage(null);
                      setFullName(val);
                    }}
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
                      errorMessage ? styles.otpBoxError : null,
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
    marginBottom: 20,
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
  testOtpCard: {
    backgroundColor: '#F0FDFA',
    borderColor: '#99F6E4',
    borderWidth: 1.5,
    borderRadius: AppRadius.lg,
    padding: 14,
    marginBottom: 16,
    marginTop: 12,
  },
  testOtpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  testOtpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#CCFBF1',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: AppRadius.sm,
  },
  testOtpBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F766E',
    letterSpacing: 0.5,
  },
  autoFillBtn: {
    backgroundColor: '#0D9488',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: AppRadius.sm,
  },
  autoFillBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  testOtpCode: {
    fontSize: 30,
    fontWeight: '900',
    color: '#0F766E',
    letterSpacing: 8,
    marginBottom: 4,
  },
  testOtpHint: {
    fontSize: 12,
    color: '#115E59',
    fontWeight: '500',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
    borderRadius: AppRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
  },
  errorBannerText: {
    flex: 1,
    color: '#B91C1C',
    fontSize: 13,
    fontWeight: '600',
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
    marginTop: 8,
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
  otpBoxError: {
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  resendContainer: {
    alignItems: 'center',
    marginBottom: 24,
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
