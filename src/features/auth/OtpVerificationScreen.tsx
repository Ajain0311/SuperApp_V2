import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Alert,
  ScrollView,
  Animated,
  StatusBar,
  Keyboard,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { AppConstants } from '../../constants/app';
import { useAuthStore } from '../../store/authStore';
import { shadowStyle, USE_NATIVE_DRIVER } from '../../utils/platformStyles';
import { FormKeyboardAvoid } from '../../components/common/FormKeyboardAvoid';

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

  const { width: windowWidth } = useWindowDimensions();
  const showTestOtp = process.env.EXPO_PUBLIC_SHOW_TEST_OTP === 'true' || Boolean(initialDevOtp);
  const defaultTestOtp = process.env.EXPO_PUBLIC_TEST_OTP;
  const [displayedOtp, setDisplayedOtp] = useState<string | undefined>(
    initialDevOtp || (showTestOtp ? defaultTestOtp : undefined)
  );

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [timerSeconds, setTimerSeconds] = useState<number>(AppConstants.otpTimeoutSeconds);

  const [otp, setOtp] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const isSubmittingRef = useRef(false);
  const [fullName, setFullName] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  const verifyOtp = useAuthStore((state) => state.verifyOtp);
  const adminLogin = useAuthStore((state) => state.adminLogin);
  const sendOtp = useAuthStore((state) => state.sendOtp);
  const forgotPassword = useAuthStore((state) => state.forgotPassword);
  const resetPassword = useAuthStore((state) => state.resetPassword);

  const hiddenInputRef = useRef<TextInput | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const otpSectionY = useRef(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  const otpBoxSize = Math.min(48, Math.max(40, Math.floor((windowWidth - 88) / 6) - 6));

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvt, () => {
      setKeyboardOpen(true);
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({
          y: Math.max(0, otpSectionY.current - 16),
          animated: true,
        });
      });
    });
    const hideSub = Keyboard.addListener(hideEvt, () => setKeyboardOpen(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (timerSeconds <= 0) return;
    const interval = setInterval(() => {
      setTimerSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [timerSeconds]);

  const triggerSubmit = (codeToVerify: string) => {
    if (isSubmittingRef.current || codeToVerify.length !== AppConstants.otpLength) {
      return;
    }
    if (isResettingPassword) {
      handleResetPasswordSubmit(codeToVerify);
    } else if (isAdmin) {
      handleAdminLogin(codeToVerify);
    } else {
      handleVerify(codeToVerify);
    }
  };

  const handleOtpChange = (text: string) => {
    setErrorMessage(null);
    const clean = text.replace(/\D/g, '').slice(0, AppConstants.otpLength);
    setOtp(clean);
    if (clean.length === AppConstants.otpLength) {
      triggerSubmit(clean);
    }
  };

  const handleAutoFill = (code: string) => {
    const clean = code.trim().replace(/\D/g, '').slice(0, AppConstants.otpLength);
    setOtp(clean);
    setErrorMessage(null);
    hiddenInputRef.current?.focus();
    if (clean.length === AppConstants.otpLength) {
      triggerSubmit(clean);
    }
  };

  const focusOtpInput = () => {
    hiddenInputRef.current?.focus();
  };

  const handleAdminLogin = async (codeOverride?: string) => {
    const fullOtp = codeOverride ?? otp;
    setErrorMessage(null);
    if (!adminPassword.trim()) {
      setErrorMessage('Please enter your admin password');
      return;
    }

    if (fullOtp.length < AppConstants.otpLength) {
      setErrorMessage('Please enter the complete 6-digit OTP code');
      return;
    }

    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsLoading(true);
    try {
      await adminLogin(mobileNumber, adminPassword.trim(), fullOtp);
      navigation.reset({
        index: 0,
        routes: [{ name: 'AdminPortal' }],
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid admin credentials or OTP. Please check and try again.');
    } finally {
      setIsLoading(false);
      isSubmittingRef.current = false;
    }
  };

  const handleVerify = async (codeOverride?: string) => {
    const fullOtp = codeOverride ?? otp;
    setErrorMessage(null);
    if (fullOtp.length < AppConstants.otpLength) {
      setErrorMessage('Please enter the complete 6-digit OTP code');
      return;
    }

    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    const resolvedName = fullName.trim() || (isNewUser ? 'Guest User' : undefined);

    setIsLoading(true);
    try {
      await verifyOtp(mobileNumber, fullOtp, isNewUser ? resolvedName : undefined);
      navigation.reset({
        index: 0,
        routes: [{ name: 'MainTabs' }],
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid or expired OTP. Please enter the correct code.');
    } finally {
      setIsLoading(false);
      isSubmittingRef.current = false;
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
      if (showTestOtp && response.devOtp) setDisplayedOtp(response.devOtp);
      else setDisplayedOtp(undefined);
      setTimerSeconds(AppConstants.otpTimeoutSeconds);
      Alert.alert('Success', 'A new OTP has been sent to your mobile number.');
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
      setOtp('');
      if (showTestOtp && response.devOtp) setDisplayedOtp(response.devOtp);
      else setDisplayedOtp(undefined);
      Alert.alert('Password Reset', 'A new OTP has been sent. Please enter it along with your new password.');
    } catch (err: any) {
      setErrorMessage(err.message || 'Could not initiate password reset');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (codeOverride?: string) => {
    const fullOtp = codeOverride ?? otp;
    setErrorMessage(null);
    if (!newPassword.trim() || !confirmPassword.trim()) {
      setErrorMessage('Please fill in all password fields');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match');
      return;
    }
    if (fullOtp.length < AppConstants.otpLength) {
      setErrorMessage('Please enter the complete 6-digit OTP code');
      return;
    }

    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsLoading(true);
    try {
      await resetPassword(mobileNumber, fullOtp, newPassword);
      Alert.alert('Success', 'Password reset successfully. Please login with your new password.', [
        {
          text: 'OK',
          onPress: () => {
            setIsResettingPassword(false);
            setAdminPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setOtp('');
            handleResend();
          },
        },
      ]);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to reset password');
    } finally {
      setIsLoading(false);
      isSubmittingRef.current = false;
    }
  };

  const formatTimer = () => {
    const mins = Math.floor(timerSeconds / 60).toString().padStart(2, '0');
    const secs = (timerSeconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  const fullOtpEntered = otp.length === AppConstants.otpLength;
  const progress = otp.length / AppConstants.otpLength;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0E21" />
      <LinearGradient
        colors={['#1E1738', '#141829', '#0A0E21']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.6 }}
        style={StyleSheet.absoluteFill}
      />

      <FormKeyboardAvoid offset={Platform.OS === 'ios' ? 8 : 0}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[
            styles.scrollContent,
            keyboardOpen && styles.scrollContentKeyboard,
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              if (isResettingPassword) setIsResettingPassword(false);
              else navigation.goBack();
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
            <View style={styles.headerBox}>
              <View style={styles.headerIconWrap}>
                <LinearGradient
                  colors={['#FF6B35', '#E55A2B']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.headerIcon}
                >
                  <Ionicons name="chatbubble-ellipses" size={22} color="#FFF" />
                </LinearGradient>
              </View>
              <Text style={styles.title}>
                {isResettingPassword ? 'Reset Password' : isAdmin ? 'Admin Auth' : 'Verify OTP'}
              </Text>
              <Text style={styles.subtitle}>
                {isResettingPassword
                  ? 'Create a new password for your admin account.'
                  : 'We sent a 6-digit code to'}
              </Text>
              {!isResettingPassword ? (
                <View style={styles.phoneRow}>
                  <Text style={styles.phoneHighlight}>+91 {mobileNumber}</Text>
                  <TouchableOpacity
                    style={styles.changeNumberBtn}
                    onPress={() => navigation.goBack()}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="pencil" size={12} color="#FF8A5C" />
                    <Text style={styles.changeNumberText}>Change</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>

            {displayedOtp && showTestOtp ? (
              <View style={styles.testOtpCard}>
                <View style={styles.testOtpHeader}>
                  <View style={styles.testOtpBadge}>
                    <Ionicons name="flask-outline" size={14} color="#CCFBF1" style={{ marginRight: 4 }} />
                    <Text style={styles.testOtpBadgeText}>DEV MODE</Text>
                  </View>
                  <TouchableOpacity style={styles.autoFillBtn} onPress={() => handleAutoFill(displayedOtp)}>
                    <Text style={styles.autoFillBtnText}>Auto-Fill</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.testOtpCode}>TEST OTP: {displayedOtp}</Text>
              </View>
            ) : null}

            {errorMessage ? (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={20} color="#F87171" style={{ marginRight: 8 }} />
                <Text style={styles.errorBannerText}>{errorMessage}</Text>
              </View>
            ) : null}

            <View
              style={styles.cardContainer}
              onLayout={(e) => {
                otpSectionY.current = e.nativeEvent.layout.y;
              }}
            >
              {isResettingPassword ? (
                <>
                  <View style={styles.inputCard}>
                    <Ionicons name="lock-closed-outline" size={20} color="#64748B" style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      placeholder="New Password"
                      placeholderTextColor="#64748B"
                      secureTextEntry
                      value={newPassword}
                      onChangeText={(val) => {
                        setErrorMessage(null);
                        setNewPassword(val);
                      }}
                    />
                  </View>
                  <View style={styles.inputCard}>
                    <Ionicons name="lock-closed-outline" size={20} color="#64748B" style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      placeholder="Confirm New Password"
                      placeholderTextColor="#64748B"
                      secureTextEntry
                      value={confirmPassword}
                      onChangeText={(val) => {
                        setErrorMessage(null);
                        setConfirmPassword(val);
                      }}
                    />
                  </View>
                </>
              ) : isAdmin ? (
                <>
                  <View style={styles.inputCard}>
                    <Ionicons
                      name="shield-checkmark-outline"
                      size={20}
                      color="#64748B"
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.textInput}
                      placeholder="Admin Password"
                      placeholderTextColor="#64748B"
                      secureTextEntry
                      value={adminPassword}
                      onChangeText={(val) => {
                        setErrorMessage(null);
                        setAdminPassword(val);
                      }}
                      autoFocus
                    />
                  </View>
                  <TouchableOpacity onPress={handleForgotPasswordInitiate} style={styles.forgotBtn}>
                    <Text style={styles.forgotBtnText}>Forgot Password?</Text>
                  </TouchableOpacity>
                </>
              ) : isNewUser ? (
                <View style={styles.inputCard}>
                  <Ionicons name="person-outline" size={20} color="#64748B" style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="Your name (optional)"
                    placeholderTextColor="#64748B"
                    value={fullName}
                    onChangeText={(val) => {
                      setErrorMessage(null);
                      setFullName(val);
                    }}
                  />
                </View>
              ) : null}

              <Text style={styles.otpLabel}>
                {isResettingPassword ? 'Enter verification code' : 'Enter 6-digit OTP'}
              </Text>

              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
              </View>

              <TextInput
                ref={hiddenInputRef}
                value={otp}
                onChangeText={handleOtpChange}
                maxLength={AppConstants.otpLength}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="sms-otp"
                importantForAutofill="yes"
                style={styles.hiddenInput}
                autoFocus={!isAdmin}
                onFocus={() => {
                  setIsFocused(true);
                  requestAnimationFrame(() => {
                    scrollRef.current?.scrollTo({
                      y: Math.max(0, otpSectionY.current - 16),
                      animated: true,
                    });
                  });
                }}
                onBlur={() => setIsFocused(false)}
                caretHidden
              />

              <TouchableOpacity
                style={styles.otpRow}
                activeOpacity={1}
                onPress={focusOtpInput}
                accessibilityRole="button"
                accessibilityLabel="OTP digit input fields"
              >
                {Array.from({ length: AppConstants.otpLength }).map((_, idx) => {
                  const digit = otp[idx] || '';
                  const isCurrent =
                    isFocused &&
                    (idx === otp.length ||
                      (idx === AppConstants.otpLength - 1 && otp.length === AppConstants.otpLength));
                  return (
                    <View
                      key={idx}
                      style={[
                        styles.otpBox,
                        { width: otpBoxSize, height: otpBoxSize + 8 },
                        digit ? styles.otpBoxFilled : null,
                        isCurrent ? styles.otpBoxFocused : null,
                        errorMessage ? styles.otpBoxError : null,
                      ]}
                    >
                      <Text style={[styles.otpBoxText, digit ? styles.otpBoxTextFilled : null]}>
                        {digit}
                      </Text>
                      {isCurrent && !digit ? <View style={styles.cursorBar} /> : null}
                    </View>
                  );
                })}
              </TouchableOpacity>

              <View style={styles.resendContainer}>
                {timerSeconds > 0 ? (
                  <Text style={styles.timerText}>
                    Resend code in <Text style={styles.timerCountdown}>{formatTimer()}</Text>
                  </Text>
                ) : (
                  <TouchableOpacity onPress={handleResend} activeOpacity={0.7} style={styles.resendBtn}>
                    <Ionicons name="refresh" size={14} color="#FF6B35" />
                    <Text style={styles.resendAction}>Resend OTP</Text>
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity
                style={[styles.continueBtn, (!fullOtpEntered || isLoading) && styles.continueBtnDisabled]}
                onPress={() =>
                  isResettingPassword
                    ? handleResetPasswordSubmit()
                    : isAdmin
                    ? handleAdminLogin()
                    : handleVerify()
                }
                disabled={!fullOtpEntered || isLoading}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={
                    fullOtpEntered && !isLoading ? ['#FF6B35', '#E55A2B'] : ['#334155', '#1E293B']
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.continueBtnGradient}
                >
                  <View style={styles.btnContentRow}>
                    <Text
                      style={[styles.continueBtnText, !fullOtpEntered && styles.continueBtnTextDisabled]}
                    >
                      {isLoading
                        ? 'Verifying…'
                        : isResettingPassword
                        ? 'Reset Password'
                        : 'Verify & Continue'}
                    </Text>
                    {!isLoading ? (
                      <Ionicons
                        name="checkmark-done"
                        size={20}
                        color={fullOtpEntered ? '#FFFFFF' : '#64748B'}
                      />
                    ) : null}
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {!keyboardOpen ? (
              <Text style={styles.hintText}>
                Tip: SMS autofill may fill the code automatically on some phones.
              </Text>
            ) : null}
          </Animated.View>
        </ScrollView>
      </FormKeyboardAvoid>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0A0E21' },
  scrollContent: { flexGrow: 1, paddingHorizontal: 22, paddingTop: 10, paddingBottom: 40 },
  scrollContentKeyboard: { paddingBottom: 120 },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#141829',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2A2D3E',
    marginBottom: 18,
  },
  headerBox: { marginBottom: 20, alignItems: 'flex-start' },
  headerIconWrap: { marginBottom: 14 },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: { fontSize: 14, color: '#94A3B8', lineHeight: 20 },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  phoneHighlight: { color: '#FF6B35', fontWeight: '800', fontSize: 16 },
  changeNumberBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,107,53,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,107,53,0.28)',
  },
  changeNumberText: { color: '#FF8A5C', fontSize: 12, fontWeight: '700' },
  testOtpCard: {
    backgroundColor: '#0A2020',
    borderColor: '#0D9488',
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  testOtpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  testOtpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F766E',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  testOtpBadgeText: { fontSize: 11, fontWeight: '800', color: '#CCFBF1', letterSpacing: 0.5 },
  autoFillBtn: {
    backgroundColor: '#14b8a6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  autoFillBtnText: { fontSize: 12, fontWeight: '800', color: '#FFFFFF' },
  testOtpCode: { fontSize: 22, fontWeight: '900', color: '#5eead4', letterSpacing: 3 },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
    borderColor: 'rgba(220, 38, 38, 0.3)',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  errorBannerText: { flex: 1, color: '#F87171', fontSize: 13, fontWeight: '600' },
  cardContainer: {
    backgroundColor: '#141829',
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: '#2A2D3E',
    ...shadowStyle({
      color: '#000000',
      offsetY: 10,
      opacity: 0.3,
      radius: 20,
      elevation: 6,
    }),
  },
  inputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A0E21',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#2A2D3E',
    paddingHorizontal: 14,
    minHeight: 56,
    marginBottom: 16,
  },
  inputIcon: { marginRight: 12 },
  textInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
  },
  forgotBtn: { alignSelf: 'flex-end', marginBottom: 16, marginTop: -6 },
  forgotBtnText: { color: '#FF6B35', fontSize: 13, fontWeight: '700' },
  otpLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94A3B8',
    marginBottom: 10,
    textAlign: 'center',
  },
  progressTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: '#1E293B',
    marginBottom: 16,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FF6B35',
    borderRadius: 2,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 6,
  },
  hiddenInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0.01,
  },
  otpBox: {
    backgroundColor: '#0A0E21',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#2A2D3E',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  otpBoxFilled: { borderColor: '#FF6B35', backgroundColor: '#120f1e' },
  otpBoxFocused: {
    borderColor: '#FF6B35',
    ...shadowStyle({ color: '#FF6B35', opacity: 0.3, radius: 4, elevation: 2 }),
  },
  otpBoxError: { borderColor: '#EF4444', backgroundColor: 'rgba(239, 68, 68, 0.1)' },
  otpBoxText: {
    color: '#94A3B8',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  otpBoxTextFilled: {
    color: '#FFFFFF',
  },
  cursorBar: {
    position: 'absolute',
    bottom: 10,
    width: 14,
    height: 2,
    backgroundColor: '#FF6B35',
    borderRadius: 1,
  },
  resendContainer: { alignItems: 'center', marginBottom: 20 },
  timerText: { color: '#64748B', fontSize: 13, fontWeight: '600' },
  timerCountdown: { color: '#FF6B35', fontWeight: '800' },
  resendBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  resendAction: { color: '#FF6B35', fontWeight: '800', fontSize: 14, letterSpacing: 0.3 },
  continueBtn: { borderRadius: 14, overflow: 'hidden' },
  continueBtnDisabled: { opacity: 0.75 },
  continueBtnGradient: { paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  btnContentRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  continueBtnText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.3 },
  continueBtnTextDisabled: { color: '#94A3B8' },
  hintText: {
    marginTop: 18,
    textAlign: 'center',
    color: '#64748B',
    fontSize: 12,
    lineHeight: 17,
  },
});
