import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Keyboard,
  Platform,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../../store/authStore';
import { shadowStyle } from '../../utils/platformStyles';
import { FormKeyboardAvoid } from '../../components/common/FormKeyboardAvoid';

interface PhoneEntryScreenProps {
  navigation: any;
}

export const PhoneEntryScreen: React.FC<PhoneEntryScreenProps> = ({ navigation }) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const sendOtp = useAuthStore((state) => state.sendOtp);
  const scrollRef = useRef<ScrollView>(null);
  const inputCardY = useRef(0);

  const cleanNumber = phoneNumber.trim().replace(/\D/g, '');
  const isValidLength = cleanNumber.length === 10;

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvt, () => setKeyboardOpen(true));
    const hideSub = Keyboard.addListener(hideEvt, () => setKeyboardOpen(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const scrollInputIntoView = () => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, inputCardY.current - 24),
        animated: true,
      });
    });
  };

  const handleContinue = async () => {
    if (!cleanNumber) {
      Alert.alert('Phone Number Required', 'Please enter your 10-digit mobile number to proceed.');
      return;
    }

    if (cleanNumber.length < 10) {
      Alert.alert('Invalid Number', 'Please enter a complete 10-digit mobile number.');
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
      Alert.alert('Error', err.message || 'Could not send OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

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
          contentInsetAdjustmentBehavior="always"
        >
          <View style={[styles.brandHeader, keyboardOpen && styles.brandHeaderCompact]}>
            <LinearGradient
              colors={['#FF6B35', '#E55A2B']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.logoBadge, keyboardOpen && styles.logoBadgeCompact]}
            >
              <Ionicons name="sparkles" size={keyboardOpen ? 20 : 28} color="#FFFFFF" />
            </LinearGradient>

            {!keyboardOpen ? (
              <View style={styles.appPill}>
                <View style={styles.pulseDot} />
                <Text style={styles.appPillText}>ALL-IN-ONE SUPER APP</Text>
              </View>
            ) : null}

            <Text style={[styles.heroTitle, keyboardOpen && styles.heroTitleCompact]}>SuperApp</Text>
            {!keyboardOpen ? (
              <Text style={styles.heroSubtitle}>
                Delicious Food • Fast City Rides • Local Bazaar
              </Text>
            ) : null}
          </View>

          {!keyboardOpen ? (
            <View style={styles.featureRow}>
              <View style={styles.featureChip}>
                <Text style={styles.featureChipIcon}>🍕</Text>
                <Text style={styles.featureChipText}>Food Delivery</Text>
              </View>
              <View style={styles.featureChip}>
                <Text style={styles.featureChipIcon}>🚕</Text>
                <Text style={styles.featureChipText}>Fast Cabs</Text>
              </View>
              <View style={styles.featureChip}>
                <Text style={styles.featureChipIcon}>🛍️</Text>
                <Text style={styles.featureChipText}>Bazaar</Text>
              </View>
            </View>
          ) : null}

          <View
            style={styles.cardContainer}
            onLayout={(e) => {
              inputCardY.current = e.nativeEvent.layout.y;
            }}
          >
            <Text style={styles.cardTitle}>Login or Sign Up</Text>
            <Text style={styles.cardSubtitle}>
              Enter your mobile number — we will send a 6-digit OTP
            </Text>

            <View
              style={[
                styles.phoneInputCard,
                isFocused && styles.phoneInputCardFocused,
                isValidLength && styles.phoneInputCardValid,
              ]}
            >
              <Text style={styles.flagIcon}>🇮🇳</Text>
              <Text style={styles.countryCodeText}>+91</Text>
              <View style={styles.inputDivider} />
              <TextInput
                style={styles.phoneNumberInput}
                placeholder="10-digit mobile number"
                placeholderTextColor="#64748B"
                keyboardType="phone-pad"
                maxLength={10}
                value={phoneNumber}
                onChangeText={(t) => setPhoneNumber(t.replace(/\D/g, ''))}
                onFocus={() => {
                  setIsFocused(true);
                  scrollInputIntoView();
                }}
                onBlur={() => setIsFocused(false)}
                returnKeyType="done"
                blurOnSubmit
              />
              {phoneNumber.length > 0 ? (
                isValidLength ? (
                  <View style={styles.verifiedIconBox}>
                    <Ionicons name="checkmark-circle" size={22} color="#10B981" />
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={() => setPhoneNumber('')}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="close-circle" size={20} color="#64748B" />
                  </TouchableOpacity>
                )
              ) : null}
            </View>

            <View style={styles.helperRow}>
              <Text style={[styles.helperText, isValidLength && styles.helperTextReady]}>
                {isValidLength
                  ? 'Ready to send code'
                  : cleanNumber.length > 0
                  ? `${cleanNumber.length}/10 digits`
                  : 'Enter 10-digit mobile number'}
              </Text>
              <View style={styles.securityBadge}>
                <Ionicons name="shield-checkmark-outline" size={13} color="#0D9488" />
                <Text style={styles.securityBadgeText}>Secure</Text>
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.continueBtn,
                (!isValidLength || isLoading) && styles.continueBtnDisabled,
              ]}
              onPress={handleContinue}
              disabled={isLoading || !isValidLength}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={
                  isValidLength && !isLoading
                    ? ['#FF6B35', '#E55A2B']
                    : ['#334155', '#1E293B']
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.continueBtnGradient}
              >
                <View style={styles.btnContentRow}>
                  <Text
                    style={[
                      styles.continueBtnText,
                      !isValidLength && styles.continueBtnTextDisabled,
                    ]}
                  >
                    {isLoading ? 'Sending OTP…' : 'Get Verification Code'}
                  </Text>
                  {!isLoading ? (
                    <Ionicons
                      name="arrow-forward"
                      size={18}
                      color={isValidLength ? '#FFFFFF' : '#64748B'}
                    />
                  ) : null}
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {!keyboardOpen ? (
            <>
              <View style={styles.trustGrid}>
                <View style={styles.trustItem}>
                  <Ionicons name="flash-outline" size={16} color="#FF8A5C" />
                  <Text style={styles.trustText}>Instant SMS OTP</Text>
                </View>
                <View style={styles.trustDot} />
                <View style={styles.trustItem}>
                  <Ionicons name="lock-closed-outline" size={16} color="#10B981" />
                  <Text style={styles.trustText}>Encrypted</Text>
                </View>
                <View style={styles.trustDot} />
                <View style={styles.trustItem}>
                  <Ionicons name="shield-outline" size={16} color="#3B82F6" />
                  <Text style={styles.trustText}>Zero Spam</Text>
                </View>
              </View>

              <Text style={styles.termsText}>
                By continuing, you agree to RJ09 SEWA's{' '}
                <Text
                  style={styles.termsLink}
                  onPress={() => Linking.openURL('https://superapp-website-ashen.vercel.app/terms-and-conditions')}
                >
                  Terms of Service
                </Text>{' '}
                and{' '}
                <Text
                  style={styles.termsLink}
                  onPress={() => Linking.openURL('https://superapp-website-ashen.vercel.app/privacy-policy')}
                >
                  Privacy Policy
                </Text>.
              </Text>
            </>
          ) : null}
        </ScrollView>
      </FormKeyboardAvoid>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0A0E21',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContentKeyboard: {
    justifyContent: 'flex-start',
    paddingTop: 8,
    paddingBottom: 120,
  },
  brandHeader: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 18,
  },
  brandHeaderCompact: {
    marginTop: 0,
    marginBottom: 12,
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadowStyle({
      color: '#FF6B35',
      offsetY: 8,
      opacity: 0.35,
      radius: 16,
      elevation: 8,
    }),
    marginBottom: 14,
  },
  logoBadgeCompact: {
    width: 44,
    height: 44,
    borderRadius: 14,
    marginBottom: 8,
  },
  appPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 107, 53, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.25)',
    marginBottom: 10,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF6B35',
    marginRight: 6,
  },
  appPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FF8A5C',
    letterSpacing: 1.2,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  heroTitleCompact: {
    fontSize: 22,
    marginBottom: 0,
  },
  heroSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 18,
  },
  featureRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 22,
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  featureChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141829',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2A2D3E',
  },
  featureChipIcon: {
    fontSize: 13,
    marginRight: 6,
  },
  featureChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#CBD5E1',
  },
  cardContainer: {
    width: '100%',
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
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 19,
    marginBottom: 18,
  },
  phoneInputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A0E21',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#2A2D3E',
    paddingHorizontal: 12,
    minHeight: 56,
    marginBottom: 8,
  },
  phoneInputCardFocused: {
    borderColor: '#FF6B35',
    backgroundColor: '#0d122b',
  },
  phoneInputCardValid: {
    borderColor: '#10B981',
  },
  flagIcon: {
    fontSize: 18,
    marginRight: 4,
  },
  countryCodeText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  inputDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#2A2D3E',
    marginHorizontal: 10,
  },
  phoneNumberInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    margin: 0,
  },
  verifiedIconBox: {
    marginLeft: 6,
  },
  helperRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
    paddingHorizontal: 4,
  },
  helperText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  helperTextReady: {
    color: '#10B981',
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  securityBadgeText: {
    fontSize: 11,
    color: '#0D9488',
    fontWeight: '700',
  },
  continueBtn: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  continueBtnDisabled: {
    opacity: 0.75,
  },
  continueBtnGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  continueBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  continueBtnTextDisabled: {
    color: '#94A3B8',
  },
  trustGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  trustItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  trustText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  trustDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#334155',
  },
  termsText: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 320,
  },
  termsLink: {
    color: '#94A3B8',
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
