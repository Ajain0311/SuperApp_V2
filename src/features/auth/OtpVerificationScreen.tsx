import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
  Animated,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { AppConstants } from '../../constants/app';
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

  const showTestOtp = process.env.EXPO_PUBLIC_SHOW_TEST_OTP !== 'false';
  const defaultTestOtp = process.env.EXPO_PUBLIC_TEST_OTP || '123456';
  const [displayedOtp, setDisplayedOtp] = useState<string | undefined>(
    initialDevOtp || (showTestOtp ? defaultTestOtp : undefined)
  );
  
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [timerSeconds, setTimerSeconds] = useState<number>(AppConstants.otpTimeoutSeconds);

  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [fullName, setFullName] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const verifyOtp = useAuthStore((state) => state.verifyOtp);
  const adminLogin = useAuthStore((state) => state.adminLogin);
  const sendOtp = useAuthStore((state) => state.sendOtp);
  const forgotPassword = useAuthStore((state) => state.forgotPassword);
  const resetPassword = useAuthStore((state) => state.resetPassword);

  const inputRefs = useRef<Array<TextInput | null>>([]);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  useEffect(() => {
    if (timerSeconds <= 0) return;
    const interval = setInterval(() => {
      setTimerSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [timerSeconds]);

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
      setErrorMessage('Please enter your admin password');
      return;
    }

    const fullOtp = otpDigits.join('');
    if (fullOtp.length < AppConstants.otpLength) {
      setErrorMessage('Please enter the complete 6-digit OTP code');
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
      setErrorMessage(err.message || 'Invalid admin credentials or OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async () => {
    setErrorMessage(null);
    const fullOtp = otpDigits.join('');
    if (fullOtp.length < AppConstants.otpLength) {
      setErrorMessage('Please enter the complete 6-digit OTP code');
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
      setErrorMessage(err.message || 'Invalid or expired OTP.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    setErrorMessage(null);
    try {
      let response;
      if (isResettingPassword) {
        response = await forgotPassword(mobileNumber);
      } else {
        response = await sendOtp(mobileNumber);
      }
      const newOtp = response.devOtp || '123456';
      setDisplayedOtp(newOtp);
      setOtpDigits(['', '', '', '', '', '']);
      setTimerSeconds(AppConstants.otpTimeoutSeconds);
      Alert.alert('Success', `New OTP sent: ${newOtp}`);
    } catch (err: any) {
      setTimerSeconds(AppConstants.otpTimeoutSeconds);
      setErrorMessage(err.message || 'Could not resend OTP');
    }
  };

  const handleForgotPasswordInitiate = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const response = await forgotPassword(mobileNumber);
      setIsResettingPassword(true);
      setTimerSeconds(AppConstants.otpTimeoutSeconds);
      setOtpDigits(['', '', '', '', '', '']);
      if (response.devOtp) setDisplayedOtp(response.devOtp);
      Alert.alert('Password Reset', 'A new OTP has been sent. Please enter it along with your new password.');
    } catch (err: any) {
      setErrorMessage(err.message || 'Could not initiate password reset');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPasswordSubmit = async () => {
    setErrorMessage(null);
    if (!newPassword.trim() || !confirmPassword.trim()) {
      setErrorMessage('Please fill in all password fields');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match');
      return;
    }
    const fullOtp = otpDigits.join('');
    if (fullOtp.length < AppConstants.otpLength) {
      setErrorMessage('Please enter the complete 6-digit OTP code');
      return;
    }

    setIsLoading(true);
    try {
      await resetPassword(mobileNumber, fullOtp, newPassword);
      Alert.alert('Success', 'Password reset successfully. Please login with your new password.', [
        { text: 'OK', onPress: () => {
          setIsResettingPassword(false);
          setAdminPassword('');
          setNewPassword('');
          setConfirmPassword('');
          setOtpDigits(['', '', '', '', '', '']);
          handleResend();
        }}
      ]);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to reset password');
    } finally {
      setIsLoading(false);
    }
  };

  const formatTimer = () => {
    const mins = Math.floor(timerSeconds / 60).toString().padStart(2, '0');
    const secs = (timerSeconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  const fullOtpEntered = otpDigits.join('').length === 6;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0B0F19" />
      <LinearGradient
        colors={['#0B0F19', '#1A1D2E', '#0B0F19']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          
          <TouchableOpacity style={styles.backButton} onPress={() => {
            if (isResettingPassword) setIsResettingPassword(false);
            else navigation.goBack();
          }}>
            <Ionicons name="chevron-back" size={20} color="#F8FAFC" />
          </TouchableOpacity>

          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }], width: '100%', alignItems: 'center' }}>
            <View style={styles.cardContainer}>
              <View style={styles.headerBox}>
                <Text style={styles.title}>
                  {isResettingPassword ? 'Reset Password' : isAdmin ? 'Admin Auth' : 'Verify Code'}
                </Text>
                <Text style={styles.subtitle}>
                  {isResettingPassword
                    ? 'Create a new admin password.'
                    : `Sent to `}
                  {!isResettingPassword && (
                    <Text style={styles.phoneHighlight}>+91 {mobileNumber}</Text>
                  )}
                </Text>
              </View>

              {displayedOtp && showTestOtp && (
                <View style={styles.testOtpCard}>
                  <View style={styles.testOtpHeader}>
                    <View style={styles.testOtpBadge}>
                      <Ionicons name="flask" size={12} color="#0F766E" style={{ marginRight: 4 }} />
                      <Text style={styles.testOtpBadgeText}>DEV</Text>
                    </View>
                    <TouchableOpacity style={styles.autoFillBtn} onPress={() => handleAutoFill(displayedOtp)}>
                      <Text style={styles.autoFillBtnText}>Auto-Fill</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.testOtpCode}>{displayedOtp}</Text>
                </View>
              )}

              {errorMessage && (
                <View style={styles.errorBanner}>
                  <Ionicons name="alert-circle" size={16} color="#F87171" style={{ marginRight: 6 }} />
                  <Text style={styles.errorBannerText}>{errorMessage}</Text>
                </View>
              )}

              {isResettingPassword ? (
                <>
                  <View style={styles.inputCard}>
                    <Ionicons name="lock-closed" size={18} color="#475569" style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      placeholder="New Password"
                      placeholderTextColor="#475569"
                      secureTextEntry
                      value={newPassword}
                      onChangeText={(val) => { setErrorMessage(null); setNewPassword(val); }}
                    />
                  </View>
                  <View style={styles.inputCard}>
                    <Ionicons name="lock-closed" size={18} color="#475569" style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      placeholder="Confirm New Password"
                      placeholderTextColor="#475569"
                      secureTextEntry
                      value={confirmPassword}
                      onChangeText={(val) => { setErrorMessage(null); setConfirmPassword(val); }}
                    />
                  </View>
                </>
              ) : isAdmin ? (
                <>
                  <View style={styles.inputCard}>
                    <Ionicons name="shield-checkmark" size={18} color="#475569" style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      placeholder="Admin Password"
                      placeholderTextColor="#475569"
                      secureTextEntry
                      value={adminPassword}
                      onChangeText={(val) => { setErrorMessage(null); setAdminPassword(val); }}
                      autoFocus
                    />
                  </View>
                  <TouchableOpacity onPress={handleForgotPasswordInitiate} style={styles.forgotBtn}>
                    <Text style={styles.forgotBtnText}>Forgot Password?</Text>
                  </TouchableOpacity>
                </>
              ) : isNewUser ? (
                <View style={styles.inputCard}>
                  <Ionicons name="person" size={18} color="#475569" style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="Full Name (Optional)"
                    placeholderTextColor="#475569"
                    value={fullName}
                    onChangeText={(val) => { setErrorMessage(null); setFullName(val); }}
                  />
                </View>
              ) : null}

              <Text style={styles.otpLabel}>{isResettingPassword ? 'Enter OTP' : '6-Digit Code'}</Text>
              
              <View style={styles.otpRow}>
                {otpDigits.map((digit, idx) => (
                  <TextInput
                    key={idx}
                    ref={(el) => { inputRefs.current[idx] = el; }}
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
                    selectionColor="#3B82F6"
                  />
                ))}
              </View>

              <View style={styles.resendContainer}>
                {timerSeconds > 0 ? (
                  <Text style={styles.timerText}>
                    Resend in <Text style={styles.timerCountdown}>{formatTimer()}</Text>
                  </Text>
                ) : (
                  <TouchableOpacity onPress={handleResend} activeOpacity={0.7}>
                    <Text style={styles.resendAction}>Resend OTP</Text>
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity
                style={[styles.continueBtn, (!fullOtpEntered || isLoading) && styles.continueBtnDisabled]}
                onPress={isResettingPassword ? handleResetPasswordSubmit : isAdmin ? handleAdminLogin : handleVerify}
                disabled={!fullOtpEntered || isLoading}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={fullOtpEntered && !isLoading ? ['#2563EB', '#1D4ED8'] : ['#1E293B', '#0F172A']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.continueBtnGradient}
                >
                  {isLoading ? (
                    <Text style={styles.continueBtnText}>Processing...</Text>
                  ) : (
                    <View style={styles.btnContentRow}>
                      <Text style={[styles.continueBtnText, !fullOtpEntered && styles.continueBtnTextDisabled]}>
                        {isResettingPassword ? 'Reset Password' : 'Verify & Continue'}
                      </Text>
                      <Ionicons name="checkmark-done" size={18} color={fullOtpEntered ? '#FFFFFF' : '#475569'} />
                    </View>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0B0F19' },
  container: { flex: 1 },
  scrollContent: { 
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16, 
    paddingVertical: 40 
  },
  backButton: {
    alignSelf: 'flex-start',
    width: 40, height: 40, borderRadius: 20, 
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.08)', 
    marginBottom: 20,
    marginLeft: 8,
  },
  cardContainer: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: 'rgba(30, 41, 59, 0.7)', 
    borderRadius: 24, 
    padding: 24,
    borderWidth: 1, 
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 20 }, 
    shadowOpacity: 0.5, 
    shadowRadius: 30, 
    elevation: 10,
  },
  headerBox: { marginBottom: 24, alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '800', color: '#F8FAFC', marginBottom: 6 },
  subtitle: { fontSize: 13, color: '#94A3B8', textAlign: 'center' },
  phoneHighlight: { color: '#3B82F6', fontWeight: '700' },
  testOtpCard: {
    backgroundColor: 'rgba(13, 148, 136, 0.1)', borderColor: 'rgba(13, 148, 136, 0.3)', borderWidth: 1,
    borderRadius: 16, padding: 12, marginBottom: 20,
  },
  testOtpHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  testOtpBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0F766E', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  testOtpBadgeText: { fontSize: 10, fontWeight: '700', color: '#CCFBF1' },
  autoFillBtn: { backgroundColor: '#14B8A6', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  autoFillBtnText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  testOtpCode: { fontSize: 20, fontWeight: '800', color: '#5EEAD4', letterSpacing: 2, textAlign: 'center' },
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.3)', borderWidth: 1, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10, marginBottom: 20,
  },
  errorBannerText: { flex: 1, color: '#F87171', fontSize: 12, fontWeight: '600' },
  inputCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#0F172A',
    borderRadius: 16, borderWidth: 1, borderColor: '#334155',
    paddingHorizontal: 16, height: 52, marginBottom: 16,
  },
  inputIcon: { marginRight: 10 },
  textInput: { flex: 1, color: '#F8FAFC', fontSize: 15, fontWeight: '500', height: '100%' },
  forgotBtn: { alignSelf: 'flex-end', marginBottom: 16, marginTop: -8 },
  forgotBtnText: { color: '#3B82F6', fontSize: 12, fontWeight: '600' },
  otpLabel: { fontSize: 12, fontWeight: '600', color: '#94A3B8', marginBottom: 12, textAlign: 'center' },
  otpRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24, gap: 6 },
  otpBox: {
    flex: 1, height: 50, backgroundColor: '#0F172A',
    borderRadius: 12, borderWidth: 1, borderColor: '#334155',
    color: '#F8FAFC', fontSize: 20, fontWeight: '700',
  },
  otpBoxFilled: { borderColor: '#3B82F6', backgroundColor: '#0B1120' },
  otpBoxError: { borderColor: '#EF4444', backgroundColor: 'rgba(239, 68, 68, 0.1)' },
  resendContainer: { alignItems: 'center', marginBottom: 24 },
  timerText: { color: '#64748B', fontSize: 12, fontWeight: '500' },
  timerCountdown: { color: '#3B82F6', fontWeight: '700' },
  resendAction: { color: '#3B82F6', fontWeight: '700', fontSize: 13 },
  continueBtn: { borderRadius: 16, overflow: 'hidden' },
  continueBtnDisabled: { opacity: 0.6 },
  continueBtnGradient: { paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  btnContentRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  continueBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.5 },
  continueBtnTextDisabled: { color: '#475569' },
});
