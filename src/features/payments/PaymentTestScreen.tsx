import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppColors } from '../../theme/colors';
import { AppButton } from '../../components/common/AppButton';
import { paymentService } from '../../services/paymentService';
import { openEasebuzzCheckout } from '../../services/easebuzzCheckout';
import { PaymentKitInfo, PaymentModule, PaymentOrderResult } from '../../models/payment';
import { MockCheckoutSheet } from './MockCheckoutSheet';

interface PaymentTestScreenProps {
  navigation: any;
}

const AMOUNTS = [1, 10, 99];

export const PaymentTestScreen: React.FC<PaymentTestScreenProps> = ({ navigation }) => {
  const [amount, setAmount] = useState('1');
  const [module, setModule] = useState<PaymentModule>('TEST');
  const [kit, setKit] = useState<PaymentKitInfo | null>(null);
  const [kitError, setKitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resultText, setResultText] = useState<string | null>(null);
  const [resultOk, setResultOk] = useState<boolean | null>(null);
  const [pendingOrder, setPendingOrder] = useState<PaymentOrderResult | null>(null);

  useEffect(() => {
    paymentService
      .getKit()
      .then((info) => {
        setKit(info);
        setKitError(null);
      })
      .catch((err: any) => {
        setKitError(err?.message || 'Could not load payment kit from API');
      });
  }, []);

  const notify = (title: string, message: string) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.alert(`${title}\n${message}`);
      return;
    }
    Alert.alert(title, message);
  };

  const runPay = async () => {
    const rupees = Number(amount);
    if (!rupees || rupees <= 0) {
      notify('Amount', 'Enter an amount greater than 0');
      return;
    }

    setBusy(true);
    setResultText(null);
    setResultOk(null);
    try {
      const kitInfo = kit ?? (await paymentService.getKit().catch(() => undefined));
      const order = await paymentService.createOrder(rupees, module);

      if (paymentService.usesEasebuzz(order, kitInfo)) {
        const checkout = await openEasebuzzCheckout(order);
        const verified = await paymentService.verify(
          checkout.txnid,
          order.orderId,
          checkout.hash
        );
        const ok = verified.isVerified || checkout.status === 'success';
        setResultOk(ok);
        setResultText(
          ok ? `PAID ${checkout.txnid}` : verified.message || 'Payment failed'
        );
        notify(ok ? 'Payment success' : 'Payment failed', checkout.txnid);
        return;
      }

      setPendingOrder(order);
    } catch (err: any) {
      setResultOk(false);
      setResultText(err?.message || 'Create order failed');
      notify('Payment error', err?.message || 'Create order failed');
    } finally {
      setBusy(false);
    }
  };

  const finishMock = async (success: boolean) => {
    if (!pendingOrder) return;
    setBusy(true);
    try {
      const verified = await paymentService.completeMock(pendingOrder.transactionId, success);
      setResultOk(verified.isVerified);
      setResultText(`${verified.status}: ${verified.message || verified.transactionId}`);
      notify(
        verified.isVerified ? 'Test payment success' : 'Test payment failed',
        verified.transactionId
      );
      setPendingOrder(null);
    } catch (err: any) {
      setResultOk(false);
      setResultText(err?.message || 'Mock complete failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Ionicons name="chevron-back" size={26} color={AppColors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Easebuzz Payment</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.card}>
          <Text style={styles.badge}>TEST MODE</Text>
          {kitError ? (
            <Text style={styles.bad}>{kitError}</Text>
          ) : kit ? (
            <>
              <Text style={styles.meta}>Active provider: {kit.activeProvider}</Text>
              <Text style={styles.meta}>Checkout: {kit.checkoutMode}</Text>
              <Text style={styles.meta}>Key: {kit.keyId || '(none — using mock checkout)'}</Text>
            </>
          ) : (
            <Text style={styles.meta}>Loading kit from /api/payments/kit …</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Amount (INR)</Text>
          <TextInput
            style={styles.input}
            value={amount}
            onChangeText={(t) => setAmount(t.replace(/[^\d.]/g, ''))}
            keyboardType="decimal-pad"
          />
          <View style={styles.chips}>
            {AMOUNTS.map((n) => (
              <TouchableOpacity key={n} style={styles.chip} onPress={() => setAmount(String(n))}>
                <Text style={styles.chipText}>₹{n}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Module</Text>
          <View style={styles.chips}>
            {(['TEST', 'FOOD', 'RIDE'] as PaymentModule[]).map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.chip, module === m && styles.chipOn]}
                onPress={() => setModule(m)}
              >
                <Text style={[styles.chipText, module === m && styles.chipTextOn]}>{m}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <AppButton
            text={busy ? 'Working…' : `Pay ₹${amount || '0'}`}
            onPressed={runPay}
            isLoading={busy}
            disabled={busy}
          />

          {resultText ? (
            <Text style={[styles.result, resultOk ? styles.ok : styles.bad]}>{resultText}</Text>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.helpTitle}>How to test Easebuzz</Text>
          <Text style={styles.help}>
            Tap Pay. Easebuzz checkout opens (test mode). Use Easebuzz test cards from their docs
            (Visa 4012 0010 3714 1112, any future expiry, any CVV).
          </Text>
          <Text style={styles.help}>
            Success/fail URLs hit http://localhost:5000/api/payments/easebuzz-return then this
            screen verifies via Transaction API v2.1.
          </Text>
        </View>
      </ScrollView>

      <MockCheckoutSheet
        visible={Boolean(pendingOrder)}
        order={pendingOrder}
        isBusy={busy}
        onSuccess={() => void finishMock(true)}
        onFailure={() => void finishMock(false)}
        onClose={() => setPendingOrder(null)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: AppColors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  back: { padding: 4 },
  headerTitle: { color: AppColors.textPrimary, fontSize: 17, fontWeight: '800' },
  body: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: AppColors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  badge: {
    color: AppColors.primary,
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 1,
    marginBottom: 8,
  },
  meta: { color: AppColors.textSecondary, marginBottom: 4 },
  label: { color: AppColors.textSecondary, fontSize: 12, marginBottom: 6, marginTop: 4 },
  input: {
    backgroundColor: AppColors.background,
    borderColor: AppColors.border,
    borderWidth: 1,
    borderRadius: 12,
    color: AppColors.textPrimary,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 10,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: {
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipOn: { borderColor: AppColors.primary, backgroundColor: 'rgba(255,107,53,0.15)' },
  chipText: { color: AppColors.textSecondary, fontWeight: '700' },
  chipTextOn: { color: AppColors.primary },
  result: { marginTop: 14, fontWeight: '700' },
  ok: { color: AppColors.success },
  bad: { color: AppColors.error },
  helpTitle: { color: AppColors.textPrimary, fontWeight: '800', marginBottom: 8 },
  help: { color: AppColors.textSecondary, lineHeight: 20, marginBottom: 8 },
});
