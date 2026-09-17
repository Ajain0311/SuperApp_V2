import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { AppColors } from '../../theme/colors';
import { AppRadius } from '../../theme/spacing';
import { AppButton } from '../../components/common/AppButton';
import { PaymentOrderResult } from '../../models/payment';

interface MockCheckoutSheetProps {
  visible: boolean;
  order: PaymentOrderResult | null;
  isBusy: boolean;
  onSuccess: () => void;
  onFailure: () => void;
  onClose: () => void;
}

const SUCCESS_CARD = '4111111111111111';
const SUCCESS_UPI = 'success@razorpay';

export const MockCheckoutSheet: React.FC<MockCheckoutSheetProps> = ({
  visible,
  order,
  isBusy,
  onSuccess,
  onFailure,
  onClose,
}) => {
  const [card, setCard] = useState(SUCCESS_CARD);
  const [upi, setUpi] = useState('');
  const [otp, setOtp] = useState('1234');

  const canSucceed =
    card.replace(/\s/g, '') === SUCCESS_CARD || upi.trim().toLowerCase() === SUCCESS_UPI;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.kicker}>TEST CHECKOUT · MOCK</Text>
          <Text style={styles.title}>Pay ₹{order?.amount ?? 0}</Text>
          <Text style={styles.sub}>
            Order {order?.orderId || '—'} · no real money. Success card or UPI below.
          </Text>

          <Text style={styles.label}>Card number</Text>
          <TextInput
            style={styles.input}
            value={card}
            onChangeText={(t) => setCard(t.replace(/[^\d]/g, '').slice(0, 16))}
            keyboardType="number-pad"
            placeholder="4111111111111111"
            placeholderTextColor={AppColors.textHint}
          />

          <Text style={styles.label}>UPI (optional)</Text>
          <TextInput
            style={styles.input}
            value={upi}
            onChangeText={setUpi}
            autoCapitalize="none"
            placeholder="success@razorpay"
            placeholderTextColor={AppColors.textHint}
          />

          <Text style={styles.label}>OTP</Text>
          <TextInput
            style={styles.input}
            value={otp}
            onChangeText={setOtp}
            keyboardType="number-pad"
            maxLength={4}
            placeholder="1234"
            placeholderTextColor={AppColors.textHint}
          />

          <AppButton
            text={isBusy ? 'Processing…' : `Pay ₹${order?.amount ?? 0} (Success)`}
            onPressed={() => {
              if (otp !== '1234' || !canSucceed) {
                onFailure();
                return;
              }
              onSuccess();
            }}
            isLoading={isBusy}
            disabled={isBusy}
          />

          <TouchableOpacity style={styles.failBtn} onPress={onFailure} disabled={isBusy}>
            <Text style={styles.failText}>Simulate failure</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onClose} disabled={isBusy}>
            <Text style={styles.cancel}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: AppColors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: Platform.OS === 'web' ? 32 : 40,
  },
  kicker: {
    color: AppColors.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 8,
  },
  title: {
    color: AppColors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
  },
  sub: {
    color: AppColors.textSecondary,
    marginTop: 6,
    marginBottom: 18,
    lineHeight: 20,
  },
  label: {
    color: AppColors.textSecondary,
    fontSize: 12,
    marginBottom: 6,
  },
  input: {
    backgroundColor: AppColors.background,
    borderColor: AppColors.border,
    borderWidth: 1,
    borderRadius: AppRadius.md,
    color: AppColors.textPrimary,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    fontSize: 16,
  },
  failBtn: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 10,
  },
  failText: {
    color: AppColors.error,
    fontWeight: '700',
  },
  cancel: {
    color: AppColors.textTertiary,
    textAlign: 'center',
    marginTop: 8,
  },
});
